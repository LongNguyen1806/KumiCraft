// The served Bridge client is built from the TypeScript runtime, never written by hand (R-BR-05).
import { describe, expect, it } from 'vitest';

import { buildClientCode, generatedModule } from '../../scripts/build-client.ts';
import { BRIDGE_CLIENT_CODE } from './bridge-client.generated.ts';

describe('bridge-client.generated.ts', () => {
  it('matches a fresh build of src/client/entry.ts (run `pnpm --filter @kumicraft/bridge build`)', async () => {
    const code = await buildClientCode();

    expect(BRIDGE_CLIENT_CODE).toBe(code);
    expect(generatedModule(code)).toContain('export const BRIDGE_CLIENT_CODE');
  });
});
