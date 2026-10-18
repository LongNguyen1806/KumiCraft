// Zustand store for shortcut help dialog visibility (R-KB-12).
import { create } from 'zustand';

export type ShortcutHelpStore = {
  readonly isOpen: boolean;
  readonly open: () => void;
  readonly close: () => void;
  readonly toggle: () => void;
};

export const useShortcutHelpStore = create<ShortcutHelpStore>((set) => ({
  isOpen: false,
  open: () => {
    set({ isOpen: true });
  },
  close: () => {
    set({ isOpen: false });
  },
  toggle: () => {
    set((s) => ({ isOpen: !s.isOpen }));
  },
}));
