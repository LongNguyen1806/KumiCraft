// Commands for handling Bridge free-move and free-resize messages (R-FF-13, R-FF-14).
import type {
  BatchEdit,
  BridgeFreeMovePayload,
  BridgeFreeResizePayload,
  CanvasScope,
  ClassStep,
  Result,
} from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';
import { hasFreePosition, readClassPx } from '@kumicraft/style-tailwind';

import { fetchElementSourceByLoc } from '../../api/source-client.ts';
import { type BridgeChannel, studioBridgeChannel } from '../../core/bridge-channel.ts';
import { useDndStore } from '../../core/dnd-store.ts';
import { sendEdit, sendEdits } from '../../core/edits.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { canvasScope } from '../inspector/screen-scope.ts';
import { planClassEdit } from './class-edit.ts';

/** Current static className of an element; `className={…}` cannot be rewritten (E023). */
export async function readStaticClassName(loc: string): Promise<Result<string>> {
  const source = await fetchElementSourceByLoc(loc);
  if (!source) return err({ code: 'E016', params: { reason: 'notFound' } });
  if (source.className.kind === 'static') return ok(source.className.value);
  if (source.className.kind === 'none') return ok('');
  return err({ code: 'E023', params: { reason: 'classExpression' } });
}

export async function handleFreeMove(payload: BridgeFreeMovePayload): Promise<void> {
  const edits: BatchEdit[] = [];
  for (const item of payload.items) {
    const beforeRes = await readStaticClassName(item.ref.loc);
    if (!beforeRes.ok) {
      useDndStore.getState().setError(beforeRes.error);
      return;
    }
    const before = beforeRes.value;
    // No width/height in the placement: the element keeps its current w-/h- classes. Same screen
    // scope as an Inspector edit (spec-log #144).
    const planned = planClassEdit({ loc: item.ref.loc, tag: item.tag }, before, [
      {
        kind: 'place',
        placement: { kind: 'free', left: item.left, top: item.top },
        canvas: canvasScope(item.ref.loc),
      },
    ]);
    if (!planned.ok) {
      useDndStore.getState().setError(planned.error);
      return;
    }
    edits.push(planned.value.edit);
  }
  await sendEdits({ edits });
}

/** The steps of a Canvas resize: back to auto size, a new size, or a new free box. */
export function resizeSteps(
  payload: BridgeFreeResizePayload,
  currentClassName: string,
  canvas: CanvasScope,
): ClassStep[] {
  if (payload.resetSize) return [{ kind: 'clearSize', canvas }];

  const size = { width: payload.width, height: payload.height };
  const isFree =
    payload.left !== undefined || payload.top !== undefined || hasFreePosition(currentClassName);
  if (!isFree) return [{ kind: 'size', ...size, canvas }];

  const left = payload.left ?? readClassPx(currentClassName, 'left') ?? 0;
  const top = payload.top ?? readClassPx(currentClassName, 'top') ?? 0;
  return [{ kind: 'place', placement: { kind: 'free', left, top, ...size }, canvas }];
}

export async function handleFreeResize(payload: BridgeFreeResizePayload): Promise<void> {
  const beforeRes = await readStaticClassName(payload.ref.loc);
  if (!beforeRes.ok) {
    useDndStore.getState().setError(beforeRes.error);
    return;
  }
  const before = beforeRes.value;
  // Same screen scope as an Inspector edit (spec-log #144).
  const steps = resizeSteps(payload, before, canvasScope(payload.ref.loc));
  const planned = planClassEdit({ loc: payload.ref.loc, tag: payload.tag }, before, steps);
  if (!planned.ok) {
    useDndStore.getState().setError(planned.error);
    return;
  }
  await sendEdit({ edit: planned.value.edit });
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
