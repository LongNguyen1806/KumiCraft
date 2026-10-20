import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShutdown, SHUTDOWN_TIMEOUT_MS } from './shutdown.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('createShutdown', () => {
  it('stops cleanly when close() resolves immediately [R-CL-02]', async () => {
    const close = vi.fn(() => Promise.resolve());
    const exit = vi.fn();
    const log = vi.fn();
    const warn = vi.fn();
    const setTimer = vi.fn(setTimeout);
    const clearTimer = vi.fn(clearTimeout);
    const stop = createShutdown({ close, exit, log, warn, setTimer, clearTimer });

    await stop();

    expect(close).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Stopping ReactCraft…');
    expect(exit).toHaveBeenCalledWith(0);
    expect(clearTimer).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns and exits with 1 when close() does not finish within 10s [R-CL-02]', async () => {
    vi.useFakeTimers();
    const close = vi.fn(() => new Promise<void>(() => undefined));
    const exit = vi.fn();
    const log = vi.fn();
    const warn = vi.fn();
    const stop = createShutdown({ close, exit, log, warn });

    void stop();
    await vi.advanceTimersByTimeAsync(SHUTDOWN_TIMEOUT_MS);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('prints Forced stop. and exits with 1 on a second signal while stopping [R-CL-02]', async () => {
    const close = vi.fn(() => new Promise<void>(() => undefined));
    const exit = vi.fn();
    const log = vi.fn();
    const warn = vi.fn();
    const stop = createShutdown({ close, exit, log, warn });

    void stop();
    await stop();

    expect(close).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenNthCalledWith(1, 'Stopping ReactCraft…');
    expect(log).toHaveBeenNthCalledWith(2, 'Forced stop.');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
