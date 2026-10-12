import { describe, expect, it } from 'vitest';

import { attemptsFor, MAX_PORT_ATTEMPTS, portFor, randomPort } from './port-choice.ts';

const random = () => 50000;

describe('portFor', () => {
  it('uses --port on every attempt, and only once', () => {
    const plan = { fixed: 5420, remembered: 61000 };

    expect([portFor(1, plan, random), portFor(2, plan, random)]).toEqual([5420, 5420]);
    expect(attemptsFor(plan)).toBe(1);
  });

  it('tries the port of the last session first, then random ports [S-02]', () => {
    const plan = { fixed: undefined, remembered: 61000 };

    expect([portFor(1, plan, random), portFor(2, plan, random)]).toEqual([61000, 50000]);
    expect(attemptsFor(plan)).toBe(MAX_PORT_ATTEMPTS);
  });

  it('starts with a random port in a new workspace', () => {
    expect(portFor(1, { fixed: undefined, remembered: undefined }, random)).toBe(50000);
  });

  it('draws random ports from the dynamic range', () => {
    for (let i = 0; i < 200; i++) {
      const port = randomPort();
      expect(port).toBeGreaterThanOrEqual(49152);
      expect(port).toBeLessThanOrEqual(65535);
    }
  });
});
