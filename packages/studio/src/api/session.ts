// GET /session (SPEC-03 section 5.1): which screen the Studio shows follows the project state.
import type { FeatureId } from '@reactcraft/shared';

import { ApiError, apiGet, isRecord } from './http.ts';

export type ProjectState =
  | { readonly state: 'none'; readonly suggestedPath?: string }
  | {
      readonly state: 'open';
      readonly id: string;
      readonly name: string;
      readonly trusted: boolean;
    }
  | {
      readonly state: 'error';
      readonly error: {
        readonly code: string;
        readonly params?: Readonly<Record<string, unknown>>;
        readonly details?: readonly { readonly message: string }[];
      };
    };

export type SessionInfo = {
  readonly version: string;
  readonly platform: 'win32' | 'darwin' | 'linux';
  readonly features: readonly FeatureId[];
  readonly project: ProjectState;
};

export async function fetchSession(): Promise<SessionInfo> {
  const data = await apiGet('session');
  if (!isRecord(data) || typeof data['version'] !== 'string' || !isRecord(data['project'])) {
    throw new ApiError(200, undefined);
  }
  return data as unknown as SessionInfo;
}
