// VG-11 spike (ADR-FE-07, ADR-FE-09): @dnd-kit drives the drag session in the Studio document,
// the Overlay covers the Canvas iframe while dragging, and the drop position comes from the real
// layout inside the iframe. scripts/vg/vg-11.mjs drives it and reads `window.__vg11`.
import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { CANVAS_HTML } from './canvas-page.ts';
import { dropStops, type DropTarget, findDropTarget } from './drop-target.ts';

type Probe = {
  ready: boolean;
  drops: { active: string; target?: { container: string; index: number } }[];
  computeMs: number[];
  renderMs: number[];
  /** dnd-kit session events, for diagnosis. */
  events: string[];
  /** Targets of the keyboard stops, in order, for a drag of `activeId`. */
  stopTargets: (activeId: string) => ({ container: string; index: number } | undefined)[];
};

declare global {
  interface Window {
    __vg11: Probe;
  }
}

const params = new URLSearchParams(location.search);
const ZOOM = Number(params.get('zoom') ?? '1');
const WIDTH = Number(params.get('width') ?? '1280');
const HEIGHT = 700;
let frame: HTMLIFrameElement | undefined;
const frameDoc = () => frame?.contentDocument ?? undefined;
const frameRect = () => frame?.getBoundingClientRect();

/** Studio (client) coordinates to iframe coordinates: the frame is scaled by ZOOM. */
function toFrame(x: number, y: number) {
  const rect = frameRect();
  return rect === undefined ? undefined : { x: (x - rect.left) / ZOOM, y: (y - rect.top) / ZOOM };
}

const draggedNode = (activeId: string) =>
  activeId.startsWith('node:') ? activeId.slice('node:'.length) : undefined;

const probe: Probe = {
  ready: false,
  drops: [],
  computeMs: [],
  renderMs: [],
  events: [],
  stopTargets: (activeId) => {
    const doc = frameDoc();
    if (doc === undefined) return [];
    const dragged = draggedNode(activeId);
    return dropStops(doc, dragged).map((stop) => {
      const found = findDropTarget(doc, stop.x, stop.y, dragged);
      return found === undefined ? undefined : { container: found.container, index: found.index };
    });
  },
};
window.__vg11 = probe;

/** R-DD-06: arrow keys jump between the drop stops of the page, in document order. */
const stopKeys: KeyboardCoordinateGetter = (event, { active, currentCoordinates }) => {
  const doc = frameDoc();
  const rect = frameRect();
  if (doc === undefined || rect === undefined) return currentCoordinates;
  const stops = dropStops(doc, draggedNode(String(active))).map((stop) => ({
    x: rect.left + stop.x * ZOOM,
    y: rect.top + stop.y * ZOOM,
  }));
  const current = stops.findIndex(
    (stop) =>
      Math.abs(stop.x - currentCoordinates.x) < 1 && Math.abs(stop.y - currentCoordinates.y) < 1,
  );
  const forward = event.code === 'ArrowRight' || event.code === 'ArrowDown';
  const backward = event.code === 'ArrowLeft' || event.code === 'ArrowUp';
  if (!forward && !backward) return undefined;
  const next =
    current === -1 ? 0 : Math.min(stops.length - 1, Math.max(0, current + (forward ? 1 : -1)));
  return stops[next];
};

function LibraryItem({ id, label }: { readonly id: string; readonly label: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={id}
      style={{ display: 'block', margin: 8, padding: '8px 14px' }}
    >
      {label}
    </button>
  );
}

/** Handle to move an existing node, drawn on the Overlay over that node. */
function MoveHandle({ nodeId }: { readonly nodeId: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `node:${nodeId}` });
  const box = frameDoc()?.querySelector(`[data-rc-node="${nodeId}"]`)?.getBoundingClientRect();
  if (box === undefined) return undefined;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={`move-${nodeId}`}
      style={{
        position: 'absolute',
        left: box.left * ZOOM,
        top: box.top * ZOOM,
        width: 18,
        height: 18,
        pointerEvents: 'auto',
        zIndex: 2,
      }}
    />
  );
}

function Overlay({
  dragging,
  target,
}: {
  readonly dragging: boolean;
  readonly target: DropTarget | undefined;
}) {
  const { setNodeRef } = useDroppable({ id: 'canvas' });
  const drawn = useRef(0);
  useLayoutEffect(() => {
    if (drawn.current > 0) probe.renderMs.push(performance.now() - drawn.current);
  });
  drawn.current = performance.now();
  return (
    <div
      ref={setNodeRef}
      data-testid="overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: dragging ? 'auto' : 'none',
        zIndex: 1,
      }}
    >
      {target !== undefined && (
        <div
          data-testid="indicator"
          style={{
            position: 'absolute',
            background: '#6d3fe0',
            left: target.line.x * ZOOM,
            top: target.line.y * ZOOM,
            width: Math.max(2, target.line.w * ZOOM),
            height: Math.max(2, target.line.h * ZOOM),
          }}
        />
      )}
    </div>
  );
}

type Point = { x: number; y: number };

/** Drop target under the pointer (mouse) or under the dragged item's corner (keyboard stops). */
function locate(event: DragMoveEvent, pointer: Point): DropTarget | undefined {
  const isKeyboard = event.activatorEvent instanceof KeyboardEvent;
  const rect = event.active.rect.current.translated ?? undefined;
  const client = isKeyboard && rect !== undefined ? { x: rect.left, y: rect.top } : pointer;
  const point = toFrame(client.x, client.y);
  const doc = frameDoc();
  if (point === undefined || doc === undefined) return undefined;
  const started = performance.now();
  const found = findDropTarget(doc, point.x, point.y, draggedNode(String(event.active.id)));
  probe.computeMs.push(performance.now() - started);
  return found;
}

function record(event: DragEndEvent, pointer: Point): void {
  probe.events.push('end');
  const found = locate(event, pointer);
  probe.drops.push({
    active: String(event.active.id),
    ...(found === undefined ? {} : { target: { container: found.container, index: found.index } }),
  });
}

function Canvas({
  dragging,
  target,
}: {
  readonly dragging: boolean;
  readonly target: DropTarget | undefined;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <main
      style={{
        position: 'relative',
        width: WIDTH * ZOOM,
        height: HEIGHT * ZOOM,
        flex: 'none',
        overflow: 'hidden',
        outline: '1px solid #ccc',
      }}
    >
      <iframe
        ref={(element) => {
          frame = element ?? undefined;
        }}
        title="canvas"
        srcDoc={CANVAS_HTML}
        onLoad={() => {
          probe.ready = true;
          setLoaded(true);
        }}
        style={{
          width: WIDTH,
          height: HEIGHT,
          border: 0,
          transform: `scale(${String(ZOOM)})`,
          transformOrigin: '0 0',
        }}
      />
      <Overlay dragging={dragging} target={target} />
      {loaded && <MoveHandle nodeId="card-1" />}
    </main>
  );
}

function App() {
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<DropTarget>();
  const pointer = useRef<Point>({ x: 0, y: 0 });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: stopKeys }),
  );
  const stop = () => {
    setDragging(false);
    setTarget(undefined);
  };
  return (
    <div
      onPointerMoveCapture={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY };
      }}
      style={{ display: 'flex', gap: 16, padding: 16 }}
    >
      <DndContext
        sensors={sensors}
        autoScroll={false}
        onDragStart={(event) => {
          probe.events.push(`start ${String(event.active.id)}`);
          setDragging(true);
        }}
        onDragMove={(event) => {
          setTarget(locate(event, pointer.current));
        }}
        onDragEnd={(event) => {
          record(event, pointer.current);
          stop();
        }}
        onDragCancel={() => {
          probe.events.push('cancel');
          stop();
        }}
      >
        <aside style={{ width: 140, flex: 'none' }}>
          <LibraryItem id="lib:Button" label="Button" />
          <LibraryItem id="lib:Section" label="Section" />
        </aside>
        <Canvas dragging={dragging} target={target} />
      </DndContext>
    </div>
  );
}

const root = document.getElementById('root') ?? undefined;
if (root !== undefined) createRoot(root).render(<App />);
