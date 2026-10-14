// Project endpoints (SPEC-03 section 5.3). Open, create, install and backends come with WP-1.03.
import { apiPost } from './http.ts';
import type { SessionInfo } from './session.ts';

/** S-80: saves the trust decision for the open project and returns the new session. */
export async function setProjectTrust(trusted: boolean): Promise<SessionInfo> {
  return (await apiPost('project/trust', { trusted })) as SessionInfo;
}
