import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { EditorScreen } from '../../routes/editor-screen.tsx';

type Call = { readonly url: string; readonly method: string; readonly body?: string };
let calls: Call[];

function stubServer(trustStatus = 200) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method ?? 'GET',
        ...(init?.body === undefined ? {} : { body: init.body as string }),
      });
      const body = trustStatus === 200 ? { data: {} } : { error: { code: 'E011' } };
      return Promise.resolve(new Response(JSON.stringify(body), { status: trustStatus }));
    }),
  );
}

const openUntrusted = (onTrusted = vi.fn()) => {
  render(
    <EditorScreen
      projectId="shop000001"
      projectName="Shop"
      trusted={false}
      onTrusted={onTrusted}
    />,
  );
  return onTrusted;
};

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
  sessionStorage.clear();
  sessionStorage.setItem('reactcraft.sessionToken', 'tok');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('project trust in the Studio', () => {
  it('asks on first open, naming the project and what stays locked [S-80]', () => {
    stubServer();
    openUntrusted();

    expect(screen.getByRole('dialog', { name: 'Do you trust this project?' })).toBeDefined();
    expect(screen.getByTestId('trust-project').textContent).toBe('Shop');
    expect(screen.getByText(/does not start its dev server/)).toBeDefined();
  });

  it('keeps restricted mode with a warning bar when the user declines, and asks once per tab [S-81]', () => {
    stubServer();
    openUntrusted();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('trust-bar').textContent).toContain('not trusted');
    expect(screen.getByTestId('trust-status').textContent).toContain('Restricted mode');
    cleanup();
    openUntrusted();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('trusts the project from the bar and lets the Studio read the session again', async () => {
    stubServer();
    sessionStorage.setItem('reactcraft.trustAsked.shop000001', '1');
    const onTrusted = openUntrusted();

    fireEvent.click(screen.getByRole('button', { name: 'Review and trust' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trust this project' }));

    await vi.waitFor(() => {
      expect(onTrusted).toHaveBeenCalledOnce();
    });
    expect(calls.find((call) => call.url.endsWith('/project/trust'))).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ trusted: true }),
    });
  });

  it('says why trusting failed', async () => {
    stubServer(500);
    const onTrusted = openUntrusted();

    fireEvent.click(screen.getByRole('button', { name: 'Trust this project' }));

    expect((await screen.findByRole('alert')).textContent).toContain('(E011)');
    expect(onTrusted).not.toHaveBeenCalled();
  });

  it('shows nothing about trust for a trusted project', () => {
    stubServer();
    render(<EditorScreen projectId="shop000001" projectName="Shop" trusted onTrusted={vi.fn()} />);

    expect(screen.queryByTestId('trust-bar')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
