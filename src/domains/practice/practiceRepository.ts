import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../storage/keys';
import { PracticeAttempt, PracticeSet } from './types';

const parseJsonArray = <T>(raw: string | null): T[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const normalizeLegacyPracticeAttempt = (attempt: PracticeAttempt): PracticeAttempt => {
  const hasImprovementHints = Array.isArray(attempt.improvementHints);
  const normalizedIsCorrect = Boolean(attempt.isCorrect);

  return {
    ...attempt,
    finalAnswerCheck: attempt.finalAnswerCheck ?? (normalizedIsCorrect ? 'pass' : 'fail'),
    improvementHints: hasImprovementHints ? attempt.improvementHints : [],
    nextStepCue: attempt.nextStepCue ?? 'Retry a similar question and verify each solving step.',
    confidence: attempt.confidence ?? 'low',
    verificationNote:
      attempt.verificationNote ?? 'Legacy attempt loaded without verification metadata.',
    degraded: attempt.degraded ?? false,
    promptVersion: attempt.promptVersion ?? 'legacy_practice_v0',
  };
};

export interface PracticeRepository {
  saveSet(set: PracticeSet): Promise<void>;
  listSets(): Promise<PracticeSet[]>;
  getSetById(id: string): Promise<PracticeSet | null>;
  saveAttempts(attempts: PracticeAttempt[]): Promise<void>;
  listAttempts(): Promise<PracticeAttempt[]>;
  listAttemptsBySetId(setId: string): Promise<PracticeAttempt[]>;
}

export class AsyncStoragePracticeRepository implements PracticeRepository {
  async saveSet(set: PracticeSet): Promise<void> {
    const sets = await this.listSets();
    const deduped = sets.filter((entry) => entry.id !== set.id);
    await AsyncStorage.setItem(STORAGE_KEYS.practiceSetsV2, JSON.stringify([set, ...deduped]));
  }

  async listSets(): Promise<PracticeSet[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.practiceSetsV2);
    return parseJsonArray<PracticeSet>(raw);
  }

  async getSetById(id: string): Promise<PracticeSet | null> {
    const sets = await this.listSets();
    return sets.find((entry) => entry.id === id) ?? null;
  }

  async saveAttempts(attempts: PracticeAttempt[]): Promise<void> {
    if (!attempts.length) {
      return;
    }

    const existing = parseJsonArray<PracticeAttempt>(await AsyncStorage.getItem(STORAGE_KEYS.practiceAttemptsV2));
    const removeIds = new Set(attempts.map((attempt) => attempt.id));
    const deduped = existing.filter((entry) => !removeIds.has(entry.id));
    await AsyncStorage.setItem(STORAGE_KEYS.practiceAttemptsV2, JSON.stringify([...attempts, ...deduped]));
  }

  async listAttemptsBySetId(setId: string): Promise<PracticeAttempt[]> {
    return (await this.listAttempts()).filter((entry) => entry.setId === setId);
  }

  async listAttempts(): Promise<PracticeAttempt[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.practiceAttemptsV2);
    return parseJsonArray<PracticeAttempt>(raw).map(normalizeLegacyPracticeAttempt);
  }
}

export const createDefaultPracticeRepository = (): PracticeRepository => new AsyncStoragePracticeRepository();
