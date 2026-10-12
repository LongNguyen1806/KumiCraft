import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { EditorScreen } from '../../routes/editor-screen.tsx';
import { sampleDocument } from '../../store/test-support.ts';
import { isOutsideWorkspace } from './trust-prompt.tsx';

/** A workspace pulled from Git that points to folders, one of them outside it. */
function linkedDocument() {
  const document = sampleDocument(3);
  return {
    ...document,
    workspace: {
      ...document.workspace,
      targetProject: { path: '../web' },
      backends: [{ id: 'b_api0000001', path: 'C:\\Windows\\System32', label: 'API' }],
    },
  };
}

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
      if (url.endsWith('/workspace/trust')) {
        const body = trustStatus === 200 ? { data: {} } : { error: { code: 'E011' } };
        return Promise.resolve(new Response(JSON.stringify(body), { status: trustStatus }));
      }
      const data = { document: linkedDocument(), revision: 3 };
      return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 }));
    }),
  );
}

const openUntrusted = async (onTrusted = vi.fn()) => {
  render(<EditorScreen trusted={false} onTrusted={onTrusted} />);
  await screen.findByTestId('frame');
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

describe('workspace trust in the Studio', () => {
  it('asks on first open and lists the linked folders, warning about outside ones [S-80]', async () => {
    stubServer();
    await openUntrusted();

    expect(screen.getByRole('dialog', { name: 'Do you trust this workspace?' })).toBeDefined();
    const links = screen.getByTestId('trust-links').textContent;
    expect(links).toContain('../web');
    expect(links).toContain('C:\\Windows\\System32');
    expect(screen.getAllByText(/Outside the workspace folder/)).toHaveLength(2);
  });

  it('keeps restricted mode with a warning bar when the user declines, and asks once per tab [S-81]', async () => {
    stubServer();
    await openUntrusted();

    fireEvent.click(screen.getByRole('button', { name: 'Not now, only view and edit the design' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('trust-bar').textContent).toContain('not trusted');
    cleanup();
    await openUntrusted();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('trusts the workspace from the bar and lets the Studio read the session again', async () => {
    stubServer();
    sessionStorage.setItem('reactcraft.trustAsked.ws00000001', '1');
    const onTrusted = await openUntrusted();

    fireEvent.click(screen.getByRole('button', { name: 'Review and trust' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trust this workspace' }));

    await vi.waitFor(() => {
      expect(onTrusted).toHaveBeenCalledOnce();
    });
    expect(calls.find((call) => call.url.endsWith('/workspace/trust'))).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ trusted: true }),
    });
  });

  it('says why trusting failed', async () => {
    stubServer(500);
    const onTrusted = await openUntrusted();

    fireEvent.click(screen.getByRole('button', { name: 'Trust this workspace' }));

    expect((await screen.findByRole('alert')).textContent).toContain('(E011)');
    expect(onTrusted).not.toHaveBeenCalled();
  });

  it('shows nothing about trust for a trusted workspace', async () => {
    stubServer();
    render(<EditorScreen trusted onTrusted={vi.fn()} />);
    await screen.findByTestId('frame');

    expect(screen.queryByTestId('trust-bar')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('isOutsideWorkspace', () => {
  it('flags absolute paths and paths going up, not folders inside', () => {
    const paths = [
      '../api',
      '..',
      'C:\\Windows',
      'D:/data',
      '/etc',
      '\\\\server\\share',
      'backend',
      './web',
      'apps/api',
    ];

    expect(paths.map(isOutsideWorkspace)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
