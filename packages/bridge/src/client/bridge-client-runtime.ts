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
  addWindowListeners,
  type BridgeRuntimeConfig,
  type HotContext,
  isOverlayHost,
} from './bridge-events.ts';
import { toBuildError } from './build-error.ts';
import { getRefForElement, handleElementClick } from './candidate-chain.ts';
import { CanvasTools } from './canvas-tools.ts';
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
import { answerStyleProbe } from './style-probe.ts';
import { TextEditController } from './text-edit.ts';

export type { BridgeRuntimeConfig, HotContext };

export class BridgeClientRuntime {
  private nonce: string;
  private studioOrigin: string;
  private readonly rootDir: string;
  private readonly hot: HotContext | undefined;
  private mode: 'design' | 'preview' = 'design';
  private overlay: BridgeOverlay;
  private drag: DragController;
  private tools: CanvasTools;
  private selectedRefs: ElementRef[] = [];
  private lastSelectionInfo: ElementInfo[] = [];
  private treeDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private selectionInfoTimer: ReturnType<typeof setTimeout> | undefined;
  private domObserver: MutationObserver;
  private isDestroyed = false;
  private textEdit: TextEditController;
  private historyTeardown?: () => void;
  private errorTeardown?: () => void;
  private windowListenersTeardown?: () => void;
  private designFile: string | undefined;
  private focus = false;

  constructor(config: BridgeRuntimeConfig) {
    this.nonce = config.nonce;
    this.studioOrigin = config.studioOrigin;
    this.rootDir = config.rootDir;
    this.hot = config.hot;
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
    this.windowListenersTeardown = addWindowListeners(
      this.handleCapturedEvent,
      this.handlePointerMove,
      this.handleKeyDown,
      this.handleScrollOrResize,
    );

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
      setMode: this.setMode,
      handleSelect: this.handleSelectMessage,
      handleHighlight: this.handleHighlightMessage,
      handleNavigate: this.handleNavigateMessage,
      handleTextEditStart: this.handleTextEditStartMessage,
      commitTextEdit: () => {
        this.textEdit.commit();
      },
      handleDragOver: (data) => {
        if (this.mode === 'design' && !this.textEdit.isActive()) this.drag.studioDragOver(data);
      },
      handleDragEnd: (data) => {
        this.drag.studioDragEnd(data.drop);
      },
      handleDesignFile: this.setDesignFile,
      handleSetGrid: (size) => {
        this.tools.setGrid(size);
      },
      handleMeasureFree: (ref) => {
        this.tools.measureFree(ref, document);
      },
      handleSetTool: (tool) => {
        this.tools.setTool(tool);
      },
      handleStyleProbe: (data) => {
        this.sendToStudio('style-probe-result', answerStyleProbe(data, document));
      },
    });
  };

  private setMode = (mode: 'design' | 'preview'): void => {
    if (this.mode === 'design' && mode !== 'design') {
      this.textEdit.commit();
      this.drag.cancel();
      this.tools.cancel();
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
    this.selectedRefs = [...payload.refs];
    this.tools.selectionChanged();
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
  };

  private handleHighlightMessage = (payload: StudioHighlightPayload): void => {
    const el = payload.ref ? resolveElementsByRefs([payload.ref], document)[0] : undefined;
    this.overlay.setHover(el);
  };

  private handleNavigateMessage = (route: string): void => {
    window.history.pushState(undefined, '', route);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  private handleTextEditStartMessage = (payload: StudioTextEditStartPayload): void => {
    const el = resolveElementsByRefs([payload.ref], document)[0];
    if (el instanceof HTMLElement) this.textEdit.start(el, payload.ref);
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
      const target = getBridgeElementAtPoint(
        document,
        mouseEvt.clientX,
        mouseEvt.clientY,
        this.designFile,
        this.focus,
      );
      const ref = target ? getRefForElement(target, document) : undefined;
      if (ref) this.sendToStudio('text-edit-request', { ref });
      return;
    }

    if (event.type === 'click') {
      if (this.drag.consumeClickSuppression() || this.tools.consumeClickSuppression()) return;
      this.handleClick(event as MouseEvent);
    }
  };

  /** Presses, right-clicks and handle clicks owned by the Canvas tools. True when handled. */
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
    // Clicks on overlay controls (size or drag handles) or with a draw tool active must not select.
    return (
      (event.type === 'click' || event.type === 'dblclick') &&
      (isOverlayHost(event.target) || this.tools.swallowDrawClick())
    );
  }

  private handleClick(mouseEvt: MouseEvent): void {
    const target = getBridgeElementAtPoint(
      document,
      mouseEvt.clientX,
      mouseEvt.clientY,
      this.designFile,
      this.focus,
    );
    if (this.focus && !target) return;
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
    if (this.mode !== 'design' || this.drag.isDragging() || this.tools.isDragging()) return;
    const target = getBridgeElementAtPoint(
      document,
      event.clientX,
      event.clientY,
      this.designFile,
      this.focus,
    );
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
    if (event.key === 'Escape' && this.tools.escape()) {
      event.preventDefault();
      event.stopPropagation();
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
    this.tools.scrolled();
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

  public setDesignFile = (file?: string, focus?: boolean): void => {
    this.designFile = file;
    this.focus = focus ?? false;
    this.overlay.setDesignFile(file, focus);
  };

  public destroy(): void {
    this.isDestroyed = true;
    this.drag.destroy();
    this.tools.destroy();
    this.textEdit.destroy();
    this.historyTeardown?.();
    this.errorTeardown?.();
    this.windowListenersTeardown?.();
    if (this.treeDebounceTimer !== undefined) clearTimeout(this.treeDebounceTimer);
    if (this.selectionInfoTimer !== undefined) clearTimeout(this.selectionInfoTimer);
    this.domObserver.disconnect();
    this.overlay.destroy();
    window.removeEventListener('message', this.handleStudioMessage);
  }
}
