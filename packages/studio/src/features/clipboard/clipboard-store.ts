// Clipboard state store for copy/cut/paste (SPEC-04 M-CB, R-CB-10..13).
import type { RelPath } from '@reactcraft/shared';
import { create } from 'zustand';

export type ClipboardEntry = {
  readonly text: string;
  readonly from?:
    | {
        readonly file: RelPath;
        readonly imports: string[];
      }
    | undefined;
  /**
   * False when the browser refused to write the system clipboard (focus in the Canvas iframe): the
   * system clipboard then still holds older text, so a paste must use this entry instead.
   */
  readonly inSystemClipboard?: boolean | undefined;
};

export type ClipboardStore = {
  readonly entry?: ClipboardEntry | undefined;
  readonly setEntry: (entry: ClipboardEntry) => void;
  readonly clear: () => void;
};

export const useClipboardStore = create<ClipboardStore>((set) => ({
  entry: undefined,
  setEntry: (entry) => {
    set({ entry });
  },
  clear: () => {
    set({ entry: undefined });
  },
}));
