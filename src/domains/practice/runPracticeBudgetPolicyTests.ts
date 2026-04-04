import { runPracticeBudgetPolicyUnitTests } from './practiceBudgetPolicy.unit';

const main = async (): Promise<void> => {
  try {
    await runPracticeBudgetPolicyUnitTests();
    console.log('PASS: practice budget policy unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: practice budget policy unit tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
