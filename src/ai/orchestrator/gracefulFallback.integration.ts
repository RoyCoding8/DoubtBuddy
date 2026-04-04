import { SolveRequest, SolveResponse } from '../contracts/aiContracts';
import { NormalizedErrorCode } from '../contracts/aiErrors';
import { ProviderAdapter } from '../providers/providerAdapter';
import { LocalTemplateAdapter } from '../providers/localTemplateAdapter';
import { InferenceOrchestrator } from './inferenceOrchestrator';
import { buildLocalFallbackDoubtResponse } from '../../domains/doubt/doubtService';
import { defaultAppSettings } from '../../types/settings';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

class AlwaysFailAdapter implements ProviderAdapter {
  id: ProviderAdapter['id'];

  constructor(id: ProviderAdapter['id']) {
    this.id = id;
  }

  async generate(_req: SolveRequest, _signal: AbortSignal): Promise<SolveResponse> {
    throw new Error(`${this.id}-failure`);
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

const createRequest = (): SolveRequest => ({
  requestId: 'task-9-fallback',
  prompt: {
    system: 'You are a JEE tutor.',
    user: 'Find current through a 10Ω resistor connected to 20V source.',
  },
  mode: 'step_by_step',
  qualityMode: 'balanced',
});

const runAllRemoteFailFallsToLocalTemplate = async (): Promise<void> => {
  const request = createRequest();
  const orchestrator = new InferenceOrchestrator(
    [
      new AlwaysFailAdapter('gemini'),
      new AlwaysFailAdapter('openrouter'),
      new AlwaysFailAdapter('huggingface'),
      new LocalTemplateAdapter(),
    ],
    {
      getSettings: async () => ({
        ...defaultAppSettings,
        featureFlags: {
          ...defaultAppSettings.featureFlags,
          openRouterEnabled: true,
          huggingFaceEnabled: true,
        },
      }),
    },
  );

  const result = await orchestrator.solve(request);
  assert(result.provider === 'local_template', 'Expected local template provider when all remote providers fail');
  assert(result.verification?.confidence === 'low', 'Expected low confidence for degraded local fallback');
  assert(
    result.text.includes('Degraded fallback (unverified)'),
    'Expected fallback response to be clearly labeled as unverified',
  );
  assert(
    (result.verification?.note || '').includes('retryAction=retry_solve'),
    'Expected fallback verification note to include retry CTA metadata',
  );
};

const runDoubtServiceFallbackLabeling = async (): Promise<void> => {
  const fallback = await buildLocalFallbackDoubtResponse(createRequest());
  assert(fallback.confidence === 'low', 'Doubt fallback adapter must return low confidence');
  assert(
    fallback.responseMarkdown.includes('Degraded fallback (unverified)'),
    'Doubt fallback response must include degraded/unverified label',
  );
  assert(fallback.fallbackMetadata.retryAction === 'retry_solve', 'Fallback metadata must include retry action');
  assert(fallback.fallbackMetadata.retryLabel === 'Retry now', 'Fallback metadata must include retry label');
};

export const runGracefulFallbackIntegrationTests = async (): Promise<void> => {
  await runAllRemoteFailFallsToLocalTemplate();
  await runDoubtServiceFallbackLabeling();
};
