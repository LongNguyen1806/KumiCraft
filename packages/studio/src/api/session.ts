import type { FeatureId } from '@reactcraft/model';

import { ApiError, apiGet, isRecord } from './http.ts';

export type StudioWorkspaceState =
  | { readonly state: 'none'; readonly directory?: string }
  | {
      readonly state: 'open';
      readonly id: string;
      readonly name: string;
      readonly revision: number;
      readonly trusted: boolean;
    }
  | {
      readonly state: 'error';
      readonly error?: { readonly code: string };
      /** Every file that stops the workspace from opening (R-WS-01, R-WS-02). */
      readonly problems?: readonly WorkspaceProblem[];
    };

export type WorkspaceProblem = { readonly file: string; readonly code: string };

export type SessionInfo = {
  readonly version: string;
  readonly workspace: StudioWorkspaceState;
  readonly platform?: 'win32' | 'darwin' | 'linux';
  readonly features?: readonly FeatureId[];
};

/** Part of SessionInfo the Studio uses so far. */
export type SessionSummary = {
  readonly version: string;
};

export async function fetchSession(): Promise<SessionInfo> {
  const data = await apiGet('session');
  if (!isRecord(data) || typeof data['version'] !== 'string') {
    throw new ApiError(200, undefined);
  }
  return data as unknown as SessionInfo;
}
