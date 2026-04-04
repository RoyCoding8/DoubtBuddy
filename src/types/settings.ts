export type ProviderId = 'gemini' | 'openrouter' | 'huggingface' | 'local_template';
export type AiProviderId = ProviderId;
export type ProviderKeyProviderId = Exclude<ProviderId, 'local_template'>;

export type QualityMode = 'fast' | 'balanced' | 'high_accuracy';

export type GeminiModelId = 'gemini-2.5-flash' | 'gemini-2.5-pro';

/**
 * v2 provider model map. `local_template` is intentionally excluded.
 */
export type ProviderModelMap = Record<Exclude<ProviderId, 'local_template'>, string>;

export interface AppFeatureFlags {
  openRouterEnabled: boolean;
  huggingFaceEnabled: boolean;
  diagnosticsEnabled: boolean;
}

/**
 * Runtime key-presence state used by settings/domain services.
 * This is intentionally not persisted inside AppSettings.
 */
export type ProviderKeyStatus = Record<ProviderKeyProviderId, boolean>;

export const defaultProviderKeyStatus: ProviderKeyStatus = {
  gemini: false,
  openrouter: false,
  huggingface: false,
};

/**
 * Compatibility fields retained during v1 -> v2 migration rollout.
 * They let existing screens/services compile and run without behavior changes
 * while new architecture contracts adopt v2 fields.
 */
export interface LegacySettingsCompat {
  provider: Exclude<ProviderId, 'local_template'>;
  geminiModel: GeminiModelId;
}

export interface AppSettingsV2 {
  providerPriority: ProviderId[];
  providerModels: ProviderModelMap;
  qualityMode: QualityMode;
  enableAppLock: boolean;
  enableSerpEnrichment: boolean;
  featureFlags: AppFeatureFlags;
  sessionTurnLimit: number;
}

export type AppSettings = AppSettingsV2 & LegacySettingsCompat;

export const defaultProviderPriority: ProviderId[] = [
  'gemini',
  'openrouter',
  'huggingface',
  'local_template',
];

export const defaultProviderModels: ProviderModelMap = {
  gemini: 'gemini-2.5-flash',
  openrouter: 'openai/gpt-4o-mini',
  huggingface: 'mistralai/Mistral-7B-Instruct-v0.3',
};

export const defaultAppSettings: AppSettings = {
  // v2 shape
  providerPriority: [...defaultProviderPriority],
  providerModels: { ...defaultProviderModels },
  qualityMode: 'balanced',
  enableAppLock: false,
  enableSerpEnrichment: false,
  featureFlags: {
    openRouterEnabled: false,
    huggingFaceEnabled: false,
    diagnosticsEnabled: false,
  },
  sessionTurnLimit: 8,

  // legacy compatibility shape
  provider: 'gemini',
  geminiModel: 'gemini-2.5-flash',
};
