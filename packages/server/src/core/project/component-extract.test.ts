import { cp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createNodeProcess } from '../../adapters/system/node-process.ts';
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

const PROP_TYPES = fileURLToPath(new URL('../../runners/prop-types.ts', import.meta.url));
const TYPESCRIPT = fileURLToPath(
  new URL('../../../../../node_modules/typescript', import.meta.url),
);

/** `real`: the project gets TypeScript and the prop-types child really runs (FR-72). */
async function setupProject(subName = 'app', real = false) {
  const target = join(tempDir, subName);
  await cp(join(baseDir, 'base'), target, { recursive: true });
  await rm(join(target, '.kumicraft', 'lock'), { force: true });
  if (real) {
    await mkdir(join(target, 'node_modules'), { recursive: true });
    await symlink(TYPESCRIPT, join(target, 'node_modules/typescript'), 'junction');
  }
  const history = createHistoryService({ fs: directWriteFs });

  const service = createProjectService({
    fs: directWriteFs,
    system: fakeSystem(1, new Set([1])),
    process: real ? createNodeProcess() : fakeProcess,
    ...(real ? { propTypesScriptPath: PROP_TYPES } : {}),
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

describe('component extraction (R-CP-14)', { timeout: 30_000 }, () => {
  it('[R-CP-14] extracts hero section of Home.tsx into PromoBox.tsx with remapped imports (#1)', async () => {
    const { target, service } = await setupProject();
    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Promo Box',
    });
    expect(res.ok).toBe(true);

    const newContent = await readFile(join(target, 'src/components/PromoBox.tsx'), 'utf8');
    expect(newContent).toContain("import { Button } from './ui/Button.tsx';");
    expect(newContent).toContain('export function PromoBox() {');
    expect(newContent).toContain('<Button>Shop now</Button>');

    const homeContent = await readFile(join(target, 'src/pages/Home.tsx'), 'utf8');
    expect(homeContent).toContain('<PromoBox />');
    expect(homeContent).toContain("import { PromoBox } from '@/components/PromoBox';");
  });

  it('[R-CP-14, R-HI-11] undo removes new component and restores source byte-for-byte; redo restores both (#2)', async () => {
    const { target, service, history } = await setupProject();
    const originalHome = await readFile(join(target, 'src/pages/Home.tsx'), 'utf8');

    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Promo Box',
    });
    expect(res.ok).toBe(true);
    const extractedPromo = await readFile(join(target, 'src/components/PromoBox.tsx'), 'utf8');

    const undoRes = await history.undo(target);
    expect(undoRes.ok).toBe(true);
    const restoredHome = await readFile(join(target, 'src/pages/Home.tsx'), 'utf8');
    expect(restoredHome).toBe(originalHome);
    await expect(readFile(join(target, 'src/components/PromoBox.tsx'), 'utf8')).rejects.toThrow();

    const redoRes = await history.redo(target);
    expect(redoRes.ok).toBe(true);
    const redoneHome = await readFile(join(target, 'src/pages/Home.tsx'), 'utf8');
    expect(redoneHome).toContain('<PromoBox />');
    const redonePromo = await readFile(join(target, 'src/components/PromoBox.tsx'), 'utf8');
    expect(redonePromo).toBe(extractedPromo);
  });

  it('[FR-72] a prop the selection uses becomes a typed prop of the new component (#3) [WP-4.00]', async () => {
    const { target, service } = await setupProject('app', true);
    const res = await service.extractComponent({
      loc: 'src/components/ProductCard.tsx:19:9',
      tag: 'h3',
      name: 'CardTitle',
    });
    expect(res.ok || res.error).toBe(true);
    const card = await readFile(join(target, 'src/components/ProductCard.tsx'), 'utf8');
    expect(card).toContain('<CardTitle name={name} />');
    const created = await readFile(join(target, 'src/components/CardTitle.tsx'), 'utf8');
    expect(created).toContain('type CardTitleProps = {\n  name: string;\n};');
    expect(created).toContain('export function CardTitle({ name }: CardTitleProps) {');
    expect(created).toContain('{name}</h3>');
  });

  it('[FR-72] without the project TypeScript a TSX extraction with props is refused (#3b) [WP-4.00]', async () => {
    const { target, service } = await setupProject();
    const originalCard = await readFile(join(target, 'src/components/ProductCard.tsx'), 'utf8');
    const res = await service.extractComponent({
      loc: 'src/components/ProductCard.tsx:19:9',
      tag: 'h3',
      name: 'CardTitle',
    });
    expect(res.ok || res.error).toMatchObject({ code: 'E023', params: { reason: 'propTypes' } });
    expect(await readFile(join(target, 'src/components/ProductCard.tsx'), 'utf8')).toBe(
      originalCard,
    );
  });

  it('[R-CP-14] succeeds when element references internal closure variable and global identifiers (#4)', async () => {
    const { target, service } = await setupProject();
    const homePath = join(target, 'src/pages/Home.tsx');
    const homeContent = await readFile(homePath, 'utf8');
    const modifiedHome = homeContent.replace(
      '<Button>Shop now</Button>',
      '<button onClick={(e) => console.log(e)}>{Math.max(1, 2)}</button>',
    );
    await writeFile(homePath, modifiedHome, 'utf8');

    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Promo Box',
    });
    if (!res.ok) {
      expect(res.error).toBeUndefined();
    }
    expect(res.ok).toBe(true);
  });

  it('[FR-72] a top-level constant of the old file is passed as a prop (#5) [WP-4.00]', async () => {
    const { target, service } = await setupProject('app', true);
    const homePath = join(target, 'src/pages/Home.tsx');
    const homeContent = await readFile(homePath, 'utf8');
    const modifiedHome = `const title = 'Oakline';\n${homeContent.replace('Welcome to Oakline', '{title}')}`;
    await writeFile(homePath, modifiedHome, 'utf8');

    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:9:7',
      tag: 'section',
      name: 'Promo Box',
    });
    expect(res.ok || res.error).toBe(true);
    expect(await readFile(homePath, 'utf8')).toContain('<PromoBox title={title} />');
    const created = await readFile(join(target, 'src/components/PromoBox.tsx'), 'utf8');
    expect(created).toContain('type PromoBoxProps = {\n  title: string;\n};');
  });

  it('[R-CP-14] fails with E023 loopRoot when element is root of .map callback (#6)', async () => {
    const { target, service } = await setupProject();
    const homePath = join(target, 'src/pages/Home.tsx');
    const homeContent = await readFile(homePath, 'utf8');
    const loopSnippet = `
      <div>
        {[1, 2].map((num) => (
          <div key={num} className="item">
            <span>{num}</span>
          </div>
        ))}
      </div>
    `;
    const modifiedHome = homeContent.replace(
      '<div className="mx-auto max-w-6xl space-y-16 px-6 py-12">',
      `<div className="mx-auto max-w-6xl space-y-16 px-6 py-12">${loopSnippet}`,
    );
    await writeFile(homePath, modifiedHome, 'utf8');

    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:10:11',
      tag: 'div',
      name: 'LoopItem',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatchObject({
        code: 'E023',
        params: { reason: 'loopRoot' },
      });
    }
  });

  it('[R-CP-14] validation errors: fileExists, nameExists, outsideRoot directory (#7)', async () => {
    const { service } = await setupProject();
    const fileExistsRes = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Button',
      dir: 'src/components/ui',
    });
    expect(fileExistsRes.ok).toBe(false);
    if (!fileExistsRes.ok) {
      expect(fileExistsRes.error).toMatchObject({
        code: 'E016',
        params: { reason: 'fileExists' },
      });
    }

    const nameExistsRes = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Button',
      fileName: 'OtherButton.tsx',
    });
    expect(nameExistsRes.ok).toBe(false);
    if (!nameExistsRes.ok) {
      expect(nameExistsRes.error).toMatchObject({
        code: 'E016',
        params: { reason: 'nameExists' },
      });
    }

    const outsideRes = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Promo Box',
      dir: '../outside',
    });
    expect(outsideRes.ok).toBe(false);
    if (!outsideRes.ok) {
      expect(outsideRes.error).toMatchObject({ code: 'E012' });
    }
  });

  it('[R-CP-14, R-CP-12] extracts into non-standard dir, updates components.json and components-list (#8)', async () => {
    const { target, service, info } = await setupProject();
    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Promo Box',
      dir: 'src/features/promo',
    });
    expect(res.ok).toBe(true);

    const cfgContent = await readFile(join(target, '.kumicraft/components.json'), 'utf8');
    const parsedCfg = JSON.parse(cfgContent) as { files?: string[] };
    expect(parsedCfg.files).toContain('src/features/promo/PromoBox.tsx');

    const components = await listProjectComponents({ fs: directWriteFs }, target, info);
    expect(components.some((c) => c.name === 'PromoBox')).toBe(true);
  });

  it('[R-CP-14] project without alias uses relative import starting with ../ (#9)', async () => {
    const { target, service } = await setupProject();
    const tsconfigPath = join(target, 'tsconfig.json');
    const tsconfigContent = await readFile(tsconfigPath, 'utf8');
    const parsedTsconfig = JSON.parse(tsconfigContent) as { compilerOptions?: { paths?: unknown } };
    if (parsedTsconfig.compilerOptions) delete parsedTsconfig.compilerOptions.paths;
    await writeFile(tsconfigPath, JSON.stringify(parsedTsconfig, undefined, 2), 'utf8');

    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Promo Box',
      dir: 'src/components',
    });
    expect(res.ok).toBe(true);

    const homeContent = await readFile(join(target, 'src/pages/Home.tsx'), 'utf8');
    expect(homeContent).toContain("import { PromoBox } from '../components/PromoBox';");
  });

  it('[R-CP-14] preserves CRLF formatting in both new file and source file (#10)', async () => {
    const { target, service } = await setupProject();
    const homePath = join(target, 'src/pages/Home.tsx');
    const homeContent = await readFile(homePath, 'utf8');
    const crlfHome = homeContent.replace(/\n/g, '\r\n');
    await writeFile(homePath, crlfHome, 'utf8');

    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Promo Box',
    });
    expect(res.ok).toBe(true);

    const newContent = await readFile(join(target, 'src/components/PromoBox.tsx'), 'utf8');
    expect(newContent).toContain('\r\n');
    expect(newContent.split('\r\n').length).toBeGreaterThan(1);

    const updatedHome = await readFile(homePath, 'utf8');
    expect(updatedHome).toContain('\r\n');
    expect(updatedHome).not.toMatch(/[^\r]\n/);
  });

  it('Test 7 [WP-4.00]: target file in second component directory is recognized as component', async () => {
    const { target, service } = await setupProject();
    await service.patchProject({
      designDirs: {
        pages: ['src/pages'],
        layouts: ['src/layouts'],
        components: ['src/components', 'src/shared-components'],
      },
    });

    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:8:7',
      tag: 'section',
      name: 'Shared Card',
      dir: 'src/shared-components',
    });
    expect(res.ok).toBe(true);

    const exists = await directWriteFs.exists(target, 'src/shared-components/SharedCard.tsx');
    expect(exists).toBe(true);

    // It is in second component dir, so it should NOT be written to components.json as a standalone custom file
    const configExists = await directWriteFs.exists(target, '.kumicraft/components.json');
    if (configExists) {
      const configRaw = await readFile(join(target, '.kumicraft/components.json'), 'utf8');
      expect(configRaw).not.toContain('src/shared-components/SharedCard.tsx');
    }
  });
});
