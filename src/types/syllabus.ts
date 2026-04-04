export type SubjectId = 'physics' | 'chemistry' | 'math';

export interface SyllabusChapter {
  id: string;
  name: string;
  topics: readonly string[];
}

export interface SyllabusSubject {
  id: SubjectId;
  name: string;
  shortLabel: string;
  description: string;
  chapters: readonly SyllabusChapter[];
}
