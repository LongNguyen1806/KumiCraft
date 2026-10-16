// Tests for ProjectService reacting to its files on disk (S-84, R-PJ-12, R-HI-05).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  newWorkspaceFile,
  serializeWorkspaceFile,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from '@reactcraft/shared';
import { describe, expect, it, vi } from 'vitest';

import { createEventBus, type ServerEvent } from '../ports/event-bus-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { createConfigStore } from '../shared/user-config.ts';
import {
  fakeSystem,
  makeTempDir,
  nodeFs,
  platform,
  silentLogger,
  writeSupportedProject,
} from '../workspace/test-support.ts';
import { createProjectService } from './project-service.ts';

const fakeProcess: ProcessPort = {
  spawn: () => ({
    pid: 1234,
    onLine: () => undefined,
    wait: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '', lines: [] }),
    kill: () => Promise.resolve(),
  }),
};

const sampleFile: WorkspaceFile = newWorkspaceFile({
  id: 'proj000001',
  name: 'Frontend',
  createdAt: '2026-10-14T08:00:00.000Z',
  responsiveMode: 'desktop-first',
  framework: 'vite-react',
});

async function setup() {
  const temp = await makeTempDir();
  const projectDir = join(temp.dir, 'work', 'frontend');
  const configDir = join(temp.dir, 'config');
  await mkdir(join(projectDir, '.reactcraft'), { recursive: true });
  await mkdir(configDir, { recursive: true });
  await writeSupportedProject(projectDir);
  await writeFile(join(projectDir, WORKSPACE_FILE), serializeWorkspaceFile(sampleFile));

  const bus = createEventBus();
  const events: ServerEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const watch = { start: vi.fn(), stop: vi.fn(() => Promise.resolve()) };
  const runner = { start: vi.fn(() => Promise.resolve()), stop: vi.fn(() => Promise.resolve()) };
  const history = { clear: vi.fn() };
  const config = await createConfigStore({
    fs: nodeFs,
    dir: configDir,
    platform,
    logger: silentLogger,
  });
  const service = createProjectService({
    fs: nodeFs,
    system: fakeSystem(1, new Set([1])),
    process: fakeProcess,
    config,
    logger: silentLogger,
    eventBus: bus,
    port: 4321,
    platform,
    templateDir: temp.dir,
    runnerService: runner,
    watch,
    history,
  });
  return { ...temp, projectDir, events, watch, runner, history, service };
}

describe('ProjectService and files changed on disk', () => {
  it('watches the project while it is open [R-PJ-12]', async () => {
    const t = await setup();
    try {
      await t.service.open(t.projectDir);
      expect(t.watch.start).toHaveBeenCalledWith(t.projectDir);

      await t.service.close();
      expect(t.watch.stop).toHaveBeenCalledTimes(1);
    } finally {
      await t.cleanup();
    }
  });

  it('a backend linked from outside puts the project back in restricted mode [S-84]', async () => {
    const t = await setup();
    try {
      await t.service.open(t.projectDir);
      await t.service.setTrusted(true);
      t.events.length = 0;
      t.runner.stop.mockClear();

      const pulled: WorkspaceFile = {
        ...sampleFile,
        backends: [{ id: 'back000001', path: '../shop-api', label: 'shop-api' }],
      };
      await writeFile(join(t.projectDir, WORKSPACE_FILE), serializeWorkspaceFile(pulled));
      await t.service.reloadWorkspaceFile();

      const info = t.service.getProjectInfo();
      expect(info.ok && info.value.trusted).toBe(false);
      expect(info.ok && info.value.backends.map((b) => b.label)).toEqual(['shop-api']);
      expect(t.events.map((e) => e.type)).toEqual(['project.changed', 'session.changed']);
      expect(t.runner.stop).toHaveBeenCalledTimes(1);
    } finally {
      await t.cleanup();
    }
  });

  it('a workspace.json equal to the one held is ReactCraft own write [R-HI-05]', async () => {
    const t = await setup();
    try {
      await t.service.open(t.projectDir);
      t.events.length = 0;

      await t.service.reloadWorkspaceFile();

      expect(t.events).toHaveLength(0);
    } finally {
      await t.cleanup();
    }
  });

  it('closing the project clears its history [R-HI-08]', async () => {
    const t = await setup();
    try {
      await t.service.open(t.projectDir);
      expect(t.history.clear).not.toHaveBeenCalled();

      await t.service.close();

      expect(t.history.clear).toHaveBeenCalledTimes(1);
    } finally {
      await t.cleanup();
    }
  });

  it('opening another project clears the history, opening the same one keeps it [R-HI-08]', async () => {
    const t = await setup();
    try {
      const otherDir = join(t.dir, 'work', 'admin');
      await mkdir(join(otherDir, '.reactcraft'), { recursive: true });
      await writeSupportedProject(otherDir);
      await writeFile(
        join(otherDir, WORKSPACE_FILE),
        serializeWorkspaceFile({ ...sampleFile, id: 'proj000002', name: 'Admin' }),
      );

      await t.service.open(t.projectDir);
      await t.service.open(t.projectDir);
      expect(t.history.clear).not.toHaveBeenCalled();

      await t.service.open(otherDir);
      expect(t.history.clear).toHaveBeenCalledTimes(1);
    } finally {
      await t.cleanup();
    }
  });
});
