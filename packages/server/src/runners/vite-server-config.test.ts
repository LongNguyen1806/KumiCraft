// The dev server options forced by the runner (S-104, R-RN-03).
import { describe, expect, it } from 'vitest';

import { devServerOptions } from './vite-server-config.ts';

describe('runner dev server options', () => {
  it('listens on loopback with a fixed port and CORS off [S-104]', () => {
    const options = devServerOptions({
      root: '/work/shop',
      sourceDir: 'src',
      port: 5173,
      nonce: 'n'.repeat(22),
      studioOrigin: 'http://127.0.0.1:4000',
      host: '127.0.0.1',
    });

    expect(options).toEqual({
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      open: false,
      cors: false,
    });
  });
});
