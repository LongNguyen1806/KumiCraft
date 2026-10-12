// Keyboard conventions of the user's computer (SPEC-04.1 section 15): `Mod` is Cmd on macOS and
// Ctrl elsewhere, and shortcuts are shown the way that system shows them.

/** macOS (and iPadOS with a keyboard): Cmd is the command key. */
export function isApplePlatform(userAgent: string = navigator.userAgent): boolean {
  return /Mac|iPhone|iPad/.test(userAgent);
}

export type ShortcutName = 'undo' | 'redo' | 'panels';

const APPLE: Record<ShortcutName, string> = { undo: '⌘Z', redo: '⇧⌘Z', panels: '⌘\\' };
const OTHER: Record<ShortcutName, string> = { undo: 'Ctrl+Z', redo: 'Ctrl+Y', panels: 'Ctrl+\\' };

/** How a shortcut is written on this computer, for tooltips. */
export function shortcutLabel(name: ShortcutName, apple: boolean = isApplePlatform()): string {
  return (apple ? APPLE : OTHER)[name];
}
