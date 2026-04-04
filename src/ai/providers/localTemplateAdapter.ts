import { ProviderAdapter } from './providerAdapter';
import { SolveRequest, SolveResponse } from '../contracts/aiContracts';
import { NormalizedProviderError } from '../contracts/aiErrors';
import { buildGracefulFallback } from '../orchestrator/gracefulFallback';

const LOCAL_TEMPLATE_MODEL = 'local-template:v1';

export class LocalTemplateAdapter implements ProviderAdapter {
  id = 'local_template' as const;

  normalizeError(error: unknown): NormalizedProviderError {
    if (error instanceof Error) {
      return {
        code: 'UNKNOWN',
        message: error.message,
        retryable: false,
      };
    }

    return {
      code: 'UNKNOWN',
      message: 'Local template adapter error',
      retryable: false,
    };
  }

  async healthCheck(_signal: AbortSignal): Promise<{ ok: boolean; latencyMs: number }> {
    return {
      ok: true,
      latencyMs: 1,
    };
  }

  async generate(req: SolveRequest, _signal: AbortSignal): Promise<SolveResponse> {
    const startedAt = Date.now();
    const fallback = buildGracefulFallback(req);

    return {
      text: fallback.text,
      provider: this.id,
      model: LOCAL_TEMPLATE_MODEL,
      latencyMs: Date.now() - startedAt,
      verification: {
        confidence: 'low',
        note: fallback.verificationNote,
      },
    };
  }
}
