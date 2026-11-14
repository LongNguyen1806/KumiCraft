// Persistent library style preset per project (TK-69).
import { LIBRARY_STYLES, type LibraryStyle } from '@kumicraft/shared';

const STORAGE_PREFIX = 'kumicraft.libraryStyle.';

export function isLibraryStyle(value: string): value is LibraryStyle {
  return (LIBRARY_STYLES as readonly string[]).includes(value);
}

export function getSelectedStyle(projectId: string | undefined): LibraryStyle {
  if (projectId === undefined || projectId.length === 0) return 'default';
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`) ?? undefined;
    if (raw !== undefined && isLibraryStyle(raw)) {
      return raw;
    }
    return 'default';
  } catch {
    return 'default';
  }
}

export function setSelectedStyle(projectId: string | undefined, style: LibraryStyle): void {
  if (projectId === undefined || projectId.length === 0) return;
  try {
    const key = `${STORAGE_PREFIX}${projectId}`;
    if (style === 'default') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, style);
    }
  } catch {
    // Ignore storage errors (private mode or disabled storage).
  }
}
