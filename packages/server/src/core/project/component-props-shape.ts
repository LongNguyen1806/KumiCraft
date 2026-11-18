// Which props the Inspector shows for a component use, and what each one is
// (docs/construction/giao-viec/thiet-ke-component.md §3, §5). Only the knobs the author opened:
// never React's own HTML attributes, events, `className`, nor props passed on through `...rest`.
import type { ComponentPropRole, ComponentPropSpec } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { type PropDefinition, readPropDefinition, roleByName } from './component-prop-roles.ts';

export type PropOrigin = 'react' | 'package' | 'project';

/** Where the component comes from, and what its definition says about its props. */
export type ComponentOrigin = {
  readonly componentFile?: string | undefined;
  readonly packageName?: string | undefined;
  readonly definition?: PropDefinition | undefined;
};

const HIDDEN_NAMES = new Set([
  'key',
  'ref',
  'children',
  'className',
  'class',
  'style',
  'sx',
  'classes',
  'as',
  'dangerouslySetInnerHTML',
]);

function isHiddenName(name: string): boolean {
  return HIDDEN_NAMES.has(name) || /^on[A-Z]/.test(name) || /^(aria|data)-/.test(name);
}

type ImportOf = { readonly source: string; readonly imported: string };

/** `import X from 'a'` → `{ a, default }`; `import { Y as X } from 'a'` → `{ a, Y }`. */
function importOf(ast: AstNode, tag: string): ImportOf | undefined {
  const local = tag.split('.')[0] ?? tag;
  const body = asAstNode(ast['program'])?.['body'];
  for (const raw of Array.isArray(body) ? body : []) {
    const stmt = asAstNode(raw);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const source = asAstNode(stmt['source'])?.['value'];
    if (typeof source !== 'string') continue;
    for (const rawSpec of Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : []) {
      const spec = asAstNode(rawSpec);
      if (asAstNode(spec?.['local'])?.['name'] !== local) continue;
      if (spec?.type === 'ImportDefaultSpecifier') return { source, imported: 'default' };
      const imported = asAstNode(spec?.['imported']);
      const name = imported?.['name'] ?? imported?.['value'];
      return { source, imported: typeof name === 'string' ? name : local };
    }
  }
  return undefined;
}

/** `@mui/material/Button` → `@mui/material`; `react-bootstrap` → `react-bootstrap`. */
function packageNameOf(source: string): string {
  const parts = source.split('/');
  return source.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? source);
}

function isProjectImport(source: string): boolean {
  return /^(\.{1,2}\/|@\/|~\/|#)/.test(source);
}

async function readDefinitionFile(
  fs: FileSystemPort,
  root: string,
  file: string,
  exportName: string,
): Promise<PropDefinition | undefined> {
  const read = await fs.readText(root, file, { maxBytes: 512_000 });
  if (!read.ok) return undefined;
  try {
    return readPropDefinition(parseJsxAst(read.value), exportName);
  } catch {
    return undefined;
  }
}

/** Finds where the tag of a use comes from: the same file, another project file, or a package. */
export async function resolveComponentOrigin(
  fs: FileSystemPort,
  root: string,
  useFile: string,
  useAst: AstNode,
  tag: string,
  resolveModule: (spec: string) => Promise<string | undefined>,
): Promise<ComponentOrigin> {
  if (tag.includes('.')) return {}; // `<Tabs.List>`: a part of a component, read by type only
  const imp = importOf(useAst, tag);
  if (imp === undefined) {
    const definition = readPropDefinition(useAst, tag);
    return definition === undefined ? {} : { componentFile: useFile, definition };
  }
  if (!isProjectImport(imp.source)) return { packageName: packageNameOf(imp.source) };
  const file = await resolveModule(imp.source);
  if (file === undefined) return {};
  return {
    componentFile: file,
    definition: await readDefinitionFile(fs, root, file, imp.imported),
  };
}

type RawSpec = ComponentPropSpec & { readonly origin?: PropOrigin | undefined };

function isShown(p: RawSpec, origin: ComponentOrigin): boolean {
  if (isHiddenName(p.name)) return false;
  if (p.hasValue) return true; // what the page already sets is always shown
  if (p.kind === 'complex') return false; // functions, objects, elements: code only
  if (origin.definition !== undefined) return origin.definition.get(p.name)?.used === true;
  if (p.origin === 'react') return false;
  return origin.packageName !== undefined || p.origin !== 'package';
}

function roleOf(p: RawSpec, origin: ComponentOrigin): ComponentPropRole {
  const read = origin.definition?.get(p.name)?.role;
  if (read !== undefined && read !== 'advanced') return read;
  return roleByName(p.name, p.kind) ?? (p.kind === 'boolean' ? 'state' : 'advanced');
}

/** A knob the definition names but no type lists (a JS component, or no TypeScript at hand). */
function fromDefinition(name: string, origin: ComponentOrigin): RawSpec {
  const use = origin.definition?.get(name);
  const fallback = use?.defaultValue;
  const kind =
    typeof fallback === 'boolean' || use?.role === 'toggle'
      ? 'boolean'
      : typeof fallback === 'number'
        ? 'number'
        : 'string';
  return { name, kind, required: false, hasValue: false, readonlyExpression: false };
}

/** The props to show, each with its role and the definition's default. */
export function shapeComponentProps(
  raw: readonly RawSpec[],
  origin: ComponentOrigin,
): ComponentPropSpec[] {
  const known = new Set(raw.map((p) => p.name));
  const extra = [...(origin.definition?.entries() ?? [])]
    .filter(([name, use]) => use.used && !known.has(name))
    .map(([name]) => fromDefinition(name, origin));
  return [...raw, ...extra]
    .filter((p) => isShown(p, origin))
    .map(({ origin: _from, ...p }) => {
      const use = origin.definition?.get(p.name);
      const fallback = use?.defaultValue;
      // Shown only because the page sets it: the definition never reads it.
      const unused = origin.definition !== undefined && use?.used !== true;
      return {
        ...p,
        role: roleOf(p, origin),
        ...(fallback !== undefined ? { defaultValue: fallback } : {}),
        ...(unused ? { unused: true as const } : {}),
      };
    });
}
