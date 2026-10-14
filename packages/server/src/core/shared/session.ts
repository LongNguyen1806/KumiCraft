// Session information returned by GET /api/v1/session (SPEC-03 section 5.1).
import type { FeatureId } from '@reactcraft/shared';

import type { AppError } from './result.ts';

export type Platform = 'win32' | 'darwin' | 'linux';

/** The error of a project that could not be opened, without the server-only `cause` (QC-51). */
export type PublicError = Omit<AppError, 'cause'>;

export type ProjectState =
  /** No project open; `suggestedPath` is the folder given to the CLI (R-PJ-18). */
  | { readonly state: 'none'; readonly suggestedPath?: string }
  | {
      readonly state: 'open';
      readonly id: string;
      readonly name: string;
      readonly trusted: boolean;
    }
  | { readonly state: 'error'; readonly error: PublicError };

export type SessionInfo = {
  readonly version: string;
  readonly platform: Platform;
  readonly features: readonly FeatureId[];
  readonly project: ProjectState;
};

export type SessionInfoInput = {
  readonly version: string;
  readonly platform: Platform;
  readonly features: readonly FeatureId[];
  readonly readProject: () => ProjectState;
};

/**
 * Creates the provider of {@link SessionInfo}. The project state is read on every call because it
 * changes while the server runs (opened, trusted, failed).
 */
export function createSessionInfoProvider(input: SessionInfoInput): () => SessionInfo {
  return () => ({
    version: input.version,
    platform: input.platform,
    features: input.features,
    project: input.readProject(),
  });
}

/** Narrows `process.platform` to the platforms ReactCraft supports. */
export function toSupportedPlatform(value: string): Platform | undefined {
  return value === 'win32' || value === 'darwin' || value === 'linux' ? value : undefined;
}

/** Drops `cause`, which never leaves the server (QC-51). */
export const toPublicError = ({ code, params, details }: AppError): PublicError => ({
  code,
  ...(params === undefined ? {} : { params }),
  ...(details === undefined ? {} : { details }),
});
