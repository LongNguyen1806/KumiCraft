// Workspace part of GET /session (SPEC-03 section 10.1), read from the service on every call.
import type { DesignStore } from '../design-store/design-store.ts';
import type { WorkspaceState } from '../shared/session.ts';
import type { WorkspaceService } from './workspace-service.ts';

/** `dir` is the folder the CLI was started in, shown while there is no workspace. */
export function createWorkspaceReader(
  service: WorkspaceService,
  getStore: () => DesignStore | undefined,
  dir: string,
): () => WorkspaceState {
  return () => {
    const state = service.state();
    if (state.status === 'open') {
      const store = getStore();
      return {
        state: 'open',
        id: state.document.workspace.id,
        name: state.document.workspace.name,
        revision: store ? store.revision() : state.document.workspace.revision,
        trusted: state.trusted,
      };
    }
    if (state.status === 'error') {
      const problems = state.problems.map((problem) => ({
        file: problem.file,
        code: problem.error.code,
      }));
      const first = state.problems[0]?.error;
      return {
        state: 'error',
        error: { code: first?.code ?? 'E003', ...(first?.params ? { params: first.params } : {}) },
        problems,
      };
    }
    return { state: 'none', directory: dir };
  };
}
