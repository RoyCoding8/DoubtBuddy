import { ProviderAdapter } from './providerAdapter';
import { SolveRequest, SolveResponse } from '../contracts/aiContracts';
import { AIProviderError, NormalizedProviderError, normalizeHttpStatusError } from '../contracts/aiErrors';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

interface GeminiAdapterConfig {
  apiKeyResolver: () => Promise<string | null>;
  model?: string;
  fetchImpl?: typeof fetch;
}

const extractGeminiText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    .candidates;

  if (!candidates || candidates.length === 0) {
    return '';
  }

  const parts = candidates[0]?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
};

const buildGeminiUrl = (model: string, apiKey: string): string =>
  `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

const buildGeminiStreamUrl = (model: string, apiKey: string): string =>
  `${GEMINI_BASE_URL}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

const parseSseDataLines = (rawEvent: string): string[] =>
  rawEvent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

const buildContextBlock = (sessionContext: SolveRequest['sessionContext']): string => {
  if (!sessionContext || sessionContext.length === 0) {
    return '';
  }

  const contextText = sessionContext.map((turn) => `${turn.role}: ${turn.text}`).join('\n');
  return `Conversation context:\n${contextText}\n\n`;
};

const buildRequestBody = (args: {
  systemPrompt: string;
  userPrompt: string;
  sessionContext?: SolveRequest['sessionContext'];
  imageBase64?: string;
  imageMimeType?: string;
  maxOutputTokens: number;
}) => ({
  generationConfig: {
    temperature: 0.15,
    topP: 0.9,
    topK: 32,
    maxOutputTokens: args.maxOutputTokens,
  },
  contents: [
    {
      role: 'user',
      parts: [
        {
          text: `${args.systemPrompt}\n\n${buildContextBlock(args.sessionContext)}${args.userPrompt}`,
        },
        ...(args.imageBase64
          ? [
              {
                inlineData: {
                  mimeType: args.imageMimeType || 'image/jpeg',
                  data: args.imageBase64,
                },
              },
            ]
          : []),
      ],
    },
  ],
});

const getResponseMessage = async (response: Response): Promise<string | undefined> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    if (payload?.error?.message) {
      return payload.error.message;
    }
  } catch {
    // fall through to text path
  }

  try {
    const text = await response.text();
    return text || undefined;
  } catch {
    return undefined;
  }
};

const isAbortLikeError = (error: Error): boolean =>
  error.name === 'AbortError' || /aborted|abort|timeout|timed out/i.test(error.message);

const isNetworkLikeError = (error: Error): boolean =>
  /network request failed|failed to fetch|networkerror|load failed|connection/i.test(error.message);

export class GeminiAdapter implements ProviderAdapter {
  id = 'gemini' as const;

  private readonly apiKeyResolver: () => Promise<string | null>;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GeminiAdapterConfig) {
    this.apiKeyResolver = config.apiKeyResolver;
    this.model = config.model ?? DEFAULT_GEMINI_MODEL;
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
          requestId: 'healthcheck',
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
          message: 'Missing Gemini API key',
          retryable: false,
        });
      }

      const response = await this.fetchImpl(buildGeminiUrl(this.model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildRequestBody({
            systemPrompt: req.prompt.system,
            userPrompt: req.prompt.user,
            sessionContext: req.sessionContext,
            imageBase64: req.image?.base64,
            imageMimeType: req.image?.mimeType,
            maxOutputTokens: 1400,
          }),
        ),
        signal,
      });

      if (!response.ok) {
        const message = await getResponseMessage(response);
        throw new AIProviderError(normalizeHttpStatusError(response.status, message));
      }

      const payload = (await response.json()) as unknown;
      return {
        text: extractGeminiText(payload),
        provider: this.id,
        model: this.model,
        latencyMs: Date.now() - startedAt,
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
          message: 'Missing Gemini API key',
          retryable: false,
        });
      }

      const response = await this.fetchImpl(buildGeminiStreamUrl(this.model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildRequestBody({
            systemPrompt: req.prompt.system,
            userPrompt: req.prompt.user,
            sessionContext: req.sessionContext,
            imageBase64: req.image?.base64,
            imageMimeType: req.image?.mimeType,
            maxOutputTokens: 1400,
          }),
        ),
        signal,
      });

      if (!response.ok || !response.body) {
        const message = response.ok ? 'Stream body unavailable' : await getResponseMessage(response);
        throw new AIProviderError(normalizeHttpStatusError(response.status, message));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let emittedText = '';

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
              const parsed = JSON.parse(data) as unknown;
              const text = extractGeminiText(parsed);
              if (!text) {
                continue;
              }

              let delta = text;
              if (text.startsWith(emittedText)) {
                delta = text.slice(emittedText.length);
              }

              if (!delta) {
                continue;
              }

              emittedText += delta;
              yield delta;
            } catch {
              // Ignore malformed SSE chunks and continue parsing.
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
