const readTask19EvidenceEnvFlag = (): string | undefined => {
  if (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_TASK19_EVIDENCE_LOGS) {
    return process.env.EXPO_PUBLIC_TASK19_EVIDENCE_LOGS;
  }

  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_TASK19_EVIDENCE_LOGS;
};

const isTask19EvidenceEnabled = (): boolean => readTask19EvidenceEnvFlag() === '1';

const emitTask19Marker = (marker: string, payload: Record<string, unknown>): void => {
  if (!isTask19EvidenceEnabled()) {
    return;
  }

  console.log(`[TASK19_MANUAL] ${marker} ${JSON.stringify(payload)}`);
};

export const logTask19ConfidenceRendered = (input: {
  confidence: 'high' | 'medium' | 'low';
  disclaimerShown: boolean;
  traceId: string;
}): void => {
  emitTask19Marker('confidence_rendered', {
    confidence: input.confidence,
    disclaimerShown: input.disclaimerShown,
    traceId: input.traceId,
  });
};

export const logTask19ReportActionSaved = (input: {
  traceId: string;
  storedIssueId: string;
  traceIdPersistedMatch: boolean;
}): void => {
  emitTask19Marker('report_action_saved', {
    traceId: input.traceId,
    storedIssueId: input.storedIssueId,
    traceIdPersistedMatch: input.traceIdPersistedMatch,
  });
};
