import AsyncStorage from '@react-native-async-storage/async-storage';

import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../storage/keys';
import { DoubtRecord } from '../types/doubt';
import { ProviderId } from '../types/settings';

const ACTIVE_HISTORY_KEY = STORAGE_KEYS.doubtRecordsV2;
const LEGACY_HISTORY_KEY = LEGACY_STORAGE_KEYS.historyV1;
const MAX_CACHE_BYTES = 50 * 1024 * 1024;

const estimateBytes = (value: string): number => {
  return value.length * 2;
};

const normalizeLegacyProvider = (value: unknown): ProviderId => {
  if (value === 'gemini' || value === 'openrouter' || value === 'huggingface' || value === 'local_template') {
    return value;
  }

  return 'gemini';
};

const toNormalizedRecord = (record: DoubtRecord): DoubtRecord => ({
  ...record,
  confidence: record.confidence ?? 'low',
  verificationNote: record.verificationNote,
  inference: {
    requestId: record.inference?.requestId ?? `legacy-${record.id}`,
    provider: normalizeLegacyProvider(record.inference?.provider),
    model: record.inference?.model ?? 'legacy_import',
    fallbackLevel: record.inference?.fallbackLevel ?? 0,
    retries: record.inference?.retries ?? 0,
    latencyMs: record.inference?.latencyMs ?? 0,
    status: record.inference?.status ?? 'success',
    errorCode: record.inference?.errorCode,
  },
  estimatedBytes: record.estimatedBytes || estimateBytes(JSON.stringify(record)),
});

const normalizeRecords = (records: readonly DoubtRecord[]): DoubtRecord[] =>
  records.map((record) => toNormalizedRecord(record));

const pruneToBudget = (records: readonly DoubtRecord[]): DoubtRecord[] => {
  const mutable = [...records];
  let totalBytes = mutable.reduce((acc, record) => acc + record.estimatedBytes, 0);

  if (totalBytes <= MAX_CACHE_BYTES) {
    return mutable;
  }

  const oldestFirst = [...mutable].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const removeSet = new Set<string>();
  for (const record of oldestFirst) {
    if (record.bookmarked) {
      continue;
    }

    removeSet.add(record.id);
    totalBytes -= record.estimatedBytes;
    if (totalBytes <= MAX_CACHE_BYTES) {
      break;
    }
  }

  return mutable.filter((record) => !removeSet.has(record.id));
};

const saveAll = async (records: readonly DoubtRecord[]): Promise<void> => {
  await AsyncStorage.setItem(ACTIVE_HISTORY_KEY, JSON.stringify(records));
};

const readHistoryByKey = async (key: string): Promise<DoubtRecord[] | null> => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as DoubtRecord[];
    return normalizeRecords(parsed);
  } catch {
    return [];
  }
};

export const loadHistory = async (): Promise<DoubtRecord[]> => {
  const v2Records = await readHistoryByKey(ACTIVE_HISTORY_KEY);
  if (v2Records) {
    return v2Records;
  }

  const legacyRecords = await readHistoryByKey(LEGACY_HISTORY_KEY);
  if (!legacyRecords) {
    return [];
  }

  await saveAll(legacyRecords);
  return legacyRecords;
};

export const addHistoryRecord = async (record: DoubtRecord): Promise<DoubtRecord[]> => {
  const existing = await loadHistory();
  const deduped = existing.filter((item) => item.id !== record.id);
  const normalized = toNormalizedRecord(record);

  const withNewRecord = [normalized, ...deduped];
  const pruned = pruneToBudget(withNewRecord);
  await saveAll(pruned);
  return pruned;
};

export const updateBookmark = async (id: string, bookmarked: boolean): Promise<DoubtRecord[]> => {
  const existing = await loadHistory();
  const updated = existing.map((record) =>
    record.id === id
      ? {
          ...record,
          bookmarked,
        }
      : record,
  );
  await saveAll(updated);
  return updated;
};

export const deleteHistoryRecord = async (id: string): Promise<DoubtRecord[]> => {
  const existing = await loadHistory();
  const updated = existing.filter((record) => record.id !== id);
  await saveAll(updated);
  return updated;
};

export const clearHistoryRecords = async (): Promise<DoubtRecord[]> => {
  await saveAll([]);
  return [];
};
