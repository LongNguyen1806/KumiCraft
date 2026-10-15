// Unit tests for useLiveEdit hook (SPEC-04 R-IN-13, R-IN-14, R-IN-20, Scenarios 3 & 4).
import type { ClassContext, EditResult, ElementSource } from '@reactcraft/shared';
import { BREAKPOINT_WIDTHS } from '@reactcraft/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/http.ts';
import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import type { InspectorTarget } from './types.ts';
import { useLiveEdit } from './use-live-edit.ts';

const mockContext: ClassContext = {
  theme: {
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
  },
  mode: 'desktop-first',
  breakpoints: BREAKPOINT_WIDTHS,
};

const mockSource: ElementSource = {
  loc: 'src/App.tsx:12:5',
  tag: 'div',
  fileHash: 'a'.repeat(64),
  className: { kind: 'static', value: 'p-4' },
  text: { kind: 'none' },
  attributes: {},
  inLoop: false,
};

function createMockTarget(
  source: ElementSource,
  refreshMock: () => void,
): Extract<InspectorTarget, { readonly kind: 'element' }> {
  return {
    kind: 'element',
    ref: { loc: source.loc, index: 0 },
    source,
    loading: false,
    currentScope: { breakpoint: 'base' },
    writePrefix: '',
    warnings: [],
    setInteractionState: vi.fn(),
    refresh: refreshMock,
  };
}

function makeEditResult(loc: string, tag: string, nextClass: string): EditResult {
  return {
    changed: true,
    file: 'src/App.tsx',
    fileHash: 'a'.repeat(64),
    element: {
      loc,
      tag,
      fileHash: 'a'.repeat(64),
      className: { kind: 'static', value: nextClass },
      text: { kind: 'none' },
      attributes: {},
      inLoop: false,
    },
  };
}

describe('useLiveEdit [SPEC-04 R-IN-13, R-IN-14, R-IN-20]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Scenario 3: throttles continuous edits at 100ms and commits final value', () => {
    const editSpy = vi.spyOn(sourceClient, 'editSource').mockImplementation((req) => {
      return Promise.resolve(makeEditResult(req.edit.loc, req.edit.tag, req.edit.after ?? ''));
    });

    const target = createMockTarget(mockSource, vi.fn());
    const { result } = renderHook(() => useLiveEdit({ target, ctx: mockContext, throttleMs: 100 }));

    // Rapidly change padding 20 times in 1 second (every 50ms)
    for (let i = 1; i <= 20; i += 1) {
      act(() => {
        result.current.mutateProperty('padding', { kind: 'scale', token: String(i) });
        vi.advanceTimersByTime(50);
      });
    }

    // Flush any pending throttled edit
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // 20 edits at 50ms with 100ms throttle should result in <= 11 network calls
    expect(editSpy.mock.calls.length).toBeLessThanOrEqual(11);
    expect(editSpy.mock.calls.length).toBeGreaterThan(0);

    // Final call must have the final value 'p-20'
    const lastCall = editSpy.mock.calls[editSpy.mock.calls.length - 1];
    expect(lastCall?.[0].edit.after).toBe('p-20');
  });

  it('Scenario 4: rolls back optimistic state on E017 conflict and triggers target.refresh()', async () => {
    vi.spyOn(sourceClient, 'editSource').mockRejectedValue(new ApiError(409, 'E017'));

    const refreshMock = vi.fn();
    const target = createMockTarget(mockSource, refreshMock);
    const { result } = renderHook(() => useLiveEdit({ target, ctx: mockContext, throttleMs: 100 }));

    act(() => {
      result.current.mutateProperty('padding', { kind: 'scale', token: '8' });
    });

    // Optimistic UI updates immediately
    expect(result.current.classString).toBe('p-8');

    // Wait for throttle to trigger request and fail
    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    // Rolled back to original 'p-4'
    expect(result.current.classString).toBe('p-4');
    // Reload triggered
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeDefined();
  });

  it('chains in-flight requests and sends coalesceKey', async () => {
    let resolveFirst: ((val: EditResult) => void) | undefined;
    const firstPromise = new Promise<EditResult>((resolve) => {
      resolveFirst = resolve;
    });

    const editSpy = vi
      .spyOn(sourceClient, 'editSource')
      .mockReturnValueOnce(firstPromise)
      .mockImplementation((req) =>
        Promise.resolve(makeEditResult(req.edit.loc, req.edit.tag, req.edit.after ?? '')),
      );

    const target = createMockTarget(mockSource, vi.fn());
    const { result } = renderHook(() => useLiveEdit({ target, ctx: mockContext, throttleMs: 50 }));

    act(() => {
      result.current.mutateProperty('padding', { kind: 'scale', token: '6' });
    });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    // First request is now in flight
    expect(editSpy).toHaveBeenCalledTimes(1);
    expect(editSpy.mock.calls[0]?.[0].coalesceKey).toBe('src/App.tsx:12:5|padding|');

    // Make second change while first is still in flight
    act(() => {
      result.current.mutateProperty('margin', { kind: 'scale', token: '2' });
      vi.advanceTimersByTime(60);
    });

    // Still only 1 in flight
    expect(editSpy).toHaveBeenCalledTimes(1);

    // Resolve first request and flush microtasks
    await act(async () => {
      resolveFirst?.(makeEditResult('src/App.tsx:12:5', 'div', 'p-6'));
      await Promise.resolve();
    });

    // Chained second request dispatched automatically
    expect(editSpy).toHaveBeenCalledTimes(2);
    expect(editSpy.mock.calls[1]?.[0].coalesceKey).toBe('src/App.tsx:12:5|margin|');
  });

  it('flushes pending throttled mutation immediately on flush()', () => {
    const editSpy = vi.spyOn(sourceClient, 'editSource').mockImplementation((req) => {
      return Promise.resolve(makeEditResult(req.edit.loc, req.edit.tag, req.edit.after ?? ''));
    });

    const target = createMockTarget(mockSource, vi.fn());
    const { result } = renderHook(() => useLiveEdit({ target, ctx: mockContext, throttleMs: 500 }));

    act(() => {
      result.current.mutateRawClass('flex flex-col gap-2');
    });

    expect(editSpy).not.toHaveBeenCalled();

    act(() => {
      result.current.flush();
    });

    // Dispatched immediately without waiting 500ms
    expect(editSpy).toHaveBeenCalledTimes(1);
    expect(editSpy.mock.calls[0]?.[0].edit.after).toBe('flex flex-col gap-2');
  });
});
