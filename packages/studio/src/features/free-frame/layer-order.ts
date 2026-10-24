// Layer order commands for elements in a free frame (SPEC-04 section 18E, R-FF-16, WP-2.12b).
import {
  type ElementRef,
  type InsertTarget,
  parseLocString,
  type TreeNode,
} from '@kumicraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { type CommandTarget, runStructureOp } from '../structure/structure-commands.ts';

export type LayerOrderCommand = 'front' | 'forward' | 'backward' | 'back';

function getSameFileSiblings(
  treeNodes: readonly TreeNode[],
  parentNodeIdx: number,
  currentFile: string | undefined,
): TreeNode[] {
  const seen = new Set<string>();
  const siblings: TreeNode[] = [];
  for (const node of treeNodes) {
    if (node.parent === parentNodeIdx) {
      const nodeFile = parseLocString(node.ref.loc)?.file;
      if (nodeFile === currentFile && !seen.has(node.ref.loc)) {
        seen.add(node.ref.loc);
        siblings.push(node);
      }
    }
  }
  return siblings;
}

function resolveOrderTarget(
  cmd: LayerOrderCommand,
  myIdx: number,
  siblings: readonly TreeNode[],
  parentNode: TreeNode,
): InsertTarget | undefined {
  if (cmd === 'front') {
    return myIdx === siblings.length - 1
      ? undefined
      : { kind: 'child', parent: { loc: parentNode.ref.loc, tag: parentNode.tag }, where: 'end' };
  }
  if (cmd === 'back') {
    return myIdx === 0
      ? undefined
      : { kind: 'child', parent: { loc: parentNode.ref.loc, tag: parentNode.tag }, where: 'start' };
  }
  if (cmd === 'forward') {
    const next = siblings[myIdx + 1];
    return myIdx === siblings.length - 1 || !next
      ? undefined
      : { kind: 'sibling', ref: { loc: next.ref.loc, tag: next.tag }, where: 'after' };
  }
  const prev = siblings[myIdx - 1];
  return myIdx === 0 || !prev
    ? undefined
    : { kind: 'sibling', ref: { loc: prev.ref.loc, tag: prev.tag }, where: 'before' };
}

/** Đích move trong cùng khung; undefined khi đã ở đầu/cuối (nút bị tắt). */
export function layerOrderTarget(
  cmd: LayerOrderCommand,
  ref: ElementRef,
  _tag: string,
  treeNodes: readonly TreeNode[],
): InsertTarget | undefined {
  const currentNode = treeNodes.find((n) => n.ref.loc === ref.loc && n.ref.index === ref.index);
  if (!currentNode || currentNode.parent === undefined) return undefined;

  const parentNode = treeNodes[currentNode.parent];
  if (!parentNode) return undefined;

  const currentFile = parseLocString(ref.loc)?.file;
  const siblings = getSameFileSiblings(treeNodes, currentNode.parent, currentFile);
  const myIdx = siblings.findIndex((s) => s.ref.loc === ref.loc);
  if (myIdx === -1) return undefined;

  return resolveOrderTarget(cmd, myIdx, siblings, parentNode);
}

export async function runLayerOrder(
  cmd: LayerOrderCommand,
  ref: ElementRef,
  tag: string,
): Promise<boolean> {
  const { treeNodes } = useSelectionStore.getState();
  const target = layerOrderTarget(cmd, ref, tag, treeNodes);
  if (!target) return false;

  const commandTarget: CommandTarget = { ref, tag };
  return runStructureOp(
    commandTarget,
    () => applyStructureEdit({ kind: 'move', elements: [{ loc: ref.loc, tag }], target }),
    (res) => {
      const newLoc = res.locs[0];
      if (newLoc) {
        useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
      }
    },
  );
}
