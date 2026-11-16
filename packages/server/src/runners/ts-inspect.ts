// Child process runner for TypeScript data-source interfaces/types (TK-33) and component props (TK-49).
// Uses the open project's own TypeScript compiler; code is type-checked, never executed.
// QC-52: Isolated child process runner; allowed to call process.exit().
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';

type ListDataRequest = {
  readonly mode: 'listDataSources';
  readonly root: string;
  readonly files: readonly string[];
};

type ReadFieldsRequest = {
  readonly mode: 'readDataSourceFields';
  readonly root: string;
  readonly file: string;
  readonly name: string;
};

type ReadComponentPropsRequest = {
  readonly mode: 'readComponentProps';
  readonly root: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
};

type RunnerRequest = ListDataRequest | ReadFieldsRequest | ReadComponentPropsRequest;

type OutField = {
  readonly name: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
  readonly options?: readonly string[];
};

/** Where a prop is declared: React's own HTML attributes, a package, or the project. */
type PropOrigin = 'react' | 'package' | 'project';

type OutProp = {
  readonly name: string;
  readonly kind: 'union' | 'boolean' | 'number' | 'string' | 'complex';
  readonly required: boolean;
  readonly options?: readonly string[];
  readonly origin: PropOrigin;
};

type TsSymbol = {
  readonly name: string;
  readonly flags: number;
  readonly valueDeclaration?: TsNode;
  readonly declarations?: readonly TsNode[];
};

type TsType = {
  readonly flags: number;
  readonly value?: unknown;
  readonly types?: readonly TsType[];
  isStringLiteral?(): boolean;
  isNumberLiteral?(): boolean;
  getCallSignatures?(): readonly { getParameters(): readonly TsSymbol[] }[];
};

type TsNode = {
  readonly kind: number;
  readonly statements?: readonly TsNode[];
  readonly name?: { readonly text?: string };
  readonly modifiers?: readonly { readonly kind: number }[];
  readonly tagName?: TsNode;
  readonly attributes?: TsNode;
  readonly openingElement?: TsNode;
  getStart(sf?: TsSourceFile): number;
  getEnd(): number;
  getSourceFile?(): { readonly fileName: string };
  forEachChild(cb: (n: TsNode) => void): void;
};

type TsSourceFile = TsNode & {
  getLineAndCharacterOfPosition(pos: number): { readonly line: number; readonly character: number };
};

type TsChecker = {
  getTypeAtLocation(n: TsNode): TsType;
  getContextualType(n: TsNode): TsType | undefined;
  getPropertiesOfType(t: TsType): readonly TsSymbol[];
  getTypeOfSymbolAtLocation(sym: TsSymbol, at: TsNode): TsType;
  typeToString(t: TsType, at?: TsNode): string;
};

type TsApi = {
  sys: { fileExists(p: string): boolean; readFile(p: string): string | undefined };
  SyntaxKind: Readonly<Record<string, number>>;
  SymbolFlags: { Optional: number };
  TypeFlags: {
    Undefined: number;
    Null: number;
    String: number;
    Number: number;
    Boolean: number;
    BooleanLiteral: number;
    StringLiteral: number;
    NumberLiteral: number;
    Union: number;
  };
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
    getSourceFile(p: string): TsSourceFile | undefined;
    getTypeChecker(): TsChecker;
  };
};

const norm = (p: string) => resolve(p).replaceAll('\\', '/').toLowerCase();

function loadTs(root: string): TsApi {
  const require = createRequire(join(root, 'package.json'));
  return require('typescript') as TsApi;
}

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

function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.length === 0 ? name : `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

function inferTextFieldType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('email')) return 'email';
  if (lower.includes('password') || lower.includes('passwd')) return 'password';
  if (
    lower.includes('url') ||
    lower.includes('website') ||
    lower === 'link' ||
    lower === 'avatar'
  ) {
    return 'url';
  }
  if (lower.endsWith('at') || lower.includes('datetime') || lower.includes('timestamp')) {
    return 'datetime';
  }
  if (lower.includes('date') || lower.includes('birthday')) return 'date';
  if (
    lower.includes('description') ||
    lower.includes('bio') ||
    lower.includes('notes') ||
    lower.includes('message') ||
    lower.includes('summary')
  ) {
    return 'textarea';
  }
  return 'text';
}

function isModelStatement(ts: TsApi, stmt: TsNode): string | undefined {
  const isDecl =
    stmt.kind === ts.SyntaxKind['InterfaceDeclaration'] ||
    stmt.kind === ts.SyntaxKind['TypeAliasDeclaration'];
  if (!isDecl) return undefined;
  return stmt.name?.text;
}

function listDataSources(req: ListDataRequest): { sources: { file: string; name: string }[] } {
  const ts = loadTs(req.root);
  const absFiles = req.files.map((f) => resolve(req.root, f));
  const opts = absFiles[0]
    ? optionsFor(ts, absFiles[0])
    : { jsx: 4, allowJs: true, skipLibCheck: true };
  const program = ts.createProgram({ rootNames: absFiles, options: { ...opts, noEmit: true } });
  const checker = program.getTypeChecker();
  const sources: { file: string; name: string }[] = [];

  for (const abs of absFiles) {
    const sf = program.getSourceFile(abs);
    if (!sf?.statements) continue;
    const rel = relative(req.root, abs).replaceAll('\\', '/');
    for (const stmt of sf.statements) {
      const name = isModelStatement(ts, stmt);
      if (name === undefined || name.endsWith('Props')) continue;
      const t = checker.getTypeAtLocation(stmt);
      if (checker.getPropertiesOfType(t).length === 0) continue;
      sources.push({ file: rel, name });
    }
  }
  return { sources };
}

function stripOptionalTypes(
  ts: TsApi,
  t: TsType,
): { members: readonly TsType[]; hasUndefined: boolean } {
  if ((t.flags & ts.TypeFlags.Union) === 0 || !t.types) {
    return {
      members: [t],
      hasUndefined: (t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) !== 0,
    };
  }
  const kept: TsType[] = [];
  let hasUndefined = false;
  for (const m of t.types) {
    if ((m.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) !== 0) hasUndefined = true;
    else kept.push(m);
  }
  return { members: kept, hasUndefined };
}

function classifyTsType(
  ts: TsApi,
  checker: TsChecker,
  rawType: TsType,
  propName: string,
  atNode: TsNode,
): {
  fieldType: string;
  propKind: OutProp['kind'];
  options?: readonly string[];
  optionalUnion: boolean;
} {
  const { members, hasUndefined } = stripOptionalTypes(ts, rawType);
  if (members.length > 0 && members.every((m) => (m.flags & ts.TypeFlags.StringLiteral) !== 0)) {
    const opts = members
      .map((m) => m.value)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    return { fieldType: 'select', propKind: 'union', options: opts, optionalUnion: hasUndefined };
  }
  const single = members.length === 1 ? members[0] : undefined;
  const isBool =
    (single !== undefined &&
      (single.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) !== 0) ||
    (members.length === 2 &&
      members.every((m) => (m.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) !== 0));
  if (isBool) return { fieldType: 'boolean', propKind: 'boolean', optionalUnion: hasUndefined };
  const isNum =
    members.length > 0 &&
    members.every((m) => (m.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) !== 0);
  if (isNum) return { fieldType: 'number', propKind: 'number', optionalUnion: hasUndefined };
  if (single !== undefined) {
    const typeText = checker.typeToString(single, atNode);
    if (typeText === 'Date')
      return { fieldType: 'date', propKind: 'complex', optionalUnion: hasUndefined };
    if ((single.flags & ts.TypeFlags.String) !== 0) {
      return {
        fieldType: inferTextFieldType(propName),
        propKind: 'string',
        optionalUnion: hasUndefined,
      };
    }
  }
  return {
    fieldType: inferTextFieldType(propName),
    propKind: 'complex',
    optionalUnion: hasUndefined,
  };
}

function readDataSourceFields(req: ReadFieldsRequest): { fields: OutField[] } {
  const ts = loadTs(req.root);
  const abs = resolve(req.root, req.file);
  const program = ts.createProgram({
    rootNames: [abs],
    options: { ...optionsFor(ts, abs), noEmit: true },
  });
  const sf = program.getSourceFile(abs);
  const checker = program.getTypeChecker();
  if (!sf?.statements) return { fields: [] };
  const stmt = sf.statements.find((s) => isModelStatement(ts, s) === req.name);
  if (!stmt) return { fields: [] };
  const modelType = checker.getTypeAtLocation(stmt);
  const fields: OutField[] = [];
  for (const sym of checker.getPropertiesOfType(modelType)) {
    const t = checker.getTypeOfSymbolAtLocation(sym, stmt);
    const cls = classifyTsType(ts, checker, t, sym.name, stmt);
    const required = (sym.flags & ts.SymbolFlags.Optional) === 0 && !cls.optionalUnion;
    fields.push({
      name: sym.name,
      label: humanize(sym.name),
      type: cls.fieldType,
      required,
      ...(cls.options ? { options: cls.options } : {}),
    });
  }
  return { fields };
}

function findJsxOpeningAt(
  ts: TsApi,
  sf: TsSourceFile,
  line: number,
  column: number,
): TsNode | undefined {
  let matched: TsNode | undefined;
  const visit = (node: TsNode) => {
    if (matched) return;
    if (
      node.kind === ts.SyntaxKind['JsxOpeningElement'] ||
      node.kind === ts.SyntaxKind['JsxSelfClosingElement']
    ) {
      const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      if (pos.line + 1 === line && pos.character + 1 === column) {
        matched = node;
        return;
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return matched;
}

const SKIP_REACT_PROPS = new Set(['children', 'key', 'ref', 'dangerouslySetInnerHTML']);

function originOf(sym: TsSymbol): PropOrigin {
  const file = sym.declarations?.[0]?.getSourceFile?.().fileName.replaceAll('\\', '/') ?? '';
  if (file.includes('/node_modules/@types/react/')) return 'react';
  return file.includes('/node_modules/') ? 'package' : 'project';
}

function readComponentProps(req: ReadComponentPropsRequest): { props: OutProp[] } {
  const ts = loadTs(req.root);
  const abs = resolve(req.root, req.file);
  const program = ts.createProgram({
    rootNames: [abs],
    options: { ...optionsFor(ts, abs), noEmit: true },
  });
  const sf = program.getSourceFile(abs);
  if (!sf) return { props: [] };
  const opening = findJsxOpeningAt(ts, sf, req.line, req.column);
  if (!opening?.attributes || !opening.tagName) return { props: [] };

  const checker = program.getTypeChecker();
  let propsType = checker.getContextualType(opening.attributes);
  if (!propsType || checker.getPropertiesOfType(propsType).length === 0) {
    const fnType = checker.getTypeAtLocation(opening.tagName);
    const sig = fnType.getCallSignatures?.()[0];
    const param = sig?.getParameters()[0];
    if (param) {
      propsType = checker.getTypeOfSymbolAtLocation(param, opening.tagName);
    }
  }
  if (!propsType) return { props: [] };

  const props: OutProp[] = [];
  for (const sym of checker.getPropertiesOfType(propsType)) {
    if (SKIP_REACT_PROPS.has(sym.name)) continue;
    const t = checker.getTypeOfSymbolAtLocation(sym, opening);
    const cls = classifyTsType(ts, checker, t, sym.name, opening);
    const required = (sym.flags & ts.SymbolFlags.Optional) === 0 && !cls.optionalUnion;
    props.push({
      name: sym.name,
      kind: cls.propKind,
      required,
      ...(cls.options ? { options: cls.options } : {}),
      origin: originOf(sym),
    });
  }
  return { props };
}

export function runTsInspectRequest(req: RunnerRequest): unknown {
  return req.mode === 'listDataSources'
    ? listDataSources(req)
    : req.mode === 'readDataSourceFields'
      ? readDataSourceFields(req)
      : readComponentProps(req);
}

function main() {
  const raw = process.argv[2];
  if (typeof raw !== 'string') process.exit(1);
  let req: RunnerRequest;
  try {
    req = JSON.parse(raw) as RunnerRequest;
  } catch {
    process.exit(1);
  }
  const out = runTsInspectRequest(req);
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

if (
  process.argv[1]?.includes('ts-inspect') &&
  process.argv[2] !== undefined &&
  !process.argv[1].endsWith('.test.ts')
) {
  main();
}
