// @vitest-environment happy-dom
// Unit tests for TextEditController (SPEC-04 section 10 M-TX, R-TX-01..08).
import type { ElementRef } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeText, TextEditController } from './text-edit.ts';

describe('TextEditController [SPEC-04 section 10 M-TX]', () => {
  let targetEl: HTMLDivElement;
  const mockRef: ElementRef = { loc: 'src/App.tsx:10:5', index: 0 };

  beforeEach(() => {
    targetEl = document.createElement('div');
    targetEl.setAttribute('data-rc-loc', mockRef.loc);
    targetEl.textContent = 'Tiêu đề ban đầu';
    document.body.appendChild(targetEl);
  });

  afterEach(() => {
    if (targetEl.parentNode) {
      targetEl.parentNode.removeChild(targetEl);
    }
    vi.restoreAllMocks();
  });

  describe('normalizeText [R-SE-08, R-TX-04]', () => {
    it('collapses newlines and multiple spaces, trims whitespace', () => {
      expect(normalizeText('  Hello\nworld  ')).toBe('Hello world');
      expect(normalizeText('\n\n  Multiple   spaces\r\nand tabs\t  ')).toBe(
        'Multiple spaces and tabs',
      );
      expect(normalizeText('Đã chuẩn hóa')).toBe('Đã chuẩn hóa');
    });
  });

  it('R-TX-02: sets contenteditable and focuses when started', () => {
    const onStart = vi.fn();
    const controller = new TextEditController({
      onCommit: vi.fn(),
      onCancel: vi.fn(),
      onStart,
    });

    controller.start(targetEl, mockRef);

    expect(controller.isActive()).toBe(true);
    expect(controller.getEditingElement()).toBe(targetEl);
    expect(targetEl.getAttribute('contenteditable')).toBeTruthy();
    expect(onStart).toHaveBeenCalledWith(targetEl);

    controller.destroy();
  });

  it('R-TX-03 & Scenario 1: commits on Enter key without shift when text changed', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const controller = new TextEditController({ onCommit, onCancel });

    controller.start(targetEl, mockRef);
    targetEl.textContent = 'Sản phẩm nổi bật';

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    targetEl.dispatchEvent(enterEvent);

    expect(onCommit).toHaveBeenCalledWith(mockRef, 'Sản phẩm nổi bật');
    expect(onCancel).not.toHaveBeenCalled();
    expect(controller.isActive()).toBe(false);
    expect(targetEl.hasAttribute('contenteditable')).toBe(false);
  });

  it('R-TX-03: blocks Shift+Enter without ending edit', () => {
    const onCommit = vi.fn();
    const controller = new TextEditController({ onCommit, onCancel: vi.fn() });

    controller.start(targetEl, mockRef);

    const shiftEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
    });
    targetEl.dispatchEvent(shiftEnter);

    expect(onCommit).not.toHaveBeenCalled();
    expect(controller.isActive()).toBe(true);

    controller.destroy();
  });

  it('R-TX-04 & Scenario 4: cancels when unchanged and Enter is pressed', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const controller = new TextEditController({ onCommit, onCancel });

    controller.start(targetEl, mockRef);
    // Unchanged text
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    targetEl.dispatchEvent(enterEvent);

    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledWith(mockRef);
    expect(controller.isActive()).toBe(false);
  });

  it('R-TX-04 & Scenario 2: cancels and restores original text on Escape', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const controller = new TextEditController({ onCommit, onCancel });

    controller.start(targetEl, mockRef);
    targetEl.textContent = 'Nội dung chưa lưu';

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    targetEl.dispatchEvent(escEvent);

    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledWith(mockRef);
    expect(targetEl.textContent).toBe('Tiêu đề ban đầu');
    expect(controller.isActive()).toBe(false);
  });

  it('R-TX-08 & Scenario 7: does not commit on Enter when IME is composing Vietnamese text', () => {
    const onCommit = vi.fn();
    const controller = new TextEditController({ onCommit, onCancel: vi.fn() });

    controller.start(targetEl, mockRef);

    // Simulate Vietnamese IME composition start (e.g., typing 'a' + 's' -> 'á')
    targetEl.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    targetEl.dispatchEvent(enterEvent);

    expect(onCommit).not.toHaveBeenCalled();
    expect(controller.isActive()).toBe(true);

    // End IME composition
    targetEl.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));

    // Now Enter should commit
    targetEl.textContent = 'Chữ tiếng Việt có dấu';
    targetEl.dispatchEvent(enterEvent);

    expect(onCommit).toHaveBeenCalledWith(mockRef, 'Chữ tiếng Việt có dấu');
  });

  it('Scenario 3: commits when clicking outside target element', () => {
    const onCommit = vi.fn();
    const controller = new TextEditController({ onCommit, onCancel: vi.fn() });

    controller.start(targetEl, mockRef);
    targetEl.textContent = 'Chữ mới đã sửa';

    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);

    const outsidePointerDown = new PointerEvent('pointerdown', { bubbles: true });
    outsideEl.dispatchEvent(outsidePointerDown);

    expect(onCommit).toHaveBeenCalledWith(mockRef, 'Chữ mới đã sửa');
    expect(controller.isActive()).toBe(false);

    document.body.removeChild(outsideEl);
  });

  it('Test 8 (lesson learned): listeners are detached before contenteditable is removed', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const controller = new TextEditController({ onCommit, onCancel });

    controller.start(targetEl, mockRef);

    // Verify cancel removes listeners and does NOT trigger commit
    controller.cancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();

    // Subsequent Enter key does nothing
    targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
