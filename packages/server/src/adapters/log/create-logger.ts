// pino logger (ADR-BE-23): JSON to the terminal and to a rotating file in the user's log folder
// (S-88). Secrets and tokens are redacted wherever they appear in an entry's fields (S-89).
import pino, { type Logger } from 'pino';

import type { LoggerPort } from '../../core/ports/logger-port.ts';
import type { LogLevel } from '../http/create-http-app.ts';
import { createRotatingFile, type RotatingFile } from './rotating-file.ts';

/** Field names whose value never reaches a log (at the top level or one level down). */
const SECRET_KEYS = [
  'authorization',
  'apiKey',
  'token',
  'sessionToken',
  'password',
  'secret',
  'cookie',
];

export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["sec-websocket-protocol"]',
  ...SECRET_KEYS,
  ...SECRET_KEYS.map((key) => `*.${key}`),
];

export type ServerLogger = {
  readonly pino: Logger;
  readonly port: LoggerPort;
  readonly close: () => void;
};

export function toLoggerPort(logger: Logger): LoggerPort {
  return {
    debug: (fields, message) => {
      logger.debug(fields, message);
    },
    info: (fields, message) => {
      logger.info(fields, message);
    },
    warn: (fields, message) => {
      logger.warn(fields, message);
    },
    error: (fields, message) => {
      logger.error(fields, message);
    },
    child: (bindings) => toLoggerPort(logger.child(bindings)),
  };
}

export type LoggerOptions = {
  readonly level: LogLevel;
  /** Folder of the rotating log file. Omit to log to the terminal only (tests). */
  readonly logDir?: string;
  /** Terminal destination; defaults to stdout. */
  readonly terminal?: { write(chunk: string): void };
};

const silentStream = { write: () => undefined };

export function createServerLogger(options: LoggerOptions): ServerLogger {
  const file: RotatingFile | undefined =
    options.logDir === undefined ? undefined : createRotatingFile(options.logDir);
  const isSilent = options.level === 'silent';
  const terminalLevel = isSilent ? 'fatal' : options.level;
  const streams: pino.StreamEntry[] = [
    {
      level: terminalLevel,
      stream: isSilent ? silentStream : (options.terminal ?? process.stdout),
    },
  ];
  // The file keeps `info` and above even when the terminal is quieter, for bug reports.
  if (file !== undefined) streams.push({ level: 'info', stream: file });
  const level =
    file !== undefined && (isSilent || (pino.levels.values[terminalLevel] ?? 30) > 30)
      ? 'info'
      : options.level;
  const logger = pino(
    { level, redact: { paths: REDACTED_PATHS, censor: '[redacted]' } },
    pino.multistream(streams),
  );
  return { pino: logger, port: toLoggerPort(logger), close: () => file?.close() };
}
