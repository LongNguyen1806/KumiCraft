// The options a server starts with, its initialized context and its child-process scripts.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { AgentId } from '@kumicraft/shared';
import type { Logger } from 'pino';

import type { LogLevel } from './adapters/http/create-http-app.ts';
import { type Platform } from './kernel/session.ts';
import { type EventBusPort } from './ports/event-bus-port.ts';
import type { FileSystemPort } from './ports/file-system-port.ts';
import type { LoggerPort } from './ports/logger-port.ts';
import type { ProcessPort } from './ports/process-port.ts';
import type { SystemPort } from './ports/system-port.ts';
import type { WatcherPort } from './ports/watcher-port.ts';
import { type CoreServices } from './server-services.ts';
import type { AgentCommand } from './services/agent/agent-types.ts';
import { type ConfigStore } from './services/config/user-config.ts';

export type StartServerOptions = {
  /** Version of the published `kumicraft` package, shown by the Studio. */
  readonly version: string;
  /** Port chosen by the CLI (S-02). */
  readonly port: number;
  /** Absolute path of the folder given to the CLI. */
  readonly workspaceDir: string;
  /** Absolute path of the built Studio. Omit to serve the API only (Studio dev server). */
  readonly studioDir?: string;
  readonly logLevel?: LogLevel;
  /** Value of `KUMICRAFT_FEATURES`. */
  readonly featureOverride?: string;
  /** Origins trusted like the server's own: only the Vite dev server of `pnpm dev`. */
  readonly trustedOrigins?: readonly string[];
  /** Optional dependency overrides for testing. */
  readonly deps?: {
    readonly fs?: FileSystemPort;
    readonly system?: SystemPort;
    readonly process?: ProcessPort;
    readonly configDir?: string;
    readonly cacheDir?: string;
    readonly dataDir?: string;
    readonly templateDir?: string;
    readonly homeDir?: string;
    readonly logger?: LoggerPort;
    /** Folder of `kumicraft.log`; without it a test that gives `configDir` gets no file. */
    readonly logDir?: string;
    readonly eventBus?: EventBusPort;
    readonly watcher?: WatcherPort;
    readonly runnerScriptPath?: string | undefined;
    /** R-QA-12: E2E tests point the agents at `fake-agent.mjs` here, never via user env vars. */
    readonly agentCommands?: Partial<Record<AgentId, AgentCommand>> | undefined;
  };
};

export type InitializedContext = CoreServices & {
  readonly configStore: ConfigStore;
  readonly eventBus: EventBusPort;
  readonly fs: FileSystemPort;
  readonly processPort: ProcessPort;
  readonly platform: Platform;
  readonly homeDir: string;
  readonly configDir: string;
  /** KumiCraft's cache folder (mirrors, build check output). */
  readonly cacheDir: string;
  readonly logger: LoggerPort;
  readonly pino?: Logger | undefined;
};

/**
 * A child-process script of `runners/` (`vite-react`, `format-snippet`): next to the bundled CLI
 * (`dist/runners/*.js`), or the TypeScript source when the server runs from the repository.
 */
export function resolveRunnerScript(customPath?: string, name = 'vite-react'): string {
  if (customPath && existsSync(customPath)) return customPath;
  const cleanName = name.replace(/^runners[/\\]/, '').replace(/\.[jt]s$/, '');
  const rels = [
    `./runners/${cleanName}.js`,
    `./runners/${cleanName}.ts`,
    `../runners/${cleanName}.js`,
    `../runners/${cleanName}.ts`,
    `../../runners/${cleanName}.js`,
    `../../runners/${cleanName}.ts`,
    `../../../server/src/runners/${cleanName}.ts`,
    `../../../../packages/server/src/runners/${cleanName}.ts`,
  ];
  for (const rel of rels) {
    const p = fileURLToPath(new URL(rel, import.meta.url));
    if (existsSync(p)) return p;
  }
  return fileURLToPath(new URL(`./runners/${cleanName}.js`, import.meta.url));
}
