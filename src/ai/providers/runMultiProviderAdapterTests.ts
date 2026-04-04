import { runMultiProviderAdapterTests } from './multiProviderAdapters.unit';

const main = async (): Promise<void> => {
  try {
    await runMultiProviderAdapterTests();
    console.log('PASS: multi-provider adapter contract and integration tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: multi-provider adapter contract and integration tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
