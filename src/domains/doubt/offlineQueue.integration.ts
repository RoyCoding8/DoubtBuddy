import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../storage/keys';
import { DoubtRequest } from '../../types/doubt';
import { enqueueOfflineTextSolve, replayOfflineTextQueue } from './offlineQueueService';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const installMemoryStorage = (): Map<string, string> => {
  const memoryStore = new Map<string, string>();
  const storage = AsyncStorage as unknown as {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };

  storage.getItem = async (key: string): Promise<string | null> => memoryStore.get(key) ?? null;
  storage.setItem = async (key: string, value: string): Promise<void> => {
    memoryStore.set(key, value);
  };

  return memoryStore;
};

const baseTextRequest: DoubtRequest = {
  subjectId: 'physics',
  chapterId: 'mechanics',
  chapterName: 'Mechanics',
  topic: 'Kinematics',
  difficultyLevel: 'medium',
  mode: 'step_by_step',
  inputType: 'text',
  text: 'A body is thrown upward with velocity u.',
};

const runOfflineEnqueueThenReplayOnReconnect = async (): Promise<void> => {
  const memoryStore = installMemoryStorage();
  const replayed: Array<Omit<DoubtRequest, 'imageBase64' | 'imageMimeType'>> = [];

  const enqueueResult = await enqueueOfflineTextSolve(baseTextRequest);
  assert(enqueueResult.enqueued, 'text solve should enqueue when requested');
  assert(enqueueResult.queueLength === 1, 'queue length should be 1 after enqueue');

  const replayResult = await replayOfflineTextQueue({
    isConnected: async () => true,
    replay: async (request) => {
      replayed.push(request);
    },
  });

  assert(replayResult.replayedCount === 1, 'one queued item should replay when online');
  assert(replayResult.pendingCount === 0, 'queue should be empty after successful replay');
  assert(replayed.length === 1, 'replay handler should receive exactly one request');
  assert(replayed[0]?.inputType === 'text', 'replayed request must remain text-only');

  const stored = memoryStore.get(STORAGE_KEYS.offlineQueueV2);
  assert(stored === '[]', 'offline queue storage should persist empty array after replay');
};

const runImageRequestsExcludedFromV1Queue = async (): Promise<void> => {
  installMemoryStorage();

  const imageRequest: DoubtRequest = {
    ...baseTextRequest,
    inputType: 'image',
    imageMimeType: 'image/jpeg',
    imageBase64: 'abc',
  };

  const enqueueResult = await enqueueOfflineTextSolve(imageRequest);
  assert(!enqueueResult.enqueued, 'image requests must be excluded from v1 queue');
  assert(enqueueResult.queueLength === 0, 'queue length should remain 0 for image request');
};

export const runOfflineQueueIntegrationTests = async (): Promise<void> => {
  await runOfflineEnqueueThenReplayOnReconnect();
  await runImageRequestsExcludedFromV1Queue();
};
