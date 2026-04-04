import AsyncStorage from '@react-native-async-storage/async-storage';

import { AsyncStoragePracticeRepository } from './practiceRepository';
import { DefaultPracticeService } from './practiceService';
import { PracticeAttempt } from './types';
import { SolveRequest, SolveResponse } from '../../ai/contracts/aiContracts';
import { STORAGE_KEYS } from '../../storage/keys';
import { defaultAppSettings } from '../../types/settings';
import { InferenceEvent } from '../observability/types';
import { TelemetrySink } from '../observability/telemetryService';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

class RecordingTelemetrySink implements TelemetrySink {
  events: InferenceEvent[] = [];

  async recordInferenceAttempt(event: InferenceEvent): Promise<void> {
    this.events.push(event);
  }
}

const installMemoryStorage = (): void => {
  const memoryStore = new Map<string, string>();
  const storage = AsyncStorage as unknown as {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  };

  storage.getItem = async (key: string): Promise<string | null> => memoryStore.get(key) ?? null;
  storage.setItem = async (key: string, value: string): Promise<void> => {
    memoryStore.set(key, value);
  };
  storage.removeItem = async (key: string): Promise<void> => {
    memoryStore.delete(key);
  };
};

const countDifficultyMix = (
  questions: Array<{ difficulty: 'easy' | 'medium' | 'hard' }>,
): { easy: number; medium: number; hard: number } =>
  questions.reduce(
    (acc, question) => {
      acc[question.difficulty] += 1;
      return acc;
    },
    { easy: 0, medium: 0, hard: 0 },
  );

interface MockRuntimeOptions {
  provider?: SolveResponse['provider'];
  model?: string;
  latencyMs?: number;
  verification?: SolveResponse['verification'] | null;
  fallbackLevel?: number;
  retries?: number;
  attempts?: number;
  timeoutMs?: number;
}

const createMockRuntime = (
  responseText: string | ((request: SolveRequest) => string),
  options: MockRuntimeOptions = {},
) => async () => ({
  settings: defaultAppSettings,
  orchestrator: {
    solveWithMetadata: async (request: SolveRequest): Promise<{
      response: SolveResponse;
      fallbackLevel: number;
      retries: number;
      attempts: number;
      timeoutMs: number;
    }> => ({
      response: {
        text: typeof responseText === 'function' ? responseText(request) : responseText,
        provider: options.provider ?? 'gemini',
        model: options.model ?? 'gemini-2.5-flash',
        latencyMs: options.latencyMs ?? 120,
        verification:
          options.verification === null
            ? undefined
            : options.verification ?? {
                confidence: 'high',
                note: 'Cross-provider verification passed.',
                verifierProvider: 'openrouter',
              },
      },
      fallbackLevel: options.fallbackLevel ?? 0,
      retries: options.retries ?? 0,
      attempts: options.attempts ?? 1,
      timeoutMs: options.timeoutMs ?? 8000,
    }),
  },
});

const runGenerateAndSubmitFlow = async (): Promise<void> => {
  installMemoryStorage();

  const service = new DefaultPracticeService(new AsyncStoragePracticeRepository());

  const practiceSet = await service.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 10,
    difficultyMix: {
      easy: 2,
      medium: 3,
      hard: 5,
    },
  });

  assert(practiceSet.questions.length === 10, 'expected 10 generated questions');
  assert(practiceSet.questionCount === 10, 'expected set metadata question count = 10');
  const requestedMixCounts = countDifficultyMix(practiceSet.questions);
  assert(requestedMixCounts.easy === 2, 'expected easy mix count to match requested mix');
  assert(requestedMixCounts.medium === 3, 'expected medium mix count to match requested mix');
  assert(requestedMixCounts.hard === 5, 'expected hard mix count to match requested mix');

  const normalizedSet = await service.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 10,
    difficultyMix: {
      easy: 2,
      medium: 2,
      hard: 1,
    },
  });

  const normalizedMixCounts = countDifficultyMix(normalizedSet.questions);
  assert(normalizedMixCounts.easy === 4, 'expected normalized easy count for 2:2:1 over 10 questions');
  assert(normalizedMixCounts.medium === 4, 'expected normalized medium count for 2:2:1 over 10 questions');
  assert(normalizedMixCounts.hard === 2, 'expected normalized hard count for 2:2:1 over 10 questions');

  const submissions = practiceSet.questions.map((question, index) => ({
    questionId: question.id,
    userAnswer: index < 4 ? question.answerKey ?? '' : 'incorrect answer',
    solveTimeMs: 1000 + index,
  }));

  const result = await service.submitAnswers({
    setId: practiceSet.id,
    submissions,
  });

  assert(result.totalQuestions === 10, 'expected total questions to equal generated set size');
  assert(result.correctCount === 4, 'expected deterministic correct count from seeded submissions');
  assert(result.incorrectCount === 6, 'expected deterministic incorrect count from seeded submissions');
  assert(Math.abs(result.accuracy - 0.4) < 1e-9, 'expected deterministic accuracy to be 40%');
  assert(result.weakAreas.length > 0, 'expected weak area tags to be generated for low accuracy topic');
  assert(result.weakAreas[0]?.topic === 'Kinematics', 'expected weak area tag to map selected topic');
  assert(result.weakAreas[0]?.errorRate >= 0.4, 'expected weak area error rate threshold match');
};

const runLlmGenerationHappyPath = async (): Promise<void> => {
  installMemoryStorage();

  const llmPayload = JSON.stringify({
    questions: Array.from({ length: 10 }, (_, index) => ({
      id: `llm-q-${index + 1}`,
      prompt: `LLM generated prompt ${index + 1}`,
      topic: 'Kinematics',
      difficulty: index < 2 ? 'easy' : index < 5 ? 'medium' : 'hard',
      answerKey: `ans-${index + 1}`,
      rubricAnchor: {
        keyPoints: ['step reasoning', 'final answer'],
      },
    })),
  });

  const service = new DefaultPracticeService(new AsyncStoragePracticeRepository(), {
    initializeLlmRuntime: createMockRuntime(llmPayload),
  });

  const set = await service.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 10,
    difficultyMix: {
      easy: 2,
      medium: 3,
      hard: 5,
    },
  });

  assert(set.questions.length === 10, 'LLM path should return requested question count');
  assert(set.degraded === false, 'LLM path should explicitly mark degraded=false');
  assert(set.questions[0]?.prompt === 'LLM generated prompt 1', 'LLM path should use orchestrator payload prompts');
  assert(
    (set.questions[0]?.rubricAnchor?.keyPoints?.length ?? 0) > 0,
    'LLM path should preserve rubric anchors from parsed payload',
  );
  const mix = countDifficultyMix(set.questions);
  assert(mix.easy === 2 && mix.medium === 3 && mix.hard === 5, 'LLM path should enforce requested normalized difficulty mix');
};

const runLlmGenerationFallbackPath = async (): Promise<void> => {
  installMemoryStorage();

  const service = new DefaultPracticeService(new AsyncStoragePracticeRepository(), {
    initializeLlmRuntime: async () => {
      throw new Error('provider offline');
    },
  });

  const set = await service.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 5,
    difficultyMix: {
      easy: 2,
      medium: 2,
      hard: 1,
    },
  });

  assert(set.questions.length === 5, 'fallback path should still return requested count');
  assert(set.degraded === true, 'fallback path should explicitly mark degraded=true');
  const degradedTagged = set.questions.every((question) =>
    (question.rubricAnchor?.commonPitfalls ?? []).some((entry) => entry.includes('practice_generation_degraded:')),
  );
  assert(degradedTagged, 'fallback path should mark deterministic degraded generation metadata');
};

const runLlmGradingHappyPath = async (): Promise<void> => {
  installMemoryStorage();

  const repository = new AsyncStoragePracticeRepository();
  const baseService = new DefaultPracticeService(repository, {
    initializeLlmRuntime: async () => {
      throw new Error('skip llm generation for grading test');
    },
  });

  const set = await baseService.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 5,
    difficultyMix: {
      easy: 2,
      medium: 2,
      hard: 1,
    },
  });

  const gradingPayload = JSON.stringify({
    isCorrect: true,
    score: 0.92,
    reasoningQuality: 'Stepwise reasoning aligns with rubric anchor expectations.',
    finalAnswerCheck: 'pass',
    misconceptionTag: '',
    explanation: 'Your method is valid and final answer is consistent with expected result.',
    improvementHints: ['State unit explicitly in final line.'],
    nextStepCue: 'Try a medium-hard variant with altered constraints.',
    confidence: 'medium',
    verificationNote: 'Model self-check passed.',
    degraded: false,
  });

  const gradingService = new DefaultPracticeService(repository, {
    initializeLlmRuntime: createMockRuntime((request) => {
      if (request.requestId.startsWith('practice_grade_request')) {
        return gradingPayload;
      }
      throw new Error('Unexpected generation request in grading-only test');
    }),
  });

  const targetQuestion = set.questions[0];
  const result = await gradingService.submitAnswers({
    setId: set.id,
    submissions: [
      {
        questionId: targetQuestion.id,
        userAnswer: 'Semantically equivalent answer using different wording than key.',
        solveTimeMs: 1700,
      },
    ],
  });

  const targetAttempt = result.attempts.find((entry) => entry.questionId === targetQuestion.id);
  assert(Boolean(targetAttempt), 'expected attempt for submitted question');
  assert(targetAttempt?.isCorrect === true, 'LLM rubric grading should allow semantically equivalent answer');
  assert(targetAttempt?.score === 0.92, 'LLM rubric score should be persisted on attempt');
  assert(targetAttempt?.finalAnswerCheck === 'pass', 'LLM final answer check should be persisted');
  assert((targetAttempt?.improvementHints?.length ?? 0) >= 1, 'attempt should contain at least one improvement hint');
  assert(Boolean(targetAttempt?.nextStepCue), 'attempt should contain next-step cue');
  assert(targetAttempt?.confidence === 'high', 'verification mapping should upgrade confidence to orchestrator verification confidence');
  assert(
    (targetAttempt?.verificationNote ?? '').includes('Cross-provider verification passed.'),
    'verification note should include orchestrator verification evidence',
  );
  assert(targetAttempt?.degraded === false, 'LLM grading happy path should not be degraded');
};

const runLlmGradingDegradedFallbackPath = async (): Promise<void> => {
  installMemoryStorage();

  const repository = new AsyncStoragePracticeRepository();
  const baseService = new DefaultPracticeService(repository, {
    initializeLlmRuntime: async () => {
      throw new Error('skip llm generation for grading fallback test');
    },
  });

  const set = await baseService.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 5,
    difficultyMix: {
      easy: 2,
      medium: 2,
      hard: 1,
    },
  });

  const gradingService = new DefaultPracticeService(repository, {
    initializeLlmRuntime: async () => {
      throw new Error('provider offline');
    },
  });

  const result = await gradingService.submitAnswers({
    setId: set.id,
    submissions: [
      {
        questionId: set.questions[0].id,
        userAnswer: 'non matching answer',
        solveTimeMs: 800,
      },
    ],
  });

  const attempt = result.attempts.find((entry) => entry.questionId === set.questions[0].id);
  assert(Boolean(attempt), 'expected fallback attempt to exist');
  assert(attempt?.degraded === true, 'deterministic fallback must be marked degraded');
  assert(attempt?.confidence === 'low', 'deterministic fallback must force low confidence');
  assert(
    (attempt?.verificationNote ?? '').toLowerCase().includes('non-authoritative'),
    'deterministic fallback should include retry CTA non-authoritative note',
  );
  assert((attempt?.improvementHints?.length ?? 0) >= 1, 'fallback attempt should include improvement hints');
  assert(Boolean(attempt?.nextStepCue), 'fallback attempt should include next-step cue');
};

const runRepositoryAttemptBackwardCompatibility = async (): Promise<void> => {
  installMemoryStorage();

  const repository = new AsyncStoragePracticeRepository();
  const storage = AsyncStorage as unknown as {
    setItem: (key: string, value: string) => Promise<void>;
  };

  const legacyAttempt = {
    id: 'legacy-attempt-1',
    setId: 'set-legacy',
    questionId: 'q-legacy-1',
    userAnswer: 'legacy answer',
    isCorrect: false,
    explanation: 'legacy explanation',
    solvedAt: new Date().toISOString(),
    solveTimeMs: 950,
  } as PracticeAttempt;

  await storage.setItem(STORAGE_KEYS.practiceAttemptsV2, JSON.stringify([legacyAttempt]));

  const loadedLegacy = await repository.listAttempts();
  const normalizedLegacy = loadedLegacy[0];

  assert(loadedLegacy.length === 1, 'legacy repository payload should load exactly one attempt');
  assert(Array.isArray(normalizedLegacy?.improvementHints), 'legacy attempt should default improvementHints to []');
  assert((normalizedLegacy?.improvementHints?.length ?? -1) === 0, 'legacy attempt should keep empty default hints');
  assert(normalizedLegacy?.confidence === 'low', 'legacy attempt should default confidence to low');
  assert(normalizedLegacy?.degraded === false, 'legacy attempt should default degraded to false');
  assert(normalizedLegacy?.promptVersion === 'legacy_practice_v0', 'legacy attempt should default promptVersion');
  assert(Boolean(normalizedLegacy?.verificationNote), 'legacy attempt should default verification note');
  assert(
    normalizedLegacy?.finalAnswerCheck === 'fail',
    'legacy incorrect attempt should default finalAnswerCheck=fail',
  );

  const enrichedAttempt: PracticeAttempt = {
    ...normalizedLegacy,
    id: 'enriched-attempt-1',
    setId: 'set-legacy',
    questionId: 'q-legacy-2',
    userAnswer: 'enriched answer',
    isCorrect: true,
    explanation: 'enriched explanation',
    solvedAt: new Date().toISOString(),
    solveTimeMs: 1200,
    score: 0.87,
    reasoningQuality: 'Strong decomposition',
    finalAnswerCheck: 'pass',
    improvementHints: ['State assumptions explicitly.'],
    nextStepCue: 'Try one harder variant now.',
    confidence: 'high',
    verificationNote: 'Cross-provider verification passed.',
    degraded: false,
    promptVersion: 'practice_grading_v1',
  };

  await repository.saveAttempts([enrichedAttempt]);

  const mixed = await repository.listAttemptsBySetId('set-legacy');
  const mixedIds = new Set(mixed.map((entry) => entry.id));
  assert(mixedIds.has('legacy-attempt-1'), 'mixed storage should preserve legacy attempt');
  assert(mixedIds.has('enriched-attempt-1'), 'mixed storage should persist enriched attempt');

  const roundTripEnriched = mixed.find((entry) => entry.id === 'enriched-attempt-1');
  assert(roundTripEnriched?.score === 0.87, 'enriched attempt score should round-trip through repository');
  assert(roundTripEnriched?.confidence === 'high', 'enriched attempt confidence should round-trip');
};

const runRepositorySetListAndGetRegression = async (): Promise<void> => {
  installMemoryStorage();

  const service = new DefaultPracticeService(new AsyncStoragePracticeRepository(), {
    initializeLlmRuntime: async () => {
      throw new Error('deterministic generation for repository regression test');
    },
  });

  const set = await service.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 5,
    difficultyMix: {
      easy: 2,
      medium: 2,
      hard: 1,
    },
  });

  const repository = new AsyncStoragePracticeRepository();
  const listed = await repository.listSets();
  const fetched = await repository.getSetById(set.id);

  assert(listed.length === 1, 'listSets should remain unaffected by attempt metadata changes');
  assert(fetched?.id === set.id, 'getSetById should remain unaffected by attempt metadata changes');
};

const runPracticeTelemetryEmissionCoverage = async (): Promise<void> => {
  installMemoryStorage();

  const telemetry = new RecordingTelemetrySink();
  const llmPayload = JSON.stringify({
    questions: Array.from({ length: 5 }, (_, index) => ({
      id: `telemetry-q-${index + 1}`,
      prompt: `Telemetry prompt ${index + 1}`,
      topic: 'Kinematics',
      difficulty: index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard',
      answerKey: `telemetry-ans-${index + 1}`,
      rubricAnchor: {
        keyPoints: ['reasoning check', 'final answer'],
      },
    })),
  });

  const service = new DefaultPracticeService(new AsyncStoragePracticeRepository(), {
    initializeLlmRuntime: createMockRuntime((request) => {
      if (request.requestId.startsWith('practice_generate_request')) {
        return llmPayload;
      }

      return JSON.stringify({
        isCorrect: true,
        score: 0.9,
        reasoningQuality: 'Sound reasoning steps.',
        finalAnswerCheck: 'pass',
        misconceptionTag: '',
        explanation: 'Answer satisfies rubric checks.',
        improvementHints: ['Keep unit consistency explicit.'],
        nextStepCue: 'Try one harder follow-up.',
        confidence: 'medium',
        verificationNote: 'Model self-check passed.',
        degraded: false,
      });
    }),
    telemetry,
  });

  const set = await service.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 5,
    difficultyMix: { easy: 2, medium: 2, hard: 1 },
  });

  await service.submitAnswers({
    setId: set.id,
    submissions: [
      {
        questionId: set.questions[0].id,
        userAnswer: 'Equivalent correct answer',
        solveTimeMs: 1200,
      },
    ],
  });

  const generationEvent = telemetry.events.find((event) => event.operationType === 'practice_generate');
  assert(Boolean(generationEvent), 'telemetry must include practice_generate event');
  assert(generationEvent?.promptVersion === 'practice_generation_v1', 'generation telemetry should include prompt version');
  assert(typeof generationEvent?.latencyMs === 'number', 'generation telemetry should include latency');
  assert(generationEvent?.degraded === false, 'generation happy-path telemetry should not be degraded');
  assert(typeof generationEvent?.estimatedCostUsd === 'number', 'generation telemetry should include estimated cost');

  const gradingEvent = telemetry.events.find((event) => event.operationType === 'practice_grade');
  assert(Boolean(gradingEvent), 'telemetry must include practice_grade event');
  assert(gradingEvent?.promptVersion === 'practice_grading_v1', 'grading telemetry should include prompt version');
  assert(typeof gradingEvent?.latencyMs === 'number', 'grading telemetry should include latency');
  assert(gradingEvent?.degraded === false, 'grading happy-path telemetry should not be degraded');
  assert(typeof gradingEvent?.estimatedCostUsd === 'number', 'grading telemetry should include estimated cost');
};

const runPracticeTelemetryFallbackCoverage = async (): Promise<void> => {
  installMemoryStorage();

  const telemetry = new RecordingTelemetrySink();
  const service = new DefaultPracticeService(new AsyncStoragePracticeRepository(), {
    initializeLlmRuntime: async () => {
      throw new Error('provider unavailable');
    },
    telemetry,
  });

  const set = await service.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 5,
    difficultyMix: { easy: 2, medium: 2, hard: 1 },
  });

  await service.submitAnswers({
    setId: set.id,
    submissions: [
      {
        questionId: set.questions[0].id,
        userAnswer: 'fallback answer',
        solveTimeMs: 900,
      },
    ],
  });

  const generationEvent = telemetry.events.find((event) => event.operationType === 'practice_generate');
  assert(generationEvent?.degraded === true, 'generation fallback telemetry should be degraded');
  assert(generationEvent?.fallbackStatus === 'deterministic', 'generation fallback should declare deterministic status');

  const gradingEvent = telemetry.events.find((event) => event.operationType === 'practice_grade');
  assert(gradingEvent?.degraded === true, 'grading fallback telemetry should be degraded');
  assert(gradingEvent?.fallbackStatus === 'deterministic', 'grading fallback should declare deterministic status');
};

const runAcceptanceCountComplianceCoverage = async (): Promise<void> => {
  installMemoryStorage();

  const service = new DefaultPracticeService(new AsyncStoragePracticeRepository(), {
    initializeLlmRuntime: async () => {
      throw new Error('force deterministic generation for count compliance acceptance');
    },
  });

  const testCases = [
    { questionCount: 5 as const, difficultyMix: { easy: 2, medium: 2, hard: 1 } },
    { questionCount: 10 as const, difficultyMix: { easy: 2, medium: 3, hard: 5 } },
    { questionCount: 20 as const, difficultyMix: { easy: 6, medium: 8, hard: 6 } },
  ];

  for (const entry of testCases) {
    const set = await service.generateSet({
      subjectId: 'physics',
      chapterId: 'mechanics',
      topic: 'Kinematics',
      questionCount: entry.questionCount,
      difficultyMix: entry.difficultyMix,
    });

    assert(set.questions.length === entry.questionCount, `expected ${entry.questionCount} questions in generated set`);
    assert(set.questionCount === entry.questionCount, `expected set metadata questionCount=${entry.questionCount}`);
  }
};

const runAcceptanceOrchestratorPathMetadataCoverage = async (): Promise<void> => {
  installMemoryStorage();

  const telemetry = new RecordingTelemetrySink();
  const llmPayload = JSON.stringify({
    questions: Array.from({ length: 10 }, (_, index) => ({
      id: `orchestrator-meta-q-${index + 1}`,
      prompt: `Orchestrator metadata prompt ${index + 1}`,
      topic: 'Kinematics',
      difficulty: index < 2 ? 'easy' : index < 5 ? 'medium' : 'hard',
      answerKey: `orchestrator-meta-ans-${index + 1}`,
      rubricAnchor: {
        keyPoints: ['reasoning', 'final answer'],
      },
    })),
  });

  const service = new DefaultPracticeService(new AsyncStoragePracticeRepository(), {
    initializeLlmRuntime: createMockRuntime(llmPayload, {
      provider: 'openrouter',
      model: 'openrouter/meta-llama-3.1-8b-instruct',
      fallbackLevel: 1,
    }),
    telemetry,
  });

  await service.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 10,
    difficultyMix: { easy: 2, medium: 3, hard: 5 },
  });

  const event = telemetry.events.find((item) => item.operationType === 'practice_generate');
  assert(Boolean(event), 'expected practice_generate telemetry event for orchestrator path');
  assert(event?.provider === 'openrouter', 'orchestrator path metadata should include provider');
  assert(event?.model === 'openrouter/meta-llama-3.1-8b-instruct', 'orchestrator path metadata should include model');
  assert(event?.fallbackLevel === 1, 'orchestrator path metadata should include fallback level');
  assert(event?.fallbackStatus === 'provider', 'fallback status should reflect provider-level fallback');
};

const runAcceptanceConfidenceLabelingCoverage = async (): Promise<void> => {
  installMemoryStorage();

  const repository = new AsyncStoragePracticeRepository();
  const seedingService = new DefaultPracticeService(repository, {
    initializeLlmRuntime: async () => {
      throw new Error('seed deterministic set for confidence labeling acceptance');
    },
  });

  const set = await seedingService.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 5,
    difficultyMix: { easy: 2, medium: 2, hard: 1 },
  });

  const buildGradingPayload = (confidence: 'high' | 'medium' | 'low'): string =>
    JSON.stringify({
      isCorrect: true,
      score: 0.91,
      reasoningQuality: 'Reasoning quality is acceptable.',
      finalAnswerCheck: 'pass',
      misconceptionTag: '',
      explanation: 'Answer is semantically equivalent.',
      improvementHints: ['Add one explicit unit check.'],
      nextStepCue: 'Attempt a harder analogue.',
      confidence,
      verificationNote: `Model self-check confidence ${confidence}.`,
      degraded: false,
    });

  const verifyMappedConfidence = async (confidence: 'high' | 'medium' | 'low'): Promise<void> => {
    const gradingService = new DefaultPracticeService(repository, {
      initializeLlmRuntime: createMockRuntime((request) => {
        if (request.requestId.startsWith('practice_grade_request')) {
          return buildGradingPayload(confidence);
        }
        throw new Error('Unexpected generation request during confidence labeling acceptance');
      }, {
        verification: {
          confidence,
          note: `Verifier confidence ${confidence}.`,
          verifierProvider: 'openrouter',
        },
      }),
    });

    const result = await gradingService.submitAnswers({
      setId: set.id,
      submissions: [
        {
          questionId: set.questions[0].id,
          userAnswer: `confidence-${confidence}-answer`,
          solveTimeMs: 1111,
        },
      ],
    });

    const attempt = result.attempts.find((entry) => entry.questionId === set.questions[0].id);
    assert(Boolean(attempt), `expected attempt for ${confidence} confidence case`);
    assert(attempt?.confidence === confidence, `expected mapped confidence=${confidence}`);
  };

  await verifyMappedConfidence('high');
  await verifyMappedConfidence('medium');
  await verifyMappedConfidence('low');
};

const runAcceptanceGuardrailBehaviorCoverage = async (): Promise<void> => {
  installMemoryStorage();

  const repository = new AsyncStoragePracticeRepository();
  const telemetry = new RecordingTelemetrySink();

  const delayedGenerationPayload = JSON.stringify({
    questions: Array.from({ length: 5 }, (_, index) => ({
      id: `guardrail-latency-q-${index + 1}`,
      prompt: `Guardrail latency prompt ${index + 1}`,
      topic: 'Kinematics',
      difficulty: index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard',
      answerKey: `guardrail-latency-ans-${index + 1}`,
      rubricAnchor: {
        keyPoints: ['derive', 'final answer'],
      },
    })),
  });

  const generationService = new DefaultPracticeService(repository, {
    initializeLlmRuntime: async () => ({
      settings: defaultAppSettings,
      orchestrator: {
        solveWithMetadata: async (): Promise<{
          response: SolveResponse;
          fallbackLevel: number;
          retries: number;
          attempts: number;
          timeoutMs: number;
        }> => {
          await new Promise((resolve) => setTimeout(resolve, 8300));
          return {
            response: {
              text: delayedGenerationPayload,
              provider: 'gemini',
              model: 'gemini-2.5-flash',
              latencyMs: 8300,
            },
            fallbackLevel: 0,
            retries: 0,
            attempts: 1,
            timeoutMs: 9000,
          };
        },
      },
    }),
    telemetry,
  });

  const blockedSet = await generationService.generateSet({
    subjectId: 'physics',
    chapterId: 'mechanics',
    topic: 'Kinematics',
    questionCount: 5,
    difficultyMix: { easy: 2, medium: 2, hard: 1 },
  });

  assert(blockedSet.degraded === true, 'guardrail-latency generation should be degraded');
  const hasGuardrailTag = blockedSet.questions.every((question) =>
    (question.rubricAnchor?.commonPitfalls ?? []).some((entry) => entry.includes('guardrail_fallback_signal:LATENCY_CEILING_EXCEEDED')),
  );
  assert(hasGuardrailTag, 'guardrail-latency generation should include latency fallback signal tags');

  const generationEvent = telemetry.events.find((event) => event.operationType === 'practice_generate');
  assert(generationEvent?.budgetDecision === 'allow', 'generation telemetry should preserve budget decision for latency guardrail case');
  assert(generationEvent?.degraded === true, 'generation telemetry should report degraded under latency guardrail');

  const gradingService = new DefaultPracticeService(repository, {
    initializeLlmRuntime: createMockRuntime(JSON.stringify({
      isCorrect: true,
      score: 1,
      reasoningQuality: 'not used in blocked branch',
      finalAnswerCheck: 'pass',
      misconceptionTag: '',
      explanation: 'not used in blocked branch',
      improvementHints: ['not used'],
      nextStepCue: 'not used',
      confidence: 'high',
      verificationNote: 'not used',
      degraded: false,
    })),
    telemetry,
  });

  const veryLongAnswer = 'A'.repeat(10000);
  const gradingResult = await gradingService.submitAnswers({
    setId: blockedSet.id,
    submissions: [
      {
        questionId: blockedSet.questions[0].id,
        userAnswer: veryLongAnswer,
        solveTimeMs: 900,
      },
    ],
  });

  const gradingAttempt = gradingResult.attempts.find((entry) => entry.questionId === blockedSet.questions[0].id);
  assert(Boolean(gradingAttempt), 'expected grading attempt under blocked guardrail path');
  assert(gradingAttempt?.degraded === true, 'guardrail-blocked grading should be degraded');
  assert(
    (gradingAttempt?.verificationNote ?? '').includes('BUDGET_BLOCKED'),
    'guardrail-blocked grading should surface budget blocked verification note',
  );

  const gradingEvent = telemetry.events.find((event) => event.operationType === 'practice_grade');
  assert(gradingEvent?.budgetDecision === 'blocked', 'grading telemetry should report blocked budget decision');
  assert(gradingEvent?.degraded === true, 'grading telemetry should report degraded under guardrail block');
};

export const runPracticeIntegrationTests = async (): Promise<void> => {
  await runGenerateAndSubmitFlow();
  await runLlmGenerationHappyPath();
  await runLlmGenerationFallbackPath();
  await runLlmGradingHappyPath();
  await runLlmGradingDegradedFallbackPath();
  await runRepositoryAttemptBackwardCompatibility();
  await runRepositorySetListAndGetRegression();
  await runPracticeTelemetryEmissionCoverage();
  await runPracticeTelemetryFallbackCoverage();
  await runAcceptanceCountComplianceCoverage();
  await runAcceptanceOrchestratorPathMetadataCoverage();
  await runAcceptanceConfidenceLabelingCoverage();
  await runAcceptanceGuardrailBehaviorCoverage();
};
