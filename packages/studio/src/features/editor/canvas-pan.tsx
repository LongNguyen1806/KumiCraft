// Pan tool: dragging the Canvas moves the view, the page gets no click (R-DT-16).
import { type PointerEvent, type ReactNode, useRef, useState } from 'react';

import { useCanvasViewStore } from './canvas-view-store.ts';

type Point = { readonly x: number; readonly y: number };

/** Covers the Canvas while the Pan tool is on, so a drag never reaches the page in the frame. */
export function CanvasPanSurface() {
  const panning = useCanvasViewStore((s) => s.panning);
  const panBy = useCanvasViewStore((s) => s.panBy);
  const last = useRef<Point>(undefined);
  const [dragging, setDragging] = useState(false);

  if (!panning) return undefined;

  const end = () => {
    last.current = undefined;
    setDragging(false);
  };

  return (
    <div
      data-testid="canvas-pan-surface"
      className={`absolute inset-0 z-20 touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = { x: e.clientX, y: e.clientY };
        setDragging(true);
      }}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        const from = last.current;
        if (from === undefined) return;
        panBy(e.clientX - from.x, e.clientY - from.y);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );
}

/** Moves the frame by the pan offset; no transform at all while it sits in its place. */
export function PannedContent({ children }: { readonly children: ReactNode }) {
  const pan = useCanvasViewStore((s) => s.pan);
  const moved = pan.x !== 0 || pan.y !== 0;
  return (
    <div
      data-testid="canvas-pan-content"
      style={moved ? { transform: `translate(${String(pan.x)}px, ${String(pan.y)}px)` } : undefined}
    >
      {children}
    </div>
  );
}
