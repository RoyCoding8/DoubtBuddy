import { ProviderId } from '../../types/settings';
import { DoubtRequest } from '../../types/doubt';

export type InferenceErrorCode =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'SERVER'
  | 'INVALID_REQUEST'
  | 'UNKNOWN';

export interface InferenceEvent {
  requestId: string;
  timestamp: string;
  provider: ProviderId;
  model: string;
  latencyMs: number;
  status: 'success' | 'failed';
  errorCode?: InferenceErrorCode;
  fallbackLevel: number;
  tokenEstimate?: number;
  operationType?: 'practice_generate' | 'practice_grade';
  promptVersion?: string;
  degraded?: boolean;
  budgetDecision?: 'allow' | 'compact' | 'blocked';
  fallbackStatus?: 'none' | 'provider' | 'deterministic';
  estimatedCostUsd?: number;
}

export interface OfflineQueueItem {
  id: string;
  requestType: 'solve_text';
  payload: {
    request: Omit<DoubtRequest, 'imageBase64' | 'imageMimeType'>;
  };
  createdAt: string;
  retryCount: number;
  nextRetryAt: string;
}

export interface ReportedSolutionIssue {
  id: string;
  createdAt: string;
  traceId: string;
  reason: 'incorrect_solution';
  provider: ProviderId;
  model: string;
  confidence: 'high' | 'medium' | 'low';
  questionText: string;
  chapterId: string;
  topic?: string;
}
