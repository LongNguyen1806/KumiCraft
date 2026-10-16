// Visible node calculations for LayerTree (SPEC-04 M-LT).
import type { TreeNode } from '@reactcraft/shared';

export type VisibleNodeMeta = {
  readonly node: TreeNode;
  readonly index: number;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly isVisible: boolean;
  readonly isBoundary: boolean;
  readonly componentName?: string | undefined;
};

export function getFileFromLoc(loc: string): string {
  const parts = loc.split(':');
  return parts[0] ?? loc;
}

export function getComponentName(filePath: string): string {
  const fileName = filePath.split('/').pop() ?? filePath;
  return fileName.replace(/\.[^.]+$/, '');
}

export function computeVisibleNodes(
  treeNodes: readonly TreeNode[],
  collapsedLocs: ReadonlySet<string>,
): VisibleNodeMeta[] {
  const childIndicesMap = new Map<number, number[]>();
  for (let i = 0; i < treeNodes.length; i++) {
    const parent = treeNodes[i]?.parent;
    if (parent !== undefined) {
      const list = childIndicesMap.get(parent) ?? [];
      list.push(i);
      childIndicesMap.set(parent, list);
    }
  }

  const depths = new Int32Array(treeNodes.length);
  for (let i = 0; i < treeNodes.length; i++) {
    const parent = treeNodes[i]?.parent;
    depths[i] = parent !== undefined ? (depths[parent] ?? 0) + 1 : 0;
  }

  const result: VisibleNodeMeta[] = [];
  for (let i = 0; i < treeNodes.length; i++) {
    const node = treeNodes[i];
    if (!node) continue;

    let isVisible = true;
    let currParent = node.parent;
    while (currParent !== undefined) {
      const parentNode = treeNodes[currParent];
      if (parentNode && collapsedLocs.has(parentNode.ref.loc)) {
        isVisible = false;
        break;
      }
      currParent = parentNode?.parent;
    }

    const hasChildren = (childIndicesMap.get(i)?.length ?? 0) > 0;
    const nodeFile = getFileFromLoc(node.ref.loc);
    const parentNode = node.parent !== undefined ? treeNodes[node.parent] : undefined;
    const parentFile = parentNode !== undefined ? getFileFromLoc(parentNode.ref.loc) : undefined;
    const isBoundary = parentFile !== undefined && nodeFile !== parentFile;
    const componentName = isBoundary ? getComponentName(nodeFile) : undefined;

    result.push({
      node,
      index: i,
      depth: depths[i] ?? 0,
      hasChildren,
      isVisible,
      isBoundary,
      componentName,
    });
  }
  return result;
}
