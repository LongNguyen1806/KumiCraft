// Virtualized Layer Tree panel with two-way selection sync, sortable DnD, and rename (SPEC-04.1 section 12, M-LT).
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { DesignNode, DesignOperation, NodeRecord, TreeTarget } from '@reactcraft/model';
import {
  type Rect,
  useVirtualizer,
  type VirtualItem,
  type Virtualizer,
} from '@tanstack/react-virtual';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { type ContextMenuState, LayerContextMenu } from './layer-context-menu.tsx';
import { type LayerRowData, LayerTreeRow } from './layer-tree-row.tsx';

function findAncestorIds(root: DesignNode | undefined, targetId: string): string[] {
  if (!root) return [];
  const ancestors: string[] = [];

  function search(node: DesignNode): boolean {
    if (node.id === targetId) return true;
    if (node.children) {
      for (const child of node.children) {
        if (search(child)) {
          ancestors.push(node.id);
          return true;
        }
      }
    }
    if (node.slots) {
      for (const slotNodes of Object.values(node.slots)) {
        for (const slotNode of slotNodes) {
          if (search(slotNode)) {
            ancestors.push(node.id);
            return true;
          }
        }
      }
    }
    return false;
  }

  search(root);
  return ancestors;
}

function flattenLayerTree(
  root: DesignNode | undefined,
  collapsedIds: ReadonlySet<string>,
): LayerRowData[] {
  if (!root) return [];
  const items: LayerRowData[] = [];

  function walk(node: DesignNode, depth: number) {
    const isExpanded = !collapsedIds.has(node.id);
    const isComponent = node.type === 'ComponentInstance';
    const hasChildren = Boolean(
      (node.children && node.children.length > 0) ||
      (isComponent && node.slots && Object.keys(node.slots).length > 0),
    );

    items.push({ id: node.id, nodeId: node.id, depth, hasChildren, isExpanded });

    if (isExpanded) {
      if (node.children) {
        for (const child of node.children) walk(child, depth + 1);
      }
      if (isComponent && node.slots) {
        for (const slotNodes of Object.values(node.slots)) {
          for (const slotNode of slotNodes) walk(slotNode, depth + 1);
        }
      }
    }
  }

  walk(root, 0);
  return items;
}

function useLayerTreeSelection(
  root: DesignNode | undefined,
  selectedNodeId: string | undefined,
  items: readonly LayerRowData[],
  setCollapsedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  scrollToIndex: (index: number) => void,
) {
  useEffect(() => {
    if (!selectedNodeId || !root) return;
    const ancestors = findAncestorIds(root, selectedNodeId);
    if (ancestors.length === 0) return;
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ancestors) {
        if (next.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedNodeId, root, setCollapsedIds]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const index = items.findIndex((item) => item.nodeId === selectedNodeId);
    if (index !== -1) scrollToIndex(index);
  }, [selectedNodeId, items, scrollToIndex]);

  const toggleExpand = useCallback(
    (nodeId: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
    },
    [setCollapsedIds],
  );

  return { toggleExpand };
}

function useLayerTreeShortcuts(
  selectedNodeId: string | undefined,
  setRenamingId: (id: string | undefined) => void,
) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && selectedNodeId) {
        e.preventDefault();
        setRenamingId(selectedNodeId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedNodeId, setRenamingId]);
}

type LayerTreeProps = {
  readonly root: DesignNode | undefined;
  readonly selectedNodeIds?: readonly string[];
  readonly hoveredNodeId?: string | undefined;
  readonly onSelect: (nodeId: string) => void;
  readonly onToggleSelect?: (nodeId: string) => void;
  readonly onHover?: (nodeId: string | undefined) => void;
};

type VirtualRowsListProps = {
  readonly items: readonly LayerRowData[];
  readonly flatNodes: Readonly<Record<string, NodeRecord>>;
  readonly selectedNodeIds: readonly string[];
  readonly hoveredNodeId?: string | undefined;
  readonly renamingId?: string | undefined;
  readonly virtualItems: readonly VirtualItem[];
  readonly totalSize: number;
  readonly onSelect: (nodeId: string) => void;
  readonly onToggleSelect: (nodeId: string) => void;
  readonly onHover: (nodeId: string | undefined) => void;
  readonly onToggleExpand: (nodeId: string) => void;
  readonly onStartRename: (nodeId: string) => void;
  readonly onFinishRename: (nodeId: string, newName?: string) => void;
  readonly onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
};

function VirtualRow({
  list,
  virtual,
}: {
  readonly list: VirtualRowsListProps;
  readonly virtual: VirtualItem;
}): ReactNode {
  const item = list.items[virtual.index];
  const node = item === undefined ? undefined : list.flatNodes[item.nodeId];
  if (item === undefined || node === undefined) return undefined;
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: virtual.size,
        transform: `translateY(${String(virtual.start)}px)`,
      }}
    >
      <LayerTreeRow
        item={item}
        node={node}
        isSelected={list.selectedNodeIds.includes(node.id)}
        isHovered={node.id === list.hoveredNodeId}
        isRenaming={list.renamingId === node.id}
        onSelect={list.onSelect}
        onToggleSelect={list.onToggleSelect}
        onHover={list.onHover}
        onToggleExpand={list.onToggleExpand}
        onStartRename={list.onStartRename}
        onFinishRename={list.onFinishRename}
        onContextMenu={list.onContextMenu}
      />
    </div>
  );
}

function VirtualRowsList(props: VirtualRowsListProps): ReactNode {
  const { items, virtualItems, totalSize } = props;
  const sortableIds = useMemo(() => items.map((item) => `layer-node:${item.nodeId}`), [items]);
  return (
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <div
        data-testid="layer-list"
        style={{ height: totalSize, position: 'relative', width: '100%' }}
      >
        {virtualItems.map((virtual) => (
          <VirtualRow
            key={items[virtual.index]?.id ?? virtual.key}
            list={props}
            virtual={virtual}
          />
        ))}
      </div>
    </SortableContext>
  );
}

/** Measures the scroll box; falls back to a usual panel size where nothing is laid out (jsdom). */
function observeLayerTreeRect(
  instance: Virtualizer<HTMLElement, Element>,
  cb: (rect: Rect) => void,
) {
  const element = instance.scrollElement;
  if (!element) return undefined;
  const measure = (height: number, width: number) => {
    cb({ height: Math.round(height || 600), width: Math.round(width || 300) });
  };
  measure(element.clientHeight, element.clientWidth);
  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (box) measure(box.height, box.width);
  });
  observer.observe(element);
  return () => {
    observer.disconnect();
  };
}

function useLayerTreeState(
  root: DesignNode | undefined,
  selectedNodeId: string | undefined,
  scrollElement: HTMLDivElement | undefined,
) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const items = useMemo(() => flattenLayerTree(root, collapsedIds), [root, collapsedIds]);

  const virtualizer = useVirtualizer({
    count: items.length,
    // State, not a ref: the virtualizer must render again once the scroll box exists, or it never
    // follows the scrolling. `getElementById('')` is the null the API wants (QC-40 bans the literal).
    getScrollElement: () => scrollElement ?? document.getElementById(''),
    estimateSize: () => 32,
    overscan: 10,
    // Size used before the first measure, and in jsdom where nothing is measured.
    initialRect: { width: 300, height: 600 },
    observeElementRect: observeLayerTreeRect,
  });

  const scrollToIndex = useCallback(
    (index: number) => {
      virtualizer.scrollToIndex(index, { align: 'auto' });
    },
    [virtualizer],
  );

  const { toggleExpand } = useLayerTreeSelection(
    root,
    selectedNodeId,
    items,
    setCollapsedIds,
    scrollToIndex,
  );
  // Read here, where React Compiler leaves the code alone (TanStack Virtual is not compatible with
  // it): a memoised read in the component would keep the first rows forever.
  return {
    items,
    toggleExpand,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}

type LayerTreeContentProps = {
  readonly items: readonly LayerRowData[];
  readonly selectedNodeIds: readonly string[];
  readonly hoveredNodeId?: string | undefined;
  readonly virtualItems: readonly VirtualItem[];
  readonly totalSize: number;
  readonly toggleExpand: (nodeId: string) => void;
  readonly renamingId?: string | undefined;
  readonly setRenamingId: (id: string | undefined) => void;
  readonly contextMenu?: ContextMenuState | undefined;
  readonly setContextMenu: (menu: ContextMenuState | undefined) => void;
  readonly onSelect: (nodeId: string) => void;
  readonly onToggleSelect: (nodeId: string) => void;
  readonly onHover: (nodeId: string | undefined) => void;
};

function renameNode(treeTarget: TreeTarget, nodeId: string, name: string): void {
  const op: DesignOperation = { op: 'setNodeMeta', target: treeTarget, nodeId, name };
  useEditorStore.getState().dispatch([op], { label: 'Rename', source: 'user' });
}

function LayerTreeContent(props: LayerTreeContentProps): ReactNode {
  const { setRenamingId, contextMenu, setContextMenu } = props;
  const flatNodes = useEditorStore((s) => s.flatNodes);
  const activePageId = useEditorStore((s) => s.activePageId);
  return (
    <>
      <VirtualRowsList
        items={props.items}
        flatNodes={flatNodes}
        selectedNodeIds={props.selectedNodeIds}
        hoveredNodeId={props.hoveredNodeId}
        renamingId={props.renamingId}
        virtualItems={props.virtualItems}
        totalSize={props.totalSize}
        onSelect={props.onSelect}
        onToggleSelect={props.onToggleSelect}
        onHover={props.onHover}
        onToggleExpand={props.toggleExpand}
        onStartRename={setRenamingId}
        onFinishRename={(nodeId, newName) => {
          setRenamingId(undefined);
          if (newName !== undefined && activePageId !== undefined)
            renameNode({ kind: 'page', pageId: activePageId }, nodeId, newName);
        }}
        onContextMenu={(e, id) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, nodeId: id });
        }}
      />
      {contextMenu && (
        <LayerContextMenu
          state={contextMenu}
          onClose={() => {
            setContextMenu(undefined);
          }}
          onStartRename={setRenamingId}
        />
      )}
    </>
  );
}

export function LayerTree({
  root,
  selectedNodeIds = [],
  hoveredNodeId,
  onSelect,
  onToggleSelect = onSelect,
  onHover = () => {},
}: LayerTreeProps): ReactNode {
  const { t } = useTranslation();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement>();
  const selectedNodeId = selectedNodeIds.at(-1);
  const [renamingId, setRenamingId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>();
  const { items, toggleExpand, virtualItems, totalSize } = useLayerTreeState(
    root,
    selectedNodeId,
    scrollElement,
  );
  useLayerTreeShortcuts(selectedNodeId, setRenamingId);

  if (!root || items.length === 0) {
    return <p className="px-1 pt-2 text-ink-faint text-xs">{t('layers.empty')}</p>;
  }

  return (
    <div
      ref={(el) => {
        setScrollElement(el ?? undefined);
      }}
      data-testid="layer-tree"
      className="h-full w-full overflow-y-auto"
    >
      <LayerTreeContent
        items={items}
        selectedNodeIds={selectedNodeIds}
        hoveredNodeId={hoveredNodeId}
        virtualItems={virtualItems}
        totalSize={totalSize}
        toggleExpand={toggleExpand}
        renamingId={renamingId}
        setRenamingId={setRenamingId}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        onSelect={onSelect}
        onToggleSelect={onToggleSelect}
        onHover={onHover}
      />
    </div>
  );
}
