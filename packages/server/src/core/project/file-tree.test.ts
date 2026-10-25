import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { toSupportedPlatform } from '../shared/session.ts';
import { listFileTree } from './file-tree.ts';

const platform = toSupportedPlatform(process.platform) ?? 'linux';
const fs = createNodeFileSystem(platform);

describe('file-tree [WP-4.00]', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'kumicraft-tree-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'public'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'some-pkg'), { recursive: true });
    await mkdir(join(root, '.git'), { recursive: true });
    await mkdir(join(root, 'dist'), { recursive: true });
    await mkdir(join(root, '.kumicraft'), { recursive: true });
    await writeFile(join(root, '.env'), 'SECRET=123');
    await writeFile(join(root, 'package.json'), '{}');
    await writeFile(join(root, 'README.md'), '# test');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('[WP-4.00] file-tree: root lists directories first by name, excludes node_modules, .git, dist, .kumicraft, flags .env as hidden', async () => {
    const res = await listFileTree(fs, root, '');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const names = res.value.entries.map((e) => e.name);
    // Directories first: public, src
    expect(names.slice(0, 2)).toEqual(['public', 'src']);
    expect(res.value.entries[0]?.kind).toBe('directory');
    expect(res.value.entries[1]?.kind).toBe('directory');

    // Files: .env, package.json, README.md
    expect(names).toContain('.env');
    expect(names).toContain('package.json');
    expect(names).toContain('README.md');

    // Ignored directories not present
    expect(names).not.toContain('node_modules');
    expect(names).not.toContain('.git');
    expect(names).not.toContain('dist');
    expect(names).not.toContain('.kumicraft');

    const envEntry = res.value.entries.find((e) => e.name === '.env');
    expect(envEntry?.hidden).toBe(true);

    const pkgEntry = res.value.entries.find((e) => e.name === 'package.json');
    expect(pkgEntry?.hidden).toBe(false);
  });

  it('[WP-4.00] file-tree: dir=../x or dir=node_modules returns error, does not list', async () => {
    const outsideRes = await listFileTree(fs, root, '../outside');
    expect(outsideRes.ok).toBe(false);

    const ignoredRes = await listFileTree(fs, root, 'node_modules');
    expect(ignoredRes.ok).toBe(false);
    if (!ignoredRes.ok) {
      expect(ignoredRes.error.code).toBe('E012');
    }
  });
});
