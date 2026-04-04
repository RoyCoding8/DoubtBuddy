import { runTelemetryIntegrationTests } from '../../ai/orchestrator/telemetry.integration';
import { runOfflineQueueIntegrationTests } from '../doubt/offlineQueue.integration';
import { runPracticeIntegrationTests } from '../practice/practice.integration';
import { hasPotentialSecretLeak, installRuntimeLogRedactionGuard } from '../../services/logSecurityGuard';
import { writeTask20EvidenceJson } from './task20EvidenceArtifacts';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const toLine = (args: unknown[]): string =>
  args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }

      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

export interface Task20RuntimeGuardEvidence {
  guardEnabled: boolean;
  checkedLines: number;
  leakFindings: number;
  artifactPath: string;
}

export const runTask20RuntimeGuardEvidence = async (): Promise<Task20RuntimeGuardEvidence> => {
  const processLike = globalThis as { process?: { env?: Record<string, string | undefined> } };
  processLike.process = processLike.process ?? { env: {} };
  processLike.process.env = processLike.process.env ?? {};
  processLike.process.env.EXPO_PUBLIC_ENABLE_LOG_GUARD = '1';

  const capturedLines: string[] = [];
  const originalLog = console.log.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    capturedLines.push(toLine(args));
    originalLog(...args);
  };
  console.warn = (...args: unknown[]) => {
    capturedLines.push(toLine(args));
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    capturedLines.push(toLine(args));
    originalError(...args);
  };

  installRuntimeLogRedactionGuard();

  console.log('[TASK20_GUARD] start', {
    authorization: 'Bearer sk-1234567890abcdefghijklmnop',
    token: 'hf_abcdefghijklmnopqrstuvwx123456',
    apiKey: 'AIzaSyD3TERMINISTICKEYSTRING1234',
  });

  await runTelemetryIntegrationTests();
  console.log('[TASK20_GUARD] core_flow telemetry PASS');

  await runOfflineQueueIntegrationTests();
  console.log('[TASK20_GUARD] core_flow offline_queue PASS');

  await runPracticeIntegrationTests();
  console.log('[TASK20_GUARD] core_flow practice PASS');

  const leakFindings = capturedLines.filter((line) => hasPotentialSecretLeak(line));
  assert(leakFindings.length === 0, 'runtime guard evidence detected plaintext secret leaks in captured logs');

  const artifactPath = writeTask20EvidenceJson('task20-runtime-guard-report.json', {
    runner: 'task20RuntimeGuardEvidence',
    guardEnabled: true,
    representativeCoreFlows: ['telemetry', 'offline_queue', 'practice'],
    checkedLines: capturedLines.length,
    leakFindings: leakFindings.length,
    sampleLines: capturedLines.slice(0, 8),
  });

  return {
    guardEnabled: true,
    checkedLines: capturedLines.length,
    leakFindings: leakFindings.length,
    artifactPath,
  };
};
