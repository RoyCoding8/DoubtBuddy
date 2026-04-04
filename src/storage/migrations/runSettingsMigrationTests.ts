import { runSettingsMigrationUnitTests } from './migrateV1toV2.unit';

const main = async (): Promise<void> => {
  try {
    await runSettingsMigrationUnitTests();
    console.log('PASS: settings migration unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: settings migration unit tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
