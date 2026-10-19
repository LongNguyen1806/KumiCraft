// Applies Tailwind placement rules to the root JSX elements of a snippet (R-FF-11, R-FF-12).
import {
  applyPlacement,
  err,
  FREE_STACK_OFFSET_PX,
  ok,
  type Placement,
  type Result,
} from '@reactcraft/shared';
import MagicString from 'magic-string';

import { asAstNode, type AstNode, parseJsxAst } from '../ast-helpers.ts';
import { readClassName } from '../attribute-reader.ts';
import { mutateAttribute } from '../source-mutator.ts';

const OPEN = '<>';
const CLOSE = '</>';

/** Opening elements of the top-level JSX elements in `<>{jsx}</>`, in source order. */
function rootOpenings(wrapped: string): Result<readonly AstNode[]> {
  let ast: AstNode;
  try {
    ast = parseJsxAst(wrapped);
  } catch {
    return err({ code: 'E016', params: { reason: 'notJsx' } });
  }
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  const stmt = asAstNode(body[0]);
  const fragment = stmt?.type === 'ExpressionStatement' ? asAstNode(stmt['expression']) : undefined;
  const children = Array.isArray(fragment?.['children']) ? fragment['children'] : [];
  const openings = children
    .map(asAstNode)
    .filter((c): c is AstNode => c?.type === 'JSXElement')
    .map((c) => asAstNode(c['openingElement']))
    .filter((o): o is AstNode => o !== undefined);
  if (body.length !== 1 || fragment?.type !== 'JSXFragment' || openings.length === 0) {
    return err({ code: 'E016', params: { reason: 'notJsx' } });
  }
  return ok(openings);
}

/** R-FF-12: the n-th element of a multi-element free placement sits 16 px further right and down. */
export function stackedPlacement(placement: Placement, index: number): Placement {
  if (placement.kind === 'flow' || index === 0) return placement;
  const offset = index * FREE_STACK_OFFSET_PX;
  return { ...placement, left: placement.left + offset, top: placement.top + offset };
}

/**
 * Rewrites the className of every root element in `jsx` with `applyPlacement`. `firstIndex`
 * is the stack position of the first root, for callers that place elements one by one.
 */
export function applyPlacementToJsx(
  jsx: string,
  placement: Placement | undefined,
  tailwindMajor?: 3 | 4,
  firstIndex = 0,
): Result<string> {
  if (!placement) return ok(jsx);

  const wrapped = `${OPEN}${jsx}${CLOSE}`;
  const openingsRes = rootOpenings(wrapped);
  if (!openingsRes.ok) return openingsRes;

  const s = new MagicString(wrapped);
  let index = firstIndex;
  for (const opening of openingsRes.value) {
    const rawAttrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
    const current = readClassName(rawAttrs, wrapped);
    if (current.kind === 'expression') {
      return err({ code: 'E023', params: { reason: 'classExpression' } });
    }
    if (current.kind === 'duplicate') {
      return err({ code: 'E023', params: { reason: 'duplicateAttr' } });
    }
    const before = current.kind === 'static' ? current.value : '';
    const after = applyPlacement(before, stackedPlacement(placement, index), tailwindMajor);
    mutateAttribute(s, wrapped, opening, 'className', after);
    index += 1;
  }
  return ok(s.slice(OPEN.length, wrapped.length - CLOSE.length));
}
