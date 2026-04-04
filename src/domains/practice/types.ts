import { SubjectId } from '../../types/syllabus';

export interface PracticeQuestionRubricAnchor {
  expectedFinalAnswer?: string;
  keyPoints: string[];
  unitExpectations?: string[];
  commonPitfalls?: string[];
}

export interface PracticeQuestion {
  id: string;
  prompt: string;
  topic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  options?: string[];
  answerKey?: string;
  rubricAnchor?: PracticeQuestionRubricAnchor;
}

export interface PracticeSet {
  id: string;
  subjectId: SubjectId;
  chapterId: string;
  topic?: string;
  questionCount: 5 | 10 | 20;
  degraded: boolean;
  generatedAt: string;
  questions: PracticeQuestion[];
}

export interface PracticeAttempt {
  id: string;
  setId: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  explanation: string;
  misconceptionTag?: string;
  solvedAt: string;
  solveTimeMs: number;
  score?: number;
  reasoningQuality?: string;
  finalAnswerCheck?: 'pass' | 'partial' | 'fail';
  improvementHints?: string[];
  nextStepCue?: string;
  confidence?: 'high' | 'medium' | 'low';
  verificationNote?: string;
  degraded?: boolean;
  promptVersion?: string;
}

export interface PracticeEvaluation {
  isCorrect: boolean;
  score: number;
  reasoningQuality: string;
  finalAnswerCheck: 'pass' | 'partial' | 'fail';
  misconceptionTag?: string;
  explanation: string;
  improvementHints: string[];
  nextStepCue: string;
  confidence: 'high' | 'medium' | 'low';
  verificationNote?: string;
  degraded: boolean;
}

export interface PracticeSetInput {
  subjectId: SubjectId;
  chapterId: string;
  topic?: string;
  questionCount: 5 | 10 | 20;
  difficultyMix?: PracticeDifficultyMix;
}

export interface PracticeDifficultyMix {
  easy: number;
  medium: number;
  hard: number;
}

export interface PracticeSubmission {
  questionId: string;
  userAnswer: string;
  solveTimeMs?: number;
}

export interface PracticeResultWeakArea {
  subjectId: SubjectId;
  chapterId: string;
  topic?: string;
  errorRate: number;
  tag: string;
}

export interface PracticeSubmissionResult {
  set: PracticeSet;
  attempts: PracticeAttempt[];
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  weakAreas: PracticeResultWeakArea[];
}
