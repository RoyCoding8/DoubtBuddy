import { updateCardAfterReview } from './revisionScheduler';
import { RevisionCard } from './types';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const baseCard = (): RevisionCard => ({
  id: 'card_1',
  sourceType: 'doubt',
  sourceId: 'doubt_1',
  subjectId: 'physics',
  chapterId: 'mechanics',
  topic: 'Kinematics',
  front: 'Front',
  back: 'Back',
  dueAt: '2026-01-01T00:00:00.000Z',
  intervalDays: 3,
  easeScore: 2.5,
});

const expectDueDeltaDays = (from: Date, dueAt: string, expectedDays: number): void => {
  const diffMs = new Date(dueAt).getTime() - from.getTime();
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  assert(days === expectedDays, `expected due date delta ${expectedDays} days, got ${days}`);
};

const runEasyScheduleUpdate = (): void => {
  const reviewedAt = new Date('2026-02-10T00:00:00.000Z');
  const updated = updateCardAfterReview(baseCard(), 'easy', reviewedAt);
  assert(updated.intervalDays === 7, 'easy should advance 3d -> 7d');
  expectDueDeltaDays(reviewedAt, updated.dueAt, 7);
};

const runHardScheduleUpdate = (): void => {
  const reviewedAt = new Date('2026-02-10T00:00:00.000Z');
  const updated = updateCardAfterReview(baseCard(), 'hard', reviewedAt);
  assert(updated.intervalDays === 3, 'hard should keep current interval');
  expectDueDeltaDays(reviewedAt, updated.dueAt, 3);
};

const runAgainScheduleUpdate = (): void => {
  const reviewedAt = new Date('2026-02-10T00:00:00.000Z');
  const updated = updateCardAfterReview(baseCard(), 'again', reviewedAt);
  assert(updated.intervalDays === 1, 'again should reset interval to 1 day');
  expectDueDeltaDays(reviewedAt, updated.dueAt, 1);
};

export const runRevisionSchedulerUnitTests = async (): Promise<void> => {
  runEasyScheduleUpdate();
  runHardScheduleUpdate();
  runAgainScheduleUpdate();
};
