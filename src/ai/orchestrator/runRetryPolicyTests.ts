import { runRetryPolicyUnitTests } from './retryPolicy.unit';

const main = async (): Promise<void> => {
  try {
    await runRetryPolicyUnitTests();
    console.log('PASS: retry policy unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: retry policy unit tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
