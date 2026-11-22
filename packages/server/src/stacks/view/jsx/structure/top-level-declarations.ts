// Names a module declares at its top level, with where each declaration sits in the code.
import { asAstNode, type AstNode } from '../../../../lib/ast-helpers.ts';

export type TopLevelDeclaration = {
  readonly name: string;
  readonly start: number;
  readonly end: number;
};

function declaredNames(stmt: AstNode): readonly string[] {
  if (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') {
    const name = asAstNode(stmt['id'])?.['name'];
    return typeof name === 'string' ? [name] : [];
  }
  if (stmt.type === 'VariableDeclaration') {
    const decls = Array.isArray(stmt['declarations']) ? stmt['declarations'] : [];
    return decls.flatMap((decl) => {
      const name = asAstNode(asAstNode(decl)?.['id'])?.['name'];
      return typeof name === 'string' ? [name] : [];
    });
  }
  return [];
}

/**
 * `function X`, `const X`, `class X`, also behind `export` / `export default` (an exported
 * component is still declared in this file and must not be imported again).
 */
export function topLevelDeclarations(ast: AstNode): readonly TopLevelDeclaration[] {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  const found: TopLevelDeclaration[] = [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (!stmt) continue;
    const exported =
      stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration'
        ? asAstNode(stmt['declaration'])
        : stmt;
    if (!exported) continue;
    const start = typeof stmt['start'] === 'number' ? stmt['start'] : 0;
    const end = typeof stmt['end'] === 'number' ? stmt['end'] : start;
    for (const name of declaredNames(exported)) found.push({ name, start, end });
  }
  return found;
}

/**
 * True when `tags` holds the component whose own code contains `position`: inserting it there
 * makes the component render itself without end (the browser tab hangs).
 */
export function insertsComponentIntoItself(
  ast: AstNode,
  tags: readonly string[],
  position: number,
): boolean {
  return topLevelDeclarations(ast).some(
    (decl) => tags.includes(decl.name) && position > decl.start && position < decl.end,
  );
}
