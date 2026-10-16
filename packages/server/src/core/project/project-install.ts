// Project installation helpers (M-PJ).
import type { PackageManager } from '@reactcraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { err, ok, type Result } from '../shared/result.ts';

export async function checkNeedsInstall(fs: FileSystemPort, root: string): Promise<boolean> {
  const hasVite = await fs.exists(root, 'node_modules/vite/package.json');
  const hasReact = await fs.exists(root, 'node_modules/react/package.json');
  return !hasVite || !hasReact;
}

export function getInstallCommand(pm?: PackageManager): string[] | undefined {
  if (pm === 'pnpm') return ['pnpm', 'install'];
  if (pm === 'npm') return ['npm', 'install'];
  if (pm === 'yarn') return ['yarn', 'install'];
  return undefined;
}

export async function runProjectInstall(
  process: ProcessPort,
  root: string,
  command: readonly string[],
  expectedCommand: readonly string[] | undefined,
): Promise<Result<void>> {
  const isMismatch =
    !expectedCommand ||
    command.length !== expectedCommand.length ||
    command.some((part, i) => part !== expectedCommand[i]);

  if (isMismatch) {
    return err({ code: 'E016', params: { reason: 'commandMismatch' } });
  }

  const exe = command[0];
  if (!exe) {
    return err({ code: 'E016', params: { reason: 'commandMismatch' } });
  }

  const handle = process.spawn(exe, command.slice(1), {
    cwd: root,
    timeoutMs: 600_000, // 10 minutes (E020)
  });

  const outcome = await handle.wait();
  if (outcome.exitCode === 124) {
    return err({ code: 'E020', params: { timeout: 600 } });
  }
  if (outcome.exitCode === 127) {
    return err({ code: 'E021', params: { missing: 'packageManager' } });
  }
  if (outcome.exitCode !== 0) {
    const details = outcome.lines.slice(-200).map((message) => ({ message }));
    return err({
      code: 'E028',
      details,
    });
  }

  return ok(undefined);
}
