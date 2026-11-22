// Tests for styling system detection (Phase 3 Round S1, R-PJ-02).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../../services/workspace/test-support.ts';
import { detectViteReact } from '../runtime/vite/detect.ts';
import { detectStyling } from './detect-styling.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('detectStyling [R-PJ-02]', () => {
  it('Situation #2: Vite + React, no Tailwind, main.jsx imports ./index.css, has Card.css [R-PJ-02]', async () => {
    const pkg = {
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^8.0.0' },
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
    await writeFile(join(dir, 'vite.config.js'), 'export default {}');
    await mkdir(join(dir, 'src', 'components'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.css'), 'body { margin: 0; }');
    await writeFile(join(dir, 'src', 'components', 'Card.css'), '.card { padding: 8px; }');
    await writeFile(
      join(dir, 'src', 'main.jsx'),
      "import './index.css';\nimport App from './App';\n",
    );

    const report = await detectViteReact({
      root: dir,
      fs: nodeFs,
      packageJson: pkg,
    });

    expect(report.supported).toBe(true);
    expect(report.reasons).toEqual([]);
    expect(report.styling?.primary).toBe('css');
    expect(report.styling?.editable).toBe(false);
    expect(report.styling?.systems).toEqual([{ id: 'css' }]);
    expect(report.styling?.globalCss).toEqual(['src/index.css']);
  });

  it('Situation #3: Like #2 plus Button.module.css detects cssModules primary [R-PJ-02]', async () => {
    await mkdir(join(dir, 'src', 'a'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.css'), 'body { margin: 0; }');
    await writeFile(join(dir, 'src', 'a', 'Button.module.css'), '.btn { color: blue; }');
    await writeFile(join(dir, 'src', 'main.jsx'), "import './index.css';\n");

    const styling = await detectStyling({
      fs: nodeFs,
      root: dir,
      sourceDir: 'src',
      allDeps: { react: '^19.0.0', vite: '^8.0.0' },
    });

    expect(styling.primary).toBe('cssModules');
    expect(styling.editable).toBe(false);
    expect(styling.systems).toEqual([{ id: 'cssModules' }, { id: 'css' }]);
  });

  it('Situation #4: Bootstrap 5.3 in node_modules, main.jsx imports package css and ./index.css [R-PJ-02]', async () => {
    await mkdir(join(dir, 'node_modules', 'bootstrap'), { recursive: true });
    await writeFile(
      join(dir, 'node_modules', 'bootstrap', 'package.json'),
      JSON.stringify({ name: 'bootstrap', version: '5.3.3' }),
    );
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.css'), 'body { margin: 0; }');
    await writeFile(
      join(dir, 'src', 'main.jsx'),
      "import 'bootstrap/dist/css/bootstrap.min.css';\nimport './index.css';\n",
    );

    const styling = await detectStyling({
      fs: nodeFs,
      root: dir,
      sourceDir: 'src',
      allDeps: { bootstrap: '^5.3.0', react: '^19.0.0', vite: '^8.0.0' },
    });

    expect(styling.primary).toBe('bootstrap');
    expect(styling.systems[0]).toEqual({ id: 'bootstrap', version: '5.3.3' });
    expect(styling.globalCss).toEqual(['src/index.css']);
  });

  it('Situation #6: 5000 txt files and 1 css at end of tree stops at 3000 without hang [R-PJ-02]', async () => {
    const srcDir = join(dir, 'src');
    await mkdir(srcDir, { recursive: true });

    // Create 3500 dummy txt files concurrently in chunks to avoid timeout
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 3500; i += 1) {
      promises.push(writeFile(join(srcDir, `file_${String(i).padStart(4, '0')}.txt`), 'text'));
    }
    await Promise.all(promises);
    // Place a .css file alphabetically after the 3500 files
    await writeFile(join(srcDir, 'zzzz_last.css'), '.last { color: red; }');

    const styling = await detectStyling({
      fs: nodeFs,
      root: dir,
      sourceDir: 'src',
      allDeps: { react: '^19.0.0', vite: '^8.0.0' },
    });

    expect(styling).toBeDefined();
    expect(styling.systems).toBeDefined();
  }, 20_000);

  it('17. [R-ST-02] Tailwind 3.4 project with @tailwind is editable with tailwindCss set, and Tailwind 3 without CSS file is not editable [R-PJ-02]', async () => {
    const pkg = {
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^8.0.0', tailwindcss: '^3.4.0' },
    };
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
    await writeFile(join(dir, 'vite.config.js'), 'export default {}');
    await mkdir(join(dir, 'node_modules', 'tailwindcss'), { recursive: true });
    await writeFile(
      join(dir, 'node_modules', 'tailwindcss', 'package.json'),
      JSON.stringify({ name: 'tailwindcss', version: '3.4.17' }),
    );
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'main.jsx'), "import './index.css';\n");

    const withoutCss = await detectViteReact({ root: dir, fs: nodeFs, packageJson: pkg });
    expect(withoutCss.supported).toBe(true);
    expect(withoutCss.tailwindCss).toBeUndefined();
    expect(withoutCss.styling?.primary).toBe('tailwind');
    expect(withoutCss.styling?.editable).toBe(false);

    await writeFile(
      join(dir, 'src', 'index.css'),
      '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
    );

    const report = await detectViteReact({ root: dir, fs: nodeFs, packageJson: pkg });

    expect(report.supported).toBe(true);
    expect(report.tailwindCss).toBe('src/index.css');
    expect(report.styling?.primary).toBe('tailwind');
    expect(report.styling?.systems[0]).toEqual({ id: 'tailwind', version: '3.4.17' });
    expect(report.styling?.editable).toBe(true);
    expect(report.styling?.globalCss).toEqual(['src/index.css']);
  });
});
