import { SolveRequest } from '../../ai/contracts/aiContracts';
import { buildGracefulFallback, GracefulFallbackMetadata } from '../../ai/orchestrator/gracefulFallback';
import { buildSystemPrompt } from '../../prompts';
import { AppSettings } from '../../types/settings';
import { DoubtRequest } from '../../types/doubt';
import { AIProviderError } from '../../ai/contracts/aiErrors';
import { ProviderId } from '../../types/settings';
import { createProviderAdapters } from '../../ai/providers';
import { InferenceOrchestrator } from '../../ai/orchestrator/inferenceOrchestrator';

export interface DoubtSolveResult {
  responseMarkdown: string;
  sourceModel: string;
  confidence: 'high' | 'medium' | 'low';
  verificationNote?: string;
  inference: {
    requestId: string;
    provider: ProviderId;
    model: string;
    fallbackLevel: number;
    retries: number;
    latencyMs: number;
    status: 'success' | 'fallback' | 'failed';
    errorCode?: string;
  };
}

export interface LocalFallbackDoubtResponse {
  responseMarkdown: string;
  confidence: 'low';
  verificationNote: string;
  sourceModel: 'local-template:v1';
  fallbackMetadata: GracefulFallbackMetadata;
  inference: {
    requestId: string;
    provider: 'local_template';
    model: 'v1';
    fallbackLevel: number;
    retries: number;
    latencyMs: number;
    status: 'fallback';
    errorCode?: string;
  };
}

const SOLVE_CONTEXT_TURN_WINDOW = 4;
const SOLVE_CONTEXT_TEXT_LIMIT = 360;

const compactTurnText = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= SOLVE_CONTEXT_TEXT_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, SOLVE_CONTEXT_TEXT_LIMIT)}…`;
};

const buildSolveSessionContext = (
  sessionContext?: Array<{ role: 'user' | 'assistant'; text: string }>,
): Array<{ role: 'user' | 'assistant'; text: string }> | undefined => {
  if (!sessionContext?.length) {
    return undefined;
  }

  return sessionContext.slice(-SOLVE_CONTEXT_TURN_WINDOW).map((turn) => ({
    role: turn.role,
    text: compactTurnText(turn.text),
  }));
};

const buildSolveInstruction = (mode: DoubtRequest['mode']): string => {
  if (mode === 'hint_only') {
    return 'Return only hints in short bullets, no final numeric answer unless explicitly asked.';
  }

  if (mode === 'quick_answer') {
    return 'Keep concise and practical with final answer if numerical.';
  }

  if (mode === 'explain_concept') {
    return 'Prioritize concept-first explanation in 5-10 concise bullets with one mini-example only if useful.';
  }

  return 'Provide full derivation with exam-focused clarity.';
};

const normalizeModelMarkdown = (text: string): string =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
    .replace(/Your operational mode has changed[\s\S]*$/gi, '')
    .replace(/^Here'?s[\s\S]{0,120}?\n/gi, '')
    .replace(/(^|\n)\d\)\s*(Problem Understanding|Given Data|Step-by-step Solution|Final Answer|Self-Check|Key Concept)/gi, '$1### $2')
    .replace(/\b(1\)|2\)|3\)|4\)|5\)|6\))(?=\S)/g, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

const normalizeProviderErrorCode = (error: unknown): string | undefined => {
  if (error instanceof AIProviderError) {
    return error.code;
  }

  return undefined;
};

const initializeSolveRuntime = async (settings: AppSettings): Promise<{
  orchestrator: InferenceOrchestrator;
}> => {
  const adapters = await createProviderAdapters(settings);

  return {
    orchestrator: new InferenceOrchestrator(adapters, {
      getSettings: async () => settings,
    }),
  };
};

export const solveDoubt = async (input: {
  request: DoubtRequest;
  settings: AppSettings;
  sessionContext?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<DoubtSolveResult> => {
  const { request, settings, sessionContext } = input;
  const solveSessionContext = buildSolveSessionContext(sessionContext);
  const prompt = buildSystemPrompt(request.subjectId, {
    chapter: request.chapterName,
    topic: request.topic,
    difficultyLevel: request.difficultyLevel,
    mode: request.mode,
  });

  const userInput = request.text?.trim() || 'Question provided via image. Solve using visible details only.';
  const composedUserPrompt = [
    `Solve mode: ${request.mode}`,
    `Solve instruction: ${buildSolveInstruction(request.mode)}`,
    '',
    'Question:',
    userInput,
  ].join('\n');

  const orchestratorRequest: SolveRequest = {
    requestId: `solve-${Date.now()}`,
    prompt: {
      system: prompt,
      user: composedUserPrompt,
    },
    mode: request.mode,
    qualityMode: settings.qualityMode,
    sessionContext: solveSessionContext,
    image: request.imageBase64
      ? {
          base64: request.imageBase64,
          mimeType: request.imageMimeType || 'image/jpeg',
        }
      : undefined,
  };

  try {
    const runtime = await initializeSolveRuntime(settings);
    const response = await runtime.orchestrator.solve(orchestratorRequest);
    const finalText = normalizeModelMarkdown(response.text);

    if (!finalText) {
      throw new Error('EMPTY_RESPONSE');
    }

    return {
      responseMarkdown: finalText,
      sourceModel: `${response.provider}:${response.model}`,
      confidence: response.verification?.confidence ?? 'low',
      verificationNote: response.verification?.note,
      inference: {
        requestId: orchestratorRequest.requestId,
        provider: response.provider,
        model: response.model,
        fallbackLevel: response.orchestration?.fallbackLevel ?? 0,
        retries: response.orchestration?.retries ?? 0,
        latencyMs: response.latencyMs,
        status: response.provider === 'local_template' ? 'fallback' : 'success',
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NO_API_KEY' || /Missing\s+Gemini\s+API\s+key/i.test(error.message)) {
        throw error;
      }
    }

    const fallback = await buildLocalFallbackDoubtResponse(orchestratorRequest, normalizeProviderErrorCode(error));

    return {
      responseMarkdown: fallback.responseMarkdown,
      sourceModel: `${fallback.sourceModel}|fallback_unverified`,
      confidence: fallback.confidence,
      verificationNote: fallback.verificationNote,
      inference: fallback.inference,
    };
  }
};

/**
 * Task 9: domain-level adapter for graceful degradation output.
 * Ensures fallback payload is explicitly labeled and carries retry CTA metadata.
 */
export const buildLocalFallbackDoubtResponse = async (
  request: SolveRequest,
  errorCode?: string,
): Promise<LocalFallbackDoubtResponse> => {
  const fallback = buildGracefulFallback(request);

  return {
    responseMarkdown: fallback.text,
    confidence: 'low',
    verificationNote: fallback.verificationNote,
    sourceModel: 'local-template:v1',
    fallbackMetadata: fallback.metadata,
    inference: {
      requestId: request.requestId,
      provider: 'local_template',
      model: 'v1',
      fallbackLevel: 0,
      retries: 0,
      latencyMs: 0,
      status: 'fallback',
      errorCode,
    },
  };
};
