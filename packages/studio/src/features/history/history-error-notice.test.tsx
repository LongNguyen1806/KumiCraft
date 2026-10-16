// Unit tests for the failed Undo/Redo notice (R-HI-10).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { HistoryErrorNotice } from './history-error-notice.tsx';
import { useHistoryStore } from './history-store.ts';

describe('HistoryErrorNotice [R-HI-10]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
    useHistoryStore.getState().reset();
  });

  it('says which file was changed elsewhere, in the UI language', async () => {
    useHistoryStore.setState({ error: { code: 'E017', file: 'src/pages/Home.tsx' } });

    await i18next.changeLanguage('vi');
    const view = render(<HistoryErrorNotice />);
    expect(screen.getByTestId('history-error').textContent).toContain(
      'File src/pages/Home.tsx đã bị sửa từ nơi khác, không hoàn tác được bước này',
    );
    view.unmount();

    await i18next.changeLanguage('en');
    render(<HistoryErrorNotice />);
    const english = screen.getByTestId('history-error').textContent;
    expect(english).toContain('src/pages/Home.tsx');
    expect(english).not.toContain('đã bị sửa');
  });

  it('closes with the dismiss button', () => {
    useHistoryStore.setState({ error: { code: 'E017', file: 'src/A.tsx' } });
    render(<HistoryErrorNotice />);

    fireEvent.click(screen.getByTestId('history-error-dismiss'));

    expect(screen.queryByTestId('history-error')).toBeNull();
  });

  it('shows nothing when the last Undo worked', () => {
    render(<HistoryErrorNotice />);

    expect(screen.queryByTestId('history-error')).toBeNull();
  });
});
