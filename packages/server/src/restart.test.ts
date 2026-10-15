// Stopping the server and starting it again in the same folder: the project, its trust decision
// and the user settings are still there; a second server on the same project is refused.
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';

import { newWorkspaceFile, serializeWorkspaceFile, WORKSPACE_FILE } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, silentLogger, writeSupportedProject } from './core/workspace/test-support.ts';
import { type RunningServer, startServer } from './index.ts';

let workspace: { dir: string; cleanup: () => Promise<void> };
let config: { dir: string; cleanup: () => Promise<void> };
const running: RunningServer[] = [];

const freePort = () =>
  new Promise<number>((resolve) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = address instanceof Object ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });

async function start(configDir = config.dir) {
  const started = await startServer({
    version: '0.0.0',
    port: await freePort(),
    workspaceDir: workspace.dir,
    logLevel: 'silent',
    deps: { configDir, logger: silentLogger },
  });
  if (started.ok) running.push(started.value);
  return started;
}

async function call(server: RunningServer, method: string, path: string, body?: unknown) {
  const response = await fetch(`${server.url}/api/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${server.sessionToken}`,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function writeProject() {
  await writeSupportedProject(workspace.dir);
  await mkdir(join(workspace.dir, '.reactcraft'));
  const file = newWorkspaceFile({
    id: 'shop000001',
    name: 'Shop',
    createdAt: '2026-10-14T08:00:00.000Z',
    responsiveMode: 'desktop-first',
  });
  await writeFile(join(workspace.dir, WORKSPACE_FILE), serializeWorkspaceFile(file));
}

beforeEach(async () => {
  workspace = await makeTempDir();
  config = await makeTempDir();
});

afterEach(async () => {
  for (const server of running.splice(0)) await server.close();
  await workspace.cleanup();
  await config.cleanup();
});

describe('server restart', () => {
  it('opens the same project, trusted, after a restart [S-82]', async () => {
    await writeProject();
    const first = await start();
    if (!first.ok) throw new Error(first.error.code);
    const trusted = await call(first.value, 'POST', '/project/trust', { trusted: true });
    expect(trusted.status).toBe(200);
    await first.value.close();
    running.length = 0;

    const second = await start();
    if (!second.ok) throw new Error(second.error.code);

    expect((await call(second.value, 'GET', '/session')).body).toMatchObject({
      data: { project: { state: 'open', id: 'shop000001', name: 'Shop', trusted: true } },
    });
  });

  it('refuses a second server on the same project while the first runs [E018]', async () => {
    await writeProject();
    const first = await start();
    if (!first.ok) throw new Error(first.error.code);

    expect(await start()).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { port: first.value.port } },
    });
  });

  it('remembers settings across a restart on a computer that never ran ReactCraft', async () => {
    const neverCreated = join(config.dir, 'reactcraft-nodejs', 'Config');
    const first = await start(neverCreated);
    if (!first.ok) throw new Error(first.error.code);

    const saved = await call(first.value, 'PATCH', '/settings', { language: 'en' });
    expect(saved.status).toBe(200);
    await first.value.close();
    running.length = 0;

    const second = await start(neverCreated);
    if (!second.ok) throw new Error(second.error.code);
    expect((await call(second.value, 'GET', '/settings')).body).toMatchObject({
      data: { language: 'en' },
    });
  });
});
