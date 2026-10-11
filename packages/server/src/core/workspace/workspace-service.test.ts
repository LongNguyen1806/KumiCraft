import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { workspaceFilePath } from '@reactcraft/model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ok } from '../shared/result.ts';
import type { ConfigStore } from '../shared/user-config.ts';
import { CreateWorkspaceRequestSchema } from './create-workspace.ts';
import { LOCK_FILE } from './lock.ts';
import { fakeSystem, makeTempDir, nodeFs, sequenceIds, silentLogger } from './test-support.ts';
import { createWorkspaceService } from './workspace-service.ts';

let dir: string;
let cleanup: () => Promise<void>;
const alive = new Set<number>();
let trusted: Set<string>;

/** Trust kept in memory, keyed like the real store (id + path). */
const config: Pick<ConfigStore, 'settings' | 'isTrusted' | 'setTrusted'> = {
  settings: () => ({
    language: 'vi',
    ai: {
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      keys: { openai: 'missing', anthropic: 'missing', deepseek: 'missing', ollama: 'missing' },
    },
    export: { typecheck: true, buildCheck: false },
  }),
  isTrusted: (id, path) => trusted.has(`${id}|${path}`),
  setTrusted: (id, path, value) => {
    if (value) trusted.add(`${id}|${path}`);
    else trusted.delete(`${id}|${path}`);
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
    newId: sequenceIds(),
  });

const request = CreateWorkspaceRequestSchema.parse({ name: 'Shop' });

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
  it('stays in none without .reactcraft and takes no lock', async () => {
    const workspace = service();

    expect(await workspace.open()).toEqual({ ok: true, value: { status: 'none' } });
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(false);
  });

  it('creates a trusted workspace, locks it and refuses to create twice', async () => {
    const workspace = service();
    await workspace.open();

    const created = await workspace.create(request);

    expect(created).toMatchObject({
      ok: true,
      value: { status: 'open', trusted: true, document: { workspace: { contentLocale: 'vi-VN' } } },
    });
    expect(await nodeFs.exists(dir, workspaceFilePath.workspace())).toBe(true);
    expect(await nodeFs.exists(dir, workspaceFilePath.gitignore())).toBe(true);
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(true);
    expect(await workspace.create(request)).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { reason: 'exists' } },
    });
  });

  it('refuses to open a workspace another running session holds [E018]', async () => {
    await service(1).create(request);

    expect(await service(2).open()).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { port: 5421 } },
    });
  });

  it('reopens after close with the same document and trust', async () => {
    const first = service(1);
    const created = await first.create(request);
    await first.close();
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(false);

    const reopened = await service(2).open();

    expect(reopened).toEqual({
      ok: true,
      value: created.ok ? { ...created.value, warnings: [] } : undefined,
    });
  });

  it('ends in error when a file is broken and recovers on reload', async () => {
    const first = service(1);
    const created = await first.create(request);
    await first.close();
    const pageId =
      created.ok && created.value.status === 'open'
        ? created.value.document.workspace.pageOrder[0]
        : '';
    const pageFile = join(dir, workspaceFilePath.page(pageId ?? ''));
    const pageText = await nodeFs.readText(dir, workspaceFilePath.page(pageId ?? ''));
    await writeFile(pageFile, '{');

    const second = service(2);
    expect(await second.open()).toMatchObject({ ok: true, value: { status: 'error' } });
    await writeFile(pageFile, pageText.ok ? pageText.value : '');
    expect(await second.reload()).toMatchObject({ status: 'open' });
  });

  it('remembers a trust decision and reports E015 without a workspace', async () => {
    const workspace = service();
    expect(await workspace.setTrusted(true)).toMatchObject({ ok: false, error: { code: 'E015' } });
    await workspace.create(request);

    expect(await workspace.setTrusted(false)).toMatchObject({
      ok: true,
      value: { trusted: false },
    });
    expect(trusted.size).toBe(0);
  });
});
