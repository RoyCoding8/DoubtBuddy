import { ProviderAdapter } from '../providers/providerAdapter';
import { NormalizedErrorCode } from '../contracts/aiErrors';
import { SolveRequest, SolveResponse } from '../contracts/aiContracts';
import { DefaultQualityVerifier, runDeterministicVerificationChecks } from './qualityVerifier';
import { InferenceOrchestrator } from './inferenceOrchestrator';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

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
      code: 'UNKNOWN',
      message: error instanceof Error ? error.message : String(error),
      retryable: true,
    };
  }
}

const request: SolveRequest = {
  requestId: 'verify-test',
  prompt: {
    system: 'Solve IIT-JEE question',
    user: 'A 2 kg block accelerates at 3 m/s^2. Find force and include units.',
  },
  mode: 'step_by_step',
  qualityMode: 'balanced',
};

const runConfidenceMappingUnit = async (): Promise<void> => {
  const gemini = new FakeAdapter('gemini', async (req) => {
    if (req.requestId.includes(':verify:')) {
      return {
        text: '{"verdict":"pass","issues":[]}',
        provider: 'gemini',
        model: 'g',
        latencyMs: 1,
      };
    }

    return {
      text: 'Force F = ma = 6 N. Therefore final answer is 6 N.',
      provider: 'gemini',
      model: 'g',
      latencyMs: 1,
    };
  });

  const openrouterPass = new FakeAdapter('openrouter', async () => ({
    text: '{"verdict":"pass","issues":[]}',
    provider: 'openrouter',
    model: 'o',
    latencyMs: 1,
  }));

  const verifierHigh = new DefaultQualityVerifier({ gemini, openrouter: openrouterPass });
  const high = await verifierHigh.verify({
    request,
    candidate: {
      text: 'Force F = ma = 6 N. Therefore final answer is 6 N.',
      provider: 'gemini',
      model: 'g',
      latencyMs: 2,
    },
    solverProvider: 'gemini',
    providerChain: ['gemini', 'openrouter'],
  });
  assert(high.confidence === 'high', 'cross-provider pass must map to high confidence');

  const verifierMedium = new DefaultQualityVerifier({ gemini });
  const medium = await verifierMedium.verify({
    request,
    candidate: {
      text: 'Force F = ma = 6 N. Therefore final answer is 6 N.',
      provider: 'gemini',
      model: 'g',
      latencyMs: 2,
    },
    solverProvider: 'gemini',
    providerChain: ['gemini'],
  });
  assert(medium.confidence === 'medium', 'same-provider pass must map to medium confidence');

  const openrouterRevise = new FakeAdapter('openrouter', async () => ({
    text: '{"verdict":"revise","issues":["unit mismatch"]}',
    provider: 'openrouter',
    model: 'o',
    latencyMs: 1,
  }));
  const verifierLow = new DefaultQualityVerifier({ gemini, openrouter: openrouterRevise });
  const low = await verifierLow.verify({
    request,
    candidate: {
      text: 'Force is 6',
      provider: 'gemini',
      model: 'g',
      latencyMs: 2,
    },
    solverProvider: 'gemini',
    providerChain: ['gemini', 'openrouter'],
  });
  assert(low.confidence === 'low', 'revise verdict must map to low confidence');

  const deterministicLow = runDeterministicVerificationChecks('Find force in N', 'maybe 6');
  assert(deterministicLow.passed === false, 'weak deterministic signal should fail checks');
};

const runAlternateProviderIntegration = async (): Promise<void> => {
  const gemini = new FakeAdapter('gemini', async (req) => ({
    text: req.requestId.includes(':verify:')
      ? '{"verdict":"pass","issues":[]}'
      : 'Force F = ma = 6 N. Therefore final answer is 6 N.',
    provider: 'gemini',
    model: 'g',
    latencyMs: 3,
  }));

  const openrouter = new FakeAdapter('openrouter', async (req) => ({
    text: req.requestId.includes(':verify:')
      ? '{"verdict":"pass","issues":[]}'
      : 'OpenRouter fallback answer.',
    provider: 'openrouter',
    model: 'o',
    latencyMs: 3,
  }));

  const orchestrator = new InferenceOrchestrator([gemini, openrouter], {
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
        diagnosticsEnabled: false,
      },
      sessionTurnLimit: 8,
    }),
  });

  const result = await orchestrator.solve(request);
  assert(result.verification?.confidence === 'high', 'alternate-provider verification pass should surface high confidence');
  assert(result.verification?.verifierProvider === 'openrouter', 'verifier provider should be alternate provider when available');
};

export const runQualityVerifierTests = async (): Promise<void> => {
  await runConfidenceMappingUnit();
  await runAlternateProviderIntegration();
};
