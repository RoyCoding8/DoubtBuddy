import { AIProviderError, NormalizedProviderError } from '../contracts/aiErrors';

export const FIRST_PROVIDER_TIMEOUT_MS = 12_000;
export const FALLBACK_PROVIDER_TIMEOUT_MS = 18_000;
export const MAX_RETRIES_PER_PROVIDER = 1;

const BACKOFF_MIN_MS = 400;
const BACKOFF_MAX_MS = 1_200;

export interface RetryAttemptContext {
  attempt: number;
  timeoutMs: number;
  isFallbackProvider: boolean;
}

export interface RetryExecutionResult<T> {
  value: T;
  attempts: number;
  retries: number;
  timeoutMs: number;
}

export interface ExecuteWithRetryArgs<T> {
  operation: (input: { signal: AbortSignal; attempt: number }) => Promise<T>;
  normalizeError: (error: unknown) => NormalizedProviderError;
  isFallbackProvider: boolean;
  signal?: AbortSignal;
  maxRetries?: number;
  onAttempt?: (context: RetryAttemptContext) => void;
}

interface RetryPolicyDependencies {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const toProviderError = (error: NormalizedProviderError): AIProviderError => new AIProviderError(error);

const composeAbortSignal = (externalSignal: AbortSignal | undefined, timeoutSignal: AbortSignal): AbortSignal => {
  if (!externalSignal) {
    return timeoutSignal;
  }

  if (externalSignal.aborted) {
    return externalSignal;
  }

  const combinedController = new AbortController();

  const abortCombined = (): void => {
    if (!combinedController.signal.aborted) {
      combinedController.abort();
    }
  };

  const onExternalAbort = (): void => {
    abortCombined();
  };

  const onTimeoutAbort = (): void => {
    abortCombined();
  };

  externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  timeoutSignal.addEventListener('abort', onTimeoutAbort, { once: true });

  combinedController.signal.addEventListener(
    'abort',
    () => {
      externalSignal.removeEventListener('abort', onExternalAbort);
      timeoutSignal.removeEventListener('abort', onTimeoutAbort);
    },
    { once: true },
  );

  return combinedController.signal;
};

export const getProviderAttemptTimeoutMs = (isFallbackProvider: boolean): number =>
  isFallbackProvider ? FALLBACK_PROVIDER_TIMEOUT_MS : FIRST_PROVIDER_TIMEOUT_MS;

export const shouldRetryByPolicy = (error: NormalizedProviderError): boolean => {
  if (error.code === 'AUTH' || error.code === 'INVALID_REQUEST') {
    return false;
  }

  if (error.code === 'TIMEOUT' || error.code === 'SERVER') {
    return true;
  }

  if (error.code === 'UNKNOWN' && error.retryable) {
    return true;
  }

  return false;
};

export class RetryPolicyExecutor {
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly randomFn: () => number;

  constructor(dependencies?: Partial<RetryPolicyDependencies>) {
    this.sleepFn = dependencies?.sleep ?? sleep;
    this.randomFn = dependencies?.random ?? Math.random;
  }

  async execute<T>(args: ExecuteWithRetryArgs<T>): Promise<RetryExecutionResult<T>> {
    const maxRetries = args.maxRetries ?? MAX_RETRIES_PER_PROVIDER;
    const timeoutMs = getProviderAttemptTimeoutMs(args.isFallbackProvider);

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (args.signal?.aborted) {
        throw toProviderError({
          code: 'TIMEOUT',
          message: 'Inference cancelled before attempt execution',
          retryable: false,
        });
      }

      const timeoutController = new AbortController();
      const timeoutHandle = setTimeout(() => {
        timeoutController.abort();
      }, timeoutMs);

      const attemptSignal = composeAbortSignal(args.signal, timeoutController.signal);
      args.onAttempt?.({
        attempt,
        timeoutMs,
        isFallbackProvider: args.isFallbackProvider,
      });

      try {
        const value = await args.operation({ signal: attemptSignal, attempt });
        clearTimeout(timeoutHandle);
        return {
          value,
          attempts: attempt + 1,
          retries: attempt,
          timeoutMs,
        };
      } catch (error) {
        clearTimeout(timeoutHandle);

        const externalAbort = Boolean(args.signal?.aborted);
        const timeoutAbort = timeoutController.signal.aborted && !externalAbort;

        const normalized: NormalizedProviderError = timeoutAbort
          ? {
              code: 'TIMEOUT',
              message: 'Provider attempt timed out',
              retryable: true,
            }
          : args.normalizeError(error);

        const canRetry =
          !externalAbort &&
          attempt < maxRetries &&
          shouldRetryByPolicy(normalized);

        if (!canRetry) {
          throw toProviderError(normalized);
        }

        const backoffMs = this.calculateBackoffMs(attempt);
        await this.sleepFn(backoffMs);
      }
    }

    throw toProviderError({
      code: 'UNKNOWN',
      message: 'Retry policy exhausted unexpectedly',
      retryable: false,
    });
  }

  private calculateBackoffMs(attempt: number): number {
    const exponentialBase = BACKOFF_MIN_MS * 2 ** attempt;
    const jitter = Math.floor(this.randomFn() * exponentialBase);
    const candidate = exponentialBase + jitter;
    return Math.min(BACKOFF_MAX_MS, Math.max(BACKOFF_MIN_MS, candidate));
  }
}

export const retryPolicyExecutor = new RetryPolicyExecutor();
