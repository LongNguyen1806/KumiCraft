// Helpers shared by the route finders of a routes file (createBrowserRouter or <Routes>).
import { asAstNode, type AstNode } from '../../../../lib/ast-helpers.ts';
import type { TextEdit } from '../structure/text-edits.ts';

export type FoundRouteNode = {
  readonly routeNode: AstNode;
  readonly pathProp?: AstNode | undefined;
  readonly fullPath: string;
  readonly rawPath?: string | undefined;
  readonly isIndex: boolean;
  readonly hasChildren: boolean;
  readonly componentName?: string | undefined;
  readonly elementNode?: AstNode | undefined;
  readonly parentArray: AstNode;
};

/** Finds insertion offset after the last ImportDeclaration. */
export function findLastImportEnd(ast: AstNode, code: string): number {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  let lastEnd = -1;

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ImportDeclaration' && typeof stmt.end === 'number') {
      if (stmt.end > lastEnd) lastEnd = stmt.end;
    }
  }

  if (lastEnd === -1) return 0;
  let pos = lastEnd;
  while (pos < code.length && code[pos] !== '\n') pos++;
  return pos < code.length && code[pos] === '\n' ? pos + 1 : lastEnd;
}

export function detectFileQuote(ast: AstNode, code: string): { quote: "'" | '"' } {
  let singleCount = 0;
  let doubleCount = 0;

  function search(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as AstNode;
    if (n.type === 'StringLiteral') {
      const start = typeof n.start === 'number' ? n.start : undefined;
      const raw = start !== undefined ? code[start] : undefined;
      if (raw === "'") singleCount++;
      else if (raw === '"') doubleCount++;
    }
    for (const [k, v] of Object.entries(n)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') {
        search(v);
      }
    }
  }

  search(ast);
  return { quote: singleCount >= doubleCount ? "'" : '"' };
}

export function findImportRemovalEdit(
  ast: AstNode,
  code: string,
  componentName: string,
): TextEdit | undefined {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const specifiers = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
    const hasComponent = specifiers.some((s) => {
      const node = asAstNode(s);
      const local = asAstNode(node?.['local']);
      return local?.['name'] === componentName;
    });

    if (hasComponent && specifiers.length === 1) {
      if (typeof stmt.start !== 'number' || typeof stmt.end !== 'number') continue;
      let lineStart = stmt.start;
      while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--;
      let lineEnd = stmt.end;
      while (lineEnd < code.length && code[lineEnd] !== '\n') lineEnd++;
      if (code[lineEnd] === '\n') lineEnd++;
      return { start: lineStart, end: lineEnd, text: '' };
    }
  }
  return undefined;
}
