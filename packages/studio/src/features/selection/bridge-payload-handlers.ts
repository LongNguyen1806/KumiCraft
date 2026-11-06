// Dispatchers for incoming Bridge payloads (SPEC-04 M-BR, R-BR-30, R-BR-31).
import {
  BridgeBuildErrorPayloadSchema,
  BridgeDrawEndPayloadSchema,
  BridgeDropTargetPayloadSchema,
  BridgeHoverPayloadSchema,
  BridgeLayerMenuClosePayloadSchema,
  BridgeLayerMenuPayloadSchema,
  BridgeMoveIntentPayloadSchema,
  BridgeReadyPayloadSchema,
  BridgeRoutePayloadSchema,
  BridgeRuntimeErrorPayloadSchema,
  BridgeSelectionInfoPayloadSchema,
  BridgeSelectPayloadSchema,
  BridgeShortcutPayloadSchema,
  BridgeTreePayloadSchema,
  type KeyPress,
  matchShortcut,
} from '@kumicraft/shared';

import { isApplePlatform } from '../../app/platform.ts';
import { useCanvasErrorStore } from '../canvas-errors/canvas-error-store.ts';
import { useDndStore } from '../dnd/dnd-store.ts';
import { executeDropMove } from '../dnd/drop-actions.ts';
import { handleDrawEnd } from '../draw/draw-commands.ts';
import { placementTailwindMajor } from '../editor/canvas-view-store.ts';
import { useLayerMenuStore } from '../layer-menu/layer-menu-store.ts';
import { runShortcut } from '../shortcuts/shortcut-actions.ts';
import { useSelectionStore } from './selection-store.ts';

function handleBridgeShortcut(payload: unknown): void {
  const res = BridgeShortcutPayloadSchema.safeParse(payload);
  if (!res.success) return;
  const press: KeyPress = {
    key: res.data.key,
    ctrl: res.data.ctrl,
    meta: res.data.meta,
    shift: res.data.shift,
    alt: res.data.alt,
  };
  const action = matchShortcut(press, isApplePlatform());
  if (action) runShortcut(action);
}

function handleErrorBridgePayload(type: string, payload: unknown): boolean {
  if (type === 'build-error') {
    const res = BridgeBuildErrorPayloadSchema.safeParse(payload);
    if (res.success) useCanvasErrorStore.getState().setBuildError(res.data);
    return true;
  }
  if (type === 'build-ok') {
    useCanvasErrorStore.getState().clearBuildError();
    return true;
  }
  if (type === 'runtime-error') {
    const res = BridgeRuntimeErrorPayloadSchema.safeParse(payload);
    if (res.success) useCanvasErrorStore.getState().addRuntimeError(res.data);
    return true;
  }
  return false;
}

function handleDndBridgePayload(type: string, payload: unknown): boolean {
  if (type === 'drop-target') {
    const res = BridgeDropTargetPayloadSchema.safeParse(payload);
    if (res.success) {
      useDndStore.getState().setDropTarget(res.data.target, res.data.placement);
    }
    return true;
  }
  if (type === 'move-intent') {
    const res = BridgeMoveIntentPayloadSchema.safeParse(payload);
    if (res.success) {
      void executeDropMove(
        res.data.elements,
        res.data.target,
        res.data.placement,
        placementTailwindMajor(res.data.placement),
      );
    }
    return true;
  }
  return false;
}

function handleLayerMenuBridgePayload(type: string, payload: unknown): boolean {
  if (type === 'layer-menu') {
    const res = BridgeLayerMenuPayloadSchema.safeParse(payload);
    if (res.success) useLayerMenuStore.getState().show(res.data);
    return true;
  }
  if (type === 'layer-menu-close') {
    const res = BridgeLayerMenuClosePayloadSchema.safeParse(payload);
    if (res.success) useLayerMenuStore.getState().close();
    return true;
  }
  if (type === 'draw-end') {
    const res = BridgeDrawEndPayloadSchema.safeParse(payload);
    if (res.success) {
      useDndStore.getState().setError(undefined);
      void handleDrawEnd(res.data);
    }
    return true;
  }
  return false;
}

export function dispatchBridgePayload(type: string, payload: unknown): void {
  if (handleErrorBridgePayload(type, payload)) return;
  if (handleDndBridgePayload(type, payload)) return;
  if (handleLayerMenuBridgePayload(type, payload)) return;
  const state = useSelectionStore.getState();
  switch (type) {
    case 'shortcut': {
      handleBridgeShortcut(payload);
      break;
    }
    case 'ready': {
      const res = BridgeReadyPayloadSchema.safeParse(payload);
      if (res.success) {
        state.setRoute(res.data.route);
        state.setBridgeReady(true);
      }
      useCanvasErrorStore.getState().dismissRuntimeErrors();
      break;
    }
    case 'hover': {
      const res = BridgeHoverPayloadSchema.safeParse(payload);
      if (res.success) state.setHoveredRef(res.data.ref);
      break;
    }
    case 'select': {
      useLayerMenuStore.getState().close();
      const res = BridgeSelectPayloadSchema.safeParse(payload);
      if (res.success) state.setSelectedRefs(res.data.refs);
      break;
    }
    case 'selection-info': {
      const res = BridgeSelectionInfoPayloadSchema.safeParse(payload);
      if (res.success) state.setSelectionInfo(res.data.items);
      break;
    }
    case 'tree': {
      const res = BridgeTreePayloadSchema.safeParse(payload);
      if (res.success) state.setTree(res.data.nodes, res.data.truncated);
      break;
    }
    case 'route': {
      const res = BridgeRoutePayloadSchema.safeParse(payload);
      if (res.success) state.setRoute(res.data.route);
      break;
    }
  }
}
