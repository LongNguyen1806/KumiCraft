import type { BatchEdit, ElementRef, ShortcutAction } from '@kumicraft/shared';
import { readClassPx } from '@kumicraft/style-tailwind';

import { useDndStore } from '../../core/dnd-store.ts';
import { sendEdits } from '../../core/edits.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { canvasScope } from '../inspector/screen-scope.ts';
import { planClassEdit } from './class-edit.ts';
import { freeFrameOfRef } from './free-context.ts';
import { readStaticClassName } from './free-frame-commands.ts';

export function nudgeDelta(
  action: ShortcutAction,
  grid: 1 | 4 | 8 | 16,
): { dx: number; dy: number } | undefined {
  switch (action) {
    case 'nudgeLeft':
      return { dx: -grid, dy: 0 };
    case 'nudgeRight':
      return { dx: grid, dy: 0 };
    case 'nudgeUp':
      return { dx: 0, dy: -grid };
    case 'nudgeDown':
      return { dx: 0, dy: grid };
    case 'nudgeLeftFine':
      return { dx: -1, dy: 0 };
    case 'nudgeRightFine':
      return { dx: 1, dy: 0 };
    case 'nudgeUpFine':
      return { dx: 0, dy: -1 };
    case 'nudgeDownFine':
      return { dx: 0, dy: 1 };
    default:
      return undefined;
  }
}

export async function nudgeSelection(dx: number, dy: number): Promise<boolean> {
  const { selectedRefs, treeNodes } = useSelectionStore.getState();
  if (selectedRefs.length === 0) return false;

  const validRefs: ElementRef[] = [];
  const seenLocs = new Set<string>();

  for (const ref of selectedRefs) {
    if (seenLocs.has(ref.loc)) continue;
    const frame = await freeFrameOfRef(ref);
    if (frame !== undefined) {
      seenLocs.add(ref.loc);
      validRefs.push(ref);
    }
  }

  if (validRefs.length === 0) return false;

  const edits: BatchEdit[] = [];

  for (const ref of validRefs) {
    const beforeRes = await readStaticClassName(ref.loc);
    if (!beforeRes.ok) {
      useDndStore.getState().setError(beforeRes.error);
      return false;
    }

    const before = beforeRes.value;
    const oldLeft = readClassPx(before, 'left') ?? 0;
    const oldTop = readClassPx(before, 'top') ?? 0;
    const newLeft = Math.max(0, oldLeft + dx);
    const newTop = Math.max(0, oldTop + dy);

    const node = treeNodes.find((n) => n.ref.loc === ref.loc);
    // Same screen scope as an Inspector edit (spec-log #144).
    const planned = planClassEdit({ loc: ref.loc, tag: node?.tag ?? 'div' }, before, [
      {
        kind: 'place',
        placement: { kind: 'free', left: newLeft, top: newTop },
        canvas: canvasScope(ref.loc),
      },
    ]);
    if (!planned.ok) {
      useDndStore.getState().setError(planned.error);
      return false;
    }
    edits.push(planned.value.edit);
  }

  try {
    const coalesceKey = `nudge:${Array.from(seenLocs).join(',')}`;
    await sendEdits({ edits, coalesceKey });
    return true;
  } catch (err) {
    useDndStore.getState().setError(toErrorInfo(err));
    return false;
  }
}
