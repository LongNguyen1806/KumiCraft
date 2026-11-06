// Child process of the build check for Express + Pug (SPEC-04 M-BC): compiles every `.pug` file of
// the views folder with the project's own Pug, without rendering, and prints one JSON line
// `{ "errors": [...] }`. Loading Pug runs project code, so the server starts this only for a
// trusted project.
// QC-52: This file is an isolated child process runner and is allowed to call process.exit().
import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

type PugApi = { compileFile(path: string, options: object): unknown };
type CheckError = { file: string; line?: number; column?: number; message: string };

const MAX_FILES = 2000;

function isPugApi(value: unknown): value is PugApi {
  return (
    typeof value === 'object' &&
    Boolean(value) &&
    typeof (value as Record<string, unknown>)['compileFile'] === 'function'
  );
}

async function pugFiles(dir: string, out: string[]): Promise<void> {
  if (out.length >= MAX_FILES) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await pugFiles(full, out);
    else if (entry.name.endsWith('.pug') && out.length < MAX_FILES) out.push(full);
  }
}

/** Pug errors carry `filename`, `line`, `column` and a short `msg`. */
function errorOf(root: string, file: string, cause: unknown): CheckError {
  const rec = typeof cause === 'object' && cause ? (cause as Record<string, unknown>) : {};
  const at = typeof rec['filename'] === 'string' ? rec['filename'] : file;
  const text =
    typeof rec['msg'] === 'string'
      ? rec['msg']
      : cause instanceof Error
        ? cause.message
        : String(cause);
  return {
    file: relative(root, at).replaceAll('\\', '/'),
    ...(typeof rec['line'] === 'number' ? { line: rec['line'] } : {}),
    ...(typeof rec['column'] === 'number' ? { column: rec['column'] } : {}),
    message: text,
  };
}

export async function checkPug(root: string, viewsDir: string): Promise<CheckError[]> {
  const require = createRequire(join(root, 'package.json'));
  const loaded: unknown = require('pug');
  if (!isPugApi(loaded)) return [{ file: 'package.json', message: 'pug is not installed' }];
  const files: string[] = [];
  await pugFiles(join(root, viewsDir), files);
  const errors: CheckError[] = [];
  for (const file of files) {
    try {
      loaded.compileFile(file, { basedir: join(root, viewsDir) });
    } catch (cause) {
      errors.push(errorOf(root, file, cause));
    }
  }
  return errors;
}

async function main(root: string, viewsDir: string): Promise<void> {
  try {
    const errors = await checkPug(root, viewsDir);
    process.stdout.write(`${JSON.stringify({ errors })}\n`);
    process.exit(0);
  } catch (cause) {
    process.stderr.write(`${String(cause)}\n`);
    process.exit(1);
  }
}

const [root, viewsDir] = process.argv.slice(2);
if (root !== undefined && viewsDir !== undefined) void main(root, viewsDir);
