// Creating a project from the real template of the repository (R-PJ-10, R-PJ-11, ADR-BE-32).
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resolveTemplateDir } from '../../index.ts';
import { makeTempDir, nodeFs, platform } from '../workspace/test-support.ts';
import { createProject, toPackageName } from './create.ts';
import { readPages } from './pages.ts';
import { probeProject } from './probe.ts';
import { readThemeTokens } from './theme.ts';

let dir: string;
let cleanup: () => Promise<void>;
const deps = () => ({ fs: nodeFs, platform, templateDir: resolveTemplateDir() });

async function listFilesRecursive(rootDir: string, currentDir = ''): Promise<string[]> {
  const fullDir = currentDir === '' ? rootDir : join(rootDir, currentDir);
  const entries = await readdir(fullDir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const relPath = currentDir === '' ? entry.name : `${currentDir}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursive(rootDir, relPath)));
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('createProject with the real template', { timeout: 30_000 }, () => {
  it('makes a project the vite-react adapter supports, with the routes convention [R-PJ-10]', async () => {
    const target = join(dir, 'shop');

    const created = await createProject(target, 'Cửa hàng <Gỗ> & "Đẹp"', deps());
    const probe = await probeProject(target, { fs: nodeFs, platform });

    expect(created).toEqual({ ok: true, value: undefined });
    expect(probe).toMatchObject({
      ok: true,
      value: { kind: 'project', support: { supported: true, reasons: [], language: 'ts' } },
    });
    const routes = await readFile(join(target, 'src', 'routes.tsx'), 'utf8');
    expect(routes).toContain('createBrowserRouter([');
    expect(await readFile(join(target, '.gitignore'), 'utf8')).toContain('node_modules');
    expect(await readFile(join(target, '.reactcraft', 'agent-guide.md'), 'utf8')).toContain(
      'src/routes.tsx',
    );
  });

  it('names the package from the project name and escapes the title [R-PJ-11]', async () => {
    const target = join(dir, 'shop');

    await createProject(target, 'Cửa hàng <Gỗ> & "Đẹp"', deps());

    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8')) as {
      name: string;
    };
    const html = await readFile(join(target, 'index.html'), 'utf8');
    expect(pkg.name).toBe(toPackageName('Cửa hàng <Gỗ> & "Đẹp"'));
    expect(pkg.name).toBe('cua-hang-go-dep');
    expect(html).toContain('<title>Cửa hàng &lt;Gỗ&gt; &amp; &quot;Đẹp&quot;</title>');
  });

  it('keeps the files an empty folder may already have [R-PJ-02, R-PJ-10]', async () => {
    const target = join(dir, 'shop');
    await mkdir(target);
    await writeFile(join(target, 'README.md'), '# My shop\n');
    await writeFile(join(target, '.gitignore'), 'secret.txt\n');

    const created = await createProject(target, 'Shop', deps());

    expect(created.ok).toBe(true);
    expect(await readFile(join(target, 'README.md'), 'utf8')).toBe('# My shop\n');
    expect(await readFile(join(target, '.gitignore'), 'utf8')).toBe('secret.txt\n');
    expect(await readFile(join(target, 'src', 'pages', 'About.tsx'), 'utf8')).toContain('About');
  });

  it('refuses a folder that already has source code [R-PJ-10]', async () => {
    const target = join(dir, 'shop');
    await mkdir(join(target, 'src'), { recursive: true });

    const created = await createProject(target, 'Shop', deps());

    expect(created).toMatchObject({
      ok: false,
      error: { code: 'E016', params: { reason: 'notEmpty' } },
    });
  });

  it('has no unreplaced placeholder outside package.json and index.html', async () => {
    const target = join(dir, 'shop');

    await createProject(target, 'Shop', deps());

    for (const file of ['src/main.tsx', 'src/routes.tsx', 'src/pages/Home.tsx', 'vite.config.ts']) {
      expect(await readFile(join(target, file), 'utf8')).not.toContain('{{');
    }
  });
});

/** Checks that only read the created site share one project: creating copies the whole template. */
describe('the created starter site', () => {
  let site: string;
  let removeSite: () => Promise<void>;

  beforeAll(async () => {
    const temp = await makeTempDir();
    removeSite = temp.cleanup;
    site = join(temp.dir, 'shop');
    expect(await createProject(site, 'Shop', deps())).toEqual({ ok: true, value: undefined });
  });

  afterAll(async () => {
    await removeSite();
  });

  it('copies every file from templates/vite-react-ts-tailwind4 recursively with _gitignore renamed [R-PJ-10]', async () => {
    const target = site;
    const templateDir = resolveTemplateDir();

    const templateFiles = (await listFilesRecursive(templateDir))
      .map((f) => (f === '_gitignore' ? '.gitignore' : f))
      .sort((a, b) => a.localeCompare(b));
    const projectFiles = await listFilesRecursive(target);

    expect(projectFiles).toEqual(templateFiles);
  });

  it('includes all required starter template files [R-PJ-10]', async () => {
    const target = site;

    const projectFiles = await listFilesRecursive(target);

    const requiredFiles = [
      '.env.example',
      '.gitignore',
      '.reactcraft/agent-guide.md',
      'README.md',
      'eslint.config.js',
      'index.html',
      'package.json',
      'public/favicon.svg',
      'public/images/hero.svg',
      'public/images/product-1.svg',
      'public/images/product-2.svg',
      'public/images/product-3.svg',
      'src/api/.gitkeep',
      'src/components/Footer.tsx',
      'src/components/Header.tsx',
      'src/components/ProductCard.tsx',
      'src/components/ui/Badge.tsx',
      'src/components/ui/Button.tsx',
      'src/components/ui/Card.tsx',
      'src/components/ui/Input.tsx',
      'src/index.css',
      'src/layouts/MainLayout.tsx',
      'src/lib/utils.ts',
      'src/main.tsx',
      'src/pages/About.tsx',
      'src/pages/Home.tsx',
      'src/pages/NotFound.tsx',
      'src/routes.tsx',
      'tsconfig.json',
      'vite.config.ts',
    ];

    for (const file of requiredFiles) {
      expect(projectFiles).toContain(file);
    }
  });

  it('exposes Home and About pages via readPages without wildcard routes [R-PG-10]', async () => {
    const target = site;

    const pagesInfo = await readPages(nodeFs, target, 'src');

    expect(pagesInfo.convention).toBe(true);
    expect(pagesInfo.routesFile).toBe('src/routes.tsx');
    expect(pagesInfo.pages.map((p) => [p.path, p.component])).toEqual([
      ['/', 'Home'],
      ['/about', 'About'],
    ]);
    expect(pagesInfo.pages.some((p) => p.path.includes('*'))).toBe(false);
  });

  it('exposes the full set of @theme tokens via readThemeTokens [R-CP-10]', async () => {
    const target = site;

    const themeResult = await readThemeTokens(nodeFs, target, 'src/index.css');

    const theme = themeResult.ok ? themeResult.value : undefined;

    expect(theme?.colors.map((t) => t.name)).toEqual([
      'brand',
      'brand-soft',
      'brand-ink',
      'accent',
    ]);
    expect(theme?.fonts.map((t) => t.name)).toEqual(['display', 'body']);
    expect(theme?.radii.map((t) => t.name)).toEqual(['card']);
    expect(theme?.shadows.map((t) => t.name)).toEqual(['card']);
  });

  it('uses only static className strings in src/**/*.tsx and avoids .map( in visual zones [R-CP-10]', async () => {
    const target = site;

    const srcFiles = await listFilesRecursive(join(target, 'src'));
    const tsxFiles = srcFiles.filter((f) => f.endsWith('.tsx'));

    expect(tsxFiles.length).toBeGreaterThan(0);
    for (const file of tsxFiles) {
      const content = await readFile(join(target, 'src', file), 'utf8');
      expect(content, file).not.toContain('className={');
      expect(content, file).not.toContain('className=`');
      if (
        file.startsWith('pages/') ||
        file.startsWith('components/') ||
        file.startsWith('layouts/')
      ) {
        expect(content, file).not.toContain('.map(');
      }
    }
  });

  it('contains no external http:// or https:// links in src/ and index.html [R-PJ-10]', async () => {
    const target = site;

    const indexHtml = await readFile(join(target, 'index.html'), 'utf8');
    expect(indexHtml).not.toMatch(/https?:\/\//);

    const srcFiles = await listFilesRecursive(join(target, 'src'));
    for (const file of srcFiles) {
      const content = await readFile(join(target, 'src', file), 'utf8');
      expect(content, file).not.toMatch(/https?:\/\//);
    }
  });

  it('resolves every relative import in src/ to an existing file in the project [R-PJ-10]', async () => {
    const target = site;

    const srcDir = join(target, 'src');
    const srcFiles = await listFilesRecursive(srcDir);
    const codeFiles = srcFiles.filter((f) => /\.(ts|tsx)$/.test(f));

    for (const file of codeFiles) {
      const fullPath = join(srcDir, file);
      const content = await readFile(fullPath, 'utf8');
      const importRegex = /(?:from\s+['"](\.[^'"]+)['"]|import\s+['"](\.[^'"]+)['"])/g;
      for (const match of content.matchAll(importRegex)) {
        const specifier = match[1] ?? match[2];
        expect(specifier).toBeDefined();
        if (specifier === undefined) continue;
        const resolvedPath = resolve(dirname(fullPath), specifier);
        const relToTarget = relative(target, resolvedPath).replaceAll('\\', '/');
        const info = await stat(resolvedPath);
        expect(info.isFile(), `${file} -> ${specifier} (${relToTarget})`).toBe(true);
      }
    }
  });

  it('keeps all SVG files in public/ free of scripts, inline event handlers, and external hrefs [R-PJ-10]', async () => {
    const target = site;

    const publicFiles = await listFilesRecursive(join(target, 'public'));
    const svgFiles = publicFiles.filter((f) => f.endsWith('.svg'));

    expect(svgFiles.length).toBeGreaterThanOrEqual(5);
    for (const file of svgFiles) {
      const content = await readFile(join(target, 'public', file), 'utf8');
      expect(content, file).not.toMatch(/<script/i);
      expect(content, file).not.toMatch(/\son[a-z]+=/i);
      expect(content, file).not.toMatch(/href="http/i);
    }
  });
});
