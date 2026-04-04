import { ProviderKeyProviderId, ProviderKeyStatus, defaultProviderKeyStatus } from '../types/settings';

declare const require: (moduleName: string) => unknown;

type KeyValueStorage = {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
};

type SecureStoreLike = {
  setItemAsync: (key: string, value: string, options?: Record<string, unknown>) => Promise<void>;
  getItemAsync: (key: string, options?: Record<string, unknown>) => Promise<string | null>;
  deleteItemAsync: (key: string, options?: Record<string, unknown>) => Promise<void>;
  WHEN_UNLOCKED_THIS_DEVICE_ONLY?: string;
};

type LocalAuthenticationLike = {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  authenticateAsync: (options: {
    promptMessage: string;
    promptDescription: string;
    cancelLabel: string;
    fallbackLabel: string;
    disableDeviceFallback: boolean;
    biometricsSecurityLevel: 'weak' | 'strong';
  }) => Promise<{ success: boolean }>;
};

let testAdapters: {
  secureStore?: SecureStoreLike;
  keyValueStorage?: KeyValueStorage;
  localAuthentication?: LocalAuthenticationLike;
} = {};

const getSecureStore = (): SecureStoreLike => {
  if (testAdapters.secureStore) {
    return testAdapters.secureStore;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const runtimeModule = require('expo-secure-store') as SecureStoreLike;
  return runtimeModule;
};

const getKeyValueStorage = (): KeyValueStorage => {
  if (testAdapters.keyValueStorage) {
    return testAdapters.keyValueStorage;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const runtimeModule = require('@react-native-async-storage/async-storage') as { default: KeyValueStorage };
  return runtimeModule.default;
};

const getLocalAuthentication = (): LocalAuthenticationLike => {
  if (testAdapters.localAuthentication) {
    return testAdapters.localAuthentication;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const runtimeModule = require('expo-local-authentication') as LocalAuthenticationLike;
  return runtimeModule;
};

export const __setApiKeyStorageTestAdapters = (adapters: {
  secureStore?: SecureStoreLike;
  keyValueStorage?: KeyValueStorage;
  localAuthentication?: LocalAuthenticationLike;
}): void => {
  testAdapters = { ...adapters };
};

const providerKeyMetadata: Record<ProviderKeyProviderId, { secureKey: string; hintKey: string }> = {
  gemini: {
    secureKey: 'doubtbuddy.gemini.key',
    hintKey: 'doubtbuddy.gemini.key.present',
  },
  openrouter: {
    secureKey: 'doubtbuddy.openrouter.key',
    hintKey: 'doubtbuddy.openrouter.key.present',
  },
  huggingface: {
    secureKey: 'doubtbuddy.huggingface.key',
    hintKey: 'doubtbuddy.huggingface.key.present',
  },
};

const getStoreOptions = (provider: ProviderKeyProviderId): Record<string, unknown> => ({
  keychainService: providerKeyMetadata[provider].secureKey,
  keychainAccessible: getSecureStore().WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

export const supportsBiometricLock = async (): Promise<boolean> => {
  const auth = getLocalAuthentication();
  const hasHardware = await auth.hasHardwareAsync();
  const isEnrolled = await auth.isEnrolledAsync();
  return hasHardware && isEnrolled;
};

export const saveProviderApiKey = async (provider: ProviderKeyProviderId, key: string): Promise<void> => {
  const normalizedKey = key.trim();
  await getSecureStore().setItemAsync(providerKeyMetadata[provider].secureKey, normalizedKey, getStoreOptions(provider));
  await getKeyValueStorage().setItem(providerKeyMetadata[provider].hintKey, normalizedKey.length > 0 ? '1' : '0');
};

export const getProviderApiKey = async (provider: ProviderKeyProviderId): Promise<string | null> =>
  getSecureStore().getItemAsync(providerKeyMetadata[provider].secureKey, getStoreOptions(provider));

export const getProviderApiKeyHint = async (provider: ProviderKeyProviderId): Promise<boolean> => {
  const value = await getKeyValueStorage().getItem(providerKeyMetadata[provider].hintKey);
  return value === '1';
};

export const getProviderApiKeyHints = async (): Promise<ProviderKeyStatus> => {
  const entries = await Promise.all(
    (Object.keys(providerKeyMetadata) as ProviderKeyProviderId[]).map(async (provider) => {
      const hasKey = await getProviderApiKeyHint(provider);
      return [provider, hasKey] as const;
    }),
  );

  return entries.reduce<ProviderKeyStatus>(
    (acc, [provider, hasKey]) => {
      acc[provider] = hasKey;
      return acc;
    },
    { ...defaultProviderKeyStatus },
  );
};

export const deleteProviderApiKey = async (provider: ProviderKeyProviderId): Promise<void> => {
  try {
    await getSecureStore().deleteItemAsync(providerKeyMetadata[provider].secureKey, getStoreOptions(provider));
  } catch {
    // Ignore delete errors if key was already removed.
  }
  await getKeyValueStorage().removeItem(providerKeyMetadata[provider].hintKey);
};

export const saveGeminiApiKey = async (key: string): Promise<void> => {
  await saveProviderApiKey('gemini', key);
};

export const getGeminiApiKey = async (): Promise<string | null> => getProviderApiKey('gemini');

export const getGeminiApiKeyHint = async (): Promise<boolean> => getProviderApiKeyHint('gemini');

export const deleteGeminiApiKey = async (): Promise<void> => {
  await deleteProviderApiKey('gemini');
};

export const authenticateForAppLock = async (): Promise<boolean> => {
  const supported = await supportsBiometricLock();
  if (!supported) {
    return false;
  }

  const result = await getLocalAuthentication().authenticateAsync({
    promptMessage: 'Unlock DoubtBuddy',
    promptDescription: 'Use fingerprint/face or device lock to continue',
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use device passcode',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'weak',
  });

  return result.success;
};
