import { execFileSync } from 'child_process';
import path from 'path';

describe('shared experiment module', () => {
  it('backend and frontend copies match shared/experiment', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    expect(() =>
      execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'sync-shared.mjs'), '--check'], { stdio: 'pipe' })
    ).not.toThrow();
  });
});
