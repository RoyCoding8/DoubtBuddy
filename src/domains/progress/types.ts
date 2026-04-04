import { SubjectId } from '../../types/syllabus';

export interface WeakTopic {
  subjectId: SubjectId;
  chapterId: string;
  topic?: string;
  errorRate: number;
}

export interface ProgressSnapshot {
  date: string;
  attempts: number;
  correctCount: number;
  avgSolveTimeMs: number;
  streakDays: number;
  weakTopics: WeakTopic[];
}

export interface ProgressSummary {
  attempts: number;
  correctCount: number;
  incorrectCount: number;
  accuracyRate: number;
  avgSolveTimeMs: number;
  streakDays: number;
}

export interface ProgressWeakTopicDrilldownPoint {
  date: string;
  attempts: number;
  correctCount: number;
  incorrectCount: number;
  accuracyRate: number;
  avgSolveTimeMs: number;
}

export interface ProgressWeakTopicDrilldown {
  subjectId: SubjectId;
  chapterId: string;
  topic?: string;
  attempts: number;
  correctCount: number;
  incorrectCount: number;
  accuracyRate: number;
  avgSolveTimeMs: number;
  trend: ProgressWeakTopicDrilldownPoint[];
}

export interface ProgressDashboardMetrics {
  summary: ProgressSummary;
  weakTopics: WeakTopic[];
  latestSnapshot?: ProgressSnapshot;
}
