// Unit tests for the page list on the Canvas toolbar (R-PG-15).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudioServerEvent } from '../../api/events-client.ts';
import * as eventsClient from '../../api/events-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useActivityStore } from '../shell/activity-store.ts';
import { PageSelect } from './page-select.tsx';
import { usePanelLayoutStore } from './use-panel-layout.ts';

/** Options of pages: direct children of the select, so the Drafts group (R-DR-13) is left out. */
const pageOptions = (select: HTMLElement) =>
  [...select.querySelectorAll('option')].filter((o) => o.parentElement === select);

describe('PageSelect [R-PG-15]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    vi.spyOn(projectClient, 'fetchPages').mockResolvedValue({
      convention: false,
      router: { status: 'none', hasRouterPackage: false },
      pages: [
        { path: '/', component: 'Dashboard', dynamic: false },
        { path: '/login', component: 'Login', dynamic: false },
        { path: '/product/:id', component: 'Product', dynamic: true },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lists the pages of the project and marks the page on screen', async () => {
    useSelectionStore.getState().setRoute('/login');
    render(<PageSelect />);

    const select = screen.getByTestId('canvas-page-select');
    await waitFor(() => {
      expect(pageOptions(select)).toHaveLength(4);
    });
    expect(select).toHaveProperty('value', '/login');
    expect(screen.getByText('Product — /product/:id')).toBeDefined();
    expect(select.querySelector('optgroup option[value="draft:new"]')).not.toBeNull();
  });

  it('shows a picked page in the Canvas', async () => {
    const navigate = vi.spyOn(studioBridgeChannel, 'navigate').mockImplementation(() => undefined);
    render(<PageSelect />);
    await waitFor(() => {
      expect(pageOptions(screen.getByTestId('canvas-page-select'))).toHaveLength(4);
    });

    fireEvent.change(screen.getByTestId('canvas-page-select'), { target: { value: '/login' } });

    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('asks the value of :id before showing a dynamic page', async () => {
    const navigate = vi.spyOn(studioBridgeChannel, 'navigate').mockImplementation(() => undefined);
    render(<PageSelect />);
    await waitFor(() => {
      expect(pageOptions(screen.getByTestId('canvas-page-select'))).toHaveLength(4);
    });

    fireEvent.change(screen.getByTestId('canvas-page-select'), {
      target: { value: '/product/:id' },
    });
    expect(navigate).not.toHaveBeenCalled();
    const input = screen.getByTestId('canvas-page-param');
    expect(input).toHaveProperty('value', '/product/:id');

    fireEvent.change(input, { target: { value: '/product/42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(navigate).toHaveBeenCalledWith('/product/42');
    expect(screen.queryByTestId('canvas-page-param')).toBeNull();
  });

  it('reads the pages again after a Studio edit, which only the history reports [K3d]', async () => {
    const handlers: ((event: StudioServerEvent) => void)[] = [];
    vi.spyOn(eventsClient, 'createEventsClient').mockImplementation((options) => {
      if (options?.onEvent) handlers.push(options.onEvent);
      return { close: vi.fn(), isConnected: () => true };
    });
    const fetchSpy = vi.spyOn(projectClient, 'fetchPages');
    render(<PageSelect />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const before = fetchSpy.mock.calls.length;

    for (const handler of handlers) {
      handler({ v: 1, type: 'history.changed', at: new Date().toISOString(), payload: {} });
    }

    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('Test 10: clicking pages-manage sets active=pages, opens left panel without dialog; similar for drafts-manage [WP-4.00, R-PG-15]', () => {
    useActivityStore.getState().setActive('layers');
    usePanelLayoutStore.getState().toggle('left');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(false);

    render(<PageSelect />);

    // Click pages-manage
    fireEvent.click(screen.getByTestId('pages-manage'));
    expect(useActivityStore.getState().active).toBe('pages');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(true);
    expect(screen.queryByRole('dialog') ?? undefined).toBeUndefined();

    // Collapse left panel and click drafts-manage
    usePanelLayoutStore.getState().toggle('left');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(false);

    fireEvent.click(screen.getByTestId('drafts-manage'));
    expect(useActivityStore.getState().active).toBe('drafts');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(true);
    expect(screen.queryByRole('dialog') ?? undefined).toBeUndefined();

    // Clicking pages-manage while already open keeps it open (does not collapse)
    fireEvent.click(screen.getByTestId('pages-manage'));
    expect(useActivityStore.getState().active).toBe('pages');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(true);
    expect(screen.queryByRole('dialog') ?? undefined).toBeUndefined();
  });
});
