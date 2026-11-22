// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { applyStyle } from '../../api/style-client.ts';
import { studioBridgeChannel } from '../../core/bridge-channel.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useStyleCommit } from './use-style-commit.ts';

vi.mock('../../api/style-client.ts', () => ({
  applyStyle: vi.fn(),
}));

describe('useStyleCommit [R-ST-13]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('calls clearStylePreview before refresh after commit completes [R-ST-13]', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    vi.mocked(applyStyle).mockImplementation(() => {
      order.push('applyStyle');
      return Promise.resolve({
        files: ['src/index.css'],
      });
    });
    const clearSpy = vi.spyOn(studioBridgeChannel, 'clearStylePreview').mockImplementation(() => {
      order.push('clearStylePreview');
    });
    const refresh = vi.fn(() => {
      order.push('refresh');
    });

    const { result } = renderHook(() =>
      useStyleCommit({
        state: {
          probe: {
            ref: { loc: 'src/Home.tsx:8:5', index: 0 },
            found: true,
            rules: [],
            inline: [],
            computed: {},
          },
          reading: {
            primary: 'css',
            properties: [],
          },
        },
        refresh,
        breakpoint: 'base',
        mode: 'desktop-first',
        tag: 'div',
        target: 'rule',
        interactionState: 'hover',
      }),
    );

    await act(async () => {
      await result.current.commit('paddingTop', '24px');
    });

    // The preview stays until the first read again, so the element does not jump back meanwhile.
    expect(clearSpy).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['applyStyle', 'clearStylePreview', 'refresh']);
    expect(applyStyle).toHaveBeenCalledWith(
      expect.objectContaining({
        change: {
          property: 'paddingTop',
          target: 'rule',
          value: '24px',
          state: 'hover',
        },
      }),
    );
  });
});
