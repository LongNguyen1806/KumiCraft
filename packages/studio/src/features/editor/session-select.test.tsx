// The login session selector stays usable on top of the Canvas and explains itself (spec-log #76).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { sessionLabel } from './session-popover.tsx';
import { SessionSelect } from './session-select.tsx';

const SESSIONS = [
  { id: 1, label: '1' },
  { id: 2, label: 'Farmer' },
];

function renderSelect() {
  return render(
    <div data-testid="toolbar" style={{ overflow: 'hidden' }}>
      <SessionSelect
        sessions={SESSIONS}
        activeSessionId={1}
        runnerOrigin="http://127.0.0.1:5173"
        onSelectSession={vi.fn()}
        onSessionsUpdated={vi.fn()}
      />
    </div>,
  );
}

describe('SessionSelect [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(async () => {
    cleanup();
    await i18next.changeLanguage('vi');
  });

  it('opens its list outside the toolbar, so no toolbar or Canvas clips it, and explains sessions', async () => {
    await i18next.changeLanguage('vi');
    renderSelect();
    const trigger = screen.getByTestId('session-select-trigger');
    expect(trigger.textContent).toBe('Phiên 1');
    expect(trigger.getAttribute('title')).toContain('đăng nhập riêng');
    expect(trigger.getAttribute('title')).toContain('Customer và Farmer');

    fireEvent.click(trigger);
    const popover = screen.getByTestId('session-select-popover');
    expect(screen.getByTestId('toolbar').contains(popover)).toBe(false);

    // Escape closes it; the button opens it again in one click.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('session-select-popover') ?? undefined).toBeUndefined();
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    expect(screen.getByTestId('session-select-popover')).toBeDefined();
  });

  it('names KumiCraft-made sessions in the Studio language and keeps the names users gave', async () => {
    await i18next.changeLanguage('en');
    const t = i18next.getFixedT('en');
    expect(sessionLabel(t, { id: 1, label: '1' })).toBe('Session 1');
    expect(sessionLabel(t, { id: 2, label: 'Phiên 2' })).toBe('Session 2');
    expect(sessionLabel(t, { id: 3, label: 'Farmer' })).toBe('Farmer');
    // A user name that only looks like a number of another session stays as typed.
    expect(sessionLabel(t, { id: 4, label: 'Session 2' })).toBe('Session 2');
  });
});
