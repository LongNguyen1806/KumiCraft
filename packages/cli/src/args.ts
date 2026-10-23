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

/** `reactcraft mcp [project-dir]`: MCP server (stdio) for external AI agents (R-AG-19). */
export type McpOptions = {
  /** The project the agent works on; ReactCraft must have it open (its lock tells the port). */
  readonly projectDir: string;
  readonly port: number | undefined;
};

export type ParsedArgs =
  | { readonly ok: true; readonly options: CliOptions }
  | { readonly ok: true; readonly mcp: McpOptions }
  | { readonly ok: true; readonly show: 'help' | 'version' }
  | { readonly ok: false; readonly message: string };

/** Exit code for wrong arguments, after printing the usage (R-CL-01). */
export const USAGE_EXIT_CODE = 2;

export const USAGE = `Usage: reactcraft [dir] [options]
       reactcraft mcp [project-dir] [--port <n>]

Starts ReactCraft for the workspace folder dir (default: the current folder).
"reactcraft mcp" serves ReactCraft's tools to an external AI agent over MCP (stdio) for the
project in project-dir (default: the current folder), which ReactCraft must have open.

Options:
  --port <n>           Studio port, 1024 to 65535 (default: the last one, or a free one)
  --no-open            Do not open the browser
  --log-level <level>  fatal, error, warn, info, debug, trace or silent (default: info)
  -h, --help           Show this help
  -v, --version        Show the version`;

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

function parsePort(value: string | undefined): number | undefined | 'invalid' {
  if (value === undefined) return undefined;
  const port = Number(value);
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT ? port : 'invalid';
}

const PORT_MESSAGE = `--port must be an integer from ${String(MIN_PORT)} to ${String(MAX_PORT)}.`;

function parseMcpArgs(argv: readonly string[], cwd: string): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { port: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  const { values, positionals } = parsed;
  if (values.help === true) return { ok: true, show: 'help' };
  if (positionals.length > 1) {
    return { ok: false, message: 'Expected at most one project directory.' };
  }
  const port = parsePort(values.port);
  if (port === 'invalid') return { ok: false, message: PORT_MESSAGE };
  return { ok: true, mcp: { projectDir: resolve(cwd, positionals[0] ?? '.'), port } };
}

export function parseCliArgs(argv: readonly string[], cwd: string): ParsedArgs {
  if (argv[0] === 'mcp') return parseMcpArgs(argv.slice(1), cwd);
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
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  const { values, positionals } = parsed;
  if (values.help === true) return { ok: true, show: 'help' };
  if (values.version === true) return { ok: true, show: 'version' };
  if (positionals.length > 1) {
    return { ok: false, message: 'Expected at most one workspace directory.' };
  }

  const logLevel = values['log-level'];
  if (!isLogLevel(logLevel)) {
    return { ok: false, message: `--log-level must be one of: ${LOG_LEVELS.join(', ')}.` };
  }

  const port = parsePort(values.port);
  if (port === 'invalid') return { ok: false, message: PORT_MESSAGE };

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
