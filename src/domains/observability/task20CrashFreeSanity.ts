import { runTelemetryIntegrationTests } from '../../ai/orchestrator/telemetry.integration';
import { runOfflineQueueIntegrationTests } from '../doubt/offlineQueue.integration';
import { runPracticeIntegrationTests } from '../practice/practice.integration';
import { runRevisionSchedulerUnitTests } from '../revision/revisionScheduler.unit';
import { runProgressServiceUnitTests } from '../progress/progressService.unit';
import { writeTask20EvidenceJson } from './task20EvidenceArtifacts';

type SanityCheckResult = {
  flow: string;
  pass: boolean;
  error?: string;
};

const runOne = async (flow: string, runner: () => Promise<void> | void): Promise<SanityCheckResult> => {
  try {
    await runner();
    return { flow, pass: true };
  } catch (error) {
    return {
      flow,
      pass: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export interface Task20CrashFreeSanityEvidence {
  totalFlows: number;
  passedFlows: number;
  crashFreeRate: number;
  pass: boolean;
  artifactPath: string;
}

export const runTask20CrashFreeSanityEvidence = async (): Promise<Task20CrashFreeSanityEvidence> => {
  const checks: SanityCheckResult[] = [];

  checks.push(await runOne('telemetry', () => runTelemetryIntegrationTests()));
  checks.push(await runOne('offline_queue', () => runOfflineQueueIntegrationTests()));
  checks.push(await runOne('practice', () => runPracticeIntegrationTests()));
  checks.push(await runOne('revision', () => runRevisionSchedulerUnitTests()));
  checks.push(await runOne('progress', () => runProgressServiceUnitTests()));

  const totalFlows = checks.length;
  const passedFlows = checks.filter((check) => check.pass).length;
  const crashFreeRate = totalFlows === 0 ? 0 : passedFlows / totalFlows;
  const pass = passedFlows === totalFlows;

  const artifactPath = writeTask20EvidenceJson('task20-crash-free-sanity-report.json', {
    runner: 'task20CrashFreeSanityEvidence',
    totalFlows,
    passedFlows,
    crashFreeRate,
    pass,
    checks,
  });

  return {
    totalFlows,
    passedFlows,
    crashFreeRate,
    pass,
    artifactPath,
  };
};
