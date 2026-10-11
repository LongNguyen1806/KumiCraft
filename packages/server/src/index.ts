// Public entry point of @reactcraft/server (QC-03): composition root of the Local Backend.
import { randomBytes } from 'node:crypto';

import { resolveEnabledFeatures } from '@reactcraft/model';

import { createHttpApp, type LogLevel } from './adapters/http/create-http-app.ts';
import { err, ok, type Result } from './core/shared/result.ts';
import { createSessionInfoProvider, toSupportedPlatform } from './core/shared/session.ts';

export type { LogLevel } from './adapters/http/create-http-app.ts';
export type { AppError, ErrorCode, Result } from './core/shared/result.ts';
export type { Platform, SessionInfo, WorkspaceState } from './core/shared/session.ts';

/** ADR-BE-03: the server never listens on another interface. */
export const HOST = '127.0.0.1';

export type StartServerOptions = {
  /** Version of the published `reactcraft` package, shown by the Studio. */
  readonly version: string;
  /** Port chosen by the CLI (S-02). */
  readonly port: number;
  /** Absolute path of the workspace directory. */
  readonly workspaceDir: string;
  /** Absolute path of the built Studio. Omit to serve the API only (Studio dev server). */
  readonly studioDir?: string;
  readonly logLevel?: LogLevel;
  /** Value of `REACTCRAFT_FEATURES` (SPEC-07 CW-17). */
  readonly featureOverride?: string;
  /** Origins trusted like the server's own: only the Vite dev server of `pnpm dev`. */
  readonly trustedOrigins?: readonly string[];
};

export type RunningServer = {
  readonly url: string;
  readonly port: number;
  /** Session token. The CLI hands it to the Studio in the URL fragment `#t=` (SPEC-05 section 5.2). */
  readonly sessionToken: string;
  readonly close: () => Promise<void>;
};

/**
 * Starts the Local Backend on {@link HOST}.
 *
 * @returns The running server, or E002 with `params.step` (`platform`, `listen`) when start-up fails.
 */
export async function startServer(options: StartServerOptions): Promise<Result<RunningServer>> {
  const platform = toSupportedPlatform(process.platform);
  if (platform === undefined) {
    return err({ code: 'E002', params: { step: 'platform', platform: process.platform } });
  }

  const getSessionInfo = createSessionInfoProvider({
    version: options.version,
    platform,
    features: resolveEnabledFeatures(options.featureOverride),
    // The workspace module (M-WS, SPEC-07 WP-1.05) replaces this with the real workspace state.
    readWorkspace: () => ({ state: 'none', directory: options.workspaceDir }),
  });

  // S-03: 32 random bytes per start, kept in memory only.
  const sessionToken = randomBytes(32).toString('base64url');
  const app = await createHttpApp({
    logLevel: options.logLevel ?? 'info',
    security: { port: options.port, sessionToken, trustedOrigins: options.trustedOrigins ?? [] },
    getSessionInfo,
    ...(options.studioDir === undefined ? {} : { studioDir: options.studioDir }),
  });

  try {
    await app.listen({ host: HOST, port: options.port });
  } catch (cause) {
    await app.close();
    return err({ code: 'E002', params: { step: 'listen', port: options.port }, cause });
  }

  return ok({
    url: `http://${HOST}:${String(options.port)}`,
    port: options.port,
    sessionToken,
    close: () => app.close(),
  });
}
