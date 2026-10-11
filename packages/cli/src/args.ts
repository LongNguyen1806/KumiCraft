// Command-line arguments of `reactcraft` (ADR-BE-03).
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { LogLevel } from '@reactcraft/server';

export type CliOptions = {
  readonly workspaceDir: string;
  readonly port: number | undefined;
  readonly shouldOpen: boolean;
  readonly logLevel: LogLevel;
};

export type ParsedArgs =
  | { readonly ok: true; readonly options: CliOptions }
  | { readonly ok: false; readonly message: string };

const LOG_LEVELS: readonly LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
];
const MIN_PORT = 1024;
const MAX_PORT = 65535;

const isLogLevel = (value: string): value is LogLevel => LOG_LEVELS.includes(value as LogLevel);

export function parseCliArgs(argv: readonly string[], cwd: string): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      allowNegative: true,
      options: {
        port: { type: 'string' },
        open: { type: 'boolean', default: true },
        'log-level': { type: 'string', default: 'info' },
      },
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  const { values, positionals } = parsed;
  if (positionals.length > 1) {
    return { ok: false, message: 'Expected at most one workspace directory.' };
  }

  const logLevel = values['log-level'];
  if (!isLogLevel(logLevel)) {
    return { ok: false, message: `--log-level must be one of: ${LOG_LEVELS.join(', ')}.` };
  }

  let port: number | undefined;
  if (values.port !== undefined) {
    port = Number(values.port);
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
      return {
        ok: false,
        message: `--port must be an integer from ${String(MIN_PORT)} to ${String(MAX_PORT)}.`,
      };
    }
  }

  return {
    ok: true,
    options: {
      workspaceDir: resolve(cwd, positionals[0] ?? '.'),
      port,
      shouldOpen: values.open,
      logLevel,
    },
  };
}
