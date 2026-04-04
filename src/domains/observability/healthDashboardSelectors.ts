import { ProviderId } from '../../types/settings';
import { InferenceEvent } from './types';

export interface ProviderDiagnosticsSummary {
  provider: ProviderId;
  attempts: number;
  successCount: number;
  failedCount: number;
  errorRate: number;
  p95LatencyMs: number;
}

export const OBSERVABILITY_SLA_TARGETS = {
  textSolveP95LatencyMs: 10_000,
} as const;

const sortAscending = (values: number[]): number[] => [...values].sort((a, b) => a - b);

export const selectProviderEvents = (events: readonly InferenceEvent[], provider: ProviderId): InferenceEvent[] =>
  events.filter((event) => event.provider === provider);

export const selectErrorRate = (events: readonly InferenceEvent[]): number => {
  if (events.length === 0) {
    return 0;
  }

  const failed = events.reduce((count, event) => (event.status === 'failed' ? count + 1 : count), 0);
  return failed / events.length;
};

export const selectP95LatencyMs = (events: readonly InferenceEvent[]): number => {
  if (events.length === 0) {
    return 0;
  }

  const sortedLatencies = sortAscending(events.map((event) => Math.max(0, event.latencyMs)));
  const index = Math.ceil(sortedLatencies.length * 0.95) - 1;
  return sortedLatencies[Math.max(0, Math.min(index, sortedLatencies.length - 1))];
};

export const isTextSolveP95WithinSla = (
  events: readonly InferenceEvent[],
  targetMs = OBSERVABILITY_SLA_TARGETS.textSolveP95LatencyMs,
): boolean => selectP95LatencyMs(events) <= targetMs;

export const selectProviderDiagnosticsSummary = (
  events: readonly InferenceEvent[],
  provider: ProviderId,
): ProviderDiagnosticsSummary => {
  const providerEvents = selectProviderEvents(events, provider);
  const failedCount = providerEvents.reduce((count, event) => (event.status === 'failed' ? count + 1 : count), 0);
  const attempts = providerEvents.length;

  return {
    provider,
    attempts,
    successCount: attempts - failedCount,
    failedCount,
    errorRate: selectErrorRate(providerEvents),
    p95LatencyMs: selectP95LatencyMs(providerEvents),
  };
};
