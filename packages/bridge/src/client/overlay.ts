// Bridge overlay in closed shadow root (SPEC-04 R-BR-11, R-BR-15, R-DD-10, R-DD-13).
import type { ElementRef } from '@reactcraft/shared';

import type { DropResult } from './drop-target.ts';

const OVERLAY_CSS = `
:host {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483647;
  overflow: hidden;
}

.box {
  position: absolute;
  pointer-events: none;
  box-sizing: border-box;
  transition: top 60ms ease-out, left 60ms ease-out, width 60ms ease-out, height 60ms ease-out;
}

.hover-box {
  border: 1px solid #3b82f6;
  background: rgba(59, 130, 246, 0.08);
}

.select-box-primary {
  border: 2px solid #2563eb;
  background: rgba(37, 99, 235, 0.12);
}

.select-box-secondary {
  border: 1.5px dashed rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.04);
}

.tag-label {
  position: absolute;
  top: -20px;
  left: -2px;
  background: #2563eb;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 3px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.drag-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  background: #2563eb;
  color: #ffffff;
  border-radius: 3px;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.drop-line {
  position: absolute;
  pointer-events: none;
  background: #2563eb;
  display: none;
}

.drop-box {
  position: absolute;
  pointer-events: none;
  box-sizing: border-box;
  border: 2px dashed #2563eb;
  background: rgba(37, 99, 235, 0.06);
  display: none;
}
`;

export type OverlayState = {
  hoverEl?: Element | undefined;
  selectedRefs: readonly ElementRef[];
  textEditingEl?: HTMLElement | undefined;
  dragHandleEl?: Element | undefined;
  dropIndicator?: DropResult | undefined;
};

function applyRectStyle(
  el: HTMLElement,
  rect: {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
  },
): void {
  el.style.top = `${String(rect.top)}px`;
  el.style.left = `${String(rect.left)}px`;
  el.style.width = `${String(rect.width)}px`;
  el.style.height = `${String(rect.height)}px`;
}

export class BridgeOverlay {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private hoverBox: HTMLDivElement;
  private selectionContainer: HTMLDivElement;
  private dragHandle: HTMLDivElement;
  private dropLine: HTMLDivElement;
  private dropBox: HTMLDivElement;
  private dropBoxLabel: HTMLSpanElement;
  private observer: MutationObserver;
  private state: OverlayState = { selectedRefs: [] };
  private rafId: number | undefined;
  private visible = true;
  private handleListener: ((x: number, y: number) => void) | undefined;

  constructor(onHandleDown?: (x: number, y: number) => void) {
    this.handleListener = onHandleDown;
    this.host = document.createElement('div');
    this.host.id = '__rc_overlay_host';
    this.host.style.position = 'fixed';
    this.host.style.inset = '0';
    this.host.style.pointerEvents = 'none';
    this.host.style.zIndex = '2147483647';

    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    this.shadow.appendChild(style);

    this.hoverBox = document.createElement('div');
    this.hoverBox.className = 'box hover-box';
    this.hoverBox.style.display = 'none';
    this.shadow.appendChild(this.hoverBox);

    this.selectionContainer = document.createElement('div');
    this.shadow.appendChild(this.selectionContainer);

    this.dropLine = document.createElement('div');
    this.dropLine.className = 'drop-line';
    this.shadow.appendChild(this.dropLine);

    this.dropBox = document.createElement('div');
    this.dropBox.className = 'drop-box';
    this.dropBoxLabel = document.createElement('span');
    this.dropBoxLabel.className = 'tag-label';
    this.dropBox.appendChild(this.dropBoxLabel);
    this.shadow.appendChild(this.dropBox);

    this.dragHandle = this.createDragHandleElement();
    this.shadow.appendChild(this.dragHandle);

    this.observer = new MutationObserver(() => {
      this.ensureAttached();
      this.requestRender();
    });

    this.attach();
  }

  private createDragHandleElement(): HTMLDivElement {
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.addEventListener('pointerdown', (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      // Keep the drag's pointerup even when the pointer is released outside the iframe.
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // No active pointer with this id (synthetic events): the drag still works inside the page.
      }
      this.handleListener?.(event.clientX, event.clientY);
    });
    return handle;
  }

  private attach(): void {
    if (!document.documentElement.contains(this.host)) {
      document.documentElement.appendChild(this.host);
    }
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-rc-loc'],
    });

    window.addEventListener('scroll', this.handleLayoutChange, { passive: true });
    window.addEventListener('resize', this.handleLayoutChange, { passive: true });
  }

  private handleLayoutChange = (): void => {
    this.requestRender();
  };

  public ensureAttached(): void {
    if (!document.documentElement.contains(this.host)) {
      document.documentElement.appendChild(this.host);
    }
  }

  public setHandleListener(fn: ((x: number, y: number) => void) | undefined): void {
    this.handleListener = fn;
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.host.style.display = visible ? 'block' : 'none';
  }

  public setHover(el?: Element): void {
    this.state.hoverEl = el;
    this.requestRender();
  }

  public setSelection(refs: readonly ElementRef[]): void {
    this.state.selectedRefs = refs;
    this.requestRender();
  }

  public setTextEditing(el?: HTMLElement): void {
    this.state.textEditingEl = el;
    this.requestRender();
  }

  public setDragHandle(el?: Element): void {
    this.state.dragHandleEl = el;
    this.requestRender();
  }

  public setDropIndicator(d?: DropResult): void {
    this.state.dropIndicator = d;
    if (this.visible) {
      this.renderHover();
      this.renderDropIndicator();
    }
    this.requestRender();
  }

  public requestRender(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = requestAnimationFrame(() => {
      this.render();
      this.rafId = undefined;
    });
  }

  private renderHover(): void {
    if (
      this.state.dropIndicator === undefined &&
      this.state.hoverEl &&
      document.documentElement.contains(this.state.hoverEl)
    ) {
      const rect = this.state.hoverEl.getBoundingClientRect();
      this.hoverBox.style.display = 'block';
      applyRectStyle(this.hoverBox, rect);
    } else {
      this.hoverBox.style.display = 'none';
    }
  }

  private renderSelections(): void {
    this.selectionContainer.innerHTML = '';
    const primaryRef = this.state.selectedRefs[this.state.selectedRefs.length - 1];

    for (const ref of this.state.selectedRefs) {
      const elements = document.querySelectorAll(`[data-rc-loc="${ref.loc}"]`);
      const targetIndex = ref.index;
      const targetEl = elements[targetIndex];
      if (!targetEl) continue;

      const isPrimary = ref === primaryRef;
      const rect = targetEl.getBoundingClientRect();

      const box = document.createElement('div');
      box.className = `box ${isPrimary ? 'select-box-primary' : 'select-box-secondary'}`;
      applyRectStyle(box, rect);

      if (isPrimary) {
        const label = document.createElement('span');
        label.className = 'tag-label';
        label.textContent = targetEl.tagName.toLowerCase();
        box.appendChild(label);
      }
      this.selectionContainer.appendChild(box);
      this.renderFaintInstances(elements, targetIndex);
    }
  }

  private renderFaintInstances(elements: NodeListOf<Element>, skipIndex: number): void {
    if (elements.length <= 1) return;
    for (let i = 0; i < elements.length; i++) {
      if (i === skipIndex) continue;
      const otherEl = elements[i];
      if (!otherEl) continue;
      const otherRect = otherEl.getBoundingClientRect();
      const faintBox = document.createElement('div');
      faintBox.className = 'box select-box-secondary';
      applyRectStyle(faintBox, otherRect);
      this.selectionContainer.appendChild(faintBox);
    }
  }

  private renderDragHandle(): void {
    const el = this.state.dragHandleEl;
    if (el && !this.state.textEditingEl && document.documentElement.contains(el)) {
      const rect = el.getBoundingClientRect();
      this.dragHandle.style.display = 'flex';
      this.dragHandle.style.top = `${String(rect.top - 2)}px`;
      this.dragHandle.style.left = `${String(rect.left + rect.width - 14)}px`;
    } else {
      this.dragHandle.style.display = 'none';
    }
  }

  private renderDropIndicator(): void {
    const d = this.state.dropIndicator;
    if (!d) {
      this.dropLine.style.display = 'none';
      this.dropBox.style.display = 'none';
      return;
    }
    if (d.indicator === 'line') {
      this.dropBox.style.display = 'none';
      this.dropLine.style.display = 'block';
      applyRectStyle(this.dropLine, {
        top: d.rect.y,
        left: d.rect.x,
        width: d.rect.width,
        height: d.rect.height,
      });
    } else {
      this.dropLine.style.display = 'none';
      this.dropBox.style.display = 'block';
      this.dropBoxLabel.textContent = `↳ ${d.label}`;
      applyRectStyle(this.dropBox, {
        top: d.rect.y,
        left: d.rect.x,
        width: d.rect.width,
        height: d.rect.height,
      });
    }
  }

  private render(): void {
    if (!this.visible) return;
    this.renderHover();
    this.renderSelections();
    this.renderDragHandle();
    this.renderDropIndicator();
  }

  public destroy(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
    }
    this.observer.disconnect();
    window.removeEventListener('scroll', this.handleLayoutChange);
    window.removeEventListener('resize', this.handleLayoutChange);
    if (this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
  }
}
