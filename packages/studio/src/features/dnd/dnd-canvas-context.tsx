import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  assignIds,
  canInsert,
  type CanInsertSubject,
  CONTAINER_TYPES,
  type DesignNode,
  type DesignOperation,
  instantiatePreset,
  PRESETS,
  type TreeTarget,
} from '@reactcraft/model';
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useEditorStore } from '../../store/editor-store.ts';
import { useCanvasContext } from '../canvas/canvas-context.ts';
import { useCanvasScale } from '../canvas/canvas-scale-context.tsx';
import {
  createDropTargetCache,
  dropStops,
  type DropTarget,
  type DropTargetCache,
  findDropTarget,
  synchronousCache,
} from './drop-target.ts';

type DndCanvasState = {
  readonly isDragging: boolean;
  readonly activeId?: string | undefined;
  readonly dropTarget?: DropTarget | undefined;
  readonly pointerY: number;
};

const DndCanvasStateContext = createContext<DndCanvasState>({ isDragging: false, pointerY: 0 });

export const useDndCanvas = () => useContext(DndCanvasStateContext);

type Point = { x: number; y: number };

function toFrameCoordinates(
  clientX: number,
  clientY: number,
  frameRect: DOMRect | undefined,
  scale: number,
): Point | undefined {
  if (frameRect === undefined) return undefined;
  return {
    x: (clientX - frameRect.left) / scale,
    y: (clientY - frameRect.top) / scale,
  };
}

type ResolvedSubject = {
  readonly subject: CanInsertSubject;
  readonly excludedIds: ReadonlySet<string>;
  readonly isPreset: boolean;
};

/** What is being dragged, worked out once when the drag starts. */
function resolveSubject(
  activeId: string,
  selectedNodeIds: readonly string[],
  flatNodes: Readonly<Record<string, unknown>>,
): ResolvedSubject | undefined {
  if (activeId.startsWith('preset:')) {
    const preset = PRESETS.find((p) => p.id === activeId.slice('preset:'.length));
    if (preset === undefined) return undefined;
    const document = useEditorStore.getState().document;
    // R-LB-02: tokens the workspace no longer has become plain values.
    const { node } = instantiatePreset(preset, {
      tokens: document?.tokens,
      contentLocale: document?.workspace.contentLocale,
    });
    return { subject: { kind: 'new', node }, excludedIds: new Set(), isPreset: true };
  }

  const nodeId = activeId.replace(/^(node|canvas-node|layer-node):/, '');
  const moveIds = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];
  const validMoveIds = moveIds.filter((id) => flatNodes[id] !== undefined);
  return {
    subject: { kind: 'move', nodeIds: validMoveIds },
    excludedIds: new Set(validMoveIds),
    isPreset: false,
  };
}

function executePresetDrop(node: DesignNode, target: DropTarget, treeTarget: TreeTarget): void {
  const store = useEditorStore.getState();
  const rawOp: DesignOperation = {
    op: 'insert',
    target: treeTarget,
    parentId: target.containerId,
    index: target.index,
    node,
  };
  const { ops } = assignIds([rawOp]);
  const [inserted] = ops;
  const applied = store.dispatch(ops, { label: 'Insert from Library', source: 'user' });
  if (applied.ok && inserted?.op === 'insert') store.selectNode(inserted.node.id);
}

/**
 * The `move` operations that put `nodeIds`, in order, at `index` of the target's children counted
 * without the moved nodes. Each move's index counts after that node left its place (V-41), so the
 * list is replayed step by step.
 */
export function planMoves(
  nodeIds: readonly string[],
  targetChildIds: readonly string[],
  index: number,
): { readonly moves: readonly { id: string; index: number }[]; readonly result: string[] } {
  const anchor = targetChildIds.filter((id) => !nodeIds.includes(id))[index];
  let current = [...targetChildIds];
  const moves: { id: string; index: number }[] = [];
  let previous: string | undefined;
  for (const id of nodeIds) {
    current = current.filter((other) => other !== id);
    const at =
      previous !== undefined
        ? current.indexOf(previous) + 1
        : anchor === undefined
          ? current.length
          : current.indexOf(anchor);
    current.splice(at, 0, id);
    moves.push({ id, index: at });
    previous = id;
  }
  return { moves, result: current };
}

function executeMoveDrop(
  nodeIds: readonly string[],
  target: DropTarget,
  treeTarget: TreeTarget,
): void {
  const store = useEditorStore.getState();
  const childIds = store.flatNodes[target.containerId]?.childIds ?? [];
  const { moves, result } = planMoves(nodeIds, childIds, target.index);
  // R-DD-04: dropped where they already were.
  if (result.length === childIds.length && result.every((id, i) => id === childIds[i])) return;
  const ops: DesignOperation[] = moves.map((move) => ({
    op: 'move',
    target: treeTarget,
    nodeId: move.id,
    newParentId: target.containerId,
    index: move.index,
  }));
  if (store.dispatch(ops, { label: 'Move', source: 'user' }).ok) store.selectNodes(nodeIds);
}

type LocateContext = {
  readonly iframeDoc?: Document | undefined;
  readonly iframe?: HTMLIFrameElement | undefined;
  readonly scale: number;
  readonly treeTarget?: TreeTarget | undefined;
};

function displayName(id: string): string {
  const node = useEditorStore.getState().flatNodes[id];
  return node?.name ?? node?.type ?? id;
}

function isContainerNode(id: string): boolean {
  const type = useEditorStore.getState().flatNodes[id]?.type;
  return type !== undefined && CONTAINER_TYPES.has(type);
}

/** PB-15: measured as `rc:drop-target`. */
function performLocate(
  clientPoint: Point,
  drag: ResolvedSubject,
  ctx: LocateContext,
  cache: DropTargetCache,
): DropTarget | undefined {
  const doc = useEditorStore.getState().document;
  if (!ctx.iframeDoc || !ctx.iframe || !doc || !ctx.treeTarget) return undefined;
  const framePt = toFrameCoordinates(
    clientPoint.x,
    clientPoint.y,
    ctx.iframe.getBoundingClientRect(),
    ctx.scale,
  );
  if (!framePt) return undefined;

  performance.mark('rc:drop-target-start');
  const found = findDropTarget(
    ctx.iframeDoc,
    doc,
    ctx.treeTarget,
    framePt.x,
    framePt.y,
    drag.subject,
    drag.excludedIds,
    cache,
    displayName,
    isContainerNode,
  );
  performance.mark('rc:drop-target-end');
  performance.measure('rc:drop-target', 'rc:drop-target-start', 'rc:drop-target-end');
  return found;
}

/** R-DD-06: arrow keys walk the valid drop positions in tree order. */
function useStopKeysHandler(
  ctx: LocateContext,
  dragRef: { readonly current: ResolvedSubject | undefined },
): KeyboardCoordinateGetter {
  return useCallback(
    (event, { currentCoordinates }) => {
      const doc = useEditorStore.getState().document;
      const drag = dragRef.current;
      if (!ctx.iframeDoc || !ctx.iframe || !doc || !ctx.treeTarget || !drag) return undefined;
      const forward = event.code === 'ArrowRight' || event.code === 'ArrowDown';
      const backward = event.code === 'ArrowLeft' || event.code === 'ArrowUp';
      if (!forward && !backward) return undefined;

      const rect = ctx.iframe.getBoundingClientRect();
      const stops = dropStops(
        ctx.iframeDoc,
        doc,
        ctx.treeTarget,
        drag.subject,
        drag.excludedIds,
        isContainerNode,
      ).map((stop) => ({ x: rect.left + stop.x * ctx.scale, y: rect.top + stop.y * ctx.scale }));
      if (stops.length === 0) return currentCoordinates;
      const current = stops.findIndex(
        (stop) =>
          Math.abs(stop.x - currentCoordinates.x) < 2 &&
          Math.abs(stop.y - currentCoordinates.y) < 2,
      );
      const next =
        current === -1 ? 0 : Math.min(stops.length - 1, Math.max(0, current + (forward ? 1 : -1)));
      return stops[next];
    },
    [ctx, dragRef],
  );
}

function useLocateContext(): LocateContext {
  const { iframe, iframeDoc } = useCanvasContext();
  const scale = useCanvasScale();
  const activePageId = useEditorStore((s) => s.activePageId);
  return useMemo(
    () => ({
      iframe,
      iframeDoc,
      scale,
      treeTarget: activePageId === undefined ? undefined : { kind: 'page', pageId: activePageId },
    }),
    [iframe, iframeDoc, scale, activePageId],
  );
}

function pointerOf(e: DragMoveEvent | DragEndEvent, fallback: Point): Point {
  const translated = e.active.rect.current.translated;
  if (e.activatorEvent.type.startsWith('key') && translated) {
    return { x: translated.left, y: translated.top };
  }
  const start = e.activatorEvent as Partial<MouseEvent>;
  if (typeof start.clientX === 'number' && typeof start.clientY === 'number') {
    return { x: start.clientX + e.delta.x, y: start.clientY + e.delta.y };
  }
  return fallback;
}

const LAYER_PREFIX = 'layer-node:';

/**
 * R-LT-05: a Layer Tree row dropped on another row goes before or after it (upper or lower half),
 * in the same parent, if `canInsert` allows it.
 */
function layerDropTarget(
  e: DragEndEvent,
  drag: ResolvedSubject,
  pointerY: number,
  treeTarget: TreeTarget,
): DropTarget | undefined {
  const overId = typeof e.over?.id === 'string' ? e.over.id : '';
  if (!overId.startsWith(LAYER_PREFIX) || drag.subject.kind !== 'move') return undefined;
  const over = overId.slice(LAYER_PREFIX.length);
  const { flatNodes, document } = useEditorStore.getState();
  const parentId = flatNodes[over]?.parentId;
  if (parentId === undefined || document === undefined || drag.excludedIds.has(over))
    return undefined;
  const siblings = (flatNodes[parentId]?.childIds ?? []).filter((id) => !drag.excludedIds.has(id));
  const rect = e.over?.rect;
  const after = rect !== undefined && pointerY > rect.top + rect.height / 2;
  const index = siblings.indexOf(over) + (after ? 1 : 0);
  const allowed = canInsert(document, treeTarget, parentId, drag.subject, index).ok;
  return { containerId: parentId, index, allowed };
}

/** Where a drag ends: on a Layer Tree row for rows, on the Canvas otherwise. */
function endTarget(
  e: DragEndEvent,
  drag: ResolvedSubject | undefined,
  ctx: LocateContext,
  pointerY: number,
  canvasTarget: DropTarget | undefined,
): DropTarget | undefined {
  if (!String(e.active.id).startsWith(LAYER_PREFIX)) return canvasTarget;
  if (drag === undefined || ctx.treeTarget === undefined) return undefined;
  return layerDropTarget(e, drag, pointerY, ctx.treeTarget);
}

function finishDrop(drag: ResolvedSubject, target: DropTarget, treeTarget: TreeTarget): void {
  if (!target.allowed) return;
  if (drag.subject.kind === 'new') executePresetDrop(drag.subject.node, target, treeTarget);
  else executeMoveDrop(drag.subject.nodeIds, target, treeTarget);
}

function useDndSensors(
  ctx: LocateContext,
  dragRef: { readonly current: ResolvedSubject | undefined },
) {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: useStopKeysHandler(ctx, dragRef) }),
  );
}

/**
 * PB-15: the cache of one drag. A `canInsert` that was put off runs on the next task, then the
 * target is worked out again, since the answer may have changed.
 */
function useDeferredCache(
  ctx: LocateContext,
  dragRef: { readonly current: ResolvedSubject | undefined },
  pointer: { readonly current: Point },
  setTarget: (target: DropTarget | undefined) => void,
) {
  const cacheRef = useRef<DropTargetCache>(createDropTargetCache());
  const ctxRef = useRef(ctx);
  useEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);
  const freshCache = useCallback(() => {
    cacheRef.current = createDropTargetCache((run) => {
      setTimeout(() => {
        run();
        const drag = dragRef.current;
        if (drag !== undefined)
          setTarget(performLocate(pointer.current, drag, ctxRef.current, cacheRef.current));
      }, 0);
    });
  }, [dragRef, pointer, setTarget]);
  return { cacheRef, freshCache };
}

/** Ends a drag. Every check runs now, so a drop never lands where a deferred check would refuse. */
function dropAt(
  e: DragEndEvent,
  drag: ResolvedSubject | undefined,
  ctx: LocateContext,
  point: Point,
  cache: DropTargetCache,
): void {
  if (drag === undefined || ctx.treeTarget === undefined) return;
  const canvasTarget = performLocate(point, drag, ctx, synchronousCache(cache));
  const target = endTarget(e, drag, ctx, point.y, canvasTarget);
  if (target !== undefined) finishDrop(drag, target, ctx.treeTarget);
}

function useDndCanvasController() {
  const [target, setTarget] = useState<DropTarget>();
  const [dragging, setDragging] = useState<{ id: string; pointerY: number }>();
  const pointer = useRef<Point>({ x: 0, y: 0 });
  const dragRef = useRef<ResolvedSubject>(undefined);
  const ctx = useLocateContext();
  const { cacheRef, freshCache } = useDeferredCache(ctx, dragRef, pointer, setTarget);
  const sensors = useDndSensors(ctx, dragRef);

  const reset = () => {
    dragRef.current = undefined;
    setDragging(undefined);
    setTarget(undefined);
  };
  const move = (e: DragMoveEvent | DragEndEvent) => {
    const drag = dragRef.current;
    pointer.current = pointerOf(e, pointer.current);
    return drag === undefined
      ? undefined
      : performLocate(pointer.current, drag, ctx, cacheRef.current);
  };

  return {
    sensors,
    onDragStart: (e: DragStartEvent) => {
      const { selectedNodeIds, flatNodes } = useEditorStore.getState();
      freshCache();
      dragRef.current = resolveSubject(String(e.active.id), selectedNodeIds, flatNodes);
      setDragging({ id: String(e.active.id), pointerY: pointer.current.y });
    },
    onDragMove: (e: DragMoveEvent) => {
      setTarget(move(e));
      setDragging((d) => (d === undefined ? d : { ...d, pointerY: pointer.current.y }));
    },
    onDragEnd: (e: DragEndEvent) => {
      const drag = dragRef.current;
      pointer.current = pointerOf(e, pointer.current);
      reset();
      dropAt(e, drag, ctx, pointer.current, cacheRef.current);
    },
    onDragCancel: reset,
    state: {
      isDragging: dragging !== undefined,
      activeId: dragging?.id,
      dropTarget: target,
      pointerY: dragging?.pointerY ?? 0,
    },
  };
}

export function DndCanvasProvider({ children }: { readonly children: ReactNode }) {
  const dnd = useDndCanvasController();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <DndContext
        sensors={dnd.sensors}
        autoScroll={false}
        onDragStart={dnd.onDragStart}
        onDragMove={dnd.onDragMove}
        onDragEnd={dnd.onDragEnd}
        onDragCancel={dnd.onDragCancel}
      >
        <DndCanvasStateContext.Provider value={dnd.state}>
          {children}
        </DndCanvasStateContext.Provider>
      </DndContext>
    </div>
  );
}
