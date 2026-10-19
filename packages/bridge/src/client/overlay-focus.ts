// Pure utilities for component focus overlay and interaction isolation (SPEC-04 section 18A, R-CP-15, spec-log #24).

export type Rect2D = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ViewportSize = {
  readonly width: number;
  readonly height: number;
};

function fileOfLoc(loc: string | undefined): string | undefined {
  if (!loc) return undefined;
  return loc.split(':')[0];
}

/**
 * Returns top-level DOM elements belonging to `designFile` that have no ancestor
 * with `data-rc-loc` also belonging to `designFile` (R-CP-15).
 */
export function focusRoots(doc: Document, designFile: string): Element[] {
  if (!designFile) return [];
  const elements = doc.querySelectorAll('[data-rc-loc]');
  const roots: Element[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;
    const loc = el.getAttribute('data-rc-loc') ?? undefined;
    if (fileOfLoc(loc) !== designFile) continue;

    let current: Element | undefined = el.parentElement ?? undefined;
    let hasAncestorSameFile = false;
    while (current) {
      const ancestorLoc = current.getAttribute('data-rc-loc') ?? undefined;
      if (ancestorLoc && fileOfLoc(ancestorLoc) === designFile) {
        hasAncestorSameFile = true;
        break;
      }
      current = current.parentElement ?? undefined;
    }

    if (!hasAncestorSameFile) roots.push(el);
  }

  return roots;
}

/**
 * Builds an SVG path `d` string covering the whole viewport with rectangular cutouts (R-CP-15).
 * Uses fill-rule="evenodd".
 */
export function focusPath(viewport: ViewportSize, rects: readonly Rect2D[]): string {
  const outer = `M 0 0 H ${String(viewport.width)} V ${String(viewport.height)} H 0 Z`;
  const holes = rects.map(
    (r) =>
      `M ${String(r.x)} ${String(r.y)} H ${String(r.x + r.width)} V ${String(r.y + r.height)} H ${String(r.x)} Z`,
  );
  return [outer, ...holes].join(' ');
}

/**
 * When in focus mode, resolves target to self or nearest ancestor belonging to `designFile`.
 * Returns undefined if no ancestor belongs to `designFile` (R-CP-15).
 */
export function resolveFocusElement(
  target: Element | undefined,
  designFile: string | undefined,
  focus: boolean,
): Element | undefined {
  if (!focus || !designFile) return target;
  if (!target) return undefined;

  let current: Element | undefined = target;
  while (current) {
    const loc = current.getAttribute('data-rc-loc') ?? undefined;
    if (loc && fileOfLoc(loc) === designFile) {
      return current;
    }
    current = current.parentElement ?? undefined;
  }

  return undefined;
}

export function getBridgeElementAtPoint(
  doc: Document,
  x: number,
  y: number,
  designFile?: string,
  focus?: boolean,
): Element | undefined {
  let found: Element | undefined;
  for (const el of doc.elementsFromPoint(x, y)) {
    if (el.id === '__rc_overlay_host' || el.closest('#__rc_overlay_host')) continue;
    const bridgeEl = el.closest('[data-rc-loc]') ?? undefined;
    if (bridgeEl) {
      found = bridgeEl;
      break;
    }
  }
  return resolveFocusElement(found, designFile, focus ?? false);
}
