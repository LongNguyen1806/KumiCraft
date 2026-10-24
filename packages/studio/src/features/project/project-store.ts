// Store to share ProjectInfo loaded by editor-shell (Phase 3 Round S1).
import type { ProjectInfo } from '@kumicraft/shared';
import { create } from 'zustand';

export interface ProjectStoreState {
  readonly project: ProjectInfo | undefined;
  setProject: (project: ProjectInfo | undefined) => void;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  project: undefined,
  setProject: (project) => {
    set({ project });
  },
}));

export function useProjectInfo(): ProjectInfo | undefined {
  return useProjectStore((s) => s.project);
}
