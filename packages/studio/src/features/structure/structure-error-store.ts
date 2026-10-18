// Zustand store for structure action errors, warnings, and active source (SPEC-04 R-SE-21, R-SE-24..28).
import { create } from 'zustand';

import type { ErrorInfo } from '../../routes/error-text.ts';

export type StructureErrorState = {
  readonly targetKey: string;
  readonly info: ErrorInfo;
};

export type ActiveSourceInfo = {
  readonly loc: string;
  readonly tag: string;
};

export type StructureStore = {
  readonly error?: StructureErrorState | undefined;
  readonly warnings: readonly string[];
  readonly activeSource?: ActiveSourceInfo | undefined;
  readonly setError: (error?: StructureErrorState) => void;
  readonly clearError: () => void;
  readonly setWarnings: (warnings: readonly string[]) => void;
  readonly setActiveSource: (source?: ActiveSourceInfo) => void;
};

export const useStructureErrorStore = create<StructureStore>((set) => ({
  error: undefined,
  warnings: [],
  activeSource: undefined,
  setError: (error) => {
    set({ error });
  },
  clearError: () => {
    set({ error: undefined });
  },
  setWarnings: (warnings) => {
    set({ warnings });
  },
  setActiveSource: (activeSource) => {
    set({ activeSource });
  },
}));
