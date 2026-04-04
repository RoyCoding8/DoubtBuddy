import { DoubtRecord, DoubtInputType } from '../../types/doubt';

const readTask11EvidenceEnvFlag = (): string | undefined => {
  if (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_TASK11_EVIDENCE_LOGS) {
    return process.env.EXPO_PUBLIC_TASK11_EVIDENCE_LOGS;
  }

  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_TASK11_EVIDENCE_LOGS;
};

const isTask11EvidenceEnabled = (): boolean => readTask11EvidenceEnvFlag() === '1';

const emitTask11Marker = (marker: string, payload: Record<string, unknown>): void => {
  console.log(`[TASK11_MANUAL] ${marker} ${JSON.stringify(payload)}`);
};

export const logTask11EvidenceStartup = (): void => {
  emitTask11Marker('startup', {
    enabled: isTask11EvidenceEnabled(),
    envFlag: readTask11EvidenceEnvFlag() ?? 'unset',
  });
};

export const logTask11SaveSnapshot = (input: {
  inputType: DoubtInputType;
  record: DoubtRecord;
}): void => {
  const enabled = isTask11EvidenceEnabled();

  if (!enabled) {
    emitTask11Marker('save_snapshot_skipped', {
      enabled,
      inputType: input.inputType,
      reason: 'logging_disabled',
    });
    return;
  }

  const { inputType, record } = input;
  emitTask11Marker('save_snapshot', {
    enabled,
    inputType,
    recordId: record.id,
    requestId: record.inference.requestId,
    provider: record.inference.provider,
    model: record.inference.model,
    fallbackLevel: record.inference.fallbackLevel,
    confidence: record.confidence,
    hasVerificationNote: Boolean(record.verificationNote),
    status: record.inference.status,
  });
};
