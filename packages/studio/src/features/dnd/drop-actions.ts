// Drop execution actions for Canvas drag-and-drop (SPEC-04 section 16 M-DD, R-DD-14).
import type { ElementGuard, InsertTarget, LibraryBlock } from '@reactcraft/shared';
import i18next from 'i18next';

import { applyStructureEdit } from '../../api/source-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { insertBlockAt } from '../library/insert-block.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useDndStore } from './dnd-store.ts';

export async function executeDropMove(
  refs: readonly ElementGuard[],
  target: InsertTarget,
): Promise<boolean> {
  useDndStore.getState().setError(undefined);
  try {
    const res = await applyStructureEdit({
      kind: 'move',
      elements: [...refs],
      target,
    });
    const newLoc = res.locs[0];
    if (newLoc) {
      useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
    }
    return true;
  } catch (err) {
    useDndStore.getState().setError(toErrorInfo(err));
    return false;
  }
}

export async function executeDropInsert(
  block: LibraryBlock,
  target: InsertTarget,
  lang: string,
): Promise<boolean> {
  useDndStore.getState().setError(undefined);
  const res = await insertBlockAt(block, target, lang);
  if (!res.ok) {
    if (res.error) {
      useDndStore.getState().setError(res.error);
    }
    return false;
  }
  return true;
}

export async function handleDrop(lang = i18next.language): Promise<boolean> {
  const { drag, dropTarget, endDrag } = useDndStore.getState();
  endDrag();
  if (!drag || !dropTarget) return false;

  if (drag.source === 'library') {
    return executeDropInsert(drag.block, dropTarget, lang);
  }
  return executeDropMove([{ loc: drag.ref.loc, tag: drag.tag }], dropTarget);
}
