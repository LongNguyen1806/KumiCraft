// REST client of the Studio (ADR-FE-17): adds the session token, unwraps `{ data }`, turns
// `{ error }` into ApiError (SPEC-03 section 9.2).
import { readSessionToken } from './session-token.ts';

/** Failure of an API call: HTTP status, error code and parameter map. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly params: Readonly<Record<string, unknown>> | undefined;

  constructor(
    status: number,
    code: string | undefined,
    params?: Readonly<Record<string, unknown>>,
  ) {
    super(`API request failed with status ${String(status)}${code ? ` (${code})` : ''}`);
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value instanceof Object && !Array.isArray(value);

const readErrorInfo = (
  body: unknown,
): { code: string | undefined; params: Record<string, unknown> | undefined } => {
  if (!isRecord(body) || !isRecord(body['error'])) {
    return { code: undefined, params: undefined };
  }
  const errorObj = body['error'];
  const code = typeof errorObj['code'] === 'string' ? errorObj['code'] : undefined;
  const params = isRecord(errorObj['params']) ? errorObj['params'] : undefined;
  return { code, params };
};

function authHeaders(): Record<string, string> {
  const token = readSessionToken();
  return token === undefined ? {} : { Authorization: `Bearer ${token}` };
}

/** GET `/api/v1/<path>` and return the `data` member of the response. */
export async function apiGet(path: string): Promise<unknown> {
  const response = await fetch(`/api/v1/${path}`, {
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body)) {
    const { code, params } = readErrorInfo(body);
    throw new ApiError(response.status, code, params);
  }
  return body['data'];
}

/** Sends `payload` as JSON with `method` and returns the `data` member of the response. */
async function apiSend(
  method: 'POST' | 'PATCH',
  path: string,
  payload?: unknown,
): Promise<unknown> {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body)) {
    const { code, params } = readErrorInfo(body);
    throw new ApiError(response.status, code, params);
  }
  return body['data'];
}

/** POST `/api/v1/<path>` and return the `data` member of the response. */
export const apiPost = (path: string, payload?: unknown): Promise<unknown> =>
  apiSend('POST', path, payload);

/** PATCH `/api/v1/<path>` and return the `data` member of the response. */
export const apiPatch = (path: string, payload: unknown): Promise<unknown> =>
  apiSend('PATCH', path, payload);
