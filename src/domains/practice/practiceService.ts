import { syllabusData } from '../../constants/syllabus';
import { createId } from '../../utils/ids';
import { InferenceOrchestrator } from '../../ai/orchestrator/inferenceOrchestrator';
import { createProviderAdapters } from '../../ai/providers';
import { SolveRequest, SolveResponse } from '../../ai/contracts/aiContracts';
import { AppSettings } from '../../types/settings';
import { loadSettings } from '../../services/settingsStorage';
import { TelemetrySink, createDefaultTelemetryService } from '../observability/telemetryService';
import { InferenceEvent } from '../observability/types';
import { PracticeRepository, createDefaultPracticeRepository } from './practiceRepository';
import {
  estimatePracticeGradingTokens,
  evaluatePracticeGenerationBudgetPolicy,
  evaluatePracticeGradingBudgetPolicy,
  evaluatePracticeLatencyPolicy,
  PracticeGuardrailSignal,
} from './practiceBudgetPolicy';
import {
  buildPracticeGradingUserPrompt,
  buildPracticeGenerationUserPrompt,
  PRACTICE_PROMPTS,
} from './practicePromptCatalog';
import { parsePracticeGenerationPayload, parsePracticeGradingPayload } from './practiceLlmParser';
import {
  PracticeAttempt,
  PracticeDifficultyMix,
  PracticeEvaluation,
  PracticeQuestion,
  PracticeSet,
  PracticeSetInput,
  PracticeSubmission,
  PracticeSubmissionResult,
} from './types';

const DEFAULT_DIFFICULTY_MIX: PracticeDifficultyMix = {
  easy: 4,
  medium: 4,
  hard: 2,
};

const normalizeDifficultyMixCounts = (
  requestedMix: PracticeSetInput['difficultyMix'] | undefined,
  questionCount: number,
): PracticeDifficultyMix => {
  const safeMix = requestedMix ?? DEFAULT_DIFFICULTY_MIX;
  const raw = {
    easy: Number.isFinite(safeMix.easy) ? Math.max(0, Math.floor(safeMix.easy)) : 0,
    medium: Number.isFinite(safeMix.medium) ? Math.max(0, Math.floor(safeMix.medium)) : 0,
    hard: Number.isFinite(safeMix.hard) ? Math.max(0, Math.floor(safeMix.hard)) : 0,
  } as PracticeDifficultyMix;

  const rawTotal = raw.easy + raw.medium + raw.hard;
  if (rawTotal <= 0) {
    return normalizeDifficultyMixCounts(DEFAULT_DIFFICULTY_MIX, questionCount);
  }

  const scaled = {
    easy: Math.floor((raw.easy / rawTotal) * questionCount),
    medium: Math.floor((raw.medium / rawTotal) * questionCount),
    hard: Math.floor((raw.hard / rawTotal) * questionCount),
  } as PracticeDifficultyMix;

  let remaining = questionCount - (scaled.easy + scaled.medium + scaled.hard);
  const ranking = [
    { key: 'easy' as const, weight: raw.easy / rawTotal },
    { key: 'medium' as const, weight: raw.medium / rawTotal },
    { key: 'hard' as const, weight: raw.hard / rawTotal },
  ].sort((a, b) => b.weight - a.weight);

  let cursor = 0;
  while (remaining > 0) {
    const key = ranking[cursor % ranking.length].key;
    scaled[key] += 1;
    remaining -= 1;
    cursor += 1;
  }

  return scaled;
};

const normalized = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const PRACTICE_GENERATION_DEGRADED_TAG = 'practice_generation_degraded';
const PRACTICE_DETERMINISTIC_PROVIDER = 'local_template';
const PRACTICE_DETERMINISTIC_MODEL = 'practice-deterministic-fallback:v1';

const TOKEN_COST_USD_PER_1K: Record<string, number> = {
  gemini: 0.00035,
  openrouter: 0.001,
  huggingface: 0.0002,
  local_template: 0,
};

const estimateOperationCostUsd = (provider: string, tokenEstimate?: number): number | undefined => {
  if (typeof tokenEstimate !== 'number' || tokenEstimate <= 0) {
    return undefined;
  }

  const per1k = TOKEN_COST_USD_PER_1K[provider] ?? TOKEN_COST_USD_PER_1K.openrouter;
  return Number(((tokenEstimate / 1000) * per1k).toFixed(6));
};

const selectBudgetTokenEstimate = (input: {
  decision: 'allow' | 'compact' | 'blocked';
  estimatedTokens: number;
  compactEstimatedTokens?: number;
}): number => (input.decision === 'compact' ? input.compactEstimatedTokens ?? input.estimatedTokens : input.estimatedTokens);

const isAnswerCorrect = (answerKey: string | undefined, userAnswer: string): boolean => {
  if (!answerKey) {
    return false;
  }

  return normalized(answerKey) === normalized(userAnswer);
};

const misconceptionTagForDifficulty = (difficulty: PracticeQuestion['difficulty']): string => {
  if (difficulty === 'easy') {
    return 'Foundational concept gap';
  }

  if (difficulty === 'medium') {
    return 'Concept application error';
  }

  return 'Advanced multi-step error';
};

const attachGenerationFallbackSignal = (
  questions: PracticeQuestion[],
  signal: PracticeGuardrailSignal,
): PracticeQuestion[] =>
  questions.map((question) => ({
    ...question,
    rubricAnchor: {
      expectedFinalAnswer: question.rubricAnchor?.expectedFinalAnswer,
      keyPoints:
        question.rubricAnchor?.keyPoints && question.rubricAnchor.keyPoints.length > 0
          ? question.rubricAnchor.keyPoints
          : ['Generated via deterministic fallback due to guardrail policy.'],
      unitExpectations: question.rubricAnchor?.unitExpectations,
      commonPitfalls: [...(question.rubricAnchor?.commonPitfalls ?? []), `guardrail_fallback_signal:${signal}`],
    },
  }));

const buildGuardrailVerificationNote = (signal: PracticeGuardrailSignal): string =>
  `Deterministic fallback enforced by practice guardrail policy (${signal}). Retry when budget/latency conditions improve.`;

const buildDeterministicGradingFallbackNote = (reason: string): string =>
  `Deterministic grading fallback applied (${reason}). This score is non-authoritative. Retry when provider availability improves.`;

const buildDeterministicEvaluation = (input: {
  question: PracticeQuestion;
  userAnswer: string;
  verificationNote: string;
}): PracticeEvaluation => {
  const isCorrect = isAnswerCorrect(input.question.answerKey, input.userAnswer);

  return {
    isCorrect,
    score: isCorrect ? 1 : 0,
    reasoningQuality: isCorrect
      ? 'Deterministic exact-match grading indicates aligned final answer.'
      : 'Deterministic exact-match grading indicates final answer mismatch.',
    finalAnswerCheck: isCorrect ? 'pass' : 'fail',
    misconceptionTag: isCorrect ? undefined : misconceptionTagForDifficulty(input.question.difficulty),
    explanation: isCorrect
      ? 'Final answer matches expected answer key under deterministic fallback grading.'
      : `Expected: ${input.question.answerKey ?? 'N/A'}. Revisit ${input.question.topic ?? 'the topic'} and retry.`,
    improvementHints: isCorrect
      ? ['Reproduce the same approach with timed constraints for retention.']
      : [
          'Re-derive the result step-by-step and verify each transition.',
          'Check sign, units, and magnitude before locking the final answer.',
        ],
    nextStepCue: isCorrect
      ? 'Attempt a harder variant from the same topic.'
      : 'Retry with a concise, stepwise answer and a clearly boxed final result.',
    confidence: 'low',
    verificationNote: input.verificationNote,
    degraded: true,
  };
};

const mapEvaluationConfidence = (input: {
  llmEvaluation: PracticeEvaluation;
  verification?: SolveResponse['verification'];
}): PracticeEvaluation['confidence'] => input.verification?.confidence ?? input.llmEvaluation.confidence ?? 'low';

const buildMappedVerificationNote = (input: {
  llmEvaluation: PracticeEvaluation;
  verification?: SolveResponse['verification'];
}): string => {
  const notes = [
    input.verification?.note,
    input.llmEvaluation.verificationNote,
    input.verification?.verifierProvider ? `Verifier provider: ${input.verification.verifierProvider}.` : undefined,
  ].filter((entry): entry is string => Boolean(entry && entry.trim()));

  return notes.length > 0 ? notes.join(' ') : 'LLM grading completed with structured rubric checks.';
};

const attachGenerationDegradedTag = (questions: PracticeQuestion[], reason: string): PracticeQuestion[] =>
  questions.map((question) => ({
    ...question,
    rubricAnchor: {
      expectedFinalAnswer: question.rubricAnchor?.expectedFinalAnswer,
      keyPoints:
        question.rubricAnchor?.keyPoints && question.rubricAnchor.keyPoints.length > 0
          ? question.rubricAnchor.keyPoints
          : ['Generated via deterministic fallback due to LLM unavailability or invalid response.'],
      unitExpectations: question.rubricAnchor?.unitExpectations,
      commonPitfalls: [...(question.rubricAnchor?.commonPitfalls ?? []), `${PRACTICE_GENERATION_DEGRADED_TAG}:${reason}`],
    },
  }));

const buildQuestionBank = (subjectId: PracticeSetInput['subjectId'], chapterId: string, topic?: string): PracticeQuestion[] => {
  const subject = syllabusData.find((entry) => entry.id === subjectId);
  const chapter = subject?.chapters.find((entry) => entry.id === chapterId);

  if (!subject || !chapter) {
    throw new Error('PRACTICE_SCOPE_NOT_FOUND');
  }

  const targetTopics = topic ? [topic] : [...chapter.topics];
  const prompts: Array<{ topic: string; prompt: string; answerKey: string }> = [];
  const basePromptBuilders = [
    (subjectName: string, chapterName: string, topicName: string, variant: number) => ({
      prompt: `[${subjectName} • ${chapterName}] ${topicName}: Define the core idea in one line. (v${variant})`,
      answerKey: `${topicName} core definition`,
    }),
    (subjectName: string, chapterName: string, topicName: string, variant: number) => ({
      prompt: `[${subjectName} • ${chapterName}] ${topicName}: Write one key formula or relation used most often. (v${variant})`,
      answerKey: `${topicName} key formula`,
    }),
    (subjectName: string, chapterName: string, topicName: string, variant: number) => ({
      prompt: `[${subjectName} • ${chapterName}] ${topicName}: State one common mistake students should avoid. (v${variant})`,
      answerKey: `${topicName} common mistake`,
    }),
    (subjectName: string, chapterName: string, topicName: string, variant: number) => ({
      prompt: `[${subjectName} • ${chapterName}] ${topicName}: Give a fast exam-time checkpoint before final answer. (v${variant})`,
      answerKey: `${topicName} exam checkpoint`,
    }),
    (subjectName: string, chapterName: string, topicName: string, variant: number) => ({
      prompt: `[${subjectName} • ${chapterName}] ${topicName}: Mention one prerequisite concept from prior classes. (v${variant})`,
      answerKey: `${topicName} prerequisite concept`,
    }),
    (subjectName: string, chapterName: string, topicName: string, variant: number) => ({
      prompt: `[${subjectName} • ${chapterName}] ${topicName}: Suggest one high-yield revision cue word. (v${variant})`,
      answerKey: `${topicName} revision cue`,
    }),
  ] as const;

  targetTopics.forEach((topicName) => {
    for (let variant = 1; variant <= 4; variant += 1) {
      basePromptBuilders.forEach((buildPrompt) => {
        const item = buildPrompt(subject.name, chapter.name, topicName, variant);
        prompts.push({
          topic: topicName,
          prompt: item.prompt,
          answerKey: item.answerKey,
        });
      });
    }
  });

  return prompts.map((entry, index) => ({
    id: createId(`practice_q_${index + 1}`),
    topic: entry.topic,
    prompt: entry.prompt,
    answerKey: entry.answerKey,
    difficulty: 'easy',
  }));
};

const enforceQuestionCountAndDifficulty = (
  sourceQuestions: PracticeQuestion[],
  normalizedMix: PracticeDifficultyMix,
  requestedCount: number,
): PracticeQuestion[] => {
  const requiredDifficulties: PracticeQuestion['difficulty'][] = [
    ...Array.from({ length: normalizedMix.easy }, () => 'easy' as const),
    ...Array.from({ length: normalizedMix.medium }, () => 'medium' as const),
    ...Array.from({ length: normalizedMix.hard }, () => 'hard' as const),
  ];

  const indexed = sourceQuestions.map((question, index) => ({
    index,
    question,
  }));

  const byDifficulty: Record<PracticeQuestion['difficulty'], Array<{ index: number; question: PracticeQuestion }>> = {
    easy: indexed.filter((entry) => entry.question.difficulty === 'easy'),
    medium: indexed.filter((entry) => entry.question.difficulty === 'medium'),
    hard: indexed.filter((entry) => entry.question.difficulty === 'hard'),
  };

  const consumed = new Set<number>();

  const takeMatching = (difficulty: PracticeQuestion['difficulty']): { index: number; question: PracticeQuestion } | null => {
    const bucket = byDifficulty[difficulty];
    while (bucket.length > 0) {
      const candidate = bucket.shift();
      if (candidate && !consumed.has(candidate.index)) {
        consumed.add(candidate.index);
        return candidate;
      }
    }

    for (const candidate of indexed) {
      if (!consumed.has(candidate.index)) {
        consumed.add(candidate.index);
        return candidate;
      }
    }

    return null;
  };

  const selected: PracticeQuestion[] = [];
  for (const difficulty of requiredDifficulties) {
    const candidate = takeMatching(difficulty);
    if (!candidate) {
      break;
    }

    selected.push({
      ...candidate.question,
      difficulty,
    });
  }

  return selected.slice(0, requestedCount);
};

interface PracticeGenerationRuntime {
  orchestrator: {
    solveWithMetadata(request: SolveRequest): Promise<{
      response: SolveResponse;
      fallbackLevel: number;
      retries: number;
      attempts: number;
      timeoutMs: number;
    }>;
  };
  settings: AppSettings;
}

const initializePracticeGenerationRuntime = async (): Promise<PracticeGenerationRuntime> => {
  const settings = await loadSettings();
  const adapters = await createProviderAdapters(settings);

  return {
    orchestrator: new InferenceOrchestrator(adapters, {
      getSettings: async () => settings,
    }),
    settings,
  };
};

export interface PracticeServiceDependencies {
  initializeLlmRuntime?: () => Promise<PracticeGenerationRuntime>;
  telemetry?: TelemetrySink;
}

export interface PracticeService {
  generateSet(input: PracticeSetInput): Promise<PracticeSet>;
  submitAnswers(input: { setId: string; submissions: PracticeSubmission[] }): Promise<PracticeSubmissionResult>;
}

export class DefaultPracticeService implements PracticeService {
  private readonly telemetry: TelemetrySink;

  constructor(
    private readonly repository: PracticeRepository = createDefaultPracticeRepository(),
    private readonly dependencies: PracticeServiceDependencies = {},
  ) {
    this.telemetry = dependencies.telemetry ?? createDefaultTelemetryService();
  }

  private async recordPracticeTelemetry(event: InferenceEvent): Promise<void> {
    try {
      await this.telemetry.recordInferenceAttempt(event);
    } catch {
      // telemetry failures must not break practice flows
    }
  }

  async generateSet(input: PracticeSetInput): Promise<PracticeSet> {
    const operationStartedAt = Date.now();
    const operationRequestId = createId('practice_generate_operation');
    const generationBudgetDecision = evaluatePracticeGenerationBudgetPolicy({
      questionCount: input.questionCount,
    });
    const generationTokenEstimate = selectBudgetTokenEstimate(generationBudgetDecision);

    const bank = buildQuestionBank(input.subjectId, input.chapterId, input.topic);
    if (bank.length < input.questionCount) {
      throw new Error('PRACTICE_INSUFFICIENT_QUESTIONS');
    }

    const normalizedMix = normalizeDifficultyMixCounts(input.difficultyMix, input.questionCount);
    const deterministicQuestions = enforceQuestionCountAndDifficulty(bank, normalizedMix, input.questionCount);

    if (deterministicQuestions.length < input.questionCount) {
      throw new Error('PRACTICE_INSUFFICIENT_QUESTIONS');
    }

    const saveAndReturn = async (questions: PracticeQuestion[], degraded = false): Promise<PracticeSet> => {
      const set: PracticeSet = {
        id: createId('practice_set'),
        subjectId: input.subjectId,
        chapterId: input.chapterId,
        topic: input.topic,
        questionCount: input.questionCount,
        degraded,
        generatedAt: new Date().toISOString(),
        questions,
      };

      await this.repository.saveSet(set);
      return set;
    };

    const emitGenerationTelemetry = async (inputEvent: {
      provider: string;
      model: string;
      status: 'success' | 'failed';
      fallbackLevel: number;
      tokenEstimate?: number;
      degraded: boolean;
      fallbackStatus: 'none' | 'provider' | 'deterministic';
      budgetDecision: 'allow' | 'compact' | 'blocked';
    }): Promise<void> => {
      await this.recordPracticeTelemetry({
        requestId: operationRequestId,
        timestamp: new Date().toISOString(),
        provider: inputEvent.provider as InferenceEvent['provider'],
        model: inputEvent.model,
        latencyMs: Math.max(0, Date.now() - operationStartedAt),
        status: inputEvent.status,
        fallbackLevel: inputEvent.fallbackLevel,
        tokenEstimate: inputEvent.tokenEstimate,
        operationType: 'practice_generate',
        promptVersion: PRACTICE_PROMPTS.generation.version,
        degraded: inputEvent.degraded,
        budgetDecision: inputEvent.budgetDecision,
        fallbackStatus: inputEvent.fallbackStatus,
        estimatedCostUsd: estimateOperationCostUsd(inputEvent.provider, inputEvent.tokenEstimate),
      });
    };

    const buildDeterministicDegradedSet = async (reason: string, signal?: PracticeGuardrailSignal): Promise<PracticeSet> => {
      const withSignal = signal ? attachGenerationFallbackSignal(deterministicQuestions, signal) : deterministicQuestions;
      const degradedQuestions = attachGenerationDegradedTag(withSignal, reason);
      const set = await saveAndReturn(degradedQuestions, true);
      await emitGenerationTelemetry({
        provider: PRACTICE_DETERMINISTIC_PROVIDER,
        model: PRACTICE_DETERMINISTIC_MODEL,
        status: 'success',
        fallbackLevel: 3,
        tokenEstimate: generationTokenEstimate,
        degraded: true,
        fallbackStatus: 'deterministic',
        budgetDecision: generationBudgetDecision.decision,
      });
      return set;
    };

    if (generationBudgetDecision.fallbackSignal) {
      return buildDeterministicDegradedSet(`guardrail:${generationBudgetDecision.fallbackSignal}`, generationBudgetDecision.fallbackSignal);
    }

    const initializeRuntime = this.dependencies.initializeLlmRuntime ?? initializePracticeGenerationRuntime;

    try {
      const runtime = await initializeRuntime();
      const baseUserPrompt = buildPracticeGenerationUserPrompt(input);
      const compactUserConstraint =
        generationBudgetDecision.decision === 'compact'
          ? '\n\nCompact mode: Keep each prompt concise (<= 20 words) while preserving difficulty intent.'
          : '';

      const orchestratorResult = await runtime.orchestrator.solveWithMetadata({
        requestId: createId('practice_generate_request'),
        prompt: {
          system: PRACTICE_PROMPTS.generation.system,
          user: `${baseUserPrompt}${compactUserConstraint}`,
        },
        mode: 'quick_answer',
        qualityMode: runtime.settings.qualityMode,
      });

      const parsed = parsePracticeGenerationPayload(orchestratorResult.response.text);
      if (!parsed.ok) {
        return buildDeterministicDegradedSet(`parse_failure:${parsed.reason}`);
      }

      const llmQuestions = enforceQuestionCountAndDifficulty(parsed.value, normalizedMix, input.questionCount);
      if (llmQuestions.length < input.questionCount) {
        return buildDeterministicDegradedSet('provider_output_insufficient_questions');
      }

      const latencyDecision = evaluatePracticeLatencyPolicy({
        operationType: 'practice_generate',
        questionCount: input.questionCount,
        elapsedMs: Date.now() - operationStartedAt,
      });

      if (latencyDecision.fallbackSignal) {
        return buildDeterministicDegradedSet(`guardrail:${latencyDecision.fallbackSignal}`, latencyDecision.fallbackSignal);
      }

      const set = await saveAndReturn(llmQuestions, false);
      await emitGenerationTelemetry({
        provider: orchestratorResult.response.provider,
        model: orchestratorResult.response.model,
        status: 'success',
        fallbackLevel: orchestratorResult.fallbackLevel,
        tokenEstimate: orchestratorResult.response.tokenEstimate ?? generationTokenEstimate,
        degraded: false,
        fallbackStatus: orchestratorResult.fallbackLevel > 0 ? 'provider' : 'none',
        budgetDecision: generationBudgetDecision.decision,
      });
      return set;
    } catch {
      return buildDeterministicDegradedSet('provider_failure_or_runtime_unavailable');
    }
  }

  async submitAnswers(input: { setId: string; submissions: PracticeSubmission[] }): Promise<PracticeSubmissionResult> {
    const set = await this.repository.getSetById(input.setId);
    if (!set) {
      throw new Error('PRACTICE_SET_NOT_FOUND');
    }

    const initializeRuntime = this.dependencies.initializeLlmRuntime ?? initializePracticeGenerationRuntime;
    let gradingRuntime: PracticeGenerationRuntime | null = null;

    try {
      gradingRuntime = await initializeRuntime();
    } catch {
      gradingRuntime = null;
    }

    const submissionMap = new Map(input.submissions.map((entry) => [entry.questionId, entry]));
    const attempts: PracticeAttempt[] = [];

    for (const question of set.questions) {
      const gradeStartedAt = Date.now();
      const gradeRequestId = createId('practice_grade_operation');
      const submission = submissionMap.get(question.id);
      const userAnswer = submission?.userAnswer ?? '';

      const gradingTokenEstimate = estimatePracticeGradingTokens({
        questionPrompt: question.prompt,
        userAnswer,
        answerKey: question.answerKey,
        rubricKeyPointCount: question.rubricAnchor?.keyPoints.length,
      });
      const gradingBudgetDecision = evaluatePracticeGradingBudgetPolicy({
        estimatedTokens: gradingTokenEstimate,
      });
      const gradingSelectedTokenEstimate = selectBudgetTokenEstimate(gradingBudgetDecision);

      const emitGradeTelemetry = async (inputEvent: {
        provider: string;
        model: string;
        status: 'success' | 'failed';
        fallbackLevel: number;
        tokenEstimate?: number;
        degraded: boolean;
        fallbackStatus: 'none' | 'provider' | 'deterministic';
        budgetDecision: 'allow' | 'compact' | 'blocked';
      }): Promise<void> => {
        await this.recordPracticeTelemetry({
          requestId: gradeRequestId,
          timestamp: new Date().toISOString(),
          provider: inputEvent.provider as InferenceEvent['provider'],
          model: inputEvent.model,
          latencyMs: Math.max(0, Date.now() - gradeStartedAt),
          status: inputEvent.status,
          fallbackLevel: inputEvent.fallbackLevel,
          tokenEstimate: inputEvent.tokenEstimate,
          operationType: 'practice_grade',
          promptVersion: PRACTICE_PROMPTS.grading.version,
          degraded: inputEvent.degraded,
          budgetDecision: inputEvent.budgetDecision,
          fallbackStatus: inputEvent.fallbackStatus,
          estimatedCostUsd: estimateOperationCostUsd(inputEvent.provider, inputEvent.tokenEstimate),
        });
      };

      const buildFallbackAttempt = (reason: string, signal?: PracticeGuardrailSignal): PracticeAttempt => {
        const verificationNote = signal ? buildGuardrailVerificationNote(signal) : buildDeterministicGradingFallbackNote(reason);
        const fallbackEvaluation = buildDeterministicEvaluation({
          question,
          userAnswer,
          verificationNote,
        });

        return {
          id: createId('practice_attempt'),
          setId: set.id,
          questionId: question.id,
          userAnswer,
          isCorrect: fallbackEvaluation.isCorrect,
          score: fallbackEvaluation.score,
          reasoningQuality: fallbackEvaluation.reasoningQuality,
          finalAnswerCheck: fallbackEvaluation.finalAnswerCheck,
          explanation: fallbackEvaluation.explanation,
          misconceptionTag: fallbackEvaluation.misconceptionTag,
          improvementHints: fallbackEvaluation.improvementHints,
          nextStepCue: fallbackEvaluation.nextStepCue,
          confidence: fallbackEvaluation.confidence,
          verificationNote: fallbackEvaluation.verificationNote,
          degraded: fallbackEvaluation.degraded,
          promptVersion: PRACTICE_PROMPTS.grading.version,
          solvedAt: new Date().toISOString(),
          solveTimeMs: submission?.solveTimeMs ?? 0,
        };
      };

      if (gradingBudgetDecision.fallbackSignal) {
        attempts.push(buildFallbackAttempt(`guardrail:${gradingBudgetDecision.fallbackSignal}`, gradingBudgetDecision.fallbackSignal));
        await emitGradeTelemetry({
          provider: PRACTICE_DETERMINISTIC_PROVIDER,
          model: PRACTICE_DETERMINISTIC_MODEL,
          status: 'success',
          fallbackLevel: 3,
          tokenEstimate: gradingSelectedTokenEstimate,
          degraded: true,
          fallbackStatus: 'deterministic',
          budgetDecision: gradingBudgetDecision.decision,
        });
        continue;
      }

      if (!gradingRuntime) {
        attempts.push(buildFallbackAttempt('runtime_unavailable'));
        await emitGradeTelemetry({
          provider: PRACTICE_DETERMINISTIC_PROVIDER,
          model: PRACTICE_DETERMINISTIC_MODEL,
          status: 'success',
          fallbackLevel: 3,
          tokenEstimate: gradingSelectedTokenEstimate,
          degraded: true,
          fallbackStatus: 'deterministic',
          budgetDecision: gradingBudgetDecision.decision,
        });
        continue;
      }

      try {
        const baseUserPrompt = buildPracticeGradingUserPrompt({
          questionPrompt: question.prompt,
          topic: question.topic ?? set.topic,
          answerKey: question.answerKey,
          rubricAnchor: question.rubricAnchor,
          userAnswer,
        });
        const compactUserConstraint =
          gradingBudgetDecision.decision === 'compact'
            ? '\n\nCompact mode: Keep explanation concise while preserving scoring rationale and remediation quality.'
            : '';

        const orchestratorResult = await gradingRuntime.orchestrator.solveWithMetadata({
          requestId: createId('practice_grade_request'),
          prompt: {
            system: PRACTICE_PROMPTS.grading.system,
            user: `${baseUserPrompt}${compactUserConstraint}`,
          },
          mode: 'quick_answer',
          qualityMode: gradingRuntime.settings.qualityMode,
        });

        const parsedEvaluation = parsePracticeGradingPayload(orchestratorResult.response.text);
        if (!parsedEvaluation.ok) {
          attempts.push(buildFallbackAttempt(`parse_failure:${parsedEvaluation.reason}`));
          await emitGradeTelemetry({
            provider: PRACTICE_DETERMINISTIC_PROVIDER,
            model: PRACTICE_DETERMINISTIC_MODEL,
            status: 'success',
            fallbackLevel: 3,
            tokenEstimate: gradingSelectedTokenEstimate,
            degraded: true,
            fallbackStatus: 'deterministic',
            budgetDecision: gradingBudgetDecision.decision,
          });
          continue;
        }

        const gradingLatencyDecision = evaluatePracticeLatencyPolicy({
          operationType: 'practice_grade',
          elapsedMs: Date.now() - gradeStartedAt,
        });
        if (gradingLatencyDecision.fallbackSignal) {
          attempts.push(buildFallbackAttempt(`guardrail:${gradingLatencyDecision.fallbackSignal}`, gradingLatencyDecision.fallbackSignal));
          await emitGradeTelemetry({
            provider: PRACTICE_DETERMINISTIC_PROVIDER,
            model: PRACTICE_DETERMINISTIC_MODEL,
            status: 'success',
            fallbackLevel: 3,
            tokenEstimate: gradingSelectedTokenEstimate,
            degraded: true,
            fallbackStatus: 'deterministic',
            budgetDecision: gradingBudgetDecision.decision,
          });
          continue;
        }

        const confidence = mapEvaluationConfidence({
          llmEvaluation: parsedEvaluation.value,
          verification: orchestratorResult.response.verification,
        });
        const verificationNote = buildMappedVerificationNote({
          llmEvaluation: parsedEvaluation.value,
          verification: orchestratorResult.response.verification,
        });
        const misconceptionTag =
          parsedEvaluation.value.misconceptionTag ??
          (parsedEvaluation.value.isCorrect ? undefined : misconceptionTagForDifficulty(question.difficulty));

        attempts.push({
          id: createId('practice_attempt'),
          setId: set.id,
          questionId: question.id,
          userAnswer,
          isCorrect: parsedEvaluation.value.isCorrect,
          score: parsedEvaluation.value.score,
          reasoningQuality: parsedEvaluation.value.reasoningQuality,
          finalAnswerCheck: parsedEvaluation.value.finalAnswerCheck,
          explanation: parsedEvaluation.value.explanation,
          misconceptionTag,
          improvementHints: parsedEvaluation.value.improvementHints,
          nextStepCue: parsedEvaluation.value.nextStepCue,
          confidence,
          verificationNote,
          degraded: false,
          promptVersion: PRACTICE_PROMPTS.grading.version,
          solvedAt: new Date().toISOString(),
          solveTimeMs: submission?.solveTimeMs ?? 0,
        });
        await emitGradeTelemetry({
          provider: orchestratorResult.response.provider,
          model: orchestratorResult.response.model,
          status: 'success',
          fallbackLevel: orchestratorResult.fallbackLevel,
          tokenEstimate: orchestratorResult.response.tokenEstimate ?? gradingSelectedTokenEstimate,
          degraded: false,
          fallbackStatus: orchestratorResult.fallbackLevel > 0 ? 'provider' : 'none',
          budgetDecision: gradingBudgetDecision.decision,
        });
      } catch {
        attempts.push(buildFallbackAttempt('provider_failure_or_runtime_unavailable'));
        await emitGradeTelemetry({
          provider: PRACTICE_DETERMINISTIC_PROVIDER,
          model: PRACTICE_DETERMINISTIC_MODEL,
          status: 'success',
          fallbackLevel: 3,
          tokenEstimate: gradingSelectedTokenEstimate,
          degraded: true,
          fallbackStatus: 'deterministic',
          budgetDecision: gradingBudgetDecision.decision,
        });
      }
    }

    await this.repository.saveAttempts(attempts);

    const correctCount = attempts.filter((entry) => entry.isCorrect).length;
    const totalQuestions = set.questions.length;
    const incorrectCount = totalQuestions - correctCount;
    const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : 0;

    const topicStats = new Map<
      string,
      { subjectId: PracticeSet['subjectId']; chapterId: string; topic?: string; total: number; incorrect: number; tag: string }
    >();

    set.questions.forEach((question) => {
      const key = `${set.subjectId}::${set.chapterId}::${(question.topic ?? set.topic ?? '').toLowerCase()}`;
      const attempt = attempts.find((entry) => entry.questionId === question.id);
      const baseTag = misconceptionTagForDifficulty(question.difficulty);

      const current = topicStats.get(key) ?? {
        subjectId: set.subjectId,
        chapterId: set.chapterId,
        topic: question.topic ?? set.topic,
        total: 0,
        incorrect: 0,
        tag: baseTag,
      };

      current.total += 1;
      if (attempt && !attempt.isCorrect) {
        current.incorrect += 1;
        current.tag = attempt.misconceptionTag ?? current.tag;
      }

      topicStats.set(key, current);
    });

    const weakAreas = [...topicStats.values()]
      .map((entry) => ({
        subjectId: entry.subjectId,
        chapterId: entry.chapterId,
        topic: entry.topic,
        errorRate: entry.total > 0 ? entry.incorrect / entry.total : 0,
        tag: entry.tag,
      }))
      .filter((entry) => entry.errorRate >= 0.4)
      .sort((a, b) => b.errorRate - a.errorRate);

    return {
      set,
      attempts,
      totalQuestions,
      correctCount,
      incorrectCount,
      accuracy,
      weakAreas,
    };
  }
}

export const createPracticeService = (): PracticeService => new DefaultPracticeService();
