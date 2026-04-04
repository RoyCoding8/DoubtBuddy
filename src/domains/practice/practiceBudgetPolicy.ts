import { PracticeSetInput } from './types';

export type PracticeOperationType = 'practice_generate' | 'practice_grade';
export type PracticeBudgetDecision = 'allow' | 'compact' | 'blocked';
export type PracticeGuardrailSignal = 'BUDGET_BLOCKED' | 'LATENCY_CEILING_EXCEEDED';

interface GenerationBudgetPreset {
  maxTokens: number;
  defaultEstimateTokens: number;
  compactEstimateTokens: number;
}

const GENERATION_BUDGET_PRESETS: Record<PracticeSetInput['questionCount'], GenerationBudgetPreset> = {
  5: {
    maxTokens: 2400,
    defaultEstimateTokens: 1800,
    compactEstimateTokens: 1350,
  },
  10: {
    maxTokens: 4200,
    defaultEstimateTokens: 3300,
    compactEstimateTokens: 2500,
  },
  20: {
    maxTokens: 7600,
    defaultEstimateTokens: 6900,
    compactEstimateTokens: 5200,
  },
};

const GRADE_MAX_TOKENS_PER_ANSWER = 1100;
const GRADE_COMPACT_REDUCTION_FACTOR = 0.72;

const GENERATION_DEADLINES_MS: Record<PracticeSetInput['questionCount'], number> = {
  5: 8000,
  10: 12000,
  20: 18000,
};

const GRADING_DEADLINE_MS = 6000;

const clampNonNegativeInteger = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

export interface PracticeBudgetPolicyDecision {
  operationType: PracticeOperationType;
  decision: PracticeBudgetDecision;
  estimatedTokens: number;
  compactEstimatedTokens?: number;
  maxTokens: number;
  degraded: boolean;
  fallbackSignal?: PracticeGuardrailSignal;
}

export interface PracticeLatencyPolicyDecision {
  operationType: PracticeOperationType;
  elapsedMs: number;
  deadlineMs: number;
  withinDeadline: boolean;
  degraded: boolean;
  fallbackSignal?: PracticeGuardrailSignal;
}

export const evaluatePracticeGenerationBudgetPolicy = (input: {
  questionCount: PracticeSetInput['questionCount'];
  estimatedTokens?: number;
  compactEstimatedTokens?: number;
}): PracticeBudgetPolicyDecision => {
  const preset = GENERATION_BUDGET_PRESETS[input.questionCount];
  const estimatedTokens = clampNonNegativeInteger(input.estimatedTokens ?? preset.defaultEstimateTokens);
  const compactEstimatedTokens = clampNonNegativeInteger(input.compactEstimatedTokens ?? preset.compactEstimateTokens);

  if (estimatedTokens <= preset.maxTokens) {
    return {
      operationType: 'practice_generate',
      decision: 'allow',
      estimatedTokens,
      compactEstimatedTokens,
      maxTokens: preset.maxTokens,
      degraded: false,
    };
  }

  if (compactEstimatedTokens <= preset.maxTokens) {
    return {
      operationType: 'practice_generate',
      decision: 'compact',
      estimatedTokens,
      compactEstimatedTokens,
      maxTokens: preset.maxTokens,
      degraded: false,
    };
  }

  return {
    operationType: 'practice_generate',
    decision: 'blocked',
    estimatedTokens,
    compactEstimatedTokens,
    maxTokens: preset.maxTokens,
    degraded: true,
    fallbackSignal: 'BUDGET_BLOCKED',
  };
};

export const estimatePracticeGradingTokens = (input: {
  questionPrompt: string;
  userAnswer: string;
  answerKey?: string;
  rubricKeyPointCount?: number;
}): number => {
  const promptTokens = Math.ceil(input.questionPrompt.length / 4);
  const answerTokens = Math.ceil(input.userAnswer.length / 4);
  const answerKeyTokens = Math.ceil((input.answerKey?.length ?? 0) / 4);
  const rubricTokens = clampNonNegativeInteger(input.rubricKeyPointCount ?? 0) * 12;
  return clampNonNegativeInteger(260 + promptTokens + answerTokens + answerKeyTokens + rubricTokens);
};

export const evaluatePracticeGradingBudgetPolicy = (input: {
  estimatedTokens: number;
  compactEstimatedTokens?: number;
}): PracticeBudgetPolicyDecision => {
  const estimatedTokens = clampNonNegativeInteger(input.estimatedTokens);
  const compactEstimatedTokens = clampNonNegativeInteger(
    input.compactEstimatedTokens ?? Math.ceil(estimatedTokens * GRADE_COMPACT_REDUCTION_FACTOR),
  );

  if (estimatedTokens <= GRADE_MAX_TOKENS_PER_ANSWER) {
    return {
      operationType: 'practice_grade',
      decision: 'allow',
      estimatedTokens,
      compactEstimatedTokens,
      maxTokens: GRADE_MAX_TOKENS_PER_ANSWER,
      degraded: false,
    };
  }

  if (compactEstimatedTokens <= GRADE_MAX_TOKENS_PER_ANSWER) {
    return {
      operationType: 'practice_grade',
      decision: 'compact',
      estimatedTokens,
      compactEstimatedTokens,
      maxTokens: GRADE_MAX_TOKENS_PER_ANSWER,
      degraded: false,
    };
  }

  return {
    operationType: 'practice_grade',
    decision: 'blocked',
    estimatedTokens,
    compactEstimatedTokens,
    maxTokens: GRADE_MAX_TOKENS_PER_ANSWER,
    degraded: true,
    fallbackSignal: 'BUDGET_BLOCKED',
  };
};

export const evaluatePracticeLatencyPolicy = (input: {
  operationType: PracticeOperationType;
  elapsedMs: number;
  questionCount?: PracticeSetInput['questionCount'];
}): PracticeLatencyPolicyDecision => {
  const elapsedMs = clampNonNegativeInteger(input.elapsedMs);
  const deadlineMs =
    input.operationType === 'practice_generate'
      ? GENERATION_DEADLINES_MS[input.questionCount ?? 10]
      : GRADING_DEADLINE_MS;

  const withinDeadline = elapsedMs <= deadlineMs;
  return {
    operationType: input.operationType,
    elapsedMs,
    deadlineMs,
    withinDeadline,
    degraded: !withinDeadline,
    fallbackSignal: withinDeadline ? undefined : 'LATENCY_CEILING_EXCEEDED',
  };
};
