// Mac E021 report (2026-11-21): a new project has no lock file, so the package manager chosen at
// creation was lost on restart; a failed install must leave its reason in the log file.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseWorkspaceFile, type SupportReport, WORKSPACE_FILE } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appLogDir, createAppLog } from '../../adapters/log/app-log.ts';
import { LOG_FILE_NAME } from '../../adapters/log/rotating-file.ts';
import { createJobService } from '../jobs/job-service.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { fakeSystem, makeTempDir, nodeFs, silentLogger } from '../workspace/test-support.ts';
import { withKnownPackageManager } from './project-info.ts';
import { runProjectInstall } from './project-install.ts';
import { loadOrCreateWorkspaceFile } from './project-workspace-file.ts';

const SUPPORT: SupportReport = { supported: true, reasons: [], versions: {}, language: 'ts' };

let dir: string;
let cleanup: () => Promise<void>;
beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});
afterEach(async () => {
  await cleanup();
});

describe('the package manager of a project survives a restart', () => {
  it('saves the one chosen at creation in workspace.json', async () => {
    const deps = { fs: nodeFs, system: fakeSystem(1, new Set()) };
    const made = await loadOrCreateWorkspaceFile(deps, dir, { ...SUPPORT, packageManager: 'pnpm' });
    expect(made.ok && made.value.packageManager).toBe('pnpm');
    const saved = parseWorkspaceFile(JSON.parse(await readFile(join(dir, WORKSPACE_FILE), 'utf8')));
    expect(saved).toMatchObject({ ok: true, value: { packageManager: 'pnpm' } });
  });

  it('takes the lock file, then the saved one, then one the computer has', async () => {
    const installed = () => Promise.resolve('npm' as const);
    const lock = { ...SUPPORT, packageManager: 'yarn' as const };
    expect(
      (await withKnownPackageManager(lock, { packageManager: 'pnpm' }, {})).packageManager,
    ).toBe('yarn');
    const saved = await withKnownPackageManager(
      SUPPORT,
      { packageManager: 'pnpm' },
      {
        installedPackageManager: installed,
      },
    );
    expect(saved.packageManager).toBe('pnpm');
    const older = await withKnownPackageManager(
      SUPPORT,
      {},
      { installedPackageManager: installed },
    );
    expect(older.packageManager).toBe('npm');
    expect((await withKnownPackageManager(SUPPORT, {}, {})).packageManager).toBeUndefined();
  });
});

function recordingLogger(): { logger: LoggerPort; warnings: Record<string, unknown>[] } {
  const warnings: Record<string, unknown>[] = [];
  const logger: LoggerPort = {
    ...silentLogger,
    warn: (fields, message) => warnings.push({ ...fields, message }),
  };
  return { logger, warnings };
}

describe('a failed install says why, in the error and in the log', () => {
  const cannotRun: ProcessPort = {
    spawn: () => ({
      onLine: () => undefined,
      wait: () =>
        Promise.resolve({ exitCode: 127, stdout: '', stderr: '', lines: [], spawnError: 'EACCES' }),
      kill: () => Promise.resolve(),
    }),
  };

  it('keeps the command and the spawn error in E021', async () => {
    const ctx = { signal: new AbortController().signal, reportLine: () => undefined };
    const result = await runProjectInstall(cannotRun, dir, 'pnpm', ['install'], ctx);
    expect(result.ok ? undefined : result.error).toEqual({
      code: 'E021',
      params: { missing: 'packageManager', command: 'pnpm', spawnError: 'EACCES' },
    });
  });

  it('logs every failed job with its reason and last lines', async () => {
    const { logger, warnings } = recordingLogger();
    const jobs = createJobService({ system: fakeSystem(1, new Set()), logger });
    const ctxRun = jobs.start('project.install', 'jobs:install.running', async (ctx) => {
      ctx.reportLine('ERR_PNPM_SOMETHING');
      return runProjectInstall(cannotRun, dir, 'pnpm', ['install'], ctx);
    });
    expect(ctxRun.ok).toBe(true);
    await expect.poll(() => warnings.length).toBe(1);
    expect(warnings[0]).toMatchObject({
      message: 'job failed',
      kind: 'project.install',
      code: 'E021',
      params: { spawnError: 'EACCES' },
      lastLines: ['ERR_PNPM_SOMETHING'],
    });
  });
});

describe('the log file', () => {
  it('goes to the user log folder, never from a test that gives its own config folder', () => {
    expect(appLogDir({})).toMatch(/kumicraft/i);
    expect(appLogDir({ configDir: dir })).toBeUndefined();
    expect(appLogDir({ configDir: dir, logDir: dir })).toBe(dir);
  });

  it('writes warnings to kumicraft.log', async () => {
    const log = createAppLog({ level: 'silent', logDir: dir });
    log.port.warn({ code: 'E021' }, 'job failed');
    const text = await readFile(join(dir, LOG_FILE_NAME), 'utf8');
    expect(text).toContain('"code":"E021"');
    expect(text).not.toContain('"hostname"');
  });
});
