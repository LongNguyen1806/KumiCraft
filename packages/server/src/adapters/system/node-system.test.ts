import { createServer, type Server } from 'node:net';

import { describe, expect, it } from 'vitest';

import { createNodeSystem } from './node-system.ts';

const listen = () =>
  new Promise<{ server: Server; port: number }>((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address instanceof Object ? address.port : 0 });
    });
  });

const close = (server: Server) =>
  new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });

describe('createNodeSystem', () => {
  const system = createNodeSystem();

  it('sees its own process and not a process that does not exist', () => {
    expect(system.pid).toBe(process.pid);
    expect(system.isProcessAlive(process.pid)).toBe(true);
    expect(system.isProcessAlive(2 ** 31 - 2)).toBe(false);
  });

  it('tells a listening port from a closed one', async () => {
    const { server, port } = await listen();

    expect(await system.isListening(port)).toBe(true);
    await close(server);
    expect(await system.isListening(port)).toBe(false);
  });
});
