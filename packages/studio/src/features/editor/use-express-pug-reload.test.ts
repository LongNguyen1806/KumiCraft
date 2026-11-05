// Tests for useExpressPugReload hook (SPEC-04 M-RN, Phase 4 K4).
import type { ProjectInfo } from '@kumicraft/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClientModule from '../../api/events-client.ts';
import { useExpressPugReload } from './use-express-pug-reload.ts';

const EXPRESS_PUG_PROJECT: ProjectInfo = {
  id: 'test-12345',
  name: 'Test Express',
  root: '/test',
  sourceDir: 'views',
  support: {
    supported: true,
    reasons: [],
    framework: 'express-pug',
    versions: { express: '^4.19.2', pug: '^3.0.3' },
    language: 'js',
    editMode: 'viewOnly',
    serverEntry: 'app.js',
    viewsDir: 'views',
  },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  trusted: true,
  designDirs: {
    pages: ['views'],
    layouts: [],
    components: [],
    drafts: 'views/drafts',
  },
};

describe('useExpressPugReload [WP-4.00]', () => {
  let eventHandler: ((event: eventsClientModule.StudioServerEvent) => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(eventsClientModule, 'createEventsClient').mockImplementation((options) => {
      eventHandler = options?.onEvent;
      return {
        close: vi.fn(),
        isConnected: () => true,
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    eventHandler = undefined;
  });

  it('[WP-4.00] B6: debounces 300ms and increments reloadTick on viewsDir or public or .css changes', () => {
    const { result } = renderHook(() => useExpressPugReload(EXPRESS_PUG_PROJECT));
    expect(result.current).toBe(0);

    // 1. Irrelevant file -> does not increment
    act(() => {
      eventHandler?.({
        v: 1,
        type: 'project.filesChanged',
        at: new Date().toISOString(),
        payload: { files: ['app.js', 'routes/products.js'] },
      });
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe(0);

    // 2. views/index.pug -> increments after 300ms
    act(() => {
      eventHandler?.({
        v: 1,
        type: 'project.filesChanged',
        at: new Date().toISOString(),
        payload: { files: ['views/index.pug'] },
      });
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(1);

    // 3. public/style.css -> increments again
    act(() => {
      eventHandler?.({
        v: 1,
        type: 'project.filesChanged',
        at: new Date().toISOString(),
        payload: { files: ['public/style.css'] },
      });
      vi.advanceTimersByTime(350);
    });
    expect(result.current).toBe(2);
  });
});
