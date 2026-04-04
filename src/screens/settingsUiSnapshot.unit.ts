import { defaultProviderModels } from '../types/settings';
import {
  SETTINGS_DIAGNOSTICS_CTA_TEST_ID,
  SETTINGS_REORDER_TEST_ID_PREFIX,
  buildSettingsUiSnapshot,
} from './settingsUi.contract';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const runDefaultControlsSnapshot = (): void => {
  const snapshot = buildSettingsUiSnapshot({
    flags: {
      openRouterEnabled: false,
      huggingFaceEnabled: false,
      diagnosticsEnabled: false,
    },
    providerModels: { ...defaultProviderModels },
  });

  assert(snapshot.reorderControlPrefix === SETTINGS_REORDER_TEST_ID_PREFIX, 'reorder controls snapshot id prefix mismatch');
  assert(snapshot.diagnosticsCtaId === SETTINGS_DIAGNOSTICS_CTA_TEST_ID, 'diagnostics CTA test id mismatch');

  const expectedQualityModes = ['fast', 'balanced', 'high_accuracy'];
  assert(
    JSON.stringify(snapshot.qualityModes) === JSON.stringify(expectedQualityModes),
    'quality mode controls snapshot mismatch',
  );

  assert(snapshot.modelControlIds.length === 1, 'default model controls should include only gemini when flags are off');
  assert(
    snapshot.modelControlIds[0] === `model-option-gemini-${defaultProviderModels.gemini}`,
    'default gemini model control id mismatch',
  );
};

const runFeatureFlaggedModelControlsSnapshot = (): void => {
  const snapshot = buildSettingsUiSnapshot({
    flags: {
      openRouterEnabled: true,
      huggingFaceEnabled: true,
      diagnosticsEnabled: true,
    },
    providerModels: {
      gemini: 'gemini-2.5-pro',
      openrouter: 'anthropic/claude-3.5-haiku',
      huggingface: 'meta-llama/Llama-3.1-8B-Instruct',
    },
  });

  const expectedModelControls = [
    'model-option-gemini-gemini-2.5-pro',
    'model-option-openrouter-anthropic/claude-3.5-haiku',
    'model-option-huggingface-meta-llama/Llama-3.1-8B-Instruct',
  ];

  assert(
    JSON.stringify(snapshot.modelControlIds) === JSON.stringify(expectedModelControls),
    'model selection controls snapshot mismatch for enabled providers',
  );
};

export const runSettingsUiSnapshotUnitTests = (): void => {
  runDefaultControlsSnapshot();
  runFeatureFlaggedModelControlsSnapshot();
};
