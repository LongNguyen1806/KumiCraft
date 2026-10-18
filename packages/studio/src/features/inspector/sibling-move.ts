// Sibling move target calculation for Inspector Up/Down actions (SPEC-04 R-SE-24, section 3.3).
import type { ElementRef, InsertTarget, TreeNode } from '@reactcraft/shared';
import { parseLocString } from '@reactcraft/shared';

/**
 * Calculates sibling move target for an element node in Layer Tree.
 * Sibling nodes are those sharing the same parent, in the same file, excluding nodes with
 * identical loc (instances generated from loops/.map).
 */
export function siblingMoveTarget(
  treeNodes: readonly TreeNode[],
  ref: ElementRef,
  direction: 'up' | 'down',
): InsertTarget | undefined {
  const nodeIndex = treeNodes.findIndex((n) => n.ref.loc === ref.loc && n.ref.index === ref.index);
  if (nodeIndex === -1) return undefined;

  const currentNode = treeNodes[nodeIndex];
  if (!currentNode) return undefined;

  const currentFile = parseLocString(ref.loc)?.file;
  if (!currentFile) return undefined;

  const parentId = currentNode.parent;
  // Sibling nodes must share the same parent and same source file, excluding the same loc
  const siblings = treeNodes.filter((n) => {
    if (n.parent !== parentId) return false;
    if (n.ref.loc === ref.loc) return false;
    const file = parseLocString(n.ref.loc)?.file;
    return file === currentFile;
  });

  // Find position among all same-parent nodes to preserve visual document order
  const sameParentNodes = treeNodes.filter((n) => n.parent === parentId);
  const currentPos = sameParentNodes.findIndex(
    (n) => n.ref.loc === ref.loc && n.ref.index === ref.index,
  );
  if (currentPos === -1) return undefined;

  if (direction === 'up') {
    // Look backwards for the immediately preceding valid sibling
    for (let i = currentPos - 1; i >= 0; i--) {
      const candidate = sameParentNodes[i];
      if (candidate && siblings.includes(candidate)) {
        return {
          kind: 'sibling',
          ref: { loc: candidate.ref.loc, tag: candidate.tag },
          where: 'before',
        };
      }
    }
    return undefined;
  }

  // Look forwards for the immediately succeeding valid sibling
  for (let i = currentPos + 1; i < sameParentNodes.length; i++) {
    const candidate = sameParentNodes[i];
    if (candidate && siblings.includes(candidate)) {
      return {
        kind: 'sibling',
        ref: { loc: candidate.ref.loc, tag: candidate.tag },
        where: 'after',
      };
    }
  }
  return undefined;
}
