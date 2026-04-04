import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppSettings, defaultAppSettings } from '../types/settings';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../storage/keys';
import { migrateSettingsV1toV2 } from '../storage/migrations/migrateV1toV2';

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const persistV2 = async (settings: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.settingsV2, JSON.stringify(settings));
};

export const loadSettings = async (): Promise<AppSettings> => {
  const v2Raw = await AsyncStorage.getItem(STORAGE_KEYS.settingsV2);
  if (v2Raw) {
    return migrateSettingsV1toV2(parseJson(v2Raw));
  }

  const v1Raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEYS.settingsV1);
  if (!v1Raw) {
    return { ...defaultAppSettings };
  }

  const migrated = migrateSettingsV1toV2(parseJson(v1Raw));
  await persistV2(migrated);
  return migrated;
};

export const saveSettings = async (next: AppSettings): Promise<AppSettings> => {
  const normalized = migrateSettingsV1toV2(next);
  await persistV2(normalized);
  return normalized;
};
