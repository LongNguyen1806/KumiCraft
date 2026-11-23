// Tests for Bridge reverse proxy (SPEC-04 M-RN, Phase 4 K4).
import http from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

import { BRIDGE_CLIENT_CODE, BRIDGE_CLIENT_URL } from '@kumicraft/bridge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createBridgeProxy, isLocalHost, patchCsp, patchSetCookie } from './bridge-proxy.ts';

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

  it('[S-04, K9.5] answers only names of this machine: a DNS-rebinding Host gets 403', async () => {
    expect(
      ['127.0.0.1:3000', 'localhost:3000', 's1.localhost:3000', 'LOCALHOST'].map(isLocalHost),
    ).toEqual([true, true, true, true]);
    expect(
      ['evil.example:3000', 'localhost.evil.example', '192.168.1.13:3000', undefined].map(
        isLocalHost,
      ),
    ).toEqual([false, false, false, false]);
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port: proxyPort, path: '/', headers: { Host: 'evil.example' } },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(403);
  });

  it('rewrites Set-Cookie for localhost/subdomains so SameSite=Strict/Lax cookies work in the iframe', async () => {
    expect(patchSetCookie('af=1; path=/; samesite=strict; httponly')).toBe(
      'af=1; path=/; SameSite=None; httponly; Secure',
    );
    expect(patchSetCookie('sid=2; Path=/; HttpOnly')).toBe(
      'sid=2; Path=/; HttpOnly; SameSite=None; Secure',
    );
    expect(patchSetCookie('x=3; Path=/; SameSite=Lax; Secure')).toBe(
      'x=3; Path=/; SameSite=None; Secure',
    );

    const cookieApp = http.createServer((_req, res) => {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': ['af=abc; path=/; samesite=strict; httponly', 'td=xyz; path=/'],
      });
      res.end('<!DOCTYPE html><html><head></head><body>ok</body></html>');
    });
    await new Promise<void>((resolve) => {
      cookieApp.listen(0, '127.0.0.1', resolve);
    });
    const cPort = (cookieApp.address() as AddressInfo).port;
    const cProxy = createBridgeProxy({
      port: 0,
      appPort: cPort,
      nonce: 'n'.repeat(22),
      studioOrigin: 'http://127.0.0.1:4311',
      root: process.cwd(),
    });
    await cProxy.start();
    const pPort = (cProxy.server.address() as AddressInfo).port;
    try {
      const requestWithHost = (hostHeader: string) =>
        new Promise<string[] | string | undefined>((resolve, reject) => {
          const req = http.request(
            { host: '127.0.0.1', port: pPort, path: '/', headers: { Host: hostHeader } },
            (res) => {
              res.resume();
              resolve(res.headers['set-cookie']);
            },
          );
          req.on('error', reject);
          req.end();
        });

      const localCookies = await requestWithHost(`localhost:${String(pPort)}`);
      expect(localCookies).toEqual([
        'af=abc; path=/; SameSite=None; httponly; Secure',
        'td=xyz; path=/; SameSite=None; Secure',
      ]);

      const subCookies = await requestWithHost(`s2.localhost:${String(pPort)}`);
      expect(subCookies).toEqual([
        'af=abc; path=/; SameSite=None; httponly; Secure',
        'td=xyz; path=/; SameSite=None; Secure',
      ]);

      const ipCookies = await requestWithHost(`127.0.0.1:${String(pPort)}`);
      expect(ipCookies).toEqual(['af=abc; path=/; samesite=strict; httponly', 'td=xyz; path=/']);
    } finally {
      await cProxy.close();
      await new Promise<void>((resolve) => {
        cookieApp.close(() => {
          resolve();
        });
      });
    }
  });

  it('wraps empty 404/400 and plain-text 500 iframe error pages with Bridge HTML, leaving JSON API errors raw', async () => {
    const errApp = http.createServer((req, res) => {
      if (req.url === '/empty-404') {
        res.writeHead(404, 'Not Found');
        res.end();
        return;
      }
      if (req.url === '/plain-500') {
        res.writeHead(500, 'Internal Server Error', {
          'content-type': 'text/plain; charset=utf-8',
        });
        res.end('<boom> & fail');
        return;
      }
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end('{"error":"bad"}');
    });
    await new Promise<void>((resolve) => {
      errApp.listen(0, '127.0.0.1', resolve);
    });
    const ePort = (errApp.address() as AddressInfo).port;
    const eProxy = createBridgeProxy({
      port: 0,
      appPort: ePort,
      nonce: 'n'.repeat(22),
      studioOrigin: 'http://127.0.0.1:4311',
      root: process.cwd(),
    });
    await eProxy.start();
    const pPort = (eProxy.server.address() as AddressInfo).port;
    try {
      const r404 = await fetch(`http://127.0.0.1:${String(pPort)}/empty-404`, {
        headers: { accept: 'text/html', 'sec-fetch-dest': 'iframe' },
      });
      expect(r404.status).toBe(404);
      expect(r404.headers.get('content-type')).toContain('text/html');
      const html404 = await r404.text();
      expect(html404).toContain('HTTP 404 Not Found');
      expect(html404).toContain('id="__rc_bridge"');
      expect(html404).toContain(BRIDGE_CLIENT_URL);

      const r500 = await fetch(`http://127.0.0.1:${String(pPort)}/plain-500`, {
        headers: { accept: 'text/html', 'sec-fetch-dest': 'iframe' },
      });
      expect(r500.status).toBe(500);
      expect(r500.headers.get('content-type')).toContain('text/html');
      const html500 = await r500.text();
      expect(html500).toContain('&lt;boom&gt; &amp; fail');
      expect(html500).toContain('id="__rc_bridge"');

      const rJson = await fetch(`http://127.0.0.1:${String(pPort)}/api-400`, {
        headers: { accept: 'application/json', 'sec-fetch-dest': 'empty' },
      });
      expect(rJson.status).toBe(400);
      expect(rJson.headers.get('content-type')).toContain('application/json');
      expect(await rJson.text()).toBe('{"error":"bad"}');
    } finally {
      await eProxy.close();
      await new Promise<void>((resolve) => {
        errApp.close(() => {
          resolve();
        });
      });
    }
  });

  it('strips If-None-Match/ETag on HTML iframe navigations so 304 never serves stale nonces, while CSS keeps 304', async () => {
    const upstreamHtml = await fetch(`http://127.0.0.1:${String(appPort)}/`);
    const upstreamHtmlEtag = upstreamHtml.headers.get('etag') ?? '';
    expect(upstreamHtmlEtag).not.toBe('');

    const firstHtml = await fetch(`http://127.0.0.1:${String(proxyPort)}/`, {
      headers: { accept: 'text/html', 'sec-fetch-dest': 'iframe' },
    });
    expect(firstHtml.status).toBe(200);
    expect(firstHtml.headers.get('etag')).toBeNull();

    const secondHtml = await fetch(`http://127.0.0.1:${String(proxyPort)}/`, {
      headers: {
        accept: 'text/html',
        'sec-fetch-dest': 'iframe',
        'if-none-match': upstreamHtmlEtag,
        'cache-control': 'max-age=0',
      },
    });
    expect(secondHtml.status).toBe(200);
    expect(await secondHtml.text()).toContain('id="__rc_bridge"');

    const firstCss = await fetch(`http://127.0.0.1:${String(proxyPort)}/style.css`, {
      headers: { 'sec-fetch-dest': 'style' },
    });
    const cssEtag = firstCss.headers.get('etag') ?? '';
    expect(cssEtag).not.toBe('');

    const secondCss = await fetch(`http://127.0.0.1:${String(proxyPort)}/style.css`, {
      headers: {
        'sec-fetch-dest': 'style',
        'if-none-match': cssEtag,
        'cache-control': 'max-age=0',
      },
    });
    expect(secondCss.status).toBe(304);
  });
});
