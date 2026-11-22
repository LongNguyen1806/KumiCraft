// Server tests for ThemeEdit importFont allowlist, deduplication, and undo (TK-71, test 22).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ThemeEditSchema } from '@kumicraft/shared';
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
import { editTokens, type TokenFiles } from './token-service.ts';

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

function makeDeps() {
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
    templateDir: dir,
  };
  return { deps, history };
}

describe('theme importFont [TK-71]', () => {
  it('22. rejects unknown font names/URLs, deduplicates repeated imports, and supports Undo', async () => {
    expect(ThemeEditSchema.safeParse({ op: 'importFont', families: ['EvilFont'] }).success).toBe(
      false,
    );
    expect(
      ThemeEditSchema.safeParse({ op: 'importFont', families: ['https://evil.test/f.css'] })
        .success,
    ).toBe(false);

    const cssPath = join(dir, 'src/index.css');
    const originalCss = '@import "tailwindcss";\n@theme {\n  --color-primary: #2563eb;\n}\n';
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(cssPath, originalCss, 'utf8');

    const { deps, history } = makeDeps();
    const depsWithHistory: ProjectServiceDeps = { ...deps, history };
    const files: TokenFiles = {
      root: dir,
      styling: undefined,
      tailwindCss: 'src/index.css',
      sourceDir: 'src',
    };

    const emptyDirect = await editTokens(depsWithHistory, files, 'tailwind4', {
      op: 'importFont',
      families: [],
    });
    expect(emptyDirect.ok).toBe(false);

    const first = await editTokens(depsWithHistory, files, 'tailwind4', {
      op: 'importFont',
      families: ['Playfair Display', 'Source Sans 3'],
    });
    expect(first.ok).toBe(true);

    const afterFirst = await readFile(cssPath, 'utf8');
    expect(afterFirst.startsWith("@import url('https://fonts.googleapis.com/css2?")).toBe(true);
    expect(afterFirst).toContain('family=Playfair+Display:wght@400;500;600;700');
    expect(afterFirst).toContain('family=Source+Sans+3:wght@400;500;600;700');

    const second = await editTokens(depsWithHistory, files, 'tailwind4', {
      op: 'importFont',
      families: ['Playfair Display', 'Source Sans 3'],
    });
    expect(second.ok).toBe(true);
    const afterSecond = await readFile(cssPath, 'utf8');
    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.match(/fonts\.googleapis\.com/g)).toHaveLength(1);

    const undone = await history.undo(dir);
    expect(undone.ok).toBe(true);
    expect(await readFile(cssPath, 'utf8')).toBe(originalCss);
  });
});
