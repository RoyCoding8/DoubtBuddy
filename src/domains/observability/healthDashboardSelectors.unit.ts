import { InferenceEvent } from './types';
import {
  OBSERVABILITY_SLA_TARGETS,
  isTextSolveP95WithinSla,
  selectErrorRate,
  selectP95LatencyMs,
  selectProviderDiagnosticsSummary,
} from './healthDashboardSelectors';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const event = (input: Partial<InferenceEvent>): InferenceEvent => ({
  requestId: input.requestId ?? 'req',
  timestamp: input.timestamp ?? new Date().toISOString(),
  provider: input.provider ?? 'gemini',
  model: input.model ?? 'model',
  latencyMs: input.latencyMs ?? 0,
  status: input.status ?? 'success',
  errorCode: input.errorCode,
  fallbackLevel: input.fallbackLevel ?? 0,
  tokenEstimate: input.tokenEstimate,
});

const runP95Selector = (): void => {
  const events: InferenceEvent[] = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((latency, index) =>
    event({
      requestId: `p95-${index}`,
      latencyMs: latency,
    }),
  );

  const p95 = selectP95LatencyMs(events);
  assert(p95 === 100, 'p95 selector should return 95th percentile latency value');
};

const runErrorRateSelector = (): void => {
  const events: InferenceEvent[] = [
    event({ requestId: 'er-1', status: 'success' }),
    event({ requestId: 'er-2', status: 'failed', errorCode: 'SERVER' }),
    event({ requestId: 'er-3', status: 'failed', errorCode: 'TIMEOUT' }),
    event({ requestId: 'er-4', status: 'success' }),
  ];

  const errorRate = selectErrorRate(events);
  assert(Math.abs(errorRate - 0.5) < 1e-9, 'error rate selector should compute failed/total ratio');
};

const runProviderSummarySelector = (): void => {
  const events: InferenceEvent[] = [
    event({ requestId: 's-1', provider: 'gemini', latencyMs: 100, status: 'success' }),
    event({ requestId: 's-2', provider: 'gemini', latencyMs: 200, status: 'failed', errorCode: 'SERVER' }),
    event({ requestId: 's-3', provider: 'openrouter', latencyMs: 50, status: 'success' }),
  ];

  const summary = selectProviderDiagnosticsSummary(events, 'gemini');
  assert(summary.provider === 'gemini', 'summary should be scoped to requested provider');
  assert(summary.attempts === 2, 'summary attempts should count provider events only');
  assert(summary.failedCount === 1, 'summary failed count should reflect provider failures');
  assert(summary.successCount === 1, 'summary success count should reflect provider successes');
  assert(Math.abs(summary.errorRate - 0.5) < 1e-9, 'summary error rate should be derived from provider events');
  assert(summary.p95LatencyMs === 200, 'summary p95 latency should be derived from provider event latencies');
};

const runSlaSelector = (): void => {
  const healthyEvents: InferenceEvent[] = [1500, 2000, 2800, 4000, 5000, 5500, 7000, 8200, 9000, 9800].map(
    (latency, index) =>
      event({
        requestId: `sla-ok-${index}`,
        latencyMs: latency,
      }),
  );

  const breachedEvents: InferenceEvent[] = [2000, 2100, 2200, 2300, 2400, 2500, 2600, 10_400, 11_000, 12_000].map(
    (latency, index) =>
      event({
        requestId: `sla-breach-${index}`,
        latencyMs: latency,
      }),
  );

  assert(
    isTextSolveP95WithinSla(healthyEvents, OBSERVABILITY_SLA_TARGETS.textSolveP95LatencyMs),
    'SLA selector should pass when p95 is within target',
  );
  assert(
    !isTextSolveP95WithinSla(breachedEvents, OBSERVABILITY_SLA_TARGETS.textSolveP95LatencyMs),
    'SLA selector should fail when p95 breaches target',
  );
};

export const runHealthDashboardSelectorUnitTests = (): void => {
  runP95Selector();
  runErrorRateSelector();
  runProviderSummarySelector();
  runSlaSelector();
};
