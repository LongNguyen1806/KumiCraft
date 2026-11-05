// Tests for Bridge reverse proxy (SPEC-04 M-RN, Phase 4 K4).
import type http from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

import { BRIDGE_CLIENT_CODE, BRIDGE_CLIENT_URL } from '@kumicraft/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createBridgeProxy, patchCsp } from './bridge-proxy.ts';

const FIXTURE_ROOT = join(process.cwd(), 'fixtures/projects/express-pug');
const fixtureRequire = createRequire(join(FIXTURE_ROOT, 'package.json'));

type ResponseWithSend = http.ServerResponse & {
  send: (body: string) => void;
  redirect: (url: string) => void;
};

type TestExpressApp = {
  use: (middleware: unknown) => void;
  get: (path: string, handler: (req: http.IncomingMessage, res: ResponseWithSend) => void) => void;
  listen: (port: number, host: string, cb?: () => void) => http.Server;
};

describe('Bridge Proxy [WP-4.00]', () => {
  let appServer: http.Server;
  let appPort: number;
  let proxy: ReturnType<typeof createBridgeProxy>;
  let proxyPort: number;

  beforeEach(async () => {
    const express = fixtureRequire('express') as () => TestExpressApp;
    const helmet = fixtureRequire('helmet') as () => unknown;
    const compression = fixtureRequire('compression') as () => unknown;

    const app = express();
    app.use(helmet());
    app.use(compression());

    app.get('/', (_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.send(
        '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
      );
    });

    app.get('/style.css', (_req, res) => {
      res.setHeader('content-type', 'text/css; charset=utf-8');
      res.send('body { color: red; }');
    });

    app.get('/redirect', (_req, res) => {
      res.redirect(`http://127.0.0.1:${String(appPort)}/target`);
    });

    await new Promise<void>((resolve) => {
      appServer = app.listen(0, '127.0.0.1', () => {
        const addr = appServer.address() as AddressInfo;
        appPort = addr.port;
        resolve();
      });
    });

    proxy = createBridgeProxy({
      port: 0,
      appPort,
      nonce: 'studio-nonce-xyz',
      studioOrigin: 'http://127.0.0.1:4173',
      root: process.cwd(),
    });

    await proxy.start();
    const proxyAddr = proxy.server.address() as AddressInfo;
    proxyPort = proxyAddr.port;
  });

  afterEach(async () => {
    await proxy.close();
    await new Promise<void>((resolve) => {
      appServer.close(() => {
        resolve();
      });
    });
  });

  it('[WP-4.00] B2: CSP lets the Bridge in without breaking the app: a nonce, or self where inline scripts rely on unsafe-inline', () => {
    const studio = 'http://127.0.0.1:4311';
    // helmet's default: nonce added to script-src, frame-ancestors opened to the Studio only.
    expect(
      patchCsp("default-src 'self';script-src 'self';frame-ancestors 'self'", studio, 'N'),
    ).toBe(
      "default-src 'self'; script-src 'self' 'nonce-N'; frame-ancestors http://127.0.0.1:4311",
    );
    // A nonce would turn 'unsafe-inline' off and stop the app's inline scripts: add 'self'.
    expect(patchCsp("script-src 'unsafe-inline' https://cdn.test", studio, 'N')).toBe(
      "script-src 'unsafe-inline' https://cdn.test 'self'; frame-ancestors http://127.0.0.1:4311",
    );
    expect(patchCsp("script-src 'self' 'unsafe-inline'", studio, 'N')).toContain(
      "script-src 'self' 'unsafe-inline';",
    );
    // Already a nonce or hash: 'unsafe-inline' is ignored anyway, so the nonce is safe.
    expect(patchCsp("script-src 'unsafe-inline' 'sha256-abc'", studio, 'N')).toContain("'nonce-N'");
    // No script-src: default-src carries it.
    expect(patchCsp("default-src 'none'", studio, 'N')).toBe(
      "default-src 'none' 'nonce-N'; frame-ancestors http://127.0.0.1:4311",
    );
  });

  it('[WP-4.00] B2: Proxy (với app Express có helmet và compression): HTML trả về có thẻ Bridge, không có x-frame-options, CSP có frame-ancestors và nonce, không nén', async () => {
    const res = await fetch(`http://127.0.0.1:${String(proxyPort)}/`, {
      headers: { 'accept-encoding': 'gzip, deflate, br' },
    });

    expect(res.status).toBe(200);

    // Không nén (proxy gửi accept-encoding: identity lên app)
    const encoding = res.headers.get('content-encoding') ?? undefined;
    expect(encoding).toBeUndefined();

    // Không có x-frame-options
    const xFrame = res.headers.get('x-frame-options') ?? undefined;
    expect(xFrame).toBeUndefined();

    // CSP có frame-ancestors http://127.0.0.1:4173 và 'nonce-...'
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain('frame-ancestors http://127.0.0.1:4173');
    expect(csp).toMatch(/script-src[^;]*'nonce-[^']+'/);

    // HTML có thẻ Bridge được tiêm vào <head>
    const html = await res.text();
    expect(html).toContain('id="__rc_bridge"');
    expect(html).toContain(BRIDGE_CLIENT_URL);
    expect(html).toContain('"navigation":"document"');
    expect(html).toContain('"studioOrigin":"http://127.0.0.1:4173"');
    expect(html).toMatch(/<head>\s*<script type="application\/json" id="__rc_bridge"/);
  });

  it('[WP-4.00] B3: Proxy: /style.css chuyển nguyên văn đúng content-type; redirect Location đổi về origin của request; BRIDGE_CLIENT_URL trả mã Bridge', async () => {
    // 1. /style.css chuyển nguyên văn đúng content-type
    const cssRes = await fetch(`http://127.0.0.1:${String(proxyPort)}/style.css`);
    expect(cssRes.status).toBe(200);
    const cssType = cssRes.headers.get('content-type') ?? '';
    expect(cssType).toContain('text/css');
    const cssText = await cssRes.text();
    expect(cssText).toBe('body { color: red; }');

    // 2. redirect Location đổi về origin của request
    const redirRes = await fetch(`http://127.0.0.1:${String(proxyPort)}/redirect`, {
      redirect: 'manual',
    });
    expect(redirRes.status).toBe(302);
    const location = redirRes.headers.get('location') ?? '';
    expect(location).toBe(`http://127.0.0.1:${String(proxyPort)}/target`);

    // 3. BRIDGE_CLIENT_URL trả mã Bridge
    const bridgeRes = await fetch(`http://127.0.0.1:${String(proxyPort)}${BRIDGE_CLIENT_URL}`);
    expect(bridgeRes.status).toBe(200);
    const bridgeType = bridgeRes.headers.get('content-type') ?? '';
    expect(bridgeType).toContain('text/javascript');
    const bridgeCode = await bridgeRes.text();
    expect(bridgeCode).toBe(BRIDGE_CLIENT_CODE);
  });
});
