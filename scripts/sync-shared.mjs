// Copies the canonical experiment module (shared/experiment) into the backend and
// frontend packages. Each package builds and deploys on its own (separate Docker
// contexts, separate tsconfig roots), so the module is vendored rather than imported
// across package boundaries. backend/tests/shared-sync.test.ts fails if a copy drifts.
//
// Usage: node scripts/sync-shared.mjs [--check]

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'shared', 'experiment');
const targets = [join(root, 'backend', 'src', 'shared', 'experiment'), join(root, 'frontend', 'src', 'shared', 'experiment')];
export const HEADER = '// GENERATED FILE - edit shared/experiment and run `node scripts/sync-shared.mjs`.\n';

const check = process.argv.includes('--check');
const files = readdirSync(source).filter((f) => f.endsWith('.ts'));
let drift = false;

for (const target of targets) {
  if (!check) {
    if (existsSync(target)) rmSync(target, { recursive: true });
    mkdirSync(target, { recursive: true });
  }
  for (const file of files) {
    const expected = HEADER + readFileSync(join(source, file), 'utf8');
    const dest = join(target, file);
    if (check) {
      const actual = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
      if (actual !== expected) {
        drift = true;
        console.error(`out of date: ${dest}`);
      }
    } else {
      writeFileSync(dest, expected);
    }
  }
}

if (check && drift) process.exit(1);
console.log(check ? 'shared module copies are up to date' : `synced ${files.length} files to ${targets.length} packages`);
