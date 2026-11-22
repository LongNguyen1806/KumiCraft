import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { toSupportedPlatform } from '../../kernel/session.ts';
import { createNodeFileSystem } from './node-file-system.ts';

const platform = toSupportedPlatform(process.platform) ?? 'linux';
const fs = createNodeFileSystem(platform);
const isWindows = platform === 'win32';

let base: string;
let root: string;
let outside: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'kumicraft-fs-'));
  root = join(base, 'workspace');
  outside = join(base, 'outside');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(outside, 'secret.txt'), 'secret');
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? 'ok' : result.error?.code;

describe('NodeFileSystem', () => {
  it('writes atomically, creating folders, and reads back', async () => {
    const write = await fs.writeTextAtomic(root, '.kumicraft/pages/p.json', '{"a":1}\n');
    const read = await fs.readText(root, '.kumicraft/pages/p.json');

    expect(write.ok).toBe(true);
    expect(read).toEqual({ ok: true, value: '{"a":1}\n' });
    expect(await fs.exists(root, '.kumicraft/pages/p.json')).toBe(true);
  });

  it('rejects traversal, absolute paths elsewhere and malformed paths [S-20, S-21, S-22]', async () => {
    const attacks = [
      '../outside/secret.txt',
      '..\\outside\\secret.txt',
      join(outside, 'secret.txt'),
      'a\u0000b',
    ];
    if (isWindows) attacks.push('\\\\server\\share\\x', '\\\\?\\C:\\x', 'C:foo', 'NUL', 'con.txt');

    for (const path of attacks) {
      const read = await fs.readText(root, path);
      const write = await fs.writeTextAtomic(root, path, 'x');
      // On Linux `..\\x` is a plain file name inside the root, which is safe.
      const isPlainName = !isWindows && path.includes('\\');
      expect([path, codeOf(write)]).toEqual([path, isPlainName ? 'ok' : 'E012']);
      if (!isPlainName) expect([path, codeOf(read)]).toEqual([path, 'E012']);
    }
    expect(await readFile(join(outside, 'secret.txt'), 'utf8')).toBe('secret');
  });

  it('refuses links that lead outside the root [S-22, S-24]', async () => {
    await symlink(outside, join(root, 'link'), isWindows ? 'junction' : 'dir');

    expect(codeOf(await fs.readText(root, 'link/secret.txt'))).toBe('E012');
    expect(codeOf(await fs.writeTextAtomic(root, 'link/new.txt', 'x'))).toBe('E012');
  });

  it('refuses to write through a link even inside the root [S-24]', async () => {
    await mkdir(join(root, 'real'));
    await symlink(join(root, 'real'), join(root, 'alias'), isWindows ? 'junction' : 'dir');

    expect(codeOf(await fs.writeTextAtomic(root, 'alias', 'x'))).toBe('E012');
  });

  it('gives a project folder opened through a link its real path, a missing one unchanged [S-22]', async () => {
    await mkdir(join(root, 'real'));
    const alias = join(root, 'alias');
    await symlink(join(root, 'real'), alias, isWindows ? 'junction' : 'dir');

    expect(await fs.realRoot(alias)).toBe(await realpath(join(root, 'real')));
    expect(await fs.realRoot(join(root, 'missing'))).toBe(join(root, 'missing'));
  });

  it('matches the root case-insensitively on Windows [S-23]', async () => {
    await fs.writeTextAtomic(root, 'a.txt', 'A');
    const otherCase = isWindows ? root.toUpperCase() : root;

    expect(await fs.readText(otherCase, 'a.txt')).toEqual({ ok: true, value: 'A' });
  });

  it('limits read size and reports missing files [S-29]', async () => {
    await fs.writeTextAtomic(root, 'big.json', 'x'.repeat(100));

    expect(await fs.readText(root, 'big.json', { maxBytes: 10 })).toMatchObject({
      ok: false,
      error: { code: 'E003', params: { reason: 'tooLarge' } },
    });
    expect(codeOf(await fs.readText(root, 'missing.json'))).toBe('E015');
  });

  it('creates exclusively, lists, copies, renames and removes', async () => {
    expect(await fs.createExclusive(root, '.kumicraft/lock', '1')).toEqual({
      ok: true,
      value: 'created',
    });
    expect(await fs.createExclusive(root, '.kumicraft/lock', '2')).toEqual({
      ok: true,
      value: 'exists',
    });
    await fs.copy(root, '.kumicraft/lock', 'backups/lock.bak');
    await fs.rename(root, 'backups/lock.bak', 'backups/lock.old');

    const listed = await fs.readDir(root, 'backups');

    expect(listed).toEqual({ ok: true, value: [{ name: 'lock.old', kind: 'file' }] });
    expect(await fs.readDir(root, 'nothing')).toEqual({ ok: true, value: [] });
    await fs.remove(root, 'backups');
    expect(await fs.exists(root, 'backups')).toBe(false);
  });

  it('lists neither files nor folders behind a link [S-25]', async () => {
    await mkdir(join(root, 'real'));
    await writeFile(join(root, 'a.txt'), 'hello');
    await symlink(outside, join(root, 'link'), isWindows ? 'junction' : 'dir');

    const listed = await fs.readDir(root, '.');
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const names = listed.value.map((e) => e.name).sort();
      expect(names).toEqual(['a.txt', 'real']);
    }
  });

  it('stat returns size and mtimeMs, handles missing (E015) and traversal (E012)', async () => {
    await writeFile(join(root, 'hello.txt'), '12345');
    const res = await fs.stat(root, 'hello.txt');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.size).toBe(5);
      expect(res.value.mtimeMs).toBeGreaterThan(0);
    }

    const missing = await fs.stat(root, 'missing.txt');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('E015');

    const outsideRes = await fs.stat(root, '../outside/secret.txt');
    expect(outsideRes.ok).toBe(false);
    if (!outsideRes.ok) expect(outsideRes.error.code).toBe('E012');
  });

  it('mkdir creates nested directories and rejects path outside root (E012) [S-20..S-24, WP-4.00]', async () => {
    const created = await fs.mkdir(root, 'src/nested/deep');
    expect(created.ok).toBe(true);
    expect(await fs.exists(root, 'src/nested/deep')).toBe(true);

    const outsideRes = await fs.mkdir(root, '../outside/illegal');
    expect(outsideRes.ok).toBe(false);
    if (!outsideRes.ok) expect(outsideRes.error.code).toBe('E012');
  });
});
