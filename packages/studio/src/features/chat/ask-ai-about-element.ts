// Shared helper to trigger AI chat turn for the selected element (SPEC-04 K5, Section 3.5).
import i18next from 'i18next';

import { setRightPanelTab } from '../editor/right-panel-store.ts';
import { useChatStore } from './chat-store.ts';

/**
 * Switches right panel to 'chat' tab, unhides element context, sets draft suggestion
 * if empty, and focuses the chat input textarea without sending automatically.
 */
export function askAiAboutElement(): void {
  const currentDraft = useChatStore.getState().draft;
  openChatWith(currentDraft.trim() ? undefined : i18next.t('inspector.askAiDraft'));
}

/**
 * Hands a job to the AI tab with a prepared request (plan K9.8, tools that touch the whole
 * project): the request replaces the draft; the user reads, edits and sends it.
 */
export function askAiWithDraft(draft: string): void {
  openChatWith(draft);
}

function openChatWith(draft: string | undefined): void {
  setRightPanelTab('chat');
  useChatStore.getState().setHidden('element', false);
  if (draft !== undefined) useChatStore.getState().setDraft(draft);

  const focusInput = () => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[data-testid="chat-input"]',
    );
    if (textarea) {
      textarea.focus();
      const len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    }
  };

  focusInput();
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(focusInput);
  }
}
