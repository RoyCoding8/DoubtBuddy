import { runTask20RuntimeGuardEvidence } from './task20RuntimeGuardEvidence';

const main = async (): Promise<void> => {
  try {
    const report = await runTask20RuntimeGuardEvidence();
    console.log('[TASK20] runtime_guard_evidence', JSON.stringify(report));
    console.log('PASS: task 20 runtime guard evidence');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: task 20 runtime guard evidence');
    console.error(message);
    process.exit(1);
  }
};

void main();
