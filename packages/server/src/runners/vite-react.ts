// Child process runner for Vite + React projects (SPEC-04 M-RN, ADR-BE-28, R-RN-03).
// QC-52: This file is an isolated child process runner and is allowed to call process.exit().
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createReactCraftBridgePlugin } from '@reactcraft/bridge';
import type {
  RunnerOptions,
  RunnerToChildMessage,
  RunnerToParentMessage,
} from '@reactcraft/shared';

import { devServerOptions } from './vite-server-config.ts';

interface ViteDevServer {
  readonly config: { readonly server: { readonly port?: number | undefined } };
  listen(): Promise<void>;
  close(): Promise<void>;
}

interface ViteModule {
  createServer(options: unknown): Promise<ViteDevServer>;
}

interface ViteErrorInfo {
  readonly message: string;
  readonly file?: string | undefined;
  readonly line?: number | undefined;
}

function extractErrorInfo(err: unknown): ViteErrorInfo {
  if (Boolean(err) && typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    const loc = rec.loc as { file?: string; line?: number } | undefined;
    const file =
      loc?.file ??
      (typeof rec.file === 'string' ? rec.file : undefined) ??
      (typeof rec.id === 'string' ? rec.id : undefined);
    const line = loc?.line ?? (typeof rec.line === 'number' ? rec.line : undefined);
    const message =
      typeof rec.message === 'string'
        ? rec.message
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    return { message, file, line };
  }
  return { message: err instanceof Error ? err.message : 'Unknown error' };
}

function sendToParent(message: RunnerToParentMessage): void {
  if (typeof process.send === 'function') {
    process.send(message);
  }
}

let devServer: ViteDevServer | undefined;

function isViteModule(value: unknown): value is ViteModule {
  if (!value || typeof value !== 'object') return false;
  return 'createServer' in value && typeof value.createServer === 'function';
}

async function createAndListenVite(vitePath: string, options: RunnerOptions): Promise<void> {
  const viteUrl = pathToFileURL(vitePath).href;
  const rawModule: unknown = await import(viteUrl);
  if (!isViteModule(rawModule)) {
    throw new Error(`Invalid Vite module at ${vitePath}`);
  }
  const vite = rawModule;

  const bridgePlugin = createReactCraftBridgePlugin({
    rootDir: options.root,
    sourceDir: options.sourceDir,
    nonce: options.nonce,
    studioOrigin: options.studioOrigin,
  });

  const server = await vite.createServer({
    root: options.root,
    server: devServerOptions(options),
    clearScreen: false,
    plugins: [bridgePlugin],
  });

  devServer = server;
  await server.listen();

  const actualPort = server.config.server.port ?? options.port;
  sendToParent({ type: 'ready', port: actualPort });
}

async function startServer(options: RunnerOptions): Promise<void> {
  const projectPkg = join(options.root, 'package.json');
  const require = createRequire(projectPkg);

  let vitePath: string;
  try {
    vitePath = require.resolve('vite');
  } catch {
    sendToParent({
      type: 'error',
      reason: 'viteNotFound',
      message: 'Vite dependency not found in project node_modules',
    });
    process.exit(1);
    return;
  }

  try {
    await createAndListenVite(vitePath, options);
  } catch (err: unknown) {
    const info = extractErrorInfo(err);
    sendToParent({
      type: 'error',
      reason: 'config',
      message: info.message,
      file: info.file,
      line: info.line,
    });
    process.exit(1);
  }
}

async function stopServer(): Promise<void> {
  try {
    if (devServer) {
      await devServer.close();
    }
  } finally {
    process.exit(0);
  }
}

function handleMessage(raw: unknown): void {
  const msg = raw as RunnerToChildMessage | undefined;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'start') {
    void startServer(msg.options);
  } else {
    void stopServer();
  }
}

process.on('message', (raw: unknown) => {
  handleMessage(raw);
});

// The server ended without sending `stop` (killed, or the terminal closed; on Windows a kill skips
// every shutdown handler). Stop Vite like R-RN-07 so no dev server keeps running on its own.
process.on('disconnect', () => {
  void stopServer();
});

process.on('uncaughtException', (err: unknown) => {
  const info = extractErrorInfo(err);
  sendToParent({
    type: 'error',
    reason: 'config',
    message: info.message,
    file: info.file,
    line: info.line,
  });
  process.exit(1);
});
