import { ProgressRepository } from './progressRepository';
import { __progressInternals, DefaultProgressService } from './progressService';
import { ProgressSnapshot } from './types';
import { PracticeRepository } from '../practice/practiceRepository';
import { PracticeAttempt, PracticeSet } from '../practice/types';
import { RevisionRepository } from '../revision/revisionRepository';
import { RevisionCard } from '../revision/types';
import { DoubtRecord } from '../../types/doubt';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

class InMemoryPracticeRepository implements PracticeRepository {
  constructor(
    private sets: PracticeSet[] = [],
    private attempts: PracticeAttempt[] = [],
  ) {}

  async saveSet(set: PracticeSet): Promise<void> {
    this.sets = [set, ...this.sets.filter((entry) => entry.id !== set.id)];
  }

  async listSets(): Promise<PracticeSet[]> {
    return [...this.sets];
  }

  async getSetById(id: string): Promise<PracticeSet | null> {
    return this.sets.find((entry) => entry.id === id) ?? null;
  }

  async saveAttempts(attempts: PracticeAttempt[]): Promise<void> {
    const removeIds = new Set(attempts.map((entry) => entry.id));
    this.attempts = [...attempts, ...this.attempts.filter((entry) => !removeIds.has(entry.id))];
  }

  async listAttempts(): Promise<PracticeAttempt[]> {
    return [...this.attempts];
  }

  async listAttemptsBySetId(setId: string): Promise<PracticeAttempt[]> {
    return this.attempts.filter((entry) => entry.setId === setId);
  }
}

class InMemoryProgressRepository implements ProgressRepository {
  private snapshots: ProgressSnapshot[] = [];

  async listSnapshots(): Promise<ProgressSnapshot[]> {
    return [...this.snapshots].sort((a, b) => b.date.localeCompare(a.date));
  }

  async saveSnapshot(snapshot: ProgressSnapshot): Promise<void> {
    this.snapshots = [snapshot, ...this.snapshots.filter((entry) => entry.date !== snapshot.date)].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }

  async getSnapshotByDate(date: string): Promise<ProgressSnapshot | null> {
    return this.snapshots.find((entry) => entry.date === date) ?? null;
  }
}

class InMemoryRevisionRepository implements RevisionRepository {
  constructor(private cards: RevisionCard[] = []) {}

  async listCards(): Promise<RevisionCard[]> {
    return [...this.cards];
  }

  async saveCards(cards: RevisionCard[]): Promise<void> {
    this.cards = [...cards];
  }

  async upsertCards(cards: RevisionCard[]): Promise<void> {
    const removeIds = new Set(cards.map((entry) => entry.id));
    this.cards = [...cards, ...this.cards.filter((entry) => !removeIds.has(entry.id))];
  }
}

const createPracticeSet = (): PracticeSet => ({
  id: 'set_1',
  subjectId: 'physics',
  chapterId: 'mechanics',
  topic: 'Kinematics',
  questionCount: 5,
  degraded: false,
  generatedAt: '2026-04-01T00:00:00.000Z',
  questions: [
    { id: 'q1', prompt: 'Q1', topic: 'Kinematics', difficulty: 'easy', answerKey: 'A1' },
    { id: 'q2', prompt: 'Q2', topic: 'Kinematics', difficulty: 'medium', answerKey: 'A2' },
    { id: 'q3', prompt: 'Q3', topic: 'Kinematics', difficulty: 'hard', answerKey: 'A3' },
    { id: 'q4', prompt: 'Q4', topic: 'Laws of Motion', difficulty: 'easy', answerKey: 'A4' },
    { id: 'q5', prompt: 'Q5', topic: 'Laws of Motion', difficulty: 'medium', answerKey: 'A5' },
  ],
});

const createAttempts = (): PracticeAttempt[] => [
  {
    id: 'a1',
    setId: 'set_1',
    questionId: 'q1',
    userAnswer: 'x',
    isCorrect: false,
    explanation: 'exp',
    solvedAt: '2026-04-01T10:00:00.000Z',
    solveTimeMs: 30000,
  },
  {
    id: 'a2',
    setId: 'set_1',
    questionId: 'q2',
    userAnswer: 'A2',
    isCorrect: true,
    explanation: 'exp',
    solvedAt: '2026-04-01T10:05:00.000Z',
    solveTimeMs: 45000,
  },
  {
    id: 'a3',
    setId: 'set_1',
    questionId: 'q3',
    userAnswer: 'x',
    isCorrect: false,
    explanation: 'exp',
    solvedAt: '2026-04-02T10:00:00.000Z',
    solveTimeMs: 60000,
  },
  {
    id: 'a4',
    setId: 'set_1',
    questionId: 'q4',
    userAnswer: 'x',
    isCorrect: false,
    explanation: 'exp',
    solvedAt: '2026-04-03T10:00:00.000Z',
    solveTimeMs: 90000,
  },
  {
    id: 'a5',
    setId: 'set_1',
    questionId: 'q5',
    userAnswer: 'A5',
    isCorrect: true,
    explanation: 'exp',
    solvedAt: '2026-04-03T10:03:00.000Z',
    solveTimeMs: 120000,
  },
];

const runStreakLogicTests = (): void => {
  const { calculateStreakDays } = __progressInternals;

  const streakFromToday = calculateStreakDays(new Set(['2026-04-01', '2026-04-02', '2026-04-03']), '2026-04-03');
  assert(streakFromToday === 3, 'expected streak to include today and previous consecutive days');

  const streakFromYesterday = calculateStreakDays(new Set(['2026-04-01', '2026-04-02']), '2026-04-03');
  assert(streakFromYesterday === 2, 'expected streak to continue from yesterday when today has no activity');

  const brokenStreak = calculateStreakDays(new Set(['2026-03-31', '2026-04-02']), '2026-04-03');
  assert(brokenStreak === 1, 'expected streak to stop at the first missing day');

  const noRecentActivity = calculateStreakDays(new Set(['2026-03-20', '2026-03-21']), '2026-04-03');
  assert(noRecentActivity === 0, 'expected streak 0 when neither today nor yesterday has activity');
};

const runAggregationTests = async (): Promise<void> => {
  const practiceRepo = new InMemoryPracticeRepository([createPracticeSet()], createAttempts());
  const progressRepo = new InMemoryProgressRepository();
  const revisionRepo = new InMemoryRevisionRepository([
    {
      id: 'rev_1',
      sourceType: 'doubt',
      sourceId: 'd_1',
      subjectId: 'physics',
      chapterId: 'mechanics',
      topic: 'Kinematics',
      front: 'f',
      back: 'b',
      dueAt: '2026-04-05T00:00:00.000Z',
      intervalDays: 3,
      easeScore: 2.5,
      lastReviewedAt: '2026-04-02T08:00:00.000Z',
    },
  ]);

  const historyLoader = async (): Promise<DoubtRecord[]> => [
    {
      id: 'd1',
      subjectId: 'physics',
      subjectName: 'Physics',
      chapterId: 'mechanics',
      chapterName: 'Mechanics',
      topic: 'Kinematics',
      questionText: 'Q',
      responseMarkdown: 'R',
      createdAt: '2026-04-03T06:00:00.000Z',
      bookmarked: false,
      confidence: 'medium',
      inference: {
        requestId: 'r1',
        provider: 'gemini',
        model: 'm',
        fallbackLevel: 0,
        retries: 0,
        latencyMs: 1000,
        status: 'success',
      },
      estimatedBytes: 200,
    },
  ];

  const service = new DefaultProgressService(practiceRepo, progressRepo, revisionRepo, historyLoader);

  const dashboard = await service.getDashboardMetrics();
  assert(dashboard.summary.attempts === 5, 'expected total attempts = 5');
  assert(dashboard.summary.correctCount === 2, 'expected total correct = 2');
  assert(dashboard.summary.incorrectCount === 3, 'expected total incorrect = 3');
  assert(Math.abs(dashboard.summary.accuracyRate - 0.4) < 1e-9, 'expected accuracy = 40%');
  assert(dashboard.summary.avgSolveTimeMs === 69000, 'expected weighted avg solve time');
  assert(dashboard.summary.streakDays === 3, 'expected cross-source streak to be 3 days');

  assert(dashboard.weakTopics.length === 1, 'expected one weak topic from thresholded aggregates');
  assert(dashboard.weakTopics[0].topic === 'Kinematics', 'expected Kinematics to be top weak topic');
  assert(Math.abs(dashboard.weakTopics[0].errorRate - (2 / 3)) < 1e-9, 'expected Kinematics error rate = 66.7%');

  const drilldown = await service.getWeakTopicDrilldown({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
  });

  assert(drilldown.attempts === 3, 'expected Kinematics drilldown attempts = 3');
  assert(drilldown.correctCount === 1, 'expected Kinematics correct count = 1');
  assert(drilldown.incorrectCount === 2, 'expected Kinematics incorrect count = 2');
  assert(drilldown.trend.length === 2, 'expected two trend points across active date range');
  assert(drilldown.trend[0].date === '2026-04-02', 'expected latest trend day first');
  assert(drilldown.trend[1].date === '2026-04-01', 'expected previous trend day second');

  const snapshot = await service.computeAndStoreDailySnapshot('2026-04-03');
  assert(snapshot.attempts === 2, 'expected daily snapshot attempts for target day');
  assert(snapshot.correctCount === 1, 'expected daily snapshot correct count for target day');
  assert(snapshot.streakDays === 3, 'expected daily snapshot streak from attempts timeline');

  const persisted = await progressRepo.getSnapshotByDate('2026-04-03');
  assert(Boolean(persisted), 'expected computed snapshot to be persisted');
};

export const runProgressServiceUnitTests = async (): Promise<void> => {
  runStreakLogicTests();
  await runAggregationTests();
};
