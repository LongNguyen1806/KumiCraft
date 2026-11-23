// Reverse proxy injecting Bridge client into Express + Pug HTML responses (SPEC-04 M-RN, Phase 4 K4).
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import type { Duplex } from 'node:stream';

import { BRIDGE_CLIENT_CODE, BRIDGE_CLIENT_URL, bridgeHeadHtml } from '@kumicraft/bridge';

const MAX_HTML_BYTES = 10 * 1024 * 1024;

export type BridgeProxyOptions = {
  readonly port: number;
  readonly appPort: number;
  readonly nonce: string;
  readonly studioOrigin: string;
  readonly root: string;
  /**
   * A page the Canvas loaded (its path and HTML as the app sent it): the ASP.NET runner asks for it
   * again to know when a change is served (03c section 3.3).
   */
  readonly onPage?: ((path: string, html: string) => void) | undefined;
};

/**
 * Lets the Bridge script run under a script source list. A nonce makes the browser ignore
 * `'unsafe-inline'`, so a list that relies on it (and has no nonce or hash yet) gets `'self'`
 * instead: the Bridge script is a same-origin file, and the app's inline scripts keep working.
 */
function allowBridgeScript(directive: string, cspNonce: string): string {
  const sources = directive.split(/\s+/).slice(1);
  const reliesOnInline =
    sources.includes("'unsafe-inline'") &&
    !sources.some((src) => /^'(nonce|sha256|sha384|sha512)-/.test(src));
  if (!reliesOnInline) return `${directive} 'nonce-${cspNonce}'`;
  return sources.includes("'self'") ? directive : `${directive} 'self'`;
}

export function patchCsp(csp: string, studioOrigin: string, cspNonce: string): string {
  const directives = csp
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  let hasFrameAncestors = false;
  let hasScriptSrc = false;
  let defaultSrcIdx = -1;
  const patched: string[] = [];

  for (let i = 0; i < directives.length; i++) {
    const d = directives[i];
    if (d === undefined) continue;
    const spaceIdx = d.indexOf(' ');
    const name = (spaceIdx === -1 ? d : d.slice(0, spaceIdx)).toLowerCase();
    if (name === 'frame-ancestors') {
      hasFrameAncestors = true;
      patched.push(`frame-ancestors ${studioOrigin}`);
    } else if (name === 'script-src') {
      hasScriptSrc = true;
      patched.push(allowBridgeScript(d, cspNonce));
    } else {
      if (name === 'default-src') {
        defaultSrcIdx = i;
      }
      patched.push(d);
    }
  }

  if (!hasFrameAncestors) {
    patched.push(`frame-ancestors ${studioOrigin}`);
  }
  if (!hasScriptSrc) {
    const defaultSrc = defaultSrcIdx >= 0 ? patched[defaultSrcIdx] : undefined;
    if (defaultSrc !== undefined) {
      patched[defaultSrcIdx] = allowBridgeScript(defaultSrc, cspNonce);
    } else {
      patched.push(`script-src 'nonce-${cspNonce}'`);
    }
  }
  return patched.join('; ');
}

export function injectBridgeHtml(html: string, bridgeHtml: string): string {
  const headMatch = /<head(?:\s+[^>]*)?>/i.exec(html) ?? undefined;
  if (headMatch !== undefined) {
    const idx = headMatch.index + headMatch[0].length;
    return `${html.slice(0, idx)}\n${bridgeHtml}${html.slice(idx)}`;
  }
  const htmlMatch = /<html(?:\s+[^>]*)?>/i.exec(html) ?? undefined;
  if (htmlMatch !== undefined) {
    const idx = htmlMatch.index + htmlMatch[0].length;
    return `${html.slice(0, idx)}\n${bridgeHtml}${html.slice(idx)}`;
  }
  const bodyMatch = /<body(?:\s+[^>]*)?>/i.exec(html) ?? undefined;
  if (bodyMatch !== undefined) {
    const idx = bodyMatch.index + bodyMatch[0].length;
    return `${html.slice(0, idx)}\n${bridgeHtml}${html.slice(idx)}`;
  }
  return `${bridgeHtml}\n${html}`;
}

export function rewriteLocation(location: string, appPort: number, host?: string): string {
  if (!host) return location;
  const re = new RegExp(`^http://(?:127\\.0\\.0\\.1|localhost):${String(appPort)}(?=/|$)`, 'i');
  return location.replace(re, `http://${host}`);
}

/**
 * The Canvas iframe runs on `localhost` / `*.localhost` while Studio runs on `127.0.0.1`
 * (`sessionOrigin`), which Chromium treats as cross-site: `SameSite=Strict`/`Lax` cookies (such
 * as ASP.NET AntiForgery) are dropped on iframe POSTs unless rewritten to `SameSite=None; Secure`.
 */
function isCrossSiteCanvasHost(host?: string): boolean {
  if (host === undefined) return false;
  const name = host.toLowerCase().replace(/:\d+$/, '');
  return name === 'localhost' || name.endsWith('.localhost');
}

export function patchSetCookie(cookie: string): string {
  const withSameSite = /;\s*samesite=/i.test(cookie)
    ? cookie.replace(/;\s*samesite=(?:strict|lax|none)\b/gi, '; SameSite=None')
    : `${cookie}; SameSite=None`;
  return /;\s*secure\b/i.test(withSameSite) ? withSameSite : `${withSameSite}; Secure`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isHtmlNavigationRequest(req: http.IncomingMessage): boolean {
  const dest = req.headers['sec-fetch-dest'];
  if (typeof dest === 'string') return dest === 'iframe' || dest === 'document';
  return (req.headers.accept ?? '').toLowerCase().includes('text/html');
}

function shouldWrapErrorPage(req: http.IncomingMessage, proxyRes: http.IncomingMessage): boolean {
  if ((proxyRes.statusCode ?? 200) < 400) return false;
  const cType = (proxyRes.headers['content-type'] ?? '').toLowerCase();
  if (cType.includes('text/html')) return false;
  if (cType !== '' && !cType.startsWith('text/plain')) return false;
  return isHtmlNavigationRequest(req);
}

function filterHeaders(
  headers: http.IncomingHttpHeaders,
  appPort: number,
  host?: string,
  cspNonce?: string,
  studioOrigin?: string,
): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  for (const [key, val] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'x-frame-options') continue;
    if (lower === 'location' && typeof val === 'string') {
      out[key] = rewriteLocation(val, appPort, host);
    } else if (lower === 'set-cookie' && val !== undefined && isCrossSiteCanvasHost(host)) {
      out[key] = Array.isArray(val) ? val.map(patchSetCookie) : patchSetCookie(val);
    } else if (
      (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') &&
      typeof val === 'string' &&
      cspNonce !== undefined &&
      studioOrigin !== undefined
    ) {
      out[key] = patchCsp(val, studioOrigin, cspNonce);
    } else if (val !== undefined) {
      out[key] = val;
    }
  }
  return out;
}

function handleBridgeClientRoute(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const pathname = (req.url ?? '/').split('?')[0];
  if (pathname === BRIDGE_CLIENT_URL) {
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-cache',
    });
    res.end(BRIDGE_CLIENT_CODE);
    return true;
  }
  return false;
}

function streamResponse(
  proxyRes: http.IncomingMessage,
  res: http.ServerResponse,
  appPort: number,
  host?: string,
): void {
  const headers = filterHeaders(proxyRes.headers, appPort, host);
  res.writeHead(proxyRes.statusCode ?? 200, proxyRes.statusMessage, headers);
  proxyRes.pipe(res);
}

function sendInjectedHtml(
  rawHtml: string,
  res: http.ServerResponse,
  opts: BridgeProxyOptions,
  proxyRes: http.IncomingMessage,
  host?: string,
  forceHtmlContentType = false,
): void {
  const cspNonce = randomBytes(16).toString('base64');
  const bridgeHtml = bridgeHeadHtml({
    nonce: opts.nonce,
    studioOrigin: opts.studioOrigin,
    rootDir: opts.root,
    navigation: 'document',
    cspNonce,
  });
  const modifiedHtml = injectBridgeHtml(rawHtml, bridgeHtml);
  const outBuf = Buffer.from(modifiedHtml, 'utf8');

  const headers = filterHeaders(proxyRes.headers, opts.appPort, host, cspNonce, opts.studioOrigin);
  if (forceHtmlContentType) {
    delete headers['content-type'];
    headers['content-type'] = 'text/html; charset=utf-8';
  }
  // The page is sent whole now: a chunked answer (ASP.NET sends one) has a length instead.
  delete headers['transfer-encoding'];
  // The HTML body was mutated (Bridge script + current run's nonce): drop upstream ETag/Last-Modified.
  delete headers['etag'];
  delete headers['last-modified'];
  headers['content-length'] = outBuf.byteLength;
  res.writeHead(proxyRes.statusCode ?? 200, proxyRes.statusMessage, headers);
  res.end(outBuf);
}

function wrapErrorHtml(proxyRes: http.IncomingMessage, bodyText: string): string {
  const code = String(proxyRes.statusCode ?? 500);
  const statusText = proxyRes.statusMessage ?? '';
  const heading = statusText === '' ? `HTTP ${code}` : `HTTP ${code} ${statusText}`;
  const trimmed = bodyText.trim();
  const detail =
    trimmed === ''
      ? ''
      : `<pre style="white-space:pre-wrap;font-size:13px;background:#f5f5f5;padding:12px;border-radius:6px">${escapeHtml(trimmed)}</pre>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title></head><body><main style="font-family:system-ui,sans-serif;padding:24px;color:#111"><h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(heading)}</h1>${detail}</main></body></html>`;
}

function handleHtmlResponse(
  proxyRes: http.IncomingMessage,
  res: http.ServerResponse,
  opts: BridgeProxyOptions,
  req: http.IncomingMessage,
  wrapError = false,
): void {
  const host = req.headers.host;
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let tooLarge = false;

  proxyRes.on('data', (chunk: Buffer) => {
    if (tooLarge) {
      res.write(chunk);
      return;
    }
    totalBytes += chunk.length;
    if (totalBytes > MAX_HTML_BYTES) {
      tooLarge = true;
      const headers = filterHeaders(proxyRes.headers, opts.appPort, host);
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.statusMessage, headers);
      for (const c of chunks) res.write(c);
      res.write(chunk);
      return;
    }
    chunks.push(chunk);
  });

  proxyRes.on('end', () => {
    if (tooLarge) {
      res.end();
      return;
    }
    const rawText = Buffer.concat(chunks).toString('utf8');
    const html = wrapError ? wrapErrorHtml(proxyRes, rawText) : rawText;
    sendInjectedHtml(html, res, opts, proxyRes, host, wrapError);
    if (!wrapError && req.method === 'GET' && proxyRes.statusCode === 200) {
      opts.onPage?.(req.url ?? '/', rawText);
    }
  });
}

function forwardRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: BridgeProxyOptions,
): void {
  const clientHeaders: http.IncomingHttpHeaders = { ...req.headers, 'accept-encoding': 'identity' };
  if (isHtmlNavigationRequest(req)) {
    delete clientHeaders['if-none-match'];
    delete clientHeaders['if-modified-since'];
  }
  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: opts.appPort,
      path: req.url,
      method: req.method,
      headers: clientHeaders,
    },
    (proxyRes) => {
      const cType = proxyRes.headers['content-type'] ?? '';
      const isHtml = cType.includes('text/html');
      if (isHtml) {
        handleHtmlResponse(proxyRes, res, opts, req);
      } else if (shouldWrapErrorPage(req, proxyRes)) {
        handleHtmlResponse(proxyRes, res, opts, req, true);
      } else {
        streamResponse(proxyRes, res, opts.appPort, req.headers.host);
      }
    },
  );

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq);
}

function handleUpgrade(
  req: http.IncomingMessage,
  clientSocket: Duplex,
  head: Buffer,
  appPort: number,
): void {
  const targetSocket = net.connect(appPort, '127.0.0.1', () => {
    let raw = `${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/${req.httpVersion}\r\n`;
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) {
        for (const item of v) raw += `${k}: ${item}\r\n`;
      } else if (v !== undefined) {
        raw += `${k}: ${v}\r\n`;
      }
    }
    raw += '\r\n';
    targetSocket.write(raw);
    if (head.length > 0) targetSocket.write(head);
    targetSocket.pipe(clientSocket);
    clientSocket.pipe(targetSocket);
  });

  targetSocket.on('error', () => {
    clientSocket.destroy();
  });
  clientSocket.on('error', () => {
    targetSocket.destroy();
  });
}

/**
 * S-04, S-104: like Vite's `allowedHosts`, the proxy answers only names of this machine:
 * 127.0.0.1, localhost and `*.localhost` (login sessions, RFC 6761). A DNS-rebinding page reaches
 * 127.0.0.1 with its own name in Host and must not read the app through the proxy.
 */
export function isLocalHost(host: string | undefined): boolean {
  if (host === undefined) return false;
  const name = host.toLowerCase().replace(/:\d+$/, '');
  return name === '127.0.0.1' || name === 'localhost' || name.endsWith('.localhost');
}

export function createBridgeProxy(options: BridgeProxyOptions): {
  server: http.Server;
  start(): Promise<void>;
  close(): Promise<void>;
} {
  const server = http.createServer((req, res) => {
    if (!isLocalHost(req.headers.host)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Blocked request: this host is not allowed.');
      return;
    }
    if (handleBridgeClientRoute(req, res)) return;
    forwardRequest(req, res, options);
  });

  server.on('upgrade', (req, socket, head) => {
    if (!isLocalHost(req.headers.host)) {
      socket.destroy();
      return;
    }
    handleUpgrade(req, socket, head, options.appPort);
  });

  return {
    server,
    start(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port, '127.0.0.1', () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}
