import { describe, expect, it } from 'vitest';

import { findRunnerPort, RUNNER_PORT_MAX, RUNNER_PORT_MIN } from './port-finder.ts';

describe('findRunnerPort [R-RN-04]', () => {
  it('reuses preferred port if not in use', async () => {
    const fakeSystem = {
      isListening: () => Promise.resolve(false),
    };

    const port = await findRunnerPort(fakeSystem, 52000);
    expect(port).toBe(52000);
  });

  it('selects new port in range when preferred is in use', async () => {
    const occupied = new Set([52000]);
    const fakeSystem = {
      isListening: (p: number) => Promise.resolve(occupied.has(p)),
    };

    const port = await findRunnerPort(fakeSystem, 52000);
    expect(port).toBeDefined();
    expect(port).not.toBe(52000);
    expect(port !== undefined && port >= RUNNER_PORT_MIN && port <= RUNNER_PORT_MAX).toBe(true);
  });

  it('returns undefined if all candidates are occupied', async () => {
    const fakeSystem = {
      isListening: () => Promise.resolve(true),
    };

    const port = await findRunnerPort(fakeSystem);
    expect(port).toBeUndefined();
  });
});
