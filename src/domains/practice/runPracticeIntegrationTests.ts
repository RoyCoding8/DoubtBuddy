import { runPracticeIntegrationTests } from './practice.integration';

const main = async (): Promise<void> => {
  try {
    await runPracticeIntegrationTests();
    console.log('PASS: practice integration tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: practice integration tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
