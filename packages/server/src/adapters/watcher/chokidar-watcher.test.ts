// Tests for the chokidar folder watcher (ADR-BE-20).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { makeTempDir } from '../../core/workspace/test-support.ts';
import { createChokidarWatcher, isIgnoredPath } from './chokidar-watcher.ts';

describe('chokidar watcher [ADR-BE-20]', () => {
  it('reports quick writes as one batch of relative paths, without node_modules', async () => {
    const { dir, cleanup } = await makeTempDir();
    await mkdir(join(dir, 'src'), { recursive: true });
    await mkdir(join(dir, 'node_modules', 'pkg'), { recursive: true });
    const batches: (readonly string[])[] = [];
    // A wide window keeps the three writes in one batch on slow file systems.
    const handle = createChokidarWatcher(1_000).watch(dir, (files) => batches.push(files));
    try {
      await handle.ready;
      await writeFile(join(dir, 'src', 'A.tsx'), 'a');
      await writeFile(join(dir, 'src', 'B.tsx'), 'b');
      await writeFile(join(dir, 'node_modules', 'pkg', 'index.js'), 'x');
      await writeFile(join(dir, 'src', 'C.tsx'), 'c');

      await expect.poll(() => batches.flat().length, { timeout: 5_000 }).toBeGreaterThanOrEqual(3);

      expect(batches).toHaveLength(1);
      expect([...(batches[0] ?? [])].sort()).toEqual(['src/A.tsx', 'src/B.tsx', 'src/C.tsx']);
    } finally {
      await handle.close();
      await cleanup();
    }
  });

  it('ignores dependency, git, build and lock paths', () => {
    expect(isIgnoredPath('node_modules/react/index.js')).toBe(true);
    expect(isIgnoredPath('packages/a/node_modules/x.js')).toBe(true);
    expect(isIgnoredPath('.git/HEAD')).toBe(true);
    expect(isIgnoredPath('dist/index.html')).toBe(true);
    expect(isIgnoredPath('.kumicraft/lock')).toBe(true);
    expect(isIgnoredPath('.kumicraft/cache/a.json')).toBe(true);
    expect(isIgnoredPath('.kumicraft/workspace.json')).toBe(false);
    expect(isIgnoredPath('src/pages/Home.tsx')).toBe(false);
  });
});
