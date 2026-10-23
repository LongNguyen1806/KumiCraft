// Child process that formats one JSX snippet with the project's own Prettier (SPEC-04 M-FM, R-FM-03,
// ADR-BE-38). Loading Prettier runs the project's code (its config and plugins), so the server only
// starts this for a trusted project, and kills it after a deadline.
// QC-52: This file is an isolated child process runner and is allowed to call process.exit().
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type FormatRequest = { readonly root: string; readonly file: string; readonly code: string };
export type FormatReply =
  { readonly ok: true; readonly code: string } | { readonly ok: false; readonly reason: string };

interface PrettierApi {
  /** A path, or nothing when the project has no Prettier config. */
  resolveConfigFile(filePath: string): Promise<unknown>;
  resolveConfig(filePath: string, options: object): Promise<unknown>;
  format(source: string, options: object): Promise<string> | string;
}

function isPrettierApi(value: unknown): value is PrettierApi {
  return (
    typeof value === 'object' &&
    Boolean(value) &&
    typeof (value as Record<string, unknown>)['format'] === 'function' &&
    typeof (value as Record<string, unknown>)['resolveConfigFile'] === 'function'
  );
}

async function loadPrettier(root: string): Promise<PrettierApi | undefined> {
  const require = createRequire(join(root, 'package.json'));
  const loaded: unknown = await import(pathToFileURL(require.resolve('prettier')).href);
  const api = (loaded as { default?: unknown }).default ?? loaded;
  return isPrettierApi(api) ? api : undefined;
}

/**
 * The snippet goes inside a fragment so Prettier sees one expression; the lines between `<>` and
 * `</>` come back, still indented one level (the server re-indents them to the file).
 */
export function unwrapFragment(formatted: string): string | undefined {
  const lines = formatted.replace(/\r\n/g, '\n').split('\n');
  const open = lines.findIndex((l) => /^;?<>$/.test(l.trim()));
  let close = -1;
  for (let i = lines.length - 1; i > open; i--) {
    if (/^<\/>;?$/.test(lines[i]?.trim() ?? '')) {
      close = i;
      break;
    }
  }
  if (open === -1 || close === -1) return undefined;
  return lines.slice(open + 1, close).join('\n');
}

export async function formatRequest(request: FormatRequest): Promise<FormatReply> {
  const prettier = await loadPrettier(request.root);
  if (prettier === undefined) return { ok: false, reason: 'noPrettier' };
  const filePath = join(request.root, request.file);
  if (!(await prettier.resolveConfigFile(filePath))) return { ok: false, reason: 'noConfig' };
  const resolved = await prettier.resolveConfig(filePath, { editorconfig: true });
  const options = typeof resolved === 'object' && Boolean(resolved) ? resolved : {};
  const formatted = await prettier.format(`<>\n${request.code}\n</>;\n`, {
    ...options,
    filepath: filePath,
  });
  const code = unwrapFragment(formatted);
  return code === undefined ? { ok: false, reason: 'unwrap' } : { ok: true, code };
}

function isFormatRequest(value: unknown): value is FormatRequest {
  const rec = value as Record<string, unknown> | undefined;
  return (
    typeof value === 'object' &&
    Boolean(value) &&
    typeof rec?.['root'] === 'string' &&
    typeof rec['file'] === 'string' &&
    typeof rec['code'] === 'string'
  );
}

async function answer(message: unknown): Promise<FormatReply> {
  if (!isFormatRequest(message)) return { ok: false, reason: 'badRequest' };
  try {
    return await formatRequest(message);
  } catch (cause) {
    return { ok: false, reason: String(cause) };
  }
}

if (process.send !== undefined) {
  process.once('message', (message: unknown) => {
    void (async () => {
      const reply = await answer(message);
      process.send?.(reply, () => {
        process.exit(0);
      });
    })();
  });
}
