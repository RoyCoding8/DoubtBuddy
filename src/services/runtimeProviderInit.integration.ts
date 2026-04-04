import { __setApiKeyStorageTestAdapters } from './apiKeyStorage';
import { initializeSolveRuntime } from './aiClient';
import { defaultAppSettings } from '../types/settings';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const createSettings = (flags: { openRouterEnabled: boolean; huggingFaceEnabled: boolean }) => ({
  ...defaultAppSettings,
  featureFlags: {
    ...defaultAppSettings.featureFlags,
    ...flags,
  },
});

const withRuntimeKeyStubs = async (run: () => Promise<void>): Promise<void> => {
  __setApiKeyStorageTestAdapters({
    keyValueStorage: {
      async setItem() {
        return;
      },
      async getItem() {
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
    await run();
  } finally {
    __setApiKeyStorageTestAdapters({});
  }
};

export const runRuntimeProviderInitIntegration = async (): Promise<void> => {
  await withRuntimeKeyStubs(async () => {
    const geminiOnly = await initializeSolveRuntime(
      createSettings({
        openRouterEnabled: false,
        huggingFaceEnabled: false,
      }),
    );

    assert(geminiOnly.providerIds.length === 1, 'Flags off should register Gemini only in runtime init path');
    assert(geminiOnly.providerIds[0] === 'gemini', 'Gemini must remain first baseline provider');

    const geminiOpenRouter = await initializeSolveRuntime(
      createSettings({
        openRouterEnabled: true,
        huggingFaceEnabled: false,
      }),
    );

    assert(
      geminiOpenRouter.providerIds.join(',') === 'gemini,openrouter',
      'OpenRouter should be registered in runtime init when flag+key are present',
    );

    const fullTier = await initializeSolveRuntime(
      createSettings({
        openRouterEnabled: true,
        huggingFaceEnabled: true,
      }),
    );

    assert(
      fullTier.providerIds.join(',') === 'gemini,openrouter,huggingface',
      'Both providers should register in runtime init when flags+keys are present',
    );

    console.log('[TASK8_RUNTIME] flags_off:', geminiOnly.providerIds.join(','));
    console.log('[TASK8_RUNTIME] openrouter_on:', geminiOpenRouter.providerIds.join(','));
    console.log('[TASK8_RUNTIME] full_tier:', fullTier.providerIds.join(','));
  });
};
