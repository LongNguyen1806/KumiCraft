// The Vite runner child process with a real Vite dev server (SPEC-04 M-RN, R-RN-03, R-RN-07).
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, symlink } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { join, resolve } from 'node:path';

import type { RunnerToChildMessage } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir } from '../core/workspace/test-support.ts';

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
      const runner = spawn(process.execPath, [RUNNER], {
        cwd: root,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      const exited = exitCode(runner);
      child = { process: runner, exited };
      const start: RunnerToChildMessage = {
        type: 'start',
        options: {
          root,
          sourceDir: 'src',
          port,
          nonce: 'nonce-1234567890',
          studioOrigin: 'http://127.0.0.1:4173',
          host: '127.0.0.1',
        },
      };

      const ready = nextMessage(runner);
      runner.send(start);
      expect(await ready).toEqual({ type: 'ready', port });
      expect(await isListening(port)).toBe(true);

      // A server killed without its shutdown (Windows ends processes at once) only closes the
      // IPC channel.
      runner.disconnect();

      expect(await exited).toBe(0);
      expect(await isListening(port)).toBe(false);
    },
    30_000,
  );
});
