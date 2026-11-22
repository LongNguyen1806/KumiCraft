// Project installation helpers (M-PJ).
import type { PackageManager } from '@kumicraft/shared';

import { err, ok, type Result } from '../../kernel/result.ts';
import { findPackage } from '../../lib/workspace-root.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { ProcessPort } from '../../ports/process-port.ts';
import type { JobContext, JobService } from '../jobs/job-service.ts';
import type { WorkspaceState } from './project-types.ts';

/** R-PJ-06: the project needs an install while one of its framework's packages is missing. */
export async function checkNeedsInstall(
  fs: FileSystemPort,
  root: string,
  packages: readonly string[] = ['vite', 'react'],
): Promise<boolean> {
  for (const name of packages) {
    const found = await findPackage(fs, root, name);
    if (found === undefined) return true;
  }
  return false;
}

export function getInstallCommand(pm?: PackageManager): string[] | undefined {
  if (pm === 'pnpm') return ['pnpm', 'install'];
  if (pm === 'npm') return ['npm', 'install'];
  if (pm === 'yarn') return ['yarn', 'install'];
  return undefined;
}

/** i18n key of the install step (V-60). */
export const INSTALL_STEP_KEY = 'jobs:install.running';

/** R-PJ-13: the command must be exactly the install command of the project (E016). */
export function checkInstallCommand(
  command: readonly string[],
  expectedCommand: readonly string[] | undefined,
): Result<{ readonly exe: string; readonly args: readonly string[] }> {
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
  return ok({ exe, args: command.slice(1) });
}

export async function runProjectInstall(
  process: ProcessPort,
  root: string,
  exe: string,
  args: readonly string[],
  ctx: JobContext,
): Promise<Result<void>> {
  const handle = process.spawn(exe, args, {
    cwd: root,
    timeoutMs: 600_000, // 10 minutes (E020)
  });
  handle.onLine((line) => {
    ctx.reportLine(line);
  });
  // Cancelling stops the whole process tree (R-PJ-13, E019).
  const onAbort = () => {
    void handle.kill();
  };
  ctx.signal.addEventListener('abort', onAbort, { once: true });

  try {
    const outcome = await handle.wait();
    if (outcome.exitCode === 124) {
      return err({ code: 'E020', params: { timeout: 600 } });
    }
    if (outcome.exitCode === 127) {
      // `spawnError` tells "not found" (ENOENT) from "found but cannot run" (ENOEXEC, EACCES).
      const why = outcome.spawnError === undefined ? {} : { spawnError: outcome.spawnError };
      return err({ code: 'E021', params: { missing: 'packageManager', command: exe, ...why } });
    }
    if (outcome.exitCode !== 0) {
      const details = outcome.lines.slice(-200).map((message) => ({ message }));
      return err({
        code: 'E028',
        details,
      });
    }
    return ok(undefined);
  } finally {
    ctx.signal.removeEventListener('abort', onAbort);
  }
}

/** Checks the command at once, then installs as a job (R-PJ-13, SPEC-03 section 4.2). */
export function startInstallJob(
  deps: { readonly jobs: JobService; readonly process: ProcessPort },
  root: string,
  command: readonly string[],
  expectedCommand: readonly string[] | undefined,
  onInstalled: () => Promise<void>,
): Result<{ readonly jobId: string }> {
  const checked = checkInstallCommand(command, expectedCommand);
  if (!checked.ok) return checked;
  const { exe, args } = checked.value;
  return deps.jobs.start('project.install', INSTALL_STEP_KEY, async (ctx) => {
    const installed = await runProjectInstall(deps.process, root, exe, args, ctx);
    if (!installed.ok) return installed;
    await onInstalled();
    return ok(undefined);
  });
}

export function startProjectInstall(
  current: WorkspaceState,
  deps: { readonly jobs: JobService; readonly process: ProcessPort },
  command: readonly string[],
  afterInstall: (root: string) => Promise<void>,
): Result<{ readonly jobId: string }> {
  if (current.status !== 'open') {
    return err({ code: 'E021', params: { missing: 'project' } });
  }
  if (!current.trusted) {
    return err({ code: 'E011', params: { path: current.root, reason: 'untrusted' } });
  }
  if (!current.support.packageManager) {
    return err({ code: 'E021', params: { missing: 'packageManager' } });
  }

  const { root } = current;
  const expectedCommand = getInstallCommand(current.support.packageManager);
  const installCwd = current.support.workspaceRoot ?? root;
  return startInstallJob(deps, installCwd, command, expectedCommand, () => afterInstall(root));
}
