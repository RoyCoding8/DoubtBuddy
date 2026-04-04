import { ProgressSummary, ProgressWeakTopicDrilldown, WeakTopic } from './types';

const readTask17EvidenceEnvFlag = (): string | undefined => {
  if (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_TASK17_EVIDENCE_LOGS) {
    return process.env.EXPO_PUBLIC_TASK17_EVIDENCE_LOGS;
  }

  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_TASK17_EVIDENCE_LOGS;
};

const isTask17EvidenceEnabled = (): boolean => readTask17EvidenceEnvFlag() === '1';

const emitTask17Marker = (marker: string, payload: Record<string, unknown>): void => {
  if (!isTask17EvidenceEnabled()) {
    return;
  }

  console.log(`[TASK17_MANUAL] ${marker} ${JSON.stringify(payload)}`);
};

export const logTask17SeedLoaded = (counts: {
  practiceSets: number;
  practiceAttempts: number;
  revisionCards: number;
  doubtHistory: number;
}): void => {
  emitTask17Marker('seed_loaded', counts);
};

export const logTask17DashboardMetricsSnapshot = (summary: ProgressSummary): void => {
  emitTask17Marker('dashboard_metrics_snapshot', {
    attempts: summary.attempts,
    correctness: {
      correctCount: summary.correctCount,
      incorrectCount: summary.incorrectCount,
      accuracyRate: summary.accuracyRate,
    },
    avgSolveMs: summary.avgSolveTimeMs,
    streak: summary.streakDays,
  });
};

export const logTask17WeakTopicsSnapshot = (weakTopics: WeakTopic[]): void => {
  emitTask17Marker('weak_topics_snapshot', {
    count: weakTopics.length,
    topics: weakTopics.map((entry) => ({
      subjectId: entry.subjectId,
      chapterId: entry.chapterId,
      topic: entry.topic,
      errorRate: entry.errorRate,
    })),
  });
};

export const logTask17DrilldownSnapshot = (drilldown: ProgressWeakTopicDrilldown): void => {
  emitTask17Marker('drilldown_snapshot', {
    subjectId: drilldown.subjectId,
    chapterId: drilldown.chapterId,
    topic: drilldown.topic,
    attempts: drilldown.attempts,
    correctCount: drilldown.correctCount,
    incorrectCount: drilldown.incorrectCount,
    accuracyRate: drilldown.accuracyRate,
    avgSolveMs: drilldown.avgSolveTimeMs,
  });
};
