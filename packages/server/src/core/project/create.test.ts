// Creating a project from the real template of the repository (R-PJ-10, R-PJ-11, ADR-BE-32).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveTemplateDir } from '../../index.ts';
import { makeTempDir, nodeFs, platform } from '../workspace/test-support.ts';
import { createProject, toPackageName } from './create.ts';
import { probeProject } from './probe.ts';

let dir: string;
let cleanup: () => Promise<void>;
const deps = () => ({ fs: nodeFs, platform, templateDir: resolveTemplateDir() });

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('createProject with the real template', () => {
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
