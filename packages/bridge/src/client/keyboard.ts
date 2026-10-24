// Keyboard shortcut forwarding for bridge (R-BR-18, R-KB-10, R-KB-12).
import { type KeyPress, matchShortcut } from '@kumicraft/shared';

/** Check if the target is a typing element without relying on prototype instanceof. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  if (el.isContentEditable === true) return true;
  if (typeof el.tagName === 'string') {
    const tag = el.tagName.toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }
  return false;
}

export function toKeyPress(event: KeyboardEvent): KeyPress {
  return {
    key: event.key,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
    alt: event.altKey,
  };
}

export function shouldForwardShortcut(
  event: KeyboardEvent,
  mode: 'design' | 'preview',
  textEditingActive: boolean,
  isMac: boolean,
): boolean {
  if (mode !== 'design' || textEditingActive) return false;
  if (isTypingTarget(event.target)) return false;
  const action = matchShortcut(toKeyPress(event), isMac);
  return action !== undefined;
}
