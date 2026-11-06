import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../workspace/test-support.ts';
import { findAppCandidates } from './app-candidates.ts';
import { probeProject } from './probe.ts';

let baseDir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir: baseDir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('app-candidates & probe apps [WP-4.00]', () => {
  it('Test M1 [WP-4.00]: Probe fixtures/projects/monorepo-apps returns apps with frontend (supported first), legacy-cra, next-site, and no backend', async () => {
    const fixtureRoot = resolve('fixtures/projects/monorepo-apps');
    const result = await probeProject(fixtureRoot, {
      fs: nodeFs,
      platform: process.platform as 'win32' | 'darwin' | 'linux',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.kind).toBe('apps');
    if (result.value.kind !== 'apps') return;

    const { apps } = result.value;
    expect(apps.length).toBe(3);

    // Supported apps appear first
    expect(apps[0]?.path).toBe('frontend');
    expect(apps[0]?.kind).toBe('vite-react');
    expect(apps[0]?.supported).toBe(true);

    // Other apps
    const paths = apps.map((a) => a.path);
    expect(paths).toContain('legacy-cra');
    expect(paths).toContain('next-site');
    expect(paths).not.toContain('backend');

    const craApp = apps.find((a) => a.path === 'legacy-cra');
    expect(craApp?.kind).toBe('cra');
    expect(craApp?.supported).toBe(false);
    expect(craApp?.reasons).toContain('craUnsupported');

    const nextApp = apps.find((a) => a.path === 'next-site');
    expect(nextApp?.kind).toBe('next');
    expect(nextApp?.supported).toBe(false);
    expect(nextApp?.reasons).toContain('nextUnsupported');
  });

  it('Test M2 [WP-4.00]: Temp directory without package.json finds web app, but returns other for directory with only miscellaneous files', async () => {
    // 1. Temp dir with web/ (Vite + React) and web/node_modules/
    const repoWithApp = join(baseDir, 'marketlink-style');
    const webDir = join(repoWithApp, 'web');
    await mkdir(webDir, { recursive: true });
    await writeFile(
      join(webDir, 'package.json'),
      JSON.stringify({
        name: 'web-client',
        dependencies: { react: '19.0.0' },
        devDependencies: { vite: '8.0.0' },
      }),
    );
    await writeFile(join(webDir, 'vite.config.js'), 'export default {}');
    await mkdir(join(webDir, 'node_modules', 'vite'), { recursive: true });
    await writeFile(join(webDir, 'node_modules', 'vite', 'package.json'), '{}');
    await mkdir(join(webDir, 'node_modules', 'react'), { recursive: true });
    await writeFile(join(webDir, 'node_modules', 'react', 'package.json'), '{}');

    const probeWithApp = await probeProject(repoWithApp, {
      fs: nodeFs,
      platform: 'win32',
    });
    expect(probeWithApp.ok).toBe(true);
    if (!probeWithApp.ok) return;
    expect(probeWithApp.value.kind).toBe('apps');
    if (probeWithApp.value.kind === 'apps') {
      expect(probeWithApp.value.apps.map((a) => a.path)).toEqual(['web']);
    }

    // 2. Temp dir with only miscellaneous files (not empty, no web apps) returns 'other'
    const miscDir = join(baseDir, 'misc');
    await mkdir(miscDir, { recursive: true });
    await writeFile(join(miscDir, 'notes.txt'), 'hello world');
    await writeFile(join(miscDir, 'data.csv'), '1,2,3');

    const probeMisc = await probeProject(miscDir, {
      fs: nodeFs,
      platform: 'win32',
    });
    expect(probeMisc.ok).toBe(true);
    if (!probeMisc.ok) return;
    expect(probeMisc.value.kind).toBe('other');
  });

  it('Test M3 [WP-4.00]: Scanning ignores node_modules, .git, dist, and apps deeper than 3 levels are not listed', async () => {
    const root = join(baseDir, 'scan-test');
    await mkdir(root, { recursive: true });

    // App inside node_modules/ should be ignored
    const ignoredNodeModules = join(root, 'node_modules', 'fake-app');
    await mkdir(ignoredNodeModules, { recursive: true });
    await writeFile(
      join(ignoredNodeModules, 'package.json'),
      JSON.stringify({ dependencies: { react: '19.0.0' }, devDependencies: { vite: '8.0.0' } }),
    );

    // App inside .git/ should be ignored
    const ignoredGit = join(root, '.git', 'hook-app');
    await mkdir(ignoredGit, { recursive: true });
    await writeFile(
      join(ignoredGit, 'package.json'),
      JSON.stringify({ dependencies: { react: '19.0.0' }, devDependencies: { vite: '8.0.0' } }),
    );

    // App inside dist/ should be ignored
    const ignoredDist = join(root, 'dist', 'built-app');
    await mkdir(ignoredDist, { recursive: true });
    await writeFile(
      join(ignoredDist, 'package.json'),
      JSON.stringify({ dependencies: { react: '19.0.0' }, devDependencies: { vite: '8.0.0' } }),
    );

    // Level 3 app (packages/sub/app3) -> depth 3 -> listed
    const level3App = join(root, 'packages', 'sub', 'app3');
    await mkdir(level3App, { recursive: true });
    await writeFile(
      join(level3App, 'package.json'),
      JSON.stringify({ dependencies: { react: '19.0.0' }, devDependencies: { vite: '8.0.0' } }),
    );

    // Level 4 app (a/b/c/d/app4) -> depth 4 -> NOT listed
    const level4App = join(root, 'a', 'b', 'c', 'd', 'app4');
    await mkdir(level4App, { recursive: true });
    await writeFile(
      join(level4App, 'package.json'),
      JSON.stringify({ dependencies: { react: '19.0.0' }, devDependencies: { vite: '8.0.0' } }),
    );

    const candidates = await findAppCandidates(root, nodeFs);
    const candidatePaths = candidates.map((c) => c.path);

    expect(candidatePaths).toContain('packages/sub/app3');
    expect(candidatePaths).not.toContain('node_modules/fake-app');
    expect(candidatePaths).not.toContain('.git/hook-app');
    expect(candidatePaths).not.toContain('dist/built-app');
    expect(candidatePaths).not.toContain('a/b/c/d/app4');
  });
});
