// Child process runner for Vite + React projects (SPEC-04 M-RN, ADR-BE-28, R-RN-03).
// QC-52: This file is an isolated child process runner and is allowed to call process.exit().
import { readFile, utimes } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createKumiCraftBridgePlugin } from '@kumicraft/bridge';
import type { RunnerOptions, RunnerToChildMessage, RunnerToParentMessage } from '@kumicraft/shared';

import { devScriptPort, portInMessage } from './dev-script-port.ts';
import { resolveViteEntry } from './vite-entry.ts';
import { devServerOptions } from './vite-server-config.ts';

interface ViteDevServer {
  readonly httpServer?: { address(): unknown } | undefined;
  /** Vite's file watcher; a `change` emitted on it makes Vite read the file again. */
  readonly watcher?: { emit(event: string, path: string): boolean } | undefined;
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

/** Vite throws this when `strictPort` is set and the port is taken. */
const isPortTaken = (err: unknown): boolean =>
  err instanceof Error && /already in use/i.test(err.message);

function listeningPort(server: ViteDevServer): number | undefined {
  const address = server.httpServer?.address();
  return address instanceof Object && 'port' in address && typeof address.port === 'number'
    ? address.port
    : undefined;
}

async function listenVite(
  vite: ViteModule,
  options: RunnerOptions,
  port: number | undefined,
): Promise<ViteDevServer> {
  const server = await vite.createServer({
    root: options.root,
    server: devServerOptions(options, port),
    clearScreen: false,
    plugins: [
      createKumiCraftBridgePlugin({
        rootDir: options.root,
        sourceDir: options.sourceDir,
        nonce: options.nonce,
        studioOrigin: options.studioOrigin,
        draftsDir: options.draftsDir,
        globalCss: options.globalCss,
      }),
    ],
  });
  try {
    await server.listen();
  } catch (err: unknown) {
    await server.close();
    throw err;
  }
  return server;
}

/** The port the user picked, else the one in the `dev` script; undefined: Vite's config decides. */
async function wantedPort(options: RunnerOptions): Promise<number | undefined> {
  if (options.projectPort !== undefined) return options.projectPort;
  try {
    const text = await readFile(join(options.root, 'package.json'), 'utf8');
    return devScriptPort(JSON.parse(text));
  } catch {
    return undefined; // no readable package.json: Vite's config decides
  }
}

async function createAndListenVite(vitePath: string, options: RunnerOptions): Promise<void> {
  const viteUrl = pathToFileURL(vitePath).href;
  const rawModule: unknown = await import(viteUrl);
  if (!isViteModule(rawModule)) {
    throw new Error(`Invalid Vite module at ${vitePath}`);
  }

  // R-RN-04: the project's own port first, so a backend that only allows that origin (CORS) and
  // the logins the browser saved for it work in the Canvas as with `npm run dev`.
  const wanted = await wantedPort(options);
  let server: ViteDevServer;
  let busyPort: number | undefined;
  try {
    server = await listenVite(rawModule, options, wanted);
  } catch (err: unknown) {
    if (!isPortTaken(err)) throw err;
    busyPort = wanted ?? (err instanceof Error ? portInMessage(err.message) : undefined);
    console.warn(
      `[kumicraft] Port ${String(busyPort)} of the project is in use (is \`npm run dev\` still running?), so the Canvas uses port ${String(options.port)}. A backend that only allows the project's port will refuse its requests.`,
    );
    server = await listenVite(rawModule, options, options.port);
  }

  devServer = server;
  sendToParent({
    type: 'ready',
    port: listeningPort(server) ?? options.port,
    ...(busyPort === undefined ? {} : { busyPort }),
  });
}

async function startServer(options: RunnerOptions): Promise<void> {
  const projectPkg = join(options.root, 'package.json');
  const require = createRequire(projectPkg);

  let vitePath: string;
  try {
    vitePath = resolveViteEntry(require);
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

/**
 * K9.5: Vite's watcher can miss the second of two quick writes of one file, and Tailwind's plugin
 * rebuilds a CSS file only when its time stamp moved on. Both writes can carry the same stamp, so
 * the stamp is set to now (the content is not touched) before Vite is told to read the file again.
 */
async function rereadFiles(files: readonly string[]): Promise<void> {
  for (const file of files) {
    const now = new Date();
    try {
      await utimes(file, now, now);
    } catch {
      continue; // deleted since: Vite already saw that
    }
    devServer?.watcher?.emit('change', file);
  }
}

function handleMessage(raw: unknown): void {
  const msg = raw as RunnerToChildMessage | undefined;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'start') {
    void startServer(msg.options);
  } else if (msg.type === 'filesWritten') {
    void rereadFiles(msg.files);
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
