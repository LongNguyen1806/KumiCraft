// Geometry of free frames: which elements are free, where they sit, how to measure them (R-FF-10..14).
import {
  type BridgeFreeMeasurePayload,
  matchProperty,
  parseRawClasses,
  type Placement,
  snap,
} from '@reactcraft/shared';

import { getRefForElement } from '../candidate-chain.ts';

export type GridSize = 1 | 4 | 8 | 16;
export type Box = { left: number; top: number; width: number; height: number };
export type Point = { x: number; y: number };
/** Viewport rect of an element; injected so tests can run in happy-dom. */
export type Measure = (el: Element) => { x: number; y: number; width: number; height: number };

export const FREE_ATTR = 'data-rc-free';
const MAX_MEASURED_CHILDREN = 200;

export const viewportMeasure: Measure = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
};

export function isFreeFrame(el: Element): boolean {
  return el.hasAttribute(FREE_ATTR);
}

/** Nearest ancestor with `data-rc-loc` (the JSX parent as the Canvas sees it). */
export function locParent(el: Element): Element | undefined {
  return el.parentElement?.closest('[data-rc-loc]') ?? undefined;
}

/** The free frame `el` is placed in, if its JSX parent is one. */
export function freeFrameOf(el: Element): Element | undefined {
  const parent = locParent(el);
  return parent !== undefined && isFreeFrame(parent) ? parent : undefined;
}

/**
 * Converts a viewport point to the frame's coordinate space: `absolute left/top` are measured
 * from the padding box, so the frame's border is removed and its own scroll added.
 */
export function pointInFrame(frame: Element, point: Point, measure: Measure): Point {
  const f = measure(frame);
  return {
    x: point.x - f.x - frame.clientLeft + frame.scrollLeft,
    y: point.y - f.y - frame.clientTop + frame.scrollTop,
  };
}

export function boxInFrame(el: Element, frame: Element, measure: Measure): Box {
  const r = measure(el);
  const origin = pointInFrame(frame, { x: r.x, y: r.y }, measure);
  return { left: origin.x, top: origin.y, width: r.width, height: r.height };
}

/** Elements with `data-rc-loc` directly under `parent`, looking through plain wrapper nodes. */
export function directLocChildren(parent: Element): Element[] {
  const found: Element[] = [];
  const walk = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      if (child.hasAttribute('data-rc-loc')) found.push(child);
      else walk(child);
    }
  };
  walk(parent);
  return found;
}

/** True when the frame already sets its own height with an unprefixed `h-*` or `min-h-*`. */
export function hasHeightClass(el: Element): boolean {
  return parseRawClasses(el.getAttribute('class') ?? '').some((tok) => {
    if (tok.variants.length > 0) return false;
    const property = matchProperty(tok.utility)?.property;
    return property === 'height' || property === 'minHeight';
  });
}

/** Answer to `measure-free`: where each direct child sits now, so turning the frame on moves nothing. */
export function measureFreeFrame(
  frame: Element,
  doc: Document,
  measure: Measure,
): BridgeFreeMeasurePayload | undefined {
  const ref = getRefForElement(frame, doc);
  if (ref === undefined) return undefined;
  const children = directLocChildren(frame)
    .slice(0, MAX_MEASURED_CHILDREN)
    .flatMap((child) => {
      const childRef = getRefForElement(child, doc);
      if (childRef === undefined) return [];
      const box = boxInFrame(child, frame, measure);
      return [
        {
          ref: childRef,
          tag: child.localName,
          left: Math.round(box.left),
          top: Math.round(box.top),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
      ];
    });
  const frameBox = measure(frame);
  return {
    ref,
    width: Math.round(frameBox.width),
    height: Math.round(frameBox.height),
    hasHeight: hasHeightClass(frame),
    children,
  };
}

/** Free placement of a drop at `point` (viewport), keeping the grab offset of the dragged item. */
export function freeDropPlacement(
  frame: Element,
  point: Point,
  grab: Point,
  grid: GridSize,
  measure: Measure,
): Placement {
  const p = pointInFrame(frame, point, measure);
  return { kind: 'free', left: snap(p.x - grab.x, grid), top: snap(p.y - grab.y, grid) };
}
