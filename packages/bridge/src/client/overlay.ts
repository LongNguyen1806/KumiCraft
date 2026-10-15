import type { ElementRef } from '@reactcraft/shared';

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
`;

export type OverlayState = {
  hoverEl?: Element | undefined;
  selectedRefs: readonly ElementRef[];
  textEditingEl?: HTMLElement | undefined;
};

export class BridgeOverlay {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private hoverBox: HTMLDivElement;
  private selectionContainer: HTMLDivElement;
  private observer: MutationObserver;
  private state: OverlayState = { selectedRefs: [] };
  private rafId: number | undefined;
  private visible = true;

  constructor() {
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

    this.observer = new MutationObserver(() => {
      this.ensureAttached();
      this.requestRender();
    });

    this.attach();
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
    if (this.state.hoverEl && document.documentElement.contains(this.state.hoverEl)) {
      const rect = this.state.hoverEl.getBoundingClientRect();
      this.hoverBox.style.display = 'block';
      this.hoverBox.style.top = `${String(rect.top)}px`;
      this.hoverBox.style.left = `${String(rect.left)}px`;
      this.hoverBox.style.width = `${String(rect.width)}px`;
      this.hoverBox.style.height = `${String(rect.height)}px`;
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
      box.style.top = `${String(rect.top)}px`;
      box.style.left = `${String(rect.left)}px`;
      box.style.width = `${String(rect.width)}px`;
      box.style.height = `${String(rect.height)}px`;

      if (isPrimary) {
        const label = document.createElement('span');
        label.className = 'tag-label';
        label.textContent = targetEl.tagName.toLowerCase();
        box.appendChild(label);
      }
      this.selectionContainer.appendChild(box);

      if (elements.length > 1) {
        for (let i = 0; i < elements.length; i++) {
          if (i === targetIndex) continue;
          const otherEl = elements[i];
          if (!otherEl) continue;
          const otherRect = otherEl.getBoundingClientRect();
          const faintBox = document.createElement('div');
          faintBox.className = 'box select-box-secondary';
          faintBox.style.top = `${String(otherRect.top)}px`;
          faintBox.style.left = `${String(otherRect.left)}px`;
          faintBox.style.width = `${String(otherRect.width)}px`;
          faintBox.style.height = `${String(otherRect.height)}px`;
          this.selectionContainer.appendChild(faintBox);
        }
      }
    }
  }

  private render(): void {
    if (!this.visible) return;
    this.renderHover();
    this.renderSelections();
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
