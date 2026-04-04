import { SolveRequest } from '../contracts/aiContracts';

export interface GracefulFallbackMetadata {
  degraded: true;
  unverified: true;
  retryAction: 'retry_solve';
  retryLabel: string;
  retryMessage: string;
}

export interface GracefulFallbackResult {
  text: string;
  verificationNote: string;
  metadata: GracefulFallbackMetadata;
}

const toSingleLine = (value: string | undefined): string => (value || '').replace(/\s+/g, ' ').trim();

const extractQuestion = (request: SolveRequest): string => {
  const candidate = toSingleLine(request.prompt.user);
  if (!candidate) {
    return 'Question details were unavailable from the failed provider calls.';
  }

  return candidate.length > 220 ? `${candidate.slice(0, 217)}...` : candidate;
};

export const buildGracefulFallback = (request: SolveRequest): GracefulFallbackResult => {
  const question = extractQuestion(request);
  const metadata: GracefulFallbackMetadata = {
    degraded: true,
    unverified: true,
    retryAction: 'retry_solve',
    retryLabel: 'Retry now',
    retryMessage: 'Tap Retry after connectivity/provider recovery for a fully verified AI solution.',
  };

  const text = [
    '⚠️ **Degraded fallback (unverified)**',
    '',
    'All remote AI providers are temporarily unavailable, so this is a local scaffold to keep your study flow moving.',
    '',
    '### Quick scaffold',
    `- **Question focus:** ${question}`,
    '- **Step 1:** List given values, unknowns, and units.',
    '- **Step 2:** Identify the core chapter formula/law that applies.',
    '- **Step 3:** Substitute values with consistent units.',
    '- **Step 4:** Solve algebra carefully and cross-check sign/units.',
    '- **Step 5:** Sanity-check magnitude against expected physical/chemical limits.',
    '',
    '### What to do next',
    `- **Retry CTA (` + `${metadata.retryAction}` + `):** ${metadata.retryMessage}`,
    '- If retry still fails, solve using this scaffold and verify with textbook examples.',
  ].join('\n');

  const verificationNote =
    `DEGRADED_UNVERIFIED_FALLBACK; retryAction=${metadata.retryAction}; retryLabel=${metadata.retryLabel}; retryable=true`;

  return {
    text,
    verificationNote,
    metadata,
  };
};
