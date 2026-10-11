// Client of GET /api/v1/session (SPEC-03 section 10.1). Components call this module, never fetch.
import { ApiError, apiGet, isRecord } from './http.ts';

/** Part of SessionInfo the Studio uses so far. */
export type SessionSummary = {
  readonly version: string;
};

export async function fetchSession(): Promise<SessionSummary> {
  const data = await apiGet('session');
  if (!isRecord(data) || typeof data['version'] !== 'string') {
    throw new ApiError(200, undefined);
  }
  return { version: data['version'] };
}
