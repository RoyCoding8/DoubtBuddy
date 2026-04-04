import { deleteProviderApiKey, getProviderApiKey, getProviderApiKeyHints, saveProviderApiKey } from '../../services/apiKeyStorage';
import { ProviderKeyProviderId, ProviderKeyStatus } from '../../types/settings';

export const saveProviderKey = async (provider: ProviderKeyProviderId, key: string): Promise<void> => {
  await saveProviderApiKey(provider, key);
};

export const getProviderKey = async (provider: ProviderKeyProviderId): Promise<string | null> => getProviderApiKey(provider);

export const deleteProviderKey = async (provider: ProviderKeyProviderId): Promise<void> => {
  await deleteProviderApiKey(provider);
};

export const getProviderKeyStatus = async (): Promise<ProviderKeyStatus> => getProviderApiKeyHints();
