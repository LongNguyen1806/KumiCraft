// REST client of the Studio (ADR-FE-17): adds the session token, unwraps `{ data }`, turns
// `{ error }` into ApiError (SPEC-03 section 9.2).
import { readSessionToken } from './session-token.ts';

/** Failure of an API call: HTTP status and, when the server sent one, its E0xx code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined) {
    super(`API request failed with status ${String(status)}${code ? ` (${code})` : ''}`);
    this.status = status;
    this.code = code;
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value instanceof Object && !Array.isArray(value);

const readErrorCode = (body: unknown): string | undefined => {
  if (!isRecord(body) || !isRecord(body['error'])) return undefined;
  const code = body['error']['code'];
  return typeof code === 'string' ? code : undefined;
};

/** GET `/api/v1/<path>` and return the `data` member of the response. */
export async function apiGet(path: string): Promise<unknown> {
  const token = readSessionToken();
  const response = await fetch(`/api/v1/${path}`, {
    headers: {
      Accept: 'application/json',
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
  });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body)) {
    throw new ApiError(response.status, readErrorCode(body));
  }
  return body['data'];
}
