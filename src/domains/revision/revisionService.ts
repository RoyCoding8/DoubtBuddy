import { createId } from '../../utils/ids';
import { DoubtRecord } from '../../types/doubt';
import { PracticeAttempt, PracticeSet } from '../practice/types';
import { PracticeRepository, createDefaultPracticeRepository } from '../practice/practiceRepository';
import { RevisionCard } from './types';
import { RevisionRating, updateCardAfterReview } from './revisionScheduler';
import { RevisionRepository, createDefaultRevisionRepository } from './revisionRepository';

const nowIso = (): string => new Date().toISOString();

const asBackText = (value: string | undefined): string => {
  const trimmed = (value ?? '').trim();
  return trimmed || 'Review the full worked solution and key steps again.';
};

const questionSummary = (value: string): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 220) {
    return normalized;
  }
  return `${normalized.slice(0, 220)}…`;
};

const buildDoubtCard = (record: DoubtRecord): RevisionCard => ({
  id: createId('rev_doubt'),
  sourceType: 'doubt',
  sourceId: record.id,
  subjectId: record.subjectId,
  chapterId: record.chapterId,
  topic: record.topic,
  front: questionSummary(record.questionText),
  back: asBackText(record.responseMarkdown),
  dueAt: nowIso(),
  intervalDays: 1,
  easeScore: 2.5,
});

const buildPracticeWrongCard = (input: {
  attempt: PracticeAttempt;
  set: PracticeSet;
  topic?: string;
  prompt: string;
}): RevisionCard => ({
  id: createId('rev_practice_wrong'),
  sourceType: 'practice_wrong',
  sourceId: input.attempt.id,
  subjectId: input.set.subjectId,
  chapterId: input.set.chapterId,
  topic: input.topic,
  front: questionSummary(input.prompt),
  back: asBackText(input.attempt.explanation),
  dueAt: nowIso(),
  intervalDays: 1,
  easeScore: 2.3,
  lastReviewedAt: input.attempt.solvedAt,
});

const isCardDue = (card: RevisionCard, now: Date): boolean => {
  return new Date(card.dueAt).getTime() <= now.getTime();
};

const byDueAsc = (a: RevisionCard, b: RevisionCard): number => {
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
};

export interface RevisionService {
  seedFromSolvedDoubt(record: DoubtRecord): Promise<RevisionCard>;
  seedFromSolvedDoubts(records: DoubtRecord[]): Promise<RevisionCard[]>;
  seedFromWrongPracticeAttempts(setId: string): Promise<RevisionCard[]>;
  seedFromAllWrongPracticeAttempts(): Promise<RevisionCard[]>;
  getDueQueue(now?: Date): Promise<RevisionCard[]>;
  reviewCard(cardId: string, rating: RevisionRating, reviewedAt?: Date): Promise<RevisionCard>;
}

export class DefaultRevisionService implements RevisionService {
  constructor(
    private readonly revisionRepository: RevisionRepository = createDefaultRevisionRepository(),
    private readonly practiceRepository: PracticeRepository = createDefaultPracticeRepository(),
  ) {}

  private async hasSourceCard(sourceType: RevisionCard['sourceType'], sourceId: string): Promise<boolean> {
    const cards = await this.revisionRepository.listCards();
    return cards.some((entry) => entry.sourceType === sourceType && entry.sourceId === sourceId);
  }

  async seedFromSolvedDoubt(record: DoubtRecord): Promise<RevisionCard> {
    if (await this.hasSourceCard('doubt', record.id)) {
      const cards = await this.revisionRepository.listCards();
      const existing = cards.find((entry) => entry.sourceType === 'doubt' && entry.sourceId === record.id);
      if (existing) {
        return existing;
      }
    }

    const card = buildDoubtCard(record);
    await this.revisionRepository.upsertCards([card]);
    return card;
  }

  async seedFromSolvedDoubts(records: DoubtRecord[]): Promise<RevisionCard[]> {
    const cards = await this.revisionRepository.listCards();
    const existingSources = new Set(cards.filter((entry) => entry.sourceType === 'doubt').map((entry) => entry.sourceId));

    const newCards = records
      .filter((record) => !existingSources.has(record.id))
      .map((record) => buildDoubtCard(record));

    await this.revisionRepository.upsertCards(newCards);
    return newCards;
  }

  async seedFromWrongPracticeAttempts(setId: string): Promise<RevisionCard[]> {
    const [set, attempts] = await Promise.all([
      this.practiceRepository.getSetById(setId),
      this.practiceRepository.listAttemptsBySetId(setId),
    ]);

    if (!set) {
      throw new Error('PRACTICE_SET_NOT_FOUND');
    }

    const existingCards = await this.revisionRepository.listCards();
    const existingSources = new Set(
      existingCards.filter((entry) => entry.sourceType === 'practice_wrong').map((entry) => entry.sourceId),
    );

    const promptByQuestionId = new Map(set.questions.map((question) => [question.id, question.prompt]));
    const topicByQuestionId = new Map(set.questions.map((question) => [question.id, question.topic ?? set.topic]));
    const wrongCards = attempts
      .filter((attempt) => !attempt.isCorrect && !existingSources.has(attempt.id))
      .map((attempt) =>
        buildPracticeWrongCard({
          attempt,
          set,
          prompt: promptByQuestionId.get(attempt.questionId) ?? 'Incorrect practice attempt',
          topic: topicByQuestionId.get(attempt.questionId),
        }),
      );

    await this.revisionRepository.upsertCards(wrongCards);
    return wrongCards;
  }

  async seedFromAllWrongPracticeAttempts(): Promise<RevisionCard[]> {
    const sets = await this.practiceRepository.listSets();
    const all = await Promise.all(sets.map((set) => this.seedFromWrongPracticeAttempts(set.id)));
    return all.flat();
  }

  async getDueQueue(now: Date = new Date()): Promise<RevisionCard[]> {
    const cards = await this.revisionRepository.listCards();
    return cards.filter((card) => isCardDue(card, now)).sort(byDueAsc);
  }

  async reviewCard(cardId: string, rating: RevisionRating, reviewedAt: Date = new Date()): Promise<RevisionCard> {
    const cards = await this.revisionRepository.listCards();
    const target = cards.find((card) => card.id === cardId);
    if (!target) {
      throw new Error('REVISION_CARD_NOT_FOUND');
    }

    const updated = updateCardAfterReview(target, rating, reviewedAt);
    const merged = cards.map((card) => (card.id === updated.id ? updated : card));
    await this.revisionRepository.saveCards(merged);
    return updated;
  }
}

export const createRevisionService = (): RevisionService => new DefaultRevisionService();
