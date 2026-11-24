// Child process runner for Express + Pug projects (SPEC-04 M-RN, Phase 4 K4).
// QC-52: This file is an isolated child process runner and is allowed to call process.exit().
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  type RunnerOptions,
  RunnerToChildMessageSchema,
  type RunnerToParentMessage,
} from '@kumicraft/shared';

import { createBridgeProxy } from './bridge-proxy.ts';
import { startCssWatch } from './css-watch.ts';
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
let stopCss: (() => void) | undefined;
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

function collectPublicCssLinks(root: string): string {
  const links: string[] = [];
  for (const dir of ['public', 'public/css', 'public/stylesheets']) {
    const absDir = join(root, dir);
    if (!existsSync(absDir)) continue;
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.css') || entry.name.endsWith('.min.css')) {
        continue;
      }
      const sub = dir === 'public' ? '' : `${dir.slice('public/'.length)}/`;
      links.push(`<link rel="stylesheet" href="/${sub}${entry.name}">`);
    }
  }
  return links.join('\n');
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function renderPugDraft(
  root: string,
  relFile: string,
): { readonly status: number; readonly html: string } | undefined {
  const norm = relFile.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!norm.endsWith('.pug') || norm.includes('..')) return undefined;
  const absRoot = resolve(root);
  const absFile = resolve(absRoot, norm);
  const relCheck = relative(absRoot, absFile).replaceAll('\\', '/');
  if (
    relCheck === '' ||
    relCheck.startsWith('..') ||
    isAbsolute(relCheck) ||
    !existsSync(absFile)
  ) {
    return undefined;
  }
  try {
    const projectRequire = createRequire(join(root, 'package.json'));
    const pug = projectRequire('pug') as {
      renderFile(path: string, opts?: Record<string, unknown>): string;
    };
    const body = pug.renderFile(absFile, { basedir: join(root, 'views'), filename: absFile });
    if (/<html[\s>]/i.test(body)) {
      return { status: 200, html: body };
    }
    const cssLinks = collectPublicCssLinks(root);
    return {
      status: 200,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${cssLinks}</head><body>${body}</body></html>`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 200,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre style="padding:16px;font-family:monospace;color:#b91c1c">${escapeHtml(msg)}</pre></body></html>`,
    };
  }
}

async function startProxy(options: RunnerOptions, appPort: number): Promise<void> {
  try {
    const proxy = createBridgeProxy({
      port: options.port,
      appPort,
      nonce: options.nonce,
      studioOrigin: options.studioOrigin,
      root: options.root,
      renderDraft: (file) => renderPugDraft(options.root, file),
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
  // A Tailwind app's own `--watch` script builds the classes KumiCraft writes (03d section 0).
  stopCss = startCssWatch(options.root);
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
    stopCss?.();
    if (activeProxy !== undefined) {
      await activeProxy.close();
      activeProxy = undefined;
    }
  } finally {
    process.exit(0);
  }
}

function handleMessage(raw: unknown): void {
  const msg = RunnerToChildMessageSchema.safeParse(raw);
  if (!msg.success) return;
  if (msg.data.type === 'start') void startServer(msg.data.options);
  else if (msg.data.type === 'stop') void stopServer();
  // `filesWritten` (a file KumiCraft wrote twice in a row): Express renders views on each request,
  // so there is nothing to read again. It must not stop the app (it did, once views were editable).
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
