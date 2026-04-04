import { runGeminiAdapterUnitTests } from './geminiAdapter.unit';

const main = (): void => {
  try {
    runGeminiAdapterUnitTests();
    console.log('PASS: gemini adapter unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: gemini adapter unit tests');
    console.error(message);
    process.exit(1);
  }
};

main();
