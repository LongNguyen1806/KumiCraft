import { cp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resolveTemplateDir } from '../../index.ts';
import { createHistoryService } from '../history/history-service.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { ok } from '../shared/result.ts';
import {
  directWriteFs,
  fakeSystem,
  makeTempDir,
  platform,
  silentLogger,
} from '../workspace/test-support.ts';
import { readPages } from './pages.ts';
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
  await rm(join(target, '.reactcraft', 'lock'), { force: true });
  const system = fakeSystem(1, new Set([1]));
  const history = createHistoryService({ fs: directWriteFs });
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
    history,
  });

  const opened = await service.open(target);
  expect(opened.ok).toBe(true);
  return { target, service, history, fs: directWriteFs };
}

describe('page-edits [WP-2.05]', () => {
  it('scenario 2: adds "Giới thiệu" to template [R-PG-11, R-PG-12, AC-07]', async () => {
    const { target, service, fs } = await setupProject();
    const res = await service.addPage({ name: 'Giới thiệu' });
    expect(res.ok).toBe(true);

    const fileContent = await readFile(join(target, 'src/pages/GioiThieu.tsx'), 'utf8');
    expect(fileContent).toBe(
      'export function GioiThieu() {\n' +
        '  return (\n' +
        '    <main className="mx-auto max-w-5xl p-8">\n' +
        '      <h1 className="text-3xl font-bold">Giới thiệu</h1>\n' +
        '    </main>\n' +
        '  );\n' +
        '}\n',
    );

    const routesContent = await readFile(join(target, 'src/routes.tsx'), 'utf8');
    expect(routesContent).toContain("import { GioiThieu } from './pages/GioiThieu.tsx';");
    expect(routesContent).toMatch(
      /\{\s*path:\s*'gioi-thieu',\s*element:\s*<GioiThieu\s*\/>\s*\},[\s\S]*path:\s*'\*'/,
    );

    const pagesInfo = await readPages(fs, target, 'src');
    const addedPage = pagesInfo.pages.find((p) => p.path === '/gioi-thieu');
    expect(addedPage).toBeDefined();
    expect(addedPage?.file).toBe('src/pages/GioiThieu.tsx');
  });

  it('scenario 3: adds with custom dir and fileName [R-PG-11]', async () => {
    const { target, service } = await setupProject();
    const res = await service.addPage({
      name: 'Product',
      dir: 'src/pages/product',
      fileName: 'ProductPage.tsx',
    });
    expect(res.ok).toBe(true);

    const fileContent = await readFile(join(target, 'src/pages/product/ProductPage.tsx'), 'utf8');
    expect(fileContent).toContain('export function Product()');

    const routesContent = await readFile(join(target, 'src/routes.tsx'), 'utf8');
    expect(routesContent).toContain("import { Product } from './pages/product/ProductPage.tsx';");
  });

  it('scenario 4: rejects invalid dir with E012 [R-PG-11]', async () => {
    const { service } = await setupProject();
    const res1 = await service.addPage({ name: 'A', dir: '../outside' });
    expect(res1).toMatchObject({ ok: false, error: { code: 'E012' } });

    const res2 = await service.addPage({ name: 'B', dir: 'src/node_modules/x' });
    expect(res2).toMatchObject({ ok: false, error: { code: 'E012' } });

    const res3 = await service.addPage({ name: 'C', dir: 'outside' });
    expect(res3).toMatchObject({ ok: false, error: { code: 'E012' } });
  });

  it('scenario 5: rejects duplicate path, file, or component name [R-PG-13]', async () => {
    const { service } = await setupProject();
    const res1 = await service.addPage({ name: 'A', path: '/about' });
    expect(res1).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'pathExists' } },
    });

    const res2 = await service.addPage({ name: 'Diff', fileName: 'About.tsx' });
    expect(res2).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'fileExists' } },
    });

    const res3 = await service.addPage({
      name: 'About',
      fileName: 'NewAbout.tsx',
      path: '/new-about',
    });
    expect(res3).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'nameExists' } },
    });
  });

  it('scenario 6: adds page, undoes and redoes byte-for-byte [R-HI-11, R-PG-13]', async () => {
    const { target, service, history, fs } = await setupProject();
    const beforeRoutes = await readFile(join(target, 'src/routes.tsx'), 'utf8');

    const addRes = await service.addPage({ name: 'Giới thiệu' });
    expect(addRes.ok).toBe(true);
    const afterRoutes = await readFile(join(target, 'src/routes.tsx'), 'utf8');
    expect(await fs.exists(target, 'src/pages/GioiThieu.tsx')).toBe(true);

    const undoRes = await history.undo(target);
    expect(undoRes).toMatchObject({ ok: true });
    expect(await fs.exists(target, 'src/pages/GioiThieu.tsx')).toBe(false);
    expect(await readFile(join(target, 'src/routes.tsx'), 'utf8')).toBe(beforeRoutes);

    const redoRes = await history.redo(target);
    expect(redoRes).toMatchObject({ ok: true });
    expect(await fs.exists(target, 'src/pages/GioiThieu.tsx')).toBe(true);
    expect(await readFile(join(target, 'src/routes.tsx'), 'utf8')).toBe(afterRoutes);
  });

  it('scenario 7: deletes About and undoes byte-for-byte [R-PG-14, R-HI-11]', async () => {
    const { target, service, history, fs } = await setupProject();
    const beforeRoutes = await readFile(join(target, 'src/routes.tsx'), 'utf8');
    const beforeAbout = await readFile(join(target, 'src/pages/About.tsx'), 'utf8');

    const delRes = await service.deletePage({ path: '/about' });
    expect(delRes.ok).toBe(true);
    expect(await fs.exists(target, 'src/pages/About.tsx')).toBe(false);

    const routesAfterDel = await readFile(join(target, 'src/routes.tsx'), 'utf8');
    expect(routesAfterDel).not.toContain('About');
    expect(routesAfterDel).not.toMatch(/\n\s*\n\s*\n/);

    const undoRes = await history.undo(target);
    expect(undoRes).toMatchObject({ ok: true });
    expect(await readFile(join(target, 'src/pages/About.tsx'), 'utf8')).toBe(beforeAbout);
    expect(await readFile(join(target, 'src/routes.tsx'), 'utf8')).toBe(beforeRoutes);
  });

  it('scenario 9: rejects deleting last page with lastPage [R-PG-14]', async () => {
    const { service } = await setupProject();
    await service.deletePage({ path: '/about' });

    const delLast = await service.deletePage({ path: '/' });
    expect(delLast).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'lastPage' } },
    });
  });

  it('scenario 10: renames URL and component, undoes byte-for-byte [R-PG-14]', async () => {
    const { target, service, history, fs } = await setupProject();
    const beforeRoutes = await readFile(join(target, 'src/routes.tsx'), 'utf8');
    const beforeAbout = await readFile(join(target, 'src/pages/About.tsx'), 'utf8');

    const renameRes = await service.renamePage({
      path: '/about',
      newPath: '/gioi-thieu-cong-ty',
      newName: 'Company',
    });
    expect(renameRes.ok).toBe(true);

    expect(await fs.exists(target, 'src/pages/About.tsx')).toBe(false);
    expect(await fs.exists(target, 'src/pages/Company.tsx')).toBe(true);
    const companyContent = await readFile(join(target, 'src/pages/Company.tsx'), 'utf8');
    expect(companyContent).toContain('export function Company()');

    const routesContent = await readFile(join(target, 'src/routes.tsx'), 'utf8');
    expect(routesContent).toContain("import { Company } from './pages/Company.tsx';");
    expect(routesContent).toContain("path: 'gioi-thieu-cong-ty'");
    expect(routesContent).toContain('<Company />');

    const undoRes = await history.undo(target);
    expect(undoRes).toMatchObject({ ok: true });
    expect(await fs.exists(target, 'src/pages/Company.tsx')).toBe(false);
    expect(await readFile(join(target, 'src/pages/About.tsx'), 'utf8')).toBe(beforeAbout);
    expect(await readFile(join(target, 'src/routes.tsx'), 'utf8')).toBe(beforeRoutes);
  });

  it('scenario 11: rejects changing path of index route [R-PG-14]', async () => {
    const { service } = await setupProject();
    const res = await service.renamePage({ path: '/', newPath: '/trang-chu' });
    expect(res).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'indexPage' } },
    });
  });

  it('scenario 12: rejects operations on non-convention router [R-PG-10]', async () => {
    const { target, service } = await setupProject();
    const nonConventionCode =
      'import { Routes, Route } from "react-router-dom";\n' +
      'export function App() {\n' +
      '  return <Routes><Route path="/" element={<div>Home</div>} /></Routes>;\n' +
      '}\n';
    await directWriteFs.writeTextAtomic(target, 'src/routes.tsx', nonConventionCode);

    const addRes = await service.addPage({ name: 'Page' });
    expect(addRes).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'notConvention' } },
    });

    const renameRes = await service.renamePage({ path: '/', newPath: '/x' });
    expect(renameRes).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'notConvention' } },
    });

    const deleteRes = await service.deletePage({ path: '/' });
    expect(deleteRes).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'notConvention' } },
    });
  });

  it('scenario 13: adds page to flat router array [R-PG-12]', async () => {
    const { target, service } = await setupProject();
    const flatCode =
      "import { createBrowserRouter } from 'react-router-dom';\n" +
      "import { Home } from './pages/Home.tsx';\n\n" +
      'export const router = createBrowserRouter([\n' +
      "  { path: '/', element: <Home /> },\n" +
      ']);\n';
    await directWriteFs.writeTextAtomic(target, 'src/routes.tsx', flatCode);

    const res = await service.addPage({ name: 'Giới thiệu' });
    expect(res.ok).toBe(true);

    const routesContent = await readFile(join(target, 'src/routes.tsx'), 'utf8');
    expect(routesContent).toContain("import { GioiThieu } from './pages/GioiThieu.tsx';");
    expect(routesContent).toContain("{ path: '/gioi-thieu', element: <GioiThieu /> },");
  });
});
