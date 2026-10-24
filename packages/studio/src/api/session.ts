// GET /session (SPEC-03 section 5.1): which screen the Studio shows follows the project state.
import { type ProjectState, type SessionInfo, SessionInfoSchema } from '@kumicraft/shared';

import { apiGet, parseResponse } from './http.ts';

export type { ProjectState, SessionInfo };

export async function fetchSession(): Promise<SessionInfo> {
  return parseResponse(SessionInfoSchema, await apiGet('session'));
}
