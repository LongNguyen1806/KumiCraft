// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { isTypingTarget, shouldForwardShortcut, toKeyPress } from './keyboard.ts';

describe('Bridge keyboard forwarding [R-BR-18, R-KB-10, R-KB-11]', () => {
  it('Scenario 6: identifies Ctrl+Z in design mode for forwarding', () => {
    const evt = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const press = toKeyPress(evt);
    expect(press).toEqual({
      key: 'z',
      ctrl: true,
      meta: false,
      shift: false,
      alt: false,
    });

    const shouldForward = shouldForwardShortcut(evt, 'design', false, false);
    expect(shouldForward).toBe(true);
  });

  it('Scenario 7: rejects shortcuts during text editing, preview mode, or typing in page input', () => {
    const zEvt = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    // 1. Text editing active
    expect(shouldForwardShortcut(zEvt, 'design', true, false)).toBe(false);

    // 2. Preview mode
    expect(shouldForwardShortcut(zEvt, 'preview', false, false)).toBe(false);

    // 3. Delete key while focused on input element
    const input = document.createElement('input');
    const deleteEvt = new KeyboardEvent('keydown', {
      key: 'Delete',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(deleteEvt, 'target', { value: input });
    expect(shouldForwardShortcut(deleteEvt, 'design', false, false)).toBe(false);

    // 4. Backspace while focused on textarea
    const textarea = document.createElement('textarea');
    const backspaceEvt = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(backspaceEvt, 'target', { value: textarea });
    expect(shouldForwardShortcut(backspaceEvt, 'design', false, false)).toBe(false);

    // 5. Contenteditable element
    const divEditable = document.createElement('div');
    Object.defineProperty(divEditable, 'isContentEditable', { value: true });
    const editableEvt = new KeyboardEvent('keydown', {
      key: 'Delete',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(editableEvt, 'target', { value: divEditable });
    expect(shouldForwardShortcut(editableEvt, 'design', false, false)).toBe(false);
  });

  it('isTypingTarget correctly identifies input, textarea, select, and contenteditable', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
    expect(isTypingTarget({ isContentEditable: true })).toBe(true);
  });
});
