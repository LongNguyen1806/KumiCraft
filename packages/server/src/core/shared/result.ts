// Error model of the server. The types come from @reactcraft/model (SPEC-03 section 8) so the
// Studio shares them; only the HTTP status of each code is a server concern.
import type { ErrorCode } from '@reactcraft/model';

export type { AppError, ErrorCode, ErrorDetail, Result } from '@reactcraft/model';
export { err, ok } from '@reactcraft/model';

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
