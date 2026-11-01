import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = join(root, 'pstack', 'skills');
if (!existsSync(skillsDir)) throw new Error('pstack/skills is missing');
const entries = readdirSync(skillsDir, { withFileTypes: true });
const names = new Set();
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const file = join(skillsDir, entry.name, 'SKILL.md');
  if (!existsSync(file)) continue;
  const content = readFileSync(file, 'utf8');
  const match = /^---\r?\n[\s\S]*?^name:\s*([^\r\n]+)$/m.exec(content);
  if (!match) throw new Error(`Invalid skill frontmatter: ${entry.name}`);
  const name = match[1].trim().replace(/^['"]|['"]$/g, '');
  if (name !== entry.name || names.has(name)) throw new Error(`Invalid or repeated skill: ${name}`);
  names.add(name);
}
const required = ['poteto-mode', 'setup-pstack', 'figure-it-out', 'principle-foundational-thinking', 'principle-subtract-before-you-add', 'principle-build-the-lever', 'principle-prove-it-works'];
for (const name of required) if (!names.has(name)) throw new Error(`Missing critical skill: ${name}`);
if (names.size < 58) throw new Error(`Expected at least 58 skills, found ${names.size}`);
if (!existsSync(join(root, 'pstack', 'LICENSE'))) throw new Error('Missing pstack license');
console.log(`Verified ${names.size} pstack skills with source files and license`);
