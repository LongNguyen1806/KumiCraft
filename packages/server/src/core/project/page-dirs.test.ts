import { cp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resolveTemplateDir } from '../../index.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { ok } from '../shared/result.ts';
import {
  directWriteFs,
  fakeSystem,
  makeTempDir,
  platform,
  silentLogger,
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

let baseDir: string;
let cleanupBase: () => Promise<void>;
let tempDir: string;
let cleanupDir: () => Promise<void>;

beforeAll(async () => {
  ({ dir: baseDir, cleanup: cleanupBase } = await makeTempDir());
  const baseTarget = join(baseDir, 'base');
  const service = createProjectService({
    fs: directWriteFs,
    system: fakeSystem(1, new Set([1])),
    process: fakeProcess,
    config: {
      isTrusted: () => true,
      setTrusted: () => Promise.resolve(ok(undefined)),
      settings: () => ({ editor: 'vscode' as const, agent: { preferred: 'auto' as const } }),
    },
    logger: silentLogger,
    port: 50301,
    platform,
    templateDir: resolveTemplateDir(),
  });
  await service.create(baseTarget, 'App', 'pnpm');
});

afterAll(async () => {
  await cleanupBase();
});

beforeEach(async () => {
  ({ dir: tempDir, cleanup: cleanupDir } = await makeTempDir());
});

afterEach(async () => {
  await cleanupDir();
});

async function setupProject(subName = 'app') {
  const target = join(tempDir, subName);
  await cp(join(baseDir, 'base'), target, { recursive: true });
  await rm(join(target, '.kumicraft', 'lock'), { force: true });
  const system = fakeSystem(1, new Set([1]));
  const config = {
    isTrusted: () => true,
    setTrusted: () => Promise.resolve(ok(undefined)),
    settings: () => ({ editor: 'vscode' as const, agent: { preferred: 'auto' as const } }),
  };

  const service = createProjectService({
    fs: directWriteFs,
    system,
    process: fakeProcess,
    config,
    logger: silentLogger,
    port: 50301,
    platform,
    templateDir: resolveTemplateDir(),
  });

  const opened = await service.open(target);
  expect(opened.ok).toBe(true);
  return { target, service };
}

describe('page-dirs & designDirs [WP-2.05]', () => {
  it('scenario 15: patches designDirs, rejects nested and outside sourceDir [R-CP-16]', async () => {
    const { target, service } = await setupProject();

    const validRes = await service.patchProject({
      designDirs: {
        pages: 'src/views',
        layouts: 'src/layouts',
        components: 'src/components',
      },
    });
    expect(validRes.ok).toBe(true);
    if (!validRes.ok) return;
    expect(validRes.value.designDirs.pages).toBe('src/views');

    const wsRaw = await readFile(join(target, '.kumicraft', 'workspace.json'), 'utf8');
    const ws = JSON.parse(wsRaw) as { designDirs?: { pages: string } };
    expect(ws.designDirs?.pages).toBe('src/views');

    const nestedRes = await service.patchProject({
      designDirs: {
        pages: 'src/pages',
        layouts: 'src/pages/sub',
        components: 'src/components',
      },
    });
    expect(nestedRes).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'designDirs' } },
    });

    const outsideRes = await service.patchProject({
      designDirs: {
        pages: 'outside',
        layouts: 'src/layouts',
        components: 'src/components',
      },
    });
    expect(outsideRes).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'designDirs' } },
    });
  });

  it('scenario 16: lists project dirs without node_modules or .kumicraft [R-PG-11]', async () => {
    const { service } = await setupProject();
    const dirsRes = await service.dirs();
    expect(dirsRes.ok).toBe(true);
    if (!dirsRes.ok) return;

    expect(dirsRes.value).toContain('src/pages');
    expect(dirsRes.value.some((d) => d.startsWith('src/components'))).toBe(true);
    expect(dirsRes.value.some((d) => d.includes('node_modules'))).toBe(false);
    expect(dirsRes.value.some((d) => d.includes('.kumicraft'))).toBe(false);
  });
});
