import { AppSettingsV2, ProviderId, QualityMode } from '../../types/settings';
import { NormalizedErrorCode } from './aiErrors';

export type { ProviderId, QualityMode };
export type { NormalizedErrorCode };

export interface SolveRequest {
  requestId: string;
  prompt: {
    system: string;
    user: string;
  };
  mode: 'step_by_step' | 'hint_only' | 'explain_concept' | 'quick_answer';
  image?: {
    base64: string;
    mimeType: string;
  };
  sessionContext?: Array<{
    role: 'user' | 'assistant';
    text: string;
  }>;
  qualityMode: QualityMode;
}

export interface SolveResponse {
  text: string;
  provider: ProviderId;
  model: string;
  latencyMs: number;
  tokenEstimate?: number;
  orchestration?: {
    fallbackLevel: number;
    retries: number;
    attempts: number;
    timeoutMs: number;
  };
  verification?: {
    confidence: 'high' | 'medium' | 'low';
    note?: string;
    verifierProvider?: ProviderId;
  };
}

export interface ProviderAdapter {
  id: ProviderId;
  generate(req: SolveRequest, signal: AbortSignal): Promise<SolveResponse>;
  stream?(req: SolveRequest, signal: AbortSignal): AsyncGenerator<string>;
  healthCheck(
    signal: AbortSignal,
  ): Promise<{ ok: boolean; latencyMs: number; errorCode?: NormalizedErrorCode }>;
  normalizeError(error: unknown): {
    code: NormalizedErrorCode;
    message: string;
    retryable: boolean;
  };
}

export interface RoutingPolicyEngine {
  selectProviders(input: {
    settings: AppSettingsV2;
    qualityMode: QualityMode;
    health: Record<ProviderId, { available: boolean; failureRate: number }>;
  }): ProviderId[];
}

export interface InferenceOrchestrator {
  solve(req: SolveRequest): Promise<SolveResponse>;
  stream(req: SolveRequest): AsyncGenerator<{ chunk: string; provider: ProviderId; replace?: boolean }>;
}
