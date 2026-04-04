export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  rollingWindowSize: number;
  failureRateThreshold: number;
  cooldownMs: number;
  halfOpenMaxProbes: number;
  halfOpenSuccessesToClose: number;
}

export interface CircuitBreakerSnapshot {
  state: CircuitState;
  sampleSize: number;
  failureCount: number;
  failureRate: number;
  cooldownRemainingMs: number;
  halfOpenProbeAttempts: number;
  halfOpenProbeRemaining: number;
  halfOpenConsecutiveSuccesses: number;
}

export interface CircuitRequestPermit {
  allowed: boolean;
  state: CircuitState;
  reason?: 'cooldown_active' | 'half_open_probe_limit';
  cooldownRemainingMs?: number;
}

interface CircuitBreakerDependencies {
  now: () => number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  rollingWindowSize: 40,
  failureRateThreshold: 0.25,
  cooldownMs: 60_000,
  halfOpenMaxProbes: 3,
  halfOpenSuccessesToClose: 3,
};

export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly now: () => number;

  private state: CircuitState = 'closed';
  private openedAtMs: number | null = null;
  private failureWindow: boolean[] = [];
  private halfOpenProbeAttempts = 0;
  private halfOpenConsecutiveSuccesses = 0;

  constructor(
    config?: Partial<CircuitBreakerConfig>,
    dependencies?: Partial<CircuitBreakerDependencies>,
  ) {
    this.config = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...config,
    };
    this.now = dependencies?.now ?? Date.now;
  }

  acquireRequestPermit(): CircuitRequestPermit {
    const nowMs = this.now();
    this.syncStateByTime(nowMs);

    if (this.state === 'open') {
      const cooldownRemainingMs = this.getCooldownRemainingMs(nowMs);
      return {
        allowed: false,
        state: this.state,
        reason: 'cooldown_active',
        cooldownRemainingMs,
      };
    }

    if (this.state === 'half_open') {
      if (this.halfOpenProbeAttempts >= this.config.halfOpenMaxProbes) {
        return {
          allowed: false,
          state: this.state,
          reason: 'half_open_probe_limit',
        };
      }

      this.halfOpenProbeAttempts += 1;
      return {
        allowed: true,
        state: this.state,
      };
    }

    return {
      allowed: true,
      state: this.state,
    };
  }

  recordSuccess(): void {
    const nowMs = this.now();
    this.syncStateByTime(nowMs);

    if (this.state === 'half_open') {
      this.halfOpenConsecutiveSuccesses += 1;
      if (this.halfOpenConsecutiveSuccesses >= this.config.halfOpenSuccessesToClose) {
        this.closeCircuit(true);
      }
      return;
    }

    if (this.state === 'closed') {
      this.pushFailureOutcome(false);
    }
  }

  recordFailure(): void {
    const nowMs = this.now();
    this.syncStateByTime(nowMs);

    if (this.state === 'half_open') {
      this.openCircuit(nowMs);
      return;
    }

    if (this.state === 'closed') {
      this.pushFailureOutcome(true);
      this.evaluateOpenCondition(nowMs);
    }
  }

  getSnapshot(): CircuitBreakerSnapshot {
    const nowMs = this.now();
    this.syncStateByTime(nowMs);

    const failureCount = this.failureWindow.reduce((acc, isFailure) => acc + (isFailure ? 1 : 0), 0);
    const sampleSize = this.failureWindow.length;
    const failureRate = sampleSize === 0 ? 0 : failureCount / sampleSize;

    return {
      state: this.state,
      sampleSize,
      failureCount,
      failureRate,
      cooldownRemainingMs: this.state === 'open' ? this.getCooldownRemainingMs(nowMs) : 0,
      halfOpenProbeAttempts: this.state === 'half_open' ? this.halfOpenProbeAttempts : 0,
      halfOpenProbeRemaining:
        this.state === 'half_open'
          ? Math.max(0, this.config.halfOpenMaxProbes - this.halfOpenProbeAttempts)
          : this.config.halfOpenMaxProbes,
      halfOpenConsecutiveSuccesses: this.state === 'half_open' ? this.halfOpenConsecutiveSuccesses : 0,
    };
  }

  private pushFailureOutcome(isFailure: boolean): void {
    this.failureWindow.push(isFailure);
    if (this.failureWindow.length > this.config.rollingWindowSize) {
      this.failureWindow.shift();
    }
  }

  private evaluateOpenCondition(nowMs: number): void {
    if (this.failureWindow.length < this.config.rollingWindowSize) {
      return;
    }

    const failureCount = this.failureWindow.reduce((acc, isFailure) => acc + (isFailure ? 1 : 0), 0);
    const failureRate = failureCount / this.failureWindow.length;

    if (failureRate > this.config.failureRateThreshold) {
      this.openCircuit(nowMs);
    }
  }

  private openCircuit(nowMs: number): void {
    this.state = 'open';
    this.openedAtMs = nowMs;
    this.halfOpenProbeAttempts = 0;
    this.halfOpenConsecutiveSuccesses = 0;
  }

  private closeCircuit(resetFailureWindow: boolean): void {
    this.state = 'closed';
    this.openedAtMs = null;
    this.halfOpenProbeAttempts = 0;
    this.halfOpenConsecutiveSuccesses = 0;

    if (resetFailureWindow) {
      this.failureWindow = [];
    }
  }

  private transitionToHalfOpen(): void {
    this.state = 'half_open';
    this.openedAtMs = null;
    this.halfOpenProbeAttempts = 0;
    this.halfOpenConsecutiveSuccesses = 0;
  }

  private syncStateByTime(nowMs: number): void {
    if (this.state !== 'open' || this.openedAtMs === null) {
      return;
    }

    const elapsed = nowMs - this.openedAtMs;
    if (elapsed >= this.config.cooldownMs) {
      this.transitionToHalfOpen();
    }
  }

  private getCooldownRemainingMs(nowMs: number): number {
    if (this.openedAtMs === null) {
      return 0;
    }

    const elapsed = nowMs - this.openedAtMs;
    return Math.max(0, this.config.cooldownMs - elapsed);
  }
}
