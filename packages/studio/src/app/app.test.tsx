import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventsClientOptions } from '../api/events-client.ts';
import { initI18n } from '../i18n/i18n.ts';
import { App } from './app.tsx';

/** The event socket is driven by the tests through the captured callback. */
let socket: EventsClientOptions | undefined;
vi.mock('../api/events-client.ts', () => ({
  createEventsClient: (options: EventsClientOptions) => {
    socket = options;
    return { close: () => undefined, isConnected: () => false };
  },
}));

const respond = (status: number, body: unknown) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

const session = (workspace: unknown) => ({ data: { version: '1.4.0', workspace } });

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
  sessionStorage.setItem('reactcraft.sessionToken', 'tok');
  socket = undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows Welcome with the version and folder, sending the session token [S-07]', async () => {
    const fetchMock = respond(200, session({ state: 'none', directory: 'D:\\Shop' }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect((await screen.findByTestId('studio-version')).textContent).toBe('Version 1.4.0');
    expect(screen.getByRole('heading').textContent).toBe('Welcome to ReactCraft');
    expect(screen.getByTestId('workspace-directory').textContent).toBe('D:\\Shop');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/session', {
      headers: { Accept: 'application/json', Authorization: 'Bearer tok' },
    });
  });

  it('opens the editor of an open workspace', async () => {
    const open = { state: 'open', id: 'ws00000001', name: 'Shop', revision: 42, trusted: true };
    vi.stubGlobal('fetch', respond(200, session(open)));

    render(<App />);

    expect(await screen.findByTestId('editor')).toBeDefined();
    expect(screen.getByText('Shop')).toBeDefined();
    expect(screen.getByText('revision 42')).toBeDefined();
  });

  it('lists the broken files of a workspace in error [R-WS-01, R-WS-02]', async () => {
    const error = {
      state: 'error',
      error: { code: 'E004' },
      problems: [{ file: '.reactcraft/pages/p_abc.json', code: 'E004' }],
    };
    vi.stubGlobal('fetch', respond(200, session(error)));

    render(<App />);

    expect((await screen.findByTestId('problem-file')).textContent).toBe(
      '.reactcraft/pages/p_abc.json',
    );
  });

  it('shows a translated E014 message when the session is invalid', async () => {
    vi.stubGlobal('fetch', respond(401, { error: { code: 'E014', details: [] } }));

    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This session is invalid');
    expect(alert.textContent).toContain('(E014)');
  });

  it('switches the language at once without reloading', async () => {
    vi.stubGlobal('fetch', respond(200, session({ state: 'none' })));
    render(<App />);
    await screen.findByTestId('studio-version');

    fireEvent.change(screen.getByTestId('language-select'), { target: { value: 'vi' } });

    expect(await screen.findByText('Phiên bản 1.4.0')).toBeDefined();
    expect(document.documentElement.lang).toBe('vi');
  });

  it('reports an unreachable server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );

    render(<App />);

    expect((await screen.findByRole('alert')).textContent).toContain('Cannot reach');
  });

  it('locks the screen while the connection is lost and refreshes on reconnect', async () => {
    const fetchMock = respond(200, session({ state: 'none' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await screen.findByTestId('studio-version');

    act(() => socket?.onConnectionChange?.(false));
    expect(screen.queryByTestId('connection-lost')).toBeNull();
    act(() => socket?.onConnectionChange?.(true));
    act(() => socket?.onConnectionChange?.(false));

    expect(screen.getByTestId('connection-lost').textContent).toContain('Lost connection');
    expect(screen.getByTestId('studio-version').closest('[inert]')).not.toBeNull();

    act(() => socket?.onConnectionChange?.(true));
    expect(screen.queryByTestId('connection-lost')).toBeNull();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
