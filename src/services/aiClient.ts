import { AppSettings } from '../types/settings';
import { DoubtRequest, StreamChunk } from '../types/doubt';
import { InferenceOrchestrator } from '../ai/orchestrator/inferenceOrchestrator';
import { createProviderAdapters, getRegisteredProviderIds } from '../ai/providers';
import { solveDoubt } from '../domains/doubt/doubtService';

export interface SolveStreamArgs {
  request: DoubtRequest;
  settings: AppSettings;
  signal?: AbortSignal;
}

export const initializeSolveRuntime = async (settings: AppSettings): Promise<{
  orchestrator: InferenceOrchestrator;
  providerIds: string[];
}> => {
  const adapters = await createProviderAdapters(settings);

  return {
    orchestrator: new InferenceOrchestrator(adapters, {
      getSettings: async () => settings,
    }),
    providerIds: getRegisteredProviderIds(adapters).filter((providerId) => providerId !== 'local_template'),
  };
};

export async function* streamSolveDoubt({ request, settings, signal }: SolveStreamArgs): AsyncGenerator<StreamChunk> {
  try {
    const solved = await solveDoubt({ request, settings });

    yield {
      text: solved.responseMarkdown,
      done: false,
      sourceModel: solved.sourceModel,
      confidence: solved.confidence,
      verificationNote: solved.verificationNote,
      inference: solved.inference,
    };
    yield {
      text: '',
      done: true,
      sourceModel: solved.sourceModel,
      inference: solved.inference,
    };
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('ABORTED');
    }

    throw error;
  }
}
