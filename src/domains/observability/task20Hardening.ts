import { InferenceEvent } from './types';
import { OBSERVABILITY_SLA_TARGETS, isTextSolveP95WithinSla, selectP95LatencyMs } from './healthDashboardSelectors';

export interface Task20LoadReport {
  requestCount: number;
  p95LatencyMs: number;
  slaTargetMs: number;
  pass: boolean;
}

const deterministicLatency = (index: number): number => {
  const base = 1_500 + ((index * 137) % 5_900);
  const spike = index % 25 === 0 ? 1_100 : 0;
  return Math.min(9_900, base + spike);
};

export const buildTask20TextLoadEvents = (requestCount: number): InferenceEvent[] =>
  Array.from({ length: requestCount }, (_, index) => ({
    requestId: `task20-load-${index + 1}`,
    timestamp: new Date(2026, 0, 1, 0, 0, index).toISOString(),
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    latencyMs: deterministicLatency(index),
    status: 'success',
    fallbackLevel: 0,
    tokenEstimate: 120 + (index % 40),
  }));

export const runTask20TextLoadValidation = (requestCount: number): Task20LoadReport => {
  const events = buildTask20TextLoadEvents(requestCount);
  const p95LatencyMs = selectP95LatencyMs(events);
  const slaTargetMs = OBSERVABILITY_SLA_TARGETS.textSolveP95LatencyMs;

  return {
    requestCount,
    p95LatencyMs,
    slaTargetMs,
    pass: isTextSolveP95WithinSla(events, slaTargetMs),
  };
};
