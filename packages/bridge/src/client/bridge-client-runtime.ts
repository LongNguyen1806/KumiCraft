import {
  type BridgeEnvelope,
  BridgeEnvelopeSchema,
  type ElementInfo,
  type ElementRef,
  type StudioHighlightPayload,
  type StudioSelectPayload,
  type StudioTextEditStartPayload,
} from '@reactcraft/shared';

import { INTERCEPTED_EVENTS, isOverlayHost } from './bridge-events.ts';
import { toBuildError } from './build-error.ts';
import { getRefForElement, handleElementClick } from './candidate-chain.ts';
import { scanDomTree } from './dom-scanner.ts';
import { computeDragHandleTarget, DragController, resolveElementsByRefs } from './drag.ts';
import { browserDropEnv } from './drop-target.ts';
import { shouldForwardShortcut } from './keyboard.ts';
import { fitsMessageLimit } from './message-size.ts';
import { BridgeOverlay } from './overlay.ts';
import { attachRuntimeErrorListeners } from './runtime-errors.ts';
import { wrapBrowserHistory } from './runtime-history.ts';
import { collectSelectionInfo } from './selection-info.ts';
import { dispatchStudioMessage } from './studio-messages.ts';
import { TextEditController } from './text-edit.ts';

/** The part of Vite's `import.meta.hot` the Bridge uses (R-BR-17). */
export type HotContext = { on(event: string, callback: (payload: unknown) => void): void };

export type BridgeRuntimeConfig = {
  readonly nonce: string;
  readonly studioOrigin: string;
  /** Absolute root of the project, to report build errors with project-relative paths. */
  readonly rootDir: string;
  readonly hot?: HotContext | undefined;
};

export class BridgeClientRuntime {
  private nonce: string;
  private studioOrigin: string;
  private readonly rootDir: string;
  private readonly hot: HotContext | undefined;
  private mode: 'design' | 'preview' = 'design';
  private overlay: BridgeOverlay;
  private drag: DragController;
  private selectedRefs: ElementRef[] = [];
  private lastSelectionInfo: ElementInfo[] = [];
  private treeDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private selectionInfoTimer: ReturnType<typeof setTimeout> | undefined;
  private domObserver: MutationObserver;
  private isDestroyed = false;
  private textEdit: TextEditController;
  private historyTeardown?: () => void;
  private errorTeardown?: () => void;

  constructor(config: BridgeRuntimeConfig) {
    this.nonce = config.nonce;
    this.studioOrigin = config.studioOrigin;
    this.rootDir = config.rootDir;
    this.hot = config.hot;
    this.overlay = new BridgeOverlay((x, y) => {
      if (this.mode !== 'design' || this.textEdit.isActive()) return;
      this.drag.beginCanvasDrag(resolveElementsByRefs(this.selectedRefs, document), x, y);
    });
    this.drag = new DragController(
      browserDropEnv(document),
      {
        sendDropTarget: (p) => {
          this.sendToStudio('drop-target', p);
        },
        sendMoveIntent: (p) => {
          this.sendToStudio('move-intent', p);
        },
        showIndicator: (d) => {
          this.overlay.setDropIndicator(d);
        },
      },
      window,
    );
    this.textEdit = this.createTextEditController();
    this.domObserver = new MutationObserver((mutations) => {
      this.scheduleSelectionInfo();
      const shouldScanTree = mutations.some(
        (m) => m.type === 'childList' || m.attributeName === 'data-rc-loc',
      );
      if (shouldScanTree) this.scheduleTreeScan();
    });

    this.init();
  }

  private createTextEditController(): TextEditController {
    return new TextEditController({
      onCommit: (ref, text) => {
        this.sendToStudio('text-commit', { ref, text });
      },
      onCancel: (ref) => {
        this.sendToStudio('text-cancel', { ref });
      },
      onStart: (el) => {
        this.overlay.setTextEditing(el);
        this.syncDragHandle();
      },
      onEnd: () => {
        this.overlay.setTextEditing(undefined);
        this.syncDragHandle();
      },
    });
  }

  private init(): void {
    window.addEventListener('message', this.handleStudioMessage);
    for (const evtName of INTERCEPTED_EVENTS) {
      window.addEventListener(evtName, this.handleCapturedEvent, true);
    }
    window.addEventListener('pointermove', this.handlePointerMove, true);
    window.addEventListener('keydown', this.handleKeyDown, true);

    this.historyTeardown = wrapBrowserHistory(() => {
      this.sendToStudio('route', { route: window.location.pathname });
    });

    this.errorTeardown = attachRuntimeErrorListeners((message, stack) => {
      this.sendToStudio('runtime-error', {
        message: message.slice(0, 2000),
        ...(stack !== undefined ? { stack: stack.slice(0, 8000) } : {}),
      });
    });

    this.domObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-rc-loc', 'class'],
    });

    this.attachViteHmr();
    window.addEventListener('scroll', this.handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', this.handleScrollOrResize);

    this.sendToStudio('ready', {
      bridgeVersion: '1.0.0',
      route: window.location.pathname + window.location.search,
    });
    this.scheduleTreeScan();
  }

  private sendToStudio(type: string, payload: unknown): void {
    if (this.isDestroyed) return;
    const envelope: BridgeEnvelope = { rc: 1, nonce: this.nonce, type, payload };
    if (!fitsMessageLimit(envelope)) return;
    window.parent.postMessage(envelope, this.studioOrigin);
  }

  /**
   * V-111: a message counts only when it comes from the parent window, from the Studio origin, with
   * the nonce of this run, and its payload parses. Anything else is ignored without an answer.
   */
  private handleStudioMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent || event.origin !== this.studioOrigin) return;
    const envelope = BridgeEnvelopeSchema.safeParse(event.data);
    if (!envelope.success || envelope.data.nonce !== this.nonce) return;
    dispatchStudioMessage(envelope.data.type, envelope.data.payload, {
      setMode: (mode) => {
        this.setMode(mode);
      },
      handleSelect: (data) => {
        this.handleSelectMessage(data);
      },
      handleHighlight: (data) => {
        this.handleHighlightMessage(data);
      },
      handleNavigate: (route) => {
        this.handleNavigateMessage(route);
      },
      handleTextEditStart: (data) => {
        this.handleTextEditStartMessage(data);
      },
      commitTextEdit: () => {
        this.textEdit.commit();
      },
      handleDragOver: (data) => {
        if (this.mode === 'design' && !this.textEdit.isActive()) this.drag.studioDragOver(data);
      },
      handleDragEnd: (data) => {
        this.drag.studioDragEnd(data.drop);
      },
      handleDesignFile: (file) => {
        this.overlay.setDesignFile(file);
      },
    });
  };

  private setMode(mode: 'design' | 'preview'): void {
    if (this.mode === 'design' && mode !== 'design') {
      this.textEdit.commit();
      this.drag.cancel();
    }
    this.mode = mode;
    this.overlay.setVisible(mode === 'design');
    this.syncDragHandle();
  }

  private syncDragHandle(): void {
    this.overlay.setDragHandle(
      computeDragHandleTarget(this.selectedRefs, this.mode, this.textEdit.isActive(), document),
    );
  }

  private handleSelectMessage(payload: StudioSelectPayload): void {
    this.selectedRefs = [...payload.refs];
    this.overlay.setSelection(this.selectedRefs);
    this.syncDragHandle();

    if (payload.reveal && this.selectedRefs.length > 0) {
      const primary = this.selectedRefs[this.selectedRefs.length - 1];
      if (primary) {
        const el = document.querySelectorAll(`[data-rc-loc="${primary.loc}"]`)[primary.index];
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    }
    this.scheduleSelectionInfo();
  }

  private handleHighlightMessage(payload: StudioHighlightPayload): void {
    const el = payload.ref
      ? document.querySelectorAll(`[data-rc-loc="${payload.ref.loc}"]`)[payload.ref.index]
      : undefined;
    this.overlay.setHover(el);
  }

  private handleNavigateMessage(route: string): void {
    window.history.pushState(undefined, '', route);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  private handleTextEditStartMessage(payload: StudioTextEditStartPayload): void {
    const el = document.querySelectorAll(`[data-rc-loc="${payload.ref.loc}"]`)[
      payload.ref.index
    ] as HTMLElement | undefined;
    if (el) this.textEdit.start(el, payload.ref);
  }

  private getTargetElement(x: number, y: number): Element | undefined {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.id === '__rc_overlay_host' || el.closest('#__rc_overlay_host')) continue;
      const bridgeEl = el.closest('[data-rc-loc]');
      if (bridgeEl) return bridgeEl;
    }
    return undefined;
  }

  private handleCapturedEvent = (event: Event): void => {
    if (this.mode !== 'design') return;
    // The drag handle sits in the overlay's closed shadow root (R-DD-10): stopping the press here
    // would keep it from the handle's own listener, which swallows it itself.
    if (event.type === 'pointerdown' && isOverlayHost(event.target)) return;
    if (this.textEdit.isActive()) {
      const editingEl = this.textEdit.getEditingElement();
      if (
        editingEl !== undefined &&
        (event.target === editingEl || editingEl.contains(event.target as Node))
      ) {
        return;
      }
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.type === 'dblclick') {
      const mouseEvt = event as MouseEvent;
      const target = this.getTargetElement(mouseEvt.clientX, mouseEvt.clientY);
      const ref = target ? getRefForElement(target, document) : undefined;
      if (ref) this.sendToStudio('text-edit-request', { ref });
      return;
    }

    if (event.type === 'click') {
      if (this.drag.consumeClickSuppression()) return;
      this.handleClick(event as MouseEvent);
    }
  };

  private handleClick(mouseEvt: MouseEvent): void {
    const target = this.getTargetElement(mouseEvt.clientX, mouseEvt.clientY);
    this.selectedRefs = target
      ? handleElementClick(
          target,
          this.selectedRefs,
          {
            ctrlKey: mouseEvt.ctrlKey,
            metaKey: mouseEvt.metaKey,
            shiftKey: mouseEvt.shiftKey,
          },
          document,
        )
      : [];
    this.overlay.setSelection(this.selectedRefs);
    this.syncDragHandle();
    this.sendToStudio('select', { refs: this.selectedRefs });
    this.scheduleSelectionInfo();
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.mode !== 'design' || this.drag.isDragging()) return;
    const target = this.getTargetElement(event.clientX, event.clientY);
    this.overlay.setHover(target);
    const ref = target ? getRefForElement(target, document) : undefined;
    this.sendToStudio('hover', ref ? { ref } : {});
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.drag.isDragging()) {
      event.preventDefault();
      event.stopPropagation();
      this.drag.cancel();
      return;
    }
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    if (!shouldForwardShortcut(event, this.mode, this.textEdit.isActive(), isMac)) return;

    event.preventDefault();
    this.sendToStudio('shortcut', {
      key: event.key,
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      shift: event.shiftKey,
      alt: event.altKey,
    });
  };

  private scheduleTreeScan(): void {
    if (this.treeDebounceTimer !== undefined) clearTimeout(this.treeDebounceTimer);
    this.treeDebounceTimer = setTimeout(() => {
      this.sendToStudio('tree', scanDomTree(document.body));
      this.treeDebounceTimer = undefined;
    }, 100);
  }

  private attachViteHmr(): void {
    if (this.hot === undefined) return;
    this.hot.on('vite:error', (payload) => {
      this.sendToStudio('build-error', toBuildError(payload, this.rootDir));
    });
    this.hot.on('vite:afterUpdate', () => {
      this.sendToStudio('build-ok', {});
      this.scheduleTreeScan();
      this.scheduleSelectionInfo();
    });
  }

  private handleScrollOrResize = (): void => {
    this.scheduleSelectionInfo();
  };

  private scheduleSelectionInfo(): void {
    if (this.selectionInfoTimer !== undefined) clearTimeout(this.selectionInfoTimer);
    this.selectionInfoTimer = setTimeout(() => {
      this.selectionInfoTimer = undefined;
      this.syncDragHandle();
      const items = collectSelectionInfo(this.selectedRefs, document, this.lastSelectionInfo);
      this.lastSelectionInfo = items;
      this.sendToStudio('selection-info', { items });
    }, 16);
  }

  public setDesignFile(file?: string): void {
    this.overlay.setDesignFile(file);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.drag.destroy();
    this.textEdit.destroy();
    this.historyTeardown?.();
    this.errorTeardown?.();
    if (this.treeDebounceTimer !== undefined) clearTimeout(this.treeDebounceTimer);
    if (this.selectionInfoTimer !== undefined) clearTimeout(this.selectionInfoTimer);
    this.domObserver.disconnect();
    this.overlay.destroy();
    window.removeEventListener('message', this.handleStudioMessage);
    for (const evtName of INTERCEPTED_EVENTS) {
      window.removeEventListener(evtName, this.handleCapturedEvent, true);
    }
    window.removeEventListener('pointermove', this.handlePointerMove, true);
    window.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('scroll', this.handleScrollOrResize, true);
    window.removeEventListener('resize', this.handleScrollOrResize);
  }
}
