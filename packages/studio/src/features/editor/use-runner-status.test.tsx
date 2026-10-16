import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudioServerEvent } from '../../api/events-client.ts';
import * as eventsClientModule from '../../api/events-client.ts';
import * as runnerClientModule from '../../api/runner-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { RunnerStatusBadge } from './runner-status-badge.tsx';
import { useRunnerStatus } from './use-runner-status.ts';

describe('useRunnerStatus & RunnerStatusBadge', () => {
  let capturedOnEvent: ((event: StudioServerEvent) => void) | undefined;
  let closeSpy = vi.fn<() => void>();
  let createEventsClientSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(async () => {
    await i18next.changeLanguage('vi');
    capturedOnEvent = undefined;
    closeSpy = vi.fn<() => void>();

    vi.spyOn(runnerClientModule, 'fetchRunnerStatus').mockResolvedValue({
      state: 'ready',
      origin: 'http://127.0.0.1:5173',
      nonce: 'n'.repeat(22),
    });

    createEventsClientSpy = vi
      .spyOn(eventsClientModule, 'createEventsClient')
      .mockImplementation((options) => {
        capturedOnEvent = options?.onEvent;
        return {
          close: closeSpy,
          isConnected: () => true,
        };
      });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function ConsumerOne() {
    useRunnerStatus();
    return <div data-testid="c1" />;
  }

  function ConsumerTwo() {
    useRunnerStatus();
    return <div data-testid="c2" />;
  }

  it('shares one WebSocket between the Canvas and the toolbar [R-PJ-24]', () => {
    const { unmount: unmountFirst } = render(<ConsumerOne />);
    expect(createEventsClientSpy).toHaveBeenCalledTimes(1);

    const { unmount: unmountSecond } = render(<ConsumerTwo />);
    expect(createEventsClientSpy).toHaveBeenCalledTimes(1);

    unmountFirst();
    expect(closeSpy).not.toHaveBeenCalled();

    unmountSecond();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the dev server state next to the project name [R-PJ-24]', async () => {
    render(<RunnerStatusBadge />);

    const badge = await screen.findByTestId('runner-status-badge');
    await waitFor(() => {
      expect(badge.getAttribute('data-state')).toBe('ready');
      expect(badge.textContent).toContain('Đang chạy');
    });

    expect(capturedOnEvent).toBeDefined();

    act(() => {
      capturedOnEvent?.({
        v: 1,
        type: 'runner.status',
        at: new Date().toISOString(),
        payload: { state: 'crashed' },
      });
    });

    await waitFor(() => {
      expect(badge.getAttribute('data-state')).toBe('crashed');
      expect(badge.textContent).toContain('Dừng đột ngột');
    });
  });
});
