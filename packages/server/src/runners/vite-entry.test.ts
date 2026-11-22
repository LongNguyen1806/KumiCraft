// The runner loads the ES module build of the project's Vite, whatever its major (round 1).
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveViteEntry } from './vite-entry.ts';

/** The `exports` of each Vite major, as published. */
const EXPORTS = {
  '5.4.21': {
    '.': {
      import: { types: './dist/node/index.d.ts', default: './dist/node/index.js' },
      require: { types: './index.d.cts', default: './index.cjs' },
    },
    './package.json': './package.json',
  },
  '6.4.5': {
    '.': {
      'module-sync': './dist/node/index.js',
      import: './dist/node/index.js',
      require: './index.cjs',
    },
    './package.json': './package.json',
  },
  '7.3.7': { '.': './dist/node/index.js', './package.json': './package.json' },
};

describe('resolveViteEntry [round 1]', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'rc-vite-entry-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each(Object.entries(EXPORTS))(
    'Vite %s: the ES module build, never index.cjs',
    async (version, exportsField) => {
      const vite = join(root, 'node_modules', 'vite');
      await mkdir(join(vite, 'dist', 'node'), { recursive: true });
      await writeFile(
        join(vite, 'package.json'),
        JSON.stringify({ name: 'vite', version, exports: exportsField }),
      );
      await writeFile(join(vite, 'dist', 'node', 'index.js'), 'export {};');
      await writeFile(join(vite, 'index.cjs'), 'module.exports = {};');
      await writeFile(join(root, 'package.json'), '{}');

      const entry = resolveViteEntry(createRequire(join(root, 'package.json')));

      expect(entry).toBe(join(vite, 'dist', 'node', 'index.js'));
    },
  );
});
