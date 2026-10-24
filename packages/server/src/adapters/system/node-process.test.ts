// Unit tests for node-process adapter (S-50, S-51, S-53).
import { describe, expect, it } from 'vitest';

import { createNodeProcess, sanitizeEnvironment } from './node-process.ts';

describe('sanitizeEnvironment [S-53]', () => {
  it('strips only KUMICRAFT_* variables [S-53]', () => {
    const raw = {
      PATH: '/usr/bin',
      KUMICRAFT_PORT: '5420',
      KUMICRAFT_CONFIG_DIR: '/tmp',
      GH_TOKEN: 'secret123',
      my_token: 'abc',
      USER: 'dev',
    };

    const sanitized = sanitizeEnvironment(raw, { EXTRA: 'yes' });

    expect(sanitized['PATH']).toBe('/usr/bin');
    expect(sanitized['USER']).toBe('dev');
    expect(sanitized['EXTRA']).toBe('yes');
    expect(sanitized['GH_TOKEN']).toBe('secret123');
    expect(sanitized['my_token']).toBe('abc');
    expect(sanitized['KUMICRAFT_PORT']).toBeUndefined();
    expect(sanitized['KUMICRAFT_CONFIG_DIR']).toBeUndefined();
  });
});

describe('createNodeProcess', () => {
  it('spawns a simple node command and gathers output', async () => {
    const proc = createNodeProcess();
    const handle = proc.spawn(process.execPath, ['-e', 'console.log("hello-from-process")'], {
      cwd: process.cwd(),
    });

    const lines: string[] = [];
    handle.onLine((line) => lines.push(line));

    const result = await handle.wait();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello-from-process');
    expect(lines).toContain('hello-from-process');
  });

  it('handles unknown command with exitCode 127 [S-51]', async () => {
    const proc = createNodeProcess();
    const handle = proc.spawn('nonexistent_command_12345', [], {
      cwd: process.cwd(),
    });

    const result = await handle.wait();
    expect(result.exitCode).toBe(127);
  });

  it('supports IPC channel when options.ipc is true [R-RN-02]', async () => {
    const proc = createNodeProcess();
    const script = `
      process.on('message', (msg) => {
        if (msg && msg.ping) {
          process.send({ pong: true });
          setTimeout(() => process.exit(0), 50);
        }
      });
    `;
    const handle = proc.spawn(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      ipc: true,
    });

    let receivedPong = false;
    handle.onMessage?.((msg: unknown) => {
      const parsed = msg as { pong?: boolean };
      if (parsed.pong) {
        receivedPong = true;
      }
    });

    handle.send?.({ ping: true });

    const result = await handle.wait();
    expect(result.exitCode).toBe(0);
    expect(receivedPong).toBe(true);
  });
});
