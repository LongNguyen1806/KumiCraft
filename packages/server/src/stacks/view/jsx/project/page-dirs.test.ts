import { cp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resolveTemplateDir } from '../../../../index.ts';
import { ok } from '../../../../kernel/result.ts';
import type { ProcessPort } from '../../../../ports/process-port.ts';
import { validateDesignDirs } from '../../../../services/project/project-dirs.ts';
import { createProjectService } from '../../../../services/project/project-service.ts';
import {
  directWriteFs,
  fakeSystem,
  makeTempDir,
  platform,
  silentLogger,
} from '../../../../services/workspace/test-support.ts';
import { STACKS } from '../../../../stacks/index.ts';

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
    stacks: STACKS,
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
    stacks: STACKS,
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
    expect(validRes.value.designDirs.pages).toEqual(['src/views']);

    const wsRaw = await readFile(join(target, '.kumicraft', 'workspace.json'), 'utf8');
    const ws = JSON.parse(wsRaw) as { designDirs?: { pages: string[] } };
    expect(ws.designDirs?.pages).toEqual(['src/views']);

    const draftsNestedRes = await service.patchProject({
      designDirs: {
        pages: 'src/pages',
        layouts: 'src/layouts',
        components: 'src/components',
        drafts: 'src/pages/drafts',
      },
    });
    expect(draftsNestedRes).toMatchObject({
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

  it('Test 3 [WP-4.00]: validateDesignDirs allows nested page/component, rejects duplicates, drafts nested in page, and outside sourceDir', () => {
    // Valid nesting: component inside page folder
    expect(
      validateDesignDirs(
        {
          pages: ['src/pages'],
          layouts: ['src/layouts'],
          components: ['src/pages/shop/components'],
          drafts: 'src/drafts',
        },
        'src',
        platform,
      ),
    ).toBe(true);

    // Duplicate directory across lists
    expect(
      validateDesignDirs(
        {
          pages: ['src/pages'],
          layouts: ['src/pages'],
          components: ['src/components'],
          drafts: 'src/drafts',
        },
        'src',
        platform,
      ),
    ).toBe(false);

    // Drafts nested in pages
    expect(
      validateDesignDirs(
        {
          pages: ['src/pages'],
          layouts: ['src/layouts'],
          components: ['src/components'],
          drafts: 'src/pages/drafts',
        },
        'src',
        platform,
      ),
    ).toBe(false);

    // Outside sourceDir
    expect(
      validateDesignDirs(
        {
          pages: ['outside/pages'],
          layouts: ['src/layouts'],
          components: ['src/components'],
          drafts: 'src/drafts',
        },
        'src',
        platform,
      ),
    ).toBe(false);
  });

  it('Test 4 [WP-4.00]: patchProject writes array to workspace.json; reopen preserves exact order in ProjectInfo.designDirs', async () => {
    const { target, service } = await setupProject();
    const patchRes = await service.patchProject({
      designDirs: {
        pages: ['src/views', 'src/admin-views'],
        layouts: ['src/layouts'],
        components: ['src/widgets', 'src/shared-components'],
        drafts: 'src/drafts',
      },
    });
    expect(patchRes.ok).toBe(true);
    if (!patchRes.ok) return;

    // Verify written to disk as arrays
    const wsRaw = await readFile(join(target, '.kumicraft', 'workspace.json'), 'utf8');
    const ws = JSON.parse(wsRaw) as { designDirs?: { pages: string[]; components: string[] } };
    expect(ws.designDirs?.pages).toEqual(['src/views', 'src/admin-views']);
    expect(ws.designDirs?.components).toEqual(['src/widgets', 'src/shared-components']);

    // Close and reopen
    await service.close();
    const reopenRes = await service.open(target);
    expect(reopenRes.ok).toBe(true);
    if (!reopenRes.ok) return;
    expect(reopenRes.value.designDirs.pages).toEqual(['src/views', 'src/admin-views']);
    expect(reopenRes.value.designDirs.components).toEqual(['src/widgets', 'src/shared-components']);
  });

  it('Test 5 [WP-4.00]: patchProject with invalid or non-existent tokenFile returns E016 styleFileInvalid, leaves file unchanged', async () => {
    const { target, service } = await setupProject();
    const wsBefore = await readFile(join(target, '.kumicraft', 'workspace.json'), 'utf8');

    // Non-existent token file
    const resMissing = await service.patchProject({
      styleFiles: { tokenFile: 'src/nonexistent-theme.css' },
    });
    expect(resMissing).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'styleFileInvalid' } },
    });

    // Wrong extension for CSS system (.less)
    const resBadExt = await service.patchProject({
      styleFiles: { tokenFile: 'src/index.less' },
    });
    expect(resBadExt).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'styleFileInvalid' } },
    });

    // Verify workspace.json unchanged
    const wsAfter = await readFile(join(target, '.kumicraft', 'workspace.json'), 'utf8');
    expect(wsAfter).toBe(wsBefore);
  });
});
