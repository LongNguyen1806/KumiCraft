import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { computeSha256, createHistoryService } from '../../kernel/history/history-service.ts';
import { toSupportedPlatform } from '../../kernel/session.ts';
import { createFile, deleteFileOrDir, MAX_DIR_FILES, renameFileOrDir } from './file-ops.ts';

const platform = toSupportedPlatform(process.platform) ?? 'linux';
const fs = createNodeFileSystem(platform);

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('file-ops [WP-4.00]', () => {
  let root: string;
  let history: ReturnType<typeof createHistoryService>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'kumicraft-ops-'));
    history = createHistoryService({ fs });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('[WP-4.00] file-ops: create file -> on disk, single history step; Undo deletes file; Redo recreates; duplicate -> E016 exists', async () => {
    const deps = { fs, history };
    const createRes = await createFile(deps, root, 'src/Hello.tsx', 'file');
    expect(createRes.ok).toBe(true);
    expect(await fs.exists(root, 'src/Hello.tsx')).toBe(true);

    const dupRes = await createFile(deps, root, 'src/Hello.tsx', 'file');
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) expect(dupRes.error.code).toBe('E016');

    expect(history.getState().undoCount).toBe(1);

    const undoRes = await history.undo(root);
    expect(undoRes.ok).toBe(true);
    expect(await fs.exists(root, 'src/Hello.tsx')).toBe(false);

    const redoRes = await history.redo(root);
    expect(redoRes.ok).toBe(true);
    expect(await fs.exists(root, 'src/Hello.tsx')).toBe(true);
  });

  it('[WP-4.00] file-ops: rename file into non-existing folder -> folder created, single history step; Undo restores both paths byte-exact', async () => {
    const deps = { fs, history };
    await fs.writeTextAtomic(root, 'src/Old.tsx', 'export const A = 1;\n');

    const renameRes = await renameFileOrDir(deps, root, 'src/Old.tsx', 'src/nested/New.tsx');
    expect(renameRes.ok).toBe(true);
    expect(await fs.exists(root, 'src/Old.tsx')).toBe(false);
    expect(await fs.exists(root, 'src/nested/New.tsx')).toBe(true);
    expect(await readFile(join(root, 'src/nested/New.tsx'), 'utf8')).toBe('export const A = 1;\n');

    const undoRes = await history.undo(root);
    expect(undoRes.ok).toBe(true);
    expect(await fs.exists(root, 'src/Old.tsx')).toBe(true);
    expect(await fs.exists(root, 'src/nested/New.tsx')).toBe(false);
    expect(await readFile(join(root, 'src/Old.tsx'), 'utf8')).toBe('export const A = 1;\n');
  });

  it('[WP-4.00] file-ops: rename directory of 3 files (including PNG image) -> single step; Undo restores exact bytes including image', async () => {
    const deps = { fs, history };
    await fs.mkdir(root, 'assets/icons');
    await fs.writeTextAtomic(root, 'assets/icons/a.txt', 'file A');
    await fs.writeTextAtomic(root, 'assets/icons/b.txt', 'file B');
    await fs.writeBytesAtomic(root, 'assets/icons/logo.png', TINY_PNG);

    const renameRes = await renameFileOrDir(deps, root, 'assets/icons', 'assets/images');
    expect(renameRes.ok).toBe(true);
    expect(await fs.exists(root, 'assets/icons')).toBe(false);
    expect(await fs.exists(root, 'assets/images/logo.png')).toBe(true);

    expect(history.getState().undoCount).toBe(1);

    const undoRes = await history.undo(root);
    expect(undoRes.ok).toBe(true);
    expect(await fs.exists(root, 'assets/icons/logo.png')).toBe(true);
    expect(await fs.exists(root, 'assets/images/logo.png')).toBe(false);

    const restoredBytes = await readFile(join(root, 'assets/icons/logo.png'));
    expect(Buffer.compare(restoredBytes, TINY_PNG)).toBe(0);
  });

  it('[WP-4.00] file-ops: delete directory -> single step; Undo restores all files', async () => {
    const deps = { fs, history };
    await fs.mkdir(root, 'docs/guide');
    await fs.writeTextAtomic(root, 'docs/guide/one.md', '# One');
    await fs.writeTextAtomic(root, 'docs/guide/two.md', '# Two');

    const delRes = await deleteFileOrDir(deps, root, 'docs/guide');
    expect(delRes.ok).toBe(true);
    expect(await fs.exists(root, 'docs/guide')).toBe(false);

    const undoRes = await history.undo(root);
    expect(undoRes.ok).toBe(true);
    expect(await fs.exists(root, 'docs/guide/one.md')).toBe(true);
    expect(await fs.exists(root, 'docs/guide/two.md')).toBe(true);
  });

  it('[WP-4.00] file-ops: directory > limit -> E016 tooLarge without change', async () => {
    const deps = { fs, history };
    await fs.mkdir(root, 'huge');
    await Promise.all(
      Array.from({ length: MAX_DIR_FILES + 1 }, (_, i) =>
        writeFile(join(root, 'huge', `f_${String(i)}.txt`), 'x'),
      ),
    );

    const hugeDelRes = await deleteFileOrDir(deps, root, 'huge');
    expect(hugeDelRes.ok).toBe(false);
    if (!hugeDelRes.ok) {
      expect(hugeDelRes.error.code).toBe('E016');
      expect(hugeDelRes.error.params?.reason).toBe('folderTooLarge');
    }
    expect(await fs.exists(root, 'huge/f_0.txt')).toBe(true);
    expect(history.getState().undoCount).toBe(0);
  });

  it('[WP-4.00] file-ops: delete directory holding a hidden node_modules -> Undo restores it too', async () => {
    const deps = { fs, history };
    await fs.mkdir(root, 'pkg/node_modules/lib');
    await writeFile(join(root, 'pkg', 'a.js'), 'a');
    await writeFile(join(root, 'pkg', 'node_modules', 'lib', 'x.js'), 'x');

    expect((await deleteFileOrDir(deps, root, 'pkg')).ok).toBe(true);
    expect(await fs.exists(root, 'pkg')).toBe(false);

    expect((await history.undo(root)).ok).toBe(true);
    expect(await readFile(join(root, 'pkg', 'node_modules', 'lib', 'x.js'), 'utf8')).toBe('x');
    expect(await readFile(join(root, 'pkg', 'a.js'), 'utf8')).toBe('a');
  });

  it('[WP-4.00] file-ops: target inside node_modules or .kumicraft -> error, nothing changes', async () => {
    const deps = { fs, history };
    const createInNm = await createFile(deps, root, 'node_modules/hack.js', 'file');
    expect(createInNm.ok).toBe(false);
    if (!createInNm.ok) expect(createInNm.error.code).toBe('E012');

    const createInKc = await createFile(deps, root, '.kumicraft/illegal.js', 'file');
    expect(createInKc.ok).toBe(false);
    if (!createInKc.ok) expect(createInKc.error.code).toBe('E012');
  });

  it('[WP-4.00] file-ops: Studio operations do not emit external change (recordInternalWrite called)', async () => {
    const deps = { fs, history };

    // 1. Create file
    await createFile(deps, root, 'src/Tested.tsx', 'file');
    const createHash = computeSha256('');
    expect(history.handleExternalChange('src/Tested.tsx', createHash)).toBe(false);

    // 2. Rename file
    await renameFileOrDir(deps, root, 'src/Tested.tsx', 'src/Renamed.tsx');
    expect(history.handleExternalChange('src/Tested.tsx', '')).toBe(false);
    expect(history.handleExternalChange('src/Renamed.tsx', createHash)).toBe(false);

    // 3. Delete file
    await deleteFileOrDir(deps, root, 'src/Renamed.tsx');
    expect(history.handleExternalChange('src/Renamed.tsx', '')).toBe(false);
  });
});
