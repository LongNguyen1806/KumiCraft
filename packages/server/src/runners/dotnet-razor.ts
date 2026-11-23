// Runner child process for ASP.NET Razor Pages and MVC (docs/architecture/03c sections 2.4, 3.1):
// a stamped copy of the project in obj/kumicraft/shadow, run by `dotnet watch` on an inner port,
// behind the Bridge proxy. The project's files are watched; each change is copied (and stamped)
// into the copy, which `dotnet watch` reloads. The user's files are never written here.
import { type ChildProcess, spawn } from 'node:child_process';
import { watch } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { stripVTControlCharacters } from 'node:util';

import {
  type RunnerOptions,
  RunnerToChildMessageSchema,
  type RunnerToParentMessage,
} from '@kumicraft/shared';

import { createBridgeProxy } from './bridge-proxy.ts';
import { killTree, startCssWatch } from './css-watch.ts';
import {
  buildRazorHelper,
  findDotnetSdk,
  helperCacheDir,
  type RazorHelper,
  razorHelperSource,
  startRazorHelper,
} from './razor/helper.ts';
import { createServedPage } from './razor/served-page.ts';
import { createShadow, shadowRel, syncShadowFile } from './razor/shadow.ts';

const READY_TIMEOUT_MS = 300_000;
const SYNC_DELAY_MS = 30;
const BUILD_FAILURE_SETTLE_MS = 400;
const BUILD_FAILED_AT = /\bBuild FAILED\./;
const WATCH_WAITING = /Waiting for a file to change/;

export function cleanDotnetOutput(raw: string): string {
  return stripVTControlCharacters(raw).trim();
}

export function detectDotnetBuildFailure(output: string): 'waiting' | 'failed' | undefined {
  const plain = stripVTControlCharacters(output);
  if (WATCH_WAITING.test(plain)) return 'waiting';
  if (BUILD_FAILED_AT.test(plain)) return 'failed';
  return undefined;
}

let closeAll: (() => Promise<void>) | undefined;

function sendToParent(message: RunnerToParentMessage): void {
  if (typeof process.send === 'function') process.send(message);
}

function fail(reason: 'dotnetNotFound' | 'config' | 'noListen', message: string): void {
  sendToParent({ type: 'error', reason, message });
  process.exit(1);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

/** Files whose change is compiled by dotnet (the page's HTML changes once it is applied). */
const COMPILED = /\.(cshtml|cs|csproj|props|targets)$/i;

/**
 * Copies each changed project file into the copy, a few ms after its last change, then tells
 * `synced` (with whether dotnet compiles it). A file that cannot be copied leaves the copy as it was.
 */
function watchProject(
  root: string,
  helper: RazorHelper,
  synced: (compiled: boolean) => void,
): () => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const sync = async (rel: string) => {
    try {
      await syncShadowFile(root, rel, helper);
      synced(COMPILED.test(rel));
    } catch (cause: unknown) {
      console.error(`[kumicraft] could not copy ${rel}:`, cause);
    }
  };
  const watcher = watch(root, { recursive: true }, (_event, name) => {
    const rel = name ? shadowRel(root, name) : undefined;
    if (rel === undefined) return;
    clearTimeout(timers.get(rel));
    timers.set(
      rel,
      setTimeout(() => {
        timers.delete(rel);
        void sync(rel);
      }, SYNC_DELAY_MS),
    );
  });
  return () => {
    watcher.close();
    for (const timer of timers.values()) clearTimeout(timer);
  };
}

async function answers(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${String(port)}/`);
    return true;
  } catch {
    return false;
  }
}

async function waitForDotnetReady(
  child: ChildProcess,
  port: number,
  getOutput: () => string,
): Promise<void> {
  let failedAt: number | undefined;
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT_MS) {
    if (typeof child.exitCode === 'number') throw new Error(cleanDotnetOutput(getOutput()));
    const failure = detectDotnetBuildFailure(getOutput());
    if (failure === 'waiting') {
      killTree(child);
      throw new Error(cleanDotnetOutput(getOutput()));
    }
    if (failure === 'failed') {
      failedAt ??= Date.now();
      if (Date.now() - failedAt >= BUILD_FAILURE_SETTLE_MS) {
        killTree(child);
        throw new Error(cleanDotnetOutput(getOutput()));
      }
    }
    if (await answers(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  killTree(child);
  throw new Error(`The app did not answer in time.\n${cleanDotnetOutput(getOutput())}`);
}

/** `dotnet watch run` in the copy; resolves once the app answers on `port`. */
async function startDotnet(shadow: string, project: string, port: number): Promise<ChildProcess> {
  const child = spawn(
    'dotnet',
    [
      'watch',
      '--project',
      project,
      'run',
      '--non-interactive',
      '--urls',
      `http://127.0.0.1:${String(port)}`,
    ],
    {
      cwd: shadow,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER: '1',
        DOTNET_WATCH_RESTART_ON_RUDE_EDIT: '1',
        ASPNETCORE_ENVIRONMENT: 'Development',
      },
    },
  );
  let output = '';
  const keep = (stream: NodeJS.WriteStream) => (chunk: Buffer) => {
    stream.write(chunk);
    output = (output + chunk.toString()).slice(-8000);
  };
  child.stdout.on('data', keep(process.stdout));
  child.stderr.on('data', keep(process.stderr));
  await waitForDotnetReady(child, port, () => output);
  return child;
}

async function startServer(options: RunnerOptions): Promise<void> {
  const sdk = await findDotnetSdk();
  if (sdk === undefined) {
    fail('dotnetNotFound', 'No .NET SDK was found (dotnet --list-sdks)');
    return;
  }
  const project = options.serverEntry ?? '.';
  let helper: RazorHelper | undefined;
  let stopWatch: (() => void) | undefined;
  let stopCss: (() => void) | undefined;
  try {
    const dll = await buildRazorHelper(razorHelperSource(), helperCacheDir(options.root), sdk);
    helper = startRazorHelper(dll, options.root);
    const shadow = await createShadow(options.root, helper);
    const appPort = await freePort();
    // The Canvas reloads once dotnet serves the change (03c section 3.3).
    const served = createServedPage(appPort, () => {
      sendToParent({ type: 'pageChanged' });
    });
    stopWatch = watchProject(options.root, helper, (compiled) => {
      served.changed(compiled);
    });
    stopCss = startCssWatch(options.root);
    const dotnet = await startDotnet(shadow, project, appPort);
    const proxy = createBridgeProxy({
      ...options,
      appPort,
      onPage: (path, html) => {
        served.seen(path, html);
      },
    });
    await proxy.start();
    const activeHelper = helper;
    const activeWatch = stopWatch;
    const activeCss = stopCss;
    closeAll = async () => {
      activeWatch();
      activeCss();
      activeHelper.close();
      killTree(dotnet);
      await proxy.close();
    };
    sendToParent({ type: 'ready', port: options.port });
  } catch (error: unknown) {
    stopWatch?.();
    stopCss?.();
    helper?.close();
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

if (
  process.argv[1] !== undefined &&
  /(?:^|[\\/])dotnet-razor\.(?:ts|js|mjs|cjs)$/.test(process.argv[1])
) {
  process.on('message', (raw: unknown) => {
    const msg = RunnerToChildMessageSchema.safeParse(raw);
    if (!msg.success) return;
    if (msg.data.type === 'start') void startServer(msg.data.options);
    else if (msg.data.type === 'stop') void stopServer();
  });

  process.on('disconnect', () => {
    void stopServer();
  });
}
