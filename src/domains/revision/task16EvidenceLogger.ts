import { RevisionRating } from './revisionScheduler';

const readTask16EvidenceEnvFlag = (): string | undefined => {
  if (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_TASK16_EVIDENCE_LOGS) {
    return process.env.EXPO_PUBLIC_TASK16_EVIDENCE_LOGS;
  }

  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_TASK16_EVIDENCE_LOGS;
};

const isTask16EvidenceEnabled = (): boolean => readTask16EvidenceEnvFlag() === '1';

const emitTask16Marker = (marker: string, payload: Record<string, unknown>): void => {
  if (!isTask16EvidenceEnabled()) {
    return;
  }

  console.log(`[TASK16_MANUAL] ${marker} ${JSON.stringify(payload)}`);
};

export const logTask16QueueLoaded = (dueCount: number): void => {
  emitTask16Marker('queue_loaded', { dueCount });
};

export const logTask16ReviewAction = (input: {
  cardId: string;
  rating: RevisionRating;
  intervalBefore: number;
  intervalAfter: number;
  dueBefore: string;
  dueAfter: string;
}): void => {
  emitTask16Marker('review_action', {
    cardId: input.cardId,
    rating: input.rating,
    intervalBefore: input.intervalBefore,
    intervalAfter: input.intervalAfter,
    dueBefore: input.dueBefore,
    dueAfter: input.dueAfter,
  });
};

export const logTask16QueueAfterReview = (dueCount: number): void => {
  emitTask16Marker('queue_after_review', { dueCount });
};
