// Per-project persistent favorite library blocks (K9.7-3; the Recent row was dropped 2026-11-15).
const FAVORITES_PREFIX = 'kumicraft.libraryFavorites.';

function readIdList(key: string): readonly string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

function writeIdList(key: string, items: readonly string[]): void {
  try {
    if (items.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch {
    // Ignore storage errors (private mode or disabled storage).
  }
}

export function getFavoriteBlocks(projectId: string | undefined): readonly string[] {
  if (projectId === undefined || projectId.length === 0) return [];
  return readIdList(`${FAVORITES_PREFIX}${projectId}`);
}

export function toggleFavoriteBlock(
  projectId: string | undefined,
  blockId: string,
): readonly string[] {
  if (projectId === undefined || projectId.length === 0) return [];
  const key = `${FAVORITES_PREFIX}${projectId}`;
  const current = readIdList(key);
  const exists = current.includes(blockId);
  const next = exists ? current.filter((id) => id !== blockId) : [blockId, ...current];
  writeIdList(key, next);
  return next;
}
