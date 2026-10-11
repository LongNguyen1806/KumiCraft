// Cost of one authenticated API request through every security hook (`pnpm bench`).
import { expect, test } from 'vitest';

import { createHttpApp } from './create-http-app.ts';

const PORT = 50124;

test('GET /api/v1/session with token, Host and Origin checks', async ({ bench }) => {
  const app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: 'bench-token', trustedOrigins: [] },
    getSessionInfo: () => ({
      version: '0.0.0',
      platform: 'linux',
      features: [],
      workspace: { state: 'none', directory: '/w' },
    }),
  });

  const result = await bench('session request', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/v1/session',
      headers: {
        host: `127.0.0.1:${String(PORT)}`,
        origin: `http://127.0.0.1:${String(PORT)}`,
        authorization: 'Bearer bench-token',
      },
    });
  }).run();
  await app.close();

  expect(result.name).toBe('session request');
});
