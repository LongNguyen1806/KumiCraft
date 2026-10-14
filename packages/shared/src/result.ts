// Result and error types shared by the server and the Studio (SPEC-03 sections 4.1 and 10,
// SPEC-02 section 5). The server maps codes to HTTP statuses; the Studio translates them.

/** Error codes of SPEC-03 section 10. E004 to E010 and E022 are retired and never reused (V-81). */
export const ERROR_CODES = [
  'E001',
  'E002',
  'E003',
  'E011',
  'E012',
  'E013',
  'E014',
  'E015',
  'E016',
  'E017',
  'E018',
  'E019',
  'E020',
  'E021',
  'E023',
  'E024',
  'E025',
  'E026',
  'E027',
  'E028',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** One sub-error: a rule broken at a path, or a syntax error at a line of a file. */
export type ErrorDetail = {
  readonly path?: string;
  readonly line?: number;
  readonly column?: number;
  /** Rule code, for example `V-100`. */
  readonly rule?: string;
  /** English, for developers. The Studio shows a translated message for the code. */
  readonly message: string;
};

/** Business error. `cause` stays on the server and is never sent to the Studio (QC-51). */
export type AppError = {
  readonly code: ErrorCode;
  readonly params?: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  readonly details?: readonly ErrorDetail[];
  readonly cause?: unknown;
};

/** Outcome of an operation that can fail for business reasons (QC-48). */
export type Result<T, E extends AppError = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E extends AppError>(error: E): Result<never, E> => ({ ok: false, error });

/** Zod issues as error details: the dotted path of the field and the message. */
export function issuesToDetails(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
): ErrorDetail[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}
