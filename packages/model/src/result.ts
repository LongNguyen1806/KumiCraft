// Result and error types shared by the server, the Studio and the model (SPEC-03 section 8,
// SPEC-02 QC-48 to QC-51). The server maps codes to HTTP statuses; the Studio translates them.

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

/** One sub-error: a rule broken at a path, or one type-check error of an exported file. */
export type ErrorDetail = {
  readonly path?: string;
  readonly line?: number;
  readonly column?: number;
  /** Rule code, for example `V-14`. */
  readonly rule?: string;
  /** English, for developers. The Studio shows a translated message for the rule or code. */
  readonly message: string;
};

/** Business error. `cause` stays on the server and is never sent to the Studio (QC-51). */
export type AppError = {
  readonly code: ErrorCode;
  readonly params?: Readonly<Record<string, string | number | boolean>>;
  readonly details?: readonly ErrorDetail[];
  readonly cause?: unknown;
};

/** Outcome of an operation that can fail for business reasons (QC-48). */
export type Result<T, E extends AppError = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E extends AppError>(error: E): Result<never, E> => ({ ok: false, error });
