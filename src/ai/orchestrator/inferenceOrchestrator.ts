import {
  InferenceOrchestrator as IInferenceOrchestrator,
  ProviderAdapter,
  ProviderId,
  SolveRequest,
  SolveResponse,
} from '../contracts/aiContracts';
import { AIProviderError } from '../contracts/aiErrors';
import { RetryPolicyExecutor, retryPolicyExecutor } from './retryPolicy';
import { ProviderHealthStore, createDefaultProviderHealthStore } from './providerHealthStore';
import { DefaultRoutingPolicyEngine, routingPolicyEngine } from './routingPolicy';
import { DefaultQualityVerifier } from './qualityVerifier';
import { AppSettingsV2, defaultAppSettings } from '../../types/settings';
import {
  TelemetrySink,
  createDefaultTelemetryService,
} from '../../domains/observability/telemetryService';
import { InferenceEvent } from '../../domains/observability/types';

export interface InferenceOrchestratorDependencies {
  retryExecutor?: RetryPolicyExecutor;
  healthStore?: ProviderHealthStore;
  routingPolicy?: DefaultRoutingPolicyEngine;
  qualityVerifier?: DefaultQualityVerifier;
  telemetry?: TelemetrySink;
  getSettings?: () => Promise<AppSettingsV2>;
}

export class InferenceOrchestrator implements IInferenceOrchestrator {
  private readonly providers: Partial<Record<ProviderId, ProviderAdapter>>;
  private readonly retryExecutor: RetryPolicyExecutor;
  private readonly healthStore: ProviderHealthStore;
  private readonly routingPolicy: DefaultRoutingPolicyEngine;
  private readonly qualityVerifier: DefaultQualityVerifier;
  private readonly telemetry: TelemetrySink;
  private readonly getSettings: () => Promise<AppSettingsV2>;

  constructor(adapters: ProviderAdapter[], dependencies?: InferenceOrchestratorDependencies) {
    this.providers = adapters.reduce((acc, adapter) => {
      acc[adapter.id] = adapter;
      return acc;
    }, {} as Partial<Record<ProviderId, ProviderAdapter>>);

    this.retryExecutor = dependencies?.retryExecutor ?? retryPolicyExecutor;
    this.healthStore =
      dependencies?.healthStore ?? createDefaultProviderHealthStore(adapters.map((adapter) => adapter.id));
    this.routingPolicy = dependencies?.routingPolicy ?? routingPolicyEngine;
    this.qualityVerifier = dependencies?.qualityVerifier ?? new DefaultQualityVerifier(this.providers);
    this.telemetry = dependencies?.telemetry ?? createDefaultTelemetryService();
    this.getSettings = dependencies?.getSettings ?? (async () => defaultAppSettings);
  }

  async solve(request: SolveRequest): Promise<SolveResponse> {
    const result = await this.solveWithMetadata(request);
    return result.response;
  }

  async *stream(request: SolveRequest): AsyncGenerator<{ chunk: string; provider: ProviderId; replace?: boolean }> {
    const response = await this.solve(request);
    yield {
      chunk: response.text,
      provider: response.provider,
    };
  }

  async solveWithMetadata(request: SolveRequest): Promise<{
    response: SolveResponse;
    fallbackLevel: number;
    retries: number;
    attempts: number;
    timeoutMs: number;
  }> {
    const settings = await this.getSettings();
    const providers = this.selectProviderChain(settings, request);

    let lastError: unknown = null;

    for (let index = 0; index < providers.length; index += 1) {
      const providerId = providers[index];
      const permit = this.healthStore.acquireRequestPermit(providerId);

      if (!permit.allowed) {
        continue;
      }

      try {
        const execution = await this.solveWithProvider({
          providerId,
          request,
          isFallbackProvider: index > 0,
          fallbackLevel: index,
          requestId: request.requestId,
          model: this.resolveModelForProvider(settings, providerId),
        });

        const verification = await this.qualityVerifier.verify({
          request,
          candidate: execution,
          solverProvider: execution.provider,
          providerChain: providers,
        });

        const response: SolveResponse = {
          text: execution.text,
          provider: execution.provider,
          model: execution.model,
          latencyMs: execution.latencyMs,
          tokenEstimate: execution.tokenEstimate,
          verification,
          orchestration: {
            fallbackLevel: index,
            retries: execution.retries,
            attempts: execution.attempts,
            timeoutMs: execution.timeoutMs,
          },
        };

        this.healthStore.recordSuccess(providerId);
        return {
          response,
          fallbackLevel: index,
          retries: execution.retries,
          attempts: execution.attempts,
          timeoutMs: execution.timeoutMs,
        };
      } catch (error) {
        this.healthStore.recordFailure(providerId);
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new AIProviderError({
      code: 'UNKNOWN',
      message: 'No available providers after routing policy evaluation',
      retryable: false,
    });
  }

  async solveWithProvider(input: {
    providerId: ProviderId;
    request: SolveRequest;
    isFallbackProvider: boolean;
    fallbackLevel: number;
    requestId: string;
    model: string;
    signal?: AbortSignal;
  }): Promise<SolveResponse & { retries: number; attempts: number; timeoutMs: number }> {
    const adapter = this.providers[input.providerId];
    if (!adapter) {
      throw new Error(`No provider adapter registered for ${input.providerId}`);
    }

    const attemptStartTimes = new Map<number, number>();

    const execution = await this.retryExecutor.execute({
      isFallbackProvider: input.isFallbackProvider,
      signal: input.signal,
      onAttempt: ({ attempt }) => {
        attemptStartTimes.set(attempt, Date.now());
      },
      normalizeError: (error) => adapter.normalizeError(error),
      operation: async ({ signal, attempt }) => {
        const attemptStartedAt = attemptStartTimes.get(attempt) ?? Date.now();

        try {
          const result = await adapter.generate(input.request, signal);
          await this.emitTelemetryEvent({
            requestId: input.requestId,
            timestamp: new Date().toISOString(),
            provider: input.providerId,
            model: result.model,
            latencyMs: Math.max(0, Date.now() - attemptStartedAt),
            status: 'success',
            fallbackLevel: input.fallbackLevel,
            tokenEstimate: result.tokenEstimate,
          });
          return result;
        } catch (error) {
          const normalized = adapter.normalizeError(error);
          await this.emitTelemetryEvent({
            requestId: input.requestId,
            timestamp: new Date().toISOString(),
            provider: input.providerId,
            model: input.model,
            latencyMs: Math.max(0, Date.now() - attemptStartedAt),
            status: 'failed',
            errorCode: normalized.code,
            fallbackLevel: input.fallbackLevel,
          });
          throw error;
        }
      },
    });

    return {
      ...execution.value,
      retries: execution.retries,
      attempts: execution.attempts,
      timeoutMs: execution.timeoutMs,
    };
  }

  private selectProviderChain(settings: AppSettingsV2, request: SolveRequest): ProviderId[] {
    const healthSnapshot = this.healthStore.getHealthSnapshot();
    const hasProvider = (providerId: ProviderId): boolean => Object.prototype.hasOwnProperty.call(this.providers, providerId);

    const route = this.routingPolicy.selectProviders({
      settings,
      qualityMode: request.qualityMode,
      health: {
        gemini: {
          available: hasProvider('gemini') && (healthSnapshot.gemini?.available ?? false),
          failureRate: healthSnapshot.gemini?.failureRate ?? 1,
        },
        openrouter: {
          available: hasProvider('openrouter') && (healthSnapshot.openrouter?.available ?? false),
          failureRate: healthSnapshot.openrouter?.failureRate ?? 1,
        },
        huggingface: {
          available: hasProvider('huggingface') && (healthSnapshot.huggingface?.available ?? false),
          failureRate: healthSnapshot.huggingface?.failureRate ?? 1,
        },
        local_template: {
          available: hasProvider('local_template') && (healthSnapshot.local_template?.available ?? false),
          failureRate: healthSnapshot.local_template?.failureRate ?? 1,
        },
      },
    });

    return route.filter((providerId) => Boolean(this.providers[providerId]));
  }

  private resolveModelForProvider(settings: AppSettingsV2, providerId: ProviderId): string {
    if (providerId === 'local_template') {
      return 'local-template:v1';
    }

    return settings.providerModels[providerId];
  }

  private async emitTelemetryEvent(event: InferenceEvent): Promise<void> {
    try {
      await this.telemetry.recordInferenceAttempt(event);
    } catch {
      // telemetry failures must not break solve flow
    }
  }
}
