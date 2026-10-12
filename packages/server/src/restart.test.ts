// WP-1.05 acceptance (SPEC-07 section 5.2): create a workspace, edit it, stop the server, start it
// again in the same folder: the design is still there. The Studio version of this scenario is B7.
import { createServer } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, silentLogger } from './core/workspace/test-support.ts';
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

async function start() {
  const started = await startServer({
    version: '0.0.0',
    port: await freePort(),
    workspaceDir: workspace.dir,
    logLevel: 'silent',
    deps: { configDir: config.dir, logger: silentLogger },
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

type DocumentBody = {
  data: {
    revision: number;
    document: {
      workspace: { name: string; pageOrder: string[] };
      pages: Record<string, { root: { id: string; children?: { id: string }[] } }>;
    };
  };
};

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
  it('keeps a created and edited design across a restart', async () => {
    const first = await start();
    if (!first.ok) throw new Error(first.error.code);
    expect((await call(first.value, 'POST', '/workspace', { name: 'Shop' })).status).toBe(201);
    const created = (await call(first.value, 'GET', '/workspace/document')).body as DocumentBody;
    const pageId = created.data.document.workspace.pageOrder[0] ?? '';
    const rootId = created.data.document.pages[pageId]?.root.id ?? '';

    const edited = await call(first.value, 'POST', '/workspace/operations', {
      baseRevision: created.data.revision,
      meta: { source: 'user', label: 'Add heading' },
      ops: [
        { op: 'workspace.update', name: 'Shop 2' },
        {
          op: 'insert',
          target: { kind: 'page', pageId },
          parentId: rootId,
          index: 0,
          node: {
            id: 'n_heading001',
            type: 'Heading',
            content: { kind: 'heading', text: 'Welcome', level: 1 },
          },
        },
      ],
    });
    expect(edited.status).toBe(200);
    await first.value.close();
    running.length = 0;

    const second = await start();
    if (!second.ok) throw new Error(second.error.code);
    const reopened = (await call(second.value, 'GET', '/workspace/document')).body as DocumentBody;

    expect(reopened.data.revision).toBe(created.data.revision + 1);
    expect(reopened.data.document.workspace.name).toBe('Shop 2');
    expect(reopened.data.document.pages[pageId]?.root.children).toHaveLength(1);
  });

  it('refuses a second server on the same workspace while the first runs [E018]', async () => {
    const first = await start();
    if (!first.ok) throw new Error(first.error.code);
    await call(first.value, 'POST', '/workspace', { name: 'Shop' });

    expect(await start()).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { port: first.value.port } },
    });
  });
});
