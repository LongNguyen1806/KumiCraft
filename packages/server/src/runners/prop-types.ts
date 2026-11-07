// Child process for "Create component" (FR-72): with the project's own TypeScript, the type of
// each name the extracted JSX uses from the old component, as text the new file can declare. The
// project's code is type-checked, not run; the server starts this only for a trusted project.
// Input: argv[2] = JSON { root, file, names: [{ name, offset }] }. Output: one JSON line
// { types: string[] } — an empty string where no type could be read.
// QC-52: This file is an isolated child process runner and is allowed to call process.exit().
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

type Request = {
  readonly root: string;
  readonly file: string;
  readonly names: readonly { readonly name: string; readonly offset: number }[];
};

type TsNode = { getStart(): number; getEnd(): number; forEachChild(cb: (n: TsNode) => void): void };
type TsApi = {
  sys: { fileExists(p: string): boolean; readFile(p: string): string | undefined };
  findConfigFile(dir: string, exists: (p: string) => boolean): string | undefined;
  readConfigFile(p: string, read: (p: string) => string | undefined): { config?: unknown };
  parseJsonConfigFileContent(
    json: unknown,
    host: unknown,
    base: string,
  ): {
    options: Record<string, unknown>;
    fileNames: string[];
    projectReferences?: { path: string }[];
  };
  createProgram(opts: { rootNames: string[]; options: Record<string, unknown> }): {
    getSourceFile(p: string): TsNode | undefined;
    getTypeChecker(): {
      getTypeAtLocation(n: TsNode): unknown;
      getBaseTypeOfLiteralType(t: unknown): unknown;
      typeToString(t: unknown, at?: TsNode, flags?: number): string;
    };
  };
  TypeFormatFlags: { NoTruncation: number; UseAliasDefinedOutsideCurrentScope: number };
};

const norm = (p: string) => resolve(p).replaceAll('\\', '/').toLowerCase();

/** The options of the tsconfig that has `file`: the root one, or one it references. */
function optionsFor(ts: TsApi, file: string): Record<string, unknown> {
  const found = ts.findConfigFile(dirname(file), (p) => ts.sys.fileExists(p));
  if (found === undefined) return { jsx: 4, allowJs: true, skipLibCheck: true };
  const configs = [found];
  for (let i = 0; i < configs.length && i < 8; i++) {
    const path = configs[i] ?? found;
    const read = ts.readConfigFile(path, (p) => ts.sys.readFile(p));
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(path));
    if (parsed.fileNames.some((f) => norm(f) === norm(file))) return parsed.options;
    for (const ref of parsed.projectReferences ?? []) {
      configs.push(ref.path.endsWith('.json') ? ref.path : join(ref.path, 'tsconfig.json'));
    }
  }
  return { jsx: 4, allowJs: true, skipLibCheck: true };
}

function identifierAt(node: TsNode, offset: number): TsNode | undefined {
  if (offset < node.getStart() || offset >= node.getEnd()) return undefined;
  let found: TsNode | undefined = node;
  node.forEachChild((child) => {
    const inner = identifierAt(child, offset);
    if (inner !== undefined) found = inner;
  });
  return found;
}

export function readTypes(request: Request): string[] {
  const require = createRequire(join(request.root, 'package.json'));
  const ts = require('typescript') as TsApi;
  const file = resolve(request.root, request.file);
  const program = ts.createProgram({
    rootNames: [file],
    options: { ...optionsFor(ts, file), noEmit: true },
  });
  const source = program.getSourceFile(file);
  const checker = program.getTypeChecker();
  const flags =
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
  return request.names.map(({ offset }) => {
    const node = source === undefined ? undefined : identifierAt(source, offset);
    if (node === undefined) return '';
    // `const open = true` is `true` there: the prop takes `boolean`.
    const type = checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(node));
    const text = checker.typeToString(type, source, flags);
    return text;
  });
}

function isRequest(value: unknown): value is Request {
  if (!(value instanceof Object)) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec['root'] === 'string' &&
    typeof rec['file'] === 'string' &&
    Array.isArray(rec['names'])
  );
}

function main(): void {
  try {
    const parsed: unknown = JSON.parse(process.argv[2] ?? '');
    if (!isRequest(parsed)) throw new Error('bad request');
    const types = readTypes(parsed);
    process.stdout.write(`${JSON.stringify({ types })}\n`);
    process.exit(0);
  } catch (cause) {
    process.stderr.write(`${String(cause)}\n`);
    process.exit(1);
  }
}

if (process.argv[2] !== undefined) main();
