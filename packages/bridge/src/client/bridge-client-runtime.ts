import {
  type BridgeEnvelope,
  BridgeEnvelopeSchema,
  type BridgeReadyPayload,
  type BridgeSelectPayload,
  type BridgeShortcutPayload,
  type BridgeTextCancelPayload,
  type BridgeTextCommitPayload,
  type BridgeTextEditRequestPayload,
  type ElementInfo,
  type ElementRef,
  type StudioHighlightPayload,
  StudioHighlightPayloadSchema,
  StudioNavigatePayloadSchema,
  type StudioSelectPayload,
  StudioSelectPayloadSchema,
  StudioSetModePayloadSchema,
  type StudioTextEditStartPayload,
  StudioTextEditStartPayloadSchema,
} from '@reactcraft/shared';

import { toBuildError } from './build-error.ts';
import { getRefForElement, handleElementClick } from './candidate-chain.ts';
import { scanDomTree } from './dom-scanner.ts';
import { fitsMessageLimit } from './message-size.ts';
import { BridgeOverlay } from './overlay.ts';
import { collectSelectionInfo } from './selection-info.ts';
import { TextEditController } from './text-edit.ts';

const INTERCEPTED_EVENTS = [
  'pointerdown',
  'pointerup',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'submit',
  'dragstart',
] as const;

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
  private selectedRefs: ElementRef[] = [];
  private lastSelectionInfo: ElementInfo[] = [];
  private treeDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private selectionInfoTimer: ReturnType<typeof setTimeout> | undefined;
  private domObserver: MutationObserver;
  private isDestroyed = false;
  private textEdit: TextEditController;

  constructor(config: BridgeRuntimeConfig) {
    this.nonce = config.nonce;
    this.studioOrigin = config.studioOrigin;
    this.rootDir = config.rootDir;
    this.hot = config.hot;
    this.overlay = new BridgeOverlay();
    this.textEdit = new TextEditController({
      onCommit: (ref, text) => {
        const payload: BridgeTextCommitPayload = { ref, text };
        this.sendToStudio('text-commit', payload);
      },
      onCancel: (ref) => {
        const payload: BridgeTextCancelPayload = { ref };
        this.sendToStudio('text-cancel', payload);
      },
      onStart: (el) => {
        this.overlay.setTextEditing(el);
      },
      onEnd: () => {
        this.overlay.setTextEditing(undefined);
      },
    });

    this.domObserver = new MutationObserver((mutations) => {
      this.scheduleSelectionInfo();
      const shouldScanTree = mutations.some(
        (m) => m.type === 'childList' || m.attributeName === 'data-rc-loc',
      );
      if (shouldScanTree) {
        this.scheduleTreeScan();
      }
    });

    this.init();
  }

  private init(): void {
    // 1. Listen for Studio messages
    window.addEventListener('message', this.handleStudioMessage);

    // 2. Intercept capture events in design mode (R-BR-13)
    for (const evtName of INTERCEPTED_EVENTS) {
      window.addEventListener(evtName, this.handleCapturedEvent, true);
    }

    // 3. Pointer move for hover tracking
    window.addEventListener('pointermove', this.handlePointerMove, true);

    // 4. Keyboard shortcuts (R-BR-18)
    window.addEventListener('keydown', this.handleKeyDown, true);

    // 5. Route sync (R-BR-19)
    this.wrapHistory();

    // 6. Error handling (R-BR-17)
    this.attachErrorListeners();

    // 7. Observe DOM changes for tree scanner (R-BR-12) and selection info (R-BR-16)
    this.domObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-rc-loc', 'class'],
    });

    // 8. Listen to Vite HMR events if available (R-BR-17, R-BR-12, R-BR-16)
    this.attachViteHmr();

    // 9. Scroll and resize listeners for selection info (R-BR-16)
    window.addEventListener('scroll', this.handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', this.handleScrollOrResize);

    // 10. Send initial ready & tree messages
    const readyPayload: BridgeReadyPayload = {
      bridgeVersion: '1.0.0',
      route: window.location.pathname + window.location.search,
    };
    this.sendToStudio('ready', readyPayload);
    this.scheduleTreeScan();
  }

  private sendToStudio(type: string, payload: unknown): void {
    if (this.isDestroyed) return;
    const envelope: BridgeEnvelope = {
      rc: 1,
      nonce: this.nonce,
      type,
      payload,
    };
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
    this.dispatchStudioMessage(envelope.data.type, envelope.data.payload);
  };

  private dispatchStudioMessage(type: string, payload: unknown): void {
    switch (type) {
      case 'set-mode': {
        const parsed = StudioSetModePayloadSchema.safeParse(payload);
        if (parsed.success) this.setMode(parsed.data.mode);
        break;
      }
      case 'select': {
        const parsed = StudioSelectPayloadSchema.safeParse(payload);
        if (parsed.success) this.handleSelectMessage(parsed.data);
        break;
      }
      case 'highlight': {
        const parsed = StudioHighlightPayloadSchema.safeParse(payload);
        if (parsed.success) this.handleHighlightMessage(parsed.data);
        break;
      }
      case 'navigate': {
        const parsed = StudioNavigatePayloadSchema.safeParse(payload);
        if (parsed.success) this.handleNavigateMessage(parsed.data.route);
        break;
      }
      case 'text-edit-start': {
        const parsed = StudioTextEditStartPayloadSchema.safeParse(payload);
        if (parsed.success) this.handleTextEditStartMessage(parsed.data);
        break;
      }
      case 'text-edit-end':
        this.textEdit.commit();
        break;
    }
  }

  private setMode(mode: 'design' | 'preview'): void {
    if (this.mode === 'design' && mode !== 'design') this.textEdit.commit();
    this.mode = mode;
    this.overlay.setVisible(mode === 'design');
  }

  private handleSelectMessage(payload: StudioSelectPayload): void {
    this.selectedRefs = [...payload.refs];
    this.overlay.setSelection(this.selectedRefs);

    if (payload.reveal && this.selectedRefs.length > 0) {
      const primary = this.selectedRefs[this.selectedRefs.length - 1];
      if (primary) {
        const matches = document.querySelectorAll(`[data-rc-loc="${primary.loc}"]`);
        const el = matches[primary.index];
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

  /** R-BR-19: the wrapped pushState reports the new route to the Studio. */
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
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      if (el.id === '__rc_overlay_host' || el.closest('#__rc_overlay_host')) {
        continue;
      }
      const bridgeEl = el.closest('[data-rc-loc]');
      if (bridgeEl) {
        return bridgeEl;
      }
    }
    return undefined;
  }

  private handleCapturedEvent = (event: Event): void => {
    if (this.mode !== 'design') return;

    if (this.textEdit.isActive()) {
      const editingEl = this.textEdit.getEditingElement();
      if (
        editingEl !== undefined &&
        (event.target === editingEl || editingEl.contains(event.target as Node))
      ) {
        return; // R-TX-03: DO NOT intercept inside active editing element!
      }
    }

    // Prevent default and stop propagation so app links/buttons don't fire (R-BR-13)
    event.preventDefault();
    event.stopPropagation();

    if (event.type === 'dblclick') {
      const mouseEvt = event as MouseEvent;
      const target = this.getTargetElement(mouseEvt.clientX, mouseEvt.clientY);
      if (target) {
        const ref = getRefForElement(target, document);
        if (ref) {
          const payload: BridgeTextEditRequestPayload = { ref };
          this.sendToStudio('text-edit-request', payload);
        }
      }
      return;
    }

    if (event.type === 'click') {
      this.handleClick(event as MouseEvent);
    }
  };

  private handleClick(mouseEvt: MouseEvent): void {
    const target = this.getTargetElement(mouseEvt.clientX, mouseEvt.clientY);
    if (target) {
      this.selectedRefs = handleElementClick(
        target,
        this.selectedRefs,
        {
          ctrlKey: mouseEvt.ctrlKey,
          metaKey: mouseEvt.metaKey,
          shiftKey: mouseEvt.shiftKey,
        },
        document,
      );
      this.overlay.setSelection(this.selectedRefs);
      const payload: BridgeSelectPayload = { refs: this.selectedRefs };
      this.sendToStudio('select', payload);
      this.scheduleSelectionInfo();
    } else {
      // Click on empty space
      this.selectedRefs = [];
      this.overlay.setSelection([]);
      const payload: BridgeSelectPayload = { refs: [] };
      this.sendToStudio('select', payload);
      this.scheduleSelectionInfo();
    }
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.mode !== 'design') return;
    const target = this.getTargetElement(event.clientX, event.clientY);
    this.overlay.setHover(target);
    const ref = target ? getRefForElement(target, document) : undefined;
    this.sendToStudio('hover', ref ? { ref } : {});
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    // R-TX-03: while text is edited, keys belong to the text (Esc, Enter and native undo).
    if (this.mode !== 'design' || this.textEdit.isActive()) return;

    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    let shortcutKey: string | undefined;
    if (event.key === 'Escape') {
      shortcutKey = 'Escape';
    } else if (cmdOrCtrl && event.key.toLowerCase() === 'z') {
      shortcutKey = event.shiftKey ? 'Redo' : 'Undo';
    } else if (cmdOrCtrl && event.key.toLowerCase() === 'y') {
      shortcutKey = 'Redo';
    }

    if (shortcutKey) {
      event.preventDefault();
      const shortcutPayload: BridgeShortcutPayload = {
        key: shortcutKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
        alt: event.altKey,
      };
      this.sendToStudio('shortcut', shortcutPayload);
    }
  };

  private scheduleTreeScan(): void {
    if (this.treeDebounceTimer !== undefined) {
      clearTimeout(this.treeDebounceTimer);
    }
    this.treeDebounceTimer = setTimeout(() => {
      const payload = scanDomTree(document.body);
      this.sendToStudio('tree', payload);
      this.treeDebounceTimer = undefined;
    }, 100);
  }

  private wrapHistory(): void {
    const notifyRoute = (): void => {
      this.sendToStudio('route', { route: window.location.pathname });
    };
    const origPush = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);
    window.history.pushState = (...args: Parameters<typeof origPush>) => {
      origPush(...args);
      notifyRoute();
    };
    window.history.replaceState = (...args: Parameters<typeof origReplace>) => {
      origReplace(...args);
      notifyRoute();
    };
    window.addEventListener('popstate', notifyRoute);
  }

  private attachErrorListeners(): void {
    const reportError = (message: string, stack?: string): void => {
      this.sendToStudio('runtime-error', {
        message: message.slice(0, 2000),
        ...(stack !== undefined ? { stack: stack.slice(0, 8000) } : {}),
      });
    };
    window.addEventListener('error', (evt) => {
      const err = evt.error as { stack?: string } | undefined;
      reportError(
        evt.message || 'Unknown error',
        typeof err?.stack === 'string' ? err.stack : undefined,
      );
    });
    window.addEventListener('unhandledrejection', (evt) => {
      const reason = evt.reason as { message?: string; stack?: string } | undefined;
      const rawMsg =
        typeof reason?.message === 'string'
          ? reason.message
          : typeof evt.reason === 'string'
            ? evt.reason
            : 'Unhandled promise rejection';
      reportError(rawMsg, typeof reason?.stack === 'string' ? reason.stack : undefined);
    });
  }

  /** R-BR-17, R-BR-12: build errors and successful updates come from Vite's HMR channel. */
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
    if (this.selectionInfoTimer !== undefined) {
      clearTimeout(this.selectionInfoTimer);
    }
    this.selectionInfoTimer = setTimeout(() => {
      this.selectionInfoTimer = undefined;
      const items = collectSelectionInfo(this.selectedRefs, document, this.lastSelectionInfo);
      this.lastSelectionInfo = items;
      this.sendToStudio('selection-info', { items });
    }, 16);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.textEdit.destroy();
    if (this.treeDebounceTimer !== undefined) {
      clearTimeout(this.treeDebounceTimer);
    }
    if (this.selectionInfoTimer !== undefined) {
      clearTimeout(this.selectionInfoTimer);
    }
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
