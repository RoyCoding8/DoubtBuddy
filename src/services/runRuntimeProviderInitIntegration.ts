import { runRuntimeProviderInitIntegration } from './runtimeProviderInit.integration';

const main = async (): Promise<void> => {
  try {
    await runRuntimeProviderInitIntegration();
    console.log('PASS: runtime provider initialization integration');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: runtime provider initialization integration');
    console.error(message);
    process.exit(1);
  }
};

void main();
