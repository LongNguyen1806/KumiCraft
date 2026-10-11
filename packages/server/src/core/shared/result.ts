// Error model shared by core services and adapters (SPEC-03 section 8, SPEC-02 QC-48 to QC-51).

/** Error codes of SPEC-03 section 13. */
export type ErrorCode =
  | 'E001'
  | 'E002'
  | 'E003'
  | 'E004'
  | 'E005'
  | 'E006'
  | 'E007'
  | 'E008'
  | 'E009'
  | 'E010'
  | 'E011'
  | 'E012'
  | 'E013'
  | 'E014'
  | 'E015'
  | 'E016'
  | 'E017'
  | 'E018'
  | 'E019'
  | 'E020'
  | 'E021'
  | 'E022';

/** One sub-error, for example one type-check error of an exported file. */
export type ErrorDetail = {
  readonly path?: string;
  readonly line?: number;
  readonly column?: number;
  readonly rule?: string;
  readonly message: string;
};

/** Business error. `cause` stays on the server and is never sent to the Studio (QC-51). */
export type AppError = {
  readonly code: ErrorCode;
  readonly params?: Readonly<Record<string, string | number | boolean>>;
  readonly details?: readonly ErrorDetail[];
  readonly cause?: unknown;
};

/** Outcome of a core operation that can fail for business reasons (QC-48). */
export type Result<T, E extends AppError = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** HTTP status of each error code (SPEC-03 section 13). */
export const HTTP_STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  E001: 422,
  E002: 500,
  E003: 500,
  E004: 422,
  E005: 422,
  E006: 500,
  E007: 502,
  E008: 502,
  E009: 422,
  E010: 409,
  E011: 403,
  E012: 403,
  E013: 500,
  E014: 401,
  E015: 404,
  E016: 400,
  E017: 409,
  E018: 409,
  E019: 499,
  E020: 504,
  E021: 409,
  E022: 502,
};

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E extends AppError>(error: E): Result<never, E> => ({ ok: false, error });
