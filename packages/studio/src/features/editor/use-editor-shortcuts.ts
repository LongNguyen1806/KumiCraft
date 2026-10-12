// Keyboard shortcuts of the Editor frame (SPEC-04.1 section 15). `Mod` is Cmd on macOS, Ctrl on
// Windows and Linux. Keys the browser keeps for itself are avoided: Cmd+[ / Cmd+] go back and
// forward on macOS, Cmd+Y opens the history in Chrome on macOS (spec-log #81).
import { useEffect, useRef } from 'react';

import { isApplePlatform } from '../../app/platform.ts';

export type ShortcutActions = {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly togglePanels: () => void;
};

/** Typing in a field keeps the browser's own undo for that field. */
function isTyping(target: unknown): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

type KeyPress = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

/** The action of a key press on this computer, if it is a shortcut of the frame. */
export function shortcutFor(
  event: KeyPress,
  apple: boolean = isApplePlatform(),
): keyof ShortcutActions | undefined {
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
      if (action === undefined || isTyping(event.target)) return;
      event.preventDefault();
      latest.current[action]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
