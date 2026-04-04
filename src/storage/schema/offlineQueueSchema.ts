import { OfflineQueueItem } from '../../domains/observability/types';
import { DoubtRequest } from '../../types/doubt';

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const asFiniteNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const normalizeRequest = (value: unknown): Omit<DoubtRequest, 'imageBase64' | 'imageMimeType'> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<DoubtRequest>;
  if (candidate.inputType !== 'text') {
    return null;
  }

  const subjectId = asString(candidate.subjectId);
  const chapterId = asString(candidate.chapterId);
  const chapterName = asString(candidate.chapterName);
  const mode = candidate.mode;

  if (!subjectId || !chapterId || !chapterName) {
    return null;
  }

  if (mode !== 'step_by_step' && mode !== 'hint_only' && mode !== 'explain_concept' && mode !== 'quick_answer') {
    return null;
  }

  return {
    subjectId: subjectId as DoubtRequest['subjectId'],
    chapterId,
    chapterName,
    topic: typeof candidate.topic === 'string' ? candidate.topic : undefined,
    difficultyLevel:
      candidate.difficultyLevel === 'easy' || candidate.difficultyLevel === 'medium' || candidate.difficultyLevel === 'hard'
        ? candidate.difficultyLevel
        : 'medium',
    mode,
    inputType: 'text',
    text: asString(candidate.text),
  };
};

const normalizeQueueItem = (value: unknown): OfflineQueueItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<OfflineQueueItem> & {
    payload?: { request?: unknown };
  };

  if (candidate.requestType !== 'solve_text') {
    return null;
  }

  const request = normalizeRequest(candidate.payload?.request);
  if (!request) {
    return null;
  }

  const id = asString(candidate.id);
  const createdAt = asString(candidate.createdAt);
  const nextRetryAt = asString(candidate.nextRetryAt || createdAt);

  if (!id || !createdAt || !nextRetryAt) {
    return null;
  }

  return {
    id,
    requestType: 'solve_text',
    payload: {
      request,
    },
    createdAt,
    retryCount: Math.max(0, Math.floor(asFiniteNumber(candidate.retryCount, 0))),
    nextRetryAt,
  };
};

export const sanitizeOfflineQueueItems = (value: unknown): OfflineQueueItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeQueueItem(item))
    .filter((item): item is OfflineQueueItem => Boolean(item))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
};
