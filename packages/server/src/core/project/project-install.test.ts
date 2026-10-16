import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs, writeSupportedProject } from '../workspace/test-support.ts';
import { checkNeedsInstall } from './project-install.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('checkNeedsInstall [R-PJ-06]', () => {
  it('needs install until vite and react are both in node_modules [R-PJ-06]', async () => {
    await writeSupportedProject(dir);
    expect(await checkNeedsInstall(nodeFs, dir)).toBe(true);

    const viteDir = join(dir, 'node_modules', 'vite');
    await mkdir(viteDir, { recursive: true });
    await writeFile(join(viteDir, 'package.json'), '{}');
    expect(await checkNeedsInstall(nodeFs, dir)).toBe(true);

    const reactDir = join(dir, 'node_modules', 'react');
    await mkdir(reactDir, { recursive: true });
    await writeFile(join(reactDir, 'package.json'), '{}');
    expect(await checkNeedsInstall(nodeFs, dir)).toBe(false);
  });
});
