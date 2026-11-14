// Pure geometry and DOM rendering for Alt-hover distance measurements (TK-63).
export interface MeasureRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface AltMeasureSegment {
  readonly axis: 'x' | 'y';
  readonly side: 'top' | 'bottom' | 'left' | 'right';
  readonly from: number;
  readonly to: number;
  readonly at: number;
  readonly px: number;
}

export const ALT_MEASURE_CSS = `
.alt-measure-line {
  position: absolute;
  pointer-events: none;
  background: #f97316;
}
.alt-measure-label {
  position: absolute;
  pointer-events: none;
  background: #f97316;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-weight: 600;
  line-height: 1;
  border-radius: 2px;
  white-space: nowrap;
  transform: translate(-50%, -50%);
}
`;

function containsRect(outer: MeasureRect, inner: MeasureRect): boolean {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom
  );
}

function overlapMid(a1: number, a2: number, b1: number, b2: number, fallback: number): number {
  const start = Math.max(a1, b1);
  const end = Math.min(a2, b2);
  return end > start ? (start + end) / 2 : fallback;
}

function nestedSegments(outer: MeasureRect, inner: MeasureRect): AltMeasureSegment[] {
  const midX = inner.left + inner.width / 2;
  const midY = inner.top + inner.height / 2;
  const raw: AltMeasureSegment[] = [
    {
      axis: 'y',
      side: 'top',
      from: outer.top,
      to: inner.top,
      at: midX,
      px: Math.round(inner.top - outer.top),
    },
    {
      axis: 'y',
      side: 'bottom',
      from: inner.bottom,
      to: outer.bottom,
      at: midX,
      px: Math.round(outer.bottom - inner.bottom),
    },
    {
      axis: 'x',
      side: 'left',
      from: outer.left,
      to: inner.left,
      at: midY,
      px: Math.round(inner.left - outer.left),
    },
    {
      axis: 'x',
      side: 'right',
      from: inner.right,
      to: outer.right,
      at: midY,
      px: Math.round(outer.right - inner.right),
    },
  ];
  return raw.filter((s) => s.px > 0);
}

function pushGapSegment(
  segments: AltMeasureSegment[],
  axis: 'x' | 'y',
  side: AltMeasureSegment['side'],
  from: number,
  to: number,
  at: number,
): void {
  const px = Math.round(to - from);
  if (px > 0) segments.push({ axis, side, from, to, at, px });
}

export function computeAltMeasureSegments(
  selected: MeasureRect,
  target: MeasureRect,
): AltMeasureSegment[] {
  if (containsRect(target, selected)) return nestedSegments(target, selected);
  if (containsRect(selected, target)) return nestedSegments(selected, target);

  const segments: AltMeasureSegment[] = [];
  const midY = overlapMid(
    selected.top,
    selected.bottom,
    target.top,
    target.bottom,
    selected.top + selected.height / 2,
  );
  const midX = overlapMid(
    selected.left,
    selected.right,
    target.left,
    target.right,
    selected.left + selected.width / 2,
  );

  if (target.left > selected.right) {
    pushGapSegment(segments, 'x', 'right', selected.right, target.left, midY);
  } else if (selected.left > target.right) {
    pushGapSegment(segments, 'x', 'left', target.right, selected.left, midY);
  }

  if (target.top > selected.bottom) {
    pushGapSegment(segments, 'y', 'bottom', selected.bottom, target.top, midX);
  } else if (selected.top > target.bottom) {
    pushGapSegment(segments, 'y', 'top', target.bottom, selected.top, midX);
  }

  return segments;
}

export function renderAltMeasureSegments(
  layer: HTMLElement,
  segments: readonly AltMeasureSegment[],
  scale = 1,
): void {
  layer.replaceChildren();
  const safeScale = scale > 0 ? scale : 1;
  const stroke = Math.max(0.5, 1 / safeScale);
  for (const seg of segments) {
    const line = document.createElement('div');
    line.className = 'alt-measure-line';
    line.dataset['side'] = seg.side;

    const label = document.createElement('span');
    label.className = 'alt-measure-label';
    label.dataset['side'] = seg.side;
    label.textContent = `${String(seg.px)}px`;
    label.style.fontSize = `${String(10 / safeScale)}px`;
    label.style.padding = `${String(2 / safeScale)}px ${String(4 / safeScale)}px`;

    const len = Math.max(0, seg.to - seg.from);
    if (seg.axis === 'x') {
      line.style.left = `${String(seg.from)}px`;
      line.style.top = `${String(seg.at)}px`;
      line.style.width = `${String(len)}px`;
      line.style.height = `${String(stroke)}px`;
      label.style.left = `${String(seg.from + len / 2)}px`;
      label.style.top = `${String(seg.at)}px`;
    } else {
      line.style.left = `${String(seg.at)}px`;
      line.style.top = `${String(seg.from)}px`;
      line.style.width = `${String(stroke)}px`;
      line.style.height = `${String(len)}px`;
      label.style.left = `${String(seg.at)}px`;
      label.style.top = `${String(seg.from + len / 2)}px`;
    }
    layer.append(line, label);
  }
}
