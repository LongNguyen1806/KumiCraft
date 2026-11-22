// A Next.js project is recognized at the root or under src/, with any Next version (03b 1.3, 0).
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs } from '../../../services/workspace/test-support.ts';
import { detectNextReact } from './detect.ts';

let root: string;
const pkg = { dependencies: { next: '14.2.0', react: '18.3.1', 'react-dom': '18.3.1' } };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'rc-next-detect-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('Next.js detection [03b section 1.3]', () => {
  it('app/ at the root: supported, the root is the source folder', async () => {
    await mkdir(join(root, 'app'), { recursive: true });
    await writeFile(join(root, 'tsconfig.json'), '{}');

    const report = await detectNextReact({ root, fs: directWriteFs, packageJson: pkg });

    expect(report).toMatchObject({
      supported: true,
      framework: 'next-react',
      sourceDir: '.',
      language: 'ts',
    });
  });

  it('src/pages/: supported with src as the source folder; no app/ or pages/: refused with the reason', async () => {
    await mkdir(join(root, 'src', 'pages'), { recursive: true });
    expect(await detectNextReact({ root, fs: directWriteFs, packageJson: pkg })).toMatchObject({
      supported: true,
      sourceDir: 'src',
    });

    await rm(join(root, 'src'), { recursive: true });
    expect(await detectNextReact({ root, fs: directWriteFs, packageJson: pkg })).toMatchObject({
      supported: false,
      reasons: ['noNextPages'],
    });
  });
});
