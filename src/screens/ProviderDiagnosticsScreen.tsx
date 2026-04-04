import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing, typography } from '../constants/theme';
import { createDefaultTelemetryService } from '../domains/observability/telemetryService';
import { selectProviderDiagnosticsSummary } from '../domains/observability/healthDashboardSelectors';
import { useAppSettings } from '../hooks/SettingsContext';
import { SettingsStackParamList } from '../navigation/types';
import { createProviderAdapters } from '../ai/providers';
import { ProviderId } from '../types/settings';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ProviderDiagnostics'>;

type HealthCheckResult = {
  ok: boolean;
  latencyMs: number;
  errorCode?: string;
};

const telemetryService = createDefaultTelemetryService();

const providers: ProviderId[] = ['gemini', 'openrouter', 'huggingface', 'local_template'];

const providerLabel: Record<ProviderId, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  huggingface: 'Hugging Face',
  local_template: 'Local Template',
};

const withHealthCheckTimeout = async (
  fn: (signal: AbortSignal) => Promise<{ ok: boolean; latencyMs: number; errorCode?: string }>,
): Promise<{ ok: boolean; latencyMs: number; errorCode?: string }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const startedAt = Date.now();

  try {
    return await fn(controller.signal);
  } catch {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      errorCode: 'TIMEOUT',
    };
  } finally {
    clearTimeout(timer);
  }
};

export const ProviderDiagnosticsScreen = (_props: Props) => {
  const { settings, providerKeyStatus } = useAppSettings();
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);
  const [runningHealthChecks, setRunningHealthChecks] = useState(false);
  const [telemetrySummaries, setTelemetrySummaries] = useState<
    Record<ProviderId, ReturnType<typeof selectProviderDiagnosticsSummary>>
  >({
    gemini: selectProviderDiagnosticsSummary([], 'gemini'),
    openrouter: selectProviderDiagnosticsSummary([], 'openrouter'),
    huggingface: selectProviderDiagnosticsSummary([], 'huggingface'),
    local_template: selectProviderDiagnosticsSummary([], 'local_template'),
  });
  const [healthResults, setHealthResults] = useState<Partial<Record<ProviderId, HealthCheckResult>>>({});
  const [healthContext, setHealthContext] = useState<string>('Run checks to verify currently configured providers.');

  const registeredProviderSet = useMemo(() => {
    const set = new Set<ProviderId>(['gemini', 'local_template']);
    if (settings.featureFlags.openRouterEnabled && providerKeyStatus.openrouter) {
      set.add('openrouter');
    }
    if (settings.featureFlags.huggingFaceEnabled && providerKeyStatus.huggingface) {
      set.add('huggingface');
    }
    return set;
  }, [providerKeyStatus.huggingface, providerKeyStatus.openrouter, settings.featureFlags.huggingFaceEnabled, settings.featureFlags.openRouterEnabled]);

  const loadTelemetry = useCallback(async () => {
    setLoadingTelemetry(true);
    try {
      const events = await telemetryService.getEvents();
      setTelemetrySummaries({
        gemini: selectProviderDiagnosticsSummary(events, 'gemini'),
        openrouter: selectProviderDiagnosticsSummary(events, 'openrouter'),
        huggingface: selectProviderDiagnosticsSummary(events, 'huggingface'),
        local_template: selectProviderDiagnosticsSummary(events, 'local_template'),
      });
    } finally {
      setLoadingTelemetry(false);
    }
  }, []);

  const runHealthChecks = useCallback(async () => {
    setRunningHealthChecks(true);
    setHealthContext('Running provider health checks...');

    try {
      const adapters = await createProviderAdapters(settings);
      const byId = adapters.reduce<Record<ProviderId, (typeof adapters)[number]>>((acc, adapter) => {
        acc[adapter.id] = adapter;
        return acc;
      }, {} as Record<ProviderId, (typeof adapters)[number]>);

      const next: Partial<Record<ProviderId, HealthCheckResult>> = {};

      for (const provider of providers) {
        const adapter = byId[provider];
        if (!adapter) {
          continue;
        }

        next[provider] = await withHealthCheckTimeout((signal) => adapter.healthCheck(signal));
      }

      setHealthResults(next);
      setHealthContext('Health checks completed for registered providers.');
    } catch {
      setHealthContext('Could not complete diagnostics. Check provider keys/flags and retry.');
    } finally {
      setRunningHealthChecks(false);
    }
  }, [settings]);

  useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry]);

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Provider Diagnostics</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Routing Context</Text>
        <Text style={styles.body}>Priority: {settings.providerPriority.join(' → ')}</Text>
        <Text style={styles.body}>Quality mode: {settings.qualityMode}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Checks</Text>
        <Text style={styles.body}>{healthContext}</Text>
        <Pressable
          style={[styles.primaryButton, runningHealthChecks && styles.buttonDisabled]}
          onPress={() => {
            void runHealthChecks();
          }}
          disabled={runningHealthChecks}
        >
          <Text style={styles.primaryText}>{runningHealthChecks ? 'Running...' : 'Run Health Checks'}</Text>
        </Pressable>

        {providers.map((provider) => {
          const result = healthResults[provider];
          const configured = registeredProviderSet.has(provider);

          return (
            <View key={provider} style={styles.card}>
              <Text style={styles.cardTitle}>{providerLabel[provider]}</Text>
              <Text style={styles.meta}>Configured: {configured ? 'Yes' : 'No'}</Text>
              {result ? (
                <>
                  <Text style={styles.meta}>Health: {result.ok ? 'OK' : 'Failed'}</Text>
                  <Text style={styles.meta}>Latency: {result.latencyMs}ms</Text>
                  {result.errorCode ? <Text style={styles.meta}>Error: {result.errorCode}</Text> : null}
                </>
              ) : (
                <Text style={styles.meta}>{configured ? 'No check run yet.' : 'Provider not active in current config.'}</Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Telemetry Summary</Text>
        <Pressable
          style={[styles.secondaryButton, loadingTelemetry && styles.buttonDisabled]}
          onPress={() => {
            void loadTelemetry();
          }}
          disabled={loadingTelemetry}
        >
          <Text style={styles.secondaryText}>{loadingTelemetry ? 'Refreshing...' : 'Refresh Summary'}</Text>
        </Pressable>

        {providers.map((provider) => {
          const summary = telemetrySummaries[provider];

          return (
            <View key={provider} style={styles.card}>
              <Text style={styles.cardTitle}>{providerLabel[provider]}</Text>
              <Text style={styles.meta}>Attempts: {summary.attempts}</Text>
              <Text style={styles.meta}>Success: {summary.successCount}</Text>
              <Text style={styles.meta}>Failed: {summary.failedCount}</Text>
              <Text style={styles.meta}>Error rate: {(summary.errorRate * 100).toFixed(1)}%</Text>
              <Text style={styles.meta}>p95 latency: {summary.p95LatencyMs}ms</Text>
            </View>
          );
        })}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heading: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: '800',
  },
  section: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    fontWeight: '700',
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    gap: 2,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#032237',
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
