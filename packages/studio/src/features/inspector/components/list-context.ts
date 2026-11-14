import type { ElementRef, TreeNode } from '@kumicraft/shared';

export type ItemContext = {
  readonly itemTargetRef: ElementRef | undefined;
  readonly listParentRef: ElementRef | undefined;
  readonly itemCount: number;
  readonly parentTag: string;
  readonly itemTag: string;
  readonly newItemJsx: (isVi: boolean) => string;
};

function findUlContext(
  treeNodes: readonly TreeNode[],
  idx: number,
  ref: ElementRef,
  lower: string,
): ItemContext | undefined {
  if (lower === 'ul' || lower === 'ol') {
    const children =
      idx >= 0 ? treeNodes.filter((n) => n.parent === idx && n.tag.toLowerCase() === 'li') : [];
    return {
      itemTargetRef: children[children.length - 1]?.ref,
      listParentRef: ref,
      itemCount: children.length,
      parentTag: lower,
      itemTag: 'li',
      newItemJsx: (vi) => `<li>${vi ? 'Mục mới' : 'New item'}</li>`,
    };
  }
  if (lower !== 'li') return undefined;
  const node = idx >= 0 ? treeNodes[idx] : undefined;
  const parentIdx = node?.parent;
  const parentNode = parentIdx !== undefined ? treeNodes[parentIdx] : undefined;
  const parentTag = parentNode?.tag.toLowerCase();
  const siblings =
    parentIdx !== undefined
      ? treeNodes.filter((n) => n.parent === parentIdx && n.tag.toLowerCase() === 'li')
      : [node];
  return {
    itemTargetRef: ref,
    listParentRef: parentTag === 'ul' || parentTag === 'ol' ? parentNode?.ref : undefined,
    itemCount: siblings.length,
    parentTag: parentTag ?? 'ul',
    itemTag: 'li',
    newItemJsx: (vi) => `<li>${vi ? 'Mục mới' : 'New item'}</li>`,
  };
}

function findAccordionContext(
  treeNodes: readonly TreeNode[],
  idx: number,
  lower: string,
): ItemContext | undefined {
  if (lower !== 'details' && lower !== 'summary') return undefined;
  const node = idx >= 0 ? treeNodes[idx] : undefined;
  const detailsIdx =
    lower === 'details'
      ? idx
      : node?.parent !== undefined && treeNodes[node.parent]?.tag.toLowerCase() === 'details'
        ? node.parent
        : -1;
  const detailsNode = detailsIdx >= 0 ? treeNodes[detailsIdx] : undefined;
  if (detailsNode === undefined) return undefined;
  const containerIdx = detailsNode.parent;
  const siblings =
    containerIdx !== undefined
      ? treeNodes.filter((n) => n.parent === containerIdx && n.tag.toLowerCase() === 'details')
      : [detailsNode];
  const containerNode = containerIdx !== undefined ? treeNodes[containerIdx] : undefined;
  return {
    itemTargetRef: detailsNode.ref,
    listParentRef: containerNode?.ref,
    itemCount: siblings.length,
    parentTag: containerNode?.tag ?? 'div',
    itemTag: 'details',
    newItemJsx: (vi) =>
      vi
        ? '<details><summary>Mục mới</summary><p>Nội dung mục mới.</p></details>'
        : '<details><summary>New item</summary><p>New item details.</p></details>',
  };
}

function findInteractiveItemContext(
  treeNodes: readonly TreeNode[],
  idx: number,
  ref: ElementRef,
  tag: string,
): ItemContext | undefined {
  if (tag === 'Tabs' || tag === 'Tab') {
    return {
      itemTargetRef: tag === 'Tab' ? ref : undefined,
      listParentRef: tag === 'Tabs' ? ref : undefined,
      itemCount: tag === 'Tab' ? 2 : 0,
      parentTag: 'Tabs',
      itemTag: 'Tab',
      newItemJsx: (vi) =>
        vi
          ? '<Tab label="Tab mới"><p>Nội dung thẻ mới.</p></Tab>'
          : '<Tab label="New tab"><p>New tab content.</p></Tab>',
    };
  }
  if (tag !== 'Carousel') return undefined;
  const ownerFile = ref.loc.split(':')[0] ?? '';
  const descendantSlide =
    idx >= 0
      ? treeNodes.find(
          (n, i) =>
            i > idx && n.parent !== undefined && (n.ref.loc.split(':')[0] ?? '') === ownerFile,
        )
      : undefined;
  return {
    itemTargetRef: descendantSlide?.ref,
    listParentRef: ref,
    itemCount: descendantSlide !== undefined ? 2 : 0,
    parentTag: 'Carousel',
    itemTag: descendantSlide?.tag ?? 'div',
    newItemJsx: (vi) => (vi ? '<div><p>Slide mới</p></div>' : '<div><p>New slide</p></div>'),
  };
}

export function findListContext(
  treeNodes: readonly TreeNode[],
  ref: ElementRef,
  tag: string,
): ItemContext | undefined {
  const idx = treeNodes.findIndex((n) => n.ref.loc === ref.loc && n.ref.index === ref.index);
  const lower = tag.toLowerCase();
  return (
    findUlContext(treeNodes, idx, ref, lower) ??
    findAccordionContext(treeNodes, idx, lower) ??
    findInteractiveItemContext(treeNodes, idx, ref, tag)
  );
}
