// Playwright fixture: runs the built `reactcraft` CLI on a temporary workspace and hands the test
// the Studio URL with its session token, read from the terminal output as a user would.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { test as base } from '@playwright/test';

import { makeTempDir, REPO_ROOT } from './copy-fixture.ts';

const CLI_ENTRY = join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');
const START_TIMEOUT_MS = 15_000;

export type StudioServer = {
  /** `http://127.0.0.1:<port>/#t=<token>`, as printed by the CLI. */
  readonly studioUrl: string;
  /** The same URL without the token. */
  readonly origin: string;
};

export const test = base.extend<{ studio: StudioServer }>({
  studio: async ({ browserName }, use) => {
    if (!existsSync(CLI_ENTRY)) throw new Error('Run `pnpm build` before the E2E tests.');
    const workspace = await makeTempDir(`e2e-${browserName}`);
    // Each test gets its own user settings: never the developer's, never another test's.
    const config = await makeTempDir(`e2e-config-${browserName}`);
    const child = spawn(
      process.execPath,
      [CLI_ENTRY, workspace.path, '--no-open', '--log-level', 'warn'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, REACTCRAFT_CONFIG_DIR: config.path },
      },
    );

    const studioUrl = await new Promise<string>((resolve, reject) => {
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
      child.stdout.on('data', collect);
      child.stderr.on('data', collect);
      child.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`The CLI exited with code ${String(code)}:\n${output}`));
      });
    });

    await use({ studioUrl, origin: new URL(studioUrl).origin });

    child.kill();
    await workspace.remove();
    await config.remove();
  },
});

export { expect } from '@playwright/test';
