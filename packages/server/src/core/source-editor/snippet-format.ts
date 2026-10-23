// Formats a JSX snippet before it is inserted (SPEC-04 M-FM, R-FM-03 to R-FM-05, ADR-BE-38).
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import { layoutJsxSnippet } from './structure/jsx-layout.ts';
import { validateInsertedJsx } from './structure/structure-ops.ts';

export type SnippetFormatInput = {
  readonly projectRoot: string;
  /** File the snippet goes into, relative to the project. */
  readonly file: string;
  readonly jsx: string;
};

/** Never rejects: whatever goes wrong, the snippet is inserted as it came (R-FM-05). */
export type SnippetFormatter = (input: SnippetFormatInput) => Promise<string>;

export const PRETTIER_TIMEOUT_MS = 2_000;
const DEFAULT_PRINT_WIDTH = 100;

const PRETTIER_CONFIG_FILES = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.json5',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.toml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.ts',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
];

export type SnippetFormatterDeps = {
  readonly fs: FileSystemPort;
  readonly logger?: LoggerPort | undefined;
  /** The project's own Prettier (R-FM-03); absent: the built-in layout only. */
  readonly prettier?:
    | {
        readonly process: ProcessPort;
        /** `runners/format-snippet` started with `node` and an IPC channel. */
        readonly scriptPath: string;
        /** Loading Prettier runs the project's code: only for a trusted project (S-80). */
        readonly isTrusted: () => boolean;
        readonly timeoutMs?: number | undefined;
      }
    | undefined;
};

function readJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && Boolean(value) && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** `printWidth` from a JSON `.prettierrc` or the `prettier` key of `package.json`, read without running code. */
async function readPrintWidth(fs: FileSystemPort, root: string): Promise<number> {
  for (const file of ['.prettierrc', '.prettierrc.json', 'package.json']) {
    const read = await fs.readText(root, file, { maxBytes: 256 * 1024 });
    if (!read.ok) continue;
    const json = readJsonObject(read.value);
    const config = file === 'package.json' ? json?.['prettier'] : json;
    const width = (config as Record<string, unknown> | undefined)?.['printWidth'];
    if (typeof width === 'number' && width >= 20 && width <= 400) return width;
  }
  return DEFAULT_PRINT_WIDTH;
}

async function hasPrettierConfig(fs: FileSystemPort, root: string): Promise<boolean> {
  for (const file of PRETTIER_CONFIG_FILES) {
    if (await fs.exists(root, file)) return true;
  }
  const pkg = await fs.readText(root, 'package.json', { maxBytes: 256 * 1024 });
  return pkg.ok && readJsonObject(pkg.value)?.['prettier'] !== undefined;
}

type PrettierReply = { ok: true; code: string } | { ok: false; reason: string };

function toReply(message: unknown): PrettierReply {
  const rec =
    typeof message === 'object' && Boolean(message) ? (message as Record<string, unknown>) : {};
  if (rec['ok'] === true && typeof rec['code'] === 'string') return { ok: true, code: rec['code'] };
  const reason = rec['reason'];
  return { ok: false, reason: typeof reason === 'string' ? reason : 'badReply' };
}

/** Runs `format-snippet` once; the first of its answer, its exit and the deadline wins (R-FM-05). */
async function runProjectPrettier(
  deps: NonNullable<SnippetFormatterDeps['prettier']>,
  input: SnippetFormatInput,
): Promise<PrettierReply> {
  const child = deps.process.spawn(process.execPath, [deps.scriptPath], {
    cwd: input.projectRoot,
    ipc: true,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const answered = new Promise<PrettierReply>((resolve) => {
    child.onMessage?.((message) => {
      resolve(toReply(message));
    });
  });
  const exited = (async (): Promise<PrettierReply> => {
    await child.wait();
    return { ok: false, reason: 'exited' };
  })();
  const timedOut = new Promise<PrettierReply>((resolve) => {
    timer = setTimeout(() => {
      resolve({ ok: false, reason: 'timeout' });
    }, deps.timeoutMs ?? PRETTIER_TIMEOUT_MS);
  });
  child.send?.({ root: input.projectRoot, file: input.file, code: input.jsx });
  const result = await Promise.race([answered, exited, timedOut]);
  clearTimeout(timer);
  await child.kill();
  return result;
}

/** Keeps a result only when it is still the same insertable JSX (PR-03). */
function stillValid(code: string): boolean {
  return validateInsertedJsx(code).ok;
}

export function createSnippetFormatter(deps: SnippetFormatterDeps): SnippetFormatter {
  const projectPrettier = async (input: SnippetFormatInput): Promise<string | undefined> => {
    const prettier = deps.prettier;
    if (prettier === undefined || !prettier.isTrusted()) return undefined;
    if (!(await deps.fs.exists(input.projectRoot, 'node_modules/prettier/package.json'))) {
      return undefined;
    }
    if (!(await hasPrettierConfig(deps.fs, input.projectRoot))) return undefined;
    const result = await runProjectPrettier(prettier, input);
    if (result.ok && stillValid(result.code)) return result.code;
    deps.logger?.warn(
      { file: input.file, reason: result.ok ? 'invalid' : result.reason },
      "the project's Prettier did not format the inserted JSX; using the built-in layout",
    );
    return undefined;
  };

  return async (input) => {
    try {
      const fromPrettier = await projectPrettier(input);
      if (fromPrettier !== undefined) return fromPrettier;
      const laidOut = layoutJsxSnippet(input.jsx, await readPrintWidth(deps.fs, input.projectRoot));
      return stillValid(laidOut) ? laidOut : input.jsx;
    } catch (cause) {
      deps.logger?.warn({ file: input.file, err: cause }, 'cannot format the inserted JSX');
      return input.jsx;
    }
  };
}
