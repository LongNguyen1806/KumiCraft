// Zustand store for Canvas drag-and-drop state (SPEC-04 section 16 M-DD, R-DD-10..14).
import type { ElementRef, InsertTarget, LibraryBlock } from '@reactcraft/shared';
import { create } from 'zustand';

import type { ErrorInfo } from '../../routes/error-text.ts';

export type DragSource =
  | { readonly source: 'library'; readonly block: LibraryBlock }
  | { readonly source: 'layer'; readonly ref: ElementRef; readonly tag: string };

export type DndState = {
  readonly drag?: DragSource | undefined;
  readonly dropTarget?: InsertTarget | undefined;
  readonly error?: ErrorInfo | undefined;
  startDrag: (s: DragSource) => void;
  setDropTarget: (t: InsertTarget | undefined) => void;
  endDrag: () => void;
  setError: (e: ErrorInfo | undefined) => void;
};

export const useDndStore = create<DndState>((set) => ({
  drag: undefined,
  dropTarget: undefined,
  error: undefined,
  startDrag: (s) => {
    set({ drag: s, dropTarget: undefined, error: undefined });
  },
  setDropTarget: (t) => {
    set({ dropTarget: t });
  },
  endDrag: () => {
    set({ drag: undefined, dropTarget: undefined });
  },
  setError: (e) => {
    set({ error: e });
  },
}));
