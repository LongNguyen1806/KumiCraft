// Screen-scaled X/Y guide lines from a free frame's inner edge to the selected child (TK-61).
import { FREE_ATTR } from './free-geometry.ts';

export const CHILD_GUIDE_CSS = `
.free-frame-active {
  border-style: dashed;
  border-color: rgba(219, 39, 119, 0.95);
}
.child-guide-line {
  position: absolute;
  pointer-events: none;
  background: #db2777;
}
.child-guide-label {
  position: absolute;
  pointer-events: none;
  background: #db2777;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-weight: 600;
  line-height: 1;
  border-radius: 2px;
  white-space: nowrap;
  transform: translate(-50%, -50%);
}
`;

export function findParentFreeFrame(
  target: Element | undefined,
  doc: Document,
): Element | undefined {
  if (target === undefined || !doc.documentElement.contains(target)) return undefined;
  return target.parentElement?.closest(`[${FREE_ATTR}]`) ?? undefined;
}

export function scalePx(screenPx: number, scale: number): string {
  const safeScale = scale > 0 ? scale : 1;
  return `${String(screenPx / safeScale)}px`;
}

function appendChildGuideSegment(
  layer: HTMLElement,
  opts: {
    axis: 'x' | 'y';
    from: number;
    to: number;
    fixedCoord: number;
    pxValue: number;
    scale: number;
  },
): void {
  const safeScale = opts.scale > 0 ? opts.scale : 1;
  const stroke = Math.max(0.5, 1 / safeScale);
  const start = Math.min(opts.from, opts.to);
  const len = Math.max(0, Math.abs(opts.to - opts.from));

  const line = document.createElement('div');
  line.className = 'child-guide-line';
  line.dataset['axis'] = opts.axis;

  const label = document.createElement('span');
  label.className = 'child-guide-label';
  label.dataset['axis'] = opts.axis;
  label.textContent = `${String(Math.round(opts.pxValue))}px`;
  label.style.fontSize = scalePx(10, safeScale);
  label.style.padding = `${scalePx(2, safeScale)} ${scalePx(4, safeScale)}`;

  if (opts.axis === 'x') {
    line.style.left = `${String(start)}px`;
    line.style.top = `${String(opts.fixedCoord)}px`;
    line.style.width = `${String(len)}px`;
    line.style.height = `${String(stroke)}px`;
    label.style.left = `${String(start + len / 2)}px`;
    label.style.top = `${String(opts.fixedCoord)}px`;
  } else {
    line.style.left = `${String(opts.fixedCoord)}px`;
    line.style.top = `${String(start)}px`;
    line.style.width = `${String(stroke)}px`;
    line.style.height = `${String(len)}px`;
    label.style.left = `${String(opts.fixedCoord)}px`;
    label.style.top = `${String(start + len / 2)}px`;
  }

  layer.append(line, label);
}

export function renderChildFrameGuides(
  layer: HTMLElement,
  target: Element | undefined,
  doc: Document,
  scale: number,
): Element | undefined {
  layer.replaceChildren();
  const frame = findParentFreeFrame(target, doc);
  if (frame === undefined || target === undefined) return undefined;

  const fr = frame.getBoundingClientRect();
  const cr = target.getBoundingClientRect();
  const frameLeft = fr.left + frame.clientLeft;
  const frameTop = fr.top + frame.clientTop;

  appendChildGuideSegment(layer, {
    axis: 'x',
    from: frameLeft,
    to: cr.left,
    fixedCoord: cr.top + cr.height / 2,
    pxValue: cr.left - frameLeft,
    scale,
  });
  appendChildGuideSegment(layer, {
    axis: 'y',
    from: frameTop,
    to: cr.top,
    fixedCoord: cr.left + cr.width / 2,
    pxValue: cr.top - frameTop,
    scale,
  });

  return frame;
}
