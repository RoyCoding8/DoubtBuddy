import { runOfflineQueueIntegrationTests } from './offlineQueue.integration';

const main = async (): Promise<void> => {
  try {
    await runOfflineQueueIntegrationTests();
    console.log('PASS: offline queue integration tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: offline queue integration tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
