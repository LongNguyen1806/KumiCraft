// Child process runner for Express + Pug projects (SPEC-04 M-RN, Phase 4 K4).
// QC-52: This file is an isolated child process runner and is allowed to call process.exit().
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { RunnerOptions, RunnerToChildMessage, RunnerToParentMessage } from '@kumicraft/shared';

import { createBridgeProxy } from './bridge-proxy.ts';
import { installListenHook, type ListenHook } from './listen-hook.ts';
import { hookPug } from './pug-loc-plugin.ts';

interface ErrorInfo {
  readonly message: string;
  readonly file?: string | undefined;
  readonly line?: number | undefined;
}

function extractErrorInfo(err: unknown): ErrorInfo {
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

function isEsmEntry(root: string, entryPath: string): boolean {
  if (entryPath.endsWith('.mjs')) return true;
  if (entryPath.endsWith('.cjs')) return false;
  try {
    const pkgText = readFileSync(join(root, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgText) as { type?: string };
    return pkg.type === 'module';
  } catch {
    return false;
  }
}

let activeProxy: { close(): Promise<void> } | undefined;
let activeHook: ListenHook | undefined;

async function loadApp(root: string, entryPath: string): Promise<void> {
  const isEsm = isEsmEntry(root, entryPath);
  if (isEsm) {
    const fileUrl = pathToFileURL(entryPath).href;
    await import(fileUrl);
  } else {
    const projectRequire = createRequire(join(root, 'package.json'));
    projectRequire(entryPath);
  }
}

function resolveEntryPath(root: string, serverEntry?: string): string {
  const rel = serverEntry ?? 'app.js';
  return isAbsolute(rel) ? rel : join(root, rel);
}

async function startProxy(options: RunnerOptions, appPort: number): Promise<void> {
  try {
    const proxy = createBridgeProxy({
      port: options.port,
      appPort,
      nonce: options.nonce,
      studioOrigin: options.studioOrigin,
      root: options.root,
    });
    await proxy.start();
    activeProxy = proxy;
    sendToParent({ type: 'ready', port: options.port });
  } catch (err: unknown) {
    const info = extractErrorInfo(err);
    sendToParent({
      type: 'error',
      reason: 'config',
      message: info.message,
    });
    process.exit(1);
  }
}

async function startServer(options: RunnerOptions): Promise<void> {
  const entryPath = resolveEntryPath(options.root, options.serverEntry);
  if (!existsSync(entryPath)) {
    sendToParent({
      type: 'error',
      reason: 'entryNotFound',
      message: `Server entry file not found: ${entryPath}`,
    });
    process.exit(1);
    return;
  }

  hookPug(options.root);
  const timeoutMs =
    process.env.KUMICRAFT_LISTEN_TIMEOUT_MS !== undefined
      ? Number(process.env.KUMICRAFT_LISTEN_TIMEOUT_MS)
      : 20_000;
  activeHook = installListenHook(timeoutMs);
  process.env.NODE_ENV = 'development';
  process.chdir(options.root);

  try {
    await loadApp(options.root, entryPath);
  } catch (err: unknown) {
    activeHook.dispose();
    const info = extractErrorInfo(err);
    sendToParent({
      type: 'error',
      reason: 'config',
      message: info.message,
      file: info.file,
      line: info.line,
    });
    process.exit(1);
    return;
  }

  try {
    const appPort = await activeHook.portPromise;
    await startProxy(options, appPort);
  } catch (err: unknown) {
    sendToParent({
      type: 'error',
      reason: 'noListen',
      message: err instanceof Error ? err.message : 'App did not call listen within 20s',
    });
    process.exit(1);
  }
}

async function stopServer(): Promise<void> {
  try {
    activeHook?.dispose();
    if (activeProxy !== undefined) {
      await activeProxy.close();
      activeProxy = undefined;
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
