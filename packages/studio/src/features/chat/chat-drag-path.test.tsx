import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { ChatInput } from './chat-input.tsx';
import { useChatStore } from './chat-store.ts';

describe('Chat drag-and-drop path [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useChatStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it('[WP-4.00] test 20: dropping application/x-kumicraft-path adds file to context, shows error when at 10 docs limit', () => {
    render(<ChatInput />);
    const input = screen.getByTestId('chat-input');
    const container = input.closest('div');
    expect(container).toBeDefined();

    fireEvent.drop(container as HTMLElement, {
      dataTransfer: {
        getData: (format: string) =>
          format === 'application/x-kumicraft-path' ? 'src/App.tsx' : '',
        files: [],
      },
    });

    expect(useChatStore.getState().docs).toEqual(['src/App.tsx']);

    // Fill docs to 10 items
    for (let i = 1; i < 10; i += 1) {
      useChatStore.getState().addDoc(`doc-${String(i)}`);
    }
    expect(useChatStore.getState().docs).toHaveLength(10);

    // Drop the 11th item
    fireEvent.drop(container as HTMLElement, {
      dataTransfer: {
        getData: (format: string) =>
          format === 'application/x-kumicraft-path' ? 'src/extra.tsx' : '',
        files: [],
      },
    });

    expect(screen.getByTestId('chat-doc-error')).toBeDefined();
    expect(useChatStore.getState().docs).toHaveLength(10);
  });
});
