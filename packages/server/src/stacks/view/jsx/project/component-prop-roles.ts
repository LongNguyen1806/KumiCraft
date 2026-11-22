// What each prop of a component does on screen, read from where its definition uses it
// (docs/construction/giao-viec/thiet-ke-component.md §3). `<h3>{title}</h3>` is text, `src={image}`
// an image, `{showSale && …}` a show/hide switch, `styles[variant]` a style choice. The name and
// the type of a prop do not say this; two "404" components by two authors differ completely.
import type { ComponentPropRole, SetPropValue } from '@kumicraft/shared';

import { asAstNode, type AstNode, getJsxTagName } from '../../../../lib/ast-helpers.ts';

export type PropUse = {
  /** False when the definition never reads the prop: setting it changes nothing. */
  readonly used: boolean;
  readonly role?: ComponentPropRole | undefined;
  readonly defaultValue?: SetPropValue | undefined;
};

/** The props a definition names (`({ title, featured = false, ...rest })`), by name. */
export type PropDefinition = ReadonlyMap<string, PropUse>;

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/** Most telling first: a prop used both in `src` and in `alt` is the image. */
const ROLE_RANK: readonly ComponentPropRole[] = [
  'image',
  'link',
  'toggle',
  'style',
  'content',
  'behavior',
  'data',
  'state',
  'advanced',
];

const IMAGE_ATTRS = new Set(['src', 'srcSet', 'poster']);
const LINK_ATTRS = new Set(['href', 'to']);
const TEXT_ATTRS = new Set(['alt', 'title', 'placeholder', 'aria-label', 'label']);
const STYLE_ATTRS = new Set(['className', 'class', 'style']);

const IMAGE_NAME =
  /^(src|image|img|photo|picture|avatar|logo|thumbnail|poster|cover)$|(Image|Src|Photo|Avatar|Logo|Thumbnail)$/;
const LINK_NAME = /^(href|to|url|link)$|(Href|Url|Link)$/;
const TOGGLE_NAME = /^(show|hide|has|with)[A-Z]/;
const STATE_NAME =
  /^(disabled|loading|required|readOnly|checked|open|active|selected|fullWidth|block)$/;
const STYLE_NAME =
  /^(variant|size|color|tone|theme|kind|appearance|shape|align|orientation|elevation|rounded|radius|shadow|intent)$/;
const CONTENT_NAME =
  /^(title|name|label|text|heading|subtitle|description|caption|content|message|price|alt|placeholder|code|badge|author|date)$|(Title|Label|Text|Name|Description)$/;

/** The role a prop's name suggests, for props whose use cannot be read (a package, `...props`). */
export function roleByName(name: string, kind: string): ComponentPropRole | undefined {
  if (IMAGE_NAME.test(name)) return 'image';
  if (LINK_NAME.test(name)) return 'link';
  if (kind === 'boolean' && TOGGLE_NAME.test(name)) return 'toggle';
  if (STATE_NAME.test(name)) return 'state';
  if (STYLE_NAME.test(name)) return 'style';
  if (CONTENT_NAME.test(name)) return 'content';
  return undefined;
}

function nameOf(node: unknown): string | undefined {
  const n = asAstNode(node);
  const isName = n?.type === 'Identifier' || n?.type === 'JSXIdentifier';
  if (isName && typeof n['name'] === 'string') return n['name'];
  if (n?.type === 'StringLiteral' && typeof n['value'] === 'string') return n['value'];
  return undefined;
}

function literalOf(node: unknown): SetPropValue | undefined {
  const n = asAstNode(node);
  const value = n?.['value'];
  if (n?.type === 'StringLiteral' && typeof value === 'string') return value;
  if (n?.type === 'NumericLiteral' && typeof value === 'number') return value;
  if (n?.type === 'BooleanLiteral' && typeof value === 'boolean') return value;
  if (n?.type === 'UnaryExpression' && n['operator'] === '-') {
    const arg = literalOf(n['argument']);
    return typeof arg === 'number' ? -arg : undefined;
  }
  return undefined;
}

type TopLevel = {
  readonly locals: ReadonlyMap<string, AstNode>;
  readonly aliases: ReadonlyMap<string, string>;
  readonly defaultExport: AstNode | undefined;
};

function addDeclaration(node: AstNode, locals: Map<string, AstNode>): void {
  if (node.type === 'FunctionDeclaration') {
    const name = nameOf(node['id']);
    if (name !== undefined) locals.set(name, node);
    return;
  }
  if (node.type !== 'VariableDeclaration' || !Array.isArray(node['declarations'])) return;
  for (const raw of node['declarations']) {
    const d = asAstNode(raw);
    const name = nameOf(d?.['id']);
    const init = asAstNode(d?.['init']);
    if (name !== undefined && init !== undefined) locals.set(name, init);
  }
}

function readTopLevel(ast: AstNode): TopLevel {
  const locals = new Map<string, AstNode>();
  const aliases = new Map<string, string>();
  let defaultExport: AstNode | undefined;
  const body = asAstNode(ast['program'])?.['body'];
  for (const raw of Array.isArray(body) ? body : []) {
    const stmt = asAstNode(raw);
    if (stmt === undefined) continue;
    if (stmt.type === 'ExportDefaultDeclaration') {
      defaultExport = asAstNode(stmt['declaration']);
      if (defaultExport !== undefined) addDeclaration(defaultExport, locals);
      continue;
    }
    const inner = stmt.type === 'ExportNamedDeclaration' ? asAstNode(stmt['declaration']) : stmt;
    if (inner !== undefined) addDeclaration(inner, locals);
    const specifiers = stmt.type === 'ExportNamedDeclaration' ? stmt['specifiers'] : undefined;
    for (const s of Array.isArray(specifiers) ? specifiers : []) {
      const local = nameOf(asAstNode(s)?.['local']);
      const exported = nameOf(asAstNode(s)?.['exported']);
      if (local !== undefined && exported !== undefined) aliases.set(exported, local);
    }
  }
  return { locals, aliases, defaultExport };
}

/** The function behind `memo(…)`, `forwardRef(…)`, `X as …` or a local name. */
function unwrapFunction(node: AstNode | undefined, top: TopLevel, depth = 0): AstNode | undefined {
  if (node === undefined || depth > 5) return undefined;
  if (FUNCTION_TYPES.has(node.type)) return node;
  if (node.type === 'Identifier') {
    const name = nameOf(node);
    return unwrapFunction(name === undefined ? undefined : top.locals.get(name), top, depth + 1);
  }
  if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression') {
    return unwrapFunction(asAstNode(node['expression']), top, depth + 1);
  }
  if (node.type !== 'CallExpression' || !Array.isArray(node['arguments'])) return undefined;
  for (const arg of node['arguments']) {
    const found = unwrapFunction(asAstNode(arg), top, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

type Bindings = {
  /** Local variable → prop name (`{ title: heading }` binds `heading` to `title`). */
  readonly locals: Map<string, string>;
  readonly defaults: Map<string, SetPropValue>;
  readonly declared: Set<string>;
  propsName: string | undefined;
};

function readObjectPattern(pattern: AstNode, b: Bindings): void {
  const props = pattern['properties'];
  for (const raw of Array.isArray(props) ? props : []) {
    const p = asAstNode(raw);
    if (p?.type !== 'ObjectProperty') continue; // `...rest` goes on to an element: not a knob
    const key = nameOf(p['key']);
    if (key === undefined) continue;
    b.declared.add(key);
    const value = asAstNode(p['value']);
    const local = value?.type === 'AssignmentPattern' ? asAstNode(value['left']) : value;
    const localName = nameOf(local);
    if (localName !== undefined) b.locals.set(localName, key);
    const fallback = value?.type === 'AssignmentPattern' ? literalOf(value['right']) : undefined;
    if (fallback !== undefined) b.defaults.set(key, fallback);
  }
}

function readParam(fn: AstNode, b: Bindings): void {
  const params = Array.isArray(fn['params']) ? fn['params'] : [];
  let first = asAstNode(params[0]);
  if (first?.type === 'AssignmentPattern') first = asAstNode(first['left']);
  if (first?.type === 'ObjectPattern') readObjectPattern(first, b);
  else b.propsName = nameOf(first);
}

type Visit = (node: AstNode, parents: readonly AstNode[]) => void;

function walk(node: unknown, parents: AstNode[], visit: Visit): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, parents, visit);
    return;
  }
  const n = asAstNode(node);
  if (n === undefined) return;
  visit(n, parents);
  parents.push(n);
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
    walk(n[key], parents, visit);
  }
  parents.pop();
}

/** True for what a condition shows or hides: an element, a fragment or nothing. */
function isPart(node: unknown): boolean {
  const n = asAstNode(node);
  return n?.type === 'JSXElement' || n?.type === 'JSXFragment' || n?.type === 'NullLiteral';
}

function attributeRole(attr: AstNode, opening: AstNode | undefined): ComponentPropRole {
  const name = nameOf(attr['name']) ?? '';
  if (STYLE_ATTRS.has(name)) return 'style';
  if (IMAGE_ATTRS.has(name)) return 'image';
  if (LINK_ATTRS.has(name)) return 'link';
  if (TEXT_ATTRS.has(name)) return 'content';
  const tag = opening === undefined ? '' : (getJsxTagName(opening) ?? '');
  // Passed on to another component: what that knob is called says what it does there.
  if (/^[A-Z]/.test(tag)) return roleByName(name, '') ?? 'advanced';
  return 'advanced';
}

function callRole(call: AstNode): ComponentPropRole | undefined {
  const callee = asAstNode(call['callee']);
  const name = nameOf(callee) ?? nameOf(callee?.['property']);
  if (name === 'setTimeout' || name === 'setInterval' || name === 'slice') return 'behavior';
  if (name === 'navigate' || name === 'push' || name === 'replace') return 'link';
  return undefined;
}

function stepRole(
  parent: AstNode,
  child: AstNode,
  grand: AstNode | undefined,
): ComponentPropRole | 'stop' | undefined {
  switch (parent.type) {
    case 'JSXAttribute':
      return attributeRole(parent, grand);
    case 'JSXExpressionContainer':
      return grand?.type === 'JSXElement' || grand?.type === 'JSXFragment' ? 'content' : undefined;
    case 'ConditionalExpression':
      if (parent['test'] !== child) return undefined;
      return isPart(parent['consequent']) || isPart(parent['alternate']) ? 'toggle' : 'style';
    case 'LogicalExpression':
      if (parent['left'] !== child) return undefined;
      return isPart(parent['right']) ? 'toggle' : 'style';
    case 'IfStatement':
      return parent['test'] === child ? 'toggle' : 'stop';
    case 'MemberExpression':
      if (parent['computed'] === true && parent['property'] === child) return 'style';
      return parent['object'] === child ? 'data' : undefined;
    case 'BinaryExpression':
      return asAstNode(parent['left'])?.type === 'StringLiteral' ||
        asAstNode(parent['right'])?.type === 'StringLiteral'
        ? 'style'
        : undefined;
    case 'CallExpression':
      return callRole(parent) ?? 'stop';
    default:
      return /Statement$|Declaration$|Declarator$/.test(parent.type) ? 'stop' : undefined;
  }
}

/** The role of one read of a prop, from the code around it. */
function roleOfRead(node: AstNode, parents: readonly AstNode[]): ComponentPropRole | undefined {
  let child = node;
  for (let i = parents.length - 1; i >= 0; i--) {
    const parent = parents[i];
    if (parent === undefined) break;
    const role = stepRole(parent, child, parents[i - 1]);
    if (role === 'stop') return undefined;
    if (role !== undefined) return role;
    child = parent;
  }
  return undefined;
}

function better(a: ComponentPropRole | undefined, b: ComponentPropRole | undefined) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return ROLE_RANK.indexOf(a) <= ROLE_RANK.indexOf(b) ? a : b;
}

/** The prop a node reads: a bound local (`title`) or `props.title`; undefined for anything else. */
function propRead(node: AstNode, parent: AstNode | undefined, b: Bindings): string | undefined {
  if (node.type === 'MemberExpression' && node['computed'] !== true) {
    const object = nameOf(node['object']);
    return object !== undefined && object === b.propsName ? nameOf(node['property']) : undefined;
  }
  if (node.type !== 'Identifier') return undefined;
  // A key or a member name is not a read of the variable.
  if (
    parent?.type === 'MemberExpression' &&
    parent['property'] === node &&
    parent['computed'] !== true
  ) {
    return undefined;
  }
  if (parent?.type === 'ObjectProperty' && parent['key'] === node) return undefined;
  const name = nameOf(node);
  return name === undefined ? undefined : b.locals.get(name);
}

function collectUses(fn: AstNode, b: Bindings): Map<string, ComponentPropRole | undefined> {
  // `const { title, ...rest } = props` in the body binds like the parameter does.
  walk(fn['body'], [], (node) => {
    if (node.type !== 'VariableDeclarator') return;
    const id = asAstNode(node['id']);
    if (id?.type === 'ObjectPattern' && nameOf(node['init']) === b.propsName) {
      readObjectPattern(id, b);
    }
  });
  const uses = new Map<string, ComponentPropRole | undefined>();
  walk(fn['body'], [], (node, parents) => {
    // The names inside `const { title } = props` declare, they do not read.
    if (parents.some((p) => p.type === 'ObjectPattern')) return;
    const prop = propRead(node, parents.at(-1), b);
    if (prop === undefined) return;
    if (b.propsName !== undefined) b.declared.add(prop);
    uses.set(prop, better(uses.get(prop), roleOfRead(node, parents)));
  });
  return uses;
}

/**
 * The props of the component `exportName` defines in `code` (`default` for the default export),
 * with what each does; `undefined` when the definition cannot be found or read.
 */
export function readPropDefinition(ast: AstNode, exportName: string): PropDefinition | undefined {
  const top = readTopLevel(ast);
  const start =
    exportName === 'default'
      ? top.defaultExport
      : top.locals.get(top.aliases.get(exportName) ?? exportName);
  const fn = unwrapFunction(start, top);
  if (fn === undefined) return undefined;
  const b: Bindings = {
    locals: new Map(),
    defaults: new Map(),
    declared: new Set(),
    propsName: undefined,
  };
  readParam(fn, b);
  const uses = collectUses(fn, b);
  const out = new Map<string, PropUse>();
  for (const name of b.declared) {
    out.set(name, {
      used: uses.has(name),
      role: uses.get(name),
      defaultValue: b.defaults.get(name),
    });
  }
  return out;
}
