// Multi-frame router and registry for BridgeChannel (SPEC-04 M-MF).
import type {
  DrawTool,
  ElementRef,
  InspectorPreviewState,
  StudioDragOverPayload,
  StyleState,
} from '@kumicraft/shared';

import { type OpenFrame, useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { BridgeChannel, type BridgeListenerSets } from './bridge-channel-base.ts';
import type { CanvasMode } from './selection-store.ts';
import { useSelectionStore } from './selection-store.ts';

const sharedListeners: BridgeListenerSets = {
  textEdit: new Set(),
  freeFrame: new Set(),
  styleProbe: new Set(),
};

/**
 * One channel per open frame, for the frame's whole life: it never moves to another frame when
 * the frame being worked on changes. `studioBridgeChannel` forwards to the working frame's one.
 */
export class BridgeChannelRegistry {
  private readonly channels = new Map<string, BridgeChannel>();

  get(openFrameId: string): BridgeChannel {
    let ch = this.channels.get(openFrameId);
    if (!ch) {
      ch = new BridgeChannel(openFrameId, sharedListeners);
      ch.onSelectionSync = (id, refs) => {
        this.syncSelectionToOthers(id, refs);
      };
      this.channels.set(openFrameId, ch);
    }
    return ch;
  }

  getExisting(openFrameId: string): BridgeChannel | undefined {
    return this.channels.get(openFrameId);
  }

  detach(openFrameId: string): void {
    const ch = this.channels.get(openFrameId);
    if (ch) {
      ch.detach();
      this.channels.delete(openFrameId);
    }
  }

  detachAll(): void {
    for (const ch of this.channels.values()) ch.detach();
    this.channels.clear();
  }

  forEachOther(
    activeIdOrFn: string | ((channel: BridgeChannel, frame: OpenFrame) => void),
    fn?: (channel: BridgeChannel, frame: OpenFrame) => void,
  ): void {
    const activeId =
      typeof activeIdOrFn === 'string'
        ? activeIdOrFn
        : useCanvasViewStore.getState().activeOpenFrameId;
    const callback = typeof activeIdOrFn === 'function' ? activeIdOrFn : fn;
    if (!callback) return;

    const store = useCanvasViewStore.getState();
    for (const frame of store.openFrames) {
      if (frame.id !== activeId) {
        const ch = this.channels.get(frame.id);
        if (ch) callback(ch, frame);
      }
    }
  }

  syncSelectionToOthers(activeId: string, refs: readonly ElementRef[]): void {
    const store = useCanvasViewStore.getState();
    const activeFrame = store.openFrames.find((f) => f.id === activeId);
    const activeRoute = activeFrame?.route ?? useSelectionStore.getState().currentRoute;
    this.forEachOther(activeId, (channel, frame) => {
      if (frame.route === activeRoute) {
        channel.select(refs, false);
      }
    });
  }

  syncHighlightToOthers(activeId: string, ref: ElementRef | undefined): void {
    const store = useCanvasViewStore.getState();
    const activeFrame = store.openFrames.find((f) => f.id === activeId);
    const activeRoute = activeFrame?.route ?? useSelectionStore.getState().currentRoute;
    this.forEachOther(activeId, (channel, frame) => {
      if (frame.route === activeRoute) {
        channel.highlight(ref);
      }
    });
  }

  broadcastMode(mode: CanvasMode): void {
    for (const ch of this.channels.values()) {
      ch.setMode(mode);
    }
  }
}

export class StudioBridgeChannel extends BridgeChannel {
  private getActiveChannel(): BridgeChannel {
    const activeId = useCanvasViewStore.getState().activeOpenFrameId;
    return bridgeChannels.getExisting(activeId) ?? this;
  }

  override attach(iframeWindow: Window, runnerOrigin: string, nonce: string): void {
    const active = this.getActiveChannel();
    if (active !== this) {
      active.attach(iframeWindow, runnerOrigin, nonce);
      return;
    }
    super.attach(iframeWindow, runnerOrigin, nonce);
  }

  override detach(): void {
    const active = this.getActiveChannel();
    if (active !== this) {
      active.detach();
      return;
    }
    super.detach();
  }

  override select(refs: readonly ElementRef[], reveal: boolean): void {
    super.select(refs, reveal);
    const activeId = useCanvasViewStore.getState().activeOpenFrameId;
    const active = this.getActiveChannel();
    if (active !== this) active.select(refs, reveal);
    bridgeChannels.syncSelectionToOthers(activeId, refs);
  }

  override highlight(ref: ElementRef | undefined): void {
    super.highlight(ref);
    const activeId = useCanvasViewStore.getState().activeOpenFrameId;
    const active = this.getActiveChannel();
    if (active !== this) active.highlight(ref);
    bridgeChannels.syncHighlightToOthers(activeId, ref);
  }

  override setTool(tool: DrawTool): void {
    super.setTool(tool);
    const active = this.getActiveChannel();
    if (active !== this) active.setTool(tool);
  }

  override setMode(mode: CanvasMode): void {
    super.setMode(mode);
    bridgeChannels.broadcastMode(mode);
  }

  override setGrid(size: 1 | 4 | 8 | 16): void {
    super.setGrid(size);
    const active = this.getActiveChannel();
    if (active !== this) active.setGrid(size);
  }

  override navigate(route: string): void {
    super.navigate(route);
    const activeId = useCanvasViewStore.getState().activeOpenFrameId;
    const active = this.getActiveChannel();
    if (active !== this) active.navigate(route);
    useCanvasViewStore.getState().updateOpenFrame(activeId, { route });
  }

  override startTextEdit(ref: ElementRef, runIndex?: number): void {
    super.startTextEdit(ref, runIndex);
    const active = this.getActiveChannel();
    if (active !== this) active.startTextEdit(ref, runIndex);
  }

  override endTextEdit(ref: ElementRef): void {
    super.endTextEdit(ref);
    const active = this.getActiveChannel();
    if (active !== this) active.endTextEdit(ref);
  }

  override setDesignFile(file?: string, focus?: boolean): void {
    super.setDesignFile(file, focus);
    const active = this.getActiveChannel();
    if (active !== this) active.setDesignFile(file, focus);
  }

  override dragOver(payload: StudioDragOverPayload): void {
    super.dragOver(payload);
    const active = this.getActiveChannel();
    if (active !== this) active.dragOver(payload);
  }

  override dragEnd(drop: boolean): void {
    super.dragEnd(drop);
    const active = this.getActiveChannel();
    if (active !== this) active.dragEnd(drop);
  }

  override styleProbe(
    ref: ElementRef,
    properties: readonly string[],
    state?: StyleState,
    dark?: boolean,
    groupSelector?: string,
  ): void {
    super.styleProbe(ref, properties, state, dark, groupSelector);
    const active = this.getActiveChannel();
    if (active !== this) active.styleProbe(ref, properties, state, dark, groupSelector);
  }

  override setStatePreview(
    ref?: ElementRef,
    state?: InspectorPreviewState,
    groupRef?: ElementRef,
  ): void {
    super.setStatePreview(ref, state, groupRef);
    const active = this.getActiveChannel();
    if (active !== this) active.setStatePreview(ref, state, groupRef);
  }

  override setSelectPanelPreview(groupRef: ElementRef, activeIndex?: number): void {
    super.setSelectPanelPreview(groupRef, activeIndex);
    const active = this.getActiveChannel();
    if (active !== this) active.setSelectPanelPreview(groupRef, activeIndex);
  }

  override sendStylePreview(ref: ElementRef, property: string, value: string): void {
    super.sendStylePreview(ref, property, value);
    const active = this.getActiveChannel();
    if (active !== this) active.sendStylePreview(ref, property, value);
  }

  override clearStylePreview(): void {
    super.clearStylePreview();
    const active = this.getActiveChannel();
    if (active !== this) active.clearStylePreview();
  }

  override measureFree(ref: ElementRef): void {
    super.measureFree(ref);
    const active = this.getActiveChannel();
    if (active !== this) active.measureFree(ref);
  }

  override sendMotionPreview(ref: ElementRef): void {
    super.sendMotionPreview(ref);
    const active = this.getActiveChannel();
    if (active !== this) active.sendMotionPreview(ref);
  }

  override toggleInteractive(ref: ElementRef, open?: boolean): void {
    super.toggleInteractive(ref, open);
    const active = this.getActiveChannel();
    if (active !== this) active.toggleInteractive(ref, open);
  }
}

export const bridgeChannels = new BridgeChannelRegistry();
export const studioBridgeChannel = new StudioBridgeChannel(undefined, sharedListeners);

export function useBridgeChannel(): BridgeChannel {
  return studioBridgeChannel;
}
