import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getProviderKeyStatus } from '../domains/settings/providerKeyService';
import { loadSettings, saveSettings } from '../services/settingsStorage';
import { AppSettings, ProviderKeyStatus, defaultAppSettings, defaultProviderKeyStatus } from '../types/settings';

interface SettingsContextValue {
  loading: boolean;
  settings: AppSettings;
  hasApiKey: boolean;
  hasAnyEnabledProviderKey: boolean;
  providerKeyStatus: ProviderKeyStatus;
  appLocked: boolean;
  refresh: () => Promise<void>;
  updateSettings: (next: AppSettings) => Promise<void>;
  updateFeatureFlags: (next: Partial<AppSettings['featureFlags']>) => Promise<void>;
  setHasApiKey: (value: boolean) => void;
  setProviderKeyStatus: (next: ProviderKeyStatus) => void;
  setAppLocked: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const hasAnyEnabledProviderKeyForSolve = (settings: AppSettings, keyStatus: ProviderKeyStatus): boolean => {
  if (keyStatus.gemini) {
    return true;
  }

  if (settings.featureFlags.openRouterEnabled && keyStatus.openrouter) {
    return true;
  }

  if (settings.featureFlags.huggingFaceEnabled && keyStatus.huggingface) {
    return true;
  }

  return false;
};

export const SettingsProvider = ({ children }: PropsWithChildren) => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [providerKeyStatus, setProviderKeyStatus] = useState<ProviderKeyStatus>(defaultProviderKeyStatus);
  const [appLocked, setAppLocked] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const nextSettings = await loadSettings();
    setSettings(nextSettings);

    const keyStatus = await getProviderKeyStatus();
    setProviderKeyStatus(keyStatus);
    setHasApiKey(keyStatus.gemini);
    setAppLocked(nextSettings.enableAppLock);

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateSettings = useCallback(async (next: AppSettings) => {
    const saved = await saveSettings(next);
    setSettings(saved);
  }, []);

  const updateFeatureFlags = useCallback(
    async (next: Partial<AppSettings['featureFlags']>) => {
      const saved = await saveSettings({
        ...settings,
        featureFlags: {
          ...settings.featureFlags,
          ...next,
        },
      });
      setSettings(saved);
    },
    [settings],
  );

  const value = useMemo(
    () => ({
      loading,
      settings,
      hasApiKey,
      hasAnyEnabledProviderKey: hasAnyEnabledProviderKeyForSolve(settings, providerKeyStatus),
      providerKeyStatus,
      appLocked,
      refresh,
      updateSettings,
      updateFeatureFlags,
      setHasApiKey,
      setProviderKeyStatus,
      setAppLocked,
    }),
    [appLocked, hasApiKey, loading, providerKeyStatus, refresh, settings, updateFeatureFlags, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useAppSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within SettingsProvider');
  }

  return context;
};
