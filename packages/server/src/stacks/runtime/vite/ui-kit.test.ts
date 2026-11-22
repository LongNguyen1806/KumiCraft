// Unit tests for shadcn components.json detection in vite-react adapter (TK-44, test 17).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { LIBRARY_BLOCKS, renderBlock } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs } from '../../../services/workspace/test-support.ts';
import { detectViteReact } from './detect.ts';

describe('ui-kit detection [TK-44]', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-uikit-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'vite.config.ts'), 'export default {};', 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const basePkg = {
    dependencies: { react: '^19.0.0' },
    devDependencies: { vite: '^8.0.0', tailwindcss: '^4.0.0' },
  };

  it('17a. detects components.json at root + src/components/ui/button.tsx', async () => {
    await fs.mkdir(path.join(tmpDir, 'src/components/ui'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'components.json'),
      JSON.stringify({ aliases: { components: '@/components', ui: '@/components/ui' } }),
      'utf8',
    );
    await fs.writeFile(path.join(tmpDir, 'src/components/ui/button.tsx'), 'export {};', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/components/ui/card.tsx'), 'export {};', 'utf8');

    const report = await detectViteReact({ fs: directWriteFs, root: tmpDir, packageJson: basePkg });
    expect(report.supported).toBe(true);
    expect(report.uiKit).toEqual({
      kind: 'shadcn',
      uiDir: 'src/components/ui',
      importBase: '@/components/ui',
      components: ['button', 'card'],
    });
  });

  it('17b. returns undefined uiKit when root components.json is absent (ignores .kumicraft/components.json)', async () => {
    await fs.mkdir(path.join(tmpDir, '.kumicraft'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'src/components/ui'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.kumicraft/components.json'),
      JSON.stringify({ aliases: { ui: '@/components/ui' } }),
      'utf8',
    );
    await fs.writeFile(path.join(tmpDir, 'src/components/ui/button.tsx'), 'export {};', 'utf8');

    const report = await detectViteReact({ fs: directWriteFs, root: tmpDir, packageJson: basePkg });
    expect(report.supported).toBe(true);
    expect(report.uiKit).toBeUndefined();
  });

  it('Test 9: react-shadcn fixture detects tabs, routes interactive.tabs to project component without kit, and falls back for missing modal', async () => {
    const fixtureRoot = path.resolve(
      import.meta.dirname,
      '../../../../../../fixtures/projects/react-shadcn',
    );
    const pkgRaw = await fs.readFile(path.join(fixtureRoot, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
    const report = await detectViteReact({
      fs: directWriteFs,
      root: fixtureRoot,
      packageJson: pkg,
    });
    expect(report.uiKit?.kind).toBe('shadcn');
    expect(report.uiKit?.components).toContain('tabs');
    expect(report.uiKit?.components).not.toContain('dialog');

    const tabsBlock = LIBRARY_BLOCKS.find((b) => b.id === 'interactive.tabs');
    const modalBlock = LIBRARY_BLOCKS.find((b) => b.id === 'interactive.modal');
    expect(tabsBlock).toBeDefined();
    expect(modalBlock).toBeDefined();
    if (tabsBlock === undefined || modalBlock === undefined) return;

    const tabsRendered = renderBlock(
      tabsBlock,
      'tailwind4',
      'en',
      undefined,
      undefined,
      report.uiKit,
    );
    expect(tabsRendered.usedUiKit).toBe(true);
    expect(tabsRendered.kit).toBeUndefined();
    expect(tabsRendered.imports?.some((line) => line.includes('@/components/ui/tabs'))).toBe(true);

    const modalRendered = renderBlock(
      modalBlock,
      'tailwind4',
      'en',
      undefined,
      undefined,
      report.uiKit,
    );
    expect(modalRendered.usedUiKit).toBeUndefined();
    expect(modalRendered.kit).toEqual({ components: ['Modal'] });
  });
});
