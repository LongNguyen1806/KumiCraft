import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { startFailureMessage } from './messages.ts';

describe('startFailureMessage', () => {
  it('names the running session and the lock to delete when the workspace is busy [E018]', () => {
    const message = startFailureMessage(
      { code: 'E018', params: { resource: 'workspace', port: 51234, pid: 9, hostname: 'MY-PC' } },
      'D:\\Shop',
    );

    expect(message).toContain('already open in another ReactCraft session');
    expect(message).toContain('on MY-PC at http://127.0.0.1:51234');
    expect(message).toContain(join('D:\\Shop', '.reactcraft', 'lock'));
  });

  it('still says what to do when the busy session is unknown', () => {
    const message = startFailureMessage({ code: 'E018', params: { resource: 'workspace' } }, '/w');

    expect(message).not.toContain('http://');
    expect(message).toContain(join('/w', '.reactcraft', 'lock'));
  });

  it('shows the code and parameters of other failures', () => {
    expect(startFailureMessage({ code: 'E002', params: { step: 'listen' } }, '/w')).toBe(
      'could not start the server (E002, {"step":"listen"}).',
    );
  });
});
