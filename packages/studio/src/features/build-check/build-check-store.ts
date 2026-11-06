// State of the on-demand build check (SPEC-04 M-BC, K9 stage C): the running job, the last
// result and whether the result panel is open.
import { type BuildCheckResult, BuildCheckResultSchema } from '@kumicraft/shared';
import { create } from 'zustand';

import { cancelJob, fetchJob } from '../../api/jobs-client.ts';
import { startBuildCheck } from '../../api/project-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';

export type BuildCheckState = {
  readonly jobId?: string | undefined;
  readonly result?: BuildCheckResult | undefined;
  readonly error?: ErrorInfo | undefined;
  readonly panelOpen: boolean;
  readonly start: () => Promise<void>;
  readonly cancel: () => void;
  /** The job ended: read its result (`completed`) or keep its error. */
  readonly finish: (jobId: string, error?: ErrorInfo) => Promise<void>;
  readonly setPanelOpen: (open: boolean) => void;
  readonly reset: () => void;
};

export const useBuildCheckStore = create<BuildCheckState>((set, get) => ({
  panelOpen: false,
  start: async () => {
    if (get().jobId !== undefined) return;
    set({ error: undefined });
    try {
      const { jobId } = await startBuildCheck();
      set({ jobId });
    } catch (error) {
      set({ error: toErrorInfo(error), panelOpen: true });
    }
  },
  cancel: () => {
    const { jobId } = get();
    if (jobId !== undefined) void cancelJob(jobId);
  },
  finish: async (jobId, error) => {
    if (get().jobId !== jobId) return;
    if (error !== undefined) {
      set({ jobId: undefined, error, panelOpen: true });
      return;
    }
    try {
      const status = await fetchJob(jobId);
      const parsed = BuildCheckResultSchema.safeParse(status.result);
      set(
        parsed.success
          ? { jobId: undefined, result: parsed.data, panelOpen: !parsed.data.ok }
          : { jobId: undefined, error: { code: 'E016' }, panelOpen: true },
      );
    } catch (cause) {
      set({ jobId: undefined, error: toErrorInfo(cause), panelOpen: true });
    }
  },
  setPanelOpen: (panelOpen) => {
    set({ panelOpen });
  },
  reset: () => {
    set({ jobId: undefined, result: undefined, error: undefined, panelOpen: false });
  },
}));
