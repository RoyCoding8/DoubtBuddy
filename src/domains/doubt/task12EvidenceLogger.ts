const readTask12EvidenceEnvFlag = (): string | undefined => {
  if (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_TASK12_EVIDENCE_LOGS) {
    return process.env.EXPO_PUBLIC_TASK12_EVIDENCE_LOGS;
  }

  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_TASK12_EVIDENCE_LOGS;
};

const isTask12EvidenceEnabled = (): boolean => readTask12EvidenceEnvFlag() === '1';

const emitTask12Marker = (marker: string, payload: Record<string, unknown>): void => {
  console.log(`[TASK12_MANUAL] ${marker} ${JSON.stringify(payload)}`);
};

export const logTask12EvidenceStartup = (): void => {
  emitTask12Marker('startup', {
    enabled: isTask12EvidenceEnabled(),
    envFlag: readTask12EvidenceEnvFlag() ?? 'unset',
  });
};

export const logTask12ContextBeforeSolve = (turnCount: number): void => {
  if (!isTask12EvidenceEnabled()) {
    return;
  }

  emitTask12Marker('context_before_solve', {
    turnCount,
    hasPriorContext: turnCount > 0,
  });
};

export const logTask12FollowUpSaveAppend = (input: { postAppendTurnCount: number }): void => {
  if (!isTask12EvidenceEnabled()) {
    return;
  }

  emitTask12Marker('followup_save_append', {
    appendedTurnCount: 2,
    postAppendTurnCount: input.postAppendTurnCount,
  });
};

export const logTask12ResetCompleted = (postResetTurnCount: number): void => {
  if (!isTask12EvidenceEnabled()) {
    return;
  }

  emitTask12Marker('reset_completed', {
    postResetTurnCount,
  });
};
