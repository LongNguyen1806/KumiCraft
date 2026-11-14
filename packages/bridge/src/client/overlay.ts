// Bridge overlay in closed shadow root (SPEC-04 R-BR-11, R-BR-15, R-DD-10, R-DD-13).
import type { ElementRef } from '@kumicraft/shared';

import {
  ALT_MEASURE_CSS,
  computeAltMeasureSegments,
  renderAltMeasureSegments,
} from './alt-measure.ts';
import type { DropRect, DropResult } from './drop-target.ts';
import { FreeOverlay } from './free-frame/free-overlay.ts';
import { focusPath, focusRoots } from './overlay-focus.ts';
import { foreignLabel, OVERLAY_CSS } from './overlay-foreign.ts';

export type OverlayState = {
  hoverEl?: Element | undefined;
  selectedRefs: readonly ElementRef[];
  textEditingEl?: HTMLElement | undefined;
  dragHandleEl?: Element | undefined;
  dropIndicator?: DropResult | undefined;
  altMeasureTarget?: { selected: Element; target: Element } | undefined;
};

function applyRectStyle(
  el: HTMLElement,
  rect: {
    readonly top?: number | undefined;
    readonly left?: number | undefined;
    readonly x?: number | undefined;
    readonly y?: number | undefined;
    readonly width: number;
    readonly height: number;
  },
): void {
  el.style.top = `${String(rect.top ?? rect.y ?? 0)}px`;
  el.style.left = `${String(rect.left ?? rect.x ?? 0)}px`;
  el.style.width = `${String(rect.width)}px`;
  el.style.height = `${String(rect.height)}px`;
}

export class BridgeOverlay {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private hoverBox: HTMLDivElement;
  private hoverBoxLabel: HTMLSpanElement;
  private selectionContainer: HTMLDivElement;
  private dragHandle: HTMLDivElement;
  private gridLayer: HTMLDivElement;
  private dropLine: HTMLDivElement;
  private dropBox: HTMLDivElement;
  private dropBoxLabel: HTMLSpanElement;
  private altMeasureLayer: HTMLDivElement;
  private drawBox: HTMLDivElement = document.createElement('div');
  private gridCells: readonly DropRect[] | undefined;
  private scale = 1;
  private observer: MutationObserver;
  private state: OverlayState = { selectedRefs: [] };
  private rafId: number | undefined;
  private visible = true;
  private handleListener: ((x: number, y: number) => void) | undefined;
  private designFile: string | undefined;
  private focus = false;
  private focusSvg: SVGSVGElement;
  private focusPathEl: SVGPathElement;
  /** Free frame decorations, size handles and size labels (R-FF-11..14). */
  public readonly free: FreeOverlay;

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
    style.textContent = `${OVERLAY_CSS}\n${ALT_MEASURE_CSS}`;
    this.shadow.appendChild(style);

    const focusEls = this.createFocusSvgElement();
    this.focusSvg = focusEls.svg;
    this.focusPathEl = focusEls.path;
    this.shadow.appendChild(this.focusSvg);

    this.hoverBox = document.createElement('div');
    this.hoverBox.className = 'box hover-box';
    this.hoverBox.style.display = 'none';
    this.hoverBoxLabel = document.createElement('span');
    this.hoverBoxLabel.className = 'tag-label foreign';
    this.hoverBoxLabel.style.display = 'none';
    this.hoverBox.appendChild(this.hoverBoxLabel);
    this.shadow.appendChild(this.hoverBox);

    this.selectionContainer = document.createElement('div');
    this.shadow.appendChild(this.selectionContainer);

    this.gridLayer = document.createElement('div');
    this.shadow.appendChild(this.gridLayer);

    this.dropLine = document.createElement('div');
    this.dropLine.className = 'drop-line';
    this.shadow.appendChild(this.dropLine);

    this.dropBox = document.createElement('div');
    this.dropBox.className = 'drop-box';
    this.dropBoxLabel = document.createElement('span');
    this.dropBoxLabel.className = 'tag-label';
    this.dropBox.appendChild(this.dropBoxLabel);
    this.shadow.appendChild(this.dropBox);
    this.altMeasureLayer = document.createElement('div');
    this.shadow.appendChild(this.altMeasureLayer);

    // Size handles go under the drag handle, which wins where the two overlap at the top-right corner.
    this.free = new FreeOverlay(this.shadow);

    this.dragHandle = this.createDragHandleElement();
    this.shadow.appendChild(this.dragHandle);

    this.observer = new MutationObserver(() => {
      this.ensureAttached();
      this.requestRender();
    });

    this.attach();
  }

  private createFocusSvgElement(): { svg: SVGSVGElement; path: SVGPathElement } {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'fixed';
    svg.style.inset = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.display = 'none';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'rgba(15, 23, 42, 0.35)');
    path.setAttribute('fill-rule', 'evenodd');
    svg.appendChild(path);
    return { svg, path };
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

  public setDesignFile(file?: string, focus?: boolean): void {
    this.designFile = file;
    this.focus = focus ?? false;
    this.requestRender();
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

  public setGridCells(cells: readonly DropRect[] | undefined): void {
    this.gridCells = cells;
    if (this.visible) this.renderGridCells();
    this.requestRender();
  }

  public setScale(scale: number): void {
    this.scale = scale > 0 ? scale : 1;
  }

  public setAltMeasure(selected?: Element, target?: Element): void {
    this.state.altMeasureTarget =
      selected !== undefined && target !== undefined && selected !== target
        ? { selected, target }
        : undefined;
    this.requestRender();
  }

  public setDrawRect(
    rect: { x: number; y: number; width: number; height: number } | undefined,
  ): void {
    if (!rect) {
      this.drawBox.style.display = 'none';
      return;
    }
    if (!this.drawBox.parentNode) {
      this.drawBox.style.cssText =
        'position:fixed;box-sizing:border-box;border:1px solid #2563eb;background:rgba(37, 99, 235, 0.08);pointer-events:none;';
      this.shadow.appendChild(this.drawBox);
    }
    this.drawBox.style.display = 'block';
    applyRectStyle(this.drawBox, rect);
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
    const hoverEl = this.state.hoverEl;
    if (
      this.state.dropIndicator === undefined &&
      hoverEl &&
      document.documentElement.contains(hoverEl)
    ) {
      const rect = hoverEl.getBoundingClientRect();
      const loc = hoverEl.getAttribute('data-rc-loc') ?? '';
      const fLabel = foreignLabel(loc, this.designFile);
      this.hoverBox.style.display = 'block';
      this.hoverBox.className = `box hover-box${fLabel !== undefined ? ' foreign' : ''}`;
      if (fLabel !== undefined) {
        this.hoverBoxLabel.style.display = 'block';
        this.hoverBoxLabel.textContent = fLabel;
      } else {
        this.hoverBoxLabel.style.display = 'none';
      }
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
      const fLabel = foreignLabel(ref.loc, this.designFile);
      const isForeign = fLabel !== undefined;

      const box = document.createElement('div');
      const baseClass = isPrimary ? 'select-box-primary' : 'select-box-secondary';
      box.className = `box ${baseClass}${isForeign ? ' foreign' : ''}`;
      applyRectStyle(box, rect);

      if (isPrimary) {
        const label = document.createElement('span');
        label.className = `tag-label${isForeign ? ' foreign' : ''}`;
        label.textContent = fLabel ?? targetEl.tagName.toLowerCase();
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
      applyRectStyle(this.dropLine, d.rect);
    } else {
      this.dropLine.style.display = 'none';
      this.dropBox.style.display = 'block';
      this.dropBoxLabel.textContent = `↳ ${d.label}`;
      applyRectStyle(this.dropBox, d.rect);
    }
  }

  private renderFocus(): void {
    if (!this.focus || !this.designFile) {
      this.focusSvg.style.display = 'none';
      return;
    }
    const roots = focusRoots(document, this.designFile);
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const rects = roots.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    this.focusPathEl.setAttribute('d', focusPath(viewport, rects));
    this.focusSvg.style.display = 'block';
  }

  private renderGridCells(): void {
    this.gridLayer.replaceChildren();
    if (!this.gridCells || this.gridCells.length === 0) return;
    for (const cell of this.gridCells) {
      const box = document.createElement('div');
      box.style.position = 'absolute';
      box.style.boxSizing = 'border-box';
      box.style.border = '1px dashed rgba(59, 130, 246, 0.45)';
      box.style.background = 'rgba(59, 130, 246, 0.03)';
      box.style.pointerEvents = 'none';
      applyRectStyle(box, cell);
      this.gridLayer.appendChild(box);
    }
  }

  private render(): void {
    if (!this.visible) return;
    this.renderFocus();
    this.renderHover();
    this.renderSelections();
    this.free.render(document);
    this.renderAltMeasure();
    this.renderDragHandle();
    this.renderGridCells();
    this.renderDropIndicator();
  }

  private renderAltMeasure(): void {
    const pair = this.state.altMeasureTarget;
    if (
      pair === undefined ||
      !document.documentElement.contains(pair.selected) ||
      !document.documentElement.contains(pair.target)
    ) {
      this.altMeasureLayer.replaceChildren();
      return;
    }
    const segments = computeAltMeasureSegments(
      pair.selected.getBoundingClientRect(),
      pair.target.getBoundingClientRect(),
    );
    renderAltMeasureSegments(this.altMeasureLayer, segments, this.scale);
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
