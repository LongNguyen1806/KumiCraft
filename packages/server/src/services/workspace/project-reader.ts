// Project part of GET /session (SPEC-03 section 5.1), read from the service on every call.
import { type ProjectState, toPublicError } from '../../kernel/session.ts';
import type { ProjectService } from '../project/project-service.ts';

/** `dir` is the folder the CLI was started in, suggested while no project is open (R-PJ-18). */
export function createProjectReader(
  service: Pick<ProjectService, 'state'>,
  dir: string,
): () => ProjectState {
  return () => {
    const state = service.state();
    if (state.status === 'open') {
      return { state: 'open', id: state.file.id, name: state.file.name, trusted: state.trusted };
    }
    if (state.status === 'error') return { state: 'error', error: toPublicError(state.error) };
    return { state: 'none', suggestedPath: state.suggestedPath ?? dir };
  };
}
