// A tool that would add a second system to the project hands the job to the AI tab (plan K9.8).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { initI18n } from '../../../../i18n/i18n.ts';
import { useChatStore } from '../../../chat/chat-store.ts';
import { getRightPanelTab } from '../../../editor/right-panel-store.ts';
import { InteractionErrorNotice } from './interaction-shared.tsx';

beforeAll(async () => {
  await initI18n();
  await i18next.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  useChatStore.getState().setDraft('');
});

describe('Ask AI from an interaction tool [QA K9.8-1]', () => {
  it('puts the prepared request in the chat box and opens the AI tab', () => {
    const prompt = 'Show the notice "Added" with sonner when src/Shop.tsx:4:7 is clicked.';
    render(<InteractionErrorNotice error="This project already uses sonner." aiPrompt={prompt} />);

    fireEvent.click(screen.getByTestId('interaction-ask-ai'));

    expect(useChatStore.getState().draft).toBe(prompt);
    expect(getRightPanelTab()).toBe('chat');
  });

  it('shows a plain error without the button when the job is not for the AI', () => {
    render(<InteractionErrorNotice error="Only for <button>." />);
    expect(screen.queryByTestId('interaction-ask-ai')).toBeNull();
    expect(screen.getByTestId('interaction-error').textContent).toContain('Only for <button>.');
  });
});
