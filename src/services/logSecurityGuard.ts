const KEY_PATTERN_CANDIDATES: RegExp[] = [
  /AIza[0-9A-Za-z\-_]{16,}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /hf_[A-Za-z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9._\-]{16,}/gi,
];

const SENSITIVE_FIELD_REGEX =
  /((api[_-]?key|apikey|token|secret|authorization|auth)\s*[:=]\s*)(["'`]?)([^\s,"'`}{\]]{6,})(\3)/gi;

export const redactSensitiveText = (value: string): string => {
  if (!value) {
    return value;
  }

  let redacted = value;

  redacted = redacted.replace(SENSITIVE_FIELD_REGEX, (_match, prefix: string) => `${prefix}<redacted>`);

  KEY_PATTERN_CANDIDATES.forEach((pattern) => {
    redacted = redacted.replace(pattern, '<redacted>');
  });

  return redacted;
};

const normalizeUnknownToString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const hasPotentialSecretLeak = (value: unknown): boolean => {
  const serialized = normalizeUnknownToString(value);
  const redacted = redactSensitiveText(serialized);
  return serialized !== redacted;
};

type ConsoleMethodName = 'log' | 'warn' | 'error';

const shouldInstallLogGuard = (): boolean => {
  const processLike = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return processLike?.env?.EXPO_PUBLIC_ENABLE_LOG_GUARD === '1';
};

const formatArgs = (args: unknown[]): unknown[] =>
  args.map((arg) => {
    if (typeof arg === 'string') {
      return redactSensitiveText(arg);
    }

    const serialized = normalizeUnknownToString(arg);
    const redacted = redactSensitiveText(serialized);
    if (serialized === redacted) {
      return arg;
    }

    return redacted;
  });

const installGuardForMethod = (methodName: ConsoleMethodName): void => {
  const original = console[methodName].bind(console);

  console[methodName] = (...args: unknown[]) => {
    const guardedArgs = formatArgs(args);
    original(...guardedArgs);
  };
};

let installed = false;

export const installRuntimeLogRedactionGuard = (): void => {
  if (installed || !shouldInstallLogGuard()) {
    return;
  }

  installGuardForMethod('log');
  installGuardForMethod('warn');
  installGuardForMethod('error');
  installed = true;
};
