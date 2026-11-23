// The pages of the ASP.NET samples (03c section 3.6): Razor Pages are .cshtml files with @page and
// their models; MVC pages are controller actions with their views. Each change edits both files
// in one step, keeping the BOM the .NET templates write.
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { PageEditDeps } from '../../../kernel/features.ts';
import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { directWriteFs } from '../../../services/workspace/test-support.ts';
import { detectRazor } from '../../runtime/dotnet/detect.ts';
import { mvcPages } from '../mvc/index.ts';
import { razorPagesPages } from './index.ts';

const FIXTURES = resolve(import.meta.dirname, '../../../../../../fixtures/projects');
let root = '';

async function copy(name: string): Promise<string> {
  root = await mkdtemp(join(tmpdir(), 'rc-aspnet-pages-'));
  await cp(join(FIXTURES, name), root, {
    recursive: true,
    filter: (s) => !s.includes('node_modules'),
  });
  return root;
}

const deps = (): PageEditDeps => ({
  fs: directWriteFs,
  history: createHistoryService({ fs: directWriteFs }),
  projectRoot: root,
  sourceDir: '.',
  platform: process.platform === 'win32' ? 'win32' : 'linux',
  language: 'js',
  designDirs: {
    pages: ['Pages'],
    layouts: ['Pages/Shared'],
    components: ['Pages/Shared'],
    drafts: 'drafts',
  },
});

const ctx = () => ({
  fs: directWriteFs,
  root,
  sourceDir: '.',
  support: { supported: true, reasons: [], versions: {}, language: 'js' as const },
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('ASP.NET samples [03c 3.1, 3.6]', () => {
  it('detects the Razor Pages sample with Tailwind and the MVC sample with Bootstrap', async () => {
    const pages = await detectRazor(
      {
        root: await copy('razor-pages-net10'),
        fs: directWriteFs,
        packageJson: { devDependencies: { tailwindcss: '4.1.18' } },
      },
      'pages',
    );
    expect(pages).toMatchObject({
      supported: true,
      framework: 'aspnet-razor-pages',
      serverEntry: 'RazorPagesApp.csproj',
      tailwindCss: 'Styles/app.css',
    });
    expect(pages.styling).toMatchObject({
      primary: 'tailwind',
      editable: true,
      globalCss: ['wwwroot/css/site.css'],
    });
    await rm(root, { recursive: true, force: true });
    const mvc = await detectRazor(
      { root: await copy('mvc-net10'), fs: directWriteFs, packageJson: {} },
      'mvc',
    );
    expect(mvc).toMatchObject({
      supported: true,
      framework: 'aspnet-mvc',
      styling: { primary: 'bootstrap', editable: false },
    });
    expect(
      (await detectRazor({ root, fs: directWriteFs, packageJson: {} }, 'pages')).reasons,
    ).toEqual(['noRazorViews']);
  });

  it('Razor Pages: lists @page files, adds a page with its model, renames and removes both files', async () => {
    await copy('razor-pages-net10');
    expect((await razorPagesPages.read(ctx())).pages.map((p) => p.path)).toEqual([
      '/',
      '/Error',
      '/Privacy',
    ]);
    const added = await razorPagesPages.add(deps(), { name: 'Contact' });
    expect(added.ok && added.value.pagePath).toBe('/Contact');
    expect(await readFile(join(root, 'Pages/Contact.cshtml.cs'), 'utf8')).toContain(
      'namespace RazorPagesApp.Pages;',
    );
    expect(await readFile(join(root, 'Pages/Contact.cshtml'), 'utf8')).toContain(
      '@model ContactModel',
    );
    await razorPagesPages.rename(deps(), { path: '/Contact', newName: 'About' });
    expect(
      existsSync(join(root, 'Pages/About.cshtml.cs')) &&
        !existsSync(join(root, 'Pages/Contact.cshtml')),
    ).toBe(true);
    await razorPagesPages.remove(deps(), { path: '/About' });
    expect(
      existsSync(join(root, 'Pages/About.cshtml')) ||
        existsSync(join(root, 'Pages/About.cshtml.cs')),
    ).toBe(false);
  });

  it('MVC: lists actions with views, adds an action and its view, removes both', async () => {
    await copy('mvc-net10');
    const controllerFile = join(root, 'Controllers/HomeController.cs');
    const original = await readFile(controllerFile, 'utf8');
    const read = await mvcPages.read(ctx());
    expect(read.pages.map((p) => p.path)).toEqual(['/', '/Home/Error', '/Home/Privacy']);
    expect(read.pages.find((p) => p.path === '/Home/Error')?.file).toBe(
      'Views/Shared/Error.cshtml',
    );
    const added = await mvcPages.add(deps(), { name: 'Contact' });
    expect(added.ok && added.value.pagePath).toBe('/Home/Contact');
    expect(await readFile(controllerFile, 'utf8')).toContain('public IActionResult Contact()');
    expect((await mvcPages.read(ctx())).pages.map((p) => p.path)).toContain('/Home/Contact');
    await mvcPages.remove(deps(), { path: '/Home/Contact' });
    // Adding then removing a page gives the controller back as it was.
    expect(await readFile(controllerFile, 'utf8')).toBe(original);
    expect(existsSync(join(root, 'Views/Home/Contact.cshtml'))).toBe(false);
  });

  it('MVC: also reads scaffolded Area Razor Pages (e.g. Identity) and ignores _ViewStart', async () => {
    await copy('mvc-net10');
    await mkdir(join(root, 'Areas/Identity/Pages/Account/Manage'), { recursive: true });
    await writeFile(
      join(root, 'Areas/Identity/Pages/_ViewStart.cshtml'),
      '@{ Layout = "/Views/Shared/_Layout.cshtml"; }',
    );
    await writeFile(
      join(root, 'Areas/Identity/Pages/Account/Login.cshtml'),
      '@page\n<h1>Login</h1>',
    );
    await writeFile(
      join(root, 'Areas/Identity/Pages/Account/Manage/Index.cshtml'),
      '@page\n<h1>Profile</h1>',
    );
    await mkdir(join(root, 'Areas/Admin/Pages'), { recursive: true });
    await writeFile(join(root, 'Areas/Admin/Pages/Index.cshtml'), '@page\n<h1>Admin</h1>');

    const read = await mvcPages.read(ctx());
    expect(read.pages).toEqual([
      { path: '/', file: 'Views/Home/Index.cshtml', dynamic: false },
      { path: '/Admin', file: 'Areas/Admin/Pages/Index.cshtml', dynamic: false },
      { path: '/Home/Error', file: 'Views/Shared/Error.cshtml', dynamic: false },
      { path: '/Home/Privacy', file: 'Views/Home/Privacy.cshtml', dynamic: false },
      {
        path: '/Identity/Account/Login',
        file: 'Areas/Identity/Pages/Account/Login.cshtml',
        dynamic: false,
      },
      {
        path: '/Identity/Account/Manage',
        file: 'Areas/Identity/Pages/Account/Manage/Index.cshtml',
        dynamic: false,
      },
    ]);

    const removed = await mvcPages.remove(deps(), { path: '/Identity/Account/Login' });
    expect(removed.ok).toBe(false);
    expect(existsSync(join(root, 'Areas/Identity/Pages/Account/Login.cshtml'))).toBe(true);
  });
});
