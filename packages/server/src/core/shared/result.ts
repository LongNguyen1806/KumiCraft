// Error model of the server. The types come from @reactcraft/shared (SPEC-03 section 4.1) so the
// Studio shares them; only the HTTP status of each code is a server concern.
import type { ErrorCode } from '@reactcraft/shared';

export type { AppError, ErrorCode, ErrorDetail, Result } from '@reactcraft/shared';
export { err, ok } from '@reactcraft/shared';

/** HTTP status of each error code (SPEC-03 section 10). */
export const HTTP_STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  E001: 422,
  E002: 500,
  E003: 500,
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
  E023: 422,
  E024: 422,
  E025: 502,
  E026: 409,
  E027: 502,
  E028: 502,
};
