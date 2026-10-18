// Keyboard shortcut actions and matching (SPEC-04 section 19, R-KB-12, R-KB-13).

export const SHORTCUT_ACTIONS = [
  'undo',
  'redo',
  'duplicate',
  'remove',
  'wrap',
  'unwrap',
  'moveUp',
  'moveDown',
  'selectParent',
  'zoomIn',
  'zoomOut',
  'zoomReset',
  'zoomFit',
  'togglePreview',
  'openInEditor',
  'frame1',
  'frame2',
  'frame3',
  'frame4',
  'frame5',
  'frame6',
  'frame7',
  'frame8',
  'togglePanels',
  'showShortcuts',
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

export type KeyPress = {
  readonly key: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
};

/** R-KB-10: keys that still run while typing in a Studio field. */
export const WORKS_WHILE_TYPING: readonly ShortcutAction[] = ['togglePreview', 'showShortcuts'];

function matchModKey(k: string, press: KeyPress, apple: boolean): ShortcutAction | undefined {
  if (k === 'z') {
    return press.shift ? 'redo' : 'undo';
  }
  if (k === 'y' && !apple && !press.shift) {
    return 'redo';
  }
  if (k === 'd' && !press.shift) {
    return 'duplicate';
  }
  if (k === 'g') {
    return press.shift ? 'unwrap' : 'wrap';
  }
  if (k === 'arrowup' && !press.shift) {
    return 'moveUp';
  }
  if (k === 'arrowdown' && !press.shift) {
    return 'moveDown';
  }
  if ((k === '=' || k === '+') && !press.alt) {
    return 'zoomIn';
  }
  if (k === '-' && !press.shift && !press.alt) {
    return 'zoomOut';
  }
  if (k === '\\' && !press.shift) {
    return 'togglePanels';
  }
  if (k === '/' || k === '?') {
    return 'showShortcuts';
  }
  return undefined;
}

function matchNoModKey(k: string, press: KeyPress): ShortcutAction | undefined {
  if (press.ctrl || press.meta || press.alt) return undefined;
  if (press.shift) {
    if (k === '0' || k === ')') return 'zoomReset';
    if (k === '1' || k === '!') return 'zoomFit';
    return undefined;
  }
  if (k === 'delete' || k === 'backspace') return 'remove';
  if (k === 'escape') return 'selectParent';
  if (k >= '1' && k <= '8') {
    return `frame${k}` as ShortcutAction;
  }
  return undefined;
}

/** R-KB-12: the one table. `apple`: Cmd is Mod, Ctrl+Y is not Redo (R-KB-13). */
export function matchShortcut(press: KeyPress, apple: boolean): ShortcutAction | undefined {
  const modPressed = apple ? press.meta : press.ctrl;
  const otherModPressed = apple ? press.ctrl : press.meta;
  const k = press.key.toLowerCase();

  // Mod shortcuts cannot have the opposing mod or alt (unless explicitly allowed)
  if (modPressed && !otherModPressed && !press.alt) {
    return matchModKey(k, press, apple);
  }

  // Alt shortcuts (Alt+P, Alt+E)
  if (press.alt && !press.ctrl && !press.meta && !press.shift) {
    if (k === 'p') return 'togglePreview';
    if (k === 'e') return 'openInEditor';
    return undefined;
  }

  return matchNoModKey(k, press);
}

const LABELS_APPLE: Record<ShortcutAction, string> = {
  undo: '⌘Z',
  redo: '⌘⇧Z',
  duplicate: '⌘D',
  remove: 'Delete',
  wrap: '⌘G',
  unwrap: '⌘⇧G',
  moveUp: '⌘↑',
  moveDown: '⌘↓',
  selectParent: 'Esc',
  zoomIn: '⌘+',
  zoomOut: '⌘-',
  zoomReset: 'Shift+0',
  zoomFit: 'Shift+1',
  togglePreview: 'Alt+P',
  openInEditor: 'Alt+E',
  frame1: '1',
  frame2: '2',
  frame3: '3',
  frame4: '4',
  frame5: '5',
  frame6: '6',
  frame7: '7',
  frame8: '8',
  togglePanels: '⌘\\',
  showShortcuts: '⌘/',
};

const LABELS_OTHER: Record<ShortcutAction, string> = {
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Shift+Z',
  duplicate: 'Ctrl+D',
  remove: 'Delete',
  wrap: 'Ctrl+G',
  unwrap: 'Ctrl+Shift+G',
  moveUp: 'Ctrl+↑',
  moveDown: 'Ctrl+↓',
  selectParent: 'Esc',
  zoomIn: 'Ctrl++',
  zoomOut: 'Ctrl+-',
  zoomReset: 'Shift+0',
  zoomFit: 'Shift+1',
  togglePreview: 'Alt+P',
  openInEditor: 'Alt+E',
  frame1: '1',
  frame2: '2',
  frame3: '3',
  frame4: '4',
  frame5: '5',
  frame6: '6',
  frame7: '7',
  frame8: '8',
  togglePanels: 'Ctrl+\\',
  showShortcuts: 'Ctrl+/',
};

/** Label of the keys for the help dialog: `⌘⇧Z` on macOS, `Ctrl+Shift+Z` elsewhere. */
export function shortcutLabel(action: ShortcutAction, apple: boolean): string {
  return apple ? LABELS_APPLE[action] : LABELS_OTHER[action];
}
