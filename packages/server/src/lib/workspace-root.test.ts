import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../services/workspace/test-support.ts';
import { findPackage, findPackageWorkspaceRoot, findWorkspaceRoot } from './workspace-root.ts';

let baseDir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir: baseDir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('findWorkspaceRoot [WP-4.00]', () => {
  it('Test M4 [WP-4.00]: findWorkspaceRoot finds parent with workspaces, parent with .git, and returns undefined if nothing within 5 levels', async () => {
    // 1. Has package.json with workspaces in parent
    const wsRepoDir = join(baseDir, 'ws-repo');
    const appDir = join(wsRepoDir, 'packages', 'app');
    await mkdir(appDir, { recursive: true });
    await writeFile(
      join(wsRepoDir, 'package.json'),
      JSON.stringify({ name: 'ws-root', workspaces: ['packages/*'] }),
    );

    const foundWs = await findWorkspaceRoot(nodeFs, appDir);
    expect(foundWs).toBe(wsRepoDir.replaceAll('\\', '/'));

    // 2. Has .git in parent
    const gitRepoDir = join(baseDir, 'git-repo');
    const gitAppDir = join(gitRepoDir, 'src', 'web');
    await mkdir(join(gitRepoDir, '.git'), { recursive: true });
    await mkdir(gitAppDir, { recursive: true });

    const foundGit = await findWorkspaceRoot(nodeFs, gitAppDir);
    expect(foundGit).toBe(gitRepoDir.replaceAll('\\', '/'));

    // 3. Has pnpm-workspace.yaml in parent
    const pnpmRepoDir = join(baseDir, 'pnpm-repo');
    const pnpmAppDir = join(pnpmRepoDir, 'apps', 'client');
    await mkdir(pnpmAppDir, { recursive: true });
    await writeFile(join(pnpmRepoDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');

    const foundPnpm = await findWorkspaceRoot(nodeFs, pnpmAppDir);
    expect(foundPnpm).toBe(pnpmRepoDir.replaceAll('\\', '/'));

    // 4. Nothing within 5 levels returns undefined
    const deepDir = join(baseDir, 'a', 'b', 'c', 'd', 'e', 'f');
    await mkdir(deepDir, { recursive: true });
    const notFound = await findWorkspaceRoot(nodeFs, deepDir);
    expect(notFound).toBeUndefined();

    // 5. Workspace marker beyond 5 levels is ignored
    const markerDir = join(baseDir, 'marker');
    await mkdir(join(markerDir, '.git'), { recursive: true });
    const tooDeepApp = join(markerDir, '1', '2', '3', '4', '5', '6', 'app');
    await mkdir(tooDeepApp, { recursive: true });
    const beyondMax = await findWorkspaceRoot(nodeFs, tooDeepApp);
    expect(beyondMax).toBeUndefined();
  });

  it('Test [WP-4.00]: findPackage locates package in root, parent workspace, and stops at workspace root', async () => {
    const wsDir = join(baseDir, 'monorepo');
    const childApp = join(wsDir, 'frontend');
    await mkdir(childApp, { recursive: true });
    await writeFile(join(wsDir, 'package.json'), JSON.stringify({ workspaces: ['frontend'] }));

    // Hoisted package in workspace root
    const hoistedReact = join(wsDir, 'node_modules', 'react');
    await mkdir(hoistedReact, { recursive: true });
    await writeFile(join(hoistedReact, 'package.json'), JSON.stringify({ name: 'react' }));

    const foundHoisted = await findPackage(nodeFs, childApp, 'react');
    expect(foundHoisted).toBe(hoistedReact.replaceAll('\\', '/'));

    // Local package in app's own node_modules takes precedence
    const localVite = join(childApp, 'node_modules', 'vite');
    await mkdir(localVite, { recursive: true });
    await writeFile(join(localVite, 'package.json'), JSON.stringify({ name: 'vite' }));

    const foundLocal = await findPackage(nodeFs, childApp, 'vite');
    expect(foundLocal).toBe(localVite.replaceAll('\\', '/'));

    // Package in parent ABOVE workspace root is ignored
    const outerPkg = join(baseDir, 'node_modules', 'lodash');
    await mkdir(outerPkg, { recursive: true });
    await writeFile(join(outerPkg, 'package.json'), JSON.stringify({ name: 'lodash' }));

    const notFoundOuter = await findPackage(nodeFs, childApp, 'lodash');
    expect(notFoundOuter).toBeUndefined();
  });
});

describe('findPackageWorkspaceRoot [WP-4.00]', () => {
  it('[WP-4.00] M6: installs run at a package workspace, never at a repo root that only has .git (MarketLink)', async () => {
    // MarketLink: repo root has .git, frontend/ and backend/ side by side, no package.json.
    const repo = join(baseDir, 'marketlink');
    const frontend = join(repo, 'frontend');
    await mkdir(join(repo, '.git'), { recursive: true });
    await mkdir(frontend, { recursive: true });
    expect(await findPackageWorkspaceRoot(nodeFs, frontend)).toBeUndefined();

    // An npm workspace inside a git repo: the workspace, not the repo.
    const mono = join(baseDir, 'mono');
    const web = join(mono, 'apps', 'web');
    await mkdir(join(mono, '.git'), { recursive: true });
    await mkdir(web, { recursive: true });
    await writeFile(join(mono, 'package.json'), JSON.stringify({ workspaces: ['apps/*'] }));
    expect(await findPackageWorkspaceRoot(nodeFs, web)).toBe(mono.replaceAll('\\', '/'));

    // A workspace above the repo's .git is out of reach.
    const outer = join(baseDir, 'outer');
    const inner = join(outer, 'repo', 'app');
    await mkdir(join(outer, 'repo', '.git'), { recursive: true });
    await mkdir(inner, { recursive: true });
    await writeFile(join(outer, 'pnpm-workspace.yaml'), 'packages: []\n');
    expect(await findPackageWorkspaceRoot(nodeFs, inner)).toBeUndefined();
  });
});
