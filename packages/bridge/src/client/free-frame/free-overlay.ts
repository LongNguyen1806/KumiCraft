// Free frame decorations, size handles and live labels drawn in the overlay's shadow root
// (SPEC-04 section 18E, R-FF-11, R-FF-13, R-FF-14).
import { FREE_ATTR, type GridSize } from './free-geometry.ts';
import { FLOW_HANDLES, FREE_HANDLES, type HandleDir } from './resize-box.ts';

export type FreeOverlayCallbacks = {
  onResizeDown: (el: Element, dir: HandleDir, x: number, y: number) => void;
  onResizeReset: (el: Element) => void;
};

/** Dots closer than this are noise, so a 1 or 4 px grid is drawn every 8 px. */
const MIN_DOT_SPACING_PX = 8;
const HANDLE_PX = 8;

export const FREE_OVERLAY_CSS = `
.free-frame {
  position: absolute;
  box-sizing: border-box;
  border: 1px dashed rgba(219, 39, 119, 0.7);
  background-image: radial-gradient(circle, rgba(219, 39, 119, 0.35) 1px, transparent 1px);
  pointer-events: none;
}
.free-frame-label {
  position: absolute;
  top: -18px;
  left: -1px;
  background: #db2777;
  color: #ffffff;
  font: 500 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 3px 5px;
  border-radius: 3px;
  white-space: nowrap;
}
.size-handle {
  position: absolute;
  width: ${String(HANDLE_PX)}px;
  height: ${String(HANDLE_PX)}px;
  box-sizing: border-box;
  background: #ffffff;
  border: 1.5px solid #2563eb;
  border-radius: 2px;
  pointer-events: auto;
  display: none;
}
.size-label {
  position: absolute;
  background: #0f172a;
  color: #ffffff;
  font: 500 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 3px 6px;
  border-radius: 3px;
  white-space: nowrap;
  pointer-events: none;
  display: none;
}
`;

const CURSORS: Readonly<Record<HandleDir, string>> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

function handlePoint(dir: HandleDir, r: DOMRect): { x: number; y: number } {
  const x = dir.includes('w') ? r.left : dir.includes('e') ? r.right : r.left + r.width / 2;
  const y = dir.includes('n') ? r.top : dir.includes('s') ? r.bottom : r.top + r.height / 2;
  return { x, y };
}

export class FreeOverlay {
  private readonly frameLayer: HTMLDivElement;
  private readonly handles = new Map<HandleDir, HTMLDivElement>();
  private readonly sizeLabel: HTMLSpanElement;
  private callbacks: FreeOverlayCallbacks | undefined;
  private target: Element | undefined;
  private grid: GridSize = 8;
  private label: { text: string; anchor: Element } | undefined;

  constructor(root: ShadowRoot) {
    const style = document.createElement('style');
    style.textContent = FREE_OVERLAY_CSS;
    root.appendChild(style);
    this.frameLayer = document.createElement('div');
    root.appendChild(this.frameLayer);
    for (const dir of FREE_HANDLES) {
      const handle = this.createHandle(dir);
      this.handles.set(dir, handle);
      root.appendChild(handle);
    }
    this.sizeLabel = document.createElement('span');
    this.sizeLabel.className = 'size-label';
    root.appendChild(this.sizeLabel);
  }

  public setCallbacks(callbacks: FreeOverlayCallbacks): void {
    this.callbacks = callbacks;
  }

  public setGrid(grid: GridSize): void {
    this.grid = grid;
  }

  /** Element that gets size handles (the primary selection), or `undefined` for none. */
  public setResizeTarget(el: Element | undefined): void {
    this.target = el;
  }

  public setLabel(text: string | undefined, anchor?: Element): void {
    this.label = text !== undefined && anchor !== undefined ? { text, anchor } : undefined;
  }

  public render(doc: Document): void {
    this.renderFrames(doc);
    this.renderHandles(doc);
    this.renderLabel(doc);
  }

  private createHandle(dir: HandleDir): HTMLDivElement {
    const handle = document.createElement('div');
    handle.className = 'size-handle';
    handle.dataset['dir'] = dir;
    handle.style.cursor = CURSORS[dir];
    handle.addEventListener('pointerdown', (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events have no active pointer; the resize still works inside the page.
      }
      if (this.target !== undefined) {
        this.callbacks?.onResizeDown(this.target, dir, event.clientX, event.clientY);
      }
    });
    handle.addEventListener('dblclick', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.target !== undefined) this.callbacks?.onResizeReset(this.target);
    });
    return handle;
  }

  private renderFrames(doc: Document): void {
    this.frameLayer.replaceChildren();
    const spacing = `${String(Math.max(this.grid, MIN_DOT_SPACING_PX))}px`;
    for (const frame of Array.from(doc.querySelectorAll(`[${FREE_ATTR}]`))) {
      const r = frame.getBoundingClientRect();
      const box = document.createElement('div');
      box.className = 'free-frame';
      box.style.top = `${String(r.top)}px`;
      box.style.left = `${String(r.left)}px`;
      box.style.width = `${String(r.width)}px`;
      box.style.height = `${String(r.height)}px`;
      box.style.backgroundSize = `${spacing} ${spacing}`;
      const label = document.createElement('span');
      label.className = 'free-frame-label';
      label.textContent = 'Khung tự do';
      box.appendChild(label);
      this.frameLayer.appendChild(box);
    }
  }

  private renderHandles(doc: Document): void {
    const target = this.target;
    const visible = target !== undefined && doc.documentElement.contains(target);
    const parent = visible ? target.parentElement?.closest('[data-rc-loc]') : undefined;
    const dirs = parent?.hasAttribute(FREE_ATTR) === true ? FREE_HANDLES : FLOW_HANDLES;
    const r = visible ? target.getBoundingClientRect() : undefined;
    for (const [dir, handle] of this.handles) {
      if (r === undefined || !dirs.includes(dir)) {
        handle.style.display = 'none';
        continue;
      }
      const p = handlePoint(dir, r);
      handle.style.display = 'block';
      handle.style.left = `${String(p.x - HANDLE_PX / 2)}px`;
      handle.style.top = `${String(p.y - HANDLE_PX / 2)}px`;
    }
  }

  private renderLabel(doc: Document): void {
    const label = this.label;
    if (label === undefined || !doc.documentElement.contains(label.anchor)) {
      this.sizeLabel.style.display = 'none';
      return;
    }
    const r = label.anchor.getBoundingClientRect();
    this.sizeLabel.textContent = label.text;
    this.sizeLabel.style.display = 'block';
    this.sizeLabel.style.left = `${String(r.left)}px`;
    this.sizeLabel.style.top = `${String(r.bottom + 6)}px`;
  }
}
