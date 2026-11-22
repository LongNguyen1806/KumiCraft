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

  it('[WP-4.00] checks the packages of the project framework: an Express app needs no vite or react', async () => {
    const express = ['express', 'pug'];
    expect(await checkNeedsInstall(nodeFs, dir, express)).toBe(true);
    for (const name of express) {
      await mkdir(join(dir, 'node_modules', name), { recursive: true });
      await writeFile(join(dir, 'node_modules', name, 'package.json'), '{}');
    }
    expect(await checkNeedsInstall(nodeFs, dir, express)).toBe(false);
    // The same folder is not ready for a Vite + React project.
    expect(await checkNeedsInstall(nodeFs, dir)).toBe(true);
  });

  it('Test M5 [WP-4.00]: checkNeedsInstall for frontend/ returns false when vite and react are in workspace root node_modules, but true when outside workspace root', async () => {
    // 1. Workspace root with packages hoisted to root
    const wsRoot = join(dir, 'monorepo');
    const frontendDir = join(wsRoot, 'frontend');
    await mkdir(frontendDir, { recursive: true });
    await writeFile(join(wsRoot, 'package.json'), JSON.stringify({ workspaces: ['frontend'] }));

    // Before hoisting to wsRoot: needs install
    expect(await checkNeedsInstall(nodeFs, frontendDir)).toBe(true);

    // Hoist vite and react into workspace root
    for (const name of ['vite', 'react']) {
      const pkgDir = join(wsRoot, 'node_modules', name);
      await mkdir(pkgDir, { recursive: true });
      await writeFile(join(pkgDir, 'package.json'), '{}');
    }

    // Now frontend/ recognizes hoisted packages in workspace root
    expect(await checkNeedsInstall(nodeFs, frontendDir)).toBe(false);

    // 2. Packages placed in parent OUTSIDE workspace root are not recognized
    const outsideRepo = join(dir, 'outside-repo');
    const innerWs = join(outsideRepo, 'inner-ws');
    const innerApp = join(innerWs, 'app');
    await mkdir(innerApp, { recursive: true });
    await writeFile(join(innerWs, 'package.json'), JSON.stringify({ workspaces: ['app'] }));

    // Put vite and react above innerWs (in outsideRepo)
    for (const name of ['vite', 'react']) {
      const pkgDir = join(outsideRepo, 'node_modules', name);
      await mkdir(pkgDir, { recursive: true });
      await writeFile(join(pkgDir, 'package.json'), '{}');
    }

    // Must still return true because outsideRepo is above innerWs workspace root
    expect(await checkNeedsInstall(nodeFs, innerApp)).toBe(true);
  });
});
