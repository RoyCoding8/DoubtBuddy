import { runTask20IntegrationLoadEvidence } from './task20IntegrationLoadEvidence';

const main = async (): Promise<void> => {
  try {
    const report = await runTask20IntegrationLoadEvidence(500);
    console.log('[TASK20] integration_load_evidence', JSON.stringify(report));
    console.log('PASS: task 20 integration load evidence');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: task 20 integration load evidence');
    console.error(message);
    process.exit(1);
  }
};

void main();
