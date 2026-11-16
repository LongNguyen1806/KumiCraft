import {
  type BridgeEnvelope,
  BridgeEnvelopeSchema,
  type ElementInfo,
  type ElementRef,
  type StudioHighlightPayload,
  type StudioSelectPayload,
  type StudioTextEditStartPayload,
} from '@kumicraft/shared';

import {
  addAltClearListeners,
  addWindowListeners,
  attachViteHmrListeners,
  type BridgeRuntimeConfig,
  type HotContext,
  isOverlayHost,
  isToolClickSwallowed,
  navigateCanvasRoute,
  revealSelectedElement,
  runCanvasEscapeAction,
  shortcutPayload,
  trimRuntimeErrorPayload,
} from './bridge-events.ts';
import { buildBridgeMessageHandlers } from './bridge-runtime-handlers.ts';
import { getRefForElement, handleElementClick } from './candidate-chain.ts';
import { CanvasTools } from './canvas-tools.ts';
import { DarkStatePreview } from './dark-state-preview.ts';
import { scanDomTree } from './dom-scanner.ts';
import { computeDragHandleTarget, DragController, resolveElementsByRefs } from './drag.ts';
import { browserDropEnv } from './drop-target.ts';
import { shouldForwardShortcut } from './keyboard.ts';
import { fitsMessageLimit } from './message-size.ts';
import { BridgeOverlay } from './overlay.ts';
import { getBridgeElementAtPoint } from './overlay-focus.ts';
import { attachRuntimeErrorListeners } from './runtime-errors.ts';
import { wrapBrowserHistory } from './runtime-history.ts';
import { collectSelectionInfo } from './selection-info.ts';
import { dispatchStudioMessage } from './studio-messages.ts';
import { StylePreview } from './style-preview.ts';
import { findClickedTextRunIndex, TextEditController } from './text-edit.ts';

export type { BridgeRuntimeConfig, HotContext };

export class BridgeClientRuntime {
  private nonce: string;
  private studioOrigin: string;
  private readonly rootDir: string;
  private readonly hot: HotContext | undefined;
  private readonly navigation: 'history' | 'document';
  private mode: 'design' | 'preview' = 'design';
  private overlay: BridgeOverlay;
  private drag: DragController;
  private tools: CanvasTools;
  private readonly stylePreview = new StylePreview();
  private readonly darkStatePreview = new DarkStatePreview();
  private selectedRefs: ElementRef[] = [];
  private lastSelectionInfo: ElementInfo[] = [];
  private lastHoverEl: Element | undefined;
  private treeDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private selectionInfoTimer: ReturnType<typeof setTimeout> | undefined;
  private domObserver: MutationObserver;
  private isDestroyed = false;
  private textEdit: TextEditController;
  private readonly teardowns: Array<() => void> = [];
  private designFile: string | undefined;
  private focus = false;

  constructor(config: BridgeRuntimeConfig) {
    this.nonce = config.nonce;
    this.studioOrigin = config.studioOrigin;
    this.rootDir = config.rootDir;
    this.hot = config.hot;
    this.navigation = config.navigation ?? 'history';
    this.overlay = new BridgeOverlay((x, y) => {
      if (this.mode !== 'design' || this.textEdit.isActive()) return;
      this.drag.beginCanvasDrag(resolveElementsByRefs(this.selectedRefs, document), x, y);
    });
    this.tools = new CanvasTools(
      (type, payload) => {
        this.sendToStudio(type, payload);
      },
      this.overlay,
      window,
      () => this.designFile,
    );
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
        showGridCells: (c) => {
          this.overlay.setGridCells(c);
        },
      },
      window,
      () => this.tools.getGrid(),
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
      onCommit: (ref, text, runIndex) => {
        this.sendToStudio(
          'text-commit',
          runIndex !== undefined ? { ref, text, runIndex } : { ref, text },
        );
      },
      onCancel: (ref, runIndex) => {
        this.sendToStudio('text-cancel', runIndex !== undefined ? { ref, runIndex } : { ref });
      },
      onStart: (el) => {
        this.overlay.setTextEditing(el);
        this.syncDragHandle();
      },
      onEnd: () => {
        this.overlay.setTextEditing(undefined);
        this.syncDragHandle();
      },
      onSelectRange: (ref, range) => {
        this.sendToStudio('text-select', { ref, ...range });
      },
    });
  }

  private init(): void {
    window.addEventListener('message', this.handleStudioMessage);
    this.teardowns.push(
      addWindowListeners(
        this.handleCapturedEvent,
        this.handlePointerMove,
        this.handleKeyDown,
        this.handleScrollOrResize,
        (type, payload) => {
          this.sendToStudio(type, payload);
        },
      ),
      addAltClearListeners(() => {
        this.overlay.setAltMeasure(undefined, undefined);
      }),
      wrapBrowserHistory(() => {
        this.sendToStudio('route', { route: window.location.pathname });
      }),
      attachRuntimeErrorListeners((msg, stack) => {
        this.sendToStudio('runtime-error', trimRuntimeErrorPayload(msg, stack));
      }),
    );

    this.domObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-rc-loc', 'class'],
    });

    attachViteHmrListeners(
      this.hot,
      this.rootDir,
      (err) => {
        this.sendToStudio('build-error', err);
      },
      () => {
        this.sendToStudio('build-ok', {});
        this.scheduleTreeScan();
        this.scheduleSelectionInfo();
      },
    );

    this.sendToStudio('ready', {
      bridgeVersion: '1.0.0',
      route: window.location.pathname + window.location.search,
    });
    this.scheduleTreeScan();
  }

  private sendToStudio = (type: string, payload: unknown): void => {
    if (this.isDestroyed) return;
    const envelope: BridgeEnvelope = { rc: 1, nonce: this.nonce, type, payload };
    if (!fitsMessageLimit(envelope)) return;
    window.parent.postMessage(envelope, this.studioOrigin);
  };

  /**
   * V-111: a message counts only when it comes from the parent window, from the Studio origin, with
   * the nonce of this run, and its payload parses. Anything else is ignored without an answer.
   */
  private handleStudioMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent || event.origin !== this.studioOrigin) return;
    const envelope = BridgeEnvelopeSchema.safeParse(event.data);
    if (!envelope.success || envelope.data.nonce !== this.nonce) return;
    dispatchStudioMessage(envelope.data.type, envelope.data.payload, this.buildMessageHandlers());
  };

  private buildMessageHandlers() {
    return buildBridgeMessageHandlers({
      getMode: () => this.mode,
      setMode: this.setMode,
      handleSelect: this.handleSelectMessage,
      handleHighlight: this.handleHighlightMessage,
      handleNavigate: this.handleNavigateMessage,
      handleTextEditStart: this.handleTextEditStartMessage,
      setDesignFile: this.setDesignFile,
      textEdit: this.textEdit,
      drag: this.drag,
      tools: this.tools,
      overlay: this.overlay,
      stylePreview: this.stylePreview,
      darkStatePreview: this.darkStatePreview,
      scheduleTreeScan: () => {
        this.scheduleTreeScan();
      },
      sendToStudio: this.sendToStudio,
    });
  }

  private setMode = (mode: 'design' | 'preview'): void => {
    this.stylePreview.clearAll();
    this.darkStatePreview.clearState(document);
    if (this.mode === 'design' && mode !== 'design') {
      this.textEdit.commit();
      this.drag.cancel();
      this.tools.cancel();
      this.overlay.setAltMeasure(undefined, undefined);
    }
    this.mode = mode;
    this.overlay.setVisible(mode === 'design');
    this.syncDragHandle();
  };

  private syncDragHandle(): void {
    const handleTarget = computeDragHandleTarget(
      this.selectedRefs,
      this.mode,
      this.textEdit.isActive(),
      document,
    );
    this.overlay.setDragHandle(handleTarget);
    // R-FF-14: size handles on a single selected element, under the same conditions.
    this.tools.syncHandles(this.selectedRefs.length === 1 ? handleTarget : undefined);
  }

  private handleSelectMessage = (payload: StudioSelectPayload): void => {
    this.stylePreview.clearAll();
    this.darkStatePreview.clearState(document);
    this.selectedRefs = [...payload.refs];
    this.tools.selectionChanged();
    this.overlay.setSelection(this.selectedRefs);
    this.syncDragHandle();

    const primary = payload.reveal ? this.selectedRefs.at(-1) : undefined;
    if (primary !== undefined) revealSelectedElement(primary.loc, primary.index);
    this.scheduleSelectionInfo();
  };

  private handleHighlightMessage = (payload: StudioHighlightPayload): void => {
    const el = payload.ref ? resolveElementsByRefs([payload.ref], document)[0] : undefined;
    this.overlay.setHover(el);
  };

  private handleNavigateMessage = (route: string): void => {
    this.stylePreview.clearAll();
    navigateCanvasRoute(route, this.navigation);
  };

  private handleTextEditStartMessage = (payload: StudioTextEditStartPayload): void => {
    const el = resolveElementsByRefs([payload.ref], document)[0];
    if (el instanceof HTMLElement) this.textEdit.start(el, payload.ref, payload.runIndex);
  };

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
    if (this.handleToolEvent(event)) return;

    if (event.type === 'dblclick') {
      const mouseEvt = event as MouseEvent;
      const target = this.elementAt(mouseEvt.clientX, mouseEvt.clientY);
      const ref = target ? getRefForElement(target, document) : undefined;
      if (ref && target) {
        const runIndex = findClickedTextRunIndex(target, mouseEvt.clientX, mouseEvt.clientY);
        this.sendToStudio(
          'text-edit-request',
          runIndex !== undefined ? { ref, runIndex } : { ref },
        );
      }
      return;
    }

    if (event.type === 'click') {
      if (this.drag.consumeClickSuppression() || this.tools.consumeClickSuppression()) return;
      this.handleClick(event as MouseEvent);
    }
  };

  private elementAt(x: number, y: number): Element | undefined {
    return getBridgeElementAtPoint(document, x, y, this.designFile, this.focus);
  }

  private handleToolEvent(event: Event): boolean {
    if (event.type === 'pointerdown') {
      this.tools.pointerDown(
        event as PointerEvent,
        resolveElementsByRefs(this.selectedRefs, document),
      );
      return true;
    }
    if (event.type === 'contextmenu') {
      this.tools.contextMenu(event as MouseEvent, this.designFile, this.focus);
      return true;
    }
    return isToolClickSwallowed(event, () => this.tools.swallowDrawClick());
  }

  private handleClick(mouseEvt: MouseEvent): void {
    const target = this.elementAt(mouseEvt.clientX, mouseEvt.clientY);
    if (this.focus && !target) return;
    this.stylePreview.clearAll();
    this.darkStatePreview.clearState(document);
    this.selectedRefs = target
      ? handleElementClick(
          target,
          this.selectedRefs,
          { ctrlKey: mouseEvt.ctrlKey, metaKey: mouseEvt.metaKey, shiftKey: mouseEvt.shiftKey },
          document,
        )
      : [];
    this.overlay.setSelection(this.selectedRefs);
    this.syncDragHandle();
    this.sendToStudio('select', { refs: this.selectedRefs });
    this.scheduleSelectionInfo();
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.mode !== 'design' || this.drag.isDragging() || this.tools.isDragging()) return;
    const target = this.elementAt(event.clientX, event.clientY);
    this.lastHoverEl = target;
    this.overlay.setHover(target);
    this.syncAltMeasure(event.altKey);
    const ref = target ? getRefForElement(target, document) : undefined;
    this.sendToStudio('hover', ref ? { ref } : {});
  };

  private syncAltMeasure(altHeld: boolean): void {
    if (!altHeld || this.mode !== 'design' || this.selectedRefs.length !== 1 || !this.lastHoverEl) {
      this.overlay.setAltMeasure(undefined, undefined);
      return;
    }
    const selectedEl = resolveElementsByRefs(this.selectedRefs, document)[0];
    this.overlay.setAltMeasure(selectedEl, this.lastHoverEl);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Alt') this.syncAltMeasure(true);
    if (runCanvasEscapeAction(event, this.drag, this.tools)) return;
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    if (!shouldForwardShortcut(event, this.mode, this.textEdit.isActive(), isMac)) return;
    event.preventDefault();
    this.sendToStudio('shortcut', shortcutPayload(event));
  };

  private scheduleTreeScan(): void {
    if (this.treeDebounceTimer !== undefined) clearTimeout(this.treeDebounceTimer);
    this.treeDebounceTimer = setTimeout(() => {
      this.sendToStudio('tree', scanDomTree(document.body, this.designFile));
      this.treeDebounceTimer = undefined;
    }, 100);
  }

  private handleScrollOrResize = (): void => {
    this.tools.scrolled();
    this.scheduleSelectionInfo();
  };

  private scheduleSelectionInfo(): void {
    if (this.selectionInfoTimer !== undefined) clearTimeout(this.selectionInfoTimer);
    this.selectionInfoTimer = setTimeout(() => {
      this.selectionInfoTimer = undefined;
      this.syncDragHandle();
      this.lastSelectionInfo = collectSelectionInfo(
        this.selectedRefs,
        document,
        this.lastSelectionInfo,
        this.designFile,
      );
      this.sendToStudio('selection-info', { items: this.lastSelectionInfo });
    }, 16);
  }

  public setDesignFile = (file?: string, focus?: boolean): void => {
    this.designFile = file;
    this.focus = focus ?? false;
    this.overlay.setDesignFile(file, focus);
    // The layers name and the selection's component depend on the file (componentUseOf).
    this.scheduleTreeScan();
    this.scheduleSelectionInfo();
  };

  public destroy(): void {
    this.isDestroyed = true;
    this.stylePreview.clearAll();
    this.darkStatePreview.destroy(document);
    this.drag.destroy();
    this.tools.destroy();
    this.textEdit.destroy();
    for (const stop of this.teardowns) stop();
    if (this.treeDebounceTimer !== undefined) clearTimeout(this.treeDebounceTimer);
    if (this.selectionInfoTimer !== undefined) clearTimeout(this.selectionInfoTimer);
    this.domObserver.disconnect();
    this.overlay.destroy();
    window.removeEventListener('message', this.handleStudioMessage);
  }
}
