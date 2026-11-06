import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createServices } from '../../server-services.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { ok } from '../shared/result.ts';
import { makeTempDir, nodeFs, silentLogger } from '../workspace/test-support.ts';
import { fakeSystem } from '../workspace/test-support.ts';

let tempDir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir: tempDir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('Monorepo Open & Install [WP-4.00]', () => {
  it('Test M6 [WP-4.00]: Open frontend/ of fixture sets workspaceRoot to fixture root, reads versions, and runs install in workspaceRoot', async () => {
    const fixtureRoot = resolve('fixtures/projects/monorepo-apps').replaceAll('\\', '/');
    const frontendDir = resolve('fixtures/projects/monorepo-apps/frontend').replaceAll('\\', '/');

    let spawnedCwd: string | undefined;
    let spawnedExe: string | undefined;
    const processPort: ProcessPort = {
      spawn: (exe, _args, opts) => {
        spawnedExe = exe;
        spawnedCwd = opts.cwd;
        return {
          pid: 101,
          onLine: () => undefined,
          wait: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '', lines: [] }),
          kill: () => Promise.resolve(),
        };
      },
    };

    const config = {
      path: () => 'kumicraft.json',
      settings: () => ({
        editor: 'vscode' as const,
        packageManager: 'pnpm' as const,
        agent: { preferred: 'auto' as const },
      }),
      patchSettings: () => ok(undefined),
      isTrusted: () => true,
      setTrusted: () => Promise.resolve(ok(undefined)),
      systemPrompt: () => undefined,
      setSystemPrompt: () => Promise.resolve(ok(undefined)),
      agentConfig: () => undefined,
      setAgentConfig: () => Promise.resolve(ok(undefined)),
    };

    const services = createServices(
      {
        fs: nodeFs,
        system: fakeSystem(1, new Set([1])),
        process: processPort,
        config,
        recents: { rememberProject: () => Promise.resolve(ok(undefined)) },
        logger: silentLogger,
        port: 6543,
        platform: process.platform as 'win32' | 'darwin' | 'linux',
        templateDir: frontendDir,
        cacheDir: join(tempDir, 'cache'),
        dataDir: join(tempDir, 'data'),
      },
      'http://localhost:6543',
      processPort,
      undefined as never,
      nodeFs,
      {
        watch: () => ({ close: () => Promise.resolve() }),
      },
      'runners/vite-react',
    );

    // 1. Open frontend of fixture
    const openRes = await services.projectService.open(frontendDir);
    expect(openRes.ok).toBe(true);
    if (!openRes.ok) return;

    const info = openRes.value;
    expect(info.support.supported).toBe(true);
    expect(info.support.framework).toBe('vite-react');

    // support.workspaceRoot is the root of the fixture
    expect(info.support.workspaceRoot).toBe(fixtureRoot);

    // versions of vite and react are read
    expect(info.support.versions.vite).toBe('8.0.0');
    expect(info.support.versions.react).toBe('19.0.0');

    // 2. Install command runs with cwd = fixtureRoot (workspaceRoot)
    const installRes = await services.projectService.install(['pnpm', 'install']);
    expect(installRes.ok).toBe(true);

    // Wait a tick for job execution
    await new Promise((r) => setTimeout(r, 50));

    expect(spawnedExe).toBe('pnpm');
    expect(spawnedCwd).toBe(fixtureRoot);

    await services.projectService.close();
  });
});
