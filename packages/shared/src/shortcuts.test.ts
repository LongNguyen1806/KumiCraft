import { describe, expect, it } from 'vitest';

import { type KeyPress, matchShortcut, shortcutLabel } from './shortcuts.ts';

function makePress(
  key: string,
  modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {},
): KeyPress {
  return {
    key,
    ctrl: modifiers.ctrl ?? false,
    meta: modifiers.meta ?? false,
    shift: modifiers.shift ?? false,
    alt: modifiers.alt ?? false,
  };
}

describe('matchShortcut (R-KB-12, R-KB-13)', () => {
  it('Scenario 1: undo, redo, and platform differences for Ctrl+Y/Cmd+Y', () => {
    // Windows / Linux (apple = false)
    expect(matchShortcut(makePress('z', { ctrl: true }), false)).toBe('undo');
    expect(matchShortcut(makePress('Z', { ctrl: true }), false)).toBe('undo');
    expect(matchShortcut(makePress('z', { ctrl: true, shift: true }), false)).toBe('redo');
    expect(matchShortcut(makePress('y', { ctrl: true }), false)).toBe('redo');

    // macOS (apple = true)
    expect(matchShortcut(makePress('z', { meta: true }), true)).toBe('undo');
    expect(matchShortcut(makePress('Z', { meta: true }), true)).toBe('undo');
    expect(matchShortcut(makePress('z', { meta: true, shift: true }), true)).toBe('redo');
    // Cmd+Y on Mac is NOT redo (returns undefined)
    expect(matchShortcut(makePress('y', { meta: true }), true)).toBeUndefined();
    // Ctrl+Y on Mac is not redo either
    expect(matchShortcut(makePress('y', { ctrl: true }), true)).toBeUndefined();
  });

  it('Scenario 2: common shortcuts and modifier conflicts', () => {
    // Ctrl+D -> duplicate
    expect(matchShortcut(makePress('d', { ctrl: true }), false)).toBe('duplicate');
    // Delete -> remove
    expect(matchShortcut(makePress('Delete'), false)).toBe('remove');
    // Backspace -> remove
    expect(matchShortcut(makePress('Backspace'), false)).toBe('remove');
    // Ctrl+G -> wrap
    expect(matchShortcut(makePress('g', { ctrl: true }), false)).toBe('wrap');
    // Ctrl+Shift+G -> unwrap
    expect(matchShortcut(makePress('g', { ctrl: true, shift: true }), false)).toBe('unwrap');
    // Ctrl+ArrowUp -> moveUp
    expect(matchShortcut(makePress('ArrowUp', { ctrl: true }), false)).toBe('moveUp');
    // Escape -> selectParent
    expect(matchShortcut(makePress('Escape'), false)).toBe('selectParent');
    // '3' -> frame3
    expect(matchShortcut(makePress('3'), false)).toBe('frame3');
    // Shift+1 ('!') -> zoomFit
    expect(matchShortcut(makePress('!', { shift: true }), false)).toBe('zoomFit');
    expect(matchShortcut(makePress('1', { shift: true }), false)).toBe('zoomFit');
    // Ctrl+'+' -> zoomIn
    expect(matchShortcut(makePress('+', { ctrl: true }), false)).toBe('zoomIn');
    expect(matchShortcut(makePress('=', { ctrl: true }), false)).toBe('zoomIn');
    // Alt+P -> togglePreview
    expect(matchShortcut(makePress('p', { alt: true }), false)).toBe('togglePreview');
    // Ctrl+/ -> showShortcuts
    expect(matchShortcut(makePress('/', { ctrl: true }), false)).toBe('showShortcuts');

    // Disallowed modifier combinations
    // Ctrl+Alt+D cannot match duplicate
    expect(matchShortcut(makePress('d', { ctrl: true, alt: true }), false)).toBeUndefined();
    // Cmd+Ctrl+Z cannot match (both mods pressed)
    expect(matchShortcut(makePress('z', { ctrl: true, meta: true }), false)).toBeUndefined();
    expect(matchShortcut(makePress('z', { ctrl: true, meta: true }), true)).toBeUndefined();
  });

  it('Scenario 3: shortcutLabel for Mac and other platforms', () => {
    expect(shortcutLabel('redo', true)).toBe('⌘⇧Z');
    expect(shortcutLabel('redo', false)).toBe('Ctrl+Shift+Z');
    expect(shortcutLabel('undo', true)).toBe('⌘Z');
    expect(shortcutLabel('undo', false)).toBe('Ctrl+Z');
    expect(shortcutLabel('showShortcuts', true)).toBe('⌘/');
    expect(shortcutLabel('showShortcuts', false)).toBe('Ctrl+/');
  });

  it('Scenario 8: matchShortcut Ctrl+C, Ctrl+X, Ctrl+V, Cmd+V (apple), Ctrl+Shift+V [R-KB]', () => {
    expect(matchShortcut(makePress('c', { ctrl: true }), false)).toBe('copy');
    expect(matchShortcut(makePress('x', { ctrl: true }), false)).toBe('cut');
    expect(matchShortcut(makePress('v', { ctrl: true }), false)).toBe('paste');
    expect(matchShortcut(makePress('v', { meta: true }), true)).toBe('paste');
    expect(matchShortcut(makePress('v', { ctrl: true, shift: true }), false)).toBeUndefined();
    expect(shortcutLabel('copy', true)).toBe('⌘C');
    expect(shortcutLabel('copy', false)).toBe('Ctrl+C');
    expect(shortcutLabel('cut', true)).toBe('⌘X');
    expect(shortcutLabel('cut', false)).toBe('Ctrl+X');
    expect(shortcutLabel('paste', true)).toBe('⌘V');
    expect(shortcutLabel('paste', false)).toBe('Ctrl+V');
  });

  it('Scenario 1: matchShortcut ArrowLeft, Shift+ArrowUp, Ctrl+ArrowUp (Windows) [R-FF-15]', () => {
    expect(matchShortcut(makePress('ArrowLeft'), false)).toBe('nudgeLeft');
    expect(matchShortcut(makePress('ArrowUp', { shift: true }), false)).toBe('nudgeUpFine');
    expect(matchShortcut(makePress('ArrowUp', { ctrl: true }), false)).toBe('moveUp');
    expect(matchShortcut(makePress('ArrowRight'), false)).toBe('nudgeRight');
    expect(matchShortcut(makePress('ArrowDown'), false)).toBe('nudgeDown');
    expect(matchShortcut(makePress('ArrowLeft', { shift: true }), false)).toBe('nudgeLeftFine');
    expect(matchShortcut(makePress('ArrowRight', { shift: true }), false)).toBe('nudgeRightFine');
    expect(matchShortcut(makePress('ArrowDown', { shift: true }), false)).toBe('nudgeDownFine');
    expect(shortcutLabel('nudgeLeft', false)).toBe('←');
    expect(shortcutLabel('nudgeUpFine', false)).toBe('Shift+↑');
    expect(shortcutLabel('nudgeUpFine', true)).toBe('⇧↑');
  });

  it('Scenario 1: matchShortcut v, f, t, i, Ctrl+V, Shift+F [R-DT-10]', () => {
    expect(matchShortcut(makePress('v'), false)).toBe('toolSelect');
    expect(matchShortcut(makePress('f'), false)).toBe('toolFrame');
    expect(matchShortcut(makePress('t'), false)).toBe('toolText');
    expect(matchShortcut(makePress('i'), false)).toBe('toolImage');
    expect(matchShortcut(makePress('v', { ctrl: true }), false)).toBe('paste');
    expect(matchShortcut(makePress('f', { shift: true }), false)).toBeUndefined();
    expect(shortcutLabel('toolSelect', false)).toBe('V');
    expect(shortcutLabel('toolFrame', true)).toBe('F');
    expect(shortcutLabel('toolText', false)).toBe('T');
    expect(shortcutLabel('toolImage', true)).toBe('I');
  });
});
