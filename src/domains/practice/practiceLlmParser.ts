import { createId } from '../../utils/ids';
import {
  PracticeEvaluation,
  PracticeQuestion,
  PracticeQuestionRubricAnchor,
} from './types';

type ParseErrorReason =
  | 'EMPTY_PAYLOAD'
  | 'JSON_PARSE_FAILED'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'NO_VALID_QUESTIONS';

export interface PracticeLlmParseFailure {
  ok: false;
  reason: ParseErrorReason;
  details: string;
}

export interface PracticeLlmParseSuccess<T> {
  ok: true;
  value: T;
}

export type PracticeLlmParseResult<T> = PracticeLlmParseSuccess<T> | PracticeLlmParseFailure;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const normalizeDifficulty = (value: unknown): PracticeQuestion['difficulty'] => {
  if (value === 'easy' || value === 'medium' || value === 'hard') {
    return value;
  }

  return 'medium';
};

const normalizeRubricAnchor = (value: unknown): PracticeQuestionRubricAnchor | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const keyPoints = asStringArray(value.keyPoints);
  if (keyPoints.length === 0) {
    return undefined;
  }

  return {
    expectedFinalAnswer: asNonEmptyString(value.expectedFinalAnswer) ?? undefined,
    keyPoints,
    unitExpectations: asStringArray(value.unitExpectations),
    commonPitfalls: asStringArray(value.commonPitfalls),
  };
};

const findFirstJsonObjectString = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }

  let depth = 0;
  let start = -1;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === '\\') {
        isEscaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (character === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          return trimmed.slice(start, index + 1);
        }
      }
    }
  }

  return null;
};

const parseUnknownPayload = (payload: string | unknown): PracticeLlmParseResult<unknown> => {
  if (typeof payload !== 'string') {
    return { ok: true, value: payload };
  }

  const jsonCandidate = findFirstJsonObjectString(payload);
  if (!jsonCandidate) {
    return {
      ok: false,
      reason: 'EMPTY_PAYLOAD',
      details: 'No JSON object found in LLM payload',
    };
  }

  try {
    return { ok: true, value: JSON.parse(jsonCandidate) };
  } catch (error) {
    return {
      ok: false,
      reason: 'JSON_PARSE_FAILED',
      details: error instanceof Error ? error.message : 'Unable to parse JSON payload',
    };
  }
};

const toQuestion = (value: unknown, index: number): PracticeQuestion | null => {
  if (!isRecord(value)) {
    return null;
  }

  const prompt = asNonEmptyString(value.prompt);
  if (!prompt) {
    return null;
  }

  const generatedId = asNonEmptyString(value.id) ?? createId(`practice_llm_q_${index + 1}`);
  return {
    id: generatedId,
    prompt,
    topic: asNonEmptyString(value.topic) ?? undefined,
    difficulty: normalizeDifficulty(value.difficulty),
    options: asStringArray(value.options),
    answerKey: asNonEmptyString(value.answerKey) ?? undefined,
    rubricAnchor: normalizeRubricAnchor(value.rubricAnchor),
  };
};

const asBooleanTolerant = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return null;
};

const asScore = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(1, parsed));
    }
  }

  return null;
};

const asFinalAnswerCheck = (value: unknown): PracticeEvaluation['finalAnswerCheck'] | null => {
  if (value === 'pass' || value === 'partial' || value === 'fail') {
    return value;
  }

  return null;
};

const asConfidence = (value: unknown): PracticeEvaluation['confidence'] | undefined => {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }

  return undefined;
};

export const parsePracticeGenerationPayload = (payload: string | unknown): PracticeLlmParseResult<PracticeQuestion[]> => {
  const parsed = parseUnknownPayload(payload);
  if (!parsed.ok) {
    return parsed;
  }

  if (!isRecord(parsed.value) || !Array.isArray(parsed.value.questions)) {
    return {
      ok: false,
      reason: 'SCHEMA_VALIDATION_FAILED',
      details: 'questions array missing in generation payload',
    };
  }

  const questions = parsed.value.questions.map((entry, index) => toQuestion(entry, index)).filter((entry): entry is PracticeQuestion => Boolean(entry));

  if (questions.length === 0) {
    return {
      ok: false,
      reason: 'NO_VALID_QUESTIONS',
      details: 'generation payload contains zero valid questions',
    };
  }

  return {
    ok: true,
    value: questions,
  };
};

export const parsePracticeGradingPayload = (payload: string | unknown): PracticeLlmParseResult<PracticeEvaluation> => {
  const parsed = parseUnknownPayload(payload);
  if (!parsed.ok) {
    return parsed;
  }

  if (!isRecord(parsed.value)) {
    return {
      ok: false,
      reason: 'SCHEMA_VALIDATION_FAILED',
      details: 'grading payload must be a JSON object',
    };
  }

  const isCorrect = asBooleanTolerant(parsed.value.isCorrect);
  const score = asScore(parsed.value.score);
  const reasoningQuality = asNonEmptyString(parsed.value.reasoningQuality);
  const finalAnswerCheck = asFinalAnswerCheck(parsed.value.finalAnswerCheck);
  const explanation = asNonEmptyString(parsed.value.explanation);
  const improvementHints = asStringArray(parsed.value.improvementHints).slice(0, 3);
  const nextStepCue = asNonEmptyString(parsed.value.nextStepCue);

  if (
    isCorrect === null ||
    score === null ||
    !reasoningQuality ||
    finalAnswerCheck === null ||
    !explanation ||
    improvementHints.length === 0 ||
    !nextStepCue
  ) {
    return {
      ok: false,
      reason: 'SCHEMA_VALIDATION_FAILED',
      details: 'grading payload missing required fields',
    };
  }

  return {
    ok: true,
    value: {
      isCorrect,
      score,
      reasoningQuality,
      finalAnswerCheck,
      misconceptionTag: asNonEmptyString(parsed.value.misconceptionTag) ?? undefined,
      explanation,
      improvementHints,
      nextStepCue,
      confidence: asConfidence(parsed.value.confidence) ?? 'low',
      verificationNote: asNonEmptyString(parsed.value.verificationNote) ?? undefined,
      degraded: asBooleanTolerant(parsed.value.degraded) ?? false,
    },
  };
};

export const buildFallbackPracticeEvaluation = (reason: string): PracticeEvaluation => ({
  isCorrect: false,
  score: 0,
  reasoningQuality: 'Unable to validate reasoning from model response.',
  finalAnswerCheck: 'fail',
  explanation: 'We could not safely parse the evaluator output. Falling back to deterministic guidance.',
  improvementHints: ['Recheck the final answer format.', 'Verify units and sign before final submission.'],
  nextStepCue: 'Retry with a concise, stepwise answer.',
  confidence: 'low',
  verificationNote: `Fallback due to parse failure: ${reason}`,
  degraded: true,
});
