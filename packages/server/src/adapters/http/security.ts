// Network security of the Local Backend (SPEC-05 sections 5 and 6): loopback only, Host and Origin
// checks, session token on every API request, browser security headers.
import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { AppError } from '../../core/shared/result.ts';
import { sendError } from './send-error.ts';

export type SecurityOptions = {
  readonly port: number;
  readonly sessionToken: string;
  /** Origins trusted like the server's own, for example the Vite dev server of `pnpm dev`. */
  readonly trustedOrigins: readonly string[];
};

type Rejection = { readonly error: AppError; readonly status?: number };

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::ffff:127.0.0.1']);
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_BODY_TYPES = ['application/json', 'multipart/form-data'];
const CANVAS_FRAME_PATH = '/canvas-frame.html';
const BEARER_PREFIX = 'Bearer ';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** S-07: constant-time comparison. Hashing first gives the equal-length inputs it needs. */
export function isTokenValid(authorization: string | undefined, sessionToken: string): boolean {
  if (authorization?.startsWith(BEARER_PREFIX) !== true) return false;
  return timingSafeEqual(digest(authorization.slice(BEARER_PREFIX.length)), digest(sessionToken));
}

/** S-10, S-11, S-12. The canvas iframe may be framed by the Studio itself, nothing else may be. */
export function securityHeaders(port: number, path: string): Readonly<Record<string, string>> {
  const isCanvasFrame = path === CANVAS_FRAME_PATH;
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https: http:",
    "font-src 'self'",
    `connect-src 'self' ws://127.0.0.1:${String(port)} ws://localhost:${String(port)}`,
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    isCanvasFrame ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(isCanvasFrame ? {} : { 'X-Frame-Options': 'DENY' }),
  };
}

function allowedSets(options: SecurityOptions) {
  const port = String(options.port);
  const origins = [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    ...options.trustedOrigins,
  ];
  return {
    hosts: new Set(origins.map((origin) => new URL(origin).host.toLowerCase())),
    origins: new Set(origins.map((origin) => new URL(origin).origin.toLowerCase())),
  };
}

function checkRequest(
  request: FastifyRequest,
  options: SecurityOptions,
  allowed: ReturnType<typeof allowedSets>,
): Rejection | undefined {
  // S-04: a DNS-rebinding page reaches 127.0.0.1 but still carries its own Host.
  const host = request.headers.host?.toLowerCase();
  if (host === undefined || !allowed.hosts.has(host)) {
    return { error: { code: 'E014' }, status: 421 };
  }
  if (!request.url.startsWith('/api/')) return undefined; // S-08: static Studio files

  const origin = request.headers.origin?.toLowerCase();
  if (origin !== undefined && !allowed.origins.has(origin)) {
    return { error: { code: 'E014' } }; // S-04a
  }
  if (STATE_CHANGING_METHODS.has(request.method)) {
    const contentType = request.headers['content-type']?.toLowerCase() ?? '';
    if (!ALLOWED_BODY_TYPES.some((type) => contentType.startsWith(type))) {
      return {
        error: { code: 'E016', details: [{ message: 'Content-Type must be application/json' }] },
      }; // S-04c: an HTML form of another site cannot send a "simple request"
    }
  }
  if (!isTokenValid(request.headers.authorization, options.sessionToken)) {
    return { error: { code: 'E014' } }; // S-07
  }
  return undefined;
}

/** Registers every network measure. Must run before any route is registered. */
export function registerSecurity(app: FastifyInstance, options: SecurityOptions): void {
  const allowed = allowedSets(options);

  // S-01: defence in depth on top of listening on 127.0.0.1 only.
  app.server.on('connection', (socket) => {
    if (!LOOPBACK_ADDRESSES.has(socket.remoteAddress ?? '')) socket.destroy();
  });

  app.addHook('onRequest', (request, reply, done) => {
    const path = request.url.split('?')[0] ?? request.url;
    void reply.headers(securityHeaders(options.port, path));
    const rejection = checkRequest(request, options, allowed);
    if (rejection === undefined) {
      done();
      return;
    }
    void sendError(reply, rejection.error, rejection.status);
  });
}
