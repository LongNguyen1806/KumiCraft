// Commands for handling Bridge free-move and free-resize messages (R-FF-13, R-FF-14).
import type {
  AttributeLevelEdit,
  BridgeFreeMovePayload,
  BridgeFreeResizePayload,
  Result,
} from '@kumicraft/shared';
import {
  applyPlacement,
  applySize,
  clearSize,
  err,
  hasFreePosition,
  ok,
  readClassPx,
} from '@kumicraft/shared';

import { editSource, editSourceBatch, fetchElementSourceByLoc } from '../../api/source-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { useDndStore } from '../dnd/dnd-store.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { scopeCanvasChange } from '../inspector/screen-scope.ts';
import { type BridgeChannel, studioBridgeChannel } from '../selection/bridge-channel.ts';

/** Current static className of an element; `className={…}` cannot be rewritten (E023). */
export async function readStaticClassName(loc: string): Promise<Result<string>> {
  const source = await fetchElementSourceByLoc(loc);
  if (!source) return err({ code: 'E016', params: { reason: 'notFound' } });
  if (source.className.kind === 'static') return ok(source.className.value);
  if (source.className.kind === 'none') return ok('');
  return err({ code: 'E023', params: { reason: 'classExpression' } });
}

export async function handleFreeMove(payload: BridgeFreeMovePayload): Promise<void> {
  const { tailwindMajor } = useCanvasViewStore.getState();
  const edits: AttributeLevelEdit[] = [];
  for (const item of payload.items) {
    const beforeRes = await readStaticClassName(item.ref.loc);
    if (!beforeRes.ok) {
      useDndStore.getState().setError(beforeRes.error);
      return;
    }
    const before = beforeRes.value;
    // No width/height in the placement: the element keeps its current w-/h- classes.
    const placed = applyPlacement(
      before,
      { kind: 'free', left: item.left, top: item.top },
      tailwindMajor,
    );
    // Same screen scope as an Inspector edit (spec-log #144).
    const after = scopeCanvasChange(item.ref.loc, before, placed);
    if (after === undefined) {
      useDndStore.getState().setError({ code: 'E023', params: { reason: 'screenSplit' } });
      return;
    }
    edits.push({ kind: 'setClassName', loc: item.ref.loc, tag: item.tag, before, after });
  }
  await editSourceBatch({ edits });
}

export function computeNextClassNameForResize(
  payload: BridgeFreeResizePayload,
  currentClassName: string,
  tailwindMajor: 3 | 4 = 4,
): string {
  if (payload.resetSize) return clearSize(currentClassName);

  const size = { width: payload.width, height: payload.height };
  const isFree =
    payload.left !== undefined || payload.top !== undefined || hasFreePosition(currentClassName);
  if (!isFree) return applySize(currentClassName, size, tailwindMajor);

  const left = payload.left ?? readClassPx(currentClassName, 'left') ?? 0;
  const top = payload.top ?? readClassPx(currentClassName, 'top') ?? 0;
  return applyPlacement(currentClassName, { kind: 'free', left, top, ...size }, tailwindMajor);
}

export async function handleFreeResize(payload: BridgeFreeResizePayload): Promise<void> {
  const beforeRes = await readStaticClassName(payload.ref.loc);
  if (!beforeRes.ok) {
    useDndStore.getState().setError(beforeRes.error);
    return;
  }
  const before = beforeRes.value;
  const resized = computeNextClassNameForResize(
    payload,
    before,
    useCanvasViewStore.getState().tailwindMajor,
  );
  // Same screen scope as an Inspector edit (spec-log #144).
  const after = scopeCanvasChange(payload.ref.loc, before, resized);
  if (after === undefined) {
    useDndStore.getState().setError({ code: 'E023', params: { reason: 'screenSplit' } });
    return;
  }
  await editSource({
    edit: { kind: 'setClassName', loc: payload.ref.loc, tag: payload.tag, before, after },
  });
}

function reportFailure(task: Promise<void>): void {
  task.catch((e: unknown) => {
    useDndStore.getState().setError(toErrorInfo(e));
  });
}

export function registerFreeFrameCommands(
  channel: BridgeChannel = studioBridgeChannel,
): () => void {
  return channel.registerFreeFrameListener({
    onFreeMove: (payload) => {
      useDndStore.getState().setError(undefined);
      reportFailure(handleFreeMove(payload));
    },
    onFreeResize: (payload) => {
      useDndStore.getState().setError(undefined);
      reportFailure(handleFreeResize(payload));
    },
  });
}
