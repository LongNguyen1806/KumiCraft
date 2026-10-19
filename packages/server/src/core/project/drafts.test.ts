// Unit tests for Drafts lifecycle (#1 to #14 in p2-luot10-ban-nhap.md).
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ProjectInfo } from '@reactcraft/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resolveTemplateDir } from '../../index.ts';
import { createHistoryService, type HistoryService } from '../history/history-service.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { ok } from '../shared/result.ts';
import {
  directWriteFs,
  fakeSystem,
  makeTempDir,
  platform,
  silentLogger,
} from '../workspace/test-support.ts';
import { createProjectService, type ProjectService } from './project-service.ts';

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
let history: HistoryService;
let service: ProjectService;

async function setupProject(): Promise<ProjectInfo> {
  await cp(join(baseDir, 'base'), tempDir, { recursive: true });
  await rm(join(tempDir, '.reactcraft', 'lock'), { force: true });
  history = createHistoryService({ fs: directWriteFs });
  service = createProjectService({
    fs: directWriteFs,
    system: fakeSystem(1, new Set([1])),
    process: fakeProcess,
    config: {
      isTrusted: () => true,
      setTrusted: () => Promise.resolve(ok(undefined)),
      settings: () => ({ editor: 'vscode' as const, agent: { preferred: 'auto' as const } }),
    },
    logger: silentLogger,
    port: 50302,
    platform,
    templateDir: resolveTemplateDir(),
    history,
  });
  const openRes = await service.open(tempDir);
  if (!openRes.ok) throw new Error(`Failed to open project: ${JSON.stringify(openRes.error)}`);
  return openRes.value;
}

beforeAll(async () => {
  ({ dir: baseDir, cleanup: cleanupBase } = await makeTempDir());
  const baseTarget = join(baseDir, 'base');
  const initService = createProjectService({
    fs: directWriteFs,
    system: fakeSystem(1, new Set([1])),
    process: fakeProcess,
    config: {
      isTrusted: () => true,
      setTrusted: () => Promise.resolve(ok(undefined)),
      settings: () => ({ editor: 'vscode' as const, agent: { preferred: 'auto' as const } }),
    },
    logger: silentLogger,
    port: 50302,
    platform,
    templateDir: resolveTemplateDir(),
  });
  await initService.create(baseTarget, 'App', 'pnpm');
  await initService.close();
});

afterAll(async () => {
  await cleanupBase();
});

beforeEach(async () => {
  ({ dir: tempDir, cleanup: cleanupDir } = await makeTempDir());
  await setupProject();
});

afterEach(async () => {
  await service.close();
  await cleanupDir();
});

describe('Drafts lifecycle (#1 - #14)', () => {
  it('1. creates drafts with default names and with custom name & freeform [R-DR-10, R-DR-11]', async () => {
    const c1 = await service.createDraft({ free: false });
    expect(c1.ok).toBe(true);
    expect(c1.ok && c1.value.draftFile).toBe('src/drafts/BanNhap1.tsx');

    const c2 = await service.createDraft({ free: false });
    expect(c2.ok).toBe(true);
    expect(c2.ok && c2.value.draftFile).toBe('src/drafts/BanNhap2.tsx');

    const c3 = await service.createDraft({ name: 'Mockup', free: true });
    expect(c3.ok).toBe(true);
    expect(c3.ok && c3.value.draftFile).toBe('src/drafts/Mockup.tsx');

    const content1 = await readFile(join(tempDir, 'src/drafts/BanNhap1.tsx'), 'utf8');
    expect(content1).toContain('export function BanNhap1()');
    expect(content1).toContain('min-h-screen bg-white p-8');

    const contentMockup = await readFile(join(tempDir, 'src/drafts/Mockup.tsx'), 'utf8');
    expect(contentMockup).toContain('data-rc-free');

    const listRes = await service.listDrafts();
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      expect(listRes.value.drafts).toHaveLength(3);
      expect(listRes.value.drafts.find((d) => d.name === 'Mockup')?.free).toBe(true);
      expect(listRes.value.drafts.find((d) => d.name === 'BanNhap1')?.free).toBe(false);
    }
  });

  it('2. undo and redo draft creation byte-for-byte [R-DR-11, R-HI-11]', async () => {
    await service.createDraft({ free: false });
    const original = await readFile(join(tempDir, 'src/drafts/BanNhap1.tsx'), 'utf8');

    await history.undo(tempDir);
    expect(await directWriteFs.exists(tempDir, 'src/drafts/BanNhap1.tsx')).toBe(false);

    await history.redo(tempDir);
    const restored = await readFile(join(tempDir, 'src/drafts/BanNhap1.tsx'), 'utf8');
    expect(restored).toBe(original);
  });

  it('3. renames BanNhap1 to TrangChuMoi with byte-for-byte undo [R-DR-14]', async () => {
    await service.createDraft({ free: false });
    const original = await readFile(join(tempDir, 'src/drafts/BanNhap1.tsx'), 'utf8');

    const ren = await service.renameDraft({
      file: 'src/drafts/BanNhap1.tsx',
      newName: 'Trang chủ mới',
    });
    expect(ren.ok).toBe(true);
    expect(await directWriteFs.exists(tempDir, 'src/drafts/BanNhap1.tsx')).toBe(false);
    expect(await directWriteFs.exists(tempDir, 'src/drafts/TrangChuMoi.tsx')).toBe(true);

    const renContent = await readFile(join(tempDir, 'src/drafts/TrangChuMoi.tsx'), 'utf8');
    expect(renContent).toContain('export function TrangChuMoi()');

    await history.undo(tempDir);
    expect(await directWriteFs.exists(tempDir, 'src/drafts/TrangChuMoi.tsx')).toBe(false);
    expect(await readFile(join(tempDir, 'src/drafts/BanNhap1.tsx'), 'utf8')).toBe(original);
  });

  it('4. duplicates Mockup twice [R-DR-14]', async () => {
    await service.createDraft({ name: 'Mockup', free: true });
    const d1 = await service.duplicateDraft({ file: 'src/drafts/Mockup.tsx' });
    expect(d1.ok).toBe(true);
    expect(d1.ok && d1.value.draftFile).toBe('src/drafts/Mockup2.tsx');

    const d2 = await service.duplicateDraft({ file: 'src/drafts/Mockup.tsx' });
    expect(d2.ok).toBe(true);
    expect(d2.ok && d2.value.draftFile).toBe('src/drafts/Mockup3.tsx');

    expect(await readFile(join(tempDir, 'src/drafts/Mockup2.tsx'), 'utf8')).toContain(
      'export function Mockup2()',
    );
    expect(await readFile(join(tempDir, 'src/drafts/Mockup3.tsx'), 'utf8')).toContain(
      'export function Mockup3()',
    );
  });

  it('5. inUse draft cannot be deleted or renamed [R-DR-14]', async () => {
    await service.createDraft({ name: 'Mockup', free: true });
    const homePath = join(tempDir, 'src/pages/Home.tsx');
    const homeCode = await readFile(homePath, 'utf8');
    await writeFile(homePath, `import { Mockup } from '../drafts/Mockup';\n${homeCode}`);

    const list = await service.listDrafts();
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.drafts.find((d) => d.name === 'Mockup')?.inUse).toBe(true);
    }

    const del = await service.deleteDraft({ file: 'src/drafts/Mockup.tsx' });
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error.code).toBe('E016');

    const ren = await service.renameDraft({ file: 'src/drafts/Mockup.tsx', newName: 'MockupNew' });
    expect(ren.ok).toBe(false);
    if (!ren.ok) expect(ren.error.code).toBe('E016');
  });

  it('6. deletes unused draft with byte-for-byte undo [R-DR-14, R-HI-11]', async () => {
    await service.createDraft({ free: false });
    const original = await readFile(join(tempDir, 'src/drafts/BanNhap1.tsx'), 'utf8');

    const del = await service.deleteDraft({ file: 'src/drafts/BanNhap1.tsx' });
    expect(del.ok).toBe(true);
    expect(await directWriteFs.exists(tempDir, 'src/drafts/BanNhap1.tsx')).toBe(false);

    await history.undo(tempDir);
    expect(await readFile(join(tempDir, 'src/drafts/BanNhap1.tsx'), 'utf8')).toBe(original);
  });

  it('7. promotes draft to page with keepDraft: false and remapped imports [R-DR-15, R-HI-11]', async () => {
    const draftCode = [
      "import { Button } from '../components/ui/Button.tsx';",
      'export function PromoDraft() {',
      '  return <Button />;',
      '}\n',
    ].join('\n');
    await directWriteFs.writeTextAtomic(tempDir, 'src/drafts/PromoDraft.tsx', draftCode);
    await directWriteFs.writeTextAtomic(
      tempDir,
      'src/components/ui/Button.tsx',
      'export function Button() { return <button />; }\n',
    );

    const routesOriginal = await readFile(join(tempDir, 'src/routes.tsx'), 'utf8');
    const prom = await service.promoteDraft({
      file: 'src/drafts/PromoDraft.tsx',
      as: 'page',
      name: 'Khuyến mãi',
      path: '/khuyen-mai',
      keepDraft: false,
    });
    expect(prom.ok).toBe(true);
    expect(await directWriteFs.exists(tempDir, 'src/drafts/PromoDraft.tsx')).toBe(false);

    const pageContent = await readFile(join(tempDir, 'src/pages/KhuyenMai.tsx'), 'utf8');
    expect(pageContent).toContain('export function KhuyenMai()');
    expect(pageContent).toContain("import { Button } from '../components/ui/Button.tsx';");

    const routesAfter = await readFile(join(tempDir, 'src/routes.tsx'), 'utf8');
    expect(routesAfter).toContain('KhuyenMai');
    expect(routesAfter).toContain('khuyen-mai');

    await history.undo(tempDir);
    expect(await directWriteFs.exists(tempDir, 'src/pages/KhuyenMai.tsx')).toBe(false);
    expect(await readFile(join(tempDir, 'src/drafts/PromoDraft.tsx'), 'utf8')).toBe(draftCode);
    expect(await readFile(join(tempDir, 'src/routes.tsx'), 'utf8')).toBe(routesOriginal);
  });

  it('8. promotes draft to page in nested dir with remapped imports [R-DR-15]', async () => {
    const draftCode = [
      "import { Button } from '../components/ui/Button.tsx';",
      'export function PromoDraft() {',
      '  return <Button />;',
      '}\n',
    ].join('\n');
    await directWriteFs.writeTextAtomic(tempDir, 'src/drafts/PromoDraft.tsx', draftCode);

    const prom = await service.promoteDraft({
      file: 'src/drafts/PromoDraft.tsx',
      as: 'page',
      name: 'Khuyến mãi',
      dir: 'src/pages/promo',
      path: '/khuyen-mai',
      keepDraft: true,
    });
    expect(prom.ok).toBe(true);

    const promoPage = await readFile(join(tempDir, 'src/pages/promo/KhuyenMai.tsx'), 'utf8');
    expect(promoPage).toContain("import { Button } from '../../components/ui/Button.tsx';");
  });

  it('9. promotes draft to component in custom dir updating components.json [R-DR-15]', async () => {
    await service.createDraft({ name: 'PromoBox', free: false });
    const prom = await service.promoteDraft({
      file: 'src/drafts/PromoBox.tsx',
      as: 'component',
      name: 'PromoBox',
      dir: 'src/features/promo',
      keepDraft: true,
    });
    expect(prom.ok).toBe(true);
    expect(await directWriteFs.exists(tempDir, 'src/features/promo/PromoBox.tsx')).toBe(true);
    expect(await directWriteFs.exists(tempDir, 'src/drafts/PromoBox.tsx')).toBe(true);

    const compJson = await readFile(join(tempDir, '.reactcraft/components.json'), 'utf8');
    expect(compJson).toContain('src/features/promo/PromoBox.tsx');
  });

  it('10. promoting to existing page path fails with pathExists and leaves files unchanged [R-DR-15]', async () => {
    await service.createDraft({ name: 'TestDraft', free: false });
    const prom = await service.promoteDraft({
      file: 'src/drafts/TestDraft.tsx',
      as: 'page',
      name: 'Home',
      path: '/',
      keepDraft: true,
    });
    expect(prom.ok).toBe(false);
    if (!prom.ok) expect(prom.error.code).toBe('E016');
  });

  it('11. detects ignored status from .gitignore [R-DR-10]', async () => {
    await writeFile(join(tempDir, '.gitignore'), 'src/drafts/\n');
    let list = await service.listDrafts();
    expect(list.ok && list.value.ignored).toBe(true);

    await writeFile(join(tempDir, '.gitignore'), '# src/drafts/\n');
    list = await service.listDrafts();
    expect(list.ok && list.value.ignored).toBe(false);
  });

  it('12. validates designDirs with overlapping or duplicate drafts dir [R-CP-16, R-DR-10]', async () => {
    const p1 = await service.patchProject({
      designDirs: {
        pages: 'src/pages',
        layouts: 'src/layouts',
        components: 'src/components',
        drafts: 'src/pages',
      },
    });
    expect(p1.ok).toBe(false);
    if (!p1.ok) expect(p1.error.code).toBe('E016');

    const p2 = await service.patchProject({
      designDirs: {
        pages: 'src/pages',
        layouts: 'src/layouts',
        components: 'src/components',
        drafts: 'src/components/sub',
      },
    });
    expect(p2.ok).toBe(false);
    if (!p2.ok) expect(p2.error.code).toBe('E016');
  });

  it('13. rejects operations on files outside drafts directory [R-DR-10]', async () => {
    const res1 = await service.deleteDraft({ file: 'src/pages/Home.tsx' });
    expect(res1.ok).toBe(false);
    if (!res1.ok) expect(res1.error.code).toBe('E012');

    const res2 = await service.deleteDraft({ file: '../x.tsx' });
    expect(res2.ok).toBe(false);
    if (!res2.ok) expect(res2.error.code).toBe('E012');
  });

  it('14. routes.tsx never contains draft routes [R-DR-16]', async () => {
    const routesContent = await readFile(join(tempDir, 'src/routes.tsx'), 'utf8');
    expect(routesContent).not.toContain('draft');
    expect(routesContent).not.toContain('BanNhap');
  });
});
