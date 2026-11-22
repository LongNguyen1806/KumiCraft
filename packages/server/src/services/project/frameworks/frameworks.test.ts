// SPEC-04 section 1 (M-FW) and section 2 (R-PJ-03..R-PJ-06) required tests.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { STACKS, viteReactStack } from '../../../stacks/index.ts';
import { jsxView } from '../../../stacks/view/jsx/view.ts';
import { makeTempDir, nodeFs } from '../../workspace/test-support.ts';
import { detectStack, type ProjectStack } from './index.ts';

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

    const result = await detectStack(
      {
        root: dir,
        fs: nodeFs,
        packageJson: {
          dependencies: { react: '^19.0.0' },
          devDependencies: { vite: '^8.0.0', tailwindcss: '^4.0.0' },
        },
      },
      STACKS,
    );

    expect(result.stack.id).toBe('vite-react');
    expect(result.report.supported).toBe(true);
    expect(result.report.reasons).toEqual([]);
    expect(result.report.language).toBe('ts');
    expect(result.report.viteConfig).toBe('vite.config.ts');
    expect(result.report.tailwindCss).toBe('src/index.css');
    // Situation #1 [R-PJ-02]
    expect(result.report.styling?.primary).toBe('tailwind');
    expect(result.report.styling?.editable).toBe(true);
    expect(result.report.styling?.globalCss).toEqual(['src/index.css']);
  });

  it('reports E001 noVite when project has next but no vite [R-FW-02]', async () => {
    const pkg = { dependencies: { next: '^15.0.0', react: '^19.0.0' } };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));

    const result = await detectStack(
      {
        root: dir,
        fs: nodeFs,
        packageJson: pkg,
      },
      STACKS,
    );

    expect(result.report.supported).toBe(false);
    expect(result.report.reasons).toContain('noVite');
  });

  it('selects first supported adapter when mock adapter registered [R-FW-01]', async () => {
    const mockStack: ProjectStack = {
      id: 'vite-react',
      view: jsxView,
      runtime: {
        id: 'vite',
        stampHost: 'buildPlugin',
        primaryDependency: 'mock',
        detect: () =>
          Promise.resolve({
            supported: true,
            reasons: [],
            framework: 'vite-react',
            versions: {},
            language: 'ts',
          }),
        requiredPackages: ['vite', 'react'],
        runner: { entry: 'entry.ts', options: (ctx) => ({ ...ctx, host: '127.0.0.1' }) },
        template: 'mock-template',
      },
    };

    const result = await detectStack({ root: dir, fs: nodeFs, packageJson: {} }, [
      mockStack,
      viteReactStack,
    ]);

    expect(result.stack).toBe(mockStack);
  });

  it('accurately identifies each failure reason [R-PJ-03, R-PJ-04]', async () => {
    // Missing tailwind, vite 6, react 17, missing vite.config, missing tailwind CSS
    const pkg = {
      dependencies: { react: '^17.0.0' },
      devDependencies: { vite: '^6.0.0' },
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));

    const result = await detectStack(
      {
        root: dir,
        fs: nodeFs,
        packageJson: pkg,
      },
      STACKS,
    );

    expect(result.report.supported).toBe(false);
    expect(result.report.reasons).toContain('viteVersion');
    expect(result.report.reasons).toContain('reactVersion');
    expect(result.report.reasons).toContain('noViteConfig');
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

    const result = await detectStack(
      {
        root: dir,
        fs: nodeFs,
        packageJson: pkg,
      },
      STACKS,
    );

    expect(result.report.versions.vite).toBe('8.0.2');
  });

  it('detects package manager in order [R-PJ-05]', async () => {
    // 1. packageManager field
    const pkgWithPm = { packageManager: 'pnpm@9.12.0' };
    const r1 = await detectStack({ root: dir, fs: nodeFs, packageJson: pkgWithPm }, STACKS);
    expect(r1.report.packageManager).toBe('pnpm');

    // 2. Lockfile
    await writeFile(join(dir, 'yarn.lock'), '');
    const r2 = await detectStack({ root: dir, fs: nodeFs, packageJson: {} }, STACKS);
    expect(r2.report.packageManager).toBe('yarn');
  });

  it('Situation #5: dep tailwindcss 3.4 + @tailwind base is supported and editable [R-PJ-02, R-ST-02]', async () => {
    const pkg = {
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^8.0.0', tailwindcss: '^3.4.0' },
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
    await writeFile(join(dir, 'vite.config.ts'), 'export default {}');
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src/index.css'), '@tailwind base;\n@tailwind components;');

    const result = await detectStack({ root: dir, fs: nodeFs, packageJson: pkg }, STACKS);

    expect(result.report.supported).toBe(true);
    expect(result.report.reasons).toEqual([]);
    expect(result.report.styling?.editable).toBe(true);
  });

  it('Test M7 [WP-4.00]: detect identifies craUnsupported, nextUnsupported, webpackUnsupported, and regular Vite+React has no new reasons', async () => {
    // 1. CRA project with react-scripts
    const craPkg = { dependencies: { 'react-scripts': '5.0.1', react: '18.3.1' } };
    const craResult = await detectStack({ root: dir, fs: nodeFs, packageJson: craPkg }, STACKS);
    expect(craResult.report.supported).toBe(false);
    expect(craResult.report.reasons).toContain('craUnsupported');

    // 2. Next.js project with next
    const nextPkg = { dependencies: { next: '15.1.0', react: '19.0.0' } };
    const nextResult = await detectStack({ root: dir, fs: nodeFs, packageJson: nextPkg }, STACKS);
    expect(nextResult.report.supported).toBe(false);
    expect(nextResult.report.reasons).toContain('nextUnsupported');

    // 3. Webpack project with webpack and react without vite
    const webpackPkg = {
      dependencies: { react: '18.2.0' },
      devDependencies: { webpack: '5.89.0' },
    };
    const webpackResult = await detectStack(
      { root: dir, fs: nodeFs, packageJson: webpackPkg },
      STACKS,
    );
    expect(webpackResult.report.supported).toBe(false);
    expect(webpackResult.report.reasons).toContain('webpackUnsupported');

    // 4. Regular Vite + React project has none of these unsupported reasons
    const vitePkg = {
      dependencies: { react: '19.0.0' },
      devDependencies: { vite: '8.0.0' },
    };
    await writeFile(join(dir, 'vite.config.js'), 'export default {}');
    const viteResult = await detectStack({ root: dir, fs: nodeFs, packageJson: vitePkg }, STACKS);
    expect(viteResult.report.reasons).not.toContain('craUnsupported');
    expect(viteResult.report.reasons).not.toContain('nextUnsupported');
    expect(viteResult.report.reasons).not.toContain('webpackUnsupported');
  });
});
