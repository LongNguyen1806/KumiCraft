// Drop target calculation for Canvas Drag and Drop (SPEC-04.1 section 9.2, ADR-FE-09).
import type { CanInsertSubject, DesignDocument, TreeTarget } from '@reactcraft/model';
import { canInsert } from '@reactcraft/model';

export type DropIndicator = {
  readonly kind: 'line' | 'box';
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly label?: string | undefined;
};

export type DropTarget = {
  readonly containerId: string;
  readonly index: number;
  readonly indicator?: DropIndicator | undefined;
  readonly allowed: boolean;
};

export type DropTargetCache = {
  lastContainerId?: string | undefined;
  cachedRects?: readonly { readonly id: string; readonly rect: DOMRect }[] | undefined;
  cachedContainerRect?: DOMRect | undefined;
  cachedAxis?: LayoutAxis | undefined;
  canInsertCache: Map<string, boolean>;
  /** Containers whose check is scheduled but not done yet. */
  pending: Set<string>;
  /**
   * When set, a container not checked yet counts as allowed for now and its `canInsert` (a few ms
   * on a large page) runs later through this scheduler, keeping each pointer move within PB-15.
   * Without it every check runs at once, as a drop needs.
   */
  deferValidation?: ((run: () => void) => void) | undefined;
};

export function createDropTargetCache(
  deferValidation?: (run: () => void) => void,
): DropTargetCache {
  return { canInsertCache: new Map(), pending: new Set(), deferValidation };
}

/** The same knowledge, but every missing check runs now: used for the drop itself. */
export function synchronousCache(cache: DropTargetCache): DropTargetCache {
  return { ...cache, deferValidation: undefined };
}

export type LayoutAxis = 'row' | 'column' | 'grid' | 'wrap';

function getElement(target: unknown): Element | undefined {
  if (target && typeof target === 'object' && 'getAttribute' in target) {
    return target as Element;
  }
  return undefined;
}

function idOf(element: Element): string {
  return element.getAttribute('data-rc-node') ?? '';
}

function isContainer(element: Element, isContainerFn?: (id: string) => boolean): boolean {
  if (element.getAttribute('data-rc-locked') === 'true') return false;
  if (element.hasAttribute('data-rc-container')) return true;
  const id = idOf(element);
  if (!id) return false;
  return isContainerFn !== undefined ? isContainerFn(id) : true;
}

function layoutAxisOf(container: Element): LayoutAxis {
  const win = container.ownerDocument.defaultView;
  const style = win?.getComputedStyle(container);
  if (!style) return 'column';
  if (style.display.includes('grid')) return 'grid';
  if (style.flexWrap === 'wrap') return 'wrap';
  return style.flexDirection.startsWith('row') ? 'row' : 'column';
}

function isDescendantOfAny(element: Element, excludedIds: ReadonlySet<string>): boolean {
  let curr: Element | undefined = element;
  while (curr) {
    const id = curr.getAttribute('data-rc-node');
    if (id && excludedIds.has(id)) return true;
    curr = curr.parentElement ?? undefined;
  }
  return false;
}

function findHitElement(
  doc: Document,
  x: number,
  y: number,
  excludedIds: ReadonlySet<string>,
): Element | undefined {
  const els = typeof doc.elementsFromPoint === 'function' ? doc.elementsFromPoint(x, y) : [];
  for (const el of els) {
    const elem = getElement(el);
    if (!elem) continue;
    const nodeEl = elem.closest('[data-rc-node]');
    if (!nodeEl) continue;
    if (nodeEl.getAttribute('data-rc-locked') === 'true') continue;
    if (isDescendantOfAny(nodeEl, excludedIds)) continue;
    return nodeEl;
  }
  return undefined;
}

function isInsidePadding(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left + 12 && x <= rect.right - 12 && y >= rect.top + 12 && y <= rect.bottom - 12;
}

function calculateIndexInRow(
  children: readonly { readonly id: string; readonly rect: DOMRect }[],
  x: number,
): number {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && x < child.rect.left + child.rect.width / 2) return i;
  }
  return children.length;
}

function calculateIndexInColumn(
  children: readonly { readonly id: string; readonly rect: DOMRect }[],
  y: number,
): number {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && y < child.rect.top + child.rect.height / 2) return i;
  }
  return children.length;
}

function calculateIndexInWrap(
  children: readonly { readonly id: string; readonly rect: DOMRect }[],
  x: number,
  y: number,
): number {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    if (y < child.rect.top) return i;
    if (y <= child.rect.bottom && x < child.rect.left + child.rect.width / 2) return i;
  }
  return children.length;
}

function computeInsertionIndex(
  axis: LayoutAxis,
  children: readonly { readonly id: string; readonly rect: DOMRect }[],
  x: number,
  y: number,
): number {
  if (axis === 'row') return calculateIndexInRow(children, x);
  if (axis === 'column') return calculateIndexInColumn(children, y);
  return calculateIndexInWrap(children, x, y);
}

function makeLineIndicator(
  axis: LayoutAxis,
  containerRect: DOMRect,
  children: readonly { readonly id: string; readonly rect: DOMRect }[],
  index: number,
  containerName?: string,
): DropIndicator {
  const isRow = axis === 'row';
  if (children.length === 0) {
    return {
      kind: 'box',
      rect: {
        x: containerRect.left,
        y: containerRect.top,
        width: containerRect.width,
        height: containerRect.height,
      },
      label: containerName,
    };
  }

  const before = children[index]?.rect;
  const last = children[children.length - 1]?.rect;
  if (isRow) {
    const lineX = before ? before.left - 2 : last ? last.right : containerRect.left + 8;
    const top = before?.top ?? last?.top ?? containerRect.top + 4;
    const height = before?.height ?? last?.height ?? containerRect.height - 8;
    return { kind: 'line', rect: { x: lineX, y: top, width: 2, height }, label: containerName };
  }

  const lineY = before ? before.top - 2 : last ? last.bottom : containerRect.top + 8;
  const left = containerRect.left + 4;
  const width = containerRect.width - 8;
  return { kind: 'line', rect: { x: left, y: lineY, width, height: 2 }, label: containerName };
}

function checkCanInsertCached(
  cache: DropTargetCache,
  doc: DesignDocument,
  target: TreeTarget,
  containerId: string,
  subject: CanInsertSubject,
): boolean {
  const cached = cache.canInsertCache.get(containerId);
  if (cached !== undefined) return cached;
  const run = () => {
    cache.canInsertCache.set(containerId, canInsert(doc, target, containerId, subject, 0).ok);
  };
  if (cache.deferValidation === undefined) {
    run();
    return cache.canInsertCache.get(containerId) === true;
  }
  if (!cache.pending.has(containerId)) {
    cache.pending.add(containerId);
    cache.deferValidation(run);
  }
  return true;
}

type TargetSearchResult = {
  readonly targetContainer?: Element | undefined;
  readonly isBoxDrop: boolean;
};

function searchTargetContainer(
  hit: Element,
  designDoc: DesignDocument,
  treeTarget: TreeTarget,
  subject: CanInsertSubject,
  cache: DropTargetCache,
  x: number,
  y: number,
  isContainerFn?: (id: string) => boolean,
): TargetSearchResult {
  let candidate: Element | undefined = hit;
  while (candidate) {
    const parent: Element | undefined =
      candidate.parentElement?.closest('[data-rc-node]') ?? undefined;
    // Section 9.2 step 3: a container hit within 12 px of its edge is only a reference point; the
    // drop goes next to it, in its parent.
    const nearEdge =
      candidate === hit &&
      parent !== undefined &&
      !isInsidePadding(candidate.getBoundingClientRect(), x, y);
    if (!nearEdge && isContainer(candidate, isContainerFn)) {
      const cId = idOf(candidate);
      if (checkCanInsertCached(cache, designDoc, treeTarget, cId, subject)) {
        const hasChildren = [...candidate.children].some((c) => c.hasAttribute('data-rc-node'));
        // Step 4: with children the index comes from the pointer, so only an empty container gets
        // the "drop inside" box.
        return { targetContainer: candidate, isBoxDrop: !hasChildren };
      }
    }
    candidate = parent;
  }
  return { targetContainer: undefined, isBoxDrop: false };
}

function resolveCachedChildren(
  cache: DropTargetCache,
  container: Element,
  containerId: string,
  containerRect: DOMRect,
  excludedIds: ReadonlySet<string>,
): {
  readonly axis: LayoutAxis;
  readonly children: readonly { readonly id: string; readonly rect: DOMRect }[];
} {
  let children = cache.cachedRects;
  let axis = cache.cachedAxis;
  if (cache.lastContainerId !== containerId || !children || !axis) {
    axis = layoutAxisOf(container);
    const childNodes = [...container.children].filter(
      (c) => c.hasAttribute('data-rc-node') && !excludedIds.has(idOf(c)),
    );
    children = childNodes.map((c) => ({ id: idOf(c), rect: c.getBoundingClientRect() }));
    cache.lastContainerId = containerId;
    cache.cachedRects = children;
    cache.cachedContainerRect = containerRect;
    cache.cachedAxis = axis;
  }
  return { axis, children };
}

/** Dropping into a container: a dashed box around it (section 9.3). */
function boxTarget(containerId: string, rect: DOMRect, label: string | undefined): DropTarget {
  return {
    containerId,
    index: 0,
    allowed: true,
    indicator: {
      kind: 'box',
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      label,
    },
  };
}

export function findDropTarget(
  doc: Document,
  designDoc: DesignDocument,
  treeTarget: TreeTarget,
  x: number,
  y: number,
  subject: CanInsertSubject,
  excludedIds: ReadonlySet<string>,
  cache: DropTargetCache,
  getContainerName?: (id: string) => string,
  isContainerFn?: (id: string) => boolean,
): DropTarget | undefined {
  const hit = findHitElement(doc, x, y, excludedIds);
  if (!hit) return undefined;

  const { targetContainer, isBoxDrop } = searchTargetContainer(
    hit,
    designDoc,
    treeTarget,
    subject,
    cache,
    x,
    y,
    isContainerFn,
  );
  if (!targetContainer) {
    return { containerId: '', index: 0, allowed: false };
  }

  const containerId = idOf(targetContainer);
  const containerName = getContainerName?.(containerId);
  const containerRect = targetContainer.getBoundingClientRect();

  if (isBoxDrop) return boxTarget(containerId, containerRect, containerName);

  const { axis, children } = resolveCachedChildren(
    cache,
    targetContainer,
    containerId,
    containerRect,
    excludedIds,
  );
  const index = computeInsertionIndex(axis, children, x, y);
  const indicator = makeLineIndicator(axis, containerRect, children, index, containerName);
  return { containerId, index, allowed: true, indicator };
}

/** Points that drop into `container`: its middle when empty, else before each child and at the end. */
function stopsOf(container: Element, excludedIds: ReadonlySet<string>): { x: number; y: number }[] {
  const rect = container.getBoundingClientRect();
  const children = [...container.children].filter(
    (c) => c.hasAttribute('data-rc-node') && !excludedIds.has(idOf(c)),
  );
  const last = children.at(-1)?.getBoundingClientRect();
  if (last === undefined) return [{ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }];
  const before = children.map((c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left + 2, y: r.top + 2 };
  });
  return [
    ...before,
    { x: Math.min(rect.right - 4, last.right + 4), y: Math.min(rect.bottom - 4, last.bottom + 4) },
  ];
}

/** R-DD-06: every valid drop point of the page in tree order, for the keyboard. */
export function dropStops(
  doc: Document,
  designDoc: DesignDocument,
  treeTarget: TreeTarget,
  subject: CanInsertSubject,
  excludedIds: ReadonlySet<string>,
  isContainerFn?: (id: string) => boolean,
): { x: number; y: number }[] {
  const cache = createDropTargetCache();
  const stops: { x: number; y: number }[] = [];
  for (const el of doc.querySelectorAll('[data-rc-node]')) {
    const id = idOf(el);
    if (!isContainer(el, isContainerFn) || isDescendantOfAny(el, excludedIds)) continue;
    if (!checkCanInsertCached(cache, designDoc, treeTarget, id, subject)) continue;
    stops.push(...stopsOf(el, excludedIds));
  }
  return stops;
}
