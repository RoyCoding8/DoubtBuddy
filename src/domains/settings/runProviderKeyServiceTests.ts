import { runProviderKeyServiceUnitTests } from './providerKeyService.unit';

const main = async (): Promise<void> => {
  try {
    await runProviderKeyServiceUnitTests();
    console.log('PASS: provider key service unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: provider key service unit tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
