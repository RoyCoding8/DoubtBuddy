import { RevisionCard } from './types';

export type RevisionRating = 'again' | 'hard' | 'easy';

const DAY_MS = 24 * 60 * 60 * 1000;

const INTERVAL_SEQUENCE: Array<RevisionCard['intervalDays']> = [1, 3, 7, 14];

const clampInterval = (value: number): RevisionCard['intervalDays'] => {
  if (value <= 1) {
    return 1;
  }
  if (value <= 3) {
    return 3;
  }
  if (value <= 7) {
    return 7;
  }
  return 14;
};

const nextIntervalForEasy = (current: RevisionCard['intervalDays']): RevisionCard['intervalDays'] => {
  const index = INTERVAL_SEQUENCE.indexOf(current);
  if (index < 0 || index >= INTERVAL_SEQUENCE.length - 1) {
    return 14;
  }

  return INTERVAL_SEQUENCE[index + 1];
};

const nextIntervalForHard = (current: RevisionCard['intervalDays']): RevisionCard['intervalDays'] => {
  return current;
};

const nextIntervalForAgain = (): RevisionCard['intervalDays'] => 1;

export const calculateNextIntervalDays = (
  currentInterval: RevisionCard['intervalDays'],
  rating: RevisionRating,
): RevisionCard['intervalDays'] => {
  if (rating === 'again') {
    return nextIntervalForAgain();
  }

  if (rating === 'hard') {
    return nextIntervalForHard(currentInterval);
  }

  return nextIntervalForEasy(currentInterval);
};

export const calculateNextDueAt = (baseDate: Date, intervalDays: RevisionCard['intervalDays']): string => {
  return new Date(baseDate.getTime() + intervalDays * DAY_MS).toISOString();
};

export const updateCardAfterReview = (
  card: RevisionCard,
  rating: RevisionRating,
  reviewedAt: Date = new Date(),
): RevisionCard => {
  const safeInterval = clampInterval(card.intervalDays);
  const nextInterval = calculateNextIntervalDays(safeInterval, rating);

  const nextEaseScore =
    rating === 'easy' ? Math.min(5, card.easeScore + 0.2) : rating === 'hard' ? Math.max(1.3, card.easeScore - 0.1) : 1.3;

  return {
    ...card,
    intervalDays: nextInterval,
    dueAt: calculateNextDueAt(reviewedAt, nextInterval),
    lastReviewedAt: reviewedAt.toISOString(),
    easeScore: Number(nextEaseScore.toFixed(2)),
  };
};
