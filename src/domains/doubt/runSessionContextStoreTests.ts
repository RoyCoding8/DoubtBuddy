import { runSessionContextStoreUnitTests } from './sessionContextStore.unit';

const main = async (): Promise<void> => {
  try {
    await runSessionContextStoreUnitTests();
    console.log('PASS: session context store unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: session context store unit tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
