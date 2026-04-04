import {
  AppFeatureFlags,
  AppSettings,
  GeminiModelId,
  ProviderId,
  ProviderModelMap,
  QualityMode,
  defaultAppSettings,
  defaultProviderModels,
  defaultProviderPriority,
} from '../../types/settings';

type UnknownRecord = Record<string, unknown>;

export interface LegacySettingsV1 {
  provider?: Exclude<ProviderId, 'local_template'>;
  geminiModel?: GeminiModelId;
  enableAppLock?: boolean;
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isProviderId = (value: unknown): value is ProviderId =>
  value === 'gemini' || value === 'openrouter' || value === 'huggingface' || value === 'local_template';

const isQualityMode = (value: unknown): value is QualityMode =>
  value === 'fast' || value === 'balanced' || value === 'high_accuracy';

const isGeminiModelId = (value: unknown): value is GeminiModelId =>
  value === 'gemini-2.5-flash' || value === 'gemini-2.5-pro';

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asPositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const integerValue = Math.trunc(value);
  return integerValue > 0 ? integerValue : fallback;
};

const normalizeProviderPriority = (value: unknown): ProviderId[] => {
  if (!Array.isArray(value)) {
    return [...defaultProviderPriority];
  }

  const uniqueValid = value.filter(isProviderId).filter((item, index, array) => array.indexOf(item) === index);
  if (uniqueValid.length === 0) {
    return [...defaultProviderPriority];
  }

  const missingDefaults = defaultProviderPriority.filter((provider) => !uniqueValid.includes(provider));
  return [...uniqueValid, ...missingDefaults];
};

const normalizeProviderModels = (value: unknown): ProviderModelMap => {
  if (!isRecord(value)) {
    return { ...defaultProviderModels };
  }

  return {
    gemini: typeof value.gemini === 'string' && value.gemini.trim() ? value.gemini : defaultProviderModels.gemini,
    openrouter:
      typeof value.openrouter === 'string' && value.openrouter.trim()
        ? value.openrouter
        : defaultProviderModels.openrouter,
    huggingface:
      typeof value.huggingface === 'string' && value.huggingface.trim()
        ? value.huggingface
        : defaultProviderModels.huggingface,
  };
};

const normalizeFeatureFlags = (value: unknown): AppFeatureFlags => {
  if (!isRecord(value)) {
    return { ...defaultAppSettings.featureFlags };
  }

  return {
    openRouterEnabled: asBoolean(value.openRouterEnabled, defaultAppSettings.featureFlags.openRouterEnabled),
    huggingFaceEnabled: asBoolean(value.huggingFaceEnabled, defaultAppSettings.featureFlags.huggingFaceEnabled),
    diagnosticsEnabled: asBoolean(value.diagnosticsEnabled, defaultAppSettings.featureFlags.diagnosticsEnabled),
  };
};

export const sanitizeLegacySettingsV1 = (value: unknown): LegacySettingsV1 | null => {
  if (!isRecord(value)) {
    return null;
  }

  const provider =
    isProviderId(value.provider) && value.provider !== 'local_template' ? value.provider : undefined;
  const geminiModel = isGeminiModelId(value.geminiModel) ? value.geminiModel : undefined;
  const enableAppLock = typeof value.enableAppLock === 'boolean' ? value.enableAppLock : undefined;

  return {
    provider,
    geminiModel,
    enableAppLock,
  };
};

export const sanitizeAppSettingsV2 = (value: unknown): AppSettings | null => {
  if (!isRecord(value)) {
    return null;
  }

  const providerPriority = normalizeProviderPriority(value.providerPriority);
  const providerModels = normalizeProviderModels(value.providerModels);
  const qualityMode = isQualityMode(value.qualityMode) ? value.qualityMode : defaultAppSettings.qualityMode;
  const enableAppLock = asBoolean(value.enableAppLock, defaultAppSettings.enableAppLock);
  const enableSerpEnrichment = asBoolean(value.enableSerpEnrichment, defaultAppSettings.enableSerpEnrichment);
  const featureFlags = normalizeFeatureFlags(value.featureFlags);
  const sessionTurnLimit = asPositiveInteger(value.sessionTurnLimit, defaultAppSettings.sessionTurnLimit);

  const provider =
    isProviderId(value.provider) && value.provider !== 'local_template'
      ? value.provider
      : providerPriority.find((candidate) => candidate !== 'local_template') ?? defaultAppSettings.provider;

  const geminiModel =
    isGeminiModelId(value.geminiModel) ? value.geminiModel : defaultAppSettings.geminiModel;

  return {
    providerPriority,
    providerModels,
    qualityMode,
    enableAppLock,
    enableSerpEnrichment,
    featureFlags,
    sessionTurnLimit,
    provider,
    geminiModel,
  };
};
