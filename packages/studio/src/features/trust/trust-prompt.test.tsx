import type { BackendInfo } from '@reactcraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { EditorScreen } from '../../routes/editor-screen.tsx';
import { TrustPrompt } from './trust-prompt.tsx';

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

  it('displays projectRoot in trust-root when provided [S-80]', () => {
    stubServer();
    render(
      <TrustPrompt
        projectId="shop000001"
        projectName="Shop"
        projectRoot="/path/to/shop"
        backends={[]}
        onTrusted={vi.fn()}
      />,
    );

    expect(screen.getByTestId('trust-root').textContent).toBe('/path/to/shop');
  });

  it('lists backends with resolvedPath and without relative path [S-80]', () => {
    stubServer();
    const backends: BackendInfo[] = [
      {
        id: 'api0000001',
        label: 'Shop API',
        path: '../api',
        resolvedPath: '/workspace/work/api',
        outsideParent: false,
        status: 'ok',
      },
      {
        id: 'auth000001',
        label: 'Auth API',
        path: '../auth',
        resolvedPath: '/workspace/work/auth',
        outsideParent: false,
        status: 'ok',
      },
    ];

    render(
      <TrustPrompt
        projectId="shop000001"
        projectName="Shop"
        backends={backends}
        onTrusted={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('trust-backend');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('Shop API');
    expect(items[0]?.textContent).toContain('/workspace/work/api');
    expect(items[0]?.textContent).not.toContain('../api');
    expect(items[1]?.textContent).toContain('Auth API');
    expect(items[1]?.textContent).toContain('/workspace/work/auth');
    expect(items[1]?.textContent).not.toContain('../auth');
  });

  it('shows warning note for backend outside parent directory [S-80]', () => {
    stubServer();
    const backends: BackendInfo[] = [
      {
        id: 'api0000001',
        label: 'Shop API',
        path: '../api',
        resolvedPath: '/workspace/work/api',
        outsideParent: false,
        status: 'ok',
      },
      {
        id: 'ext0000001',
        label: 'Secret API',
        path: '/secrets/api',
        resolvedPath: '/secrets/api',
        outsideParent: true,
        status: 'ok',
      },
    ];

    render(
      <TrustPrompt
        projectId="shop000001"
        projectName="Shop"
        backends={backends}
        onTrusted={vi.fn()}
      />,
    );

    const outsideWarnings = screen.getAllByTestId('trust-backend-outside');
    expect(outsideWarnings).toHaveLength(1);
    expect(outsideWarnings[0]?.textContent).toBe(
      'Outside the folder that holds the project, check carefully',
    );
    expect(outsideWarnings[0]?.getAttribute('role')).toBe('note');
  });

  it('shows no-backends when empty, and loading when backends is undefined [S-80]', () => {
    stubServer();
    render(
      <TrustPrompt projectId="shop000001" projectName="Shop" backends={[]} onTrusted={vi.fn()} />,
    );

    expect(screen.getByTestId('trust-no-backends').textContent).toBe('No linked backends');
    expect(screen.queryByTestId('trust-loading')).toBeNull();

    cleanup();

    render(
      <TrustPrompt
        projectId="shop000001"
        projectName="Shop"
        backends={undefined}
        onTrusted={vi.fn()}
      />,
    );

    expect(screen.getByTestId('trust-loading').textContent).toBe('Loading project details…');
    expect(screen.queryByTestId('trust-no-backends')).toBeNull();
  });

  it('shows backend status when status is blocked [S-80]', () => {
    stubServer();
    const backends: BackendInfo[] = [
      {
        id: 'sys0000001',
        label: 'System Folder',
        path: '/etc',
        resolvedPath: '/etc',
        outsideParent: true,
        status: 'blocked',
      },
    ];

    render(
      <TrustPrompt
        projectId="shop000001"
        projectName="Shop"
        backends={backends}
        onTrusted={vi.fn()}
      />,
    );

    expect(screen.getByTestId('trust-backend-status').textContent).toBe(
      'Blocked: system or sensitive folder',
    );
  });
});
