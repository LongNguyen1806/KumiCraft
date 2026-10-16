// Layer Tree component displaying DOM hierarchy with 2-way sync (SPEC-04 M-SL, R-SL-07..09).
import type { ElementRef, TreeNode } from '@reactcraft/shared';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { LayerTreeRow } from './layer-tree-row.tsx';
import { computeVisibleNodes, type VisibleNodeMeta } from './layer-tree-utils.ts';
import { useLayerTreeSelection } from './use-layer-tree-selection.ts';

export type LayerTreeProps = {
  readonly onSelect?: ((ref: ElementRef, reveal: boolean) => void) | undefined;
  readonly onHover?: ((ref?: ElementRef) => void) | undefined;
};

function useLayerTreeHandlers(
  setSelectedRefs: (refs: readonly ElementRef[]) => void,
  setHoveredRef: (ref?: ElementRef) => void,
  onSelect?: (ref: ElementRef, reveal: boolean) => void,
  onHover?: (ref?: ElementRef) => void,
) {
  const handleNodeClick = useCallback(
    (node: TreeNode) => {
      setSelectedRefs([node.ref]);
      if (onSelect) onSelect(node.ref, true);
      else studioBridgeChannel.select([node.ref], true);
    },
    [setSelectedRefs, onSelect],
  );

  const handleNodeHover = useCallback(
    (node: TreeNode) => {
      setHoveredRef(node.ref);
      if (onHover) onHover(node.ref);
      else studioBridgeChannel.highlight(node.ref);
    },
    [setHoveredRef, onHover],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredRef(undefined);
    if (onHover) onHover(undefined);
    else studioBridgeChannel.highlight(undefined);
  }, [setHoveredRef, onHover]);

  return { handleNodeClick, handleNodeHover, handleMouseLeave };
}

type LayerTreeRowsListProps = {
  readonly visibleNodes: readonly VisibleNodeMeta[];
  readonly selectedRefs: readonly ElementRef[];
  readonly hoveredRef?: ElementRef | undefined;
  readonly collapsedLocs: ReadonlySet<string>;
  readonly selectedItemRef: React.RefObject<HTMLDivElement | undefined>;
  readonly onNodeClick: (node: TreeNode) => void;
  readonly onNodeHover: (node: TreeNode) => void;
  readonly onMouseLeave: () => void;
  readonly onToggleCollapse: (loc: string, e: React.MouseEvent) => void;
};

function LayerTreeRowsList({
  visibleNodes,
  selectedRefs,
  hoveredRef,
  collapsedLocs,
  selectedItemRef,
  onNodeClick,
  onNodeHover,
  onMouseLeave,
  onToggleCollapse,
}: LayerTreeRowsListProps) {
  return (
    <>
      {visibleNodes.map((meta) => {
        if (!meta.isVisible) return undefined;
        const isSelected = selectedRefs.some(
          (r) => r.loc === meta.node.ref.loc && r.index === meta.node.ref.index,
        );
        const isHovered =
          hoveredRef !== undefined &&
          hoveredRef.loc === meta.node.ref.loc &&
          hoveredRef.index === meta.node.ref.index;

        return (
          <LayerTreeRow
            key={`${meta.node.ref.loc}:${String(meta.node.ref.index)}`}
            meta={meta}
            isSelected={isSelected}
            isHovered={isHovered}
            isCollapsed={collapsedLocs.has(meta.node.ref.loc)}
            rowRef={
              isSelected
                ? (el) => {
                    selectedItemRef.current = el ?? undefined;
                  }
                : undefined
            }
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onMouseLeave={onMouseLeave}
            onToggleCollapse={onToggleCollapse}
          />
        );
      })}
    </>
  );
}

function useLayerTreeState(
  onSelect?: (ref: ElementRef, reveal: boolean) => void,
  onHover?: (ref?: ElementRef) => void,
) {
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const hoveredRef = useSelectionStore((s) => s.hoveredRef);
  const setHoveredRef = useSelectionStore((s) => s.setHoveredRef);

  const [collapsedLocs, setCollapsedLocs] = useState<ReadonlySet<string>>(new Set());
  const { selectedRefs, selectedItemRef, setSelectedRefs } = useLayerTreeSelection(
    treeNodes,
    collapsedLocs,
    setCollapsedLocs,
    onSelect,
  );

  const visibleNodes = useMemo(
    () => computeVisibleNodes(treeNodes, collapsedLocs),
    [treeNodes, collapsedLocs],
  );

  const toggleCollapse = useCallback((loc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedLocs((prev) => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  }, []);

  const handlers = useLayerTreeHandlers(setSelectedRefs, setHoveredRef, onSelect, onHover);

  return {
    treeNodes,
    hoveredRef,
    collapsedLocs,
    selectedRefs,
    selectedItemRef,
    visibleNodes,
    toggleCollapse,
    ...handlers,
  };
}

export function LayerTree({ onSelect, onHover }: LayerTreeProps) {
  const { t } = useTranslation();
  const s = useLayerTreeState(onSelect, onHover);

  if (s.treeNodes.length === 0) {
    return <p className="px-3 py-4 text-xs text-ink-faint">{t('editor.layersHint')}</p>;
  }

  return (
    <div
      role="tree"
      aria-label={t('editor.layers')}
      className="flex flex-col gap-0.5 overflow-x-hidden font-sans text-xs select-none"
    >
      <LayerTreeRowsList
        visibleNodes={s.visibleNodes}
        selectedRefs={s.selectedRefs}
        hoveredRef={s.hoveredRef}
        collapsedLocs={s.collapsedLocs}
        selectedItemRef={s.selectedItemRef}
        onNodeClick={s.handleNodeClick}
        onNodeHover={s.handleNodeHover}
        onMouseLeave={s.handleMouseLeave}
        onToggleCollapse={s.toggleCollapse}
      />
    </div>
  );
}
