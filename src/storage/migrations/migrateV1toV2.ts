import { AppSettings, defaultAppSettings } from '../../types/settings';
import { sanitizeLegacySettingsV1, sanitizeAppSettingsV2 } from '../schema/settingsSchema';

const hasV2Shape = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return (
    'providerPriority' in value ||
    'providerModels' in value ||
    'qualityMode' in value ||
    'enableSerpEnrichment' in value ||
    'featureFlags' in value ||
    'sessionTurnLimit' in value
  );
};

export const migrateSettingsV1toV2 = (value: unknown): AppSettings => {
  const sanitizedV1 = sanitizeLegacySettingsV1(value);

  if (sanitizedV1 && !hasV2Shape(value)) {
    const next = {
      ...defaultAppSettings,
    };

    if (sanitizedV1.provider) {
      next.provider = sanitizedV1.provider;
      next.providerPriority = [
        sanitizedV1.provider,
        ...defaultAppSettings.providerPriority.filter((provider) => provider !== sanitizedV1.provider),
      ];
    }

    if (sanitizedV1.geminiModel) {
      next.geminiModel = sanitizedV1.geminiModel;
      next.providerModels = {
        ...next.providerModels,
        gemini: sanitizedV1.geminiModel,
      };
    }

    if (typeof sanitizedV1.enableAppLock === 'boolean') {
      next.enableAppLock = sanitizedV1.enableAppLock;
    }

    return next;
  }

  const sanitizedV2 = sanitizeAppSettingsV2(value);
  if (sanitizedV2) {
    return sanitizedV2;
  }

  return { ...defaultAppSettings };
};
