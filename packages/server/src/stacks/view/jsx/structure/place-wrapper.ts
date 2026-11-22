// The `<div className="absolute left-4 top-4">` the Studio puts around a component placed in a free
// frame when the component takes no `className` (placement-jsx.ts). It is found again by its shape,
// with no marker in the user's code: a `<div>` with only placing classes around one element.
import { isPlacementOnly } from '@kumicraft/shared';

import { asAstNode, type AstNode, getJsxTagName } from '../../../../lib/ast-helpers.ts';
import { readClassName } from '../attribute-reader.ts';

/** `<ProductCard>`, `<Tabs.List>`: a component, not an HTML element. */
export function isComponentTag(tag: string | undefined): boolean {
  return tag !== undefined && (/^[A-Z]/.test(tag) || tag.includes('.'));
}

/** The one element inside a placing `<div>`; undefined when `element` is anything else. */
export function placeWrapperChild(element: AstNode, code: string): AstNode | undefined {
  const opening = asAstNode(element['openingElement']);
  if (opening === undefined || getJsxTagName(opening) !== 'div') return undefined;
  const attrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  if (attrs.length !== 1) return undefined;
  const classes = readClassName(attrs, code);
  if (classes.kind !== 'static' || !isPlacementOnly(classes.value)) return undefined;
  const children = Array.isArray(element['children']) ? element['children'] : [];
  const parts = children
    .map(asAstNode)
    .filter((c) => !(c?.type === 'JSXText' && String(c['value']).trim() === ''));
  const only = parts.length === 1 ? parts[0] : undefined;
  return only?.type === 'JSXElement' ? only : undefined;
}
