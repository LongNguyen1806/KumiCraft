// Which tree nodes are the choices of a SelectGroup, and which containers its content can link to
// (K9.8-1 TK-73; QA K9.8-1: the group renders no element, so it is reached through its items).
import { type ElementRef, parseLocString, type TreeNode } from '@kumicraft/shared';

import { collectDescendants, directChildrenOf } from './interaction-shared.tsx';

export const SELECT_CONTAINER_TAGS = new Set([
  'div',
  'section',
  'ul',
  'ol',
  'nav',
  'article',
  'main',
  'aside',
]);

/** The items sent with "link content": the choices, or the group itself when none is listed. */
export function linkItemsOf(selectItems: readonly TreeNode[], groupLoc: string) {
  return selectItems.length > 0
    ? selectItems.map((i) => ({ loc: i.ref.loc, tag: i.tag }))
    : [{ loc: groupLoc, tag: 'SelectItem' }];
}

function siblingsOf(treeNodes: readonly TreeNode[], ref: ElementRef): readonly TreeNode[] {
  const self = treeNodes.find((n) => n.ref.loc === ref.loc && n.ref.index === ref.index);
  if (self === undefined) return [];
  return treeNodes.filter((n) => n.parent === self.parent && n.tag === self.tag);
}

function itemsUnder(treeNodes: readonly TreeNode[], refTarget: ElementRef): readonly TreeNode[] {
  const tagged = collectDescendants(treeNodes, refTarget).filter((n) => n.tag === 'SelectItem');
  return tagged.length > 0 ? tagged : directChildrenOf(treeNodes, refTarget);
}

export function collectSelectGroupTargets(
  treeNodes: readonly TreeNode[],
  refTarget: ElementRef,
  groupLoc: string,
  viaItem = false,
) {
  // Through an item, its fellow items are its siblings of the same kind.
  const selectItems = viaItem ? siblingsOf(treeNodes, refTarget) : itemsUnder(treeNodes, refTarget);
  const descendants = viaItem
    ? selectItems.flatMap((item) => [item, ...collectDescendants(treeNodes, item.ref)])
    : collectDescendants(treeNodes, refTarget);
  const groupFile = parseLocString(groupLoc)?.file;
  const linkCandidates = treeNodes.filter(
    (n) =>
      n.ref.loc !== refTarget.loc &&
      parseLocString(n.ref.loc)?.file === groupFile &&
      !descendants.some((d) => d.ref.loc === n.ref.loc) &&
      SELECT_CONTAINER_TAGS.has(n.tag),
  );
  return { selectItems, linkCandidates };
}
