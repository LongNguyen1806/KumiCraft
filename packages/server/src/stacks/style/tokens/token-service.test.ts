import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../kernel/history/history-service.ts';
import type { ProcessPort } from '../../../ports/process-port.ts';
import type { ProjectServiceDeps } from '../../../services/project/project-types.ts';
import {
  directWriteFs,
  fakeSystem,
  makeTempDir,
  platform,
  silentLogger,
} from '../../../services/workspace/test-support.ts';
import { STACKS } from '../../../stacks/index.ts';
import { countUsage, editTokens, readTokens, type TokenFiles } from './token-service.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

const fakeProcess: ProcessPort = {
  spawn: () => ({
    pid: 1,
    onLine: () => undefined,
    wait: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '', lines: [] }),
    kill: () => Promise.resolve(),
  }),
};

function makeDeps(root: string) {
  const history = createHistoryService({ fs: directWriteFs });
  const deps: ProjectServiceDeps = {
    stacks: STACKS,
    fs: directWriteFs,
    system: fakeSystem(1, new Set([1])),
    process: fakeProcess,
    config: {
      isTrusted: () => true,
      setTrusted: () => Promise.resolve({ ok: true, value: undefined }),
      settings: () => ({ editor: 'vscode' as const, agent: { preferred: 'auto' as const } }),
    },
    logger: silentLogger,
    port: 50302,
    platform,
    templateDir: root,
    history,
  };
  return { deps, history };
}

const SAMPLE_TAILWIND_CSS = [
  '@import "tailwindcss";',
  '',
  '@theme {',
  '  --color-brand: #2563eb;',
  '}',
  '',
].join('\n');

describe('token-service [R-ST-15, R-TH-10, R-TH-11, R-TH-14]', () => {
  it('editTokens creates 1 history entry with exact before/after; undo restores bytes [R-ST-15, R-TH-11]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const cssPath = join(dir, 'src', 'index.css');
    await writeFile(cssPath, SAMPLE_TAILWIND_CSS);
    const { deps, history } = makeDeps(dir);

    const files: TokenFiles = {
      root: dir,
      styling: { systems: [{ id: 'tailwind', version: '4.0.0' }], editable: true, globalCss: [] },
      tailwindCss: 'src/index.css',
      sourceDir: 'src',
    };

    const editRes = await editTokens(deps, files, 'tailwind4', {
      op: 'set',
      kind: 'color',
      name: 'brand',
      value: '#1d4ed8',
    });

    expect(editRes.ok).toBe(true);
    expect(history.getState().undoCount).toBe(1);
    expect(history.getState().undo).toEqual({
      key: 'history:theme',
      params: { op: 'set', name: 'brand' },
    });

    const undoRes = await history.undo(dir);
    expect(undoRes.ok).toBe(true);
    expect(await readFile(cssPath, 'utf8')).toBe(SAMPLE_TAILWIND_CSS);
  });

  it('reads and edits tailwind4 theme identical to prior theme.test.ts behavior [R-TH-10]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const cssPath = join(dir, 'src', 'index.css');
    await writeFile(cssPath, SAMPLE_TAILWIND_CSS);
    const { deps } = makeDeps(dir);

    const files: TokenFiles = {
      root: dir,
      styling: { systems: [{ id: 'tailwind', version: '4.0.0' }], editable: true, globalCss: [] },
      tailwindCss: 'src/index.css',
      sourceDir: 'src',
    };

    const theme = await readTokens(deps, files, 'tailwind4');
    expect(theme.ok).toBe(true);
    if (theme.ok) {
      expect(theme.value.system).toBe('tailwind4');
      expect(theme.value.colors).toEqual([{ name: 'brand', value: '#2563eb' }]);
    }
  });

  it('countUsage counts CSS var(--brand-blue) in .css and .tsx, and Bootstrap btn-primary, text-primary but not primary-nav [R-TH-14]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(
      join(dir, 'src', 'App.tsx'),
      'export const App = () => <div className="btn-primary text-primary primary-nav nav-primary-link my-primary" style={{ color: "var(--brand-blue)" }} />;\n',
    );
    await writeFile(
      join(dir, 'src', 'theme.css'),
      ':root { --brand-blue: #1d4ed8; }\n.card { border-color: var(--brand-blue); }\n',
    );
    const { deps } = makeDeps(dir);

    const cssFiles: TokenFiles = {
      root: dir,
      styling: { systems: [{ id: 'css' }], editable: true, globalCss: ['src/theme.css'] },
      tailwindCss: undefined,
      sourceDir: 'src',
    };
    const cssUsage = await countUsage(deps, cssFiles, 'css', 'color', 'brand-blue');
    expect(cssUsage).toEqual({ ok: true, value: { count: 2 } });

    const bootFiles: TokenFiles = {
      root: dir,
      styling: {
        systems: [{ id: 'bootstrap', version: '5.3.3' }],
        editable: true,
        globalCss: ['src/theme.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };
    const bootUsage = await countUsage(deps, bootFiles, 'bootstrap5', 'color', 'primary');
    expect(bootUsage).toEqual({ ok: true, value: { count: 2 } });
  });

  it('[R-ST-11] cssModules project reads :root tokens from globalCss with system: css', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(
      join(dir, 'src', 'global.css'),
      ':root {\n  --color-brand: #e11d48;\n}\n',
      'utf-8',
    );
    const { deps } = makeDeps(dir);
    const files: TokenFiles = {
      root: dir,
      styling: {
        systems: [{ id: 'cssModules' }],
        editable: true,
        primary: 'cssModules',
        globalCss: ['src/global.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    const res = await readTokens(deps, files, 'cssModules');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.system).toBe('css');
    expect(res.value.file).toBe('src/global.css');
    const brand = res.value.colors.find((c) => c.name === 'brand');
    expect(brand?.value).toBe('#e11d48');
  });

  it('[WP-4.00] test 12: token-service với tokenFile: CSS project có 2 file global; tokenFile = file thứ 2 → đọc và thêm token vào file thứ 2, file 1 không đổi; Tailwind 3 bỏ qua tokenFile', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const firstPath = join(dir, 'src', 'first.css');
    const secondPath = join(dir, 'src', 'second.css');
    const initialFirst = ':root {\n  --color-primary: #111111;\n}\n';
    const initialSecond = ':root {\n  --color-secondary: #222222;\n}\n';
    await writeFile(firstPath, initialFirst, 'utf-8');
    await writeFile(secondPath, initialSecond, 'utf-8');

    const { deps } = makeDeps(dir);
    const cssFiles: TokenFiles = {
      root: dir,
      styling: {
        systems: [{ id: 'css' }],
        editable: true,
        primary: 'css',
        globalCss: ['src/first.css', 'src/second.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
      tokenFile: 'src/second.css',
    };

    const readRes = await readTokens(deps, cssFiles, 'css');
    expect(readRes.ok).toBe(true);
    if (!readRes.ok) return;
    expect(readRes.value.file).toBe('src/second.css');
    expect(readRes.value.colors.map((c) => c.name)).toEqual(['secondary']);

    const editRes = await editTokens(deps, cssFiles, 'css', {
      kind: 'color',
      op: 'add',
      name: 'accent',
      value: '#ff0000',
    });
    expect(editRes.ok).toBe(true);

    const firstContentAfter = await readFile(firstPath, 'utf-8');
    const secondContentAfter = await readFile(secondPath, 'utf-8');
    expect(firstContentAfter).toBe(initialFirst);
    expect(secondContentAfter).toContain('--color-accent: #ff0000;');

    // Tailwind 3 ignores tokenFile
    const tw3Config = `module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        custom: '#123456',
      },
    },
  },
};`;
    await writeFile(join(dir, 'tailwind.config.js'), tw3Config, 'utf-8');
    const tw3Files: TokenFiles = {
      root: dir,
      styling: {
        systems: [{ id: 'tailwind', version: '3.4.1' }],
        editable: true,
        primary: 'tailwind',
        globalCss: ['src/first.css'],
      },
      tailwindCss: 'src/first.css',
      sourceDir: 'src',
      tokenFile: 'src/second.css',
    };

    const tw3Res = await readTokens(deps, tw3Files, 'tailwind3');
    expect(tw3Res.ok).toBe(true);
    if (!tw3Res.ok) return;
    expect(tw3Res.value.system).toBe('tailwind3');
    expect(tw3Res.value.file).toBe('tailwind.config.js');
    expect(tw3Res.value.colors.some((c) => c.name === 'custom')).toBe(true);
  });
});
