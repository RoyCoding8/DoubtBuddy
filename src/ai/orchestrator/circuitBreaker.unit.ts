import { CircuitBreaker } from './circuitBreaker';
import { ProviderHealthStore } from './providerHealthStore';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const createFakeClock = (initialMs = 0): { now: () => number; advanceBy: (ms: number) => void } => {
  let currentMs = initialMs;
  return {
    now: () => currentMs,
    advanceBy: (ms: number) => {
      currentMs += ms;
    },
  };
};

const openCircuitWithThresholdPattern = (breaker: CircuitBreaker): void => {
  for (let i = 0; i < 29; i += 1) {
    breaker.recordSuccess();
  }

  for (let i = 0; i < 11; i += 1) {
    breaker.recordFailure();
  }
};

const runClosedToOpenTransition = (): void => {
  const clock = createFakeClock();
  const breaker = new CircuitBreaker(undefined, { now: clock.now });

  openCircuitWithThresholdPattern(breaker);
  const snapshot = breaker.getSnapshot();

  assert(snapshot.sampleSize === 40, 'rolling window should track last 40 calls');
  assert(snapshot.failureCount === 11, 'failure count should include 11 failures');
  assert(snapshot.failureRate > 0.25, 'failure rate should be above 25% threshold');
  assert(snapshot.state === 'open', 'circuit should open when failures exceed threshold');

  const permit = breaker.acquireRequestPermit();
  assert(permit.allowed === false, 'open circuit should deny request permits');
  assert(permit.reason === 'cooldown_active', 'open circuit deny reason should be cooldown_active');
};

const runOpenToHalfOpenTransition = (): void => {
  const clock = createFakeClock();
  const breaker = new CircuitBreaker(undefined, { now: clock.now });
  openCircuitWithThresholdPattern(breaker);

  clock.advanceBy(60_000);
  const permit = breaker.acquireRequestPermit();

  assert(permit.allowed === true, 'half-open should allow probe after cooldown');
  assert(permit.state === 'half_open', 'state should transition to half_open after cooldown');
};

const runHalfOpenToClosedTransition = (): void => {
  const clock = createFakeClock();
  const breaker = new CircuitBreaker(undefined, { now: clock.now });
  openCircuitWithThresholdPattern(breaker);
  clock.advanceBy(60_000);

  breaker.acquireRequestPermit();
  breaker.recordSuccess();

  breaker.acquireRequestPermit();
  breaker.recordSuccess();

  breaker.acquireRequestPermit();
  breaker.recordSuccess();

  const snapshot = breaker.getSnapshot();
  assert(snapshot.state === 'closed', 'circuit should close after 3 half-open probe successes');
  assert(snapshot.sampleSize === 0, 'closing after recovery should reset failure window');
};

const runHalfOpenProbeLimitValidation = (): void => {
  const clock = createFakeClock();
  const breaker = new CircuitBreaker(undefined, { now: clock.now });
  openCircuitWithThresholdPattern(breaker);
  clock.advanceBy(60_000);

  const first = breaker.acquireRequestPermit();
  const second = breaker.acquireRequestPermit();
  const third = breaker.acquireRequestPermit();
  const fourth = breaker.acquireRequestPermit();

  assert(first.allowed === true && second.allowed === true && third.allowed === true, 'first 3 half-open probes should be allowed');
  assert(fourth.allowed === false, 'probe requests beyond configured limit should be denied');
  assert(fourth.reason === 'half_open_probe_limit', 'denied half-open probe should expose probe limit reason');
};

const runProviderHealthStoreValidation = (): void => {
  const clock = createFakeClock();
  const store = new ProviderHealthStore(
    {
      providers: ['gemini', 'openrouter'],
    },
    {
      now: clock.now,
    },
  );

  for (let i = 0; i < 29; i += 1) {
    store.recordSuccess('gemini');
  }

  for (let i = 0; i < 11; i += 1) {
    store.recordFailure('gemini');
  }

  const geminiHealth = store.getProviderHealth('gemini');
  const openRouterHealth = store.getProviderHealth('openrouter');

  assert(geminiHealth.state === 'open', 'provider health store should expose open state from breaker');
  assert(geminiHealth.available === false, 'open provider should be marked unavailable');
  assert(geminiHealth.sampleSize === 40, 'provider health sample size should mirror breaker rolling window');
  assert(openRouterHealth.state === 'closed', 'untouched provider should remain closed/healthy');

  clock.advanceBy(60_000);
  const permit = store.acquireRequestPermit('gemini');
  assert(permit.allowed === true && permit.state === 'half_open', 'provider permit should recover to half_open after cooldown');
};

export const runCircuitBreakerUnitTests = (): void => {
  runClosedToOpenTransition();
  runOpenToHalfOpenTransition();
  runHalfOpenToClosedTransition();
  runHalfOpenProbeLimitValidation();
  runProviderHealthStoreValidation();
};
