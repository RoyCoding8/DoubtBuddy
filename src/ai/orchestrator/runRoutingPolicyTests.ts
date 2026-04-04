import { runRoutingPolicyUnitTests } from './routingPolicy.unit';

const main = async (): Promise<void> => {
  try {
    await runRoutingPolicyUnitTests();
    console.log('PASS: routing policy and fallback chain tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: routing policy and fallback chain tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
