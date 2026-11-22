// Helpers for link-target JSX attribute edits (K9.8-1 TK-78).
import type { SetLinkTargetAction } from '@kumicraft/shared';

import type { AstNode } from '../../../../lib/ast-helpers.ts';
import { asAstNode } from '../../../../lib/ast-helpers.ts';
import { readAttrsExcluding } from './select-group-helpers.ts';
import type { TextEdit } from './text-edits.ts';

function escapeLinkAttr(val: string): string {
  return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function findRouterPackage(ast: AstNode): string | undefined {
  const body = Array.isArray(asAstNode(ast['program'])?.['body'])
    ? asAstNode(ast['program'])?.['body']
    : [];
  if (!Array.isArray(body)) return undefined;
  for (const stmt of body) {
    const node = asAstNode(stmt);
    if (node?.type !== 'ImportDeclaration') continue;
    const src = asAstNode(node['source'])?.['value'];
    if (src === 'react-router-dom' || src === 'react-router') return src;
  }
  return undefined;
}

export function buildLinkTargetEdits(
  ast: AstNode,
  node: AstNode,
  opening: AstNode,
  curTag: string,
  code: string,
  action: SetLinkTargetAction,
): {
  readonly nextTag: 'a' | 'Link';
  readonly routerPkg?: string | undefined;
  readonly edits: readonly TextEdit[];
} {
  const routerPkg = action.targetKind === 'route' ? findRouterPackage(ast) : undefined;
  const nextTag = routerPkg !== undefined ? 'Link' : 'a';
  const kept = readAttrsExcluding(
    opening,
    code,
    new Set(['href', 'to', 'target', 'rel', ...(curTag === 'button' ? ['type'] : [])]),
  );
  const targetVal =
    action.targetKind === 'section'
      ? action.target.startsWith('#')
        ? action.target
        : `#${action.target}`
      : action.target;
  const linkAttrs =
    nextTag === 'Link'
      ? [`to="${escapeLinkAttr(targetVal)}"`]
      : [
          `href="${escapeLinkAttr(targetVal)}"`,
          ...(action.targetKind === 'external' && action.newTab
            ? ['target="_blank"', 'rel="noopener noreferrer"']
            : []),
        ];
  const edits: TextEdit[] = [
    {
      start: opening.start ?? 0,
      end: opening.end ?? 0,
      text: `<${nextTag} ${[...kept, ...linkAttrs].join(' ')}${opening['selfClosing'] === true ? ' />' : '>'}`,
    },
  ];
  if (opening['selfClosing'] !== true && curTag !== nextTag) {
    const closing = asAstNode(node['closingElement']);
    if (closing?.start !== undefined && closing.end !== undefined) {
      edits.push({ start: closing.start, end: closing.end, text: `</${nextTag}>` });
    }
  }
  return { nextTag, routerPkg, edits };
}
