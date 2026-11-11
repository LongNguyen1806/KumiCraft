import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resolveTemplateDir } from '../../index.ts';
import { createHistoryService } from '../history/history-service.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { ok } from '../shared/result.ts';
import { createUsageCounter } from '../source-editor/component-usages.ts';
import { executeStructureEdit } from '../source-editor/structure/structure-runner.ts';
import {
  directWriteFs,
  fakeSystem,
  makeTempDir,
  platform,
  silentLogger,
} from '../workspace/test-support.ts';
import { listProjectComponents } from './components-list.ts';
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
  await rm(join(target, '.kumicraft', 'lock'), { force: true });
  const history = createHistoryService({ fs: directWriteFs });

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
    history,
  });

  const opened = await service.open(target);
  if (!opened.ok) throw new Error('Failed to open test project');
  return { target, service, history, info: opened.value };
}

describe('listProjectComponents', { timeout: 30_000 }, () => {
  it('[R-CP-12] returns MainLayout first, components with usages on template (scenario 1)', async () => {
    const { target, info } = await setupProject();
    const counter = createUsageCounter(directWriteFs);
    const components = await listProjectComponents(
      { fs: directWriteFs, usageCounter: counter },
      target,
      info,
    );

    expect(components.length).toBeGreaterThanOrEqual(8);
    expect(components[0]?.name).toBe('MainLayout');
    expect(components[0]?.kind).toBe('layout');

    const names = components.map((c) => c.name);
    expect(names).toContain('Header');
    expect(names).toContain('Footer');
    expect(names).toContain('ProductCard');
    expect(names).toContain('Badge');
    expect(names).toContain('Button');
    expect(names).toContain('Card');
    expect(names).toContain('Input');

    const header = components.find((c) => c.name === 'Header');
    expect(header?.usages).toBeGreaterThanOrEqual(1);
    expect(header?.file).toBe('src/components/Header.tsx');

    const productCard = components.find((c) => c.name === 'ProductCard');
    expect(productCard?.usages).toBeGreaterThanOrEqual(1);
    expect(productCard?.file).toBe('src/components/ProductCard.tsx');
  });

  it('[R-CP-13] builds importStatement with alias @/ for template components (scenario 2)', async () => {
    const { target, info } = await setupProject();
    const counter = createUsageCounter(directWriteFs);
    const components = await listProjectComponents(
      { fs: directWriteFs, usageCounter: counter },
      target,
      info,
    );

    const header = components.find((c) => c.name === 'Header');
    expect(header?.importStatement).toBe("import { Header } from '@/components/Header';");

    const button = components.find((c) => c.name === 'Button');
    expect(button?.importStatement).toBe("import { Button } from '@/components/ui/Button';");
  });

  it('[R-CP-13] builds relative importStatement when tsconfig has no paths (scenario 3)', async () => {
    const { target, info } = await setupProject();
    const tsconfigPath = join(target, 'tsconfig.json');
    const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf8')) as {
      compilerOptions: { paths?: Record<string, string[]> };
    };
    delete tsconfig.compilerOptions.paths;
    await writeFile(tsconfigPath, JSON.stringify(tsconfig, undefined, 2), 'utf8');

    const counter = createUsageCounter(directWriteFs);
    const components = await listProjectComponents(
      { fs: directWriteFs, usageCounter: counter },
      target,
      info,
    );

    const header = components.find((c) => c.name === 'Header');
    expect(header?.importStatement).toBe("import { Header } from './Header';");
  });

  it('[R-CP-12] ignores type exports and lowercase helper, retains default uppercase export (scenario 4)', async () => {
    const { target, info } = await setupProject();
    const promoCode = [
      'export type PromoProps = { title: string };',
      'export interface PromoItem { id: string };',
      'export const helper = 1;',
      'export default function Promo() { return <div>Promo</div>; }',
    ].join('\n');
    await writeFile(join(target, 'src', 'components', 'Promo.tsx'), promoCode, 'utf8');

    const counter = createUsageCounter(directWriteFs);
    const components = await listProjectComponents(
      { fs: directWriteFs, usageCounter: counter },
      target,
      info,
    );

    const promoItems = components.filter((c) => c.file === 'src/components/Promo.tsx');
    expect(promoItems).toHaveLength(1);
    expect(promoItems[0]?.name).toBe('Promo');
    expect(promoItems[0]?.importStatement).toBe("import Promo from '@/components/Promo';");
  });

  it('[R-CP-12] handles .kumicraft/components.json valid, malformed, and missing file (scenario 5)', async () => {
    const { target, info } = await setupProject();
    const promoCode = 'export default function Promo() { return <div>Promo</div>; }';
    await mkdir(join(target, 'src', 'features', 'x'), { recursive: true });
    await writeFile(join(target, 'src', 'features', 'x', 'Promo.tsx'), promoCode, 'utf8');

    const configPath = join(target, '.kumicraft', 'components.json');
    await writeFile(configPath, JSON.stringify({ files: ['src/features/x/Promo.tsx'] }), 'utf8');

    const counter = createUsageCounter(directWriteFs);
    const res1 = await listProjectComponents(
      { fs: directWriteFs, usageCounter: counter },
      target,
      info,
    );
    expect(res1.some((c) => c.name === 'Promo')).toBe(true);

    await writeFile(configPath, '{ invalid json', 'utf8');
    const res2 = await listProjectComponents(
      { fs: directWriteFs, usageCounter: counter },
      target,
      info,
    );
    expect(res2.some((c) => c.name === 'Promo')).toBe(false);

    await rm(join(target, 'src', 'features', 'x', 'Promo.tsx'), { force: true });
    await writeFile(configPath, JSON.stringify({ files: ['src/features/x/Promo.tsx'] }), 'utf8');
    const res3 = await listProjectComponents(
      { fs: directWriteFs, usageCounter: counter },
      target,
      info,
    );
    expect(res3.some((c) => c.name === 'Promo')).toBe(false);
  });

  it('[R-CP-13] [R-SE-23] inserts Header into About.tsx with alias import and undo restores byte-for-byte (scenario 6)', async () => {
    const { target, history, info } = await setupProject();
    const counter = createUsageCounter(directWriteFs);
    const components = await listProjectComponents(
      { fs: directWriteFs, usageCounter: counter },
      target,
      info,
    );
    const header = components.find((c) => c.name === 'Header');
    expect(header).toBeDefined();
    if (!header) return;

    const aboutRel = 'src/pages/About.tsx';
    const beforeBytes = await readFile(join(target, aboutRel), 'utf8');

    const editRes = await executeStructureEdit(
      directWriteFs,
      target,
      'src',
      ['.tsx', '.jsx'],
      {
        kind: 'insert',
        target: {
          kind: 'child',
          parent: { loc: `${aboutRel}:7:5`, tag: 'div' },
          where: 'start',
        },
        jsx: '<Header />',
        from: {
          file: header.file,
          imports: [header.importStatement],
        },
      },
      (files) => {
        history.push({ label: { key: 'structure.insert' }, files });
      },
    );

    expect(editRes.ok).toBe(true);
    const afterInsert = await readFile(join(target, aboutRel), 'utf8');
    expect(afterInsert).toContain("import { Header } from '@/components/Header';");
    expect(afterInsert).toContain('<Header />');

    const undoRes = await history.undo(target);
    expect(undoRes.ok).toBe(true);
    const afterUndoBytes = await readFile(join(target, aboutRel), 'utf8');
    expect(afterUndoBytes).toBe(beforeBytes);
  });

  it('[R-CP-13] inserts Header into About.tsx with relative import when no alias (scenario 7)', async () => {
    const { target, info } = await setupProject();
    const tsconfigPath = join(target, 'tsconfig.json');
    const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf8')) as {
      compilerOptions: { paths?: Record<string, string[]> };
    };
    delete tsconfig.compilerOptions.paths;
    await writeFile(tsconfigPath, JSON.stringify(tsconfig, undefined, 2), 'utf8');

    const counter = createUsageCounter(directWriteFs);
    const components = await listProjectComponents(
      { fs: directWriteFs, usageCounter: counter },
      target,
      info,
    );
    const header = components.find((c) => c.name === 'Header');
    expect(header).toBeDefined();
    if (!header) return;

    const aboutRel = 'src/pages/About.tsx';
    const editRes = await executeStructureEdit(directWriteFs, target, 'src', ['.tsx', '.jsx'], {
      kind: 'insert',
      target: {
        kind: 'child',
        parent: { loc: `${aboutRel}:7:5`, tag: 'div' },
        where: 'start',
      },
      jsx: '<Header />',
      from: {
        file: header.file,
        imports: [header.importStatement],
      },
    });

    expect(editRes.ok).toBe(true);
    const afterInsert = await readFile(join(target, aboutRel), 'utf8');
    expect(afterInsert).toContain("import { Header } from '../components/Header';");
    expect(afterInsert).toContain('<Header />');
  });

  it('Test 9 [WP-4.00]: two component dirs + nested layout dir -> each file appears once; nested file is layout', async () => {
    const { target, info } = await setupProject();
    await directWriteFs.mkdir(target, 'src/widgets');
    await directWriteFs.writeTextAtomic(
      target,
      'src/widgets/Sidebar.tsx',
      'export function Sidebar() { return <aside>Sidebar</aside>; }\n',
    );
    await directWriteFs.mkdir(target, 'src/components/layouts');
    await directWriteFs.writeTextAtomic(
      target,
      'src/components/layouts/DashboardLayout.tsx',
      'export function DashboardLayout() { return <div>Layout</div>; }\n',
    );

    const customInfo = {
      ...info,
      designDirs: {
        pages: ['src/pages'],
        layouts: ['src/components/layouts'],
        components: ['src/components', 'src/widgets'],
        drafts: 'src/drafts',
      },
    };

    const components = await listProjectComponents({ fs: directWriteFs }, target, customInfo);

    const sidebar = components.find((c) => c.name === 'Sidebar');
    expect(sidebar).toBeDefined();
    expect(sidebar?.kind).toBe('component');

    const layout = components.find((c) => c.name === 'DashboardLayout');
    expect(layout).toBeDefined();
    expect(layout?.kind).toBe('layout');

    // Only appears once
    const allLayoutOccurrences = components.filter((c) => c.name === 'DashboardLayout');
    expect(allLayoutOccurrences.length).toBe(1);
  });

  it('[R-CP-12] reads each file at most twice for the whole list, with the same usage counts (spec-log #117)', async () => {
    const { target, info } = await setupProject();
    const reads = new Map<string, number>();
    const countingFs: typeof directWriteFs = {
      ...directWriteFs,
      readText: (root, rel, options) => {
        reads.set(rel, (reads.get(rel) ?? 0) + 1);
        return directWriteFs.readText(root, rel, options);
      },
    };

    const batched = await listProjectComponents({ fs: countingFs }, target, info);
    const plain = createUsageCounter(directWriteFs);
    for (const component of batched) {
      expect(await plain.count(target, info.sourceDir, component.file, component.name)).toBe(
        component.usages,
      );
    }
    // Before: every component read the whole project again (one file read ~20 times here).
    expect(Math.max(...reads.values())).toBeLessThanOrEqual(2);
  });
});
