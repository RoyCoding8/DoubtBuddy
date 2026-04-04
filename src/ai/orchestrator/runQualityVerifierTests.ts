import { runQualityVerifierTests } from './qualityVerifier.unit';

const main = async (): Promise<void> => {
  try {
    await runQualityVerifierTests();
    console.log('PASS: quality verifier confidence and integration tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: quality verifier confidence and integration tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
