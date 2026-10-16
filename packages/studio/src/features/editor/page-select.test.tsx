// Unit tests for the page list on the Canvas toolbar (R-PG-15).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { PageSelect } from './page-select.tsx';

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
      expect(select.querySelectorAll('option')).toHaveLength(4);
    });
    expect(select).toHaveProperty('value', '/login');
    expect(screen.getByText('Product — /product/:id')).toBeDefined();
  });

  it('shows a picked page in the Canvas', async () => {
    const navigate = vi.spyOn(studioBridgeChannel, 'navigate').mockImplementation(() => undefined);
    render(<PageSelect />);
    await waitFor(() => {
      expect(screen.getByTestId('canvas-page-select').querySelectorAll('option')).toHaveLength(4);
    });

    fireEvent.change(screen.getByTestId('canvas-page-select'), { target: { value: '/login' } });

    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('asks the value of :id before showing a dynamic page', async () => {
    const navigate = vi.spyOn(studioBridgeChannel, 'navigate').mockImplementation(() => undefined);
    render(<PageSelect />);
    await waitFor(() => {
      expect(screen.getByTestId('canvas-page-select').querySelectorAll('option')).toHaveLength(4);
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
});
