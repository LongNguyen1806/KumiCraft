import { create } from 'zustand';

type TextEditState = {
  readonly editingNodeId?: string | undefined;
  readonly session: number;
  /** Finished edits per node; the node's element remounts when its count changes. */
  readonly endedSessions: Readonly<Record<string, number>>;
  readonly originalText: string;
  readonly statusNotice?: string | undefined;
  readonly startEdit: (nodeId: string, originalText: string) => void;
  readonly endEdit: () => void;
  readonly setStatusNotice: (notice: string | undefined) => void;
};

let statusTimer: ReturnType<typeof setTimeout> | undefined;

export const useTextEditStore = create<TextEditState>((set) => ({
  editingNodeId: undefined,
  session: 0,
  endedSessions: {},
  originalText: '',
  statusNotice: undefined,

  startEdit: (nodeId: string, originalText: string) => {
    set({ editingNodeId: nodeId, originalText });
  },

  endEdit: () => {
    set((state) => {
      const id = state.editingNodeId;
      return {
        editingNodeId: undefined,
        session: state.session + 1,
        originalText: '',
        endedSessions:
          id === undefined
            ? state.endedSessions
            : { ...state.endedSessions, [id]: (state.endedSessions[id] ?? 0) + 1 },
      };
    });
  },

  setStatusNotice: (notice: string | undefined) => {
    if (statusTimer !== undefined) {
      clearTimeout(statusTimer);
      statusTimer = undefined;
    }
    set({ statusNotice: notice });
    if (notice !== undefined) {
      statusTimer = setTimeout(() => {
        set({ statusNotice: undefined });
      }, 3000);
    }
  },
}));
