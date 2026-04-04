import { defaultProviderKeyStatus, ProviderKeyProviderId } from '../../types/settings';
import { __setApiKeyStorageTestAdapters } from '../../services/apiKeyStorage';
import { deleteProviderKey, getProviderKey, getProviderKeyStatus, saveProviderKey } from './providerKeyService';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const providers: ProviderKeyProviderId[] = ['gemini', 'openrouter', 'huggingface'];

const installInMemoryStorageStubs = (): void => {
  const secureStoreMemory = new Map<string, string>();
  const hintMemory = new Map<string, string>();

  __setApiKeyStorageTestAdapters({
    secureStore: {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when_unlocked_this_device_only',
      setItemAsync: async (key: string, value: string): Promise<void> => {
        secureStoreMemory.set(key, value);
      },
      getItemAsync: async (key: string): Promise<string | null> => secureStoreMemory.get(key) ?? null,
      deleteItemAsync: async (key: string): Promise<void> => {
        secureStoreMemory.delete(key);
      },
    },
    keyValueStorage: {
      setItem: async (key: string, value: string): Promise<void> => {
        hintMemory.set(key, value);
      },
      getItem: async (key: string): Promise<string | null> => hintMemory.get(key) ?? null,
      removeItem: async (key: string): Promise<void> => {
        hintMemory.delete(key);
      },
    },
  });
};

const runProviderRoundTrip = async (provider: ProviderKeyProviderId): Promise<void> => {
  const apiKey = `  ${provider}-key-value  `;

  await saveProviderKey(provider, apiKey);
  const saved = await getProviderKey(provider);
  assert(saved === `${provider}-key-value`, `${provider}: key should be trimmed and retrievable`);

  const statusAfterSave = await getProviderKeyStatus();
  assert(statusAfterSave[provider] === true, `${provider}: hint should be true after save`);

  await deleteProviderKey(provider);
  const deleted = await getProviderKey(provider);
  assert(deleted === null, `${provider}: key should be null after delete`);

  const statusAfterDelete = await getProviderKeyStatus();
  assert(statusAfterDelete[provider] === false, `${provider}: hint should be false after delete`);
};

const runDefaultStatusShape = async (): Promise<void> => {
  const status = await getProviderKeyStatus();
  assert(status.gemini === defaultProviderKeyStatus.gemini, 'default status should include gemini key');
  assert(status.openrouter === defaultProviderKeyStatus.openrouter, 'default status should include openrouter key');
  assert(status.huggingface === defaultProviderKeyStatus.huggingface, 'default status should include huggingface key');
};

export const runProviderKeyServiceUnitTests = async (): Promise<void> => {
  installInMemoryStorageStubs();
  await runDefaultStatusShape();

  for (const provider of providers) {
    await runProviderRoundTrip(provider);
  }
};
