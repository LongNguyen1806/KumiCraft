// Session information returned by GET /api/v1/session (SPEC-03 section 10.1).
import type { FeatureId } from '@reactcraft/model';

import type { AppError } from './result.ts';

export type Platform = 'win32' | 'darwin' | 'linux';

export type WorkspaceState =
  | { readonly state: 'none'; readonly directory: string }
  | {
      readonly state: 'open';
      readonly id: string;
      readonly name: string;
      readonly revision: number;
      readonly trusted: boolean;
    }
  | { readonly state: 'error'; readonly error: AppError };

export type SessionInfo = {
  readonly version: string;
  readonly workspace: WorkspaceState;
  readonly platform: Platform;
  readonly features: readonly FeatureId[];
};

export type SessionInfoInput = {
  readonly version: string;
  readonly platform: Platform;
  readonly features: readonly FeatureId[];
  readonly readWorkspace: () => WorkspaceState;
};

/**
 * Creates the provider of {@link SessionInfo}. The workspace state is read on every call because it
 * changes while the server runs (opened, locked, failed).
 */
export function createSessionInfoProvider(input: SessionInfoInput): () => SessionInfo {
  return () => ({
    version: input.version,
    workspace: input.readWorkspace(),
    platform: input.platform,
    features: input.features,
  });
}

/** Narrows `process.platform` to the platforms ReactCraft supports (ADR-BE-05). */
export function toSupportedPlatform(value: string): Platform | undefined {
  return value === 'win32' || value === 'darwin' || value === 'linux' ? value : undefined;
}
