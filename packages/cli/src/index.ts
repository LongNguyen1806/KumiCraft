#!/usr/bin/env node
// Entry point of the `kumicraft` command (ADR-BE-03): start the Local Backend, open the Studio.
import { statSync } from 'node:fs';

import { lastStudioPort, type RunningServer, startServer } from '@kumicraft/server';
import open from 'open';

import packageJson from '../package.json' with { type: 'json' };
import { type CliOptions, parseCliArgs, USAGE, USAGE_EXIT_CODE } from './args.ts';
import { runMcpCommand } from './mcp/mcp-command.ts';
import { startFailureMessage } from './messages.ts';
import { findStudioDir } from './paths.ts';
import { attemptsFor, portFor, type PortPlan } from './port-choice.ts';
import { createShutdown } from './shutdown.ts';

function fail(message: string): never {
  console.error(`kumicraft: ${message}`);
  process.exit(1);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

type StudioSource = { readonly studioDir?: string; readonly devStudioUrl?: string };

async function start(options: CliOptions, studio: StudioSource): Promise<RunningServer> {
  const plan: PortPlan = {
    fixed: options.port,
    remembered: options.port === undefined ? await lastStudioPort(options.workspaceDir) : undefined,
  };
  const attempts = attemptsFor(plan);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await startServer({
      version: packageJson.version,
      port: portFor(attempt, plan),
      workspaceDir: options.workspaceDir,
      logLevel: options.logLevel,
      ...(studio.studioDir === undefined ? {} : { studioDir: studio.studioDir }),
      ...(studio.devStudioUrl === undefined ? {} : { trustedOrigins: [studio.devStudioUrl] }),
      ...(process.env.KUMICRAFT_FEATURES === undefined
        ? {}
        : { featureOverride: process.env.KUMICRAFT_FEATURES }),
      // Tests and side-by-side setups keep their settings apart from the user's (archive-0.18 spec-log #87).
      ...(process.env.KUMICRAFT_CONFIG_DIR === undefined
        ? {}
        : { deps: { configDir: process.env.KUMICRAFT_CONFIG_DIR } }),
    });
    if (result.ok) return result.value;
    const isPortBusy = result.error.code === 'E002' && result.error.params?.['step'] === 'listen';
    if (!isPortBusy || attempt === attempts) {
      fail(startFailureMessage(result.error, options.workspaceDir));
    }
  }
  return fail('could not find a free port.');
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2), process.cwd());
  if (!parsed.ok) {
    console.error(`kumicraft: ${parsed.message}

${USAGE}`);
    process.exit(USAGE_EXIT_CODE);
  }
  if ('show' in parsed) {
    console.log(parsed.show === 'help' ? USAGE : packageJson.version);
    return;
  }
  if ('mcp' in parsed) {
    await runMcpCommand(parsed.mcp, packageJson.version);
    return;
  }
  await serve(parsed.options);
}

async function serve(options: CliOptions): Promise<void> {
  if (!isDirectory(options.workspaceDir)) fail(`not a directory: ${options.workspaceDir}`);

  // Development only (`pnpm dev`): the Studio comes from the Vite dev server, which proxies the API.
  const devStudioUrl = process.env.KUMICRAFT_DEV_STUDIO_URL;
  const studioDir = devStudioUrl === undefined ? findStudioDir() : undefined;
  if (devStudioUrl === undefined && studioDir === undefined) {
    console.warn('kumicraft: the Studio has not been built; serving the API only.');
  }

  const server = await start(options, {
    ...(studioDir === undefined ? {} : { studioDir }),
    ...(devStudioUrl === undefined ? {} : { devStudioUrl }),
  });
  // The token travels in the URL fragment, which browsers never send to a server (SPEC-05 section 3).
  const studioUrl = `${devStudioUrl ?? server.url}/#t=${server.sessionToken}`;
  console.log(`KumiCraft ${packageJson.version} is running at ${server.url}`);
  console.log(`Studio: ${studioUrl}`);
  console.log('Press Ctrl+C to stop.');

  const stop = createShutdown({
    close: () => server.close(),
    exit: (code) => {
      process.exit(code);
    },
    log: (line) => {
      console.log(line);
    },
    warn: (line) => {
      console.warn(line);
    },
  });
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());

  if (options.shouldOpen) {
    try {
      await open(studioUrl);
    } catch (error) {
      console.warn(
        `kumicraft: could not open a browser (${String(error)}); open the Studio URL above.`,
      );
    }
  }
}

await main();
