import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../storage/keys';
import { RevisionCard } from './types';

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

export interface RevisionRepository {
  listCards(): Promise<RevisionCard[]>;
  saveCards(cards: RevisionCard[]): Promise<void>;
  upsertCards(cards: RevisionCard[]): Promise<void>;
}

export class AsyncStorageRevisionRepository implements RevisionRepository {
  async listCards(): Promise<RevisionCard[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.revisionCardsV2);
    return parseJsonArray<RevisionCard>(raw);
  }

  async saveCards(cards: RevisionCard[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.revisionCardsV2, JSON.stringify(cards));
  }

  async upsertCards(cards: RevisionCard[]): Promise<void> {
    if (!cards.length) {
      return;
    }

    const existing = await this.listCards();
    const removeIds = new Set(cards.map((entry) => entry.id));
    const deduped = existing.filter((entry) => !removeIds.has(entry.id));
    await this.saveCards([...cards, ...deduped]);
  }
}

export const createDefaultRevisionRepository = (): RevisionRepository => new AsyncStorageRevisionRepository();
