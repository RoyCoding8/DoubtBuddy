import { SubjectId } from '../../types/syllabus';

export interface RevisionCard {
  id: string;
  sourceType: 'doubt' | 'practice_wrong';
  sourceId: string;
  subjectId: SubjectId;
  chapterId: string;
  topic?: string;
  front: string;
  back: string;
  dueAt: string;
  intervalDays: 1 | 3 | 7 | 14;
  easeScore: number;
  lastReviewedAt?: string;
}
