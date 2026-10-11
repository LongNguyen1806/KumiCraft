import { describe, expect, it } from 'vitest';

import { startServer } from './index.ts';

const randomPort = () => 49152 + Math.floor(Math.random() * 10000);

describe('startServer', () => {
  it('listens on 127.0.0.1 with a fresh 32-byte session token [S-01, S-03]', async () => {
    const port = randomPort();

    const result = await startServer({
      version: '9.9.9',
      port,
      workspaceDir: '/w',
      logLevel: 'silent',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { url, sessionToken, close } = result.value;
    const response = await fetch(`${url}/api/v1/session`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(url).toBe(`http://127.0.0.1:${String(port)}`);
    expect(Buffer.from(sessionToken, 'base64url')).toHaveLength(32);
    expect(await response.json()).toMatchObject({ data: { version: '9.9.9' } });
    await close();
  });

  it('reports E002 at the listen step when the port is taken', async () => {
    const port = randomPort();
    const first = await startServer({ version: 'a', port, workspaceDir: '/w', logLevel: 'silent' });

    const second = await startServer({
      version: 'b',
      port,
      workspaceDir: '/w',
      logLevel: 'silent',
    });

    expect(second).toMatchObject({
      ok: false,
      error: { code: 'E002', params: { step: 'listen' } },
    });
    if (first.ok) await first.value.close();
  });
});
