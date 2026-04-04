import { PropsWithChildren, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../constants/theme';
import { useAppSettings } from '../hooks/SettingsContext';
import { authenticateForAppLock, supportsBiometricLock } from '../services/apiKeyStorage';

export const AppLockGate = ({ children }: PropsWithChildren) => {
  const { settings, appLocked, setAppLocked } = useAppSettings();
  const [canUseLock, setCanUseLock] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const supported = await supportsBiometricLock();
      if (mounted) {
        setCanUseLock(supported);
      }
    };

    void check();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settings.enableAppLock) {
      setAppLocked(false);
    }
  }, [setAppLocked, settings.enableAppLock]);

  useEffect(() => {
    const onStateChange = (state: AppStateStatus) => {
      if (settings.enableAppLock && canUseLock && state !== 'active') {
        setAppLocked(true);
      }
    };

    const subscription = AppState.addEventListener('change', onStateChange);
    return () => subscription.remove();
  }, [canUseLock, setAppLocked, settings.enableAppLock]);

  const onUnlock = async () => {
    setChecking(true);
    const success = await authenticateForAppLock();
    if (success) {
      setAppLocked(false);
    }
    setChecking(false);
  };

  if (!settings.enableAppLock || !canUseLock || !appLocked) {
    return <>{children}</>;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.title}>DoubtBuddy Locked</Text>
        <Text style={styles.body}>Unlock with fingerprint, face, or device passcode.</Text>
        <Pressable style={styles.button} onPress={() => void onUnlock()}>
          <Text style={styles.buttonText}>{checking ? 'Checking...' : 'Unlock App'}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: '800',
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#032237',
    fontSize: typography.bodyLarge,
    fontWeight: '800',
  },
});
