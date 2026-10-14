import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  newWorkspaceFile,
  serializeWorkspaceFile,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ok } from '../shared/result.ts';
import type { ConfigStore } from '../shared/user-config.ts';
import { LOCK_FILE } from './lock.ts';
import { createProjectReader } from './project-reader.ts';
import { fakeSystem, makeTempDir, nodeFs, silentLogger } from './test-support.ts';
import { createWorkspaceService } from './workspace-service.ts';

let dir: string;
let cleanup: () => Promise<void>;
const alive = new Set<number>();
let trusted: Set<string>;

/** Trust kept in memory, keyed like the real store (id + path + links). */
const config: Pick<ConfigStore, 'isTrusted' | 'setTrusted'> = {
  isTrusted: (key) => trusted.has(`${key.id}|${key.path}|${key.links}`),
  setTrusted: (key, value) => {
    if (value) trusted.add(`${key.id}|${key.path}|${key.links}`);
    else trusted.delete(`${key.id}|${key.path}|${key.links}`);
    return Promise.resolve(ok(undefined));
  },
};

const service = (pid = 1) =>
  createWorkspaceService({
    fs: nodeFs,
    root: dir,
    system: fakeSystem(pid, alive),
    config,
    logger: silentLogger,
    port: 5420 + pid,
  });

const shop: WorkspaceFile = newWorkspaceFile({
  id: 'shop000001',
  name: 'Shop',
  createdAt: '2026-10-14T08:00:00.000Z',
  responsiveMode: 'desktop-first',
});

async function writeWorkspace(content: string | WorkspaceFile = shop) {
  await mkdir(join(dir, '.reactcraft'), { recursive: true });
  const text = typeof content === 'string' ? content : serializeWorkspaceFile(content);
  await writeFile(join(dir, WORKSPACE_FILE), text);
}

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  alive.clear();
  alive.add(1).add(2);
  trusted = new Set();
});

afterEach(async () => {
  await cleanup();
});

describe('workspace service', () => {
  it('stays in none without workspace.json, takes no lock and suggests the folder [R-PJ-18]', async () => {
    const workspace = service();

    expect(await workspace.open()).toEqual({ ok: true, value: { status: 'none' } });
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(false);
    expect(createProjectReader(workspace, dir)()).toEqual({ state: 'none', suggestedPath: dir });
  });

  it('opens a project untrusted at first and locks it [S-80, S-81]', async () => {
    await writeWorkspace();
    const workspace = service();

    expect(await workspace.open()).toEqual({
      ok: true,
      value: { status: 'open', file: shop, trusted: false },
    });
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(true);
    expect(createProjectReader(workspace, dir)()).toEqual({
      state: 'open',
      id: 'shop000001',
      name: 'Shop',
      trusted: false,
    });
  });

  it('refuses to open a project another running session holds [E018]', async () => {
    await writeWorkspace();
    await service(1).open();

    expect(await service(2).open()).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { port: 5421 } },
    });
  });

  it('remembers a trust decision across sessions and needs an open project [S-82]', async () => {
    await writeWorkspace();
    const first = service(1);
    expect(await first.setTrusted(true)).toMatchObject({ ok: false, error: { code: 'E021' } });
    await first.open();
    await first.setTrusted(true);
    await first.close();
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(false);

    expect(await service(2).open()).toMatchObject({ ok: true, value: { trusted: true } });
  });

  it('falls back to restricted mode when backends change, running or closed [S-84]', async () => {
    await writeWorkspace();
    const first = service(1);
    await first.open();
    await first.setTrusted(true);
    const linked = {
      ...shop,
      backends: [{ id: 'api0000001', path: '../api', label: 'API' }],
    };
    await writeWorkspace(linked);

    expect(await first.reload()).toMatchObject({ status: 'open', trusted: false });
    await first.setTrusted(true);
    await first.close();
    await writeWorkspace({
      ...linked,
      backends: [{ ...linked.backends[0], path: 'C:/Windows' }],
    } as WorkspaceFile);

    expect(await service(2).open()).toMatchObject({ ok: true, value: { trusted: false } });
  });

  it('ends in error for a broken, a 0.18 or a too deep file, and recovers on reload [V-105, S-29]', async () => {
    const workspace = service();
    const cases: [string, string][] = [
      ['{ "broken', 'invalid'],
      [JSON.stringify({ schemaVersion: 1, id: 'ws1', name: 'Old' }), 'unsupportedVersion'],
      [`${'['.repeat(70)}${']'.repeat(70)}`, 'invalid'],
    ];
    for (const [text, reason] of cases) {
      await writeWorkspace(text);

      const state =
        workspace.state().status === 'none' ? await workspace.open() : ok(await workspace.reload());

      expect(state).toMatchObject({
        ok: true,
        value: { status: 'error', error: { code: 'E003', params: { reason } } },
      });
      expect(createProjectReader(workspace, dir)()).toMatchObject({
        state: 'error',
        error: { code: 'E003' },
      });
    }
    await writeWorkspace();
    expect(await workspace.reload()).toMatchObject({ status: 'open' });
  });

  it('never rewrites a broken workspace.json [V-105]', async () => {
    await writeWorkspace('{ "broken');

    await service().open();

    const text = await nodeFs.readText(dir, WORKSPACE_FILE);
    expect(text).toEqual({ ok: true, value: '{ "broken' });
  });
});
