import { ProviderAdapter } from '../providers/providerAdapter';
import { SolveRequest, SolveResponse } from '../contracts/aiContracts';
import { NormalizedErrorCode } from '../contracts/aiErrors';
import { InferenceOrchestrator } from './inferenceOrchestrator';
import { InferenceEvent } from '../../domains/observability/types';
import { TelemetrySink } from '../../domains/observability/telemetryService';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

class RecordingTelemetrySink implements TelemetrySink {
  events: InferenceEvent[] = [];

  async recordInferenceAttempt(event: InferenceEvent): Promise<void> {
    this.events.push(event);
  }
}

class FakeAdapter implements ProviderAdapter {
  id: ProviderAdapter['id'];
  private readonly handler: (req: SolveRequest) => Promise<SolveResponse>;

  constructor(id: ProviderAdapter['id'], handler: (req: SolveRequest) => Promise<SolveResponse>) {
    this.id = id;
    this.handler = handler;
  }

  async generate(req: SolveRequest, _signal: AbortSignal): Promise<SolveResponse> {
    return this.handler(req);
  }

  async *stream(_req: SolveRequest, _signal: AbortSignal): AsyncGenerator<string> {
    yield '';
  }

  async healthCheck(_signal: AbortSignal): Promise<{ ok: boolean; latencyMs: number; errorCode?: NormalizedErrorCode }> {
    return { ok: true, latencyMs: 1 };
  }

  normalizeError(error: unknown): { code: NormalizedErrorCode; message: string; retryable: boolean } {
    return {
      code: 'SERVER',
      message: error instanceof Error ? error.message : String(error),
      retryable: true,
    };
  }
}

const request: SolveRequest = {
  requestId: 'task-13-telemetry',
  prompt: {
    system: 'system',
    user: 'user',
  },
  mode: 'quick_answer',
  qualityMode: 'balanced',
};

const runTelemetryEmitsForEachRetryAndFallbackAttempt = async (): Promise<void> => {
  const telemetry = new RecordingTelemetrySink();

  const gemini = new FakeAdapter('gemini', async () => {
    throw new Error('gemini down');
  });

  const openrouter = new FakeAdapter('openrouter', async () => ({
    text: 'fallback success',
    provider: 'openrouter',
    model: 'openrouter-model',
    latencyMs: 5,
  }));

  const orchestrator = new InferenceOrchestrator([gemini, openrouter], {
    telemetry,
    getSettings: async () => ({
      providerPriority: ['gemini', 'openrouter', 'huggingface', 'local_template'],
      providerModels: {
        gemini: 'gemini-2.5-flash',
        openrouter: 'openai/gpt-4o-mini',
        huggingface: 'mistralai/Mistral-7B-Instruct-v0.3',
      },
      qualityMode: 'balanced',
      enableAppLock: false,
      enableSerpEnrichment: false,
      featureFlags: {
        openRouterEnabled: true,
        huggingFaceEnabled: true,
        diagnosticsEnabled: true,
      },
      sessionTurnLimit: 8,
    }),
  });

  const result = await orchestrator.solve(request);
  assert(result.provider === 'openrouter', 'expected fallback provider success');
  assert(telemetry.events.length === 3, 'event count must match retry + fallback attempt count');
  assert(telemetry.events[0]?.provider === 'gemini', 'first event should map to primary provider attempt');
  assert(telemetry.events[0]?.status === 'failed', 'primary provider event should be marked failed');
  assert(telemetry.events[0]?.fallbackLevel === 0, 'primary event should include fallback level 0');
  assert(telemetry.events[1]?.provider === 'gemini', 'second event should map to retry attempt on primary provider');
  assert(telemetry.events[1]?.status === 'failed', 'retry attempt event should be marked failed');
  assert(telemetry.events[1]?.fallbackLevel === 0, 'retry attempt should retain primary fallback level');
  assert(telemetry.events[2]?.provider === 'openrouter', 'third event should map to fallback provider attempt');
  assert(telemetry.events[2]?.status === 'success', 'fallback provider event should be marked success');
  assert(telemetry.events[2]?.fallbackLevel === 1, 'fallback event should include fallback level metadata');
};

export const runTelemetryIntegrationTests = async (): Promise<void> => {
  await runTelemetryEmitsForEachRetryAndFallbackAttempt();
};
