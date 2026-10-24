// Store for Canvas build errors and runtime errors (SPEC-04 M-RN, R-RN-25).
import type { BridgeBuildErrorPayload, BridgeRuntimeErrorPayload } from '@kumicraft/shared';
import { create } from 'zustand';

export type RuntimeErrorEntry = {
  readonly message: string;
  readonly stack?: string | undefined;
  readonly count: number;
};

export const MAX_RUNTIME_ERRORS = 5;

export type CanvasErrorState = {
  readonly buildError?: BridgeBuildErrorPayload | undefined;
  readonly runtimeErrors: readonly RuntimeErrorEntry[];
  readonly setBuildError: (payload: BridgeBuildErrorPayload) => void;
  readonly clearBuildError: () => void;
  readonly addRuntimeError: (payload: BridgeRuntimeErrorPayload) => void;
  readonly dismissRuntimeErrors: () => void;
  readonly reset: () => void;
};

export const useCanvasErrorStore = create<CanvasErrorState>((set) => ({
  buildError: undefined,
  runtimeErrors: [],
  setBuildError: (payload) => {
    set({ buildError: payload });
  },
  clearBuildError: () => {
    set({ buildError: undefined });
  },
  addRuntimeError: (payload) => {
    set((state) => {
      const existing = state.runtimeErrors.find((item) => item.message === payload.message);
      const newEntry: RuntimeErrorEntry = {
        message: payload.message,
        stack: payload.stack,
        count: existing !== undefined ? existing.count + 1 : 1,
      };
      const remaining = state.runtimeErrors.filter((item) => item.message !== payload.message);
      return {
        runtimeErrors: [newEntry, ...remaining].slice(0, MAX_RUNTIME_ERRORS),
      };
    });
  },
  dismissRuntimeErrors: () => {
    set({ runtimeErrors: [] });
  },
  reset: () => {
    set({ buildError: undefined, runtimeErrors: [] });
  },
}));
