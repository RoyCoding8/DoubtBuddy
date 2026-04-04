export type NormalizedErrorCode =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'SERVER'
  | 'INVALID_REQUEST'
  | 'UNKNOWN';

export interface NormalizedProviderError {
  code: NormalizedErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
}

export class AIProviderError extends Error {
  code: NormalizedErrorCode;
  retryable: boolean;
  status?: number;

  constructor(error: NormalizedProviderError) {
    super(error.message);
    this.name = 'AIProviderError';
    this.code = error.code;
    this.retryable = error.retryable;
    this.status = error.status;
  }
}

export const normalizeHttpStatusError = (status: number, message?: string): NormalizedProviderError => {
  if (status === 401 || status === 403) {
    return {
      code: 'AUTH',
      message: message ?? `Authentication failed (${status})`,
      retryable: false,
      status,
    };
  }

  if (status === 429) {
    return {
      code: 'RATE_LIMIT',
      message: message ?? 'Rate limited by provider',
      retryable: true,
      status,
    };
  }

  if (status === 408 || status === 504) {
    return {
      code: 'TIMEOUT',
      message: message ?? `Request timed out (${status})`,
      retryable: true,
      status,
    };
  }

  if (status >= 500) {
    return {
      code: 'SERVER',
      message: message ?? `Provider server error (${status})`,
      retryable: true,
      status,
    };
  }

  if (status >= 400) {
    return {
      code: 'INVALID_REQUEST',
      message: message ?? `Invalid provider request (${status})`,
      retryable: false,
      status,
    };
  }

  return {
    code: 'UNKNOWN',
    message: message ?? 'Unknown provider error',
    retryable: false,
    status,
  };
};
