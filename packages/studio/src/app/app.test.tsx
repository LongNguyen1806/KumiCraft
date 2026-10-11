import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../i18n/i18n.ts';
import { App } from './app.tsx';

const respond = (status: number, body: unknown) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
  sessionStorage.setItem('reactcraft.sessionToken', 'tok');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the name and the server version, sending the session token [S-07]', async () => {
    const fetchMock = respond(200, { data: { version: '1.4.0' } });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByTestId('studio-version')).toHaveProperty(
      'textContent',
      'Version 1.4.0',
    );
    expect(screen.getByRole('heading').textContent).toBe('ReactCraft');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/session', {
      headers: { Accept: 'application/json', Authorization: 'Bearer tok' },
    });
  });

  it('shows a translated E014 message when the session is invalid', async () => {
    vi.stubGlobal('fetch', respond(401, { error: { code: 'E014', details: [] } }));

    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This session is invalid');
    expect(alert.textContent).toContain('(E014)');
  });

  it('switches the language at once without reloading', async () => {
    vi.stubGlobal('fetch', respond(200, { data: { version: '2.0.0' } }));
    render(<App />);
    await screen.findByTestId('studio-version');

    fireEvent.change(screen.getByTestId('language-select'), { target: { value: 'vi' } });

    expect(await screen.findByText('Phiên bản 2.0.0')).toBeDefined();
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
});
