import { ProviderId } from '../contracts/aiContracts';
import {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerSnapshot,
  CircuitRequestPermit,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuitBreaker';

export interface ProviderHealthSummary {
  providerId: ProviderId;
  available: boolean;
  state: CircuitBreakerSnapshot['state'];
  failureRate: number;
  sampleSize: number;
  cooldownRemainingMs: number;
  halfOpenProbeRemaining: number;
}

export interface ProviderHealthStoreDependencies {
  now: () => number;
}

export interface ProviderHealthStoreOptions {
  providers: ProviderId[];
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
}

export class ProviderHealthStore {
  private readonly breakers: Record<ProviderId, CircuitBreaker>;

  constructor(options: ProviderHealthStoreOptions, dependencies?: Partial<ProviderHealthStoreDependencies>) {
    this.breakers = options.providers.reduce((acc, providerId) => {
      acc[providerId] = new CircuitBreaker(options.circuitBreakerConfig, {
        now: dependencies?.now,
      });
      return acc;
    }, {} as Record<ProviderId, CircuitBreaker>);
  }

  acquireRequestPermit(providerId: ProviderId): CircuitRequestPermit {
    return this.getBreaker(providerId).acquireRequestPermit();
  }

  recordSuccess(providerId: ProviderId): void {
    this.getBreaker(providerId).recordSuccess();
  }

  recordFailure(providerId: ProviderId): void {
    this.getBreaker(providerId).recordFailure();
  }

  getProviderHealth(providerId: ProviderId): ProviderHealthSummary {
    const snapshot = this.getBreaker(providerId).getSnapshot();
    return {
      providerId,
      available: snapshot.state !== 'open',
      state: snapshot.state,
      failureRate: snapshot.failureRate,
      sampleSize: snapshot.sampleSize,
      cooldownRemainingMs: snapshot.cooldownRemainingMs,
      halfOpenProbeRemaining: snapshot.halfOpenProbeRemaining,
    };
  }

  getHealthSnapshot(): Record<ProviderId, ProviderHealthSummary> {
    return (Object.keys(this.breakers) as ProviderId[]).reduce((acc, providerId) => {
      acc[providerId] = this.getProviderHealth(providerId);
      return acc;
    }, {} as Record<ProviderId, ProviderHealthSummary>);
  }

  private getBreaker(providerId: ProviderId): CircuitBreaker {
    const breaker = this.breakers[providerId];
    if (!breaker) {
      throw new Error(`Circuit breaker not initialized for provider ${providerId}`);
    }

    return breaker;
  }
}

export const createDefaultProviderHealthStore = (
  providers: ProviderId[],
  dependencies?: Partial<ProviderHealthStoreDependencies>,
): ProviderHealthStore =>
  new ProviderHealthStore(
    {
      providers,
      circuitBreakerConfig: DEFAULT_CIRCUIT_BREAKER_CONFIG,
    },
    dependencies,
  );
