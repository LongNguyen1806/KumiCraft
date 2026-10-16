// Unit tests for the project's page in the Canvas (R-RN-21 to R-RN-24, S-102).
import type { Frame } from '@reactcraft/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { BRIDGE_READY_TIMEOUT_MS, IframeFrame } from './canvas-frame.tsx';

const ORIGIN = 'http://127.0.0.1:5173';
const desktop: Frame = { id: 'desktop', label: 'Desktop', width: 1440, height: 900 };
const mobile: Frame = { id: 'mobile', label: 'Mobile', width: 375, height: 812 };

function renderFrame(props: Partial<Parameters<typeof IframeFrame>[0]> = {}) {
  return render(
    <IframeFrame
      origin={ORIGIN}
      nonce={'n'.repeat(22)}
      frame={desktop}
      zoom={1}
      mode="design"
      logTail={['vite v8 ready', 'error: plugin failed']}
      {...props}
    />,
  );
}

function loadPage(): void {
  fireEvent.load(screen.getByTestId('canvas-iframe'));
}

describe('IframeFrame', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens the page the user was on [R-RN-21]', () => {
    useSelectionStore.getState().setRoute('/products?page=2');

    renderFrame();

    expect(screen.getByTestId('canvas-iframe').getAttribute('src')).toBe(
      `${ORIGIN}/products?page=2`,
    );
  });

  it('a frame change resizes the iframe without loading the page again [R-RN-22]', () => {
    const view = renderFrame();
    const iframe = screen.getByTestId('canvas-iframe');
    useSelectionStore.getState().setRoute('/elsewhere');

    view.rerender(
      <IframeFrame
        origin={ORIGIN}
        nonce={'n'.repeat(22)}
        frame={mobile}
        zoom={1}
        mode="design"
        logTail={[]}
      />,
    );

    expect(screen.getByTestId('canvas-iframe')).toBe(iframe);
    expect(iframe.getAttribute('src')).toBe(`${ORIGIN}/`);
    expect(iframe.style.width).toBe('375px');
  });

  it('switching to preview sends set-mode and keeps the channel attached [R-RN-23, S-102]', () => {
    const attach = vi.spyOn(studioBridgeChannel, 'attach').mockImplementation(() => undefined);
    const detach = vi.spyOn(studioBridgeChannel, 'detach');
    const setMode = vi.spyOn(studioBridgeChannel, 'setMode');
    const view = renderFrame();
    loadPage();
    expect(attach).toHaveBeenCalledTimes(1);

    view.rerender(
      <IframeFrame
        origin={ORIGIN}
        nonce={'n'.repeat(22)}
        frame={desktop}
        zoom={1}
        mode="preview"
        logTail={[]}
      />,
    );

    expect(setMode).toHaveBeenLastCalledWith('preview');
    expect(detach).not.toHaveBeenCalled();
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('warns with the dev server log when the Bridge stays silent for 10 s [R-RN-24]', () => {
    vi.useFakeTimers();
    vi.spyOn(studioBridgeChannel, 'attach').mockImplementation(() => undefined);
    renderFrame();
    loadPage();

    act(() => {
      vi.advanceTimersByTime(BRIDGE_READY_TIMEOUT_MS - 1);
    });
    expect(screen.queryByTestId('canvas-bridge-warning')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('canvas-bridge-warning')).toBeDefined();
    fireEvent.click(screen.getByTestId('canvas-bridge-log-btn'));
    expect(screen.getByTestId('canvas-bridge-log').textContent).toContain('error: plugin failed');
  });

  it('shows no warning when the Bridge says ready in time [R-RN-24]', () => {
    vi.useFakeTimers();
    vi.spyOn(studioBridgeChannel, 'attach').mockImplementation(() => undefined);
    renderFrame();
    loadPage();

    act(() => {
      useSelectionStore.getState().setBridgeReady(true);
      vi.advanceTimersByTime(BRIDGE_READY_TIMEOUT_MS);
    });

    expect(screen.queryByTestId('canvas-bridge-warning')).toBeNull();
  });
});
