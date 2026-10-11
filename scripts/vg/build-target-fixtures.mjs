// `pnpm fixtures:check` (SPEC-07 WP-0.07): every target-project fixture installs from its lockfile
// and builds (`tsc` + `vite build`). Works on copies in a temporary folder, never in fixtures/
// (QC-06). The export-compat CI job (WP-2.12) builds on this.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIXTURES = 'fixtures/target-projects';
const isWindows = process.platform === 'win32';

const run = (command, args, cwd) =>
  spawnSync(command, args, { cwd, stdio: 'inherit', shell: isWindows }).status === 0;

const names = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const failed = [];

for (const name of names) {
  const dir = mkdtempSync(join(tmpdir(), `reactcraft-fixture-${name}-`));
  try {
    cpSync(join(FIXTURES, name), dir, { recursive: true });
    console.log(`\n== ${name}`);
    const isBuilt =
      run('pnpm', ['install', '--frozen-lockfile'], dir) && run('pnpm', ['build'], dir);
    if (!isBuilt) failed.push(name);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(
  failed.length === 0
    ? `\nfixtures:check: ${names.length} target project(s) build.`
    : `\nfixtures:check: failed: ${failed.join(', ')}`,
);
process.exitCode = failed.length === 0 ? 0 : 1;
