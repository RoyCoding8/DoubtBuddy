import { AppSettingsV2, ProviderId } from '../../types/settings';
import { getProviderApiKey } from '../../services/apiKeyStorage';
import { ProviderAdapter } from '../contracts/aiContracts';
import { GeminiAdapter } from './geminiAdapter';
import { HuggingFaceAdapter } from './huggingFaceAdapter';
import { LocalTemplateAdapter } from './localTemplateAdapter';
import { OpenRouterAdapter } from './openRouterAdapter';

const isNonEmpty = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const shouldEnableOpenRouter = (settings: AppSettingsV2, key: string | null): boolean =>
  settings.featureFlags.openRouterEnabled && isNonEmpty(key);

const shouldEnableHuggingFace = (settings: AppSettingsV2, key: string | null): boolean =>
  settings.featureFlags.huggingFaceEnabled && isNonEmpty(key);

export const createProviderAdapters = async (settings: AppSettingsV2): Promise<ProviderAdapter[]> => {
  const [geminiKey, openRouterKey, huggingFaceKey] = await Promise.all([
    getProviderApiKey('gemini'),
    getProviderApiKey('openrouter'),
    getProviderApiKey('huggingface'),
  ]);

  const adapters: ProviderAdapter[] = [
    new GeminiAdapter({
      model: settings.providerModels.gemini,
      apiKeyResolver: async () => geminiKey,
    }),
  ];

  if (shouldEnableOpenRouter(settings, openRouterKey)) {
    adapters.push(
      new OpenRouterAdapter({
        model: settings.providerModels.openrouter,
        apiKeyResolver: async () => openRouterKey,
      }),
    );
  }

  if (shouldEnableHuggingFace(settings, huggingFaceKey)) {
    adapters.push(
      new HuggingFaceAdapter({
        model: settings.providerModels.huggingface,
        apiKeyResolver: async () => huggingFaceKey,
      }),
    );
  }

  adapters.push(new LocalTemplateAdapter());

  return adapters;
};

export const getRegisteredProviderIds = (adapters: ProviderAdapter[]): ProviderId[] => adapters.map((adapter) => adapter.id);
