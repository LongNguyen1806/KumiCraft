import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { newWorkspaceFile, ThemeEditSchema } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService, type HistoryService } from '../history/history-service.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { ok } from '../shared/result.ts';
import {
  directWriteFs,
  fakeSystem,
  makeTempDir,
  nodeFs,
  platform,
  silentLogger,
} from '../workspace/test-support.ts';
import type { ProjectServiceDeps, WorkspaceState } from './project-types.ts';
import { countProjectThemeUsage, editProjectTheme, readThemeTokens } from './theme.ts';
import { applyThemeEdit, countTokenUses, isValidThemeValue } from './theme-edit.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

const SAMPLE_CSS = [
  '@import "tailwindcss";',
  '',
  '@theme {',
  '  --color-brand: #2563eb; /* primary */',
  '  --color-brand-soft: #93c5fd;',
  '  --font-display: "Plus Jakarta Sans", sans-serif;',
  '  --text-hero: 3rem;',
  '  --text-hero--line-height: 1.1;',
  '  --radius-card: 0.75rem;',
  '  --shadow-card: 0 4px 12px rgb(0 0 0 / 0.08);',
  '}',
  '',
].join('\n');

const fakeProcess: ProcessPort = {
  spawn: () => ({
    pid: 1,
    onLine: () => undefined,
    wait: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '', lines: [] }),
    kill: () => Promise.resolve(),
  }),
};

function makeOpenWorkspace(
  root: string,
  tailwindCss = 'src/index.css',
): {
  state: WorkspaceState;
  deps: ProjectServiceDeps;
  history: HistoryService;
} {
  const history = createHistoryService({ fs: directWriteFs });
  const deps: ProjectServiceDeps = {
    fs: directWriteFs,
    system: fakeSystem(1, new Set([1])),
    process: fakeProcess,
    config: {
      isTrusted: () => true,
      setTrusted: () => Promise.resolve(ok(undefined)),
      settings: () => ({ editor: 'vscode' as const, agent: { preferred: 'auto' as const } }),
    },
    logger: silentLogger,
    port: 50302,
    platform,
    templateDir: root,
    history,
  };
  const state: WorkspaceState = {
    status: 'open',
    root,
    file: newWorkspaceFile({
      id: 'test000001',
      name: 'App',
      createdAt: '2026-01-01T00:00:00.000Z',
      framework: 'vite-react',
      responsiveMode: 'desktop-first',
    }),
    support: {
      supported: true,
      reasons: [],
      versions: {},
      framework: 'vite-react',
      language: 'ts',
      tailwindCss,
    },
    trusted: true,
    needsInstall: false,
    backends: [],
  };
  return { state, deps, history };
}

describe('readThemeTokens [R-PJ-17]', () => {
  it('reads @theme inline and skips line-height tokens [R-PJ-17]', async () => {
    const css =
      '@import "tailwindcss";\n@theme inline {\n  --color-brand: #f00;\n  --text-hero: 3rem;\n  --text-hero--line-height: 1.1;\n  --radius-card: 12px;\n}\n';
    await writeFile(join(dir, 't.css'), css);

    const result = await readThemeTokens(nodeFs, dir, 't.css');
    expect(result).toEqual({
      ok: true,
      value: {
        file: 't.css',
        colors: [{ name: 'brand', value: '#f00' }],
        fontSizes: [{ name: 'hero', value: '3rem' }],
        radii: [{ name: 'card', value: '12px' }],
        fonts: [],
        shadows: [],
        breakpoints: [],
      },
    });
  });
});

describe('applyThemeEdit & isValidThemeValue [R-TH-11, R-TH-12, R-TH-14]', () => {
  it('#1: set replaces only the value slice and preserves comments and neighbors [R-TH-11, R-TH-14]', () => {
    const res = applyThemeEdit(SAMPLE_CSS, {
      op: 'set',
      kind: 'color',
      name: 'brand',
      value: '#1d4ed8',
    });
    expect(res).toEqual({
      ok: true,
      value: SAMPLE_CSS.replace('--color-brand: #2563eb;', '--color-brand: #1d4ed8;'),
    });
  });

  it('#2: isValidThemeValue validates CSS values and rejects injection [R-TH-11]', () => {
    expect(isValidThemeValue('color', '#ff00aa')).toBe(true);
    expect(isValidThemeValue('color', 'oklch(0.6 0.2 250)')).toBe(true);
    expect(isValidThemeValue('color', 'red; } body { display:none')).toBe(false);
    expect(isValidThemeValue('radius', '0.5rem')).toBe(true);
    expect(isValidThemeValue('radius', '8px')).toBe(true);
    expect(isValidThemeValue('radius', '0')).toBe(true);
    expect(isValidThemeValue('radius', '8')).toBe(false);
    expect(isValidThemeValue('radius', '1vw')).toBe(false);
    expect(isValidThemeValue('font', '"Inter", sans-serif')).toBe(true);
    expect(isValidThemeValue('shadow', '0 4px 12px rgb(0 0 0 / 0.08)')).toBe(true);
  });

  it('#3: add inserts a new token at the end of @theme with matching indentation and CRLF [R-TH-12, R-TH-14]', () => {
    const crlf = SAMPLE_CSS.replace(/\n/g, '\r\n');
    const res = applyThemeEdit(crlf, {
      op: 'add',
      kind: 'color',
      name: 'accent',
      value: '#f59e0b',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toContain('  --color-accent: #f59e0b;\r\n}');
      expect(res.value.includes('\r\n')).toBe(true);
      expect(res.value.replace(/\r\n/g, '')).not.toContain('\n');
    }
  });

  it('#4: add rejects existing token name with tokenExists [R-TH-12]', () => {
    const res = applyThemeEdit(SAMPLE_CSS, {
      op: 'add',
      kind: 'color',
      name: 'brand',
      value: '#000000',
    });
    expect(res).toEqual({
      ok: false,
      error: { code: 'E016', params: { reason: 'tokenExists' } },
    });
  });

  it('#5: add creates @theme block after @import "tailwindcss"; when missing [R-TH-12]', () => {
    const raw = '@import "tailwindcss";\n.btn { color: red; }\n';
    const res = applyThemeEdit(raw, {
      op: 'add',
      kind: 'radius',
      name: 'card',
      value: '1rem',
    });
    expect(res).toEqual({
      ok: true,
      value:
        '@import "tailwindcss";\n\n@theme {\n  --radius-card: 1rem;\n}\n.btn { color: red; }\n',
    });
  });

  it('#6: ThemeEditSchema rejects invalid token names [R-TH-12]', () => {
    for (const bad of ['Brand', '1a', 'a_b', '-a', '']) {
      const parsed = ThemeEditSchema.safeParse({
        op: 'add',
        kind: 'color',
        name: bad,
        value: '#000',
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('#7: remove deletes only the target declaration line and keeps --text-hero--line-height [R-TH-13]', () => {
    const res = applyThemeEdit(SAMPLE_CSS, {
      op: 'remove',
      kind: 'fontSize',
      name: 'hero',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).not.toContain('--text-hero: 3rem;');
      expect(res.value).toContain('--text-hero--line-height: 1.1;');
    }
  });
});

describe('countTokenUses & ProjectService theme operations [R-TH-11, R-TH-13, M-HI]', () => {
  it('#8: countTokenUses matches exact token classes with variants and opacity [R-TH-13]', () => {
    const src = '<div className="bg-brand hover:text-brand/50 bg-brand-soft border-brand">x</div>';
    expect(countTokenUses(src, 'color', 'brand')).toBe(3);
  });

  it('#9: countTokenUses matches font, fontSize, radius, and shadow classes [R-TH-13]', () => {
    const src = '<h1 className="font-display text-hero rounded-card shadow-card">Hi</h1>';
    expect(countTokenUses(src, 'font', 'display')).toBe(1);
    expect(countTokenUses(src, 'fontSize', 'hero')).toBe(1);
    expect(countTokenUses(src, 'radius', 'card')).toBe(1);
    expect(countTokenUses(src, 'shadow', 'card')).toBe(1);
  });

  it('#10 & #11: editProjectTheme writes CSS, records 1 history step, and Undo/Redo restores bytes [R-TH-11, M-HI]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const cssFullPath = join(dir, 'src', 'index.css');
    await writeFile(cssFullPath, SAMPLE_CSS);
    const { state, deps, history } = makeOpenWorkspace(dir);

    const editRes = await editProjectTheme(state, deps, {
      op: 'set',
      kind: 'color',
      name: 'brand',
      value: '#1d4ed8',
    });
    expect(editRes.ok).toBe(true);
    if (editRes.ok) {
      expect(editRes.value.colors.find((c) => c.name === 'brand')?.value).toBe('#1d4ed8');
    }
    expect(history.getState().undoCount).toBe(1);
    expect(history.getState().undo).toEqual({
      key: 'history:theme',
      params: { op: 'set', name: 'brand' },
    });

    const undoRes = await history.undo(dir);
    expect(undoRes.ok).toBe(true);
    expect(await readFile(cssFullPath, 'utf8')).toBe(SAMPLE_CSS);

    const redoRes = await history.redo(dir);
    expect(redoRes.ok).toBe(true);
    expect(await readFile(cssFullPath, 'utf8')).toContain('--color-brand: #1d4ed8; /* primary */');
  });

  it('#12: countProjectThemeUsage scans sourceDir and skips node_modules and dist [R-TH-13]', async () => {
    await mkdir(join(dir, 'src', 'pages'), { recursive: true });
    await mkdir(join(dir, 'src', 'node_modules', 'pkg'), { recursive: true });
    await writeFile(
      join(dir, 'src', 'App.tsx'),
      'export const App = () => <div className="bg-brand text-brand" />;',
    );
    await writeFile(
      join(dir, 'src', 'pages', 'Home.tsx'),
      'export const Home = () => <button className="hover:bg-brand/80 bg-brand-soft" />;',
    );
    await writeFile(
      join(dir, 'src', 'node_modules', 'pkg', 'index.tsx'),
      'export const Ignored = () => <div className="bg-brand" />;',
    );

    const { state, deps } = makeOpenWorkspace(dir);
    const usageRes = await countProjectThemeUsage(state, deps, 'color', 'brand');
    expect(usageRes).toEqual({ ok: true, value: { count: 3 } });
  });
});
