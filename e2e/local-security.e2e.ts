// K9.5, SPEC-05 S-01, S-04, S-07, S-104: attacks on a running KumiCraft from this machine and the
// network. A web page of another origin, open in a real browser, must not read the API, change
// anything, listen to the event stream or read the project's files through its dev server; a
// DNS-rebinding request (a foreign Host) is refused; nothing answers on the machine's LAN address.
import { createServer, request, type Server } from 'node:http';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';

import { expect, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';

let project: TempDir;
let config: TempDir;
let session: CliSession;
let evil: Server;
let evilOrigin: string;
let devOrigin: string | undefined;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && Boolean(v);
const dataOf = (body: unknown): unknown => (isRecord(body) && 'data' in body ? body.data : body);

/** A raw HTTP request, so the test can send any Host and Origin a browser would not. */
function rawGet(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => (body += chunk.toString()));
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/** `refused` when nothing accepts a connection on host:port within two seconds. */
function tryConnect(host: string, port: number): Promise<'connected' | 'refused'> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: 2000 });
    socket.once('connect', () => {
      // The server may still drop a non-loopback peer at once (S-01): wait for that.
      socket.once('close', () => {
        resolve('refused');
      });
      setTimeout(() => {
        socket.destroy();
        resolve('connected');
      }, 500);
    });
    socket.once('error', () => {
      resolve('refused');
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve('refused');
    });
  });
}

async function trusted(): Promise<unknown> {
  const info = dataOf(await session.api('project'));
  return isRecord(info) ? info['trusted'] : undefined;
}

test.beforeAll(async () => {
  project = await copyFixture('projects/vite8-react19-ts');
  config = await makeTempDir('security-config');
  session = await startCli(project.path, config.path);
  await session.api('project/trust', 'POST', { trusted: true });
  await session.api('runner/start', 'POST', {});
  for (let i = 0; i < 120 && devOrigin === undefined; i++) {
    const status = dataOf(await session.api('runner'));
    if (isRecord(status) && status['state'] === 'ready' && typeof status['origin'] === 'string') {
      devOrigin = status['origin'];
    } else {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  // The attacker's page: another origin on this machine, as any website open in the browser.
  evil = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>evil</title>');
  });
  await new Promise<void>((resolve) => evil.listen(0, '127.0.0.1', resolve));
  const address = evil.address();
  evilOrigin = `http://127.0.0.1:${String(isRecord(address) ? address['port'] : 0)}`;
});

test.afterAll(async () => {
  evil.close();
  await session.stop();
  await project.remove();
  await config.remove();
});

test('a web page of another origin cannot read, change or listen to KumiCraft [S-04, S-07]', async ({
  page,
}) => {
  expect(devOrigin, 'the dev server started').toBeDefined();
  expect(await trusted()).toBe(true);
  await page.goto(evilOrigin);
  const results = await page.evaluate(
    async ({ api, dev }) => {
      const read = async (url: string): Promise<string> => {
        try {
          const res = await fetch(url);
          return `read ${String(res.status)}: ${(await res.text()).slice(0, 80)}`;
        } catch {
          return 'blocked';
        }
      };
      // A "simple request" a page may send without asking (no-cors, text/plain).
      let sent = 'sent';
      try {
        await fetch(`${api}/api/project/trust`, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ trusted: false }),
        });
      } catch {
        sent = 'blocked';
      }
      const socket = await new Promise<string>((resolve) => {
        const ws = new WebSocket(`${api.replace('http', 'ws')}/api/events`, [
          'kumicraft.token.guess',
        ]);
        ws.onmessage = () => {
          resolve('message received');
        };
        ws.onclose = (e) => {
          resolve(`closed ${String(e.code)}`);
        };
        setTimeout(() => {
          resolve('still open');
        }, 5000);
      });
      return {
        project: await read(`${api}/api/project`),
        studioPage: await read(`${api}/`),
        source: await read(`${dev}/src/App.tsx`),
        anyFile: await read(`${dev}/@fs/C:/Windows/win.ini`),
        trustPost: sent,
        socket,
      };
    },
    { api: session.origin, dev: devOrigin ?? '' },
  );
  process.stdout.write(`[security] browser: ${JSON.stringify(results)}\n`);
  expect(results.project).toBe('blocked');
  expect(results.studioPage).toBe('blocked');
  expect(results.source).toBe('blocked');
  expect(results.anyFile).toBe('blocked');
  expect(results.socket).not.toBe('message received');
  expect(results.socket).not.toBe('still open');
  // The request may leave the page, but the server must not act on it.
  expect(await trusted(), 'the project is still trusted').toBe(true);
});

test('the API needs the session token, its own Host and its own Origin [S-04, S-07]', async () => {
  const api = `${session.origin}/api/project`;
  const host = new URL(session.origin).host;
  const noToken = await rawGet(api, { Host: host });
  const wrongToken = await rawGet(api, { Host: host, Authorization: 'Bearer wrong' });
  // DNS rebinding: the attacker's name resolves to 127.0.0.1, the Host stays the attacker's.
  const rebound = await rawGet(api, { Host: 'evil.example:80' });
  const reboundDev = await rawGet(`${devOrigin ?? ''}/src/App.tsx`, { Host: 'evil.example:80' });
  const foreignOrigin = await rawGet(api, { Host: host, Origin: 'https://evil.example' });
  const report = { noToken, wrongToken, rebound, reboundDev, foreignOrigin };
  process.stdout.write(`[security] raw: ${JSON.stringify(report)}\n`);
  for (const res of [noToken, wrongToken, foreignOrigin]) {
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toContain('E014');
  }
  expect(rebound.status).toBe(421);
  expect(reboundDev.status, 'Vite refuses a foreign Host').toBe(403);
});

test('nothing answers on the LAN address of this machine [S-01, S-104]', async () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((a) => a !== undefined && a.family === 'IPv4' && !a.internal)?.address;
  test.skip(lan === undefined, 'this machine has no LAN address');
  const results = {
    studio: await tryConnect(lan ?? '', Number(new URL(session.origin).port)),
    devServer: await tryConnect(lan ?? '', Number(new URL(devOrigin ?? 'http://x:0').port)),
  };
  process.stdout.write(`[security] lan ${String(lan)}: ${JSON.stringify(results)}\n`);
  expect(results).toEqual({ studio: 'refused', devServer: 'refused' });
});
