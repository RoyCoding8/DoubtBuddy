import { runHealthDashboardSelectorUnitTests } from './healthDashboardSelectors.unit';

const main = (): void => {
  try {
    runHealthDashboardSelectorUnitTests();
    console.log('PASS: health dashboard selector unit tests');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: health dashboard selector unit tests');
    console.error(message);
    process.exit(1);
  }
};

main();
