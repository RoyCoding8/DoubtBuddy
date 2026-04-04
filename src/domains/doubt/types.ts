import { SubjectId } from '../../types/syllabus';
import { ProviderId } from '../../types/settings';

export interface DoubtRecordV2 {
  id: string;
  subjectId: SubjectId;
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

export interface DoubtVerificationMetadata {
  confidence: 'high' | 'medium' | 'low';
  verificationNote?: string;
  verifierProvider?: ProviderId;
}

export interface StudySessionTurn {
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  sourceModel?: string;
}

export interface StudySession {
  id: string;
  subjectId: SubjectId;
  chapterId: string;
  topic?: string;
  turns: StudySessionTurn[];
  turnLimit: number;
  updatedAt: string;
}
