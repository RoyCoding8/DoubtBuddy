import { GeminiAdapter } from './geminiAdapter';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const createAdapter = (): GeminiAdapter =>
  new GeminiAdapter({
    apiKeyResolver: async () => 'test-key',
  });

const runAuthStatusNormalization = (): void => {
  const adapter = createAdapter();

  const status401 = adapter.normalizeError(new Error('API request failed with status 401'));
  assert(status401.code === 'AUTH', '401 should normalize to AUTH');
  assert(status401.retryable === false, '401 should be non-retryable');

  const status403 = adapter.normalizeError(new Error('API request failed with status 403'));
  assert(status403.code === 'AUTH', '403 should normalize to AUTH');
  assert(status403.retryable === false, '403 should be non-retryable');
};

const runRateLimitNormalization = (): void => {
  const adapter = createAdapter();

  const status429 = adapter.normalizeError(new Error('API request failed with status 429'));
  assert(status429.code === 'RATE_LIMIT', '429 should normalize to RATE_LIMIT');
  assert(status429.retryable === true, '429 should be retryable');
};

const runServerNormalization = (): void => {
  const adapter = createAdapter();

  const status500 = adapter.normalizeError(new Error('API request failed with status 500'));
  assert(status500.code === 'SERVER', '500 should normalize to SERVER');
  assert(status500.retryable === true, '500 should be retryable');
};

const runTimeoutNormalization = (): void => {
  const adapter = createAdapter();

  const timeout = adapter.normalizeError(new Error('Request timed out while waiting for provider'));
  assert(timeout.code === 'TIMEOUT', 'timeout errors should normalize to TIMEOUT');
  assert(timeout.retryable === true, 'timeout should be retryable');
};

export const runGeminiAdapterUnitTests = (): void => {
  runAuthStatusNormalization();
  runRateLimitNormalization();
  runServerNormalization();
  runTimeoutNormalization();
};
