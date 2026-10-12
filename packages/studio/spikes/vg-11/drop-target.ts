// Drop position from the real layout inside the Canvas iframe (ADR-FE-09): the pointer, already
// converted to iframe coordinates, finds the nearest node; the nearest valid container around it
// decides, from its layout direction, where in its children the new node goes.

export type DropTarget = {
  readonly container: string;
  readonly index: number;
  /** Line to draw on the Overlay, in iframe coordinates. */
  readonly line: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
};

const idOf = (element: Element) => element.getAttribute('data-rc-node') ?? '';

const nodeAbove = (element: Element | undefined): Element | undefined =>
  element?.parentElement?.closest('[data-rc-node]') ?? undefined;

const isContainer = (element: Element) =>
  element.hasAttribute('data-rc-container') && element.getAttribute('data-rc-locked') !== 'true';

/** The container that receives the drop: never the dragged node or its own descendants (C-15). */
function containerFor(hit: Element, dragged: Element | undefined): Element | undefined {
  let candidate: Element | undefined = hit;
  while (candidate !== undefined) {
    if (dragged?.contains(candidate) === true) candidate = nodeAbove(dragged);
    else if (isContainer(candidate)) return candidate;
    else candidate = nodeAbove(candidate);
  }
  return undefined;
}

type Axis = 'row' | 'column' | 'grid';

function axisOf(container: Element): Axis {
  const style = container.ownerDocument.defaultView?.getComputedStyle(container);
  if (style?.display.includes('grid') === true) return 'grid';
  return style?.flexDirection.startsWith('row') === true ? 'row' : 'column';
}

/** Whether the pointer sits before `rect` along the axis of the container. */
function isBefore(axis: Axis, rect: DOMRect, x: number, y: number): boolean {
  if (axis === 'row') return x < rect.left + rect.width / 2;
  if (axis === 'column') return y < rect.top + rect.height / 2;
  return y < rect.top || (y <= rect.bottom && x < rect.left + rect.width / 2);
}

function lineAt(
  axis: Axis,
  container: DOMRect,
  before: DOMRect | undefined,
  last: DOMRect | undefined,
) {
  if (axis === 'row' || axis === 'grid') {
    const x = before?.left ?? last?.right ?? container.left + 8;
    const top = (before ?? last)?.top ?? container.top + 4;
    return { x: x - 2, y: top, w: 2, h: (before ?? last)?.height ?? container.height - 8 };
  }
  const y = before?.top ?? last?.bottom ?? container.top + 8;
  return { x: container.left + 4, y: y - 2, w: container.width - 8, h: 2 };
}

/**
 * Where a node dropped at (`x`, `y`) of the iframe goes, or undefined when nowhere is valid.
 * `draggedId` is the node being moved, if any (a new node from the Library has none).
 */
export function findDropTarget(
  doc: Document,
  x: number,
  y: number,
  draggedId?: string,
): DropTarget | undefined {
  const hit = doc.elementsFromPoint(x, y).find((element) => element.hasAttribute('data-rc-node'));
  if (hit === undefined) return undefined;
  const dragged =
    draggedId === undefined
      ? undefined
      : (doc.querySelector(`[data-rc-node="${draggedId}"]`) ?? undefined);
  const container = containerFor(hit, dragged);
  if (container === undefined) return undefined;
  const axis = axisOf(container);
  const children = [...container.children].filter(
    (child) => child.hasAttribute('data-rc-node') && child !== dragged,
  );
  const rects = children.map((child) => child.getBoundingClientRect());
  const index = rects.findIndex((rect) => isBefore(axis, rect, x, y));
  const position = index === -1 ? children.length : index;
  return {
    container: idOf(container),
    index: position,
    line: lineAt(axis, container.getBoundingClientRect(), rects[position], rects.at(-1)),
  };
}

/** Every distinct drop target, in document order: the stops of keyboard dragging (R-DD-06). */
export function dropStops(doc: Document, draggedId?: string): { x: number; y: number }[] {
  const stops: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const add = (x: number, y: number) => {
    const target = findDropTarget(doc, x, y, draggedId);
    const key = target === undefined ? '' : `${target.container}:${String(target.index)}`;
    if (target !== undefined && !seen.has(key)) {
      seen.add(key);
      stops.push({ x, y });
    }
  };
  for (const element of doc.querySelectorAll('[data-rc-container]')) {
    const rect = element.getBoundingClientRect();
    const children = [...element.children].filter((child) => child.hasAttribute('data-rc-node'));
    if (children.length === 0) add(rect.left + rect.width / 2, rect.top + rect.height / 2);
    for (const child of children) {
      const box = child.getBoundingClientRect();
      add(box.left + 2, box.top + 2);
    }
    const last = children.at(-1)?.getBoundingClientRect();
    if (last !== undefined)
      add(Math.min(rect.right - 3, last.right + 3), Math.min(rect.bottom - 3, last.bottom + 3));
  }
  return stops;
}
