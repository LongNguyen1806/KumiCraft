// REST routes of the tool gaps and the page tree (R-AG-19, R-AG-20, round 7a).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ProjectInfo } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { err, ok, type Result } from '../../../kernel/result.ts';
import { createSessionInfoProvider } from '../../../kernel/session.ts';
import { makeTestProjectInfo } from '../../../services/agent/test-support.ts';
import { createToolGapStore } from '../../../services/agent/tool-gaps.ts';
import { testClassEdits } from '../../../services/edit/class-edits-test-support.ts';
import { makeTempDir, nodeFs, silentLogger } from '../../../services/workspace/test-support.ts';
import { jsxFeatures } from '../../../stacks/view/jsx/features.ts';
import { createSourceEditorService } from '../../../stacks/view/jsx/source-editor-service.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50311;
const TOKEN = 'test-token-tool-gap-routes';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

let dir: string;
let cleanup: () => Promise<void>;
let app: FastifyInstance;
let project: Result<ProjectInfo>;
let projectRoot: string | undefined;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  project = ok(makeTestProjectInfo(dir));
  projectRoot = dir;
  app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
    getSessionInfo: createSessionInfoProvider({
      version: '1.0.0',
      platform: 'linux',
      features: [],
      readProject: () => ({ state: 'none' }),
    }),
    toolGapRoutes: {
      store: createToolGapStore({ fs: nodeFs, logger: silentLogger, now: () => new Date() }),
      getProjectInfo: () => project,
    },
    sourceRoutes: {
      sourceEditorService: createSourceEditorService({ fs: nodeFs }),
      classEdits: testClassEdits(),
      historyService: createHistoryService({ fs: nodeFs }),
      getProjectRoot: () => projectRoot,
      getViewFeatures: () => jsxFeatures,
      fs: nodeFs,
    },
  });
});

afterEach(async () => {
  await app.close();
  await cleanup();
});

const post = (body: unknown) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/tool-gaps',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
const get = (url: string) => app.inject({ method: 'GET', url: `/api/v1/${url}`, headers: HEADERS });
const errorCode = (body: string): unknown =>
  (JSON.parse(body) as { error?: { code?: unknown } }).error?.code;

describe('tool gap routes [R-AG-20]', () => {
  it('records a report and lists it [R-AG-20]', async () => {
    const created = await post({ need: 'Set text color', why: 'no tool', example: 'red' });
    const listed = await get('tool-gaps');

    expect(created.statusCode).toBe(201);
    expect(listed.statusCode).toBe(200);
    expect(JSON.parse(listed.body)).toMatchObject({ data: [{ need: 'Set text color', count: 1 }] });
  });

  it('refuses an untrusted project, no project and a bad report [R-AG-20]', async () => {
    project = ok(makeTestProjectInfo(dir, { trusted: false }));
    expect(errorCode((await get('tool-gaps')).body)).toBe('E011');
    expect(errorCode((await post({ need: 'x', why: '', example: '' })).body)).toBe('E011');

    project = err({ code: 'E021', params: { missing: 'project' } });
    expect(errorCode((await get('tool-gaps')).body)).toBe('E021');

    project = ok(makeTestProjectInfo(dir));
    expect(errorCode((await post({ need: '', why: '', example: '' })).body)).toBe('E016');
  });
});

describe('page tree route [R-AG-19]', () => {
  it('serves the tree of a file and checks its query [R-AG-19]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'A.tsx'), 'export const A = () => <div><p>Hi</p></div>;\n');

    const tree = await get('source/tree?file=src%2FA.tsx&maxDepth=1');
    const noFile = await get('source/tree');
    projectRoot = undefined;
    const noProject = await get('source/tree?file=src%2FA.tsx');

    expect(tree.statusCode).toBe(200);
    expect(JSON.parse(tree.body)).toMatchObject({
      data: { file: 'src/A.tsx', roots: [{ tag: 'div', children: [] }], truncated: true },
    });
    expect(errorCode(noFile.body)).toBe('E016');
    expect(errorCode(noProject.body)).toBe('E021');
  });
});
