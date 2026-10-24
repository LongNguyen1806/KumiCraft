// Runs the built `kumicraft` CLI the way a user does, and stops it again, so a test can close the
// Studio and come back later. Each session gets its own user settings (KUMICRAFT_CONFIG_DIR).
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './copy-fixture.ts';

const CLI_ENTRY = join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');
const AGENT_STUDIO = join(REPO_ROOT, 'e2e', 'support', 'agent-studio.ts');
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

/** Runs `node <args>` until it prints the Studio URL, and gives the test its API and a stop. */
async function startSession(args: readonly string[], env: NodeJS.ProcessEnv): Promise<CliSession> {
  const child = spawn(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
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

export async function startCli(workspaceDir: string, configDir: string): Promise<CliSession> {
  if (!existsSync(CLI_ENTRY)) throw new Error('Run `pnpm build` before the E2E tests.');
  return startSession([CLI_ENTRY, workspaceDir, '--no-open', '--log-level', 'warn'], {
    KUMICRAFT_CONFIG_DIR: configDir,
  });
}

export type AgentStudioDirs = {
  readonly config: string;
  /** Backend mirrors and chat images (envPaths cache). */
  readonly cache: string;
  /** Turn snapshots and summaries (envPaths data). */
  readonly data: string;
};

/**
 * Runs the server with the agents replaced by `fake-agent.mjs` (R-QA-12), using the built Studio.
 * `script` is the fake agent's JSON script (R-QA-11); `record` is where it writes what it received.
 */
export async function startAgentStudio(
  workspaceDir: string,
  dirs: AgentStudioDirs,
  fake: { readonly script: string; readonly record: string },
): Promise<CliSession> {
  if (!existsSync(CLI_ENTRY)) throw new Error('Run `pnpm build` before the E2E tests.');
  return startSession([AGENT_STUDIO, workspaceDir, dirs.config, dirs.cache, dirs.data], {
    RC_FAKE_AGENT_SCRIPT: fake.script,
    RC_FAKE_AGENT_RECORD: fake.record,
  });
}
