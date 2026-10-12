// Keyboard shortcuts of the Editor frame (SPEC-04.1 section 15). `Mod` is Ctrl, or Cmd on macOS.
import { useEffect, useRef } from 'react';

export type ShortcutActions = {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly toggleLeft: () => void;
  readonly toggleRight: () => void;
  readonly toggleBoth: () => void;
};

/** Typing in a field keeps the browser's own undo for that field. */
function isTyping(target: unknown): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** The action of a key press, if it is a shortcut of the frame. */
export function shortcutFor(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
): keyof ShortcutActions | undefined {
  if (!(event.ctrlKey || event.metaKey)) return undefined;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y') return 'redo';
  if (event.key === '[') return 'toggleLeft';
  if (event.key === ']') return 'toggleRight';
  if (event.key === '\\') return 'toggleBoth';
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
