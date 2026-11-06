// Shared helper to trigger AI chat turn for the selected element (SPEC-04 K5, Section 3.5).
import i18next from 'i18next';

import { setRightPanelTab } from '../editor/right-panel-store.ts';
import { useChatStore } from './chat-store.ts';

/**
 * Switches right panel to 'chat' tab, unhides element context, sets draft suggestion
 * if empty, and focuses the chat input textarea without sending automatically.
 */
export function askAiAboutElement(): void {
  setRightPanelTab('chat');
  useChatStore.getState().setHidden('element', false);

  const currentDraft = useChatStore.getState().draft;
  if (!currentDraft.trim()) {
    useChatStore.getState().setDraft(i18next.t('inspector.askAiDraft'));
  }

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
