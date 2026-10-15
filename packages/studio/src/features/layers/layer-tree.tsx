// Layer Tree component displaying DOM hierarchy with 2-way sync (SPEC-04 M-SL, R-SL-07..09).
import type { ElementRef, TreeNode } from '@reactcraft/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';

const CHEVRON_EXPANDED = '▼';
const CHEVRON_COLLAPSED = '▶';

export type LayerTreeProps = {
  readonly onSelect?: ((ref: ElementRef, reveal: boolean) => void) | undefined;
  readonly onHover?: ((ref: ElementRef | undefined) => void) | undefined;
};

function getFileFromLoc(loc: string): string {
  const parts = loc.split(':');
  return parts[0] ?? loc;
}

function getComponentName(filePath: string): string {
  const fileName = filePath.split('/').pop() ?? filePath;
  return fileName.replace(/\.[^.]+$/, '');
}

type NodeMeta = {
  readonly node: TreeNode;
  readonly index: number;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly isVisible: boolean;
  readonly isBoundary: boolean;
  readonly componentName?: string | undefined;
};

function computeVisibleNodes(
  treeNodes: readonly TreeNode[],
  collapsedLocs: ReadonlySet<string>,
): NodeMeta[] {
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

  const result: NodeMeta[] = [];
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

type LayerTreeRowProps = {
  readonly meta: NodeMeta;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isCollapsed: boolean;
  readonly rowRef?: React.Ref<HTMLDivElement> | undefined;
  readonly onNodeClick: (node: TreeNode) => void;
  readonly onNodeHover: (node: TreeNode) => void;
  readonly onMouseLeave: () => void;
  readonly onToggleCollapse: (loc: string, e: React.MouseEvent) => void;
};

function LayerTreeRow({
  meta,
  isSelected,
  isHovered,
  isCollapsed,
  rowRef,
  onNodeClick,
  onNodeHover,
  onMouseLeave,
  onToggleCollapse,
}: LayerTreeRowProps) {
  const { t } = useTranslation();
  const { node, depth, hasChildren, isBoundary, componentName } = meta;

  return (
    <div
      ref={rowRef}
      role="treeitem"
      tabIndex={0}
      aria-selected={isSelected}
      aria-expanded={hasChildren ? !isCollapsed : undefined}
      onClick={() => {
        onNodeClick(node);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onNodeClick(node);
        }
      }}
      onMouseEnter={() => {
        onNodeHover(node);
      }}
      onMouseLeave={onMouseLeave}
      style={{ paddingLeft: `${String(depth * 12 + 6)}px` }}
      className={`group flex h-7 items-center gap-1.5 rounded-md px-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary ${
        isSelected
          ? 'bg-card-solid text-ink font-medium shadow-[0_1px_2px_rgba(60,52,30,0.1)]'
          : isHovered
            ? 'bg-field-hover text-ink'
            : 'text-ink-soft hover:bg-field hover:text-ink'
      }`}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            onToggleCollapse(node.ref.loc, e);
          }}
          className="flex h-4 w-4 items-center justify-center rounded text-ink-faint hover:text-ink"
          aria-label={isCollapsed ? t('editor.expand') : t('editor.collapse')}
        >
          <span className="text-[10px]" aria-hidden="true">
            {isCollapsed ? CHEVRON_COLLAPSED : CHEVRON_EXPANDED}
          </span>
        </button>
      ) : (
        <span className="w-4" />
      )}

      <span className="font-mono text-[11px] text-ink">{node.tag}</span>

      {node.label && (
        <span className="truncate text-[11px] text-ink-faint group-hover:text-ink-soft">
          {node.label}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {node.instances > 1 && (
          <span
            data-testid="instances-badge"
            className="rounded bg-field px-1 py-0.5 font-mono text-[10px] text-ink-faint"
          >
            {`×${String(node.instances)}`}
          </span>
        )}

        {isBoundary && componentName && (
          <span
            data-testid="component-badge"
            className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary"
          >
            {componentName}
          </span>
        )}
      </div>
    </div>
  );
}

function useLayerTreeSelection(
  treeNodes: readonly TreeNode[],
  collapsedLocs: ReadonlySet<string>,
  setCollapsedLocs: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>,
  onSelect?: (ref: ElementRef, reveal: boolean) => void,
) {
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const setSelectedRefs = useSelectionStore((s) => s.setSelectedRefs);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const selectedItemRef = useRef<HTMLDivElement>(undefined);

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

  useEffect(() => {
    if (selectedRefs.length === 0) return;
    const primary = selectedRefs[selectedRefs.length - 1];
    if (!primary) return;

    const idx = treeNodes.findIndex(
      (n) => n.ref.loc === primary.loc && n.ref.index === primary.index,
    );
    if (idx === -1) return;

    const toExpand: string[] = [];
    let curr = treeNodes[idx]?.parent;
    while (curr !== undefined) {
      const pNode = treeNodes[curr];
      if (pNode && collapsedLocs.has(pNode.ref.loc)) toExpand.push(pNode.ref.loc);
      curr = pNode?.parent;
    }

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
  }, [selectedRefs, treeNodes, collapsedLocs, setCollapsedLocs]);

  return { selectedRefs, selectedItemRef, setSelectedRefs };
}

export function LayerTree({ onSelect, onHover }: LayerTreeProps) {
  const { t } = useTranslation();
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

  if (treeNodes.length === 0) {
    return <p className="px-3 py-4 text-xs text-ink-faint">{t('editor.layersHint')}</p>;
  }

  return (
    <div
      role="tree"
      aria-label={t('editor.layers')}
      className="flex flex-col gap-0.5 overflow-x-hidden font-sans text-xs select-none"
    >
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
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onMouseLeave={handleMouseLeave}
            onToggleCollapse={toggleCollapse}
          />
        );
      })}
    </div>
  );
}
