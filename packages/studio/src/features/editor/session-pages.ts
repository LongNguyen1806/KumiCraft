// Which login session each page uses (spec-log #78): picking a session while on a page remembers
// it, and opening that page again switches the Canvas to it. Kept per project in this browser.
import type { PageInfo } from '@kumicraft/shared';
import { create } from 'zustand';

export type SessionPages = Readonly<Record<string, number>>;

const storageKey = (projectId: string) => `kumicraft.sessionPages.${projectId}`;

export function readSessionPages(projectId: string | undefined): SessionPages {
  if (projectId === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(projectId)) ?? '{}');
    if (typeof parsed !== 'object' || !parsed || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isInteger(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeSessionPages(projectId: string | undefined, pages: SessionPages): void {
  if (projectId === undefined) return;
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(pages));
  } catch {
    // Storage full or blocked: the mapping lasts until the tab closes.
  }
}

function patternMatches(pattern: string, route: string): boolean {
  const escaped = pattern
    .split('/')
    .map((part) => (part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${escaped}/?$`).test(route);
}

/**
 * The key a route is remembered under: the page pattern it matches (`/admin/farmers/:id` for
 * `/admin/farmers/5`), the most specific one first; a route no page knows is its own key.
 */
export function pageKeyOf(route: string, pages: readonly PageInfo[]): string {
  const path = route.split(/[?#]/)[0] ?? route;
  const matches = pages
    .map((p) => p.path)
    .filter((pattern) => !pattern.includes('*') && patternMatches(pattern, path))
    .sort((a, b) => b.split(':').length - a.split(':').length || b.length - a.length);
  // A literal match beats one with parameters (`/farmers/new` before `/farmers/:id`).
  const literal = matches.find((pattern) => !pattern.includes(':'));
  return literal ?? matches[0] ?? path;
}

/** The session a page is tied to, if that session still exists. */
export function sessionForPage(
  map: SessionPages,
  key: string,
  sessionIds: readonly number[],
): number | undefined {
  const id = map[key];
  return id !== undefined && sessionIds.includes(id) ? id : undefined;
}

/** Lets the "page has no session" notice open the session picker. */
export const useSessionPickerStore = create<{
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}>((set) => ({
  open: false,
  setOpen: (open) => {
    set({ open });
  },
}));
