import { runPracticeLlmParserUnitTests } from './practiceLlmParser.unit';

const main = async (): Promise<void> => {
  try {
    await runPracticeLlmParserUnitTests();
    console.log('PASS: practice llm parser unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: practice llm parser unit tests');
    console.error(message);
    process.exit(1);
  }
};

void main();
