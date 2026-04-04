import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppLockGate } from './src/components/AppLockGate';
import { DoubtHistoryProvider } from './src/hooks/DoubtHistoryContext';
import { StudySessionProvider } from './src/hooks/StudySessionContext';
import { SettingsProvider } from './src/hooks/SettingsContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { runGeminiDeviceStreamSmoke } from './src/ai/providers/geminiDeviceStreamSmoke';
import { installRuntimeLogRedactionGuard } from './src/services/logSecurityGuard';

const shouldRunTask4DeviceSmoke =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_TASK4_DEVICE_SMOKE === '1';

export default function App() {
  useEffect(() => {
    installRuntimeLogRedactionGuard();

    if (!shouldRunTask4DeviceSmoke) {
      return;
    }

    void runGeminiDeviceStreamSmoke().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[GEMINI_DEVICE_SMOKE] FAIL', message);
    });
  }, []);

  return (
    <SettingsProvider>
      <StudySessionProvider>
        <DoubtHistoryProvider>
          <AppLockGate>
            <RootNavigator />
            <StatusBar style="light" />
          </AppLockGate>
        </DoubtHistoryProvider>
      </StudySessionProvider>
    </SettingsProvider>
  );
}
