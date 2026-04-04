import { hasPotentialSecretLeak, redactSensitiveText } from '../../services/logSecurityGuard';
import { runTask20CrashFreeSanityEvidence } from './task20CrashFreeSanity';
import { runTask20IntegrationLoadEvidence } from './task20IntegrationLoadEvidence';
import { runTask20RuntimeGuardEvidence } from './task20RuntimeGuardEvidence';
import { runTask20StaticLogLeakScan } from './task20StaticLogLeakScan';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const runLoadCheck = async (): Promise<void> => {
  const loadReport = await runTask20IntegrationLoadEvidence(500);
  assert(loadReport.requestCount >= 500, 'Task 20 load run must simulate at least 500 text requests');
  assert(loadReport.pass, `Task 20 SLA breach: p95 ${loadReport.p95LatencyMs}ms > ${loadReport.slaTargetMs}ms`);
  console.log(
    '[TASK20] load_check',
    JSON.stringify({
      requestCount: loadReport.requestCount,
      p95LatencyMs: loadReport.p95LatencyMs,
      slaTargetMs: loadReport.slaTargetMs,
      pass: loadReport.pass,
      artifactPath: loadReport.artifactPath,
    }),
  );
};

const runSecretLeakGuards = (): void => {
  const riskySamples = [
    'Authorization: Bearer sk-1234567890abcdefghijklmnop',
    'apiKey=AIzaSyD3TERMINISTICKEYSTRING1234',
    'token:hf_abcdefghijklmnopqrstuvwx123456',
  ];

  riskySamples.forEach((sample, index) => {
    assert(hasPotentialSecretLeak(sample), `Expected sensitive sample ${index + 1} to be detected`);
    const redacted = redactSensitiveText(sample);
    assert(!hasPotentialSecretLeak(redacted), `Expected redacted sample ${index + 1} to be leak-free`);
  });

  const safeSample = 'provider=gemini status=ok latencyMs=4500';
  assert(!hasPotentialSecretLeak(safeSample), 'Non-sensitive logs should not be flagged');
  console.log('[TASK20] secret_guard_check', JSON.stringify({ checked: riskySamples.length + 1, pass: true }));
};

const runStaticScan = (): void => {
  const scan = runTask20StaticLogLeakScan('src');
  assert(scan.findings.length === 0, `Static log leak scan found ${scan.findings.length} suspicious console statements`);
  console.log('[TASK20] static_log_scan', JSON.stringify({ scannedFiles: scan.scannedFiles, findings: scan.findings.length }));
};

const runRuntimeGuardEvidence = async (): Promise<void> => {
  const report = await runTask20RuntimeGuardEvidence();
  assert(report.guardEnabled, 'runtime log guard evidence must run with guard enabled');
  assert(report.leakFindings === 0, 'runtime log guard evidence must report zero plaintext leak findings');
  console.log('[TASK20] runtime_guard_check', JSON.stringify(report));
};

const runCrashFreeSanity = async (): Promise<void> => {
  const report = await runTask20CrashFreeSanityEvidence();
  assert(report.pass, 'crash-free sanity runner requires all representative core flows to pass');
  console.log('[TASK20] crash_free_sanity', JSON.stringify(report));
};

const main = async (): Promise<void> => {
  try {
    await runLoadCheck();
    runSecretLeakGuards();
    runStaticScan();
    await runRuntimeGuardEvidence();
    await runCrashFreeSanity();
    console.log('PASS: task 20 hardening checks');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL: task 20 hardening checks');
    console.error(message);
    process.exit(1);
  }
};

void main();
