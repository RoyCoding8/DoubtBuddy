import AsyncStorage from '@react-native-async-storage/async-storage';

import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../keys';
import { loadSettings } from '../../services/settingsStorage';
import { defaultAppSettings } from '../../types/settings';
import { migrateSettingsV1toV2 } from './migrateV1toV2';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const runMigratesValidV1Object = (): void => {
  const migrated = migrateSettingsV1toV2({
    provider: 'huggingface',
    geminiModel: 'gemini-2.5-pro',
    enableAppLock: true,
  });

  assert(migrated.provider === 'huggingface', 'provider should migrate from v1');
  assert(migrated.providerPriority[0] === 'huggingface', 'provider priority should start with migrated provider');
  assert(migrated.providerModels.gemini === 'gemini-2.5-pro', 'gemini model should migrate from v1');
  assert(migrated.geminiModel === 'gemini-2.5-pro', 'compat geminiModel should stay in sync');
  assert(migrated.enableAppLock === true, 'enableAppLock should migrate from v1');
  assert(migrated.qualityMode === defaultAppSettings.qualityMode, 'v2-only fields should use defaults');
};

const runCorruptedFallbackToDefaults = (): void => {
  const migrated = migrateSettingsV1toV2('not-json-like-data');

  assert(migrated.provider === defaultAppSettings.provider, 'corrupted payload should fallback provider to defaults');
  assert(
    migrated.providerModels.gemini === defaultAppSettings.providerModels.gemini,
    'corrupted payload should fallback provider model to defaults',
  );
  assert(
    migrated.sessionTurnLimit === defaultAppSettings.sessionTurnLimit,
    'corrupted payload should fallback sessionTurnLimit to defaults',
  );
};

const runLoadSettingsMigratesLegacyPayload = async (): Promise<void> => {
  const memoryStore = new Map<string, string>();

  const storage = AsyncStorage as unknown as {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };

  storage.getItem = async (key: string): Promise<string | null> => memoryStore.get(key) ?? null;
  storage.setItem = async (key: string, value: string): Promise<void> => {
    memoryStore.set(key, value);
  };

  memoryStore.set(
    LEGACY_STORAGE_KEYS.settingsV1,
    JSON.stringify({
      provider: 'huggingface',
      geminiModel: 'gemini-2.5-pro',
      enableAppLock: true,
    }),
  );

  const loaded = await loadSettings();

  assert(loaded.providerPriority[0] === 'huggingface', 'loadSettings should migrate v1 provider to priority[0]');
  assert(loaded.providerModels.gemini === 'gemini-2.5-pro', 'loadSettings should migrate v1 gemini model mapping');

  const persistedV2Raw = memoryStore.get(STORAGE_KEYS.settingsV2);
  assert(typeof persistedV2Raw === 'string', 'loadSettings should persist migrated v2 settings');

  const persistedV2 = JSON.parse(persistedV2Raw as string) as typeof loaded;
  assert(persistedV2.providerPriority[0] === 'huggingface', 'persisted v2 should keep migrated provider priority');
  assert(
    persistedV2.providerModels.gemini === 'gemini-2.5-pro',
    'persisted v2 should keep migrated gemini model mapping',
  );
};

/**
 * Lightweight unit test runner for migration behavior.
 * It is intentionally framework-free to keep Task 2 self-contained.
 */
export const runSettingsMigrationUnitTests = async (): Promise<void> => {
  runMigratesValidV1Object();
  runCorruptedFallbackToDefaults();
  await runLoadSettingsMigratesLegacyPayload();
};
