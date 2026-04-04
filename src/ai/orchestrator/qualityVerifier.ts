import { ProviderAdapter, ProviderId, SolveRequest, SolveResponse } from '../contracts/aiContracts';

export type VerificationConfidence = 'high' | 'medium' | 'low';

export interface VerificationAssessment {
  confidence: VerificationConfidence;
  note: string;
  verifierProvider?: ProviderId;
}

interface QualityVerifierInput {
  request: SolveRequest;
  candidate: SolveResponse;
  solverProvider: ProviderId;
  providerChain: ProviderId[];
}

interface VerifierVerdict {
  verdict: 'pass' | 'revise';
  issues: string[];
}

interface DeterministicVerificationResult {
  passed: boolean;
  score: number;
  note: string;
}

const VERIFIER_SYSTEM_PROMPT = [
  'You are a strict IIT-JEE solution verifier.',
  'Verify the draft solution against the question.',
  'Return EXACTLY one JSON object and nothing else.',
  'Schema:',
  '{"verdict":"pass"|"revise","issues":["..."]}',
  'Rules:',
  '- pass only when core reasoning appears correct and no suspicious inconsistency exists.',
  '- revise if a key step is missing, numeric consistency looks wrong, or unit/sign looks suspicious.',
  '- Keep issues short and concrete.',
].join('\n');

const parseVerifierVerdict = (raw: string): VerifierVerdict | null => {
  const segment = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;

  try {
    const parsed = JSON.parse(segment) as {
      verdict?: unknown;
      issues?: unknown;
    };

    if (parsed.verdict !== 'pass' && parsed.verdict !== 'revise') {
      return null;
    }

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((item): item is string => typeof item === 'string').map((issue) => issue.trim())
      : [];

    return {
      verdict: parsed.verdict,
      issues,
    };
  } catch {
    return null;
  }
};

const runVerificationPrompt = async (args: {
  provider: ProviderAdapter;
  providerId: ProviderId;
  request: SolveRequest;
  candidate: SolveResponse;
}): Promise<VerifierVerdict | null> => {
  const verifyRequest: SolveRequest = {
    requestId: `${args.request.requestId}:verify:${args.providerId}`,
    mode: 'quick_answer',
    qualityMode: 'fast',
    prompt: {
      system: VERIFIER_SYSTEM_PROMPT,
      user: [
        'Question:',
        args.request.prompt.user,
        '',
        'Draft solution:',
        args.candidate.text,
        '',
        'Evaluate now.',
      ].join('\n'),
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const verificationResponse = await args.provider.generate(verifyRequest, controller.signal);
    return parseVerifierVerdict(verificationResponse.text);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const runDeterministicVerificationChecks = (question: string, solution: string): DeterministicVerificationResult => {
  const trimmed = solution.trim();
  const checks = [
    trimmed.length >= 80,
    /[=+\-*/^]|\\frac|\\sqrt|\d/.test(solution),
    /(final answer|therefore|hence|ans\s*[:=]|\\boxed)/i.test(solution),
    !/(cannot|can't|unable)\s+(view|see)\s+(image|photo)/i.test(solution),
    !/(i am not sure|might be wrong|guessing)/i.test(solution),
  ];

  const questionHasUnits = /(kg|g|m\b|cm|mm|s\b|min|hour|n\b|j\b|w\b|pa|mol|l\b|ml|°c|k\b|volt|amp)/i.test(
    question,
  );
  const solutionHasUnits = /(kg|g|m\b|cm|mm|s\b|min|hour|n\b|j\b|w\b|pa|mol|l\b|ml|°c|k\b|volt|amp)/i.test(
    solution,
  );

  if (questionHasUnits) {
    checks.push(solutionHasUnits);
  }

  const score = checks.filter(Boolean).length;
  const passed = score >= 4;

  return {
    passed,
    score,
    note: passed
      ? `Deterministic consistency checks passed (${score}/${checks.length}).`
      : `Weak deterministic verification signal (${score}/${checks.length}).`,
  };
};

export class DefaultQualityVerifier {
  private readonly providers: Partial<Record<ProviderId, ProviderAdapter>>;

  constructor(providers: Partial<Record<ProviderId, ProviderAdapter>>) {
    this.providers = providers;
  }

  async verify(input: QualityVerifierInput): Promise<VerificationAssessment> {
    if (input.solverProvider === 'local_template') {
      return {
        confidence: 'low',
        note: 'Fallback template response is unverified.',
      };
    }

    const alternateProviderId = input.providerChain.find(
      (providerId) => providerId !== input.solverProvider && providerId !== 'local_template' && this.providers[providerId],
    );

    if (alternateProviderId) {
      const alternate = this.providers[alternateProviderId];
      if (alternate) {
        const alternateVerdict = await runVerificationPrompt({
          provider: alternate,
          providerId: alternateProviderId,
          request: input.request,
          candidate: input.candidate,
        });

        if (alternateVerdict?.verdict === 'pass') {
          return {
            confidence: 'high',
            note: 'Cross-provider verification passed.',
            verifierProvider: alternateProviderId,
          };
        }

        if (alternateVerdict?.verdict === 'revise') {
          return {
            confidence: 'low',
            note: `Cross-provider verifier flagged issues${alternateVerdict.issues.length ? `: ${alternateVerdict.issues.join('; ')}` : '.'}`,
            verifierProvider: alternateProviderId,
          };
        }
      }
    }

    const sameProvider = this.providers[input.solverProvider];
    if (sameProvider) {
      const sameProviderVerdict = await runVerificationPrompt({
        provider: sameProvider,
        providerId: input.solverProvider,
        request: input.request,
        candidate: input.candidate,
      });

      if (sameProviderVerdict?.verdict === 'pass') {
        return {
          confidence: 'medium',
          note: 'Same-provider verification passed.',
          verifierProvider: input.solverProvider,
        };
      }

      if (sameProviderVerdict?.verdict === 'revise') {
        return {
          confidence: 'low',
          note: `Same-provider verifier flagged issues${sameProviderVerdict.issues.length ? `: ${sameProviderVerdict.issues.join('; ')}` : '.'}`,
          verifierProvider: input.solverProvider,
        };
      }
    }

    const deterministic = runDeterministicVerificationChecks(input.request.prompt.user, input.candidate.text);
    return {
      confidence: deterministic.passed ? 'medium' : 'low',
      note: deterministic.note,
    };
  }
}
