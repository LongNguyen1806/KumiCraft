// Pure drop-target calculation for Canvas drag-and-drop (SPEC-04 section 16 M-DD, R-DD-11..15).
import { type ElementGuard, type InsertTarget, parseLocString } from '@reactcraft/shared';

export type DropRect = { x: number; y: number; width: number; height: number };
export type LayoutAxis = 'row' | 'column' | 'grid' | 'wrap';
export type DropResult = {
  target: InsertTarget;
  rect: DropRect;
  indicator: 'line' | 'box';
  label: string;
};

/** Browser dependencies injected so unit tests can run in happy-dom. */
export type DropEnv = {
  hitTest: (x: number, y: number) => readonly Element[];
  measure: (el: Element) => DropRect;
  axisOf: (el: Element) => LayoutAxis;
};

export type DropCache = {
  parent?: Element | undefined;
  axis?: LayoutAxis | undefined;
  children?: { el: Element; rect: DropRect }[] | undefined;
};

const VOID_OR_LEAF_TAGS = new Set(['img', 'input', 'br', 'hr', 'textarea', 'select']);
const EDGE_PADDING_PX = 12;
const parentRectCache = new WeakMap<DropCache, { el: Element; rect: DropRect }>();

export function browserDropEnv(doc: Document): DropEnv {
  return {
    hitTest: (x, y) => {
      if (typeof doc.elementsFromPoint !== 'function') return [];
      return doc
        .elementsFromPoint(x, y)
        .filter((el) => el.id !== '__rc_overlay_host' && !el.closest('#__rc_overlay_host'));
    },
    measure: (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    },
    axisOf: (el) => layoutAxisOf(el),
  };
}

export function layoutAxisOf(el: Element): LayoutAxis {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!style) return 'column';
  const display = style.display;
  if (display.includes('grid')) return 'grid';
  if (display === 'flex' || display === 'inline-flex') {
    if (style.flexWrap === 'wrap' || style.flexWrap === 'wrap-reverse') return 'wrap';
    return style.flexDirection === '' || style.flexDirection.startsWith('row') ? 'row' : 'column';
  }
  return 'column';
}

export function canContain(el: Element): boolean {
  if (VOID_OR_LEAF_TAGS.has(el.localName.toLowerCase())) return false;
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (!node) continue;
    if (node.nodeType === 1 || node.nodeType === 8) continue;
    if (node.nodeType === 3 && (node.textContent ?? '').trim() === '') continue;
    return false;
  }
  return true;
}

function guardOf(el: Element): ElementGuard {
  return {
    loc: el.getAttribute('data-rc-loc') ?? '',
    tag: el.localName,
  };
}

function fileOf(el: Element): string | undefined {
  const loc = el.getAttribute('data-rc-loc');
  return loc ? parseLocString(loc)?.file : undefined;
}

function measureWithCache(el: Element, env: DropEnv, cache: DropCache): DropRect {
  if (cache.parent === el) {
    const cachedParent = parentRectCache.get(cache);
    if (cachedParent?.el === el) return cachedParent.rect;
  }
  const cachedChild = cache.children?.find((c) => c.el === el);
  if (cachedChild) return cachedChild.rect;
  const rect = env.measure(el);
  if (cache.parent === el) {
    parentRectCache.set(cache, { el, rect });
  }
  return rect;
}

function rcChildren(
  parent: Element,
  dragged: readonly Element[],
  env: DropEnv,
  cache: DropCache,
): { axis: LayoutAxis; children: { el: Element; rect: DropRect }[] } {
  if (cache.parent === parent && cache.axis !== undefined && cache.children !== undefined) {
    return { axis: cache.axis, children: cache.children };
  }
  const axis = env.axisOf(parent);
  const children: { el: Element; rect: DropRect }[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child && child.hasAttribute('data-rc-loc') && !dragged.includes(child)) {
      children.push({ el: child, rect: env.measure(child) });
    }
  }
  cache.parent = parent;
  cache.axis = axis;
  cache.children = children;
  return { axis, children };
}

function computeInsertionIndex(
  axis: LayoutAxis,
  children: readonly { el: Element; rect: DropRect }[],
  x: number,
  y: number,
): number {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    const r = child.rect;
    if (axis === 'row') {
      if (x < r.x + r.width / 2) return i;
    } else if (axis === 'column') {
      if (y < r.y + r.height / 2) return i;
    } else {
      if (y < r.y) return i;
      if (y <= r.y + r.height && x < r.x + r.width / 2) return i;
    }
  }
  return children.length;
}

function whereOnAxis(axis: LayoutAxis, rect: DropRect, x: number, y: number): 'before' | 'after' {
  if (axis === 'column') {
    return y < rect.y + rect.height / 2 ? 'before' : 'after';
  }
  return x < rect.x + rect.width / 2 ? 'before' : 'after';
}

function makeLineRect(
  axis: LayoutAxis,
  containerRect: DropRect,
  refRect: DropRect,
  where: 'before' | 'after',
): DropRect {
  if (axis === 'column') {
    const lineY = where === 'before' ? refRect.y - 2 : refRect.y + refRect.height;
    return {
      x: containerRect.x + 4,
      y: lineY,
      width: Math.max(0, containerRect.width - 8),
      height: 2,
    };
  }
  const lineX = where === 'before' ? refRect.x - 2 : refRect.x + refRect.width;
  return { x: lineX, y: refRect.y, width: 2, height: refRect.height };
}

function resolveSameFileSibling(
  initialRef: Element,
  initialParent: Element,
  initialWhere: 'before' | 'after',
  x: number,
  y: number,
  dragged: readonly Element[],
  env: DropEnv,
  cache: DropCache,
): DropResult | undefined {
  let r: Element = initialRef;
  let c: Element | undefined = initialParent;
  let where = initialWhere;

  while (c) {
    const rFile = fileOf(r);
    const cFile = fileOf(c);
    if (rFile !== undefined && rFile === cFile) {
      const { axis } = rcChildren(c, dragged, env, cache);
      const cRect = measureWithCache(c, env, cache);
      const rRect = measureWithCache(r, env, cache);
      return {
        target: { kind: 'sibling', ref: guardOf(r), where },
        rect: makeLineRect(axis, cRect, rRect, where),
        indicator: 'line',
        label: c.localName,
      };
    }
    r = c;
    c = c.parentElement?.closest('[data-rc-loc]') ?? undefined;
    if (c) {
      const { axis } = rcChildren(c, dragged, env, cache);
      const rRect = measureWithCache(r, env, cache);
      where = whereOnAxis(axis, rRect, x, y);
    }
  }
  return undefined;
}

function findFirstLocTarget(x: number, y: number, env: DropEnv): Element | undefined {
  for (const raw of env.hitTest(x, y)) {
    const locEl = raw.closest('[data-rc-loc]');
    if (locEl) return locEl;
  }
  return undefined;
}

export function findDropTarget(
  x: number,
  y: number,
  dragged: readonly Element[],
  env: DropEnv,
  cache: DropCache,
): DropResult | undefined {
  const n = findFirstLocTarget(x, y, env);
  if (!n) return undefined;
  if (dragged.some((d) => d === n || d.contains(n))) return undefined;

  if (canContain(n)) {
    const nRect = measureWithCache(n, env, cache);
    if (cache.parent === undefined || cache.parent === n) {
      parentRectCache.set(cache, { el: n, rect: nRect });
    }
    const insidePadding =
      x > nRect.x + EDGE_PADDING_PX &&
      x < nRect.x + nRect.width - EDGE_PADDING_PX &&
      y > nRect.y + EDGE_PADDING_PX &&
      y < nRect.y + nRect.height - EDGE_PADDING_PX;

    if (insidePadding) {
      const { axis, children } = rcChildren(n, dragged, env, cache);
      parentRectCache.set(cache, { el: n, rect: nRect });
      if (children.length === 0) {
        return {
          target: { kind: 'child', parent: guardOf(n), where: 'end' },
          rect: nRect,
          indicator: 'box',
          label: n.localName,
        };
      }
      const idx = computeInsertionIndex(axis, children, x, y);
      const chosen = idx < children.length ? children[idx] : children[children.length - 1];
      if (!chosen) return undefined;
      const where: 'before' | 'after' = idx < children.length ? 'before' : 'after';
      return resolveSameFileSibling(chosen.el, n, where, x, y, dragged, env, cache);
    }
  }

  const c = n.parentElement?.closest('[data-rc-loc]') ?? undefined;
  if (!c) return undefined;
  const { axis } = rcChildren(c, dragged, env, cache);
  const rRect = measureWithCache(n, env, cache);
  const where = whereOnAxis(axis, rRect, x, y);
  return resolveSameFileSibling(n, c, where, x, y, dragged, env, cache);
}
