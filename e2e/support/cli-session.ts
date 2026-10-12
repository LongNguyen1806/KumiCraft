// Runs the built `reactcraft` CLI the way a user does, and stops it again, so a test can close the
// Studio and come back later. Each session gets its own user settings (REACTCRAFT_CONFIG_DIR).
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './copy-fixture.ts';

const CLI_ENTRY = join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');
const START_TIMEOUT_MS = 15_000;

export type CliSession = {
  /** `http://127.0.0.1:<port>/#t=<token>`, as printed by the CLI. */
  readonly studioUrl: string;
  readonly origin: string;
  /** Calls the API of this session with its token. */
  readonly api: (path: string, method?: string, body?: unknown) => Promise<unknown>;
  /** Stops the CLI as Ctrl+C would and waits for it to exit. */
  readonly stop: () => Promise<void>;
};

function waitForUrl(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      reject(new Error(`The CLI did not start in time:\n${output}`));
    }, START_TIMEOUT_MS);
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      const url = /Studio: (\S+)/.exec(output)?.[1];
      if (url !== undefined) {
        clearTimeout(timer);
        resolve(url);
      }
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`The CLI exited with code ${String(code)}:\n${output}`));
    });
  });
}

export async function startCli(workspaceDir: string, configDir: string): Promise<CliSession> {
  if (!existsSync(CLI_ENTRY)) throw new Error('Run `pnpm build` before the E2E tests.');
  const child = spawn(
    process.execPath,
    [CLI_ENTRY, workspaceDir, '--no-open', '--log-level', 'warn'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, REACTCRAFT_CONFIG_DIR: configDir },
    },
  );
  // Resolves once, however many times the test stops the session.
  const exited = new Promise<void>((resolve) => {
    child.on('exit', () => {
      resolve();
    });
  });
  let stopOnce: Promise<void> | undefined;
  const stop = () => {
    stopOnce ??= (async () => {
      child.kill('SIGINT');
      await exited;
    })();
    return stopOnce;
  };
  const studioUrl = await waitForUrl(child);
  const url = new URL(studioUrl);
  const token = url.hash.slice('#t='.length);
  return {
    studioUrl,
    origin: url.origin,
    api: async (path, method = 'GET', body) => {
      const response = await fetch(`${url.origin}/api/v1/${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return (await response.json()) as unknown;
    },
    stop,
  };
}
