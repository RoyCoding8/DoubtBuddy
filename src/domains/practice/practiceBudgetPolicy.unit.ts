import {
  estimatePracticeGradingTokens,
  evaluatePracticeGenerationBudgetPolicy,
  evaluatePracticeGradingBudgetPolicy,
  evaluatePracticeLatencyPolicy,
} from './practiceBudgetPolicy';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const runGenerationBudgetAllowCase = (): void => {
  const result = evaluatePracticeGenerationBudgetPolicy({
    questionCount: 10,
    estimatedTokens: 3000,
  });

  assert(result.decision === 'allow', 'expected under-budget generation request to be allowed');
  assert(result.degraded === false, 'allowed generation request must not be degraded');
};

const runGenerationBudgetCompactCase = (): void => {
  const result = evaluatePracticeGenerationBudgetPolicy({
    questionCount: 10,
    estimatedTokens: 5000,
    compactEstimatedTokens: 3900,
  });

  assert(result.decision === 'compact', 'expected over-budget generation request to compact before block');
  assert(result.degraded === false, 'compact decision must remain non-degraded');
};

const runGenerationBudgetBlockedCase = (): void => {
  const result = evaluatePracticeGenerationBudgetPolicy({
    questionCount: 10,
    estimatedTokens: 5000,
    compactEstimatedTokens: 4500,
  });

  assert(result.decision === 'blocked', 'expected generation budget block when compact still exceeds cap');
  assert(result.fallbackSignal === 'BUDGET_BLOCKED', 'expected deterministic budget blocked fallback signal');
  assert(result.degraded === true, 'blocked decision must be degraded');
};

const runGradingBudgetCases = (): void => {
  const estimatedTokens = estimatePracticeGradingTokens({
    questionPrompt: 'Find v from v = u + at and explain each step.',
    userAnswer: 'I used v=u+at with u=0 a=2 and t=5 so v=10 m/s.',
    answerKey: '10 m/s',
    rubricKeyPointCount: 2,
  });

  const allow = evaluatePracticeGradingBudgetPolicy({ estimatedTokens });
  assert(allow.decision === 'allow', 'expected small grading estimate to be allowed');

  const compact = evaluatePracticeGradingBudgetPolicy({
    estimatedTokens: 1600,
    compactEstimatedTokens: 1000,
  });
  assert(compact.decision === 'compact', 'expected grading compact decision before hard block');

  const blocked = evaluatePracticeGradingBudgetPolicy({
    estimatedTokens: 1800,
    compactEstimatedTokens: 1200,
  });
  assert(blocked.decision === 'blocked', 'expected grading budget block when compact is still over cap');
  assert(blocked.fallbackSignal === 'BUDGET_BLOCKED', 'expected deterministic grading budget blocked signal');
};

const runLatencyCeilingCases = (): void => {
  const generationExceeded = evaluatePracticeLatencyPolicy({
    operationType: 'practice_generate',
    questionCount: 5,
    elapsedMs: 8101,
  });

  assert(generationExceeded.withinDeadline === false, 'expected generation latency breach beyond 5Q ceiling');
  assert(
    generationExceeded.fallbackSignal === 'LATENCY_CEILING_EXCEEDED',
    'expected deterministic latency ceiling fallback signal for generation',
  );

  const gradingExceeded = evaluatePracticeLatencyPolicy({
    operationType: 'practice_grade',
    elapsedMs: 6400,
  });
  assert(gradingExceeded.withinDeadline === false, 'expected grading latency breach beyond 6s ceiling');
  assert(
    gradingExceeded.fallbackSignal === 'LATENCY_CEILING_EXCEEDED',
    'expected deterministic latency ceiling fallback signal for grading',
  );
};

export const runPracticeBudgetPolicyUnitTests = async (): Promise<void> => {
  runGenerationBudgetAllowCase();
  runGenerationBudgetCompactCase();
  runGenerationBudgetBlockedCase();
  runGradingBudgetCases();
  runLatencyCeilingCases();
};
