import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { WorkspaceErrorScreen } from '../../routes/workspace-error-screen.tsx';
import { formatBackupTime } from './format-backup-time.ts';

const PAGE = '.reactcraft/pages/p_abc.json';
const TOKENS = '.reactcraft/tokens.json';
const BACKUPS = [
  {
    id: `.reactcraft~pages~p_abc.json.20261011-090000-000.json`,
    file: PAGE,
    createdAt: '20261011-090000-000',
  },
  {
    id: `.reactcraft~pages~p_abc.json.20261010-090000-000.json`,
    file: PAGE,
    createdAt: '20261010-090000-000',
  },
];

type Call = { readonly url: string; readonly method: string };
let calls: Call[];

/** Answers GET /workspace/backups with BACKUPS and every POST with `post`. */
const stubApi = (post: { status: number; body: unknown } = { status: 200, body: { data: {} } }) => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      const isList = url.endsWith('/workspace/backups');
      const reply = isList ? { status: 200, body: { data: { backups: BACKUPS } } } : post;
      return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status }));
    }),
  );
};

const problems = [
  { file: PAGE, code: 'E004' },
  { file: TOKENS, code: 'E003' },
];

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

describe('WorkspaceErrorScreen', () => {
  it('offers the latest backup only for files that have one [R-WS-02]', async () => {
    stubApi();
    render(<WorkspaceErrorScreen version="1" problems={problems} onChanged={vi.fn()} />);

    expect(
      await screen.findAllByRole('button', { name: 'Restore the latest backup' }),
    ).toHaveLength(1);
    expect(screen.getByText('This file has no backup yet. Fix it by hand.')).toBeDefined();
    expect(screen.getAllByTestId('problem-file').map((node) => node.textContent)).toEqual([
      PAGE,
      TOKENS,
    ]);
  });

  it('restores the newest backup, then asks the Studio to read the session again', async () => {
    stubApi();
    const onChanged = vi.fn();
    render(<WorkspaceErrorScreen version="1" problems={problems} onChanged={onChanged} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore the latest backup' }));

    await vi.waitFor(() => {
      expect(onChanged).toHaveBeenCalledOnce();
    });
    expect(calls.at(-1)).toEqual({
      url: `/api/v1/workspace/backups/${encodeURIComponent(BACKUPS[0]?.id ?? '')}/restore`,
      method: 'POST',
    });
  });

  it('reads the files again on Try again', async () => {
    stubApi();
    const onChanged = vi.fn();
    render(<WorkspaceErrorScreen version="1" problems={problems} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await vi.waitFor(() => {
      expect(onChanged).toHaveBeenCalledOnce();
    });
    expect(calls.at(-1)).toEqual({ url: '/api/v1/workspace/reload', method: 'POST' });
  });

  it('shows the error of a failed restore and keeps the buttons usable', async () => {
    stubApi({ status: 500, body: { error: { code: 'E011', details: [] } } });
    const onChanged = vi.fn();
    render(<WorkspaceErrorScreen version="1" problems={problems} onChanged={onChanged} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore the latest backup' }));

    expect((await screen.findByRole('alert')).textContent).toContain('(E011)');
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveProperty('disabled', false);
  });
});

describe('formatBackupTime', () => {
  it('turns a UTC stamp into a readable date and keeps an unknown stamp as it is', () => {
    expect(formatBackupTime('20261011-080910-123', 'en')).toMatch(/2026/);
    expect(formatBackupTime('not-a-stamp', 'en')).toBe('not-a-stamp');
  });
});
