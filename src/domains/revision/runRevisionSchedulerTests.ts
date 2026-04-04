import { runRevisionSchedulerUnitTests } from './revisionScheduler.unit';

const main = async (): Promise<void> => {
  try {
    await runRevisionSchedulerUnitTests();
    console.log('PASS: revision scheduler unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: revision scheduler unit tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
