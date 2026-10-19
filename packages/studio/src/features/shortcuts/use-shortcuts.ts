// Window keyboard shortcuts hook for Studio (SPEC-04 R-KB-10, R-KB-12).
import { type KeyPress, matchShortcut, WORKS_WHILE_TYPING } from '@reactcraft/shared';
import { useEffect } from 'react';

import { isApplePlatform } from '../../app/platform.ts';
import { runShortcut } from './shortcut-actions.ts';

/**
 * Typing in a Studio field prevents non-global shortcuts like Delete/Backspace (R-KB-10).
 * Inspects tagName and isContentEditable without relying on prototype instanceof.
 */
export function isTypingTarget(element: unknown): boolean {
  if (!element || typeof element !== 'object') return false;
  const el = element as { tagName?: unknown; isContentEditable?: unknown };
  if (el.isContentEditable === true) return true;
  if (typeof el.tagName === 'string') {
    const tag = el.tagName.toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }
  return false;
}

function toKeyPress(event: KeyboardEvent): KeyPress {
  return {
    key: event.key,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
    alt: event.altKey,
  };
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const press = toKeyPress(event);
      const apple = isApplePlatform();
      const action = matchShortcut(press, apple);
      if (!action) return;

      if (action === 'copy') {
        const selection = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
        if (selection && selection.length > 0) {
          return;
        }
      }

      if (isTypingTarget(event.target) && !WORKS_WHILE_TYPING.includes(action)) {
        return;
      }
      // R-FF-15: arrows nudge only when no Studio control has focus; a focused resizer, button or
      // tree row keeps its own arrow keys. Arrows pressed in the Canvas arrive through the Bridge.
      if (action.startsWith('nudge') && event.target !== document.body) {
        return;
      }

      const handled = runShortcut(action);
      if (handled) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
