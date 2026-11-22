// The Vite runner child process with a real Vite dev server (SPEC-04 M-RN, R-RN-03, R-RN-07).
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { connect, createServer, type Server } from 'node:net';
import { join, resolve } from 'node:path';

import type { RunnerToChildMessage } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir } from '../services/workspace/test-support.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const RUNNER = join(import.meta.dirname, 'vite-react.ts');
const FIXTURE = join(REPO_ROOT, 'fixtures', 'projects', 'vite8-react19-ts');
// The fixture has no node_modules of its own; the Studio's has Vite, React and Tailwind.
const NODE_MODULES = join(REPO_ROOT, 'packages', 'studio', 'node_modules');

let root: string;
let cleanup: () => Promise<void>;
let child:
  { readonly process: ChildProcess; readonly exited: Promise<number | undefined> } | undefined;

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'string' ? 0 : (address?.port ?? 0);
      server.close(() => {
        done(port);
      });
    });
  });
}

function isListening(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => {
      done(false);
    });
  });
}

/** Gives the copied fixture its own dev port, as `server.port` in its vite.config. */
async function setProjectPort(port: number): Promise<void> {
  const file = join(root, 'vite.config.ts');
  const text = await readFile(file, 'utf8');
  await writeFile(
    file,
    text.replace(
      'defineConfig({',
      `defineConfig({
  server: { port: ${String(port)} },`,
    ),
  );
}

function occupy(port: number): Promise<Server> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => {
      done(server);
    });
  });
}

/** Starts the runner with `port` as the KumiCraft fallback port; resolves its first message. */
function startRunner(port: number, projectPort?: number): Promise<unknown> {
  const runner = spawn(process.execPath, [RUNNER], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  child = { process: runner, exited: exitCode(runner) };
  const start: RunnerToChildMessage = {
    type: 'start',
    options: {
      root,
      sourceDir: 'src',
      port,
      ...(projectPort === undefined ? {} : { projectPort }),
      nonce: 'nonce-1234567890',
      studioOrigin: 'http://127.0.0.1:4173',
      host: '127.0.0.1',
    },
  };
  const ready = nextMessage(runner);
  runner.send(start);
  return ready;
}

function nextMessage(process: ChildProcess): Promise<unknown> {
  return new Promise((done) => {
    process.once('message', done);
  });
}

function exitCode(process: ChildProcess): Promise<number | undefined> {
  return new Promise((done) => {
    process.once('exit', (code) => {
      done(code ?? undefined);
    });
  });
}

beforeEach(async () => {
  ({ dir: root, cleanup } = await makeTempDir());
  await cp(FIXTURE, root, { recursive: true });
  // Its own node_modules, packages linked: Vite's caches (node_modules/.vite*) stay in the copy.
  await mkdir(join(root, 'node_modules'));
  for (const entry of await readdir(NODE_MODULES, { withFileTypes: true })) {
    if (entry.name.startsWith('.vite') || entry.isFile()) continue;
    await symlink(
      join(NODE_MODULES, entry.name),
      join(root, 'node_modules', entry.name),
      'junction',
    );
  }
});

afterEach(async () => {
  // A runner still alive after a failed test is stopped; one that exited ignores the signal.
  if (child !== undefined) {
    child.process.kill();
    await child.exited;
    child = undefined;
  }
  await cleanup();
});

describe('vite-react runner [R-RN-03]', () => {
  it.skipIf(!existsSync(NODE_MODULES))(
    'stops Vite and exits when the server process is gone, so no dev server is left behind [R-RN-07]',
    async () => {
      const port = await freePort();
      await setProjectPort(port);

      expect(await startRunner(await freePort())).toEqual({ type: 'ready', port });
      expect(await isListening(port)).toBe(true);

      // A server killed without its shutdown (Windows ends processes at once) only closes the
      // IPC channel.
      child?.process.disconnect();

      expect(await child?.exited).toBe(0);
      expect(await isListening(port)).toBe(false);
    },
    30_000,
  );

  it.skipIf(!existsSync(NODE_MODULES))(
    "runs on the project's own port, and on the KumiCraft port when that one is taken [R-RN-04]",
    async () => {
      const projectPort = await freePort();
      await setProjectPort(projectPort);
      const busy = await occupy(projectPort);
      try {
        const fallback = await freePort();
        expect(await startRunner(fallback)).toEqual({
          type: 'ready',
          port: fallback,
          busyPort: projectPort,
        });
        expect(await isListening(fallback)).toBe(true);
      } finally {
        busy.close();
      }
    },
    30_000,
  );

  it.skipIf(!existsSync(NODE_MODULES))(
    'runs on the port the user picked over the one in vite.config [R-RN-04, R-RN-27]',
    async () => {
      await setProjectPort(await freePort());
      const picked = await freePort();

      expect(await startRunner(await freePort(), picked)).toEqual({ type: 'ready', port: picked });
    },
    30_000,
  );
});
