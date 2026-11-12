// Pure snap and smart-guide math for free frame elements (R-FF-18).
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GuideLine {
  axis: 'x' | 'y';
  pos: number;
  from: number;
  to: number;
}

export interface GapMark {
  axis: 'x' | 'y';
  from: number;
  to: number;
  at: number;
}

export interface GuideResult {
  left?: number | undefined;
  top?: number | undefined;
  lines: GuideLine[];
  gaps: GapMark[];
}

/** How near (page pixels) an edge or centre must come to snap, when no Canvas zoom is known. */
export const GUIDE_THRESHOLD_PX = 4;

/**
 * The snap reach in screen pixels (spec-log #125): at 60 % zoom a 4 page-pixel reach was under
 * 3 screen pixels and almost impossible to hit, so the reach follows the zoom like a CAD snap.
 */
export const SNAP_SCREEN_PX = 8;

/** The snap reach in page pixels for a Canvas `scale` (1 = 100 %). */
export function snapThreshold(scale: number): number {
  return scale > 0 ? SNAP_SCREEN_PX / scale : GUIDE_THRESHOLD_PX;
}

interface TargetPoint {
  val: number;
  isFrame: boolean;
  box?: Box | undefined;
}

function buildTargets(
  axis: 'x' | 'y',
  others: readonly Box[],
  frame: { width: number; height: number },
): { edges: TargetPoint[]; centers: TargetPoint[]; all: TargetPoint[] } {
  const size = axis === 'x' ? frame.width : frame.height;
  const frameEdges: TargetPoint[] = [
    { val: 0, isFrame: true },
    { val: size, isFrame: true },
  ];
  const frameCenter: TargetPoint = { val: size / 2, isFrame: true };

  const boxEdges: TargetPoint[] = others.flatMap((b) => {
    const start = axis === 'x' ? b.left : b.top;
    const len = axis === 'x' ? b.width : b.height;
    return [
      { val: start, isFrame: false, box: b },
      { val: start + len, isFrame: false, box: b },
    ];
  });
  const boxCenters: TargetPoint[] = others.map((b) => {
    const start = axis === 'x' ? b.left : b.top;
    const len = axis === 'x' ? b.width : b.height;
    return { val: start + len / 2, isFrame: false, box: b };
  });

  const edges = [...frameEdges, ...boxEdges];
  const centers = [frameCenter, ...boxCenters];
  return { edges, centers, all: [...edges, ...centers] };
}

function snapAxis(
  movingPts: readonly number[],
  targets: readonly TargetPoint[],
  threshold: number,
): { delta?: number | undefined; pos?: number | undefined; target?: TargetPoint | undefined } {
  let bestDelta: number | undefined;
  let bestPos: number | undefined;
  let bestTarget: TargetPoint | undefined;
  let minDiff = threshold + 1;

  for (const pt of movingPts) {
    for (const t of targets) {
      const diff = Math.abs(t.val - pt);
      if (diff < minDiff) {
        minDiff = diff;
        bestDelta = t.val - pt;
        bestPos = Math.round(t.val);
        bestTarget = t;
      }
    }
  }

  return { delta: bestDelta, pos: bestPos, target: bestTarget };
}

function computeLineSpan(
  target: TargetPoint,
  pos: number,
  axis: 'x' | 'y',
  others: readonly Box[],
  frame: { width: number; height: number },
  movingSpan?: { from: number; to: number },
): { from: number; to: number } {
  if (target.isFrame) {
    return { from: 0, to: Math.round(axis === 'x' ? frame.height : frame.width) };
  }
  const matched = others.filter((b) => {
    const pts =
      axis === 'x'
        ? [b.left, b.left + b.width / 2, b.left + b.width]
        : [b.top, b.top + b.height / 2, b.top + b.height];
    return pts.some((p) => Math.abs(p - pos) <= 0.5);
  });
  const froms = matched.map((b) => (axis === 'x' ? b.top : b.left));
  const tos = matched.map((b) => (axis === 'x' ? b.top + b.height : b.left + b.width));
  if (movingSpan !== undefined) {
    froms.push(movingSpan.from);
    tos.push(movingSpan.to);
  }
  return {
    from: Math.round(Math.min(...froms)),
    to: Math.round(Math.max(...tos)),
  };
}

function checkEqualGapX(
  moving: Box,
  others: readonly Box[],
  threshold: number,
): { pos?: number | undefined; gaps: GapMark[] } {
  const overlapY = others.filter(
    (b) => Math.max(b.top, moving.top) < Math.min(b.top + b.height, moving.top + moving.height),
  );
  const leftNeighbors = overlapY.filter((b) => b.left + b.width <= moving.left);
  const rightNeighbors = overlapY.filter((b) => b.left >= moving.left + moving.width);
  if (leftNeighbors.length === 0 || rightNeighbors.length === 0) return { gaps: [] };

  let leftA = leftNeighbors[0];
  for (const b of leftNeighbors) {
    if (leftA === undefined || b.left + b.width > leftA.left + leftA.width) leftA = b;
  }
  let rightB = rightNeighbors[0];
  for (const b of rightNeighbors) {
    if (rightB === undefined || b.left < rightB.left) rightB = b;
  }
  if (leftA === undefined || rightB === undefined) return { gaps: [] };

  const gL = moving.left - (leftA.left + leftA.width);
  const gR = rightB.left - (moving.left + moving.width);
  if (gL < 0 || gR < 0 || Math.abs(gL - gR) > threshold) return { gaps: [] };

  const newLeft = Math.round((leftA.left + leftA.width + rightB.left - moving.width) / 2);
  const at = Math.round(moving.top + moving.height / 2);
  const gaps: GapMark[] = [
    { axis: 'x', from: Math.round(leftA.left + leftA.width), to: newLeft, at },
    { axis: 'x', from: newLeft + Math.round(moving.width), to: Math.round(rightB.left), at },
  ];
  return { pos: newLeft, gaps };
}

function checkEqualGapY(
  moving: Box,
  others: readonly Box[],
  threshold: number,
): { pos?: number | undefined; gaps: GapMark[] } {
  const overlapX = others.filter(
    (b) => Math.max(b.left, moving.left) < Math.min(b.left + b.width, moving.left + moving.width),
  );
  const topNeighbors = overlapX.filter((b) => b.top + b.height <= moving.top);
  const bottomNeighbors = overlapX.filter((b) => b.top >= moving.top + moving.height);
  if (topNeighbors.length === 0 || bottomNeighbors.length === 0) return { gaps: [] };

  let topA = topNeighbors[0];
  for (const b of topNeighbors) {
    if (topA === undefined || b.top + b.height > topA.top + topA.height) topA = b;
  }
  let bottomB = bottomNeighbors[0];
  for (const b of bottomNeighbors) {
    if (bottomB === undefined || b.top < bottomB.top) bottomB = b;
  }
  if (topA === undefined || bottomB === undefined) return { gaps: [] };

  const gT = moving.top - (topA.top + topA.height);
  const gB = bottomB.top - (moving.top + moving.height);
  if (gT < 0 || gB < 0 || Math.abs(gT - gB) > threshold) return { gaps: [] };

  const newTop = Math.round((topA.top + topA.height + bottomB.top - moving.height) / 2);
  const at = Math.round(moving.left + moving.width / 2);
  const gaps: GapMark[] = [
    { axis: 'y', from: Math.round(topA.top + topA.height), to: newTop, at },
    { axis: 'y', from: newTop + Math.round(moving.height), to: Math.round(bottomB.top), at },
  ];
  return { pos: newTop, gaps };
}

function pickBestSnap(
  movingStart: number,
  movingLen: number,
  targets: { edges: TargetPoint[]; centers: TargetPoint[] },
  threshold: number,
): { delta?: number | undefined; pos?: number | undefined; target?: TargetPoint | undefined } {
  const snapEdges = snapAxis([movingStart, movingStart + movingLen], targets.edges, threshold);
  const snapCenter = snapAxis([movingStart + movingLen / 2], targets.centers, threshold);
  if (snapEdges.delta === undefined) return snapCenter;
  if (snapCenter.delta === undefined) return snapEdges;
  const diffEdge = Math.abs((snapEdges.pos ?? 0) - movingStart);
  const diffCenter = Math.abs((snapCenter.pos ?? 0) - (movingStart + movingLen / 2));
  return diffEdge <= diffCenter ? snapEdges : snapCenter;
}

function resolveAxisSnap(
  axis: 'x' | 'y',
  moving: Box,
  others: readonly Box[],
  frame: { width: number; height: number },
  perpStart: number,
  perpLen: number,
  threshold: number,
): { pos?: number | undefined; line?: GuideLine | undefined; gaps: GapMark[] } {
  const targets = buildTargets(axis, others, frame);
  const movingStart = axis === 'x' ? moving.left : moving.top;
  const movingLen = axis === 'x' ? moving.width : moving.height;
  const snapped = pickBestSnap(movingStart, movingLen, targets, threshold);

  if (snapped.delta !== undefined && snapped.pos !== undefined && snapped.target !== undefined) {
    const pos = Math.round(movingStart + snapped.delta);
    const span = computeLineSpan(snapped.target, snapped.pos, axis, others, frame, {
      from: perpStart,
      to: perpStart + perpLen,
    });
    return { pos, line: { axis, pos: snapped.pos, from: span.from, to: span.to }, gaps: [] };
  }

  const gap =
    axis === 'x'
      ? checkEqualGapX(moving, others, threshold)
      : checkEqualGapY(moving, others, threshold);
  return { pos: gap.pos, gaps: gap.gaps };
}

export function snapMove(
  moving: Box,
  others: readonly Box[],
  frame: { width: number; height: number },
  threshold = GUIDE_THRESHOLD_PX,
): GuideResult {
  const targetsX = buildTargets('x', others, frame);
  const targetsY = buildTargets('y', others, frame);
  const preSnapX = pickBestSnap(moving.left, moving.width, targetsX, threshold);
  const preSnapY = pickBestSnap(moving.top, moving.height, targetsY, threshold);

  const initialTop =
    preSnapY.delta !== undefined ? Math.round(moving.top + preSnapY.delta) : moving.top;
  const initialLeft =
    preSnapX.delta !== undefined ? Math.round(moving.left + preSnapX.delta) : moving.left;

  const resX = resolveAxisSnap('x', moving, others, frame, initialTop, moving.height, threshold);
  const resY = resolveAxisSnap('y', moving, others, frame, initialLeft, moving.width, threshold);

  const lines: GuideLine[] = [];
  if (resX.line) lines.push(resX.line);
  if (resY.line) lines.push(resY.line);

  return {
    ...(resX.pos !== undefined ? { left: resX.pos } : {}),
    ...(resY.pos !== undefined ? { top: resY.pos } : {}),
    lines,
    gaps: [...resX.gaps, ...resY.gaps],
  };
}

export function snapEdge(
  axis: 'x' | 'y',
  value: number,
  others: readonly Box[],
  frame: { width: number; height: number },
  threshold = GUIDE_THRESHOLD_PX,
): { value?: number | undefined; line?: GuideLine | undefined } {
  const targets = buildTargets(axis, others, frame);
  const snapped = snapAxis([value], targets.all, threshold);
  if (snapped.pos === undefined || snapped.target === undefined) return {};
  const span = computeLineSpan(snapped.target, snapped.pos, axis, others, frame);
  return {
    value: snapped.pos,
    line: { axis, pos: snapped.pos, from: span.from, to: span.to },
  };
}
