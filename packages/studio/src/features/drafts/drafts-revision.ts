// Tells every drafts list to read again after KumiCraft itself deleted a draft file: its own writes
// are not reported as changed files, so the Page select and the Canvas would keep the deleted draft.
import { create } from 'zustand';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';

type DraftsRevisionState = {
  readonly revision: number;
  readonly bump: () => void;
};

export const useDraftsRevision = create<DraftsRevisionState>((set) => ({
  revision: 0,
  bump: () => {
    set((s) => ({ revision: s.revision + 1 }));
  },
}));

/**
 * After `path` (a file or a folder) was deleted: closes it in every frame that shows it, and
 * refreshes the drafts lists.
 */
export function afterDraftPathDeleted(path: string): void {
  const view = useCanvasViewStore.getState();
  // Every frame that shows it closes it, not only the active one.
  view.closeDraft(view.currentProjectId, path);
  useDraftsRevision.getState().bump();
}
