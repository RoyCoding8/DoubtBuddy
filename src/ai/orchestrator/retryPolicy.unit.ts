import { RetryPolicyExecutor } from './retryPolicy';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const createExecutor = (): RetryPolicyExecutor =>
  new RetryPolicyExecutor({
    sleep: async () => {
      // no-op for deterministic fast tests
    },
    random: () => 0,
  });

const runFirstProviderTimeoutPolicy = async (): Promise<void> => {
  const executor = createExecutor();
  let capturedTimeout: number | null = null;

  try {
    await executor.execute({
      isFallbackProvider: false,
      normalizeError: () => ({
        code: 'AUTH',
        message: 'stop retries',
        retryable: false,
      }),
      onAttempt: (context) => {
        capturedTimeout = context.timeoutMs;
      },
      operation: async () => {
        throw new Error('fail');
      },
    });
  } catch {
    // expected
  }

  assert(capturedTimeout === 12_000, 'first provider attempt timeout should be 12s');
};

const runFallbackProviderTimeoutPolicy = async (): Promise<void> => {
  const executor = createExecutor();
  let capturedTimeout: number | null = null;

  try {
    await executor.execute({
      isFallbackProvider: true,
      normalizeError: () => ({
        code: 'AUTH',
        message: 'stop retries',
        retryable: false,
      }),
      onAttempt: (context) => {
        capturedTimeout = context.timeoutMs;
      },
      operation: async () => {
        throw new Error('fail');
      },
    });
  } catch {
    // expected
  }

  assert(capturedTimeout === 18_000, 'fallback provider attempt timeout should be 18s');
};

const runMaxOneRetryForTimeout = async (): Promise<void> => {
  const executor = createExecutor();
  let invocationCount = 0;

  const result = await executor.execute({
    isFallbackProvider: false,
    normalizeError: () => ({
      code: 'TIMEOUT',
      message: 'timed out',
      retryable: true,
    }),
    operation: async () => {
      invocationCount += 1;
      if (invocationCount === 1) {
        throw new Error('timeout-first-attempt');
      }

      return 'ok';
    },
  });

  assert(result.value === 'ok', 'timeout retry path should return success on second attempt');
  assert(result.attempts === 2, 'timeout retry should attempt exactly twice');
  assert(result.retries === 1, 'timeout retry should perform max one retry');
};

const runMaxOneRetryForServerError = async (): Promise<void> => {
  const executor = createExecutor();
  let invocationCount = 0;

  try {
    await executor.execute({
      isFallbackProvider: false,
      normalizeError: () => ({
        code: 'SERVER',
        message: 'server error',
        retryable: true,
      }),
      operation: async () => {
        invocationCount += 1;
        throw new Error('server');
      },
    });
    throw new Error('expected retry executor to throw');
  } catch {
    assert(invocationCount === 2, 'server errors should retry at most once');
  }
};

const runNoRetryOnAuth = async (): Promise<void> => {
  const executor = createExecutor();
  let invocationCount = 0;

  try {
    await executor.execute({
      isFallbackProvider: false,
      normalizeError: () => ({
        code: 'AUTH',
        message: 'auth failed',
        retryable: false,
      }),
      operation: async () => {
        invocationCount += 1;
        throw new Error('auth');
      },
    });
    throw new Error('expected auth failure');
  } catch {
    assert(invocationCount === 1, 'auth failures must not retry');
  }
};

const runNoRetryOnInvalidRequest = async (): Promise<void> => {
  const executor = createExecutor();
  let invocationCount = 0;

  try {
    await executor.execute({
      isFallbackProvider: false,
      normalizeError: () => ({
        code: 'INVALID_REQUEST',
        message: 'bad request',
        retryable: false,
      }),
      operation: async () => {
        invocationCount += 1;
        throw new Error('invalid');
      },
    });
    throw new Error('expected invalid request failure');
  } catch {
    assert(invocationCount === 1, 'invalid request failures must not retry');
  }
};

export const runRetryPolicyUnitTests = async (): Promise<void> => {
  await runFirstProviderTimeoutPolicy();
  await runFallbackProviderTimeoutPolicy();
  await runMaxOneRetryForTimeout();
  await runMaxOneRetryForServerError();
  await runNoRetryOnAuth();
  await runNoRetryOnInvalidRequest();
};
