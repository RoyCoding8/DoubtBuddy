import { runTask20CrashFreeSanityEvidence } from './task20CrashFreeSanity';

const main = async (): Promise<void> => {
  try {
    const report = await runTask20CrashFreeSanityEvidence();
    console.log('[TASK20] crash_free_sanity_evidence', JSON.stringify(report));
    console.log('PASS: task 20 crash-free sanity evidence');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: task 20 crash-free sanity evidence');
    console.error(message);
    process.exit(1);
  }
};

void main();
