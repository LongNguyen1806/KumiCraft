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

function isProjectState(value: unknown): value is ProjectState {
  if (!isRecord(value) || typeof value['state'] !== 'string') return false;
  if (value['state'] === 'none') {
    return value['suggestedPath'] === undefined || typeof value['suggestedPath'] === 'string';
  }
  if (value['state'] === 'open') {
    return (
      typeof value['id'] === 'string' &&
      typeof value['name'] === 'string' &&
      typeof value['trusted'] === 'boolean'
    );
  }
  if (value['state'] === 'error') {
    return isRecord(value['error']) && typeof value['error']['code'] === 'string';
  }
  return false;
}

function isPlatform(value: unknown): value is 'win32' | 'darwin' | 'linux' {
  return value === 'win32' || value === 'darwin' || value === 'linux';
}

function isSessionInfo(data: unknown): data is SessionInfo {
  return (
    isRecord(data) &&
    typeof data['version'] === 'string' &&
    isPlatform(data['platform']) &&
    Array.isArray(data['features']) &&
    isProjectState(data['project'])
  );
}

export async function fetchSession(): Promise<SessionInfo> {
  const data = await apiGet('session');
  if (!isSessionInfo(data)) {
    throw new ApiError(200, undefined);
  }
  return data;
}
