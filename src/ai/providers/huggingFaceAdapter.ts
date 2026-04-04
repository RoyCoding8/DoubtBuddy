import { SolveRequest, SolveResponse } from '../contracts/aiContracts';
import { AIProviderError, NormalizedProviderError, normalizeHttpStatusError } from '../contracts/aiErrors';
import { ProviderAdapter } from './providerAdapter';

const HF_CHAT_COMPLETIONS_URL = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

interface HuggingFaceAdapterConfig {
  apiKeyResolver: () => Promise<string | null>;
  model?: string;
  fetchImpl?: typeof fetch;
}

type OpenAiLikeResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    delta?: {
      content?: string;
    };
  }>;
  usage?: {
    total_tokens?: number;
  };
};

const isAbortLikeError = (error: Error): boolean =>
  error.name === 'AbortError' || /aborted|abort|timeout|timed out/i.test(error.message);

const isNetworkLikeError = (error: Error): boolean =>
  /network request failed|failed to fetch|networkerror|load failed|connection/i.test(error.message);

const parseOpenAiLikeText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const first = (payload as OpenAiLikeResponse).choices?.[0];
  const content = first?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  return '';
};

const parseSseDataLines = (rawEvent: string): string[] =>
  rawEvent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

const buildContextBlock = (sessionContext: SolveRequest['sessionContext']): string => {
  if (!sessionContext?.length) {
    return '';
  }

  return sessionContext.map((turn) => `${turn.role}: ${turn.text}`).join('\n');
};

const getResponseMessage = async (response: Response): Promise<string | undefined> => {
  try {
    const payload = (await response.json()) as unknown;

    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const errorRecord = record.error as Record<string, unknown> | undefined;

      if (errorRecord && typeof errorRecord.message === 'string' && errorRecord.message.trim()) {
        return errorRecord.message;
      }

      if (typeof record.message === 'string' && record.message.trim()) {
        return record.message;
      }

      if (typeof record.detail === 'string' && record.detail.trim()) {
        return record.detail;
      }
    }
  } catch {
    // fall through
  }

  try {
    const text = await response.text();
    return text || undefined;
  } catch {
    return undefined;
  }
};

export class HuggingFaceAdapter implements ProviderAdapter {
  id = 'huggingface' as const;

  private readonly apiKeyResolver: () => Promise<string | null>;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HuggingFaceAdapterConfig) {
    this.apiKeyResolver = config.apiKeyResolver;
    this.model = config.model ?? DEFAULT_HF_MODEL;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  normalizeError(error: unknown): NormalizedProviderError {
    if (error instanceof AIProviderError) {
      return {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        status: error.status,
      };
    }

    if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
      return normalizeHttpStatusError(error.status);
    }

    if (error instanceof Error) {
      const statusMatch = error.message.match(/status\s+(\d{3})/i);
      if (statusMatch) {
        return normalizeHttpStatusError(Number(statusMatch[1]), error.message);
      }

      if (isAbortLikeError(error)) {
        return {
          code: 'TIMEOUT',
          message: error.message || 'Request timed out',
          retryable: true,
        };
      }

      if (isNetworkLikeError(error)) {
        return {
          code: 'UNKNOWN',
          message: error.message || 'Network error',
          retryable: true,
        };
      }

      return {
        code: 'UNKNOWN',
        message: error.message,
        retryable: false,
      };
    }

    return {
      code: 'UNKNOWN',
      message: 'Unknown provider error',
      retryable: false,
    };
  }

  async healthCheck(signal: AbortSignal): Promise<{ ok: boolean; latencyMs: number; errorCode?: NormalizedProviderError['code'] }> {
    const startedAt = Date.now();

    try {
      await this.generate(
        {
          requestId: 'healthcheck-huggingface',
          prompt: {
            system: 'You are a health check endpoint.',
            user: 'Reply with exactly: OK',
          },
          mode: 'quick_answer',
          qualityMode: 'fast',
        },
        signal,
      );

      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      const normalized = this.normalizeError(error);
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        errorCode: normalized.code,
      };
    }
  }

  async generate(req: SolveRequest, signal: AbortSignal): Promise<SolveResponse> {
    const startedAt = Date.now();

    try {
      const apiKey = await this.apiKeyResolver();
      if (!apiKey) {
        throw new AIProviderError({
          code: 'AUTH',
          message: 'Missing Hugging Face API key',
          retryable: false,
        });
      }

      const contextBlock = buildContextBlock(req.sessionContext);
      const response = await this.fetchImpl(HF_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: req.prompt.system,
            },
            {
              role: 'user',
              content: `${contextBlock ? `Conversation context:\n${contextBlock}\n\n` : ''}${req.prompt.user}`,
            },
          ],
        }),
        signal,
      });

      if (!response.ok) {
        const message = await getResponseMessage(response);
        throw new AIProviderError(normalizeHttpStatusError(response.status, message));
      }

      const payload = (await response.json()) as OpenAiLikeResponse;
      return {
        text: parseOpenAiLikeText(payload),
        provider: this.id,
        model: this.model,
        latencyMs: Date.now() - startedAt,
        tokenEstimate: payload.usage?.total_tokens,
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      throw new AIProviderError(this.normalizeError(error));
    }
  }

  async *stream(req: SolveRequest, signal: AbortSignal): AsyncGenerator<string> {
    try {
      const apiKey = await this.apiKeyResolver();
      if (!apiKey) {
        throw new AIProviderError({
          code: 'AUTH',
          message: 'Missing Hugging Face API key',
          retryable: false,
        });
      }

      const contextBlock = buildContextBlock(req.sessionContext);
      const response = await this.fetchImpl(HF_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: [
            {
              role: 'system',
              content: req.prompt.system,
            },
            {
              role: 'user',
              content: `${contextBlock ? `Conversation context:\n${contextBlock}\n\n` : ''}${req.prompt.user}`,
            },
          ],
        }),
        signal,
      });

      if (!response.ok || !response.body) {
        const message = response.ok ? 'Stream body unavailable' : await getResponseMessage(response);
        throw new AIProviderError(normalizeHttpStatusError(response.status, message));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const dataLines = parseSseDataLines(event);
          for (const data of dataLines) {
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data) as OpenAiLikeResponse;
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length > 0) {
                yield delta;
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      throw new AIProviderError(this.normalizeError(error));
    }
  }
}
