// Installs the lefthook Git hooks (SPEC-02 section 11.3) when the repository has been initialised.
// Runs from the root "prepare" script, so `pnpm install` also works before `git init`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('.git')) {
  console.log(
    '[install-git-hooks] No .git directory yet. Run `git init`, then `pnpm install` again.',
  );
} else {
  const result = spawnSync('pnpm', ['exec', 'lefthook', 'install'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exitCode = result.status ?? 1;
}
