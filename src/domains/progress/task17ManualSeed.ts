import AsyncStorage from '@react-native-async-storage/async-storage';

import { PracticeAttempt, PracticeSet } from '../practice/types';
import { RevisionCard } from '../revision/types';
import { DoubtRecord } from '../../types/doubt';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../storage/keys';

const readTask17SeedEnvFlag = (): string | undefined => {
  if (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_TASK17_SEED_RECORDS) {
    return process.env.EXPO_PUBLIC_TASK17_SEED_RECORDS;
  }

  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_TASK17_SEED_RECORDS;
};

export const isTask17SeedEnabled = (): boolean => readTask17SeedEnvFlag() === '1';

const toIsoDay = (offsetDays: number): string => {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
};

const atUtcTime = (day: string, hhmmss: string): string => `${day}T${hhmmss}.000Z`;

const buildSeedPracticeSet = (dayMinus2: string): PracticeSet => ({
  id: 'task17_set_1',
  subjectId: 'physics',
  chapterId: 'mechanics',
  topic: 'Kinematics',
  questionCount: 5,
  degraded: false,
  generatedAt: atUtcTime(dayMinus2, '09:00:00'),
  questions: [
    { id: 'task17_q1', prompt: 'Kinematics Q1', topic: 'Kinematics', difficulty: 'easy', answerKey: 'A' },
    { id: 'task17_q2', prompt: 'Kinematics Q2', topic: 'Kinematics', difficulty: 'medium', answerKey: 'B' },
    { id: 'task17_q3', prompt: 'Kinematics Q3', topic: 'Kinematics', difficulty: 'hard', answerKey: 'C' },
    { id: 'task17_q4', prompt: 'Laws of Motion Q1', topic: 'Laws of Motion', difficulty: 'easy', answerKey: 'D' },
    { id: 'task17_q5', prompt: 'Laws of Motion Q2', topic: 'Laws of Motion', difficulty: 'medium', answerKey: 'E' },
  ],
});

const buildSeedAttempts = (dayMinus2: string, dayMinus1: string, day0: string): PracticeAttempt[] => [
  {
    id: 'task17_a1',
    setId: 'task17_set_1',
    questionId: 'task17_q1',
    userAnswer: 'X',
    isCorrect: false,
    explanation: 'seed',
    solvedAt: atUtcTime(dayMinus2, '10:00:00'),
    solveTimeMs: 30000,
  },
  {
    id: 'task17_a2',
    setId: 'task17_set_1',
    questionId: 'task17_q2',
    userAnswer: 'B',
    isCorrect: true,
    explanation: 'seed',
    solvedAt: atUtcTime(dayMinus2, '10:05:00'),
    solveTimeMs: 45000,
  },
  {
    id: 'task17_a3',
    setId: 'task17_set_1',
    questionId: 'task17_q3',
    userAnswer: 'X',
    isCorrect: false,
    explanation: 'seed',
    solvedAt: atUtcTime(dayMinus1, '10:00:00'),
    solveTimeMs: 60000,
  },
  {
    id: 'task17_a4',
    setId: 'task17_set_1',
    questionId: 'task17_q4',
    userAnswer: 'X',
    isCorrect: false,
    explanation: 'seed',
    solvedAt: atUtcTime(day0, '10:00:00'),
    solveTimeMs: 90000,
  },
  {
    id: 'task17_a5',
    setId: 'task17_set_1',
    questionId: 'task17_q5',
    userAnswer: 'E',
    isCorrect: true,
    explanation: 'seed',
    solvedAt: atUtcTime(day0, '10:03:00'),
    solveTimeMs: 120000,
  },
];

const buildSeedRevisionCards = (dayMinus1: string): RevisionCard[] => [
  {
    id: 'task17_rev_1',
    sourceType: 'doubt',
    sourceId: 'task17_d1',
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    front: 'seed-front',
    back: 'seed-back',
    dueAt: atUtcTime(dayMinus1, '20:00:00'),
    intervalDays: 3,
    easeScore: 2.5,
    lastReviewedAt: atUtcTime(dayMinus1, '08:00:00'),
  },
];

const buildSeedDoubtHistory = (day0: string): DoubtRecord[] => [
  {
    id: 'task17_d1',
    subjectId: 'physics',
    subjectName: 'Physics',
    chapterId: 'mechanics',
    chapterName: 'Mechanics',
    topic: 'Kinematics',
    questionText: 'seed question',
    responseMarkdown: 'seed answer',
    createdAt: atUtcTime(day0, '06:00:00'),
    bookmarked: false,
    confidence: 'medium',
    verificationNote: 'seed',
    inference: {
      requestId: 'task17_r1',
      provider: 'gemini',
      model: 'seed-model',
      fallbackLevel: 0,
      retries: 0,
      latencyMs: 1000,
      status: 'success',
    },
    estimatedBytes: 200,
  },
];

export interface Task17SeedCounts {
  practiceSets: number;
  practiceAttempts: number;
  revisionCards: number;
  doubtHistory: number;
}

export const seedTask17ManualDataset = async (): Promise<Task17SeedCounts> => {
  const dayMinus2 = toIsoDay(-2);
  const dayMinus1 = toIsoDay(-1);
  const day0 = toIsoDay(0);

  const practiceSets = [buildSeedPracticeSet(dayMinus2)];
  const practiceAttempts = buildSeedAttempts(dayMinus2, dayMinus1, day0);
  const revisionCards = buildSeedRevisionCards(dayMinus1);
  const doubtHistory = buildSeedDoubtHistory(day0);

  await AsyncStorage.multiSet([
    [STORAGE_KEYS.practiceSetsV2, JSON.stringify(practiceSets)],
    [STORAGE_KEYS.practiceAttemptsV2, JSON.stringify(practiceAttempts)],
    [STORAGE_KEYS.revisionCardsV2, JSON.stringify(revisionCards)],
    [STORAGE_KEYS.progressSnapshotsV2, JSON.stringify([])],
    [LEGACY_STORAGE_KEYS.historyV1, JSON.stringify(doubtHistory)],
  ]);

  return {
    practiceSets: practiceSets.length,
    practiceAttempts: practiceAttempts.length,
    revisionCards: revisionCards.length,
    doubtHistory: doubtHistory.length,
  };
};
