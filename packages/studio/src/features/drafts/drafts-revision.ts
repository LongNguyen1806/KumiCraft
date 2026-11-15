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
 * After `path` (a file or a folder) was deleted: closes the open draft when it was inside, and
 * refreshes the drafts lists.
 */
export function afterDraftPathDeleted(path: string): void {
  const view = useCanvasViewStore.getState();
  const open = view.draftFile;
  if (open !== undefined && (open === path || open.startsWith(`${path}/`))) {
    view.closeDraft(view.currentProjectId);
  }
  useDraftsRevision.getState().bump();
}
