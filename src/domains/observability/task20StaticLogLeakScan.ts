declare const require: (moduleName: string) => unknown;

const fs = require('fs') as {
  readdirSync: (path: string, options?: { withFileTypes?: boolean }) => Array<{ name: string; isDirectory: () => boolean }>;
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const path = require('path') as {
  join: (...parts: string[]) => string;
  resolve: (...parts: string[]) => string;
  extname: (targetPath: string) => string;
};

export interface StaticLogLeakScanFinding {
  filePath: string;
  lineNumber: number;
  line: string;
}

const LOG_STATEMENT_WITH_SENSITIVE_TOKEN =
  /console\.(log|warn|error)\([^\n]*(api[_-]?key|apikey|token\b|secret(?!_guard)|authorization|bearer)/i;

const collectCodeFiles = (rootDir: string): string[] => {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectCodeFiles(fullPath));
      return;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (extension === '.ts' || extension === '.tsx') {
      files.push(fullPath);
    }
  });

  return files;
};

export const runTask20StaticLogLeakScan = (srcRoot: string): { scannedFiles: number; findings: StaticLogLeakScanFinding[] } => {
  const absoluteRoot = path.resolve(srcRoot);
  const files = collectCodeFiles(absoluteRoot);
  const findings: StaticLogLeakScanFinding[] = [];

  files.forEach((filePath) => {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (LOG_STATEMENT_WITH_SENSITIVE_TOKEN.test(line)) {
        findings.push({
          filePath,
          lineNumber: index + 1,
          line: line.trim(),
        });
      }
    });
  });

  return {
    scannedFiles: files.length,
    findings,
  };
};
