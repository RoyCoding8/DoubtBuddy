import { runProgressServiceUnitTests } from './progressService.unit';

const main = async (): Promise<void> => {
  try {
    await runProgressServiceUnitTests();
    console.log('PASS: progress service unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: progress service unit tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
