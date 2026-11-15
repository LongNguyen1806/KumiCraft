// Deleting a draft from the Files tree closes it on the Canvas and refreshes the drafts lists.
import { afterEach, describe, expect, it } from 'vitest';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { afterDraftPathDeleted, useDraftsRevision } from './drafts-revision.ts';

afterEach(() => {
  useCanvasViewStore.getState().closeDraft();
});

describe('afterDraftPathDeleted', () => {
  it('closes the open draft when the file or its folder is deleted, and bumps the revision', () => {
    useCanvasViewStore.getState().openDraft('src/drafts/BanNhap1.tsx');
    const before = useDraftsRevision.getState().revision;

    afterDraftPathDeleted('src/drafts/Other.tsx');
    expect(useCanvasViewStore.getState().draftFile).toBe('src/drafts/BanNhap1.tsx');
    expect(useDraftsRevision.getState().revision).toBe(before + 1);

    afterDraftPathDeleted('src/drafts/BanNhap1.tsx');
    expect(useCanvasViewStore.getState().draftFile).toBeUndefined();

    useCanvasViewStore.getState().openDraft('src/drafts/BanNhap1.tsx');
    afterDraftPathDeleted('src/drafts');
    expect(useCanvasViewStore.getState().draftFile).toBeUndefined();
    expect(useDraftsRevision.getState().revision).toBe(before + 3);
  });
});
