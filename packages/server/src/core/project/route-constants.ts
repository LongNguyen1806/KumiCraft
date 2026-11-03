// Route constant table collector (`export const ROUTES = { ... }`) and path resolver (Phase 4 K3d-B Part C).
import { posix } from 'node:path';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';

const MAX_BYTES = 1024 * 1024;
const EXPORT_CONST_HINT = /export\s+const\s+\w+/;
const CANDIDATE_EXTS = [
  '',
  '.tsx',
  '.jsx',
  '.ts',
  '.js',
  '/index.tsx',
  '/index.jsx',
  '/index.ts',
  '/index.js',
] as const;

export type ImportedSymbol = {
  readonly baseFile: string;
  readonly exportedName: string;
};

export type RouteParseContext = {
  readonly file: string;
  readonly sourceDir: string;
  readonly imports: ReadonlyMap<string, ImportedSymbol>;
  readonly constantsByFile: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

export function resolveSpecifierBase(
  fromFile: string,
  sourceDir: string,
  specifier: string,
): string | undefined {
  if (specifier.startsWith('@/')) {
    return posix.normalize(`${sourceDir}/${specifier.slice(2)}`);
  }
  if (specifier.startsWith('.')) {
    return posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  }
  return undefined;
}

function unwrapExpression(node: AstNode | undefined): AstNode | undefined {
  let curr = node;
  while (
    curr?.type === 'TSAsExpression' ||
    curr?.type === 'TSTypeAssertion' ||
    curr?.type === 'TSSatisfiesExpression' ||
    curr?.type === 'ParenthesizedExpression'
  ) {
    curr = asAstNode(curr['expression']);
  }
  return curr;
}

function unwrapObjectExpression(node: AstNode | undefined): AstNode | undefined {
  const expr = unwrapExpression(node);
  if (!expr) return undefined;
  if (expr.type === 'ObjectExpression') return expr;
  if (expr.type === 'CallExpression') {
    const callee = asAstNode(expr['callee']);
    const obj = asAstNode(callee?.['object']);
    const prop = asAstNode(callee?.['property']);
    if (
      callee?.type === 'MemberExpression' &&
      obj?.type === 'Identifier' &&
      obj['name'] === 'Object' &&
      prop?.type === 'Identifier' &&
      prop['name'] === 'freeze'
    ) {
      const args = Array.isArray(expr['arguments']) ? expr['arguments'] : [];
      return unwrapObjectExpression(asAstNode(args[0]));
    }
  }
  return undefined;
}

function collectObjectStrings(obj: AstNode, prefix: string, out: Map<string, string>): void {
  const props = Array.isArray(obj['properties']) ? obj['properties'] : [];
  for (const raw of props) {
    const prop = asAstNode(raw);
    if (prop?.type !== 'ObjectProperty' || prop['computed'] === true) continue;
    const key = asAstNode(prop['key']);
    const keyName =
      key?.type === 'Identifier'
        ? key['name']
        : key?.type === 'StringLiteral'
          ? key['value']
          : undefined;
    if (typeof keyName !== 'string') continue;

    const nextPrefix = `${prefix}.${keyName}`;
    const val = unwrapExpression(asAstNode(prop['value']));
    if (val?.type === 'StringLiteral' && typeof val['value'] === 'string') {
      out.set(nextPrefix, val['value']);
      continue;
    }
    const nestedObj = unwrapObjectExpression(val);
    if (nestedObj) {
      collectObjectStrings(nestedObj, nextPrefix, out);
    }
  }
}

export function extractExportedConstants(ast: AstNode): Map<string, string> {
  const out = new Map<string, string>();
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type !== 'ExportNamedDeclaration') continue;
    const decl = asAstNode(stmt['declaration']);
    if (decl?.type !== 'VariableDeclaration') continue;
    const list = Array.isArray(decl['declarations']) ? decl['declarations'] : [];
    for (const raw of list) {
      const d = asAstNode(raw);
      const id = asAstNode(d?.['id']);
      const obj = unwrapObjectExpression(asAstNode(d?.['init']));
      if (id?.type === 'Identifier' && typeof id['name'] === 'string' && obj) {
        collectObjectStrings(obj, id['name'], out);
      }
    }
  }
  return out;
}

export async function collectProjectRouteConstants(
  fs: FileSystemPort,
  root: string,
  codeFiles: readonly string[],
): Promise<Map<string, ReadonlyMap<string, string>>> {
  const byFile = new Map<string, ReadonlyMap<string, string>>();
  for (const file of codeFiles) {
    const read = await fs.readText(root, file, { maxBytes: MAX_BYTES });
    if (!read.ok || !EXPORT_CONST_HINT.test(read.value)) continue;
    try {
      const ast = parseJsxAst(read.value);
      const map = extractExportedConstants(ast);
      if (map.size > 0) byFile.set(file, map);
    } catch {
      // Ignore files with syntax errors while scanning constants
    }
  }
  return byFile;
}

export function extractImportedSymbols(
  ast: AstNode,
  file: string,
  sourceDir: string,
): Map<string, ImportedSymbol> {
  const map = new Map<string, ImportedSymbol>();
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const sourceNode = asAstNode(stmt['source']);
    const source = typeof sourceNode?.['value'] === 'string' ? sourceNode['value'] : '';
    const baseFile = resolveSpecifierBase(file, sourceDir, source);
    if (!baseFile) continue;

    const specifiers = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
    for (const raw of specifiers) {
      const spec = asAstNode(raw);
      const local = asAstNode(spec?.['local']);
      const localName = typeof local?.['name'] === 'string' ? local['name'] : undefined;
      if (!localName) continue;
      const imported = asAstNode(spec?.['imported']);
      const exportedName =
        imported?.type === 'Identifier' && typeof imported['name'] === 'string'
          ? imported['name']
          : localName;
      map.set(localName, { baseFile, exportedName });
    }
  }
  return map;
}

function memberChainOf(
  node: AstNode | undefined,
): { readonly root: string; readonly rest: readonly string[] } | undefined {
  const parts: string[] = [];
  let curr = unwrapExpression(node);
  while (curr?.type === 'MemberExpression' && curr['computed'] !== true) {
    const prop = asAstNode(curr['property']);
    if (prop?.type !== 'Identifier' || typeof prop['name'] !== 'string') return undefined;
    parts.unshift(prop['name']);
    curr = unwrapExpression(asAstNode(curr['object']));
  }
  if (curr?.type === 'Identifier' && typeof curr['name'] === 'string' && parts.length > 0) {
    return { root: curr['name'], rest: parts };
  }
  return undefined;
}

export function resolveRoutePathNode(
  rawNode: AstNode | undefined,
  ctx: RouteParseContext,
): string | undefined {
  if (!rawNode) return undefined;
  const unwrapped =
    rawNode.type === 'JSXExpressionContainer'
      ? unwrapExpression(asAstNode(rawNode['expression']))
      : unwrapExpression(rawNode);
  if (!unwrapped) return undefined;
  if (unwrapped.type === 'StringLiteral' && typeof unwrapped['value'] === 'string') {
    return unwrapped['value'];
  }
  const chain = memberChainOf(unwrapped);
  if (!chain) return undefined;
  const symbol = ctx.imports.get(chain.root);
  if (!symbol) return undefined;
  const lookupKey = [symbol.exportedName, ...chain.rest].join('.');
  for (const ext of CANDIDATE_EXTS) {
    const candidate = ext === '' ? symbol.baseFile : `${symbol.baseFile}${ext}`;
    const table = ctx.constantsByFile.get(candidate);
    if (table?.has(lookupKey)) return table.get(lookupKey);
  }
  return undefined;
}

export function findDynamicImportSpecifier(node: AstNode): string | undefined {
  let specifier: string | undefined;
  function search(n: unknown): void {
    if (specifier || !n || typeof n !== 'object') return;
    const obj = n as AstNode;
    if (obj.type === 'CallExpression') {
      const callee = asAstNode(obj['callee']);
      if (callee?.type === 'Import') {
        const args: unknown[] = Array.isArray(obj['arguments']) ? obj['arguments'] : [];
        const first = asAstNode(args[0]);
        if (first?.type === 'StringLiteral' && typeof first['value'] === 'string') {
          specifier = first['value'];
          return;
        }
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') search(v);
    }
  }
  search(node);
  return specifier;
}

export function extractImportedFiles(
  ast: AstNode,
  file: string,
  sourceDir: string,
): Map<string, string> {
  const map = new Map<string, string>();
  const program = asAstNode(ast['program']);
  const body: unknown[] = Array.isArray(program?.['body']) ? program['body'] : [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ImportDeclaration') {
      const sourceNode = asAstNode(stmt['source']);
      const source = typeof sourceNode?.['value'] === 'string' ? sourceNode['value'] : '';
      const resolved = resolveSpecifierBase(file, sourceDir, source);
      if (!resolved) continue;

      const specifiers: unknown[] = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
      for (const raw of specifiers) {
        const spec = asAstNode(raw);
        const local = asAstNode(spec?.['local']);
        if (typeof local?.['name'] === 'string') map.set(local['name'], resolved);
      }
    } else if (stmt?.type === 'VariableDeclaration') {
      const decls: unknown[] = Array.isArray(stmt['declarations']) ? stmt['declarations'] : [];
      for (const raw of decls) {
        const decl = asAstNode(raw);
        const id = asAstNode(decl?.['id']);
        const init = asAstNode(decl?.['init']);
        if (typeof id?.['name'] === 'string' && init) {
          const spec = findDynamicImportSpecifier(init);
          const resolved = spec ? resolveSpecifierBase(file, sourceDir, spec) : undefined;
          if (resolved) map.set(id['name'], resolved);
        }
      }
    }
  }
  return map;
}

export async function resolvePageFile(
  fs: FileSystemPort,
  root: string,
  importPath: string | undefined,
): Promise<string | undefined> {
  if (importPath === undefined) return undefined;
  for (const ext of CANDIDATE_EXTS) {
    const candidate = ext === '' ? importPath : `${importPath}${ext}`;
    if (await fs.exists(root, candidate)) return candidate;
  }
  return undefined;
}
