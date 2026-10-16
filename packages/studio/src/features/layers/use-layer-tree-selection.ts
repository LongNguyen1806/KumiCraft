// Selection and keyboard navigation for LayerTree (SPEC-04 M-LT).
import type { ElementRef, TreeNode } from '@reactcraft/shared';
import { useEffect, useRef } from 'react';

import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';

function findAncestorLocsToExpand(
  treeNodes: readonly TreeNode[],
  startIndex: number,
  collapsedLocs: ReadonlySet<string>,
): string[] {
  const toExpand: string[] = [];
  let curr = treeNodes[startIndex]?.parent;
  while (curr !== undefined) {
    const pNode = treeNodes[curr];
    if (pNode && collapsedLocs.has(pNode.ref.loc)) toExpand.push(pNode.ref.loc);
    curr = pNode?.parent;
  }
  return toExpand;
}

function useLayerTreeEscapeKey(
  treeNodes: readonly TreeNode[],
  selectedRefs: readonly ElementRef[],
  setSelectedRefs: (refs: readonly ElementRef[]) => void,
  clearSelection: () => void,
  onSelect?: (ref: ElementRef, reveal: boolean) => void,
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || selectedRefs.length === 0) return;
      const primary = selectedRefs[selectedRefs.length - 1];
      if (!primary) return;

      const idx = treeNodes.findIndex(
        (n) => n.ref.loc === primary.loc && n.ref.index === primary.index,
      );
      if (idx === -1) return;

      const parentIdx = treeNodes[idx]?.parent;
      if (parentIdx !== undefined && treeNodes[parentIdx]) {
        const parentRef = treeNodes[parentIdx].ref;
        setSelectedRefs([parentRef]);
        if (onSelect) onSelect(parentRef, true);
        else studioBridgeChannel.select([parentRef], true);
      } else {
        clearSelection();
        if (onSelect) onSelect({ loc: '', index: 0 }, false);
        else studioBridgeChannel.select([], false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedRefs, treeNodes, setSelectedRefs, clearSelection, onSelect]);
}

function useLayerTreeAutoExpand(
  treeNodes: readonly TreeNode[],
  selectedRefs: readonly ElementRef[],
  collapsedLocs: ReadonlySet<string>,
  setCollapsedLocs: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>,
  selectedItemRef: React.RefObject<HTMLDivElement | undefined>,
) {
  useEffect(() => {
    if (selectedRefs.length === 0) return;
    const primary = selectedRefs[selectedRefs.length - 1];
    if (!primary) return;

    const idx = treeNodes.findIndex(
      (n) => n.ref.loc === primary.loc && n.ref.index === primary.index,
    );
    if (idx === -1) return;

    const toExpand = findAncestorLocsToExpand(treeNodes, idx, collapsedLocs);
    if (toExpand.length > 0) {
      setTimeout(() => {
        setCollapsedLocs((prev) => {
          const next = new Set(prev);
          for (const loc of toExpand) next.delete(loc);
          return next;
        });
      }, 0);
    }

    selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedRefs, treeNodes, collapsedLocs, setCollapsedLocs, selectedItemRef]);
}

export function useLayerTreeSelection(
  treeNodes: readonly TreeNode[],
  collapsedLocs: ReadonlySet<string>,
  setCollapsedLocs: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>,
  onSelect?: (ref: ElementRef, reveal: boolean) => void,
) {
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const setSelectedRefs = useSelectionStore((s) => s.setSelectedRefs);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const selectedItemRef = useRef<HTMLDivElement>(undefined);

  useLayerTreeEscapeKey(treeNodes, selectedRefs, setSelectedRefs, clearSelection, onSelect);
  useLayerTreeAutoExpand(treeNodes, selectedRefs, collapsedLocs, setCollapsedLocs, selectedItemRef);

  return { selectedRefs, selectedItemRef, setSelectedRefs };
}
