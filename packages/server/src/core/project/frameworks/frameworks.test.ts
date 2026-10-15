// SPEC-04 section 1 (M-FW) and section 2 (R-PJ-03..R-PJ-06) required tests.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../../workspace/test-support.ts';
import { detectFramework, type FrameworkAdapter } from './index.ts';
import { viteReactAdapter } from './vite-react/index.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('M-FW: Framework detection', () => {
  it('detects valid Vite 8 + React 19 + Tailwind 4 project [R-FW-01]', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^19.0.0' },
        devDependencies: { vite: '^8.0.0', tailwindcss: '^4.0.0' },
      }),
    );
    await writeFile(join(dir, 'vite.config.ts'), 'export default {}');
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src/index.css'), '@import "tailwindcss";');
    await writeFile(join(dir, 'tsconfig.json'), '{}');

    const result = await detectFramework({
      root: dir,
      fs: nodeFs,
      packageJson: {
        dependencies: { react: '^19.0.0' },
        devDependencies: { vite: '^8.0.0', tailwindcss: '^4.0.0' },
      },
    });

    expect(result.adapter.id).toBe('vite-react');
    expect(result.report.supported).toBe(true);
    expect(result.report.reasons).toEqual([]);
    expect(result.report.language).toBe('ts');
    expect(result.report.viteConfig).toBe('vite.config.ts');
    expect(result.report.tailwindCss).toBe('src/index.css');
  });

  it('reports E001 noVite when project has next but no vite [R-FW-02]', async () => {
    const pkg = { dependencies: { next: '^15.0.0', react: '^19.0.0' } };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));

    const result = await detectFramework({
      root: dir,
      fs: nodeFs,
      packageJson: pkg,
    });

    expect(result.report.supported).toBe(false);
    expect(result.report.reasons).toContain('noVite');
  });

  it('selects first supported adapter when mock adapter registered [R-FW-01]', async () => {
    const mockAdapter: FrameworkAdapter = {
      id: 'vite-react',
      primaryDependency: 'mock',
      detect: () =>
        Promise.resolve({
          supported: true,
          reasons: [],
          framework: 'vite-react',
          versions: {},
          language: 'ts',
        }),
      sourceExtensions: ['.tsx'],
      runner: { entry: 'entry.ts', options: (ctx) => ({ ...ctx, host: '127.0.0.1' }) },
      template: 'mock-template',
    };

    const result = await detectFramework({ root: dir, fs: nodeFs, packageJson: {} }, [
      mockAdapter,
      viteReactAdapter,
    ]);

    expect(result.adapter).toBe(mockAdapter);
  });

  it('accurately identifies each failure reason [R-PJ-03, R-PJ-04]', async () => {
    // Missing tailwind, vite 6, react 17, missing vite.config, missing tailwind CSS
    const pkg = {
      dependencies: { react: '^17.0.0' },
      devDependencies: { vite: '^6.0.0' },
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));

    const result = await detectFramework({
      root: dir,
      fs: nodeFs,
      packageJson: pkg,
    });

    expect(result.report.supported).toBe(false);
    expect(result.report.reasons).toContain('viteVersion');
    expect(result.report.reasons).toContain('reactVersion');
    expect(result.report.reasons).toContain('noTailwind');
    expect(result.report.reasons).toContain('noViteConfig');
    expect(result.report.reasons).toContain('noTailwindCss');
  });

  it('uses installed version in node_modules over declared range [R-PJ-03]', async () => {
    const pkg = {
      devDependencies: { vite: '^7.1.0', tailwindcss: '^4.0.0' },
      dependencies: { react: '^19.0.0' },
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
    await mkdir(join(dir, 'node_modules/vite'), { recursive: true });
    await writeFile(
      join(dir, 'node_modules/vite/package.json'),
      JSON.stringify({ version: '8.0.2' }),
    );
    await writeFile(join(dir, 'vite.config.ts'), 'export default {}');
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src/index.css'), '@import "tailwindcss";');

    const result = await detectFramework({
      root: dir,
      fs: nodeFs,
      packageJson: pkg,
    });

    expect(result.report.versions.vite).toBe('8.0.2');
  });

  it('detects package manager in order [R-PJ-05]', async () => {
    // 1. packageManager field
    const pkgWithPm = { packageManager: 'pnpm@9.12.0' };
    const r1 = await detectFramework({ root: dir, fs: nodeFs, packageJson: pkgWithPm });
    expect(r1.report.packageManager).toBe('pnpm');

    // 2. Lockfile
    await writeFile(join(dir, 'yarn.lock'), '');
    const r2 = await detectFramework({ root: dir, fs: nodeFs, packageJson: {} });
    expect(r2.report.packageManager).toBe('yarn');
  });
});
