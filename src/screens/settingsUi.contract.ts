import { AppFeatureFlags, ProviderKeyProviderId, ProviderModelMap, QualityMode } from '../types/settings';

export const SETTINGS_REORDER_TEST_ID_PREFIX = 'provider-reorder-';
export const SETTINGS_DIAGNOSTICS_CTA_TEST_ID = 'diagnostics-nav-cta';

export const providerKeyOptions: { id: ProviderKeyProviderId; label: string }[] = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'huggingface', label: 'Hugging Face' },
];

export const qualityModeOptions: { id: QualityMode; label: string; description: string }[] = [
  {
    id: 'fast',
    label: 'Fast',
    description: 'Prefer lower latency and quicker completions.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Balance quality and speed for day-to-day study.',
  },
  {
    id: 'high_accuracy',
    label: 'High Accuracy',
    description: 'Favor stronger verification and answer quality.',
  },
];

export const providerModelOptions: { [K in keyof ProviderModelMap]: Array<{ id: string; label: string }> } = {
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
  openrouter: [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
  ],
  huggingface: [
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B Instruct v0.3' },
    { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B Instruct' },
  ],
};

export const getEnabledModelProviders = (flags: AppFeatureFlags): Array<keyof ProviderModelMap> => {
  const enabled: Array<keyof ProviderModelMap> = ['gemini'];

  if (flags.openRouterEnabled) {
    enabled.push('openrouter');
  }

  if (flags.huggingFaceEnabled) {
    enabled.push('huggingface');
  }

  return enabled;
};

export const buildSettingsUiSnapshot = (args: {
  flags: AppFeatureFlags;
  providerModels: ProviderModelMap;
}): {
  reorderControlPrefix: string;
  qualityModes: QualityMode[];
  diagnosticsCtaId: string;
  modelControlIds: string[];
} => {
  const enabledProviders = getEnabledModelProviders(args.flags);

  return {
    reorderControlPrefix: SETTINGS_REORDER_TEST_ID_PREFIX,
    qualityModes: qualityModeOptions.map((mode) => mode.id),
    diagnosticsCtaId: SETTINGS_DIAGNOSTICS_CTA_TEST_ID,
    modelControlIds: enabledProviders.map((providerId) => `model-option-${providerId}-${args.providerModels[providerId]}`),
  };
};
