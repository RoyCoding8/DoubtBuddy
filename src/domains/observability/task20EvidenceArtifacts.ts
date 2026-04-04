declare const require: (moduleName: string) => unknown;

const fs = require('fs') as {
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
  writeFileSync: (path: string, data: string, encoding: 'utf8') => void;
};
const path = require('path') as {
  resolve: (...parts: string[]) => string;
  join: (...parts: string[]) => string;
};

const evidenceDir = path.resolve(process.cwd(), '.forge', 'artifacts', 'evidence');

const ensureEvidenceDir = (): void => {
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
};

export const writeTask20EvidenceArtifact = (fileName: string, contents: string): string => {
  ensureEvidenceDir();
  const filePath = path.join(evidenceDir, fileName);
  fs.writeFileSync(filePath, contents, 'utf8');
  return filePath;
};

export const writeTask20EvidenceJson = <T>(fileName: string, payload: T): string =>
  writeTask20EvidenceArtifact(fileName, `${JSON.stringify(payload, null, 2)}\n`);
