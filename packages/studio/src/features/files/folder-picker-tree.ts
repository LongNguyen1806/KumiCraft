import type { FileTreeEntry } from '@kumicraft/shared';

export type VisibleItem = {
  readonly entry: FileTreeEntry;
  readonly depth: number;
};

export function filterPickerEntry(
  entry: FileTreeEntry,
  mode: 'folder' | 'file',
  extensions?: readonly string[],
): boolean {
  if (entry.kind === 'directory') return true;
  if (mode === 'folder') return false;
  if (!extensions || extensions.length === 0) return true;
  const lower = entry.name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext.toLowerCase()));
}

export function buildVisibleItems(
  dir: string,
  depth: number,
  treeData: Readonly<Record<string, readonly FileTreeEntry[]>>,
  expandedDirs: ReadonlySet<string>,
  mode: 'folder' | 'file',
  extensions?: readonly string[],
): VisibleItem[] {
  const entries = (treeData[dir] ?? []).filter((e) => filterPickerEntry(e, mode, extensions));
  const result: VisibleItem[] = [];
  for (const entry of entries) {
    result.push({ entry, depth });
    if (entry.kind === 'directory' && expandedDirs.has(entry.path)) {
      result.push(
        ...buildVisibleItems(entry.path, depth + 1, treeData, expandedDirs, mode, extensions),
      );
    }
  }
  return result;
}
