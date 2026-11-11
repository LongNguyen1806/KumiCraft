// Which top-level names of a file are components (spec-log #121, #122): a capitalised export is
// not enough, `export const AI_VERDICT = {…}` is a constant. Data (objects, arrays, strings,
// numbers, regexes…) is left out; functions, classes, wrapped components (memo, observer, connect,
// styled…) and components under a new name (`Dialog = DialogPrimitive.Root`) stay.
import { asAstNode, type AstNode } from './ast-helpers.ts';

const WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'ParenthesizedExpression']);
const FUNCTIONS = new Set(['ArrowFunctionExpression', 'FunctionExpression']);
/** `Root`, `Card`: a component name. `PRIMARY`, `MAX` (all capitals) is a constant. */
const PASCAL = /^[A-Z][a-z0-9]/;

export type TopLevelKinds = {
  /** Every name the file declares at the top level. */
  readonly declared: ReadonlySet<string>;
  /** The declared names that hold a component. */
  readonly components: ReadonlySet<string>;
};

function unwrap(node: AstNode | undefined): AstNode | undefined {
  let current = node;
  while (current !== undefined && WRAPPERS.has(current.type)) {
    current = asAstNode(current['expression']);
  }
  return current;
}

const nameOf = (node: unknown): string | undefined => {
  const value = asAstNode(node)?.['name'];
  return typeof value === 'string' ? value : undefined;
};

/** Values that can never be a component: data, not something React can draw. */
const DATA = new Set([
  'ObjectExpression',
  'ArrayExpression',
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
  'NullLiteral',
  'BigIntLiteral',
  'RegExpLiteral',
  'TemplateLiteral',
  'NewExpression',
  'UnaryExpression',
  'BinaryExpression',
]);
/** `AI_VERDICT`, `MAX`: the usual way to name a constant. */
const ALL_CAPS = /^[A-Z][A-Z0-9_]*$/;

/**
 * Whether the value a name gets is a component. Only what surely is not one is left out, so a
 * component made by any wrapper (`observer`, `connect(…)(…)`, `motion(…)`, `withAuth(…)`) stays.
 */
export function isComponentValue(init: AstNode | undefined, name: string): boolean {
  const node = unwrap(init);
  if (node === undefined) return false;
  if (FUNCTIONS.has(node.type) || node.type === 'ClassExpression') return true;
  if (DATA.has(node.type)) return false;
  // Another component under a new name: `Card` or `DialogPrimitive.Root`; `COLORS.PRIMARY` is not.
  if (node.type === 'Identifier') return PASCAL.test(nameOf(node) ?? '');
  if (node.type === 'MemberExpression') {
    return node['computed'] !== true && PASCAL.test(nameOf(node['property']) ?? '');
  }
  // A call or a tagged template (memo, styled, a HOC…): a component unless named as a constant.
  return !ALL_CAPS.test(name);
}

function addDeclaration(node: AstNode, declared: Set<string>, components: Set<string>): void {
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    const name = nameOf(node['id']);
    if (name !== undefined) {
      declared.add(name);
      components.add(name);
    }
    return;
  }
  if (node.type !== 'VariableDeclaration') return;
  for (const item of Array.isArray(node['declarations']) ? node['declarations'] : []) {
    const declarator = asAstNode(item);
    const name = nameOf(declarator?.['id']);
    if (declarator === undefined || name === undefined) continue;
    declared.add(name);
    if (isComponentValue(asAstNode(declarator['init']), name)) components.add(name);
  }
}

export function topLevelKinds(program: AstNode | undefined): TopLevelKinds {
  const declared = new Set<string>();
  const components = new Set<string>();
  const body = program === undefined || !Array.isArray(program['body']) ? [] : program['body'];
  for (const item of body) {
    const statement = asAstNode(item);
    if (statement === undefined) continue;
    const inner =
      statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
        ? asAstNode(statement['declaration'])
        : statement;
    if (inner !== undefined) addDeclaration(inner, declared, components);
  }
  return { declared, components };
}
