// The use of a component found from its first element (TK-49): the element sits in the
// component's file, the use (`<Card …>`) in the parent's file, at or inside `parentLoc`.
import { parseLocString } from '@kumicraft/shared';

import type { ComponentPropsDeps } from '../../../../kernel/features.ts';
import {
  asAstNode,
  type AstNode,
  getJsxTagName,
  parseJsxAst,
} from '../../../../lib/ast-helpers.ts';
import { findNodeAt } from '../source-editor-lookup.ts';

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

export async function resolveBoundaryCallSite(
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
