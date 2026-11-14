// @vitest-environment happy-dom
// "Done by AI" Library tile: dark mode opens a description and hands the job to the AI tab.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { getRightPanelTab } from '../editor/right-panel-store.ts';
import { LibraryAiTasks } from './library-ai-tasks.tsx';

beforeAll(async () => {
  await initI18n();
  await i18next.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  useChatStore.getState().setDraft('');
});

describe('LibraryAiTasks', () => {
  it('opens the dark mode description and sends the prepared request to the AI tab', () => {
    render(<LibraryAiTasks query="" />);

    fireEvent.click(screen.getByTestId('library-ai-dark-mode'));
    expect(screen.getByTestId('library-ai-dark-mode-dialog').textContent).toContain(
      'KumiCraft has no tool for it',
    );

    fireEvent.click(screen.getByTestId('library-ai-dark-mode-ask'));
    expect(useChatStore.getState().draft).toBe(i18next.t('inspector.darkSetupAiPrompt'));
    expect(getRightPanelTab()).toBe('chat');
  });

  it('follows the Library search', () => {
    render(<LibraryAiTasks query="dark" />);
    expect(screen.getByTestId('library-ai-dark-mode')).toBeTruthy();
    cleanup();
    render(<LibraryAiTasks query="pricing" />);
    expect(screen.queryByTestId('library-ai-tasks')).toBeNull();
  });
});
