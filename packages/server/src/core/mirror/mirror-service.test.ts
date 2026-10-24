import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { BackendInfo } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import { toSupportedPlatform } from '../shared/session.ts';
import { silentLogger } from '../workspace/test-support.ts';
import { manifestRelPath, mirrorRelDir, readManifest } from './mirror-manifest.ts';
import { createMirrorService } from './mirror-service.ts';

const platform = toSupportedPlatform(process.platform) ?? 'linux';
const isWindows = platform === 'win32';
const realFs = createNodeFileSystem(platform);

let baseDir: string;
let cacheDir: string;
let backendDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'kumicraft-mirror-test-'));
  cacheDir = join(baseDir, 'cache');
  backendDir = join(baseDir, 'backend');
  await mkdir(cacheDir, { recursive: true });
  await mkdir(backendDir, { recursive: true });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

function makeBackend(status: BackendInfo['status'] = 'ok'): BackendInfo {
  return {
    id: 'b_12345678',
    label: 'Test Backend',
    path: '../backend',
    resolvedPath: backendDir,
    status,
    outsideParent: false,
  };
}

describe('MirrorService', () => {
  it('spy confirms secret files are never read or stat-ed, only non-secrets mirrored [S-30, S-31]', async () => {
    await writeFile(join(backendDir, '.env'), 'SECRET_VAR=123');
    await writeFile(join(backendDir, '.env.local'), 'LOCAL_SECRET=abc');
    await mkdir(join(backendDir, 'deploy'), { recursive: true });
    await writeFile(join(backendDir, 'deploy', 'id_rsa'), 'KEY_DATA');
    await mkdir(join(backendDir, '.ssh'), { recursive: true });
    await writeFile(join(backendDir, '.ssh', 'known_hosts'), 'HOSTS');
    await writeFile(join(backendDir, '.env.example'), 'FOO=bar');
    await writeFile(join(backendDir, 'normal.txt'), 'Hello world');

    const touchedPaths: string[] = [];
    const spyFs: FileSystemPort = {
      ...realFs,
      readText: async (root, path, opts) => {
        touchedPaths.push(path);
        return realFs.readText(root, path, opts);
      },
      readBytes: async (root, path, opts) => {
        touchedPaths.push(path);
        return realFs.readBytes(root, path, opts);
      },
      stat: async (root, path) => {
        touchedPaths.push(path);
        return realFs.stat(root, path);
      },
    };

    const service = createMirrorService({ fs: spyFs, cacheDir, logger: silentLogger });
    const res = await service.refresh('prj1', makeBackend());

    expect(res.state).toBe('ready');
    const secretKeywords = ['.env.local', 'id_rsa', '.ssh', 'known_hosts'];
    for (const kw of secretKeywords) {
      expect(touchedPaths.some((p) => p.includes(kw))).toBe(false);
    }
    // Exactly .env (not .env.example) should also never be touched
    expect(touchedPaths.includes('.env')).toBe(false);

    // .env.example and normal.txt should exist in mirror
    expect(
      await realFs.exists(cacheDir, `${mirrorRelDir('prj1', 'b_12345678')}/.env.example`),
    ).toBe(true);
    expect(await realFs.exists(cacheDir, `${mirrorRelDir('prj1', 'b_12345678')}/normal.txt`)).toBe(
      true,
    );
    expect(await realFs.exists(cacheDir, `${mirrorRelDir('prj1', 'b_12345678')}/.env`)).toBe(false);
  });

  it('excludes excluded directories and gitignored files [S-120]', async () => {
    await mkdir(join(backendDir, 'node_modules'), { recursive: true });
    await writeFile(join(backendDir, 'node_modules', 'x.js'), 'module');
    await mkdir(join(backendDir, 'src', 'node_modules'), { recursive: true });
    await writeFile(join(backendDir, 'src', 'node_modules', 'y.js'), 'module');
    await mkdir(join(backendDir, '.git'), { recursive: true });
    await writeFile(join(backendDir, '.git', 'HEAD'), 'ref: refs/heads/main');
    await mkdir(join(backendDir, 'dist'), { recursive: true });
    await writeFile(join(backendDir, 'dist', 'a.js'), 'build');
    await mkdir(join(backendDir, '.venv'), { recursive: true });
    await writeFile(join(backendDir, '.venv', 'b.py'), 'venv');
    await mkdir(join(backendDir, '__pycache__'), { recursive: true });
    await writeFile(join(backendDir, '__pycache__', 'c.pyc'), 'pyc');
    await mkdir(join(backendDir, 'target'), { recursive: true });
    await writeFile(join(backendDir, 'target', 'd'), 'target');

    await writeFile(join(backendDir, '.gitignore'), '*.log\ntmp/\n');
    await writeFile(join(backendDir, 'app.log'), 'log data');
    await mkdir(join(backendDir, 'tmp'), { recursive: true });
    await writeFile(join(backendDir, 'tmp', 't.txt'), 'temp file');
    await mkdir(join(backendDir, 'src'), { recursive: true });
    await writeFile(join(backendDir, 'src', 'main.py'), 'print("hi")');

    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });
    const res = await service.refresh('prj1', makeBackend());

    expect(res.state).toBe('ready');
    const mirrorRoot = mirrorRelDir('prj1', 'b_12345678');
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/node_modules/x.js`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/src/node_modules/y.js`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/.git/HEAD`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/dist/a.js`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/.venv/b.py`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/__pycache__/c.pyc`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/target/d`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/app.log`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/tmp/t.txt`)).toBe(false);

    expect(await realFs.exists(cacheDir, `${mirrorRoot}/.gitignore`)).toBe(true);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/src/main.py`)).toBe(true);
  });

  it('does not mirror symlinks or junctions pointing outside backend [S-121]', async () => {
    const outsideFolder = join(baseDir, 'outside-folder');
    await mkdir(outsideFolder, { recursive: true });
    await writeFile(join(outsideFolder, 'outside.txt'), 'outside secret');

    await symlink(outsideFolder, join(backendDir, 'link-dir'), isWindows ? 'junction' : 'dir');
    if (!isWindows) {
      await symlink(join(outsideFolder, 'outside.txt'), join(backendDir, 'link-file.txt'), 'file');
    }
    await writeFile(join(backendDir, 'regular.txt'), 'regular');

    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });
    const res = await service.refresh('prj1', makeBackend());

    expect(res.state).toBe('ready');
    const mirrorRoot = mirrorRelDir('prj1', 'b_12345678');
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/link-dir`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/link-dir/outside.txt`)).toBe(false);
    if (!isWindows) {
      expect(await realFs.exists(cacheDir, `${mirrorRoot}/link-file.txt`)).toBe(false);
    }
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/regular.txt`)).toBe(true);
  });

  it('handles binary check and file size limits: 0 byte at 100, 1 MB, 1 MB + 1, 2 MB [S-122]', async () => {
    // 1. Binary file with 0 byte at offset 100
    const binary = new Uint8Array(200);
    binary.fill(65);
    binary[100] = 0;
    await writeFile(join(backendDir, 'bin.dat'), binary);

    // 2. Exactly 1 MB text file
    const oneMb = 'A'.repeat(1024 * 1024);
    await writeFile(join(backendDir, 'exact1mb.txt'), oneMb);

    // 3. 1 MB + 1 byte
    const oneMbPlus = 'B'.repeat(1024 * 1024 + 1);
    await writeFile(join(backendDir, 'too-large.txt'), oneMbPlus);

    // 4. 2 MB
    const twoMb = 'C'.repeat(2 * 1024 * 1024);
    await writeFile(join(backendDir, 'two-mb.txt'), twoMb);

    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });
    const res = await service.refresh('prj1', makeBackend());

    expect(res.state).toBe('ready');
    const mirrorRoot = mirrorRelDir('prj1', 'b_12345678');
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/exact1mb.txt`)).toBe(true);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/bin.dat`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/too-large.txt`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/two-mb.txt`)).toBe(false);
  });

  it('redacts secrets in mirrored files and manifest never contains secret markers [S-123, AC-11]', async () => {
    await writeFile(
      join(backendDir, 'settings.py'),
      'SECRET_KEY = "RC_SECRET_MARKER_1"\nDEBUG = False',
    );
    await writeFile(
      join(backendDir, 'config.ts'),
      "export const config = { apiKey: 'RC_SECRET_MARKER_2' };",
    );
    await writeFile(join(backendDir, 'db.yml'), 'url: postgres://u:RC_SECRET_MARKER_3@h/db');

    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });
    const res = await service.refresh('prj1', makeBackend());
    expect(res.state).toBe('ready');

    const mirrorRoot = mirrorRelDir('prj1', 'b_12345678');
    const settings = await realFs.readText(cacheDir, `${mirrorRoot}/settings.py`);
    const config = await realFs.readText(cacheDir, `${mirrorRoot}/config.ts`);
    const db = await realFs.readText(cacheDir, `${mirrorRoot}/db.yml`);
    const manifest = await realFs.readText(cacheDir, manifestRelPath('prj1', 'b_12345678'));

    expect(settings.ok && settings.value).toContain('«redacted»');
    expect(config.ok && config.value).toContain('«redacted»');
    expect(db.ok && db.value).toContain('«redacted»');

    const allContent = [
      settings.ok ? settings.value : '',
      config.ok ? config.value : '',
      db.ok ? db.value : '',
      manifest.ok ? manifest.value : '',
    ].join('\n');

    expect(allContent.includes('RC_SECRET_MARKER')).toBe(false);
  });

  it('first refresh creates mirror folder and manifest with expected fields [R-MR-01]', async () => {
    await writeFile(join(backendDir, 'a.txt'), 'hello');
    await writeFile(join(backendDir, 'b.txt'), 'world');

    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });
    const res = await service.refresh('prj1', makeBackend());

    expect(res.state).toBe('ready');
    expect(res.files).toBe(2);
    expect(res.copied).toBe(2);
    expect(res.bytes).toBe(10);
    expect(res.dir).toBe(join(cacheDir, 'mirrors', 'prj1', 'b_12345678'));

    const manifest = await readManifest(realFs, cacheDir, manifestRelPath('prj1', 'b_12345678'));
    expect(manifest.version).toBe(1);
    expect(manifest.files.length).toBe(2);
    for (const f of manifest.files) {
      expect(f.path).toBeDefined();
      expect(f.size).toBeGreaterThan(0);
      expect(f.mtimeMs).toBeGreaterThan(0);
      expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('second refresh: modifies one, deletes one, adds one, keeps unchanged without re-reading [R-MR-02]', async () => {
    await writeFile(join(backendDir, 'keep.txt'), 'unchanged content');
    await writeFile(join(backendDir, 'edit.txt'), 'original content');
    await writeFile(join(backendDir, 'delete.txt'), 'to be deleted');

    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });
    const r1 = await service.refresh('prj1', makeBackend());
    expect(r1.copied).toBe(3);

    // Now edit edit.txt (and ensure mtime changes), delete delete.txt, add new.txt
    await new Promise((r) => setTimeout(r, 20));
    await writeFile(join(backendDir, 'edit.txt'), 'modified content');
    await utimes(join(backendDir, 'edit.txt'), new Date(), new Date(Date.now() + 1000));
    await rm(join(backendDir, 'delete.txt'));
    await writeFile(join(backendDir, 'new.txt'), 'brand new file');

    const readBytesCalls: string[] = [];
    const spyFs: FileSystemPort = {
      ...realFs,
      readBytes: async (root, path, opts) => {
        readBytesCalls.push(path);
        return realFs.readBytes(root, path, opts);
      },
    };

    const serviceSpy = createMirrorService({ fs: spyFs, cacheDir, logger: silentLogger });
    const r2 = await serviceSpy.refresh('prj1', makeBackend());

    expect(r2.state).toBe('ready');
    expect(r2.copied).toBe(2); // edit.txt and new.txt
    expect(readBytesCalls).not.toContain('keep.txt');

    const mirrorRoot = mirrorRelDir('prj1', 'b_12345678');
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/delete.txt`)).toBe(false);
    expect(await realFs.exists(cacheDir, `${mirrorRoot}/new.txt`)).toBe(true);
    expect(await realFs.readText(cacheDir, `${mirrorRoot}/edit.txt`)).toEqual({
      ok: true,
      value: 'modified content',
    });

    const manifest = await readManifest(realFs, cacheDir, manifestRelPath('prj1', 'b_12345678'));
    expect(manifest.files.some((f) => f.path === 'delete.txt')).toBe(false);
  });

  it('returns skipped when backend status is missing or blocked [R-MR-03]', async () => {
    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });

    const resMissing = await service.refresh('prj1', makeBackend('missing'));
    expect(resMissing.state).toBe('skipped');
    expect(await realFs.exists(cacheDir, mirrorRelDir('prj1', 'b_12345678'))).toBe(false);

    const resBlocked = await service.refresh('prj1', makeBackend('blocked'));
    expect(resBlocked.state).toBe('skipped');
    expect(await realFs.exists(cacheDir, mirrorRelDir('prj1', 'b_12345678'))).toBe(false);
  });

  it('returns tooLarge and removes old mirror/manifest when exceeding maxTotalBytes [S-124]', async () => {
    await writeFile(join(backendDir, 'f1.txt'), '12345');
    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });
    await service.refresh('prj1', makeBackend());
    expect(await realFs.exists(cacheDir, manifestRelPath('prj1', 'b_12345678'))).toBe(true);

    // Refresh with small maxTotalBytes (e.g. 3 bytes, file is 5 bytes)
    const limitedService = createMirrorService(
      { fs: realFs, cacheDir, logger: silentLogger },
      { maxTotalBytes: 3 },
    );
    const res = await limitedService.refresh('prj1', makeBackend());

    expect(res.state).toBe('tooLarge');
    expect(await realFs.exists(cacheDir, manifestRelPath('prj1', 'b_12345678'))).toBe(false);
    expect(await realFs.exists(cacheDir, mirrorRelDir('prj1', 'b_12345678'))).toBe(false);
  });

  it('check: absent when no manifest; intact when clean; modified + removed when modified or extra file [R-MR-04, S-118]', async () => {
    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });

    // 1. absent before any refresh
    expect(await service.check('prj1', 'b_12345678')).toBe('absent');

    // 2. intact after clean refresh
    await writeFile(join(backendDir, 'file.txt'), 'clean content');
    await service.refresh('prj1', makeBackend());
    expect(await service.check('prj1', 'b_12345678')).toBe('intact');

    // 3. modified file in mirror -> 'modified' and deleted
    const mirrorFilePath = `${mirrorRelDir('prj1', 'b_12345678')}/file.txt`;
    await writeFile(join(cacheDir, mirrorFilePath), 'tampered content');
    expect(await service.check('prj1', 'b_12345678')).toBe('modified');
    expect(await realFs.exists(cacheDir, mirrorRelDir('prj1', 'b_12345678'))).toBe(false);

    // 4. extra file in mirror -> 'modified'
    await service.refresh('prj1', makeBackend());
    expect(await service.check('prj1', 'b_12345678')).toBe('intact');
    await writeFile(join(cacheDir, mirrorRelDir('prj1', 'b_12345678'), 'alien.txt'), 'alien');
    expect(await service.check('prj1', 'b_12345678')).toBe('modified');
    expect(await realFs.exists(cacheDir, mirrorRelDir('prj1', 'b_12345678'))).toBe(false);
  });

  it('keeps a mirrored file with a UTF-8 BOM intact on check [R-MR-04]', async () => {
    await writeFile(join(backendDir, 'bom.py'), "﻿print('hi')\n");
    const service = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });
    expect((await service.refresh('prj1', makeBackend())).state).toBe('ready');

    expect(await service.check('prj1', 'b_12345678')).toBe('intact');
    expect(await realFs.exists(cacheDir, `${mirrorRelDir('prj1', 'b_12345678')}/bom.py`)).toBe(
      true,
    );
  });
});
