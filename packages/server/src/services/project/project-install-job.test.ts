// Tests for installing dependencies as a job through ProjectService (R-PJ-13, R-PJ-12).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createEventBus, type ServerEvent } from '../../ports/event-bus-port.ts';
import type { ProcessOutput } from '../../ports/process-port.ts';
import type { ProcessPort } from '../../ports/process-port.ts';
import { STACKS } from '../../stacks/index.ts';
import { createConfigStore } from '../config/user-config.ts';
import {
  fakeSystem,
  makeTempDir,
  nodeFs,
  platform,
  silentLogger,
  writeSupportedProject,
} from '../workspace/test-support.ts';
import { createProjectService } from './project-service.ts';

/** A package manager the test drives: it prints lines and exits when told to. */
function controllableProcess() {
  let emitLine: (line: string) => void = () => undefined;
  let finish: (output: ProcessOutput) => void = () => undefined;
  const kill = vi.fn(() => {
    finish({ exitCode: 1, stdout: '', stderr: '', lines: [] });
    return Promise.resolve();
  });
  const spawn = vi.fn<ProcessPort['spawn']>(() => ({
    pid: 4242,
    onLine: (callback) => {
      emitLine = callback;
    },
    wait: () =>
      new Promise<ProcessOutput>((resolve) => {
        finish = resolve;
      }),
    kill,
  }));
  return {
    port: { spawn } satisfies ProcessPort,
    spawn,
    kill,
    line: (text: string) => {
      emitLine(text);
    },
    exit: (exitCode: number, lines: readonly string[] = []) => {
      finish({ exitCode, stdout: '', stderr: '', lines });
    },
  };
}

async function setup() {
  const temp = await makeTempDir();
  const projectDir = join(temp.dir, 'shop');
  const configDir = join(temp.dir, 'config');
  await mkdir(projectDir, { recursive: true });
  await mkdir(configDir, { recursive: true });
  await writeSupportedProject(projectDir);
  await writeFile(join(projectDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');

  const bus = createEventBus();
  const events: ServerEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const pm = controllableProcess();
  const runner = { start: vi.fn(() => Promise.resolve()), stop: vi.fn(() => Promise.resolve()) };
  const service = createProjectService({
    stacks: STACKS,
    fs: nodeFs,
    system: fakeSystem(1, new Set([1])),
    process: pm.port,
    config: await createConfigStore({ fs: nodeFs, dir: configDir, platform, logger: silentLogger }),
    logger: silentLogger,
    eventBus: bus,
    port: 4321,
    platform,
    templateDir: temp.dir,
    runnerService: runner,
  });
  await service.open(projectDir);
  await service.setTrusted(true);
  events.length = 0;
  const ofType = (type: string) => events.filter((e) => e.type === type);
  return { ...temp, projectDir, pm, runner, service, ofType };
}

/** What a finished install leaves on disk, so needsInstall turns false. */
async function writeInstalledPackages(projectDir: string): Promise<void> {
  for (const name of ['vite', 'react']) {
    await mkdir(join(projectDir, 'node_modules', name), { recursive: true });
    await writeFile(join(projectDir, 'node_modules', name, 'package.json'), '{}');
  }
}

describe('ProjectService install job', () => {
  it('answers with a job id at once, then shows output and finishes [R-PJ-13]', async () => {
    const t = await setup();
    try {
      const started = await t.service.install(['pnpm', 'install']);

      expect(started.ok).toBe(true);
      const jobId = started.ok ? started.value.jobId : '';
      expect(t.pm.spawn).toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.objectContaining({ cwd: t.projectDir }),
      );

      t.pm.line('Progress: resolved 120');
      await vi.waitFor(() => {
        expect(t.ofType('job.progress')).toHaveLength(1);
      });
      expect(t.ofType('job.progress')[0]?.payload).toMatchObject({
        jobId,
        lines: ['Progress: resolved 120'],
      });

      await writeInstalledPackages(t.projectDir);
      t.pm.exit(0);
      await vi.waitFor(() => {
        expect(t.ofType('job.completed')).toHaveLength(1);
      });
      const info = t.service.getProjectInfo();
      expect(info.ok && info.value.needsInstall).toBe(false);
      expect(t.ofType('project.changed')).toHaveLength(1);
      expect(t.runner.start).toHaveBeenCalled();
    } finally {
      await t.cleanup();
    }
  });

  it('a failed install ends the job with E028 and the last output lines [R-PJ-13]', async () => {
    const t = await setup();
    try {
      await t.service.install(['pnpm', 'install']);
      t.pm.exit(1, ['ERR_PNPM_FETCH_404', 'GET https://registry.npmjs.org/nope: Not Found']);

      await vi.waitFor(() => {
        expect(t.ofType('job.failed')).toHaveLength(1);
      });
      expect(t.ofType('job.failed')[0]?.payload).toMatchObject({
        error: {
          code: 'E028',
          details: [
            { message: 'ERR_PNPM_FETCH_404' },
            { message: 'GET https://registry.npmjs.org/nope: Not Found' },
          ],
        },
      });
    } finally {
      await t.cleanup();
    }
  });

  it('a wrong command fails at once, without a job [R-PJ-13, S-54]', async () => {
    const t = await setup();
    try {
      const started = await t.service.install(['npm', 'install']);

      expect(started).toMatchObject({ ok: false, error: { code: 'E016' } });
      expect(t.pm.spawn).not.toHaveBeenCalled();
    } finally {
      await t.cleanup();
    }
  });

  it('closing the project cancels the running install [R-PJ-12]', async () => {
    const t = await setup();
    try {
      await t.service.install(['pnpm', 'install']);

      await t.service.close();

      expect(t.pm.kill).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => {
        expect(t.ofType('job.cancelled')).toHaveLength(1);
      });
    } finally {
      await t.cleanup();
    }
  });

  it('installs in the project root with a 10 minute limit [S-50, S-52, S-55]', async () => {
    const t = await setup();
    try {
      await t.service.install(['pnpm', 'install']);
      expect(t.pm.spawn).toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.objectContaining({ cwd: t.projectDir, timeoutMs: 600000 }),
      );
    } finally {
      await t.cleanup();
    }
  });
});
