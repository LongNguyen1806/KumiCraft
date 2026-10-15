// POST /api/v1/open-in-editor (SPEC-03 section 5.1, R-SL-06, S-50, S-51).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ProcessPort } from '../../../core/ports/process-port.ts';
import type { Editor } from '../../../core/project/open-in-editor.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { makeTempDir, nodeFs } from '../../../core/workspace/test-support.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50241;
const TOKEN = 'test-token-editor';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

type Spawned = { command: string; args: readonly string[]; cwd: string };

let app: FastifyInstance;
let dir: string;
let cleanup: () => Promise<void>;
let spawned: Spawned[];
let exitCode: number;
let editor: Editor;
let root: string | undefined;

const fakeProcess: ProcessPort = {
  spawn: (command, args, options) => {
    spawned.push({ command, args, cwd: options.cwd });
    return {
      onLine: () => undefined,
      wait: () => Promise.resolve({ exitCode, stdout: '', stderr: '', lines: [] }),
      kill: () => Promise.resolve(),
    };
  },
};

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  await mkdir(join(dir, 'src', 'pages'), { recursive: true });
  await writeFile(join(dir, 'src', 'pages', 'Home.tsx'), 'export const Home = () => <main />;\n');
  spawned = [];
  exitCode = 0;
  editor = 'vscode';
  root = dir;
  app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
    getSessionInfo: createSessionInfoProvider({
      version: '1.0.0',
      platform: 'linux',
      features: [],
      readProject: () => ({ state: 'none' }),
    }),
    editorRoutes: {
      fs: nodeFs,
      process: fakeProcess,
      platform: 'linux',
      editor: () => editor,
      getProjectRoot: () => root,
    },
  });
});

afterEach(async () => {
  await app.close();
  await cleanup();
});

const open = (loc: unknown) =>
  app.inject({ method: 'POST', url: '/api/v1/open-in-editor', headers: HEADERS, payload: { loc } });

describe('POST /api/v1/open-in-editor', () => {
  it('starts the chosen editor at the absolute file, line and column, with an argument array [R-SL-06, S-51]', async () => {
    const res = await open('src/pages/Home.tsx:1:27');

    expect(res.statusCode).toBe(204);
    expect(spawned).toEqual([
      { command: 'code', args: ['-g', `${dir}/src/pages/Home.tsx:1:27`], cwd: dir },
    ]);
  });

  it('uses the command line of each editor of Settings', async () => {
    for (const choice of ['cursor', 'webstorm', 'zed'] as const) {
      editor = choice;
      await open('src/pages/Home.tsx:3:5');
    }

    const file = `${dir}/src/pages/Home.tsx`;
    expect(spawned.map((s) => [s.command, ...s.args])).toEqual([
      ['cursor', '-g', `${file}:3:5`],
      ['webstorm', '--line', '3', '--column', '5', file],
      ['zed', `${file}:3:5`],
    ]);
  });

  it('answers E021 editor when the command is not installed', async () => {
    exitCode = 127;

    const res = await open('src/pages/Home.tsx:1:1');

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: { code: 'E021', params: { missing: 'editor', editor: 'vscode' } },
    });
  });

  it('refuses paths leaving the project, missing files, bad locations and no project', async () => {
    const outside = await open('../secret.tsx:1:1');
    const missing = await open('src/pages/Nope.tsx:1:1');
    const bad = await open('src/pages/Home.tsx');
    root = undefined;
    const noProject = await open('src/pages/Home.tsx:1:1');

    expect([outside, missing, bad, noProject].map((r) => r.statusCode)).toEqual([
      400, 404, 400, 409,
    ]);
    expect(spawned).toEqual([]);
  });
});
