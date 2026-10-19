import type {
  ElementRef,
  InsertTarget,
  LibraryBlock,
  Placement,
  ProjectComponent,
} from '@reactcraft/shared';
import { create } from 'zustand';

import type { ErrorInfo } from '../../routes/error-text.ts';

export type DragSource =
  | { readonly source: 'library'; readonly block: LibraryBlock }
  | { readonly source: 'layer'; readonly ref: ElementRef; readonly tag: string }
  | { readonly source: 'component'; readonly component: ProjectComponent };

export type DndState = {
  readonly drag?: DragSource | undefined;
  readonly dropTarget?: InsertTarget | undefined;
  readonly placement?: Placement | undefined;
  readonly error?: ErrorInfo | undefined;
  startDrag: (s: DragSource) => void;
  setDropTarget: (t: InsertTarget | undefined, placement?: Placement) => void;
  endDrag: () => void;
  setError: (e: ErrorInfo | undefined) => void;
};

export const useDndStore = create<DndState>((set) => ({
  drag: undefined,
  dropTarget: undefined,
  placement: undefined,
  error: undefined,
  startDrag: (s) => {
    set({ drag: s, dropTarget: undefined, placement: undefined, error: undefined });
  },
  setDropTarget: (t, placement) => {
    set({ dropTarget: t, placement });
  },
  endDrag: () => {
    set({ drag: undefined, dropTarget: undefined, placement: undefined });
  },
  setError: (e) => {
    set({ error: e });
  },
}));
