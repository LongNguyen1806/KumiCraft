// Studio colours (P5 round 4): `data-theme` on <html> switches the colour variables of styles.css.
// "system" follows the computer and changes with it. The last choice is also kept in this browser,
// so the next start draws the right colours before the settings arrive from the server.
import type { Theme } from '../api/settings-client.ts';

const STORAGE_KEY = 'kumicraft.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

let current: Theme = 'system';
let watching = false;

function systemIsDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

function paint(): void {
  const dark = current === 'dark' || (current === 'system' && systemIsDark());
  document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
}

function watchSystem(): void {
  if (watching || typeof window.matchMedia !== 'function') return;
  watching = true;
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (current === 'system') paint();
  });
}

const isTheme = (value: string | undefined): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

function readSaved(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Applies a theme now and remembers it in this browser. */
export function applyTheme(theme: Theme | undefined): void {
  current = theme ?? 'system';
  watchSystem();
  paint();
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    // Private windows may refuse storage; the server keeps the choice anyway.
  }
}

/** Called once at start, before the first render. */
export function applyRememberedTheme(): void {
  const saved = readSaved();
  applyTheme(isTheme(saved) ? saved : 'system');
}
