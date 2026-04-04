import {
  buildFallbackPracticeEvaluation,
  parsePracticeGenerationPayload,
  parsePracticeGradingPayload,
} from './practiceLlmParser';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const runGenerationParserHappyPath = (): void => {
  const payload = {
    questions: [
      {
        prompt: 'Find acceleration from v=u+at with given values.',
        difficulty: 'medium',
        topic: 'Kinematics',
        answerKey: '2 m/s^2',
        rubricAnchor: {
          keyPoints: ['Rearrange equation', 'Check units'],
          unitExpectations: ['m/s^2'],
        },
      },
    ],
  };

  const result = parsePracticeGenerationPayload(JSON.stringify(payload));
  assert(result.ok, 'expected valid generation payload to parse');
  if (!result.ok) {
    return;
  }

  assert(result.value.length === 1, 'expected one parsed question');
  assert(result.value[0].difficulty === 'medium', 'expected difficulty preserved');
  assert(result.value[0].rubricAnchor?.keyPoints.length === 2, 'expected rubric key points parsed');
};

const runGenerationParserRejectsMalformedPayload = (): void => {
  const malformed = '```json\n{"questions":[{"prompt":"Q1"\n```';
  const result = parsePracticeGenerationPayload(malformed);
  assert(!result.ok, 'expected malformed JSON payload to fail');
  if (result.ok) {
    return;
  }

  assert(result.reason === 'JSON_PARSE_FAILED', 'expected deterministic parse failure reason for malformed JSON');
};

const runGenerationParserRejectsSchemaMismatches = (): void => {
  const payload = JSON.stringify({ questions: [{ difficulty: 'easy' }] });
  const result = parsePracticeGenerationPayload(payload);
  assert(!result.ok, 'expected payload with missing prompt to fail');
  if (result.ok) {
    return;
  }

  assert(result.reason === 'NO_VALID_QUESTIONS', 'expected deterministic no-valid-questions failure');
};

const runGradingParserHappyPathWithTolerantCoercion = (): void => {
  const payload = JSON.stringify({
    isCorrect: 'true',
    score: '0.75',
    reasoningQuality: 'Method mostly correct with small arithmetic drift.',
    finalAnswerCheck: 'partial',
    explanation: 'Equation selection was correct; arithmetic correction needed.',
    improvementHints: ['Recompute substitution step', 'Verify final sign'],
    nextStepCue: 'Redo final two lines carefully.',
    confidence: 'medium',
  });

  const result = parsePracticeGradingPayload(payload);
  assert(result.ok, 'expected grading payload with tolerant coercion to parse');
  if (!result.ok) {
    return;
  }

  assert(result.value.isCorrect === true, 'expected string boolean to coerce');
  assert(Math.abs(result.value.score - 0.75) < 1e-9, 'expected numeric score string to coerce');
  assert(result.value.improvementHints.length === 2, 'expected hints preserved');
};

const runGradingParserRejectsPartialPayload = (): void => {
  const payload = JSON.stringify({
    isCorrect: true,
    score: 1,
    explanation: 'Missing several required fields',
  });

  const result = parsePracticeGradingPayload(payload);
  assert(!result.ok, 'expected partial grading payload to fail validation');
  if (result.ok) {
    return;
  }

  assert(result.reason === 'SCHEMA_VALIDATION_FAILED', 'expected deterministic schema failure reason');
};

const runFallbackEvaluationBuilder = (): void => {
  const fallback = buildFallbackPracticeEvaluation('SCHEMA_VALIDATION_FAILED');
  assert(fallback.degraded === true, 'expected fallback evaluation to be degraded');
  assert(fallback.confidence === 'low', 'expected fallback evaluation confidence to be low');
  assert(Boolean(fallback.verificationNote), 'expected fallback verification note to exist');
};

export const runPracticeLlmParserUnitTests = async (): Promise<void> => {
  runGenerationParserHappyPath();
  runGenerationParserRejectsMalformedPayload();
  runGenerationParserRejectsSchemaMismatches();
  runGradingParserHappyPathWithTolerantCoercion();
  runGradingParserRejectsPartialPayload();
  runFallbackEvaluationBuilder();
};
