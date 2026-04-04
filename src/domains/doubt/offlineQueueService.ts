import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../storage/keys';
import { sanitizeOfflineQueueItems } from '../../storage/schema/offlineQueueSchema';
import { DoubtRequest } from '../../types/doubt';
import { OfflineQueueItem } from '../observability/types';
import { createId } from '../../utils/ids';

const DEFAULT_REPLAY_BACKOFF_MS = 30_000;
const MAX_REPLAY_BACKOFF_MS = 5 * 60_000;

const toIso = (date: Date): string => date.toISOString();

const computeNextRetryAt = (retryCount: number, now: Date): string => {
  const backoff = Math.min(DEFAULT_REPLAY_BACKOFF_MS * Math.max(1, 2 ** Math.max(0, retryCount - 1)), MAX_REPLAY_BACKOFF_MS);
  return toIso(new Date(now.getTime() + backoff));
};

const readQueue = async (): Promise<OfflineQueueItem[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.offlineQueueV2);
  if (!raw) {
    return [];
  }

  try {
    return sanitizeOfflineQueueItems(JSON.parse(raw));
  } catch {
    return [];
  }
};

const writeQueue = async (items: OfflineQueueItem[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.offlineQueueV2, JSON.stringify(items));
};

const toQueueableTextRequest = (
  request: DoubtRequest,
): Omit<DoubtRequest, 'imageBase64' | 'imageMimeType'> | null => {
  if (request.inputType !== 'text') {
    return null;
  }

  return {
    subjectId: request.subjectId,
    chapterId: request.chapterId,
    chapterName: request.chapterName,
    topic: request.topic,
    difficultyLevel: request.difficultyLevel,
    mode: request.mode,
    inputType: 'text',
    text: request.text,
  };
};

export const isLikelyOfflineError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /network request failed|failed to fetch|networkerror|load failed|connection|offline|internet/i.test(error.message);
};

export const checkInternetConnectivity = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 2500);

    const response = await fetch('https://clients3.google.com/generate_204', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
};

export const enqueueOfflineTextSolve = async (request: DoubtRequest): Promise<{ enqueued: boolean; queueLength: number }> => {
  const queueable = toQueueableTextRequest(request);
  if (!queueable) {
    return {
      enqueued: false,
      queueLength: (await readQueue()).length,
    };
  }

  const current = await readQueue();
  const now = new Date();
  const queuedItem: OfflineQueueItem = {
    id: createId('offline_solve'),
    requestType: 'solve_text',
    payload: {
      request: queueable,
    },
    createdAt: toIso(now),
    retryCount: 0,
    nextRetryAt: toIso(now),
  };

  const next = [...current, queuedItem];
  await writeQueue(next);
  return {
    enqueued: true,
    queueLength: next.length,
  };
};

export const getOfflineQueueCount = async (): Promise<number> => (await readQueue()).length;

export interface ReplayOfflineQueueInput {
  isConnected: () => Promise<boolean>;
  replay: (request: Omit<DoubtRequest, 'imageBase64' | 'imageMimeType'>) => Promise<void>;
  now?: Date;
}

export interface ReplayOfflineQueueResult {
  replayedCount: number;
  pendingCount: number;
}

export const replayOfflineTextQueue = async (input: ReplayOfflineQueueInput): Promise<ReplayOfflineQueueResult> => {
  const { isConnected, replay, now = new Date() } = input;
  const connected = await isConnected();
  if (!connected) {
    return {
      replayedCount: 0,
      pendingCount: (await readQueue()).length,
    };
  }

  const items = await readQueue();
  if (items.length === 0) {
    return {
      replayedCount: 0,
      pendingCount: 0,
    };
  }

  const dueItems = items.filter((item) => new Date(item.nextRetryAt).getTime() <= now.getTime());
  if (dueItems.length === 0) {
    return {
      replayedCount: 0,
      pendingCount: items.length,
    };
  }

  let replayedCount = 0;
  const remaining = [...items];

  for (const item of dueItems) {
    const index = remaining.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
      continue;
    }

    try {
      await replay(item.payload.request);
      replayedCount += 1;
      remaining.splice(index, 1);
    } catch {
      const nextRetryCount = item.retryCount + 1;
      remaining[index] = {
        ...item,
        retryCount: nextRetryCount,
        nextRetryAt: computeNextRetryAt(nextRetryCount, now),
      };
    }
  }

  await writeQueue(remaining);
  return {
    replayedCount,
    pendingCount: remaining.length,
  };
};
