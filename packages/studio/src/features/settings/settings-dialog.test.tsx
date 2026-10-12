import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Settings } from '../../api/settings-client.ts';
import { LanguageSwitcher } from '../../app/language-switcher.tsx';
import { initI18n } from '../../i18n/i18n.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { SettingsButton } from './settings-button.tsx';

const DEFAULTS: Settings = { export: { typecheck: true, buildCheck: false } };

type Sent = { readonly method: string; readonly body: unknown };
let sent: Sent[];

/** A settings server: GET answers `stored`, PATCH merges into it, or fails with `failCode`. */
function stubSettings(stored: Settings = DEFAULTS, failCode?: string) {
  let current = stored;
  sent = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body: unknown = init?.body === undefined ? undefined : JSON.parse(init.body as string);
      sent.push({ method, body });
      if (method === 'PATCH' && failCode !== undefined) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: failCode } }), { status: 500 }),
        );
      }
      if (method === 'PATCH') {
        const patch = body as Partial<Settings>;
        current = { ...current, ...patch, export: { ...current.export, ...patch.export } };
      }
      return Promise.resolve(new Response(JSON.stringify({ data: current }), { status: 200 }));
    }),
  );
}

const openSettings = async () => {
  await useSettingsStore.getState().load();
  render(<SettingsButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
};

const patches = () => sent.filter((call) => call.method === 'PATCH').map((call) => call.body);

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
  sessionStorage.setItem('reactcraft.sessionToken', 'tok');
  useSettingsStore.setState({ settings: undefined, save: { status: 'idle' } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Settings dialog', () => {
  it('opens from the gear button and closes again', async () => {
    stubSettings();
    await openSettings();

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('switches the interface language at once and remembers it', async () => {
    stubSettings();
    await openSettings();

    fireEvent.click(screen.getByRole('radio', { name: 'Tiếng Việt' }));

    await vi.waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Cài đặt' })).toBeDefined();
    });
    expect(patches()).toEqual([{ language: 'vi' }]);
  });

  it('saves an export option and says so', async () => {
    stubSettings();
    await openSettings();

    fireEvent.click(screen.getByRole('switch', { name: 'Test-build the project after exporting' }));

    expect(await screen.findByText('Saved')).toBeDefined();
    expect(patches()).toEqual([{ export: { buildCheck: true } }]);
    expect(useSettingsStore.getState().settings?.export).toEqual({
      typecheck: true,
      buildCheck: true,
    });
  });

  it('puts the option back and explains when it cannot be saved', async () => {
    stubSettings(DEFAULTS, 'E011');
    await openSettings();
    const typecheck = screen.getByRole('switch', {
      name: 'Check TypeScript types after exporting',
    });

    fireEvent.click(typecheck);

    expect((await screen.findByRole('alert')).textContent).toContain('(E011)');
    expect(typecheck.getAttribute('aria-checked')).toBe('true');
  });
});

describe('interface language', () => {
  it('applies the saved language when the settings are read', async () => {
    stubSettings({ ...DEFAULTS, language: 'vi' });

    await useSettingsStore.getState().load();

    expect(i18next.resolvedLanguage).toBe('vi');
  });

  it('remembers a choice made with the quick language switch', async () => {
    stubSettings();
    await useSettingsStore.getState().load();
    render(<LanguageSwitcher />);

    fireEvent.change(screen.getByTestId('language-select'), { target: { value: 'vi' } });

    await vi.waitFor(() => {
      expect(patches()).toEqual([{ language: 'vi' }]);
    });
    expect(i18next.resolvedLanguage).toBe('vi');
  });
});
