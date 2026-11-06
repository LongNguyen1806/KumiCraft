// Tests for express-pug child runner (SPEC-04 M-RN, Phase 4 K4).
import { type ChildProcess, spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { join, resolve } from 'node:path';

import type { RunnerToChildMessage, RunnerToParentMessage } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir } from '../core/workspace/test-support.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const RUNNER_PATH = join(import.meta.dirname, 'express-pug.ts');
const FIXTURE_ROOT = join(REPO_ROOT, 'fixtures', 'projects', 'express-pug');

let child:
  { readonly process: ChildProcess; readonly exited: Promise<number | undefined> } | undefined;
let tempDir: string;
let cleanupTemp: () => Promise<void>;

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

function exitCode(proc: ChildProcess): Promise<number | undefined> {
  return new Promise((done) => {
    proc.once('exit', (code) => {
      done(code ?? undefined);
    });
  });
}

function nextMessage(proc: ChildProcess): Promise<RunnerToParentMessage> {
  return new Promise((done) => {
    proc.once('message', (msg) => {
      done(msg as RunnerToParentMessage);
    });
  });
}

function spawnRunner(
  root: string,
  extraEnv?: Record<string, string>,
): {
  process: ChildProcess;
  exited: Promise<number | undefined>;
} {
  const runner = spawn(process.execPath, [RUNNER_PATH], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: { ...process.env, ...extraEnv },
  });
  child = { process: runner, exited: exitCode(runner) };
  return child;
}

beforeEach(async () => {
  ({ dir: tempDir, cleanup: cleanupTemp } = await makeTempDir());
});

afterEach(async () => {
  if (child !== undefined) {
    child.process.kill();
    await child.exited;
    child = undefined;
  }
  await cleanupTemp();
});

describe('express-pug runner [WP-4.00]', () => {
  it('[WP-4.00] B4: Runner con chạy fixture thật: ready, GET / qua proxy có data-rc-loc, stop đóng hết; app listen(3000) cứng vẫn không chiếm cổng 3000', async () => {
    const proxyPort = await freePort();
    const { process: proc, exited } = spawnRunner(FIXTURE_ROOT);

    const startMsg: RunnerToChildMessage = {
      type: 'start',
      options: {
        root: FIXTURE_ROOT,
        sourceDir: 'views',
        port: proxyPort,
        host: '127.0.0.1',
        nonce: 'nonce-express-test',
        studioOrigin: 'http://127.0.0.1:4173',
        serverEntry: 'app.js',
        viewsDir: 'views',
      },
    };

    const readyPromise = nextMessage(proc);
    proc.send(startMsg);
    const ready = await readyPromise;

    expect(ready).toEqual({ type: 'ready', port: proxyPort });
    expect(await isListening(proxyPort)).toBe(true);

    // GET / qua proxy có data-rc-loc
    const res = await fetch(`http://127.0.0.1:${String(proxyPort)}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-rc-loc="views/index.pug:5:3"');
    expect(html).toContain('data-rc-loc="views/partials/nav.pug:1:1"');

    // App listen(3000) cứng trong app.js vẫn không chiếm cổng 3000 (đã bị bọc đổi thành cổng 0)
    expect(await isListening(3000)).toBe(false);

    // stop đóng hết
    proc.send({ type: 'stop' });
    const code = await exited;
    expect(code).toBe(0);
    expect(await isListening(proxyPort)).toBe(false);
    child = undefined;
    // Loads Pug from cold (and B4 starts a child process): slow when the whole suite runs.
  }, 30_000);

  it('[WP-4.00] B5: App không listen -> noListen; file khởi động ném lỗi -> error có thông điệp', async () => {
    // 1. App không listen -> noListen
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'no-listen', dependencies: { pug: '3.0.4' } }),
    );
    await writeFile(join(tempDir, 'app.js'), '// no listen call here\n');

    const port1 = await freePort();
    const { process: proc1, exited: exited1 } = spawnRunner(tempDir, {
      KUMICRAFT_LISTEN_TIMEOUT_MS: '600',
    });

    const msgPromise1 = nextMessage(proc1);
    proc1.send({
      type: 'start',
      options: {
        root: tempDir,
        sourceDir: 'views',
        port: port1,
        host: '127.0.0.1',
        nonce: 'nonce-1',
        studioOrigin: 'http://127.0.0.1:4173',
        serverEntry: 'app.js',
      },
    });

    const res1 = await msgPromise1;
    expect(res1.type).toBe('error');
    if (res1.type === 'error') {
      expect(res1.reason).toBe('noListen');
    }
    await exited1;
    child = undefined;

    // 2. File khởi động ném lỗi -> error có thông điệp
    await writeFile(
      join(tempDir, 'broken.js'),
      'throw new Error("Boom in express server entry!");\n',
    );

    const port2 = await freePort();
    const { process: proc2, exited: exited2 } = spawnRunner(tempDir);

    const msgPromise2 = nextMessage(proc2);
    proc2.send({
      type: 'start',
      options: {
        root: tempDir,
        sourceDir: 'views',
        port: port2,
        host: '127.0.0.1',
        nonce: 'nonce-2',
        studioOrigin: 'http://127.0.0.1:4173',
        serverEntry: 'broken.js',
      },
    });

    const res2 = await msgPromise2;
    expect(res2.type).toBe('error');
    if (res2.type === 'error') {
      expect(res2.reason).toBe('config');
      expect(res2.message).toContain('Boom in express server entry!');
    }
    await exited2;
    child = undefined;
  });
});
