import { PracticeSetInput } from './types';

export interface PracticePromptDefinition {
  version: string;
  system: string;
  outputSchema: Record<string, unknown>;
}

export const PRACTICE_GENERATION_PROMPT_VERSION = 'practice_generation_v1';
export const PRACTICE_GRADING_PROMPT_VERSION = 'practice_grading_v1';

const GENERATION_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['prompt', 'difficulty'],
        properties: {
          id: { type: 'string' },
          prompt: { type: 'string' },
          topic: { type: 'string' },
          difficulty: { enum: ['easy', 'medium', 'hard'] },
          options: { type: 'array', items: { type: 'string' } },
          answerKey: { type: 'string' },
          rubricAnchor: {
            type: 'object',
            properties: {
              expectedFinalAnswer: { type: 'string' },
              keyPoints: { type: 'array', items: { type: 'string' } },
              unitExpectations: { type: 'array', items: { type: 'string' } },
              commonPitfalls: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  },
} as const;

const GRADING_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['isCorrect', 'score', 'reasoningQuality', 'finalAnswerCheck', 'explanation', 'improvementHints', 'nextStepCue'],
  properties: {
    isCorrect: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 1 },
    reasoningQuality: { type: 'string' },
    finalAnswerCheck: { enum: ['pass', 'partial', 'fail'] },
    misconceptionTag: { type: 'string' },
    explanation: { type: 'string' },
    improvementHints: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } },
    nextStepCue: { type: 'string' },
    confidence: { enum: ['high', 'medium', 'low'] },
    verificationNote: { type: 'string' },
    degraded: { type: 'boolean' },
  },
} as const;

export const PRACTICE_PROMPTS = {
  generation: {
    version: PRACTICE_GENERATION_PROMPT_VERSION,
    system:
      'You generate JEE practice questions. Return JSON only. No markdown, no prose before/after JSON. Follow the output schema exactly. For numeric/scientific questions, ensure sign, units, magnitude, and final boxed answer alignment.',
    outputSchema: GENERATION_OUTPUT_SCHEMA,
  },
  grading: {
    version: PRACTICE_GRADING_PROMPT_VERSION,
    system:
      'You grade JEE practice answers using rubric anchors. Return JSON only. No markdown, no prose before/after JSON. Follow output schema exactly. Explicitly verify sign, units, magnitude, and final answer consistency before deciding correctness.',
    outputSchema: GRADING_OUTPUT_SCHEMA,
  },
} as const satisfies {
  generation: PracticePromptDefinition;
  grading: PracticePromptDefinition;
};

export const buildPracticeGenerationUserPrompt = (input: PracticeSetInput): string =>
  JSON.stringify(
    {
      task: 'Generate a practice set',
      subjectId: input.subjectId,
      chapterId: input.chapterId,
      topic: input.topic,
      questionCount: input.questionCount,
      difficultyMix: input.difficultyMix,
      outputSchema: PRACTICE_PROMPTS.generation.outputSchema,
    },
    null,
    2,
  );

export const buildPracticeGradingUserPrompt = (input: {
  questionPrompt: string;
  topic?: string;
  answerKey?: string;
  rubricAnchor?: unknown;
  userAnswer: string;
}): string =>
  JSON.stringify(
    {
      task: 'Grade a practice answer',
      questionPrompt: input.questionPrompt,
      topic: input.topic,
      answerKey: input.answerKey,
      rubricAnchor: input.rubricAnchor,
      userAnswer: input.userAnswer,
      outputSchema: PRACTICE_PROMPTS.grading.outputSchema,
    },
    null,
    2,
  );
