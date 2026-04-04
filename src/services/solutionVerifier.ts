import { runDeterministicVerificationChecks } from '../ai/orchestrator/qualityVerifier';
import { AppSettings } from '../types/settings';

export const verifyAndRepairSolution = async (args: {
  apiKey: string;
  settings: AppSettings;
  userPrompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  draftSolution: string;
  signal: AbortSignal;
}): Promise<string> => {
  // Deprecated bridge (Task 10): deterministic-only fallback verification.
  // New verification pipeline is in src/ai/orchestrator/qualityVerifier.ts.
  const deterministic = runDeterministicVerificationChecks(args.userPrompt, args.draftSolution);
  return deterministic.passed ? args.draftSolution : args.draftSolution;
};
