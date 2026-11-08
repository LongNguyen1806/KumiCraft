// Tests for telling the dev server about KumiCraft's writes once they settle (K9.5).
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { directWriteFs, makeTempDir } from '../workspace/test-support.ts';
import {
  createWriteNotifier,
  WRITE_NOTIFY_DELAY_MS,
  writeReportingFileSystem,
} from './write-notifier.ts';

describe('write notifier [K9.5]', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the files written twice in one burst, once it settles; single writes not', () => {
    const send = vi.fn();
    const notifier = createWriteNotifier(send);
    notifier.written('/p/src/index.css');
    vi.advanceTimersByTime(10);
    notifier.written('/p/src/index.css');
    notifier.written('/p/src/App.tsx');
    vi.advanceTimersByTime(WRITE_NOTIFY_DELAY_MS - 1);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(['/p/src/index.css']);
    // A lone write later: Vite sees it by itself, nothing is sent.
    notifier.written('/p/src/index.css');
    vi.advanceTimersByTime(WRITE_NOTIFY_DELAY_MS);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports atomic writes once connected, with their absolute path (written twice)', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const writes = writeReportingFileSystem(directWriteFs);
      const send = vi.fn();
      // Before the runner exists nothing is sent.
      await writes.fs.writeTextAtomic(dir, 'a.css', 'x');
      writes.connect(send);
      await writes.fs.writeTextAtomic(dir, 'b.css', 'y');
      await writes.fs.writeTextAtomic(dir, 'b.css', 'z');
      vi.advanceTimersByTime(WRITE_NOTIFY_DELAY_MS);
      expect(send).toHaveBeenCalledWith([resolve(dir, 'b.css')]);
    } finally {
      await cleanup();
    }
  });
});
