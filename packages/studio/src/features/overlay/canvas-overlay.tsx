// Canvas overlay for hover, single, and multiple node selection (SPEC-04.1 section 8, ADR-FE-10).
import { useDraggable } from '@dnd-kit/core';
import type { NodeRecord } from '@reactcraft/model';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { useCanvasContext } from '../canvas/canvas-context.ts';
import { useCanvasScale } from '../canvas/canvas-scale-context.tsx';
import { useDndCanvas } from '../dnd/dnd-canvas-context.tsx';
import type { DropIndicator } from '../dnd/drop-target.ts';
import { useTextEditStore } from './text-edit/use-text-edit-store.ts';

type NodeBox = {
  readonly id: string;
  readonly rect: DOMRect;
  readonly node?: NodeRecord | undefined;
};

function readNodeRects(
  doc: Document | undefined,
  nodeIds: readonly string[],
  flatNodes: Readonly<Record<string, NodeRecord>>,
): NodeBox[] {
  if (doc === undefined || nodeIds.length === 0) return [];
  const boxes: NodeBox[] = [];
  for (const id of nodeIds) {
    const el = doc.querySelector(`[data-rc-node="${id}"]`);
    if (el) {
      boxes.push({ id, rect: el.getBoundingClientRect(), node: flatNodes[id] });
    }
  }
  return boxes;
}

function SelectionItemBox({ box, scale }: { readonly box: NodeBox; readonly scale: number }) {
  const { t } = useTranslation();
  const { id, rect, node } = box;
  const label = node?.name ?? (node !== undefined ? t(`nodes.${node.type}`, node.type) : id);
  const sizeText = `${String(Math.round(rect.width))} × ${String(Math.round(rect.height))}`;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `canvas-node:${id}` });

  return (
    <div
      data-testid="selection-box"
      data-node-id={id}
      className="pointer-events-none absolute border-2 border-charcoal"
      style={{
        left: rect.left * scale,
        top: rect.top * scale,
        width: rect.width * scale,
        height: rect.height * scale,
      }}
    >
      <span
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        data-testid="selection-label"
        className="pointer-events-auto absolute -top-5 left-0 cursor-grab rounded bg-charcoal px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white shadow-sm active:cursor-grabbing"
      >
        {label}
      </span>
      <span
        data-testid="selection-size"
        className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 rounded bg-charcoal/80 px-1 py-0.5 font-mono text-[9px] leading-tight text-white/90 shadow-sm"
      >
        {sizeText}
      </span>
    </div>
  );
}

function MultiBoundingBox({
  boxes,
  scale,
}: {
  readonly boxes: readonly NodeBox[];
  readonly scale: number;
}) {
  if (boxes.length <= 1) return undefined;
  const minLeft = Math.min(...boxes.map((b) => b.rect.left));
  const minTop = Math.min(...boxes.map((b) => b.rect.top));
  const maxRight = Math.max(...boxes.map((b) => b.rect.right));
  const maxBottom = Math.max(...boxes.map((b) => b.rect.bottom));

  return (
    <div
      data-testid="selection-bounding-box"
      className="pointer-events-none absolute border border-dashed border-charcoal/60"
      style={{
        left: minLeft * scale,
        top: minTop * scale,
        width: (maxRight - minLeft) * scale,
        height: (maxBottom - minTop) * scale,
      }}
    />
  );
}

function HoverBox({ box, scale }: { readonly box: NodeBox | undefined; readonly scale: number }) {
  if (box === undefined) return undefined;
  const { rect } = box;
  return (
    <div
      data-testid="hover-box"
      className="pointer-events-none absolute border border-sun"
      style={{
        left: rect.left * scale,
        top: rect.top * scale,
        width: rect.width * scale,
        height: rect.height * scale,
      }}
    />
  );
}

function BoxIndicator({
  rect,
  scale,
  labelText,
}: {
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly scale: number;
  readonly labelText?: string | undefined;
}) {
  return (
    <div
      data-testid="drop-indicator-box"
      className="pointer-events-none absolute rounded border-2 border-dashed border-sun bg-sun/10"
      style={{
        left: rect.x * scale,
        top: rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale,
      }}
    >
      {labelText && (
        <span
          data-testid="drop-indicator-label"
          className="absolute left-2 top-2 rounded bg-charcoal px-2 py-0.5 text-[11px] font-medium text-white shadow-sm"
        >
          {labelText}
        </span>
      )}
    </div>
  );
}

function LineIndicator({
  rect,
  scale,
  labelText,
}: {
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly scale: number;
  readonly labelText?: string | undefined;
}) {
  return (
    <div
      data-testid="drop-indicator-line"
      className="pointer-events-none absolute bg-sun shadow-sm"
      style={{
        left: rect.x * scale,
        top: rect.y * scale,
        width: Math.max(2, rect.width * scale),
        height: Math.max(2, rect.height * scale),
      }}
    >
      {labelText && (
        <span
          data-testid="drop-indicator-label"
          className="absolute -top-6 left-0 whitespace-nowrap rounded bg-charcoal px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
        >
          {labelText}
        </span>
      )}
    </div>
  );
}

function DropIndicatorView({
  indicator,
  scale,
}: {
  readonly indicator: DropIndicator;
  readonly scale: number;
}) {
  const { t } = useTranslation();
  const { kind, rect, label } = indicator;
  const labelText = label ? t('dnd.intoContainer', { name: label }) : undefined;

  if (kind === 'box') {
    return <BoxIndicator rect={rect} scale={scale} labelText={labelText} />;
  }
  return <LineIndicator rect={rect} scale={scale} labelText={labelText} />;
}

function calculateOverlayBoxes(
  iframeDoc: Document | undefined,
  isTextEditing: boolean,
  hoveredNodeId: string | undefined,
  selectedNodeIds: readonly string[],
  flatNodes: Readonly<Record<string, NodeRecord>>,
): { hoverBox?: NodeBox | undefined; selectedBoxes: readonly NodeBox[] } {
  if (iframeDoc === undefined) {
    return { hoverBox: undefined, selectedBoxes: [] };
  }
  const hoverBox =
    !isTextEditing && hoveredNodeId !== undefined && !selectedNodeIds.includes(hoveredNodeId)
      ? readNodeRects(iframeDoc, [hoveredNodeId], flatNodes)[0]
      : undefined;
  const selectedBoxes = readNodeRects(iframeDoc, selectedNodeIds, flatNodes);
  return { hoverBox, selectedBoxes };
}

function useOverlayMeasurement(
  iframeDoc: Document | undefined,
  isTextEditing: boolean,
  hoveredNodeId: string | undefined,
  selectedNodeIds: readonly string[],
  flatNodes: Readonly<Record<string, NodeRecord>>,
) {
  const [hoverBox, setHoverBox] = useState<NodeBox>();
  const [selectedBoxes, setSelectedBoxes] = useState<readonly NodeBox[]>([]);

  const measureOverlay = useCallback(() => {
    performance.mark('rc:overlay-start');
    const res = calculateOverlayBoxes(
      iframeDoc,
      isTextEditing,
      hoveredNodeId,
      selectedNodeIds,
      flatNodes,
    );
    setHoverBox(res.hoverBox);
    setSelectedBoxes(res.selectedBoxes);
    performance.mark('rc:overlay-end');
    try {
      performance.measure('rc:overlay-update', 'rc:overlay-start', 'rc:overlay-end');
    } catch {
      // ignore
    }
  }, [iframeDoc, isTextEditing, hoveredNodeId, selectedNodeIds, flatNodes]);

  useEffect(() => {
    let animId: number;
    const update = () => {
      animId = requestAnimationFrame(measureOverlay);
    };
    update();

    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    if (iframeDoc !== undefined) observer.observe(iframeDoc.documentElement);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [measureOverlay, iframeDoc]);

  return { hoverBox, selectedBoxes };
}

export function CanvasOverlay(): ReactNode {
  const { iframeDoc } = useCanvasContext();
  const scale = useCanvasScale();
  const hoveredNodeId = useEditorStore((s) => s.hoveredNodeId);
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds);
  const flatNodes = useEditorStore((s) => s.flatNodes);
  const isTextEditing = useTextEditStore((s) => s.editingNodeId !== undefined);
  const { isDragging, dropTarget } = useDndCanvas();

  const { hoverBox, selectedBoxes } = useOverlayMeasurement(
    iframeDoc,
    isTextEditing,
    hoveredNodeId,
    selectedNodeIds,
    flatNodes,
  );

  return (
    <div
      data-testid="canvas-overlay"
      className="absolute inset-0 overflow-hidden rounded-[14px]"
      style={{
        pointerEvents: isDragging ? 'auto' : 'none',
        cursor: isDragging && dropTarget && !dropTarget.allowed ? 'not-allowed' : undefined,
      }}
    >
      {!isDragging && <HoverBox box={hoverBox} scale={scale} />}
      {selectedBoxes.map((box) => (
        <SelectionItemBox key={box.id} box={box} scale={scale} />
      ))}
      <MultiBoundingBox boxes={selectedBoxes} scale={scale} />
      {isDragging && dropTarget?.indicator && (
        <DropIndicatorView indicator={dropTarget.indicator} scale={scale} />
      )}
    </div>
  );
}
