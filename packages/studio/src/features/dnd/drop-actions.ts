import type {
  ElementGuard,
  InsertTarget,
  LibraryBlock,
  Placement,
  ProjectComponent,
} from '@kumicraft/shared';
import i18next from 'i18next';

import { applyStructureEdit } from '../../api/source-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { insertComponentAt } from '../components-panel/insert-component.ts';
import { placementTailwindMajor } from '../editor/canvas-view-store.ts';
import { insertBlockAt } from '../library/insert-block.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useDndStore } from './dnd-store.ts';

export async function executeDropMove(
  refs: readonly ElementGuard[],
  target: InsertTarget,
  placement?: Placement,
  tailwindMajor?: 3 | 4,
): Promise<boolean> {
  useDndStore.getState().setError(undefined);
  try {
    const res = await applyStructureEdit({
      kind: 'move',
      elements: [...refs],
      target,
      placement,
      tailwindMajor,
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
  placement?: Placement,
  tailwindMajor?: 3 | 4,
): Promise<boolean> {
  useDndStore.getState().setError(undefined);
  const res = await insertBlockAt(block, target, lang, placement, tailwindMajor);
  if (!res.ok) {
    if (res.error) {
      useDndStore.getState().setError(res.error);
    }
    return false;
  }
  return true;
}

export async function executeDropComponent(
  component: ProjectComponent,
  target: InsertTarget,
  placement?: Placement,
  tailwindMajor?: 3 | 4,
): Promise<boolean> {
  useDndStore.getState().setError(undefined);
  const res = await insertComponentAt(component, target, placement, tailwindMajor);
  if (!res.ok) {
    if (res.error) {
      useDndStore.getState().setError(res.error);
    }
    return false;
  }
  return true;
}

export async function handleDrop(lang = i18next.language): Promise<boolean> {
  const { drag, dropTarget, placement, endDrag } = useDndStore.getState();
  endDrag();
  if (!drag || !dropTarget) return false;
  const tailwindMajor = placementTailwindMajor(placement);

  if (drag.source === 'library') {
    return executeDropInsert(drag.block, dropTarget, lang, placement, tailwindMajor);
  }
  if (drag.source === 'component') {
    return executeDropComponent(drag.component, dropTarget, placement, tailwindMajor);
  }
  return executeDropMove(
    [{ loc: drag.ref.loc, tag: drag.tag }],
    dropTarget,
    placement,
    tailwindMajor,
  );
}
