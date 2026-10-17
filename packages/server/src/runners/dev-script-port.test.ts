// Reading the project's own dev port from its `dev` script (R-RN-04).
import { describe, expect, it } from 'vitest';

import { devScriptPort, portInMessage } from './dev-script-port.ts';

const pkg = (dev: string) => ({ scripts: { dev } });

describe('devScriptPort [R-RN-04]', () => {
  it('reads --port in both spellings', () => {
    expect(devScriptPort(pkg('vite --port 3000'))).toBe(3000);
    expect(devScriptPort(pkg('vite dev --host --port=4200'))).toBe(4200);
    expect(devScriptPort(pkg('cross-env NODE_ENV=dev vite --port 3000 --open'))).toBe(3000);
  });

  it('gives nothing when the script names no port, is not Vite, or the port is out of range', () => {
    expect(devScriptPort(pkg('vite'))).toBeUndefined();
    expect(devScriptPort(pkg('next dev --port 3000'))).toBeUndefined();
    expect(devScriptPort(pkg('vite --port 80'))).toBeUndefined();
    expect(devScriptPort(pkg('vite --portal 3000'))).toBeUndefined();
    expect(devScriptPort({ scripts: {} })).toBeUndefined();
    expect(devScriptPort('not a package.json')).toBeUndefined();
  });
});

describe('portInMessage [R-RN-04]', () => {
  it("reads the port of Vite's port-in-use error", () => {
    expect(portInMessage('Port 5173 is already in use')).toBe(5173);
    expect(portInMessage('Something else failed')).toBeUndefined();
  });
});
