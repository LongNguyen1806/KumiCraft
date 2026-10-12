#!/usr/bin/env node
// Entry point of the `reactcraft` command (ADR-BE-03): start the Local Backend, open the Studio.
import { statSync } from 'node:fs';

import { lastStudioPort, type RunningServer, startServer } from '@reactcraft/server';
import open from 'open';

import packageJson from '../package.json' with { type: 'json' };
import { type CliOptions, parseCliArgs } from './args.ts';
import { startFailureMessage } from './messages.ts';
import { findStudioDir } from './paths.ts';
import { attemptsFor, portFor, type PortPlan } from './port-choice.ts';

function fail(message: string): never {
  console.error(`reactcraft: ${message}`);
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
      ...(process.env.REACTCRAFT_FEATURES === undefined
        ? {}
        : { featureOverride: process.env.REACTCRAFT_FEATURES }),
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
  if (!parsed.ok) fail(parsed.message);
  const { options } = parsed;
  if (!isDirectory(options.workspaceDir)) fail(`not a directory: ${options.workspaceDir}`);

  // Development only (`pnpm dev`): the Studio comes from the Vite dev server, which proxies the API.
  const devStudioUrl = process.env.REACTCRAFT_DEV_STUDIO_URL;
  const studioDir = devStudioUrl === undefined ? findStudioDir() : undefined;
  if (devStudioUrl === undefined && studioDir === undefined) {
    console.warn('reactcraft: the Studio has not been built; serving the API only.');
  }

  const server = await start(options, {
    ...(studioDir === undefined ? {} : { studioDir }),
    ...(devStudioUrl === undefined ? {} : { devStudioUrl }),
  });
  // The token travels in the URL fragment, which browsers never send to a server (SPEC-05 section 5.2).
  const studioUrl = `${devStudioUrl ?? server.url}/#t=${server.sessionToken}`;
  console.log(`ReactCraft ${packageJson.version} is running at ${server.url}`);
  console.log(`Studio: ${studioUrl}`);
  console.log('Press Ctrl+C to stop.');

  let isStopping = false;
  const stop = async () => {
    if (isStopping) return;
    isStopping = true;
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());

  if (options.shouldOpen) {
    try {
      await open(studioUrl);
    } catch (error) {
      console.warn(
        `reactcraft: could not open a browser (${String(error)}); open the Studio URL above.`,
      );
    }
  }
}

await main();
