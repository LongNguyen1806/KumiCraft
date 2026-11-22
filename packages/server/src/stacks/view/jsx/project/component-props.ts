// Props of an extracted component (FR-72): the names the selection uses from the old component
// become props of the same name; in TypeScript each gets the type the project's TypeScript reads
// at its first use. A type declared only in the old file is exported there and imported.
import { err, ok, type Result } from '@kumicraft/shared';

import type { PropTypesPort } from '../../../../kernel/features.ts';
import { asAstNode, type AstNode } from '../../../../lib/ast-helpers.ts';
import type { ProcessPort } from '../../../../ports/process-port.ts';
import { collectMatchingImportStatements } from '../structure/element-text.ts';
import { remapImportStatement } from './component-scope.ts';

export type PropsPlan = {
  /** `{ items, onPick }` or `{ items, onPick }: CardProps`, or '' without props. */
  readonly signature: string;
  /** `type CardProps = { … };` (TypeScript only). */
  readonly typeDecl?: string | undefined;
  /** Import statements the types need in the new file. */
  readonly typeImports: readonly string[];
  /** Offsets in the old file where `export ` goes before a type the new file imports. */
  readonly exportAt: readonly number[];
  /** ` items={items} onPick={onPick}` for the tag that replaces the selection. */
  readonly usage: string;
};

export type PropsContext = {
  readonly name: string;
  readonly sourceAst: AstNode;
  readonly sourceCode: string;
  readonly sourceRel: string;
  readonly newFileRel: string;
  readonly targetNode: AstNode;
  readonly props: readonly string[];
  readonly typescript: boolean;
};

/** Offset of the first identifier `name` inside `node` (an expression or a JSX tag name). */
function firstUse(node: unknown, name: string): number | undefined {
  const ast = asAstNode(node);
  if (!ast) return undefined;
  const isName =
    (ast.type === 'Identifier' || ast.type === 'JSXIdentifier') && ast['name'] === name;
  if (isName && typeof ast.start === 'number') return ast.start;
  for (const key of Object.keys(ast)) {
    if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
    const child = ast[key];
    for (const item of Array.isArray(child) ? child : [child]) {
      if (item === undefined || typeof item !== 'object') continue;
      const found = firstUse(item, name);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

type LocalType = { readonly name: string; readonly start: number; readonly exported: boolean };

const TYPE_DECLS = new Set([
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSEnumDeclaration',
  'ClassDeclaration',
]);

/** Types, interfaces, enums and classes declared at the top of the old file. */
function localTypes(ast: AstNode): Map<string, LocalType> {
  const out = new Map<string, LocalType>();
  const body = asAstNode(ast['program'])?.['body'];
  for (const item of Array.isArray(body) ? body : []) {
    const stmt = asAstNode(item);
    const exported = stmt?.type === 'ExportNamedDeclaration';
    const decl = exported ? asAstNode(stmt['declaration']) : stmt;
    const id = asAstNode(decl?.['id']);
    if (!decl || !TYPE_DECLS.has(decl.type) || typeof id?.['name'] !== 'string') continue;
    if (typeof decl.start !== 'number') continue;
    out.set(id['name'], { name: id['name'], start: decl.start, exported });
  }
  return out;
}

function relativeModule(fromFile: string, toFile: string): string {
  const from = fromFile.split('/').slice(0, -1);
  const to = toFile.replace(/\.(tsx?|jsx?)$/, '').split('/');
  let common = 0;
  while (common < from.length && from[common] === to[common]) common++;
  const up = from.slice(common).map(() => '..');
  const path = [...up, ...to.slice(common)].join('/');
  return path.startsWith('.') ? path : `./${path}`;
}

/** Imports and `export` additions the type texts need; a type the new file cannot reach fails. */
function typeNeeds(ctx: PropsContext, texts: readonly string[]) {
  const words = new Set(texts.join(' ').match(/[A-Za-z_$][\w$]*/g) ?? []);
  const locals = localTypes(ctx.sourceAst);
  const own = [...words].filter((w) => locals.has(w));
  const imported = collectMatchingImportStatements(ctx.sourceAst, ctx.sourceCode, [...words]).map(
    (stmt) => remapImportStatement(stmt, ctx.sourceRel, ctx.newFileRel),
  );
  const fromSource =
    own.length === 0
      ? []
      : [
          `import type { ${own.join(', ')} } from '${relativeModule(ctx.newFileRel, ctx.sourceRel)}';`,
        ];
  const exportAt = own
    .map((w) => locals.get(w))
    .filter((t): t is LocalType => t !== undefined && !t.exported)
    .map((t) => t.start);
  return { typeImports: [...imported, ...fromSource], exportAt };
}

/** `import("./types").User` points from the old file: from the new one it is another path. */
function remapInlineImports(text: string, ctx: PropsContext): string {
  return text.replace(/import\("(\.[^"]+)"\)/g, (_all, spec: string) => {
    const remapped = remapImportStatement(
      `import x from '${spec}';`,
      ctx.sourceRel,
      ctx.newFileRel,
    );
    const path = /'([^']+)'/.exec(remapped)?.[1] ?? spec;
    return `import("${path}")`;
  });
}

export async function planProps(
  ctx: PropsContext,
  propTypes: PropTypesPort | undefined,
): Promise<Result<PropsPlan>> {
  if (ctx.props.length === 0) {
    return ok({ signature: '', typeImports: [], exportAt: [], usage: '' });
  }
  const usage = ctx.props.map((p) => ` ${p}={${p}}`).join('');
  const names = ctx.props.join(', ');
  if (!ctx.typescript) {
    return ok({ signature: `{ ${names} }`, typeImports: [], exportAt: [], usage });
  }
  if (propTypes === undefined) return err({ code: 'E023', params: { reason: 'propTypes' } });
  const uses = ctx.props.map((name) => ({ name, offset: firstUse(ctx.targetNode, name) ?? -1 }));
  const read = await propTypes({ file: ctx.sourceRel, names: uses });
  if (!read.ok) return read;
  const missing = ctx.props.find((_, i) => (read.value[i] ?? '') === '');
  if (missing !== undefined) {
    return err({ code: 'E023', params: { reason: 'propType', name: missing } });
  }
  const texts = read.value.map((t) => remapInlineImports(t, ctx));
  const typeName = `${ctx.name}Props`;
  const fields = ctx.props.map((p, i) => `  ${p}: ${texts[i] ?? 'unknown'};`);
  const needs = typeNeeds(ctx, texts);
  return ok({
    signature: `{ ${names} }: ${typeName}`,
    typeDecl: `type ${typeName} = {\n${fields.join('\n')}\n};`,
    ...needs,
    usage,
  });
}

/** Runs the `prop-types` child script with the project's TypeScript (trusted projects only). */
export function createPropTypesPort(deps: {
  readonly process: ProcessPort;
  readonly scriptPath: string;
  readonly root: string;
}): PropTypesPort {
  return async ({ file, names }) => {
    const request = JSON.stringify({ root: deps.root, file, names });
    const child = deps.process.spawn(process.execPath, [deps.scriptPath, request], {
      cwd: deps.root,
      timeoutMs: 60_000,
    });
    const out = await child.wait();
    const line = out.stdout.trim().split('\n').at(-1) ?? '';
    try {
      const parsed: unknown = JSON.parse(line);
      const types = parsed instanceof Object && 'types' in parsed ? parsed.types : undefined;
      if (Array.isArray(types) && types.every((t) => typeof t === 'string')) return ok(types);
    } catch {
      // Falls through to the error below.
    }
    return err({ code: 'E023', params: { reason: 'propTypes' } });
  };
}

export type { PropTypesPort };
