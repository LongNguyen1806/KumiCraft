// Element text extraction and used component tag collection (SPEC-04 R-SE-30, section 4.1).
import { err, ok, type Result } from '@kumicraft/shared';

import { asAstNode, type AstNode } from '../ast-helpers.ts';
import { findNodeAt } from '../source-editor-lookup.ts';
import { indentOf, type ResolvedElement } from './structure-ops.ts';

/**
 * Extracts raw element text formatted with indentation relative to el's parent,
 * with common minimum indent stripped (first line has 0 indent).
 */
export function extractElementText(code: string, el: ResolvedElement): string {
  const elIndent = indentOf(code, el.start);
  const raw = `${elIndent}${code.slice(el.start, el.end)}`;
  const lines = raw.split(/\r?\n/);

  // Find minimum common indentation among non-empty lines
  let minIndent = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const match = /^[ \t]*/.exec(line);
    const count = match ? match[0].length : 0;
    if (count < minIndent) minIndent = count;
  }
  if (!Number.isFinite(minIndent)) minIndent = 0;

  const stripped = lines.map((line) => {
    if (line.trim() === '') return '';
    return line.slice(minIndent);
  });

  return stripped.join('\n');
}

/**
 * Traverses an AST node and collects all uppercase component tag names.
 * For member expressions like <Icons.Star/>, collects the root 'Icons'.
 */
export function collectComponentTags(node: AstNode): readonly string[] {
  const tags = new Set<string>();

  function walk(curr: unknown) {
    const ast = asAstNode(curr);
    if (!ast) return;

    if (ast.type === 'JSXElement') {
      const opening = asAstNode(ast['openingElement']);
      const nameNode = asAstNode(opening?.['name']);
      if (nameNode) {
        if (nameNode.type === 'JSXIdentifier' && typeof nameNode['name'] === 'string') {
          const name = nameNode['name'];
          if (/^[A-Z]/.test(name)) tags.add(name);
        } else if (nameNode.type === 'JSXMemberExpression') {
          let root: AstNode = nameNode;
          while (root['object'] && asAstNode(root['object'])?.type === 'JSXMemberExpression') {
            const nextRoot = asAstNode(root['object']);
            if (!nextRoot) break;
            root = nextRoot;
          }
          const rootObj = asAstNode(root['object']);
          if (rootObj && rootObj.type === 'JSXIdentifier' && typeof rootObj['name'] === 'string') {
            const name = rootObj['name'];
            if (/^[A-Z]/.test(name)) tags.add(name);
          }
        }
      }
    }

    for (const key of Object.keys(ast)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
      const child = ast[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child !== undefined && typeof child === 'object') {
        walk(child);
      }
    }
  }

  walk(node);
  return [...tags];
}

/**
 * Extracts all import declaration statements in the AST that import any of the specified names.
 * Returns the exact verbatim statement string for each matching import.
 */
export function collectMatchingImportStatements(
  ast: AstNode,
  code: string,
  names: readonly string[],
): readonly string[] {
  const nameSet = new Set(names);
  if (nameSet.size === 0) return [];

  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  const results: string[] = [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ImportDeclaration') {
      const specifiers = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
      let matches = false;
      for (const spec of specifiers) {
        const specNode = asAstNode(spec);
        const local = asAstNode(specNode?.['local']);
        if (typeof local?.['name'] === 'string' && nameSet.has(local['name'])) {
          matches = true;
          break;
        }
      }
      if (matches && stmt.start !== undefined && stmt.end !== undefined) {
        results.push(code.slice(stmt.start, stmt.end));
      }
    }
  }

  return results;
}

export type ElementTextResponse = {
  readonly jsx: string;
  readonly file: string;
  readonly imports: readonly string[];
};

export function getElementTextFromAst(
  code: string,
  ast: AstNode,
  relFile: string,
  line: number,
  column: number,
): Result<ElementTextResponse> {
  const targetNode = findNodeAt(ast, line, column);
  if (!targetNode || targetNode.start === undefined || targetNode.end === undefined) {
    return err({
      code: 'E017',
      params: { loc: `${relFile}:${String(line)}:${String(column)}`, reason: 'moved' },
    });
  }

  const opening = asAstNode(targetNode['openingElement']) ?? { type: 'JSXOpeningElement' };
  const resolved: ResolvedElement = {
    loc: `${relFile}:${String(line)}:${String(column)}`,
    node: targetNode,
    opening,
    start: targetNode.start,
    end: targetNode.end,
    line,
  };

  const jsx = extractElementText(code, resolved);
  const tags = collectComponentTags(targetNode);
  const imports = collectMatchingImportStatements(ast, code, tags);

  return ok({
    jsx,
    file: relFile,
    imports,
  });
}
