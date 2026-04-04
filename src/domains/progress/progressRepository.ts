import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../storage/keys';
import { ProgressSnapshot } from './types';

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

const byDateDesc = (a: ProgressSnapshot, b: ProgressSnapshot): number => b.date.localeCompare(a.date);

export interface ProgressRepository {
  listSnapshots(): Promise<ProgressSnapshot[]>;
  saveSnapshot(snapshot: ProgressSnapshot): Promise<void>;
  getSnapshotByDate(date: string): Promise<ProgressSnapshot | null>;
}

export class AsyncStorageProgressRepository implements ProgressRepository {
  async listSnapshots(): Promise<ProgressSnapshot[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.progressSnapshotsV2);
    return parseJsonArray<ProgressSnapshot>(raw).sort(byDateDesc);
  }

  async saveSnapshot(snapshot: ProgressSnapshot): Promise<void> {
    const existing = await this.listSnapshots();
    const deduped = existing.filter((entry) => entry.date !== snapshot.date);
    const next = [snapshot, ...deduped].sort(byDateDesc);
    await AsyncStorage.setItem(STORAGE_KEYS.progressSnapshotsV2, JSON.stringify(next));
  }

  async getSnapshotByDate(date: string): Promise<ProgressSnapshot | null> {
    const snapshots = await this.listSnapshots();
    return snapshots.find((entry) => entry.date === date) ?? null;
  }
}

export const createDefaultProgressRepository = (): ProgressRepository => new AsyncStorageProgressRepository();
