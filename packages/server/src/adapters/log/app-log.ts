// The server's log (S-88): `kumicraft.log` in the user's log folder, the file a user sends back
// with a bug report. A test that gives its own logger or config folder gets no file.
import envPaths from 'env-paths';
import type { Logger } from 'pino';

import type { LoggerPort } from '../../core/ports/logger-port.ts';
import type { LogLevel } from '../http/create-http-app.ts';
import { createServerLogger } from './create-logger.ts';

export type AppLog = {
  readonly port: LoggerPort;
  /** The same logger for Fastify, so request errors reach the file too. */
  readonly pino?: Logger | undefined;
};

export type AppLogOptions = {
  readonly level: LogLevel;
  readonly logger?: LoggerPort | undefined;
  readonly configDir?: string | undefined;
  readonly logDir?: string | undefined;
};

/** macOS `~/Library/Logs/kumicraft-nodejs`, Windows `%LOCALAPPDATA%\kumicraft-nodejs\Log`. */
export function appLogDir(
  options: Pick<AppLogOptions, 'configDir' | 'logDir'>,
): string | undefined {
  if (options.logDir !== undefined) return options.logDir;
  return options.configDir === undefined ? envPaths('kumicraft').log : undefined;
}

export function createAppLog(options: AppLogOptions): AppLog {
  if (options.logger !== undefined) return { port: options.logger };
  const logDir = appLogDir(options);
  try {
    const made = createServerLogger({
      level: options.level,
      ...(logDir === undefined ? {} : { logDir }),
    });
    return { port: made.port, pino: made.pino };
  } catch (cause) {
    // A log folder that cannot be made only costs the file, never the start.
    const made = createServerLogger({ level: options.level });
    made.port.warn(
      { logDir, err: cause },
      'cannot create the log folder; logging to the terminal only',
    );
    return { port: made.port, pino: made.pino };
  }
}
