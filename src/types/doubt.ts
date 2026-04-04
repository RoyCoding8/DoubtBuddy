import { SubjectId } from './syllabus';
import { ProviderId } from './settings';

export type SolveMode = 'step_by_step' | 'hint_only' | 'explain_concept' | 'quick_answer';
export type DoubtInputType = 'text' | 'image';

export interface DoubtRequest {
  subjectId: SubjectId;
  chapterId: string;
  chapterName: string;
  topic?: string;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  mode: SolveMode;
  inputType: DoubtInputType;
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface DoubtRecord {
  id: string;
  subjectId: SubjectId;
  subjectName: string;
  chapterId: string;
  chapterName: string;
  topic?: string;
  questionText: string;
  responseMarkdown: string;
  createdAt: string;
  bookmarked: boolean;
  confidence: 'high' | 'medium' | 'low';
  verificationNote?: string;
  inference: {
    requestId: string;
    provider: ProviderId;
    model: string;
    fallbackLevel: number;
    retries: number;
    latencyMs: number;
    status: 'success' | 'fallback' | 'failed';
    errorCode?: string;
  };
  estimatedBytes: number;
}

export interface StreamChunk {
  text: string;
  done: boolean;
  sourceModel: string;
  replace?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  verificationNote?: string;
  inference?: DoubtRecord['inference'];
}

export interface SolveModeOption {
  id: SolveMode;
  label: string;
  emoji: string;
}
