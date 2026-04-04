import { runSettingsUiSnapshotUnitTests } from './settingsUiSnapshot.unit';

const main = (): void => {
  try {
    runSettingsUiSnapshotUnitTests();
    console.log('PASS: settings ui snapshot tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: settings ui snapshot tests');
    console.error(message);
    process.exit(1);
  }
};

main();
