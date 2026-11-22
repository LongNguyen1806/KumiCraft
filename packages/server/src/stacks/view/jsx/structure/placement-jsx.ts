// Applies Tailwind placement rules to the root JSX elements of a snippet (R-FF-11, R-FF-12).
import { err, ok, type Placement, type Result } from '@kumicraft/shared';
import { applyPlacement, FREE_STACK_OFFSET_PX } from '@kumicraft/style-tailwind';
import MagicString from 'magic-string';

import {
  asAstNode,
  type AstNode,
  getJsxTagName,
  parseJsxAst,
} from '../../../../lib/ast-helpers.ts';
import { readClassName } from '../attribute-reader.ts';
import { mutateAttribute } from '../source-mutator.ts';
import { isComponentTag, placeWrapperChild } from './place-wrapper.ts';

const OPEN = '<>';
const CLOSE = '</>';

/** The top-level JSX elements in `<>{jsx}</>`, in source order. */
function rootElements(wrapped: string): Result<readonly AstNode[]> {
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
  const elements = children
    .map(asAstNode)
    .filter(
      (c): c is AstNode => c?.type === 'JSXElement' && asAstNode(c['openingElement']) !== undefined,
    );
  if (body.length !== 1 || fragment?.type !== 'JSXFragment' || elements.length === 0) {
    return err({ code: 'E016', params: { reason: 'notJsx' } });
  }
  return ok(elements);
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
  const elementsRes = rootElements(wrapped);
  if (!elementsRes.ok) return elementsRes;

  const s = new MagicString(wrapped);
  let index = firstIndex;
  for (const element of elementsRes.value) {
    const placed = placeElement(
      s,
      wrapped,
      element,
      stackedPlacement(placement, index),
      tailwindMajor,
    );
    if (!placed.ok) return placed;
    index += 1;
  }
  return ok(s.slice(OPEN.length, wrapped.length - CLOSE.length));
}

/**
 * Places one root element. A component that takes no `className` (`<ProductCard name="…" />`)
 * would get classes it ignores, and a type error in a typed project: it goes into a `<div>` that
 * carries the place instead; leaving the free frame drops that `<div>` again.
 */
function placeElement(
  s: MagicString,
  code: string,
  element: AstNode,
  placement: Placement,
  tailwindMajor: 3 | 4 | undefined,
): Result<void> {
  const opening = asAstNode(element['openingElement']);
  if (opening === undefined || element.start === undefined || element.end === undefined) {
    return ok(undefined);
  }
  const inner = placeWrapperChild(element, code);
  if (inner !== undefined && placement.kind === 'flow') {
    s.overwrite(element.start, element.end, code.slice(inner.start, inner.end));
    return ok(undefined);
  }
  const rawAttrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  const current = readClassName(rawAttrs, code);
  if (current.kind === 'expression') {
    return err({ code: 'E023', params: { reason: 'classExpression' } });
  }
  if (current.kind === 'duplicate') {
    return err({ code: 'E023', params: { reason: 'duplicateAttr' } });
  }
  if (current.kind === 'none' && isComponentTag(getJsxTagName(opening))) {
    if (placement.kind !== 'flow') {
      const classes = applyPlacement('', placement, tailwindMajor);
      s.prependRight(element.start, `<div className="${classes}">`);
      s.appendLeft(element.end, '</div>');
    }
    return ok(undefined);
  }
  const before = current.kind === 'static' ? current.value : '';
  mutateAttribute(s, code, opening, 'className', applyPlacement(before, placement, tailwindMajor));
  return ok(undefined);
}
