// A component that always draws itself never finishes drawing: the page hangs, and Safari (which
// keeps the Canvas in the Studio's process) hangs the Studio with it (spec-log #108, #116). When the
// Canvas code is prepared, such a component gets a clear error at the place it draws itself, so
// the page stops with a message instead. The file on disk is not changed.
//
// Only the certain case is caught: a component of the file whose single return draws itself with
// no condition on the way. A self-draw behind a condition, a loop, `&&`, a callback or an early
// return can be a real recursion (a tree of comments) and is left alone.
import type MagicString from 'magic-string';

type Node = { readonly type: string; readonly [key: string]: unknown };

const isNode = (value: unknown): value is Node =>
  value instanceof Object && 'type' in value && typeof value.type === 'string';

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression']);

const child = (node: Node, key: string): Node | undefined => {
  const value = node[key];
  return isNode(value) ? value : undefined;
};

const children = (node: Node, key: string): readonly Node[] => {
  const value = node[key];
  return Array.isArray(value) ? value.filter(isNode) : [];
};

const offset = (node: Node, key: 'start' | 'end'): number | undefined => {
  const value = node[key];
  return typeof value === 'number' ? value : undefined;
};

function unwrap(node: Node | undefined): Node | undefined {
  let current = node;
  while (current !== undefined && WRAPPERS.has(current.type)) {
    current = child(current, 'expression');
  }
  return current;
}

function tagName(element: Node): string | undefined {
  const name = child(child(element, 'openingElement') ?? element, 'name');
  return name?.type === 'JSXIdentifier' && typeof name['name'] === 'string'
    ? name['name']
    : undefined;
}

type Found = { readonly element: Node; readonly inJsxChildren: boolean };

/** The first element named `name` reached through JSX only (no condition, loop or callback). */
function findDirectSelf(
  node: Node | undefined,
  name: string,
  inJsxChildren = false,
): Found | undefined {
  const current = unwrap(node);
  if (current === undefined) return undefined;
  if (current.type === 'JSXElement' && tagName(current) === name) {
    return { element: current, inJsxChildren };
  }
  if (current.type !== 'JSXElement' && current.type !== 'JSXFragment') return undefined;
  for (const item of children(current, 'children')) {
    const found =
      item.type === 'JSXExpressionContainer'
        ? findDirectSelf(child(item, 'expression'), name, false)
        : findDirectSelf(item, name, true);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Whether a statement can leave the function early: a return or throw outside nested functions. */
function canLeave(node: Node): boolean {
  if (node.type === 'ReturnStatement' || node.type === 'ThrowStatement') return true;
  if (FUNCTIONS.has(node.type)) return false;
  return Object.keys(node).some((key) => {
    if (key === 'loc') return false;
    const value = node[key];
    if (Array.isArray(value)) return value.some((item) => isNode(item) && canLeave(item));
    return isNode(value) && canLeave(value);
  });
}

/** The expression a component always returns, or undefined when it may return something else. */
function alwaysReturned(fn: Node): Node | undefined {
  const body = child(fn, 'body');
  if (body === undefined) return undefined;
  if (body.type !== 'BlockStatement') return body;
  const statements = children(body, 'body');
  const last = statements[statements.length - 1];
  if (last?.type !== 'ReturnStatement') return undefined;
  if (statements.slice(0, -1).some(canLeave)) return undefined;
  return child(last, 'argument');
}

type Component = { readonly name: string; readonly fn: Node };

function componentsOf(program: Node): readonly Component[] {
  const found: Component[] = [];
  for (const statement of children(program, 'body')) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
        ? child(statement, 'declaration')
        : statement;
    if (declaration === undefined) continue;
    const id = child(declaration, 'id');
    if (declaration.type === 'FunctionDeclaration' && typeof id?.['name'] === 'string') {
      found.push({ name: id['name'], fn: declaration });
    }
    for (const declarator of children(declaration, 'declarations')) {
      const name = child(declarator, 'id')?.['name'];
      const init = unwrap(child(declarator, 'init'));
      if (typeof name === 'string' && init !== undefined && FUNCTIONS.has(init.type)) {
        found.push({ name, fn: init });
      }
    }
  }
  return found.filter((c) => /^[A-Z]/.test(c.name));
}

function lineOf(element: Node): number | undefined {
  const loc = element['loc'];
  if (!(loc instanceof Object) || !('start' in loc)) return undefined;
  const start = loc.start;
  if (!(start instanceof Object) || !('line' in start)) return undefined;
  return typeof start.line === 'number' ? start.line : undefined;
}

/** Whether a node, its params or anything inside it declares `name` again (`const Icon = …`). */
function redeclares(node: unknown, name: string): boolean {
  if (Array.isArray(node)) return node.some((item) => redeclares(item, name));
  if (!isNode(node)) return false;
  const id = child(node, 'id');
  if (
    (node.type === 'VariableDeclarator' ||
      node.type === 'FunctionDeclaration' ||
      node.type === 'ClassDeclaration') &&
    id?.type === 'Identifier' &&
    id['name'] === name
  ) {
    return true;
  }
  return Object.keys(node).some((key) => key !== 'loc' && redeclares(node[key], name));
}

/** Whether a parameter pattern binds `name` (`({ Icon })`, `(Icon)`, `([Icon])`). */
function bindsParam(node: unknown, name: string): boolean {
  if (Array.isArray(node)) return node.some((item) => bindsParam(item, name));
  if (!isNode(node)) return false;
  if (node.type === 'Identifier') return node['name'] === name;
  return Object.keys(node).some(
    (key) =>
      key !== 'loc' && key !== 'key' && key !== 'typeAnnotation' && bindsParam(node[key], name),
  );
}

/** The component's own name can mean something else inside it: then it is not a self-draw. */
const shadowed = (fn: Node, name: string): boolean =>
  bindsParam(fn['params'], name) || redeclares(child(fn, 'body'), name);

/** Adds the error where each component of the file draws itself unconditionally. */
export function guardSelfRender(program: unknown, s: MagicString, file: string): number {
  if (!isNode(program)) return 0;
  let guarded = 0;
  for (const { name, fn } of componentsOf(program)) {
    if (shadowed(fn, name)) continue;
    const found = findDirectSelf(alwaysReturned(fn), name);
    const start = found === undefined ? undefined : offset(found.element, 'start');
    const end = found === undefined ? undefined : offset(found.element, 'end');
    if (found === undefined || start === undefined || end === undefined) continue;
    const where = `${file}:${String(lineOf(found.element) ?? 0)}`;
    const message = JSON.stringify(
      `KumiCraft: <${name}> draws itself inside its own code (${where}) with no condition, so the page could never finish drawing. Remove <${name} /> from inside ${name}.`,
    );
    const thrower = `(() => { throw new Error(${message}); })()`;
    if (found.inJsxChildren) {
      s.appendLeft(start, `{${thrower}}`);
    } else {
      s.appendLeft(start, `(${thrower}, `);
      s.prependRight(end, ')');
    }
    guarded += 1;
  }
  return guarded;
}
