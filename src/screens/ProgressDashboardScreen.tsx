import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing, typography } from '../constants/theme';
import { createProgressService } from '../domains/progress/progressService';
import {
  logTask17DashboardMetricsSnapshot,
  logTask17DrilldownSnapshot,
  logTask17SeedLoaded,
  logTask17WeakTopicsSnapshot,
} from '../domains/progress/task17EvidenceLogger';
import { isTask17SeedEnabled, seedTask17ManualDataset } from '../domains/progress/task17ManualSeed';
import {
  ProgressDashboardMetrics,
  ProgressWeakTopicDrilldown,
  WeakTopic,
} from '../domains/progress/types';
import { RootTabParamList } from '../navigation/types';
import { getSubjectLabel } from '../utils/formatters';

type Props = BottomTabScreenProps<RootTabParamList, 'Progress'>;

const progressService = createProgressService();

const toPercent = (value: number): string => `${Math.round(value * 100)}%`;
const toSeconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)}s`;

const weakTopicLabel = (entry: WeakTopic): string =>
  `${getSubjectLabel(entry.subjectId)} • ${entry.chapterId}${entry.topic ? ` • ${entry.topic}` : ''}`;

export const ProgressDashboardScreen = (_props: Props) => {
  const hasAppliedTask17SeedRef = useRef(false);
  const [metrics, setMetrics] = useState<ProgressDashboardMetrics | null>(null);
  const [selectedWeakTopic, setSelectedWeakTopic] = useState<WeakTopic | null>(null);
  const [drilldown, setDrilldown] = useState<ProgressWeakTopicDrilldown | null>(null);
  const [loading, setLoading] = useState(true);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [status, setStatus] = useState('Loading progress metrics...');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      if (isTask17SeedEnabled() && !hasAppliedTask17SeedRef.current) {
        const counts = await seedTask17ManualDataset();
        hasAppliedTask17SeedRef.current = true;
        logTask17SeedLoaded(counts);
      }

      await progressService.computeAndStoreDailySnapshot();
      const nextMetrics = await progressService.getDashboardMetrics();
      setMetrics(nextMetrics);
      logTask17DashboardMetricsSnapshot(nextMetrics.summary);
      logTask17WeakTopicsSnapshot(nextMetrics.weakTopics);
      setStatus('Progress metrics refreshed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to load progress metrics: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const onSelectWeakTopic = useCallback(async (entry: WeakTopic) => {
    setSelectedWeakTopic(entry);
    setDrilldownLoading(true);
    try {
      const details = await progressService.getWeakTopicDrilldown({
        subjectId: entry.subjectId,
        chapterId: entry.chapterId,
        topic: entry.topic,
      });
      setDrilldown(details);
      logTask17DrilldownSnapshot(details);
    } catch {
      setDrilldown(null);
    } finally {
      setDrilldownLoading(false);
    }
  }, []);

  const summary = metrics?.summary;

  const latestSnapshotLabel = useMemo(() => {
    if (!metrics?.latestSnapshot) {
      return 'No saved daily snapshot yet.';
    }

    return `Latest daily snapshot: ${metrics.latestSnapshot.date} (${metrics.latestSnapshot.attempts} attempts)`;
  }, [metrics]);

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Progress Dashboard</Text>
      <Text style={styles.subheading}>Track accuracy, speed, streaks, and weak topics.</Text>

      <Pressable style={styles.refreshButton} onPress={loadDashboard} disabled={loading}>
        <Text style={styles.refreshText}>{loading ? 'Refreshing...' : 'Refresh Metrics'}</Text>
      </Pressable>

      {summary ? (
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Performance Summary</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{summary.attempts}</Text>
              <Text style={styles.kpiLabel}>Attempts</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{toPercent(summary.accuracyRate)}</Text>
              <Text style={styles.kpiLabel}>Accuracy</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{toSeconds(summary.avgSolveTimeMs)}</Text>
              <Text style={styles.kpiLabel}>Avg Solve Time</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{summary.streakDays}</Text>
              <Text style={styles.kpiLabel}>Streak Days</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{summary.correctCount}</Text>
              <Text style={styles.kpiLabel}>Correct</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{summary.incorrectCount}</Text>
              <Text style={styles.kpiLabel}>Incorrect</Text>
            </View>
          </View>
          <Text style={styles.metaText}>{latestSnapshotLabel}</Text>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Weak Topics</Text>
        {metrics?.weakTopics.length ? (
          metrics.weakTopics.map((entry, index) => {
            const selected =
              selectedWeakTopic?.subjectId === entry.subjectId &&
              selectedWeakTopic.chapterId === entry.chapterId &&
              (selectedWeakTopic.topic ?? '') === (entry.topic ?? '');

            return (
              <Pressable
                key={`${entry.subjectId}:${entry.chapterId}:${entry.topic ?? 'general'}:${index}`}
                style={[styles.weakTopicButton, selected && styles.weakTopicButtonActive]}
                onPress={() => onSelectWeakTopic(entry)}
                disabled={drilldownLoading}
              >
                <Text style={styles.weakTopicText}>{weakTopicLabel(entry)}</Text>
                <Text style={styles.weakTopicMeta}>Error rate: {toPercent(entry.errorRate)}</Text>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.metaText}>No weak topics detected yet. Complete more practice attempts to unlock this view.</Text>
        )}
      </View>

      {selectedWeakTopic ? (
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Drill-down: {weakTopicLabel(selectedWeakTopic)}</Text>
          {drilldownLoading ? (
            <Text style={styles.metaText}>Loading drill-down metrics...</Text>
          ) : drilldown ? (
            <>
              <Text style={styles.metaText}>
                Attempts: {drilldown.attempts} • Accuracy: {toPercent(drilldown.accuracyRate)} • Avg Solve Time:{' '}
                {toSeconds(drilldown.avgSolveTimeMs)}
              </Text>
              {drilldown.trend.length ? (
                drilldown.trend.map((point) => (
                  <View key={point.date} style={styles.trendRow}>
                    <Text style={styles.trendDate}>{point.date}</Text>
                    <Text style={styles.trendMeta}>
                      {point.attempts} attempts • {toPercent(point.accuracyRate)} accuracy • {toSeconds(point.avgSolveTimeMs)} avg
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.metaText}>No historical trend points available yet for this topic.</Text>
              )}
            </>
          ) : (
            <Text style={styles.metaText}>Unable to load drill-down data.</Text>
          )}
        </View>
      ) : null}

      <Text style={styles.statusText}>{status}</Text>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heading: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: '800',
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  refreshButton: {
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: '#123049',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshText: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: '800',
  },
  summaryCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kpiBox: {
    flex: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0f2232',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  kpiValue: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  weakTopicButton: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#102033',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  weakTopicButtonActive: {
    borderColor: colors.accent,
    backgroundColor: '#123049',
  },
  weakTopicText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  weakTopicMeta: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  trendRow: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0f2232',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  trendDate: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  trendMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
