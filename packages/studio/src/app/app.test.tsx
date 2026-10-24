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

const SETTINGS = { data: { editor: 'vscode', agent: { preferred: 'auto' } } };

/** Answers `GET /session` (and anything else) with `body`; `GET /settings` with the defaults. */
const respond = (status: number, body: unknown) =>
  vi.fn((url: string) => {
    const answer = url === '/api/v1/settings' && status === 200 ? SETTINGS : body;
    return Promise.resolve(new Response(JSON.stringify(answer), { status }));
  });

/** Number of `GET /session` calls (settings are read with each session). */
const sessionCalls = (fetchMock: { readonly mock: { readonly calls: readonly unknown[][] } }) =>
  fetchMock.mock.calls.filter(([url]) => url === '/api/v1/session').length;

const session = (project: unknown) => ({
  data: { version: '1.4.0', platform: 'win32', features: [], project },
});

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
  sessionStorage.clear();
  sessionStorage.setItem('kumicraft.sessionToken', 'tok');
  localStorage.clear();
  socket = undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('says no project is open, with the version and folder, sending the session token [S-07]', async () => {
    const fetchMock = respond(200, session({ state: 'none', suggestedPath: 'D:\\Shop' }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect((await screen.findByTestId('studio-version')).textContent).toBe('Version 1.4.0');
    expect(screen.getByRole('heading').textContent).toBe('No project is open');
    expect(screen.getByTestId('project-folder').textContent).toBe('D:\\Shop');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/session', {
      headers: { Accept: 'application/json', Authorization: 'Bearer tok' },
    });
  });

  it('opens the editor of a trusted project with its name and no trust bar', async () => {
    const open = { state: 'open', id: 'shop000001', name: 'Shop', trusted: true };
    vi.stubGlobal('fetch', respond(200, session(open)));

    render(<App />);

    expect(await screen.findByTestId('editor')).toBeDefined();
    expect(screen.getByTestId('project-name').textContent).toBe('Shop');
    expect(screen.getByTestId('trust-status').textContent).toBe('Trusted project');
    expect(screen.queryByTestId('trust-bar')).toBeNull();
  });

  it('explains a broken or old project file without offering to overwrite it [V-105]', async () => {
    const error = {
      state: 'error',
      error: {
        code: 'E003',
        params: { file: '.kumicraft/workspace.json', reason: 'unsupportedVersion' },
        details: [{ message: 'schemaVersion 1 is not supported' }],
      },
    };
    vi.stubGlobal('fetch', respond(200, session(error)));

    render(<App />);

    expect((await screen.findByTestId('project-error')).textContent).toContain('(E003)');
    expect(screen.getByText(/older KumiCraft/)).toBeDefined();
    expect(screen.getByText('schemaVersion 1 is not supported')).toBeDefined();
    expect(screen.queryByRole('button', { name: /restore|overwrite/i })).toBeNull();
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
    expect(screen.getByRole('heading').textContent).toBe('Chưa mở dự án nào');
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
      expect(sessionCalls(fetchMock)).toBe(2);
    });
  });

  it('shows the stopped banner immediately when server.shuttingDown arrives [R-CL-02]', async () => {
    const fetchMock = respond(200, session({ state: 'none' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await screen.findByTestId('studio-version');

    act(() => socket?.onConnectionChange?.(true));
    act(() =>
      socket?.onEvent?.({
        v: 1,
        type: 'server.shuttingDown',
        at: '2026-10-20T00:00:00Z',
        payload: {},
      }),
    );

    expect(screen.getByTestId('connection-lost').textContent).toContain('KumiCraft has stopped');
  });
});
