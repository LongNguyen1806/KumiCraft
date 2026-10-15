// Entry of the Bridge client bundled into BRIDGE_CLIENT_CODE (SPEC-04 M-BR, R-BR-05, R-BR-17).
import { z } from 'zod';

import { BridgeClientRuntime } from './bridge-client-runtime.ts';

const ConfigSchema = z.object({
  nonce: z.string().min(1),
  studioOrigin: z.string().min(1),
  root: z.string().min(1),
});

function readConfig(): z.infer<typeof ConfigSchema> | undefined {
  const text = document.getElementById('__rc_bridge')?.textContent;
  if (text === undefined || text === '') return undefined;
  try {
    const parsed = ConfigSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

// The Bridge only runs inside the Studio iframe; opened alone, the app stays untouched.
const config = window.parent === window ? undefined : readConfig();
if (config !== undefined) {
  new BridgeClientRuntime({
    nonce: config.nonce,
    studioOrigin: config.studioOrigin,
    rootDir: config.root,
    hot: import.meta.hot,
  });
}
