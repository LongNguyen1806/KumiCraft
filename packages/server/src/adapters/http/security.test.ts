import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHttpApp } from './create-http-app.ts';
import { isTokenValid, securityHeaders } from './security.ts';

const PORT = 50123;
const TOKEN = 'test-token';
const HOST = `127.0.0.1:${String(PORT)}`;
const AUTH = { authorization: `Bearer ${TOKEN}` };

let app: FastifyInstance;

beforeEach(async () => {
  app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: TOKEN, trustedOrigins: ['http://127.0.0.1:5173'] },
    getSessionInfo: () => ({
      version: '0.0.0',
      platform: 'linux',
      features: [],
      project: { state: 'none', suggestedPath: '/w' },
    }),
  });
});

afterEach(async () => {
  await app.close();
});

const getSession = (headers: Record<string, string>) =>
  app.inject({ method: 'GET', url: '/api/v1/session', headers: { host: HOST, ...headers } });

const errorCode = (body: string): unknown =>
  (JSON.parse(body) as { error?: { code?: string } }).error?.code;

describe('session token', () => {
  it('accepts only the exact bearer token [S-07]', () => {
    expect(isTokenValid(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(isTokenValid(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
    expect(isTokenValid(TOKEN, TOKEN)).toBe(false);
    expect(isTokenValid(undefined, TOKEN)).toBe(false);
  });

  it('rejects API requests without a valid token with E014 [S-07]', async () => {
    const missing = await getSession({});
    const wrong = await getSession({ authorization: 'Bearer nope' });
    const right = await getSession(AUTH);

    expect([missing.statusCode, errorCode(missing.body)]).toEqual([401, 'E014']);
    expect([wrong.statusCode, errorCode(wrong.body)]).toEqual([401, 'E014']);
    expect(right.statusCode).toBe(200);
  });

  it('serves non-API paths without a token [S-08]', async () => {
    const response = await app.inject({ method: 'GET', url: '/', headers: { host: HOST } });

    expect(response.statusCode).not.toBe(401);
  });
});

describe('Host and Origin', () => {
  it('rejects a foreign Host with 421 E014 to stop DNS rebinding [S-04]', async () => {
    const response = await getSession({ ...AUTH, host: 'evil.example' });

    expect([response.statusCode, errorCode(response.body)]).toEqual([421, 'E014']);
  });

  it('accepts localhost and trusted dev origins as Host [S-04]', async () => {
    const localhost = await getSession({ ...AUTH, host: `localhost:${String(PORT)}` });
    const devServer = await getSession({ ...AUTH, host: '127.0.0.1:5173' });

    expect([localhost.statusCode, devServer.statusCode]).toEqual([200, 200]);
  });

  it('rejects a foreign Origin on API requests [S-04a]', async () => {
    const response = await getSession({ ...AUTH, origin: 'https://evil.example' });

    expect([response.statusCode, errorCode(response.body)]).toEqual([401, 'E014']);
  });

  it('rejects state-changing requests that are not JSON, form uploads included [S-04c]', async () => {
    for (const contentType of ['text/plain', 'multipart/form-data; boundary=x']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/session',
        headers: { host: HOST, ...AUTH, 'content-type': contentType },
        payload: 'x',
      });

      expect([response.statusCode, errorCode(response.body)]).toEqual([400, 'E016']);
    }
  });

  it('sends no CORS headers [S-04b]', async () => {
    const response = await getSession({ ...AUTH, origin: 'http://127.0.0.1:5173' });

    expect(Object.keys(response.headers).some((name) => name.startsWith('access-control-'))).toBe(
      false,
    );
  });
});

describe('security headers', () => {
  it('sets CSP and the common browser headers on every response [S-10, S-11]', async () => {
    const response = await getSession(AUTH);

    expect(response.headers['content-security-policy']).toContain(`ws://127.0.0.1:${String(PORT)}`);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(response.headers['permissions-policy']).toContain('camera=()');
  });

  it('lets the Studio frame only the dev server on 127.0.0.1, and nothing frame the Studio [S-10, S-12]', async () => {
    const response = await getSession(AUTH);
    const csp = String(response.headers['content-security-policy']);

    expect(csp).toContain('frame-src http://127.0.0.1:* http://*.localhost:*');
    // Login sessions (spec-log #76): Studio probes and frames s<n>.localhost, still this machine only.
    expect(csp).toContain('http://*.localhost:*');
    expect(csp).not.toMatch(/frame-src[^;]*https?:\/\/\*[;: ]/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/img-src[^;]*https?:/);
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(securityHeaders(PORT)['X-Frame-Options']).toBe('DENY');
  });
});

describe('error responses', () => {
  it('answers unknown API routes with E015 and a request id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/nope',
      headers: { host: HOST, ...AUTH },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: 'E015' } });
    expect(response.headers['x-request-id']).toMatch(/^req_/);
  });

  it('answers malformed JSON with E016', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/session',
      headers: { host: HOST, ...AUTH, 'content-type': 'application/json' },
      payload: '{bad',
    });

    expect([response.statusCode, errorCode(response.body)]).toEqual([400, 'E016']);
  });
});
