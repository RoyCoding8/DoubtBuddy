import { runTelemetryIntegrationTests } from './telemetry.integration';

const main = async (): Promise<void> => {
  try {
    await runTelemetryIntegrationTests();
    console.log('PASS: telemetry integration tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: telemetry integration tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
