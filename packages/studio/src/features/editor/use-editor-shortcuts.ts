// Keyboard shortcuts of the Editor frame (SPEC-04 section 19). `Mod` is Cmd on macOS, Ctrl on
// Windows and Linux. Keys the browser keeps for itself are avoided: Cmd+[ / Cmd+] go back and
// forward on macOS, Cmd+Y opens the history in Chrome on macOS (R-KB-13).
import { useEffect, useRef } from 'react';

import { isApplePlatform } from '../../app/platform.ts';

export type ShortcutActions = {
  /** Undo and Redo come with the history of M-HI (WP-1.06). */
  readonly undo?: () => void;
  readonly redo?: () => void;
  readonly togglePanels: () => void;
};

export type ShortcutName = keyof ShortcutActions;

/**
 * Typing in a field keeps the browser's own undo for that field. Reads properties instead of
 * `instanceof`, because the target may come from the Canvas iframe, which has its own classes.
 */
export function isTypingTarget(element: EventTarget | undefined): boolean {
  if (element === undefined) return false;
  const editable = 'isContentEditable' in element && element.isContentEditable === true;
  const tag = 'tagName' in element && typeof element.tagName === 'string' ? element.tagName : '';
  return editable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
}

type KeyPress = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

/** The action of a key press on this computer, if it is a shortcut of the frame. */
export function shortcutFor(
  event: KeyPress,
  apple: boolean = isApplePlatform(),
): ShortcutName | undefined {
  const hasMod = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!hasMod || event.altKey) return undefined;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !apple) return 'redo';
  if (event.key === '\\') return 'togglePanels';
  return undefined;
}

export function useEditorShortcuts(actions: ShortcutActions): void {
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = shortcutFor(event);
      if (action === undefined || isTypingTarget(event.target ?? undefined)) return;
      const run = latest.current[action];
      if (run === undefined) return;
      event.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
