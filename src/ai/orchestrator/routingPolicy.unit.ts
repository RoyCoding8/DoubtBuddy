import { AppSettingsV2, defaultAppSettings } from '../../types/settings';
import { DefaultRoutingPolicyEngine } from './routingPolicy';
import { InferenceOrchestrator } from './inferenceOrchestrator';
import { ProviderAdapter } from '../providers/providerAdapter';
import { SolveRequest, SolveResponse } from '../contracts/aiContracts';
import { NormalizedErrorCode } from '../contracts/aiErrors';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const baseSettings = (): AppSettingsV2 => ({
  providerPriority: ['gemini', 'openrouter', 'huggingface', 'local_template'],
  providerModels: { ...defaultAppSettings.providerModels },
  qualityMode: 'balanced',
  enableAppLock: false,
  enableSerpEnrichment: false,
  featureFlags: {
    openRouterEnabled: true,
    huggingFaceEnabled: true,
    diagnosticsEnabled: false,
  },
  sessionTurnLimit: 8,
});

const healthy = {
  gemini: { available: true, failureRate: 0 },
  openrouter: { available: true, failureRate: 0 },
  huggingface: { available: true, failureRate: 0 },
  local_template: { available: true, failureRate: 0 },
} as const;

const makeRequest = (qualityMode: SolveRequest['qualityMode']): SolveRequest => ({
  requestId: `req-${qualityMode}`,
  prompt: {
    system: 'system',
    user: 'user',
  },
  mode: 'quick_answer',
  qualityMode,
});

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
    yield 'not-used';
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

const runFastModeOrdering = (): void => {
  const engine = new DefaultRoutingPolicyEngine();
  const settings = baseSettings();

  const selected = engine.selectProviders({
    settings,
    qualityMode: 'fast',
    health: {
      ...healthy,
      gemini: { available: true, failureRate: 0.3 },
      openrouter: { available: true, failureRate: 0 },
    },
  });

  assert(selected[0] === 'openrouter', 'fast mode should prioritize lower-latency fallback when gemini health degrades');
};

const runBalancedModeOrdering = (): void => {
  const engine = new DefaultRoutingPolicyEngine();
  const settings = baseSettings();

  const selected = engine.selectProviders({
    settings,
    qualityMode: 'balanced',
    health: healthy,
  });

  assert(selected[0] === 'gemini', 'balanced mode should follow configured priority when health is equal');
  assert(selected[1] === 'openrouter', 'balanced mode should keep configured fallback order');
};

const runHighAccuracyOrdering = (): void => {
  const engine = new DefaultRoutingPolicyEngine();
  const settings = baseSettings();

  const selected = engine.selectProviders({
    settings,
    qualityMode: 'high_accuracy',
    health: healthy,
  });

  assert(
    selected[selected.length - 1] === 'local_template',
    'high_accuracy mode should keep deterministic template as last resort',
  );
};

const runPrimaryFailureFallbackIntegration = async (): Promise<void> => {
  const gemini = new FakeAdapter('gemini', async () => {
    throw new Error('gemini-down');
  });

  const openrouter = new FakeAdapter('openrouter', async () => ({
    text: 'openrouter-answer',
    provider: 'openrouter',
    model: 'openrouter-model',
    latencyMs: 5,
  }));

  const orchestrator = new InferenceOrchestrator([gemini, openrouter], {
    getSettings: async () => baseSettings(),
  });

  const result = await orchestrator.solveWithMetadata(makeRequest('balanced'));
  assert(result.response.provider === 'openrouter', 'primary failure should automatically use next provider in chain');
  assert(result.fallbackLevel === 1, 'fallback level should mark one provider hop after primary failure');

  const orchestratorForSolve = new InferenceOrchestrator([gemini, openrouter], {
    getSettings: async () => baseSettings(),
  });

  const solveResult = await orchestratorForSolve.solve(makeRequest('balanced'));
  assert(solveResult.provider === 'openrouter', 'solve should return the successful fallback provider');
  assert(
    solveResult.orchestration?.fallbackLevel === 1,
    'solve should expose fallback metadata on response orchestration block',
  );
  assert(
    solveResult.orchestration?.attempts === 1,
    'solve orchestration metadata should include retry-attempt count for successful provider execution',
  );
};

export const runRoutingPolicyUnitTests = async (): Promise<void> => {
  runFastModeOrdering();
  runBalancedModeOrdering();
  runHighAccuracyOrdering();
  await runPrimaryFailureFallbackIntegration();
};
