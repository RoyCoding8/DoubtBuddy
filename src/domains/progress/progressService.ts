import { loadHistory } from '../../services/historyStorage';
import { SubjectId } from '../../types/syllabus';
import { createDefaultRevisionRepository, RevisionRepository } from '../revision/revisionRepository';
import { createDefaultPracticeRepository, PracticeRepository } from '../practice/practiceRepository';
import { PracticeAttempt, PracticeSet } from '../practice/types';
import {
  ProgressDashboardMetrics,
  ProgressSnapshot,
  ProgressWeakTopicDrilldown,
  ProgressWeakTopicDrilldownPoint,
  WeakTopic,
} from './types';
import { createDefaultProgressRepository, ProgressRepository } from './progressRepository';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEAK_TOPIC_MIN_ATTEMPTS = 3;
const DEFAULT_WEAK_TOPIC_LIMIT = 5;

type TopicKey = string;

interface TopicAggregate {
  subjectId: PracticeSet['subjectId'];
  chapterId: string;
  topic?: string;
  attempts: number;
  correctCount: number;
  totalSolveTimeMs: number;
}

const toDayKey = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
};

const nowDayKey = (): string => new Date().toISOString().slice(0, 10);

const topicKeyFor = (input: { subjectId: string; chapterId: string; topic?: string }): TopicKey =>
  `${input.subjectId}::${input.chapterId}::${(input.topic ?? '').trim().toLowerCase()}`;

const dayRangeInclusive = (startDay: string, endDay: string): string[] => {
  const start = new Date(`${startDay}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDay}T00:00:00.000Z`).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return [];
  }

  const output: string[] = [];
  for (let cursor = start; cursor <= end; cursor += DAY_MS) {
    output.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return output;
};

const calculateStreakDays = (
  activeAttemptDays: ReadonlySet<string>,
  today: string = nowDayKey(),
): number => {
  if (!activeAttemptDays.size) {
    return 0;
  }

  const todayTs = new Date(`${today}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(todayTs)) {
    return 0;
  }

  const hasToday = activeAttemptDays.has(today);
  const hasYesterday = activeAttemptDays.has(new Date(todayTs - DAY_MS).toISOString().slice(0, 10));

  if (!hasToday && !hasYesterday) {
    return 0;
  }

  let streak = 0;
  let cursor = hasToday ? todayTs : todayTs - DAY_MS;

  while (true) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    if (!activeAttemptDays.has(day)) {
      break;
    }
    streak += 1;
    cursor -= DAY_MS;
  }

  return streak;
};

const toAverage = (total: number, count: number): number => (count > 0 ? total / count : 0);

const addAttemptToAggregate = (aggregate: TopicAggregate, attempt: PracticeAttempt): void => {
  aggregate.attempts += 1;
  if (attempt.isCorrect) {
    aggregate.correctCount += 1;
  }
  aggregate.totalSolveTimeMs += Math.max(0, attempt.solveTimeMs || 0);
};

const toWeakTopic = (entry: TopicAggregate): WeakTopic => {
  const incorrectCount = entry.attempts - entry.correctCount;
  return {
    subjectId: entry.subjectId,
    chapterId: entry.chapterId,
    topic: entry.topic,
    errorRate: entry.attempts > 0 ? incorrectCount / entry.attempts : 0,
  };
};

const buildPracticeSetMap = (sets: PracticeSet[]): Map<string, PracticeSet> => new Map(sets.map((set) => [set.id, set]));

const buildQuestionTopicMap = (set: PracticeSet): Map<string, string | undefined> =>
  new Map(set.questions.map((question) => [question.id, question.topic ?? set.topic]));

const buildTopicAggregates = (attempts: PracticeAttempt[], setById: Map<string, PracticeSet>): Map<TopicKey, TopicAggregate> => {
  const aggregates = new Map<TopicKey, TopicAggregate>();

  const topicMapBySetId = new Map<string, Map<string, string | undefined>>();

  attempts.forEach((attempt) => {
    const set = setById.get(attempt.setId);
    if (!set) {
      return;
    }

    const topicByQuestionId =
      topicMapBySetId.get(set.id) ?? (() => {
        const built = buildQuestionTopicMap(set);
        topicMapBySetId.set(set.id, built);
        return built;
      })();

    const topic = topicByQuestionId.get(attempt.questionId) ?? set.topic;
    const key = topicKeyFor({ subjectId: set.subjectId, chapterId: set.chapterId, topic });

    const current =
      aggregates.get(key) ??
      ({
        subjectId: set.subjectId,
        chapterId: set.chapterId,
        topic,
        attempts: 0,
        correctCount: 0,
        totalSolveTimeMs: 0,
      } satisfies TopicAggregate);

    addAttemptToAggregate(current, attempt);
    aggregates.set(key, current);
  });

  return aggregates;
};

const selectWeakTopics = (aggregates: Map<TopicKey, TopicAggregate>, limit = DEFAULT_WEAK_TOPIC_LIMIT): WeakTopic[] => {
  return [...aggregates.values()]
    .filter((entry) => entry.attempts >= WEAK_TOPIC_MIN_ATTEMPTS)
    .map((entry) => toWeakTopic(entry))
    .sort((a, b) => {
      if (b.errorRate !== a.errorRate) {
        return b.errorRate - a.errorRate;
      }
      return a.chapterId.localeCompare(b.chapterId);
    })
    .slice(0, limit);
};

const aggregateAttemptsForRange = (
  attempts: PracticeAttempt[],
  setById: Map<string, PracticeSet>,
  days: ReadonlySet<string>,
): { attempts: number; correctCount: number; totalSolveTimeMs: number; weakTopics: WeakTopic[] } => {
  const inRange = attempts.filter((attempt) => days.has(toDayKey(attempt.solvedAt)));

  const attemptsCount = inRange.length;
  const correctCount = inRange.filter((attempt) => attempt.isCorrect).length;
  const totalSolveTimeMs = inRange.reduce((sum, attempt) => sum + Math.max(0, attempt.solveTimeMs || 0), 0);
  const weakTopics = selectWeakTopics(buildTopicAggregates(inRange, setById));

  return {
    attempts: attemptsCount,
    correctCount,
    totalSolveTimeMs,
    weakTopics,
  };
};

const buildTopicDailyTimeline = (
  attempts: PracticeAttempt[],
  setById: Map<string, PracticeSet>,
  filter: { subjectId: SubjectId; chapterId: string; topic?: string },
): Map<string, TopicAggregate> => {
  const timeline = new Map<string, TopicAggregate>();
  const topicMapBySetId = new Map<string, Map<string, string | undefined>>();

  attempts.forEach((attempt) => {
    const set = setById.get(attempt.setId);
    if (!set || set.subjectId !== filter.subjectId || set.chapterId !== filter.chapterId) {
      return;
    }

    const topicByQuestionId =
      topicMapBySetId.get(set.id) ?? (() => {
        const built = buildQuestionTopicMap(set);
        topicMapBySetId.set(set.id, built);
        return built;
      })();
    const attemptTopic = topicByQuestionId.get(attempt.questionId) ?? set.topic;

    if ((attemptTopic ?? '') !== (filter.topic ?? '')) {
      return;
    }

    const day = toDayKey(attempt.solvedAt);
    const current =
      timeline.get(day) ??
      ({
        subjectId: set.subjectId,
        chapterId: set.chapterId,
        topic: attemptTopic,
        attempts: 0,
        correctCount: 0,
        totalSolveTimeMs: 0,
      } satisfies TopicAggregate);

    addAttemptToAggregate(current, attempt);
    timeline.set(day, current);
  });

  return timeline;
};

const buildDrilldownTrend = (timeline: Map<string, TopicAggregate>): ProgressWeakTopicDrilldownPoint[] => {
  const dates = [...timeline.keys()].sort((a, b) => a.localeCompare(b));
  if (!dates.length) {
    return [];
  }

  const allDays = dayRangeInclusive(dates[0], dates[dates.length - 1]);

  return allDays
    .map((date) => {
      const day = timeline.get(date);
      if (!day) {
        return {
          date,
          attempts: 0,
          correctCount: 0,
          incorrectCount: 0,
          accuracyRate: 0,
          avgSolveTimeMs: 0,
        } satisfies ProgressWeakTopicDrilldownPoint;
      }

      const incorrectCount = day.attempts - day.correctCount;
      return {
        date,
        attempts: day.attempts,
        correctCount: day.correctCount,
        incorrectCount,
        accuracyRate: day.attempts > 0 ? day.correctCount / day.attempts : 0,
        avgSolveTimeMs: toAverage(day.totalSolveTimeMs, day.attempts),
      } satisfies ProgressWeakTopicDrilldownPoint;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
};

export interface ProgressService {
  computeAndStoreDailySnapshot(date?: string): Promise<ProgressSnapshot>;
  getDashboardMetrics(): Promise<ProgressDashboardMetrics>;
  getWeakTopicDrilldown(input: { subjectId: SubjectId; chapterId: string; topic?: string }): Promise<ProgressWeakTopicDrilldown>;
}

export class DefaultProgressService implements ProgressService {
  constructor(
    private readonly practiceRepository: PracticeRepository = createDefaultPracticeRepository(),
    private readonly progressRepository: ProgressRepository = createDefaultProgressRepository(),
    private readonly revisionRepository: RevisionRepository = createDefaultRevisionRepository(),
    private readonly historyLoader: typeof loadHistory = loadHistory,
  ) {}

  async computeAndStoreDailySnapshot(date: string = nowDayKey()): Promise<ProgressSnapshot> {
    const [attempts, sets] = await Promise.all([this.practiceRepository.listAttempts(), this.practiceRepository.listSets()]);

    const setById = buildPracticeSetMap(sets);
    const daySet = new Set([date]);
    const aggregate = aggregateAttemptsForRange(attempts, setById, daySet);

    const activeAttemptDays = new Set(attempts.map((attempt) => toDayKey(attempt.solvedAt)));
    const streakDays = calculateStreakDays(activeAttemptDays, date);

    const snapshot: ProgressSnapshot = {
      date,
      attempts: aggregate.attempts,
      correctCount: aggregate.correctCount,
      avgSolveTimeMs: toAverage(aggregate.totalSolveTimeMs, aggregate.attempts),
      streakDays,
      weakTopics: aggregate.weakTopics,
    };

    await this.progressRepository.saveSnapshot(snapshot);
    return snapshot;
  }

  async getDashboardMetrics(): Promise<ProgressDashboardMetrics> {
    const [attempts, sets, snapshots, revisionCards, doubtHistory] = await Promise.all([
      this.practiceRepository.listAttempts(),
      this.practiceRepository.listSets(),
      this.progressRepository.listSnapshots(),
      this.revisionRepository.listCards(),
      this.historyLoader(),
    ]);

    const setById = buildPracticeSetMap(sets);
    const activeStudyDays = new Set<string>([
      ...attempts.map((attempt) => toDayKey(attempt.solvedAt)),
      ...revisionCards
        .map((card) => card.lastReviewedAt)
        .filter((value): value is string => Boolean(value))
        .map((value) => toDayKey(value)),
      ...doubtHistory.map((record) => toDayKey(record.createdAt)),
    ]);
    const streakDays = calculateStreakDays(activeStudyDays);

    const totalAttempts = attempts.length;
    const correctCount = attempts.filter((attempt) => attempt.isCorrect).length;
    const totalSolveTimeMs = attempts.reduce((sum, attempt) => sum + Math.max(0, attempt.solveTimeMs || 0), 0);
    const weakTopics = selectWeakTopics(buildTopicAggregates(attempts, setById));

    return {
      summary: {
        attempts: totalAttempts,
        correctCount,
        incorrectCount: totalAttempts - correctCount,
        accuracyRate: totalAttempts > 0 ? correctCount / totalAttempts : 0,
        avgSolveTimeMs: toAverage(totalSolveTimeMs, totalAttempts),
        streakDays,
      },
      weakTopics,
      latestSnapshot: snapshots[0],
    };
  }

  async getWeakTopicDrilldown(input: {
    subjectId: SubjectId;
    chapterId: string;
    topic?: string;
  }): Promise<ProgressWeakTopicDrilldown> {
    const [attempts, sets] = await Promise.all([this.practiceRepository.listAttempts(), this.practiceRepository.listSets()]);
    const setById = buildPracticeSetMap(sets);

    const timeline = buildTopicDailyTimeline(attempts, setById, input);
    const trend = buildDrilldownTrend(timeline);

    const total = [...timeline.values()].reduce(
      (acc, day) => {
        acc.attempts += day.attempts;
        acc.correctCount += day.correctCount;
        acc.totalSolveTimeMs += day.totalSolveTimeMs;
        return acc;
      },
      { attempts: 0, correctCount: 0, totalSolveTimeMs: 0 },
    );

    return {
      subjectId: input.subjectId,
      chapterId: input.chapterId,
      topic: input.topic,
      attempts: total.attempts,
      correctCount: total.correctCount,
      incorrectCount: total.attempts - total.correctCount,
      accuracyRate: total.attempts > 0 ? total.correctCount / total.attempts : 0,
      avgSolveTimeMs: toAverage(total.totalSolveTimeMs, total.attempts),
      trend,
    };
  }
}

export const createProgressService = (): ProgressService => new DefaultProgressService();

export const __progressInternals = {
  calculateStreakDays,
  toDayKey,
};
