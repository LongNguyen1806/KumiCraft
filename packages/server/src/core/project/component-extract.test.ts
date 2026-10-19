import { cp, readFile, rm, writeFile } from 'node:fs/promises';
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
  await rm(join(target, '.reactcraft', 'lock'), { force: true });
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

  it('[R-CP-14] fails with E023 usesLocalScope when element references props (#3)', async () => {
    const { target, service } = await setupProject();
    const originalCard = await readFile(join(target, 'src/components/ProductCard.tsx'), 'utf8');
    const res = await service.extractComponent({
      loc: 'src/components/ProductCard.tsx:19:9',
      tag: 'h3',
      name: 'CardTitle',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatchObject({
        code: 'E023',
        params: { reason: 'usesLocalScope', name: 'name' },
      });
    }
    const currentCard = await readFile(join(target, 'src/components/ProductCard.tsx'), 'utf8');
    expect(currentCard).toBe(originalCard);
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

  it('[R-CP-14] fails with E023 usesLocalScope when element references top-level constant (#5)', async () => {
    const { target, service } = await setupProject();
    const homePath = join(target, 'src/pages/Home.tsx');
    const homeContent = await readFile(homePath, 'utf8');
    const modifiedHome = `const title = 'Oakline';\n${homeContent.replace('Welcome to Oakline', '{title}')}`;
    await writeFile(homePath, modifiedHome, 'utf8');

    const res = await service.extractComponent({
      loc: 'src/pages/Home.tsx:9:7',
      tag: 'section',
      name: 'Promo Box',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatchObject({
        code: 'E023',
        params: { reason: 'usesLocalScope', name: 'title' },
      });
    }
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

    const cfgContent = await readFile(join(target, '.reactcraft/components.json'), 'utf8');
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
});
