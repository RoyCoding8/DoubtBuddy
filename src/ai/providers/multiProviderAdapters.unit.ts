import { SolveRequest, SolveResponse } from '../contracts/aiContracts';
import { NormalizedErrorCode } from '../contracts/aiErrors';
import { InferenceOrchestrator } from '../orchestrator/inferenceOrchestrator';
import { OpenRouterAdapter } from './openRouterAdapter';
import { HuggingFaceAdapter } from './huggingFaceAdapter';
import { ProviderAdapter } from './providerAdapter';
import { createProviderAdapters } from './index';
import { __setApiKeyStorageTestAdapters } from '../../services/apiKeyStorage';
import { defaultAppSettings } from '../../types/settings';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const createRequest = (): SolveRequest => ({
  requestId: 'task-8-test',
  prompt: {
    system: 'You are a concise tutor.',
    user: 'What is Ohm law?',
  },
  mode: 'quick_answer',
  qualityMode: 'balanced',
});

const createJsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
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
    yield 'unused';
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

const runAdapterContractChecks = async (): Promise<void> => {
  const request = createRequest();
  const signal = new AbortController().signal;

  const openrouter = new OpenRouterAdapter({
    apiKeyResolver: async () => 'or-key',
    fetchImpl: async () =>
      createJsonResponse({
        choices: [{ message: { content: 'openrouter-contract-ok' } }],
        usage: { total_tokens: 12 },
      }),
  });

  const huggingface = new HuggingFaceAdapter({
    apiKeyResolver: async () => 'hf-key',
    fetchImpl: async () =>
      createJsonResponse({
        choices: [{ message: { content: 'huggingface-contract-ok' } }],
        usage: { total_tokens: 17 },
      }),
  });

  const openrouterRes = await openrouter.generate(request, signal);
  assert(openrouterRes.provider === 'openrouter', 'OpenRouter adapter should return openrouter provider id');
  assert(openrouterRes.text === 'openrouter-contract-ok', 'OpenRouter adapter should parse response text');
  assert(openrouterRes.tokenEstimate === 12, 'OpenRouter adapter should pass token estimate when available');

  const huggingfaceRes = await huggingface.generate(request, signal);
  assert(huggingfaceRes.provider === 'huggingface', 'HF adapter should return huggingface provider id');
  assert(huggingfaceRes.text === 'huggingface-contract-ok', 'HF adapter should parse response text');
  assert(huggingfaceRes.tokenEstimate === 17, 'HF adapter should pass token estimate when available');

  const normalized = openrouter.normalizeError(new Error('API request failed with status 401'));
  assert(normalized.code === 'AUTH', 'OpenRouter adapter should normalize 401 to AUTH');
};

const runTieredFallbackIntegration = async (): Promise<void> => {
  const gemini = new FakeAdapter('gemini', async () => {
    throw new Error('gemini-failure');
  });

  const openrouter = new FakeAdapter('openrouter', async () => {
    throw new Error('openrouter-failure');
  });

  const huggingface = new FakeAdapter('huggingface', async () => ({
    text: 'tier-2-answer',
    provider: 'huggingface',
    model: 'hf-model',
    latencyMs: 6,
  }));

  const orchestrator = new InferenceOrchestrator([gemini, openrouter, huggingface], {
    getSettings: async () => ({
      ...defaultAppSettings,
      providerPriority: ['gemini', 'openrouter', 'huggingface', 'local_template'],
      featureFlags: {
        openRouterEnabled: true,
        huggingFaceEnabled: true,
        diagnosticsEnabled: false,
      },
    }),
  });

  const result = await orchestrator.solve(createRequest());
  assert(result.provider === 'huggingface', 'Should reach tier-2 provider when tier-0 and tier-1 fail');
  assert(result.orchestration?.fallbackLevel === 2, 'Fallback metadata should indicate two provider hops');
};

const runFeatureFlagGatingChecks = async (): Promise<void> => {
  __setApiKeyStorageTestAdapters({
    keyValueStorage: {
      async setItem() {
        return;
      },
      async getItem(key: string) {
        if (key.endsWith('gemini.key.present')) {
          return '1';
        }

        if (key.endsWith('openrouter.key.present')) {
          return '1';
        }

        if (key.endsWith('huggingface.key.present')) {
          return '1';
        }

        return null;
      },
      async removeItem() {
        return;
      },
    },
    secureStore: {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'secure',
      async setItemAsync() {
        return;
      },
      async getItemAsync(key: string) {
        if (key.includes('gemini')) {
          return 'gemini-key';
        }

        if (key.includes('openrouter')) {
          return 'openrouter-key';
        }

        if (key.includes('huggingface')) {
          return 'huggingface-key';
        }

        return null;
      },
      async deleteItemAsync() {
        return;
      },
    },
  });

  try {
    const geminiOnly = await createProviderAdapters({
      ...defaultAppSettings,
      featureFlags: {
        openRouterEnabled: false,
        huggingFaceEnabled: false,
        diagnosticsEnabled: false,
      },
    });

    assert(geminiOnly.length === 1, 'Gemini should remain default baseline when non-Gemini flags are disabled');
    assert(geminiOnly[0]?.id === 'gemini', 'Gemini should be first and only adapter with flags off');

    const allEnabled = await createProviderAdapters({
      ...defaultAppSettings,
      featureFlags: {
        openRouterEnabled: true,
        huggingFaceEnabled: true,
        diagnosticsEnabled: false,
      },
    });

    const ids = allEnabled.map((adapter) => adapter.id);
    assert(ids.includes('gemini'), 'Gemini adapter should always be registered baseline');
    assert(ids.includes('openrouter'), 'OpenRouter adapter should register when flag and key are present');
    assert(ids.includes('huggingface'), 'Hugging Face adapter should register when flag and key are present');
  } finally {
    __setApiKeyStorageTestAdapters({});
  }
};

export const runMultiProviderAdapterTests = async (): Promise<void> => {
  await runAdapterContractChecks();
  await runTieredFallbackIntegration();
  await runFeatureFlagGatingChecks();
};
