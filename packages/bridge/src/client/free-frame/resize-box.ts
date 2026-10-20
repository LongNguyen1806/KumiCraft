// Pure resize math for the Canvas size handles (R-FF-14).
import type { Box, GridSize } from './free-geometry.ts';

/** Handle positions: edges and corners, named by compass direction. */
export type HandleDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const FREE_HANDLES: readonly HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
/** Outside a free frame only width and height change, so only right, bottom and their corner. */
export const FLOW_HANDLES: readonly HandleDir[] = ['e', 'se', 's'];

function snapEdge(value: number, grid: GridSize): number {
  return Math.round(value / grid) * grid;
}

function keepRatio(dir: HandleDir, start: Box, edges: Edges): void {
  if (start.width <= 0 || start.height <= 0) return;
  const ratio = start.width / start.height;
  let w = edges.x2 - edges.x1;
  let h = edges.y2 - edges.y1;
  if (w / ratio >= h) h = Math.round(w / ratio);
  else w = Math.round(h * ratio);
  if (dir.includes('w')) edges.x1 = edges.x2 - w;
  else edges.x2 = edges.x1 + w;
  if (dir.includes('n')) edges.y1 = edges.y2 - h;
  else edges.y2 = edges.y1 + h;
}

type Edges = { x1: number; y1: number; x2: number; y2: number };

/**
 * New box after dragging handle `dir` by (dx, dy): moved edges snap to the grid, the box never gets
 * smaller than one grid cell, and `ratio` (Shift on a corner) keeps the starting aspect ratio.
 */
export function resizeBox(
  start: Box,
  dir: HandleDir,
  delta: { dx: number; dy: number },
  grid: GridSize,
  ratio = false,
  edgeSnap?: (axis: 'x' | 'y', value: number) => number | undefined,
): Box {
  const min = Math.max(grid, 1);
  const snap = (axis: 'x' | 'y', val: number): number => {
    const sn = edgeSnap?.(axis, val);
    return sn !== undefined ? sn : snapEdge(val, grid);
  };
  const edges: Edges = {
    x1: start.left,
    y1: start.top,
    x2: start.left + start.width,
    y2: start.top + start.height,
  };
  if (dir.includes('w')) edges.x1 = Math.min(snap('x', edges.x1 + delta.dx), edges.x2 - min);
  if (dir.includes('e')) edges.x2 = Math.max(snap('x', edges.x2 + delta.dx), edges.x1 + min);
  if (dir.includes('n')) edges.y1 = Math.min(snap('y', edges.y1 + delta.dy), edges.y2 - min);
  if (dir.includes('s')) edges.y2 = Math.max(snap('y', edges.y2 + delta.dy), edges.y1 + min);
  if (ratio && dir.length === 2) keepRatio(dir, start, edges);
  return { left: edges.x1, top: edges.y1, width: edges.x2 - edges.x1, height: edges.y2 - edges.y1 };
}

/** Fields of a `free-resize` message: only what the handle changed (R-FF-14). */
export function resizeChanges(
  start: Box,
  end: Box,
  inFree: boolean,
): { left?: number; top?: number; width?: number; height?: number } {
  const round = Math.round;
  return {
    ...(inFree && round(end.left) !== round(start.left) ? { left: round(end.left) } : {}),
    ...(inFree && round(end.top) !== round(start.top) ? { top: round(end.top) } : {}),
    ...(round(end.width) !== round(start.width) ? { width: round(end.width) } : {}),
    ...(round(end.height) !== round(start.height) ? { height: round(end.height) } : {}),
  };
}
