import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNodeFileSystem } from '../../../adapters/fs/node-file-system.ts';
import { computeSha256 } from '../../mirror/mirror-manifest.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { toSupportedPlatform } from '../../shared/session.ts';
import { silentLogger } from '../../workspace/test-support.ts';
import { readManifest } from './snapshot-manifest.ts';
import { createTurnSnapshotStore } from './snapshot-store.ts';

const platform = toSupportedPlatform(process.platform) ?? 'linux';
const realFs = createNodeFileSystem(platform);

let baseDir: string;
let projectRoot: string;
let dataDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'rc-snapshot-test-'));
  projectRoot = join(baseDir, 'project');
  dataDir = join(baseDir, 'data');
  await mkdir(projectRoot, { recursive: true });
  await mkdir(dataDir, { recursive: true });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

async function writeInitialFiles(): Promise<{
  readonly appBytes: Buffer;
  readonly mainBytes: Buffer;
  readonly logoBytes: Buffer;
}> {
  await mkdir(join(projectRoot, 'src'), { recursive: true });
  await mkdir(join(projectRoot, 'public'), { recursive: true });
  await mkdir(join(projectRoot, 'node_modules'), { recursive: true });
  await mkdir(join(projectRoot, '.git'), { recursive: true });
  await mkdir(join(projectRoot, 'dist'), { recursive: true });
  await mkdir(join(projectRoot, '.reactcraft'), { recursive: true });
  await mkdir(join(projectRoot, 'tmp'), { recursive: true });

  const appContent = Array.from({ length: 10 }, (_, i) => 'line' + String(i + 1)).join('\n') + '\n';
  const appBytes = Buffer.from(appContent, 'utf8');
  const mainBytes = Buffer.from('\uFEFFline1\r\nline2\r\nline3\r\n', 'utf8');
  const logoBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x00]);

  await writeFile(join(projectRoot, 'src/App.tsx'), appBytes);
  await writeFile(join(projectRoot, 'src/main.tsx'), mainBytes);
  await writeFile(join(projectRoot, 'public/logo.png'), logoBytes);
  await writeFile(join(projectRoot, 'node_modules/x.js'), 'module');
  await writeFile(join(projectRoot, '.git/HEAD'), 'ref: refs/heads/main');
  await writeFile(join(projectRoot, 'dist/a.js'), 'bundle');
  await writeFile(join(projectRoot, '.reactcraft/workspace.json'), '{}');
  await writeFile(join(projectRoot, '.env'), 'SECRET=key');
  await writeFile(join(projectRoot, '.gitignore'), 'tmp/\n');
  await writeFile(join(projectRoot, 'tmp/t.txt'), 'temp');

  return { appBytes, mainBytes, logoBytes };
}

describe('TurnSnapshotStore', () => {
  it('1. [S-113, S-31] capture excludes secrets, gitignore, ignored dirs and records tracked files', async () => {
    await writeInitialFiles();
    const statSpy = vi.fn((...args: Parameters<typeof realFs.stat>) => realFs.stat(...args));
    const readBytesSpy = vi.fn((...args: Parameters<typeof realFs.readBytes>) =>
      realFs.readBytes(...args),
    );
    const spyFs: FileSystemPort = { ...realFs, stat: statSpy, readBytes: readBytesSpy };

    const store = createTurnSnapshotStore({ fs: spyFs, dataDir, logger: silentLogger });
    const capRes = await store.capture('proj_1', projectRoot, 't_1');
    expect(capRes.ok).toBe(true);

    const manifest = await readManifest(realFs, dataDir, 'proj_1', 't_1');
    expect(manifest).toBeDefined();
    const recorded = (manifest ? manifest.before.map((e) => e.path) : []).sort();
    expect(recorded).toEqual(['.gitignore', 'public/logo.png', 'src/App.tsx', 'src/main.tsx']);

    const accessedPaths = [
      ...statSpy.mock.calls.map((c) => c[1]),
      ...readBytesSpy.mock.calls.map((c) => c[1]),
    ];
    expect(accessedPaths.some((p) => p.includes('.env'))).toBe(false);
  });

  it('2. [S-113] capture reuse does not call readBytes for unchanged files', async () => {
    await writeInitialFiles();
    const readBytesSpy = vi.fn((...args: Parameters<typeof realFs.readBytes>) =>
      realFs.readBytes(...args),
    );
    const spyFs: FileSystemPort = { ...realFs, readBytes: readBytesSpy };
    const store = createTurnSnapshotStore({ fs: spyFs, dataDir, logger: silentLogger });

    await store.capture('proj_1', projectRoot, 'turn_a');
    const callsAfterA = readBytesSpy.mock.calls.length;
    expect(callsAfterA).toBeGreaterThan(0);

    readBytesSpy.mockClear();
    await store.capture('proj_1', projectRoot, 'turn_b');
    expect(readBytesSpy).not.toHaveBeenCalled();
  });

  it('3. [S-113] capture with maxBytes smaller than total rejects with E016 projectTooLarge', async () => {
    await writeInitialFiles();
    const store = createTurnSnapshotStore(
      { fs: realFs, dataDir, logger: silentLogger },
      { maxBytes: 10 },
    );
    const res = await store.capture('proj_1', projectRoot, 'turn_oversize');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('E016');
      expect(res.error.params?.reason).toBe('projectTooLarge');
      expect(res.error.params?.limitBytes).toBe(10);
    }
    const manifestExists = await realFs.exists(dataDir, 'turns/proj_1/turn_oversize.json');
    expect(manifestExists).toBe(false);
  });

  it('4. [R-AG-12] finish detects modified, created, deleted files sorted by path', async () => {
    await writeInitialFiles();
    const store = createTurnSnapshotStore({ fs: realFs, dataDir, logger: silentLogger });
    await store.capture('proj_1', projectRoot, 'turn_1');

    await writeFile(join(projectRoot, 'src/App.tsx'), 'modified app with different size\n');
    await writeFile(join(projectRoot, 'src/main.tsx'), 'modified main with different size\n');
    await mkdir(join(projectRoot, 'src/pages'), { recursive: true });
    await writeFile(
      join(projectRoot, 'src/pages/Products.tsx'),
      'export const Products = () => null;',
    );
    await rm(join(projectRoot, 'public/logo.png'));

    const finishRes = await store.finish('proj_1', projectRoot, 'turn_1');
    expect(finishRes.ok).toBe(true);
    if (finishRes.ok) {
      expect(finishRes.value).toEqual([
        { path: 'public/logo.png', change: 'deleted' },
        { path: 'src/App.tsx', change: 'modified' },
        { path: 'src/main.tsx', change: 'modified' },
        { path: 'src/pages/Products.tsx', change: 'created' },
      ]);
    }
  });

  it('5. [R-AG-12] capture followed by finish with no changes returns empty array', async () => {
    await writeInitialFiles();
    const store = createTurnSnapshotStore({ fs: realFs, dataDir, logger: silentLogger });
    await store.capture('proj_1', projectRoot, 'turn_noop');
    const finishRes = await store.finish('proj_1', projectRoot, 'turn_noop');
    expect(finishRes.ok).toBe(true);
    if (finishRes.ok) {
      expect(finishRes.value).toEqual([]);
    }
  });

  it('6. [S-16] diff returns unified diff with 3 lines context, all additions, binary marker, and E015', async () => {
    await writeInitialFiles();
    const store = createTurnSnapshotStore({ fs: realFs, dataDir, logger: silentLogger });
    await store.capture('proj_1', projectRoot, 'turn_diff');

    const appLines = Array.from({ length: 10 }, (_, i) =>
      i === 4 ? 'line5-mod' : 'line' + String(i + 1),
    );
    await writeFile(join(projectRoot, 'src/App.tsx'), appLines.join('\n') + '\n');
    await mkdir(join(projectRoot, 'src/pages'), { recursive: true });
    await writeFile(join(projectRoot, 'src/pages/Products.tsx'), 'lineA\nlineB\n');
    await rm(join(projectRoot, 'public/logo.png'));
    await store.finish('proj_1', projectRoot, 'turn_diff');

    const appDiff = await store.diff('proj_1', 'turn_diff', 'src/App.tsx');
    expect(appDiff.ok).toBe(true);
    if (appDiff.ok) {
      expect(appDiff.value).toContain('--- src/App.tsx');
      expect(appDiff.value).toContain('+++ src/App.tsx');
      expect(appDiff.value).toContain('-line5\n+line5-mod');
      expect(appDiff.value).toContain(' line2\n line3\n line4');
      expect(appDiff.value).toContain(' line6\n line7\n line8');
    }

    const prodDiff = await store.diff('proj_1', 'turn_diff', 'src/pages/Products.tsx');
    expect(prodDiff.ok).toBe(true);
    if (prodDiff.ok) {
      expect(prodDiff.value).toContain('+lineA');
      expect(prodDiff.value).toContain('+lineB');
    }

    const logoDiff = await store.diff('proj_1', 'turn_diff', 'public/logo.png');
    expect(logoDiff.ok).toBe(true);
    if (logoDiff.ok) {
      expect(logoDiff.value).toBe('Binary or large file changed: public/logo.png\n');
    }

    const unknownDiff = await store.diff('proj_1', 'turn_diff', 'src/Unknown.tsx');
    expect(unknownDiff.ok).toBe(false);
    if (!unknownDiff.ok) {
      expect(unknownDiff.error.code).toBe('E015');
    }
  });

  it('7. [R-AG-15, NFR-09] revert restores all files byte-for-byte including BOM/CRLF and binary 0', async () => {
    const { appBytes, mainBytes, logoBytes } = await writeInitialFiles();
    const store = createTurnSnapshotStore({ fs: realFs, dataDir, logger: silentLogger });
    await store.capture('proj_1', projectRoot, 'turn_rev');

    await writeFile(join(projectRoot, 'src/App.tsx'), 'changed app\n');
    await writeFile(join(projectRoot, 'src/main.tsx'), 'changed main\n');
    await mkdir(join(projectRoot, 'src/pages'), { recursive: true });
    await writeFile(join(projectRoot, 'src/pages/Products.tsx'), 'products page\n');
    await rm(join(projectRoot, 'public/logo.png'));
    await store.finish('proj_1', projectRoot, 'turn_rev');

    const revRes = await store.revert('proj_1', projectRoot, 'turn_rev');
    expect(revRes.ok).toBe(true);
    if (revRes.ok) {
      expect(revRes.value.length).toBe(4);
    }

    const restoredApp = await readFile(join(projectRoot, 'src/App.tsx'));
    const restoredMain = await readFile(join(projectRoot, 'src/main.tsx'));
    const restoredLogo = await readFile(join(projectRoot, 'public/logo.png'));

    expect(Buffer.compare(restoredApp, appBytes)).toBe(0);
    expect(Buffer.compare(restoredMain, mainBytes)).toBe(0);
    expect(Buffer.compare(restoredLogo, logoBytes)).toBe(0);
    const prodExists = await realFs.exists(projectRoot, 'src/pages/Products.tsx');
    expect(prodExists).toBe(false);
  });

  it('8. [R-AG-15] revert rejects with E017 when a file was changed after turn, touching no files', async () => {
    await writeInitialFiles();
    const store = createTurnSnapshotStore({ fs: realFs, dataDir, logger: silentLogger });
    await store.capture('proj_1', projectRoot, 'turn_conflict');

    await writeFile(join(projectRoot, 'src/App.tsx'), 'agent changed app\n');
    await writeFile(join(projectRoot, 'src/main.tsx'), 'agent changed main\n');
    await mkdir(join(projectRoot, 'src/pages'), { recursive: true });
    await writeFile(join(projectRoot, 'src/pages/Products.tsx'), 'products\n');
    await rm(join(projectRoot, 'public/logo.png'));
    await store.finish('proj_1', projectRoot, 'turn_conflict');

    await writeFile(join(projectRoot, 'src/App.tsx'), 'user modified app again\n');

    const revRes = await store.revert('proj_1', projectRoot, 'turn_conflict');
    expect(revRes.ok).toBe(false);
    if (!revRes.ok) {
      expect(revRes.error.code).toBe('E017');
      expect(revRes.error.params?.file).toBe('src/App.tsx');
      expect(revRes.error.params?.reason).toBe('fileChanged');
    }

    const currentApp = await readFile(join(projectRoot, 'src/App.tsx'), 'utf8');
    expect(currentApp).toBe('user modified app again\n');
    const currentMain = await readFile(join(projectRoot, 'src/main.tsx'), 'utf8');
    expect(currentMain).toBe('agent changed main\n');
    const prodExists = await realFs.exists(projectRoot, 'src/pages/Products.tsx');
    expect(prodExists).toBe(true);
    const logoExists = await realFs.exists(projectRoot, 'public/logo.png');
    expect(logoExists).toBe(false);
  });

  it('9. [R-AG-15] revert rejects with E017 when created file is deleted or deleted file is recreated', async () => {
    await writeInitialFiles();
    const store = createTurnSnapshotStore({ fs: realFs, dataDir, logger: silentLogger });
    await store.capture('proj_1', projectRoot, 'turn_del_recreate');

    await writeFile(join(projectRoot, 'src/App.tsx'), 'agent app\n');
    await mkdir(join(projectRoot, 'src/pages'), { recursive: true });
    await writeFile(join(projectRoot, 'src/pages/Products.tsx'), 'products\n');
    await rm(join(projectRoot, 'public/logo.png'));
    await store.finish('proj_1', projectRoot, 'turn_del_recreate');

    await rm(join(projectRoot, 'src/pages/Products.tsx'));
    const revA = await store.revert('proj_1', projectRoot, 'turn_del_recreate');
    expect(revA.ok).toBe(false);
    if (!revA.ok) {
      expect(revA.error.code).toBe('E017');
      expect(revA.error.params?.file).toBe('src/pages/Products.tsx');
    }

    await writeFile(join(projectRoot, 'src/pages/Products.tsx'), 'products\n');
    await writeFile(join(projectRoot, 'public/logo.png'), 'recreated logo\n');
    const revB = await store.revert('proj_1', projectRoot, 'turn_del_recreate');
    expect(revB.ok).toBe(false);
    if (!revB.ok) {
      expect(revB.error.code).toBe('E017');
      expect(revB.error.params?.file).toBe('public/logo.png');
    }
  });

  it('10. [R-AG-15] revert called twice on the same turn rejects with E016 alreadyReverted', async () => {
    await writeInitialFiles();
    const store = createTurnSnapshotStore({ fs: realFs, dataDir, logger: silentLogger });
    await store.capture('proj_1', projectRoot, 'turn_twice');

    await writeFile(join(projectRoot, 'src/App.tsx'), 'mod\n');
    await store.finish('proj_1', projectRoot, 'turn_twice');

    const rev1 = await store.revert('proj_1', projectRoot, 'turn_twice');
    expect(rev1.ok).toBe(true);

    const rev2 = await store.revert('proj_1', projectRoot, 'turn_twice');
    expect(rev2.ok).toBe(false);
    if (!rev2.ok) {
      expect(rev2.error.code).toBe('E016');
      expect(rev2.error.params?.reason).toBe('alreadyReverted');
    }
  });

  it('11. [S-113] keepTurns: 3 prunes old manifests and orphan objects, keeping shared objects', async () => {
    await writeInitialFiles();
    const store = createTurnSnapshotStore(
      { fs: realFs, dataDir, logger: silentLogger },
      { keepTurns: 3 },
    );

    const mainBytes = await readFile(join(projectRoot, 'src/main.tsx'));
    const mainSha = computeSha256(mainBytes);
    const turn1AppContent = 'turn1 unique app content\n';
    const turn1Sha = computeSha256(Buffer.from(turn1AppContent, 'utf8'));

    for (let i = 1; i <= 5; i++) {
      const turnId = 'turn_' + String(i);
      await store.capture('proj_1', projectRoot, turnId);
      const appContent =
        i === 1 ? turn1AppContent : 'turn ' + String(i) + ' unique content ' + String(i) + '\n';
      await writeFile(join(projectRoot, 'src/App.tsx'), appContent);
      await store.finish('proj_1', projectRoot, turnId);
    }

    const turn6Res = await store.capture('proj_1', projectRoot, 'turn_6');
    expect(turn6Res.ok).toBe(true);

    const dirRes = await realFs.readDir(dataDir, 'turns/proj_1');
    expect(dirRes.ok).toBe(true);
    const manifestNames = (dirRes.ok ? dirRes.value : [])
      .filter((e) => e.name.endsWith('.json'))
      .map((e) => e.name)
      .sort();
    expect(manifestNames).toEqual(['turn_4.json', 'turn_5.json', 'turn_6.json']);

    const oldAppObjectExists = await realFs.exists(
      dataDir,
      `turns/proj_1/objects/${turn1Sha.slice(0, 2)}/${turn1Sha}`,
    );
    expect(oldAppObjectExists).toBe(false);

    const sharedMainExists = await realFs.exists(
      dataDir,
      `turns/proj_1/objects/${mainSha.slice(0, 2)}/${mainSha}`,
    );
    expect(sharedMainExists).toBe(true);
  });

  it('12. finish, diff, revert with unknown turn return E015; traversal in turnId returns E016 invalidId', async () => {
    await writeInitialFiles();
    const store = createTurnSnapshotStore({ fs: realFs, dataDir, logger: silentLogger });

    const fRes = await store.finish('proj_1', projectRoot, 'unknown_turn');
    expect(fRes.ok).toBe(false);
    if (!fRes.ok) expect(fRes.error.code).toBe('E015');

    const dRes = await store.diff('proj_1', 'unknown_turn', 'src/App.tsx');
    expect(dRes.ok).toBe(false);
    if (!dRes.ok) expect(dRes.error.code).toBe('E015');

    const rRes = await store.revert('proj_1', projectRoot, 'unknown_turn');
    expect(rRes.ok).toBe(false);
    if (!rRes.ok) expect(rRes.error.code).toBe('E015');

    const travRes = await store.capture('proj_1', projectRoot, '../traversal');
    expect(travRes.ok).toBe(false);
    if (!travRes.ok) {
      expect(travRes.error.code).toBe('E016');
      expect(travRes.error.params?.reason).toBe('invalidId');
    }

    const outsideExists = await realFs.exists(dataDir, 'turns/traversal.json');
    expect(outsideExists).toBe(false);
  });

  it('captures and reverts a file larger than the 20 MB default read limit [S-113, R-AG-15]', async () => {
    const big = Buffer.alloc(21 * 1024 * 1024, 0x61);
    await mkdir(join(projectRoot, 'public'), { recursive: true });
    await writeFile(join(projectRoot, 'public', 'video.mp4'), big);
    const store = createTurnSnapshotStore({ fs: realFs, dataDir, logger: silentLogger });

    expect((await store.capture('prj1', projectRoot, 'turnBig')).ok).toBe(true);
    await writeFile(join(projectRoot, 'public', 'video.mp4'), 'replaced');
    const finished = await store.finish('prj1', projectRoot, 'turnBig');
    expect(finished.ok && finished.value).toEqual([
      { path: 'public/video.mp4', change: 'modified' },
    ]);

    expect((await store.revert('prj1', projectRoot, 'turnBig')).ok).toBe(true);
    expect((await readFile(join(projectRoot, 'public', 'video.mp4'))).equals(big)).toBe(true);
  });
});
