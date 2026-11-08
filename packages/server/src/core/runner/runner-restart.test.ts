// Tests for auto-restart on file change (SPEC-04 M-RN, Phase 4 K4).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEventBus } from '../ports/event-bus-port.ts';
import type { FrameworkAdapter } from '../project/frameworks/types.ts';
import { attachAutoRestart } from './runner-restart.ts';
import type { RunnerService } from './runner-service.ts';

describe('Auto Restart Runner [WP-4.00]', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[WP-4.00] B6: debounces 500ms and calls runner.restart() when adapter.restartOn matches', () => {
    const eventBus = createEventBus();
    const restartSpy = vi.fn();
    const mockRunner: RunnerService = {
      getStatus: () => ({ state: 'ready' }),
      start: vi.fn(),
      restart: restartSpy,
      stop: vi.fn(),
      dispose: vi.fn(),
      notifyWritten: () => undefined,
    };
    const mockAdapter: FrameworkAdapter = {
      id: 'express-pug',
      primaryDependency: 'express',
      detect: vi.fn(),
      sourceExtensions: [],
      markupExtensions: ['.pug'],
      editMode: 'viewOnly',
      requiredPackages: ['express', 'pug'],
      runner: { entry: 'runners/express-pug', options: (c) => ({ ...c, host: '127.0.0.1' }) },
      restartOn: (rel) => rel.endsWith('.js'),
      pages: vi.fn(),
    };

    const cleanup = attachAutoRestart(
      eventBus,
      { getAdapter: () => mockAdapter },
      { current: mockRunner },
    );

    // 1. Irrelevant file -> no restart
    eventBus.publish('project.filesChanged', { files: ['views/index.pug'] });
    vi.advanceTimersByTime(600);
    expect(restartSpy).not.toHaveBeenCalled();

    // 2. Matching file -> restarts after 500ms
    eventBus.publish('project.filesChanged', { files: ['app.js'] });
    vi.advanceTimersByTime(400);
    expect(restartSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(restartSpy).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
