// Opening, locking and trusting a project (R-PJ-07, R-PJ-08, R-PJ-15, R-PJ-19, V-105, S-80 to S-84).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  newWorkspaceFile,
  serializeWorkspaceFile,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ok } from '../shared/result.ts';
import type { ConfigStore } from '../shared/user-config.ts';
import { LOCK_FILE } from '../workspace/lock.ts';
import { createProjectReader } from '../workspace/project-reader.ts';
import {
  fakeSystem,
  makeTempDir,
  nodeFs,
  platform,
  silentLogger,
  writeSupportedProject,
} from '../workspace/test-support.ts';
import { createProjectService } from './project-service.ts';

let dir: string;
let cleanup: () => Promise<void>;
let trusted: Set<string>;
let runnerStarts: number;

const config: Pick<ConfigStore, 'isTrusted' | 'setTrusted' | 'settings'> = {
  isTrusted: (key) => trusted.has(`${key.id}|${key.path}|${key.links}`),
  setTrusted: (key, value) => {
    if (value) trusted.add(`${key.id}|${key.path}|${key.links}`);
    else trusted.delete(`${key.id}|${key.path}|${key.links}`);
    return Promise.resolve(ok(undefined));
  },
  settings: () => ({ editor: 'vscode', agent: { preferred: 'auto' } }),
};

const service = (pid = 1) =>
  createProjectService({
    fs: nodeFs,
    system: fakeSystem(pid, new Set([1, 2])),
    process: {
      spawn: () => ({
        pid: 1,
        onLine: () => undefined,
        wait: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '', lines: [] }),
        kill: () => Promise.resolve(),
      }),
    },
    config,
    logger: silentLogger,
    port: 5420 + pid,
    platform,
    templateDir: dir,
    runnerService: {
      start: () => {
        runnerStarts += 1;
        return Promise.resolve();
      },
      stop: () => Promise.resolve(),
    },
  });

const shop: WorkspaceFile = newWorkspaceFile({
  id: 'shop000001',
  name: 'Shop',
  createdAt: '2026-10-14T08:00:00.000Z',
  responsiveMode: 'desktop-first',
});

async function writeWorkspace(content: string | WorkspaceFile = shop) {
  await mkdir(join(dir, '.kumicraft'), { recursive: true });
  const text = typeof content === 'string' ? content : serializeWorkspaceFile(content);
  await writeFile(join(dir, WORKSPACE_FILE), text);
}

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  trusted = new Set();
  runnerStarts = 0;
});

afterEach(async () => {
  await cleanup();
});

describe('opening a project', () => {
  it('refuses a folder with a workspace.json but no supported project, without locking it [R-PJ-07]', async () => {
    await writeWorkspace();
    const project = service();

    const opened = await project.open(dir);

    expect(opened).toMatchObject({
      ok: false,
      error: { code: 'E001', params: { reasons: ['noPackageJson'] } },
    });
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(false);
    expect(runnerStarts).toBe(0);
  });

  it('refuses an unsupported Vite version even when workspace.json exists [R-PJ-07]', async () => {
    await writeSupportedProject(dir);
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    pkg.devDependencies['vite'] = '^6.0.0';
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
    await writeWorkspace();

    const opened = await service().open(dir);

    expect(opened).toMatchObject({
      ok: false,
      error: { code: 'E001', params: { reasons: ['viteVersion'] } },
    });
  });

  it('creates workspace.json and .kumicraft/.gitignore for a supported project [R-PJ-08]', async () => {
    await writeSupportedProject(dir);

    const opened = await service().open(dir);

    expect(opened).toMatchObject({ ok: true, value: { trusted: false, needsInstall: true } });
    expect(await nodeFs.exists(dir, WORKSPACE_FILE)).toBe(true);
    expect(await readFile(join(dir, '.kumicraft', '.gitignore'), 'utf8')).toBe('lock\ncache/\n');
  });

  it('puts every opened project in the recent list with its name [R-PJ-25]', async () => {
    await writeSupportedProject(dir);
    await writeWorkspace();
    const remembered: string[] = [];
    const project = createProjectService({
      fs: nodeFs,
      system: fakeSystem(1, new Set([1])),
      process: {
        spawn: () => ({
          onLine: () => undefined,
          wait: () => new Promise(() => undefined),
          kill: () => Promise.resolve(),
        }),
      },
      config,
      recents: {
        rememberProject: (path, name) => {
          remembered.push(`${name}|${path}`);
          return Promise.resolve(ok(undefined));
        },
      },
      logger: silentLogger,
      port: 5490,
      platform,
      templateDir: dir,
    });

    expect((await project.open(dir)).ok).toBe(true);
    expect(remembered).toEqual([`Shop|${dir}`]);
  });

  it('opens untrusted at first, locks the project and runs nothing [S-80, S-81, R-PJ-15]', async () => {
    await writeSupportedProject(dir);
    await writeWorkspace();
    const project = service();

    await project.open(dir);

    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(true);
    expect(createProjectReader(project, dir)()).toEqual({
      state: 'open',
      id: 'shop000001',
      name: 'Shop',
      trusted: false,
    });
    expect(runnerStarts).toBe(0);
  });

  it('refuses a project another running session holds [R-PJ-19]', async () => {
    await writeSupportedProject(dir);
    await writeWorkspace();
    await service(1).open(dir);

    expect(await service(2).open(dir)).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { port: 5421 } },
    });
  });

  it('reports a broken or 0.18 workspace.json and never rewrites it [V-105]', async () => {
    await writeSupportedProject(dir);
    for (const [text, reason] of [
      ['{ "broken', 'invalid'],
      [JSON.stringify({ schemaVersion: 1, id: 'ws1', name: 'Old' }), 'unsupportedVersion'],
    ] as const) {
      await writeWorkspace(text);
      const project = service();

      const opened = await project.open(dir);

      expect(opened).toMatchObject({ ok: false, error: { code: 'E003', params: { reason } } });
      expect(createProjectReader(project, dir)()).toMatchObject({
        state: 'error',
        error: { code: 'E003' },
      });
      expect(await readFile(join(dir, WORKSPACE_FILE), 'utf8')).toBe(text);
      await project.close();
    }
  });
});

describe('trust', () => {
  it('remembers a trust decision across sessions and starts the runner once trusted [S-82, R-RN-01]', async () => {
    await writeSupportedProject(dir);
    await writeWorkspace();
    const first = service(1);
    await first.open(dir);
    await first.setTrusted(true);
    await first.close();

    const reopened = await service(2).open(dir);

    expect(reopened).toMatchObject({ ok: true, value: { trusted: true } });
  });

  it('falls back to restricted mode when backends change while closed [S-84]', async () => {
    await writeSupportedProject(dir);
    await writeWorkspace();
    const first = service(1);
    await first.open(dir);
    await first.setTrusted(true);
    await first.close();
    await writeWorkspace({
      ...shop,
      backends: [{ id: 'api0000001', path: '../api', label: 'API' }],
    });

    expect(await service(2).open(dir)).toMatchObject({ ok: true, value: { trusted: false } });
  });
});

describe('the dev port of the Canvas', () => {
  it("saves the user's port in workspace.json and forgets it with 'auto' [R-RN-27]", async () => {
    await writeSupportedProject(dir);
    const project = service();
    await project.open(dir);

    expect(await project.patchProject({ devPort: 3000 })).toMatchObject({
      ok: true,
      value: { devPort: 3000 },
    });
    expect(JSON.parse(await readFile(join(dir, WORKSPACE_FILE), 'utf8'))).toMatchObject({
      devPort: 3000,
    });

    const cleared = await project.patchProject({ devPort: 'auto' });
    expect(cleared.ok && cleared.value.devPort).toBeUndefined();
    expect(await readFile(join(dir, WORKSPACE_FILE), 'utf8')).not.toContain('devPort');
  });
});

describe('a project opened under the old app name [R-PJ-26]', () => {
  it('moves .reactcraft to .kumicraft once and keeps the project id', async () => {
    await writeSupportedProject(dir);
    await mkdir(join(dir, '.reactcraft'), { recursive: true });
    await writeFile(join(dir, '.reactcraft', 'workspace.json'), serializeWorkspaceFile(shop));

    const opened = await service().open(dir);

    expect(opened).toMatchObject({ ok: true, value: { id: 'shop000001' } });
    expect(await nodeFs.exists(dir, '.reactcraft')).toBe(false);
  });

  it('leaves .reactcraft alone when the project already has .kumicraft', async () => {
    await writeSupportedProject(dir);
    await writeWorkspace();
    await mkdir(join(dir, '.reactcraft'), { recursive: true });

    await service().open(dir);

    expect(await nodeFs.exists(dir, '.reactcraft')).toBe(true);
  });
});
