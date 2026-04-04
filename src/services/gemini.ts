import { GeminiAdapter } from '../ai/providers/geminiAdapter';
import { SolveRequest } from '../ai/contracts/aiContracts';
import { getGeminiApiKey } from './apiKeyStorage';
import { AppSettings } from '../types/settings';

const toSolveRequest = (args: {
  systemPrompt: string;
  userPrompt: string;
  imageBase64?: string;
  imageMimeType?: string;
}): SolveRequest => ({
  requestId: 'legacy-gemini-call',
  prompt: {
    system: args.systemPrompt,
    user: args.userPrompt,
  },
  mode: 'step_by_step',
  qualityMode: 'balanced',
  ...(args.imageBase64
    ? {
        image: {
          base64: args.imageBase64,
          mimeType: args.imageMimeType ?? 'image/jpeg',
        },
      }
    : {}),
});

interface GenerateArgs {
  systemPrompt: string;
  userPrompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  apiKey: string;
  settings: AppSettings;
  signal: AbortSignal;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

interface StreamArgs extends Omit<GenerateArgs, 'maxOutputTokens'> {
  maxOutputTokens?: number;
}

const createGeminiAdapter = (settings: AppSettings, apiKeyFromArgs?: string, fetchImpl?: typeof fetch): GeminiAdapter =>
  new GeminiAdapter({
    model: settings.geminiModel,
    apiKeyResolver: async () => apiKeyFromArgs ?? (await getGeminiApiKey()),
    fetchImpl,
  });

/**
 * @deprecated Task 4 bridge: use GeminiAdapter via ProviderAdapter contract directly.
 */
export const generateGeminiText = async ({
  systemPrompt,
  userPrompt,
  imageBase64,
  imageMimeType,
  apiKey,
  settings,
  signal,
  fetchImpl,
}: GenerateArgs): Promise<string> => {
  const adapter = createGeminiAdapter(settings, apiKey, fetchImpl);
  const response = await adapter.generate(
    toSolveRequest({
      systemPrompt,
      userPrompt,
      imageBase64,
      imageMimeType,
    }),
    signal,
  );

  return response.text;
};

/**
 * @deprecated Task 4 bridge: use GeminiAdapter.stream via ProviderAdapter contract directly.
 */
export async function* streamGeminiText({
  systemPrompt,
  userPrompt,
  imageBase64,
  imageMimeType,
  apiKey,
  settings,
  signal,
  fetchImpl,
}: StreamArgs): AsyncGenerator<string> {
  const adapter = createGeminiAdapter(settings, apiKey, fetchImpl);
  if (!adapter.stream) {
    return;
  }

  yield* adapter.stream(
    toSolveRequest({
      systemPrompt,
      userPrompt,
      imageBase64,
      imageMimeType,
    }),
    signal,
  );
}
