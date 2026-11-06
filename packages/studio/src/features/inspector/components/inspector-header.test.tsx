// Component tests for InspectorHeader and LockBanner (SPEC-04, WP-4.00 M10).
import type { ElementSource } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { useChatStore } from '../../chat/chat-store.ts';
import { getRightPanelTab, setRightPanelTab } from '../../editor/right-panel-store.ts';
import type { InspectorTarget } from '../types.ts';
import { InspectorHeader } from './inspector-header.tsx';

function makeTarget(
  overrides: Partial<Extract<InspectorTarget, { readonly kind: 'element' }>> = {},
): Extract<InspectorTarget, { readonly kind: 'element' }> {
  const defaultSource: ElementSource = {
    loc: 'src/App.tsx:30:5',
    tag: 'div',
    fileHash: 'b'.repeat(64),
    className: { kind: 'expression', code: "cn('p-4', active && 'bg-blue-500')" },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
  };

  return {
    kind: 'element',
    ref: { loc: 'src/App.tsx:30:5', index: 0 },
    locFile: 'src/App.tsx',
    locLine: 30,
    locCol: 5,
    source: defaultSource,
    loading: false,
    warnings: [],
    currentScope: { breakpoint: 'base' },
    writePrefix: '',
    setInteractionState: () => undefined,
    refresh: () => undefined,
    ...overrides,
  };
}

describe('InspectorHeader Component [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('Test M10 [WP-4.00]: Inspector khóa className={cn(...)} có nút ask-ai-element-btn với hành vi tương tự M9', async () => {
    await i18next.changeLanguage('vi');
    setRightPanelTab('properties');
    useChatStore.getState().setHidden('element', true);
    useChatStore.getState().setDraft('');

    const target = makeTarget({
      lockReason: 'classExpression',
      lockCode: "cn('p-4', active && 'bg-blue-500')",
    });

    const { unmount } = render(
      <div>
        <InspectorHeader target={target} />
        <textarea data-testid="chat-input" />
      </div>,
    );

    const lockBanner = screen.getByTestId('lock-banner');
    expect(lockBanner).toBeDefined();
    expect(lockBanner.textContent).toContain("cn('p-4', active && 'bg-blue-500')");

    const askAiBtn = screen.getByTestId('ask-ai-element-btn');
    expect(askAiBtn).toBeDefined();

    fireEvent.click(askAiBtn);

    expect(getRightPanelTab()).toBe('chat');
    expect(useChatStore.getState().hidden.element).toBe(false);
    expect(useChatStore.getState().draft).toBe('Sửa phần tử này: ');

    const textarea = screen.getByTestId<HTMLTextAreaElement>('chat-input');
    expect(document.activeElement).toBe(textarea);

    // Existing draft preserved when clicked again
    useChatStore.getState().setDraft('Hãy thêm flex col');
    fireEvent.click(askAiBtn);
    expect(useChatStore.getState().draft).toBe('Hãy thêm flex col');

    unmount();
  });
});
