// Typed component prop schema + current JSX prop values reader (TK-49).
import * as posixPath from 'node:path/posix';

import type {
  ComponentPropKind,
  ComponentPropSpec,
  ComponentPropsResponse,
  Result,
} from '@kumicraft/shared';
import { err, isValidSettablePropName, ok, parseLocString } from '@kumicraft/shared';
import { z } from 'zod';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import {
  asAstNode,
  type AstNode,
  getJsxTagName,
  parseJsxAst,
} from '../source-editor/ast-helpers.ts';
import { readConstantProp } from '../source-editor/prop-mutator.ts';
import { findNodeAt } from '../source-editor/source-editor-lookup.ts';

type SchemaProp = {
  readonly name: string;
  readonly kind: ComponentPropKind;
  readonly required: boolean;
  readonly options?: readonly string[];
};

export type ComponentPropsDeps = {
  readonly fs: FileSystemPort;
  readonly process?: ProcessPort | undefined;
  readonly tsInspectScript?: string | undefined;
};

const TsInspectPropItemSchema = z.object({
  name: z.string().min(1),
  kind: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});
const TsInspectPropsOutputSchema = z.object({ props: z.array(TsInspectPropItemSchema) });

function parseTsInspectOutput(lastLine: string): readonly SchemaProp[] | undefined {
  try {
    const parsed = TsInspectPropsOutputSchema.safeParse(JSON.parse(lastLine));
    if (!parsed.success) return undefined;
    return parsed.data.props.map((p) => {
      const k = p.kind;
      const kind: ComponentPropKind =
        k === 'union' || k === 'boolean' || k === 'number' || k === 'string' ? k : 'complex';
      return {
        name: p.name,
        kind,
        required: p.required === true,
        ...(p.options && p.options.length > 0 ? { options: p.options } : {}),
      };
    });
  } catch {
    return undefined;
  }
}

async function runTsComponentProps(
  deps: ComponentPropsDeps,
  projectRoot: string,
  file: string,
  line: number,
  column: number,
): Promise<readonly SchemaProp[] | undefined> {
  if (!deps.process || !deps.tsInspectScript) return undefined;
  if (!(await deps.fs.exists(projectRoot, 'node_modules/typescript/package.json')))
    return undefined;
  const payload = JSON.stringify({
    mode: 'readComponentProps',
    root: projectRoot,
    file,
    line,
    column,
  });
  const child = deps.process.spawn(process.execPath, [deps.tsInspectScript, payload], {
    cwd: projectRoot,
    timeoutMs: 30_000,
  });
  const out = await child.wait();
  const lastLine = out.stdout.trim().split('\n').at(-1) ?? '';
  if (lastLine.length === 0) return undefined;
  return parseTsInspectOutput(lastLine);
}

function parsePropTypesExpr(expr: AstNode): {
  kind: ComponentPropKind;
  required: boolean;
  options?: readonly string[];
} {
  let cursor: AstNode = expr;
  let required = false;
  if (
    cursor.type === 'MemberExpression' &&
    asAstNode(cursor['property'])?.['name'] === 'isRequired'
  ) {
    required = true;
    const inner = asAstNode(cursor['object']);
    if (inner) cursor = inner;
  }
  if (cursor.type === 'CallExpression') {
    const callee = asAstNode(cursor['callee']);
    const method = asAstNode(callee?.['property'])?.['name'];
    if (method === 'oneOf') {
      const first = asAstNode((Array.isArray(cursor['arguments']) ? cursor['arguments'] : [])[0]);
      if (first?.type === 'ArrayExpression' && Array.isArray(first['elements'])) {
        const opts = first['elements']
          .map(asAstNode)
          .filter(
            (e): e is AstNode => e?.type === 'StringLiteral' && typeof e['value'] === 'string',
          )
          .map((e) => String(e['value']));
        if (opts.length > 0) return { kind: 'union', required, options: opts };
      }
    }
    return { kind: 'complex', required };
  }
  if (cursor.type === 'MemberExpression') {
    const name = asAstNode(cursor['property'])?.['name'];
    if (name === 'bool') return { kind: 'boolean', required };
    if (name === 'number') return { kind: 'number', required };
    if (name === 'string') return { kind: 'string', required };
  }
  return { kind: 'complex', required };
}

function readPropTypesFromCode(code: string, componentName: string): readonly SchemaProp[] {
  let ast: AstNode;
  try {
    ast = parseJsxAst(code);
  } catch {
    return [];
  }
  const body = asAstNode(ast['program'])?.['body'];
  for (const rawStmt of Array.isArray(body) ? body : []) {
    const stmt = asAstNode(rawStmt);
    const expr = stmt?.type === 'ExpressionStatement' ? asAstNode(stmt['expression']) : undefined;
    if (expr?.type !== 'AssignmentExpression') continue;
    const left = asAstNode(expr['left']);
    const right = asAstNode(expr['right']);
    if (left?.type !== 'MemberExpression' || right?.type !== 'ObjectExpression') continue;
    const obj = asAstNode(left['object']);
    const prop = asAstNode(left['property']);
    if (obj?.['name'] !== componentName || prop?.['name'] !== 'propTypes') continue;
    const out: SchemaProp[] = [];
    const propsList = Array.isArray(right['properties']) ? right['properties'] : [];
    for (const rawP of propsList) {
      const p = asAstNode(rawP);
      if (p?.type !== 'ObjectProperty') continue;
      const key = asAstNode(p['key']);
      const val = asAstNode(p['value']);
      const propName = key?.type === 'Identifier' ? String(key['name']) : undefined;
      if (!propName || !val) continue;
      const parsed = parsePropTypesExpr(val);
      out.push({ name: propName, ...parsed });
    }
    return out;
  }
  return [];
}

function findImportSourceForTag(ast: AstNode, tag: string): string | undefined {
  const body = asAstNode(ast['program'])?.['body'];
  for (const rawStmt of Array.isArray(body) ? body : []) {
    const stmt = asAstNode(rawStmt);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const sourceNode = asAstNode(stmt['source']);
    const spec = sourceNode?.type === 'StringLiteral' ? String(sourceNode['value']) : undefined;
    if (!spec) continue;
    const specs = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
    for (const rawS of specs) {
      const s = asAstNode(rawS);
      if (asAstNode(s?.['local'])?.['name'] === tag) return spec;
    }
  }
  return undefined;
}

async function resolveModuleFile(
  fs: FileSystemPort,
  root: string,
  fromRel: string,
  spec: string,
): Promise<string | undefined> {
  let base: string;
  if (spec.startsWith('@/')) {
    base = `src/${spec.slice(2)}`;
  } else if (spec.startsWith('.')) {
    const dir = posixPath.dirname(fromRel);
    base = posixPath.normalize(posixPath.join(dir === '.' ? '' : dir, spec));
  } else {
    return undefined;
  }
  const exts = [
    '',
    '.tsx',
    '.ts',
    '.jsx',
    '.js',
    '/index.tsx',
    '/index.ts',
    '/index.jsx',
    '/index.js',
  ];
  for (const ext of exts) {
    const candidate = `${base}${ext}`;
    if (await fs.exists(root, candidate)) return candidate;
  }
  return undefined;
}

function inferKindFromCurrent(attrState: ReturnType<typeof readConstantProp>): ComponentPropKind {
  if (attrState.kind !== 'constant') return 'complex';
  if (typeof attrState.value === 'boolean') return 'boolean';
  if (typeof attrState.value === 'number') return 'number';
  return 'string';
}

async function resolveSchemaProps(
  deps: ComponentPropsDeps,
  projectRoot: string,
  file: string,
  line: number,
  column: number,
  tag: string,
  sourceCode: string,
  ast: AstNode,
): Promise<{
  schemaProps: readonly SchemaProp[];
  sourceKind: ComponentPropsResponse['sourceKind'];
}> {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    const tsProps = await runTsComponentProps(deps, projectRoot, file, line, column);
    if (tsProps && tsProps.length > 0) return { schemaProps: tsProps, sourceKind: 'typescript' };
  }
  const ptSame = readPropTypesFromCode(sourceCode, tag);
  if (ptSame.length > 0) return { schemaProps: ptSame, sourceKind: 'propTypes' };

  const importSpec = findImportSourceForTag(ast, tag);
  if (importSpec) {
    const modRel = await resolveModuleFile(deps.fs, projectRoot, file, importSpec);
    if (modRel) {
      const modRead = await deps.fs.readText(projectRoot, modRel, { maxBytes: 512_000 });
      if (modRead.ok) {
        const ptImp = readPropTypesFromCode(modRead.value, tag);
        if (ptImp.length > 0) return { schemaProps: ptImp, sourceKind: 'propTypes' };
      }
    }
  }
  return { schemaProps: [], sourceKind: 'unknown' };
}

function mergeComponentProps(
  schemaProps: readonly SchemaProp[],
  currentMap: ReadonlyMap<string, ReturnType<typeof readConstantProp>>,
  initialSourceKind: ComponentPropsResponse['sourceKind'],
): { sourceKind: ComponentPropsResponse['sourceKind']; props: readonly ComponentPropSpec[] } {
  let sourceKind = initialSourceKind;
  const props: ComponentPropSpec[] = [];
  const seen = new Set<string>();

  for (const sp of schemaProps) {
    if (!isValidSettablePropName(sp.name)) continue;
    seen.add(sp.name);
    const cur = currentMap.get(sp.name) ?? { kind: 'absent' as const };
    props.push({
      name: sp.name,
      kind: sp.kind,
      required: sp.required,
      ...(sp.options ? { options: sp.options } : {}),
      ...(cur.kind === 'constant' ? { value: cur.value } : {}),
      hasValue: cur.kind !== 'absent',
      readonlyExpression: cur.kind === 'expression',
    });
  }

  for (const [name, cur] of currentMap) {
    if (seen.has(name)) continue;
    if (sourceKind === 'unknown') sourceKind = 'attributes';
    props.push({
      name,
      kind: inferKindFromCurrent(cur),
      required: false,
      ...(cur.kind === 'constant' ? { value: cur.value } : {}),
      hasValue: cur.kind !== 'absent',
      readonlyExpression: cur.kind === 'expression',
    });
  }
  return { sourceKind, props };
}

function findComponentCallInAst(
  root: AstNode,
  componentName: string,
): { readonly line: number; readonly column: number } | undefined {
  let match: { line: number; column: number } | undefined;
  const visit = (curr: unknown): void => {
    if (match !== undefined) return;
    if (Array.isArray(curr)) {
      for (const item of curr) visit(item);
      return;
    }
    const n = asAstNode(curr);
    if (!n) return;
    if (n.type === 'JSXElement') {
      const opening = asAstNode(n['openingElement']);
      if (opening && getJsxTagName(opening) === componentName && n.loc?.start !== undefined) {
        match = { line: n.loc.start.line, column: n.loc.start.column + 1 };
        return;
      }
    }
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      visit(n[key]);
    }
  };
  visit(root);
  return match;
}

async function resolveBoundaryCallSite(
  deps: ComponentPropsDeps,
  projectRoot: string,
  parentLoc: string,
  componentName: string,
): Promise<{ readonly loc: string; readonly tag: string } | undefined> {
  const parsed = parseLocString(parentLoc);
  if (!parsed) return undefined;
  const readRes = await deps.fs.readText(projectRoot, parsed.file, { maxBytes: 1_000_000 });
  if (!readRes.ok) return undefined;
  let ast: AstNode;
  try {
    ast = parseJsxAst(readRes.value);
  } catch {
    return undefined;
  }
  const parentNode = findNodeAt(ast, parsed.line, parsed.column);
  if (!parentNode) return undefined;
  const found = findComponentCallInAst(parentNode, componentName);
  if (!found) return undefined;
  return {
    loc: `${parsed.file}:${String(found.line)}:${String(found.column)}`,
    tag: componentName,
  };
}

export async function readComponentProps(
  deps: ComponentPropsDeps,
  projectRoot: string,
  loc: string,
  tag: string,
  boundary?: { readonly parentLoc?: string; readonly componentName?: string },
): Promise<Result<ComponentPropsResponse>> {
  const resolved =
    !/^[A-Z]/.test(tag) && boundary?.parentLoc !== undefined && boundary.componentName !== undefined
      ? await resolveBoundaryCallSite(deps, projectRoot, boundary.parentLoc, boundary.componentName)
      : undefined;
  const effectiveLoc = resolved?.loc ?? loc;
  const effectiveTag = resolved?.tag ?? tag;

  const parsedLoc = parseLocString(effectiveLoc);
  if (!parsedLoc) return err({ code: 'E016', params: { field: 'loc' } });
  const readRes = await deps.fs.readText(projectRoot, parsedLoc.file, { maxBytes: 1_000_000 });
  if (!readRes.ok) return readRes;

  let ast: AstNode;
  try {
    ast = parseJsxAst(readRes.value);
  } catch {
    return err({ code: 'E024', params: { line: 1, column: 1 } });
  }
  const target = findNodeAt(ast, parsedLoc.line, parsedLoc.column);
  if (!target) return err({ code: 'E017', params: { loc: effectiveLoc, reason: 'moved' } });

  const opening = asAstNode(target['openingElement']);
  const rawAttrs = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  const currentMap = new Map<string, ReturnType<typeof readConstantProp>>();
  for (const rawA of rawAttrs) {
    const a = asAstNode(rawA);
    if (a?.type !== 'JSXAttribute') continue;
    const name = asAstNode(a['name'])?.['name'];
    if (typeof name !== 'string' || !isValidSettablePropName(name)) continue;
    currentMap.set(name, readConstantProp(a));
  }

  const schema = await resolveSchemaProps(
    deps,
    projectRoot,
    parsedLoc.file,
    parsedLoc.line,
    parsedLoc.column,
    effectiveTag,
    readRes.value,
    ast,
  );
  const merged = mergeComponentProps(schema.schemaProps, currentMap, schema.sourceKind);
  return ok({ loc: effectiveLoc, tag: effectiveTag, ...merged });
}
