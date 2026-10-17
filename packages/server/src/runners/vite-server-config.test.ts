// The dev server options forced by the runner (S-104, R-RN-03).
import { describe, expect, it } from 'vitest';

import { devServerOptions } from './vite-server-config.ts';

describe('runner dev server options', () => {
  const runner = {
    root: '/work/shop',
    sourceDir: 'src',
    port: 51234,
    nonce: 'n'.repeat(22),
    studioOrigin: 'http://127.0.0.1:4000',
    host: '127.0.0.1',
  } as const;

  it('listens on loopback with a fixed port and CORS off [S-104]', () => {
    expect(devServerOptions(runner, 51234)).toEqual({
      host: '127.0.0.1',
      port: 51234,
      strictPort: true,
      open: false,
      cors: false,
    });
  });

  it("leaves the port to the project's vite.config when none is given [R-RN-04]", () => {
    expect(devServerOptions(runner, undefined)).toEqual({
      host: '127.0.0.1',
      strictPort: true,
      open: false,
      cors: false,
    });
  });
});
