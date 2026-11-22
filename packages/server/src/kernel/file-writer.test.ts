// Contract test of the FileWriter (docs/architecture/03 section 4, ADR-A2): the one place an edit
// writes the user's files must never break them. Real files in a temp folder, real History.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { nodeFs } from '../services/workspace/test-support.ts';
import { commitFileChanges, withFileLocks } from './file-writer.ts';
import { createHistoryService } from './history/history-service.ts';

let root: string;
const read = (rel: string) => fs.readFile(path.join(root, rel), 'utf8');
const write = async (rel: string, text: string) => {
  await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await fs.writeFile(path.join(root, rel), text, 'utf8');
};
const exists = async (rel: string) => {
  try {
    await fs.access(path.join(root, rel));
    return true;
  } catch {
    return false;
  }
};

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'kc-file-writer-')));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('FileWriter [ADR-A2]', () => {
  it('writes, creates and removes as one Undo step that restores every byte', async () => {
    await write('src/App.tsx', 'export const a = 1;\r\n');
    await write('src/Old.tsx', 'old\n');
    const history = createHistoryService({ fs: nodeFs });
    const res = await commitFileChanges(
      { fs: nodeFs, history },
      root,
      [
        {
          path: 'src/App.tsx',
          before: 'export const a = 1;\r\n',
          after: 'export const a = 2;\r\n',
        },
        { path: 'src/New.tsx', before: undefined, after: 'new\n' },
        { path: 'src/Old.tsx', before: 'old\n', after: undefined },
      ],
      { label: { key: 'history:insert' } },
    );
    expect(res.ok).toBe(true);
    expect(await read('src/App.tsx')).toBe('export const a = 2;\r\n');
    expect(await read('src/New.tsx')).toBe('new\n');
    expect(await exists('src/Old.tsx')).toBe(false);

    expect((await history.undo(root)).ok).toBe(true);
    expect(await read('src/App.tsx')).toBe('export const a = 1;\r\n');
    expect(await exists('src/New.tsx')).toBe(false);
    expect(await read('src/Old.tsx')).toBe('old\n');
  });

  it('refuses with E017 when the file changed since the edit read it, and writes nothing', async () => {
    await write('src/A.tsx', 'a\n');
    await write('src/B.tsx', 'hand edit\n');
    const res = await commitFileChanges({ fs: nodeFs }, root, [
      { path: 'src/A.tsx', before: 'a\n', after: 'A\n' },
      { path: 'src/B.tsx', before: 'b\n', after: 'B\n' },
    ]);
    expect(res.ok ? undefined : res.error).toEqual({
      code: 'E017',
      params: { file: 'src/B.tsx', reason: 'fileChanged' },
    });
    expect(await read('src/A.tsx')).toBe('a\n');
    expect(await read('src/B.tsx')).toBe('hand edit\n');
  });

  it('refuses to create a file that appeared meanwhile', async () => {
    await write('src/New.tsx', 'someone else\n');
    const res = await commitFileChanges({ fs: nodeFs }, root, [
      { path: 'src/New.tsx', before: undefined, after: 'mine\n' },
    ]);
    expect(res.ok).toBe(false);
    expect(await read('src/New.tsx')).toBe('someone else\n');
  });

  it('puts back the files already written when a later write fails', async () => {
    await write('src/A.tsx', 'a\n');
    await write('src/B.tsx', 'b\n');
    const failingFs: FileSystemPort = {
      ...nodeFs,
      writeTextAtomic: (r, rel, text, options) =>
        rel === 'src/B.tsx' && text === 'B\n'
          ? Promise.resolve({ ok: false, error: { code: 'E003', params: { reason: 'disk' } } })
          : nodeFs.writeTextAtomic(r, rel, text, options),
    };
    const res = await commitFileChanges({ fs: failingFs }, root, [
      { path: 'src/A.tsx', before: 'a\n', after: 'A\n' },
      { path: 'src/B.tsx', before: 'b\n', after: 'B\n' },
    ]);
    expect(res.ok).toBe(false);
    expect(await read('src/A.tsx')).toBe('a\n');
    expect(await read('src/B.tsx')).toBe('b\n');
  });

  it('accepts an edit that read the file without its BOM, and keeps the bytes it was given', async () => {
    await write('src/Bom.tsx', '﻿const x = 1;\n');
    const res = await commitFileChanges({ fs: nodeFs }, root, [
      { path: 'src/Bom.tsx', before: 'const x = 1;\n', after: '﻿const x = 2;\n' },
    ]);
    expect(res.ok).toBe(true);
    expect(await read('src/Bom.tsx')).toBe('﻿const x = 2;\n');
  });

  it('tells History about its own writes so the watcher does not take them for hand edits', async () => {
    await write('src/A.tsx', 'a\n');
    const history = createHistoryService({ fs: nodeFs });
    const res = await commitFileChanges({ fs: nodeFs, history }, root, [
      { path: 'src/A.tsx', before: 'a\n', after: 'A\n' },
    ]);
    const afterHash = res.ok ? res.value[0]?.afterHash : undefined;
    expect(afterHash).toBeDefined();
    expect(history.handleExternalChange('src/A.tsx', afterHash ?? '')).toBe(false);
  });

  it('runs edits of the same file one after another', async () => {
    const order: string[] = [];
    const slow = withFileLocks(root, ['src/A.tsx'], async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('first');
    });
    const fast = withFileLocks(root, ['src/A.tsx'], () => {
      order.push('second');
      return Promise.resolve();
    });
    await Promise.all([slow, fast]);
    expect(order).toEqual(['first', 'second']);
  });
});
