// @vitest-environment happy-dom
// "Done by AI" Library tile: dark mode opens a description and hands the job to the AI tab.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { useDesignStore } from '../design/design-store.ts';
import { getRightPanelTab } from '../editor/right-panel-store.ts';
import { LibraryAiTasks } from './library-ai-tasks.tsx';

beforeAll(async () => {
  await initI18n();
  await i18next.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  useChatStore.getState().setDraft('');
  useDesignStore.getState().setTarget(undefined);
});

describe('LibraryAiTasks', () => {
  it('asks the AI for dark mode on the page open on the Canvas only', () => {
    useDesignStore.getState().setTarget({
      kind: 'draft',
      name: 'BanNhap1',
      file: 'src/drafts/BanNhap1.tsx',
      route: '/__kumicraft/draft/BanNhap1',
    });
    render(<LibraryAiTasks query="" />);

    fireEvent.click(screen.getByTestId('library-ai-dark-mode'));
    expect(screen.getByTestId('library-ai-dark-mode-target').textContent).toContain(
      'src/drafts/BanNhap1.tsx',
    );

    fireEvent.click(screen.getByTestId('library-ai-dark-mode-ask'));
    const draft = useChatStore.getState().draft;
    expect(draft).toContain('src/drafts/BanNhap1.tsx');
    expect(draft).toContain('/__kumicraft/draft/BanNhap1');
    expect(draft).toContain('do not edit other pages');
    expect(getRightPanelTab()).toBe('chat');
  });

  it('asks to open a page first when none is open', () => {
    render(<LibraryAiTasks query="" />);
    fireEvent.click(screen.getByTestId('library-ai-dark-mode'));
    expect(screen.getByTestId('library-ai-dark-mode-target').textContent).toContain('Open a page');
    const ask = screen.getByTestId('library-ai-dark-mode-ask');
    expect(ask instanceof HTMLButtonElement && ask.disabled).toBe(true);
    fireEvent.click(ask);
    expect(useChatStore.getState().draft).toBe('');
  });

  it('follows the Library search', () => {
    render(<LibraryAiTasks query="dark" />);
    expect(screen.getByTestId('library-ai-dark-mode')).toBeTruthy();
    cleanup();
    render(<LibraryAiTasks query="pricing" />);
    expect(screen.queryByTestId('library-ai-tasks')).toBeNull();
  });
});
