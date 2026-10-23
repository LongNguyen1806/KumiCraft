// Source files for external AI agents (R-AG-19, round 7b).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../workspace/test-support.ts';
import { listSourceFiles, SOURCE_FILES_MAX } from './source-files.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

async function touch(path: string): Promise<void> {
  await mkdir(join(dir, path, '..'), { recursive: true });
  await writeFile(join(dir, path), '');
}

describe('listSourceFiles [R-AG-19]', () => {
  it('lists code and style files, sorted, and skips the rest [R-AG-19]', async () => {
    for (const file of [
      'src/pages/Home.jsx',
      'src/components/Card.tsx',
      'src/components/Card.module.css',
      'src/styles/index.css',
      'src/assets/logo.png',
      'src/.hidden/x.tsx',
      'src/node_modules/y.tsx',
    ]) {
      await touch(file);
    }

    const listed = await listSourceFiles(nodeFs, dir, 'src');

    expect(listed.ok && listed.value).toEqual({
      files: [
        'src/components/Card.module.css',
        'src/components/Card.tsx',
        'src/pages/Home.jsx',
        'src/styles/index.css',
      ],
      truncated: false,
    });
  });

  it('stops at the limit and says so [R-AG-19]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    await Promise.all(
      Array.from({ length: SOURCE_FILES_MAX + 5 }, (_, i) =>
        writeFile(join(dir, 'src', `F${String(i).padStart(4, '0')}.tsx`), ''),
      ),
    );

    const listed = await listSourceFiles(nodeFs, dir, 'src');

    expect(listed.ok && listed.value.files.length).toBe(SOURCE_FILES_MAX);
    expect(listed.ok && listed.value.truncated).toBe(true);
  });
});
