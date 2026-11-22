// Runner child process for Next.js projects (03b section 1.2): the project's own Next dev server on
// an inner port, with the stamping loader added to its config, behind the Bridge proxy (the same as
// for Express) that puts the Bridge into every page and forwards the HMR WebSocket.
import { existsSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type RunnerOptions,
  RunnerToChildMessageSchema,
  type RunnerToParentMessage,
} from '@kumicraft/shared';

import { createBridgeProxy } from './bridge-proxy.ts';
import { hookNextConfig } from './next-config.ts';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => unknown;
type NextApp = {
  prepare(): Promise<void>;
  getRequestHandler(): Handler;
  getUpgradeHandler?: () => (req: http.IncomingMessage, socket: unknown, head: Buffer) => unknown;
};

const isNextApp = (value: unknown): value is NextApp =>
  typeof value === 'object' &&
  Boolean(value) &&
  typeof Reflect.get(Object(value), 'prepare') === 'function' &&
  typeof Reflect.get(Object(value), 'getRequestHandler') === 'function';

let closeAll: (() => Promise<void>) | undefined;

function sendToParent(message: RunnerToParentMessage): void {
  if (typeof process.send === 'function') process.send(message);
}

function fail(reason: 'nextNotFound' | 'config', message: string): void {
  sendToParent({ type: 'error', reason, message });
  process.exit(1);
}

/** The built loader next to this file, or its source when the server runs from the repository. */
function loaderPath(): string {
  const built = fileURLToPath(new URL('./next-loader.cjs', import.meta.url));
  return existsSync(built) ? built : fileURLToPath(new URL('./next-loader.ts', import.meta.url));
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? (address satisfies AddressInfo).port : 0);
    });
  });
}

/** Next's factory from the project: `next()` in CommonJS, or its `default`. */
function nextFactory(root: string): (options: object) => unknown {
  const projectRequire = createRequire(join(root, 'package.json'));
  const mod: unknown = projectRequire('next');
  const factory: unknown = typeof mod === 'function' ? mod : Reflect.get(Object(mod), 'default');
  if (typeof factory !== 'function') throw new Error('next() was not found in the next package');
  return (options) => {
    const app: unknown = Reflect.apply(factory, undefined, [options]);
    return app;
  };
}

async function startNext(
  options: RunnerOptions,
  server: http.Server,
  port: number,
): Promise<NextApp> {
  const app = nextFactory(options.root)({
    dev: true,
    dir: options.root,
    hostname: '127.0.0.1',
    port,
  });
  if (!isNextApp(app)) throw new Error('next() did not return an app');
  await app.prepare();
  const handle = app.getRequestHandler();
  server.on(
    'request',
    (req: http.IncomingMessage, res: http.ServerResponse) => void handle(req, res),
  );
  const upgrade = app.getUpgradeHandler?.();
  if (upgrade !== undefined)
    server.on('upgrade', (req, socket, head) => void upgrade(req, socket, head));
  return app;
}

async function startServer(options: RunnerOptions): Promise<void> {
  try {
    createRequire(join(options.root, 'package.json')).resolve('next');
  } catch {
    fail('nextNotFound', 'Next.js was not found in the project node_modules');
    return;
  }
  process.env['KUMICRAFT_STAMP_ROOT'] = options.root;
  process.env['KUMICRAFT_STAMP_SOURCE_DIR'] = options.sourceDir;
  const stamped = hookNextConfig(loaderPath());
  process.chdir(options.root);
  try {
    const server = http.createServer();
    const appPort = await listen(server);
    await startNext(options, server, appPort);
    if (!stamped()) {
      // Next moved its config module: pages run but carry no stamp (03b section 1.2).
      console.error('[kumicraft] Next.js config was not wrapped: elements cannot be selected');
    }
    const proxy = createBridgeProxy({ ...options, appPort });
    await proxy.start();
    closeAll = async () => {
      await proxy.close();
      server.close();
    };
    sendToParent({ type: 'ready', port: options.port });
  } catch (error: unknown) {
    fail('config', error instanceof Error ? error.message : String(error));
  }
}

async function stopServer(): Promise<void> {
  try {
    await closeAll?.();
  } finally {
    process.exit(0);
  }
}

process.on('message', (raw: unknown) => {
  const msg = RunnerToChildMessageSchema.safeParse(raw);
  if (!msg.success) return;
  if (msg.data.type === 'start') void startServer(msg.data.options);
  else if (msg.data.type === 'stop') void stopServer();
});

process.on('disconnect', () => {
  void stopServer();
});
