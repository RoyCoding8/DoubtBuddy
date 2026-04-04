import { runCircuitBreakerUnitTests } from './circuitBreaker.unit';

const main = (): void => {
  try {
    runCircuitBreakerUnitTests();
    console.log('PASS: circuit breaker and provider health store unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: circuit breaker and provider health store unit tests');
    console.error(message);
    process.exit(1);
  }
};

main();
