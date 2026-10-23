// REST calls of the MCP session to the running ReactCraft server, with its session token (S-07).
import type { ServerAddress } from './server-locator.ts';

export type ApiResult =
  { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly message: string };

export type ApiClient = {
  get(path: string, query?: Readonly<Record<string, string>>): Promise<ApiResult>;
  post(path: string, body: unknown): Promise<ApiResult>;
  patch(path: string, body: unknown): Promise<ApiResult>;
};

export type ApiClientDeps = {
  readonly locate: () => Promise<ServerAddress | undefined>;
  readonly projectDir: string;
  readonly fetch?: typeof fetch | undefined;
  readonly timeoutMs?: number | undefined;
};

/** Short English words for the codes an agent meets; the code itself always comes first. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  E011: 'The project is not trusted yet. Trust it in the ReactCraft Studio first.',
  E014: 'ReactCraft refused the session. Restart ReactCraft and try again.',
  E015: 'Not found.',
  E016: 'The request is not valid.',
  E017: 'The source changed since it was read. Read it again.',
  E021: 'No project is open. Open a project in the ReactCraft Studio first.',
  E023: 'This element or file cannot be read or edited with tools.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && Boolean(value) && !Array.isArray(value);

function describeError(body: unknown, status: number): string {
  const error = isRecord(body) && isRecord(body['error']) ? body['error'] : undefined;
  const code = typeof error?.['code'] === 'string' ? error['code'] : `HTTP ${String(status)}`;
  const params = isRecord(error?.['params']) ? ` ${JSON.stringify(error['params'])}` : '';
  return `${code}: ${CODE_MESSAGES[code] ?? 'ReactCraft refused the request.'}${params}`;
}

export function createApiClient(deps: ApiClientDeps): ApiClient {
  const doFetch = deps.fetch ?? fetch;
  const notRunning = `No ReactCraft session has the project ${deps.projectDir} open. Start ReactCraft ("npx reactcraft"), open this project and trust it.`;

  const send = async (
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
  ): Promise<ApiResult> => {
    const address = await deps.locate();
    if (address === undefined) return { ok: false, message: notRunning };
    try {
      const response = await doFetch(`http://127.0.0.1:${String(address.port)}/api/v1/${path}`, {
        method,
        headers: {
          authorization: `Bearer ${address.token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(deps.timeoutMs ?? 15_000),
      });
      const parsed: unknown = await response.json().catch(() => undefined);
      if (!response.ok) return { ok: false, message: describeError(parsed, response.status) };
      return { ok: true, data: isRecord(parsed) ? parsed['data'] : undefined };
    } catch {
      return { ok: false, message: notRunning };
    }
  };

  return {
    get(path, query) {
      const search = query === undefined ? '' : `?${new URLSearchParams(query).toString()}`;
      return send('GET', `${path}${search}`);
    },
    post(path, body) {
      return send('POST', path, body);
    },
    patch(path, body) {
      return send('PATCH', path, body);
    },
  };
}
