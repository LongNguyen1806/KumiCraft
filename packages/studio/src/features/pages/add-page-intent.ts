import { create } from 'zustand';

export type AddPageIntentState = {
  readonly targetDir?: string | undefined;
  readonly setTargetDir: (targetDir?: string) => void;
};

export const useAddPageIntent = create<AddPageIntentState>((set) => ({
  targetDir: undefined,
  setTargetDir: (targetDir) => {
    set({ targetDir });
  },
}));
