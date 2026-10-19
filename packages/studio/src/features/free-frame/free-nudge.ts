import type { AttributeLevelEdit, ElementRef, ShortcutAction } from '@reactcraft/shared';
import { applyPlacement, readClassPx } from '@reactcraft/shared';

import { editSourceBatch } from '../../api/source-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { useDndStore } from '../dnd/dnd-store.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
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

  const { tailwindMajor } = useCanvasViewStore.getState();
  const edits: AttributeLevelEdit[] = [];

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

    const after = applyPlacement(
      before,
      { kind: 'free', left: newLeft, top: newTop },
      tailwindMajor,
    );

    const node = treeNodes.find((n) => n.ref.loc === ref.loc);
    const tag = node?.tag ?? 'div';
    edits.push({ kind: 'setClassName', loc: ref.loc, tag, before, after });
  }

  try {
    const coalesceKey = `nudge:${Array.from(seenLocs).join(',')}`;
    await editSourceBatch({ edits, coalesceKey });
    return true;
  } catch (err) {
    useDndStore.getState().setError(toErrorInfo(err));
    return false;
  }
}
