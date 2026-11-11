import type { FileTreeEntry } from '@kumicraft/shared';
import { create } from 'zustand';

import { fetchFileTree } from '../../api/files-client.ts';
import type { ErrorInfo } from '../../routes/error-text.ts';

export type InlineAction =
  | { readonly kind: 'newFile' | 'newFolder'; readonly dir: string }
  | { readonly kind: 'rename'; readonly path: string; readonly oldName: string };

export type FilesState = {
  readonly treeData: Readonly<Record<string, readonly FileTreeEntry[]>>;
  readonly expandedDirs: ReadonlySet<string>;
  readonly loadingDirs: ReadonlySet<string>;
  readonly selectedPath?: string | undefined;
  readonly inlineAction?: InlineAction | undefined;
  readonly projectId?: string | undefined;
  /** Why the last tree action that changed project settings failed. */
  readonly actionError?: ErrorInfo | undefined;

  readonly setProjectId: (id?: string) => void;
  readonly loadDir: (dir: string, force?: boolean) => Promise<void>;
  readonly toggleDir: (dir: string) => Promise<void>;
  readonly expandParents: (filePath: string) => Promise<void>;
  readonly refreshAffected: (paths: readonly string[]) => Promise<void>;
  /** Reads every folder shown again: Undo/Redo can create or delete files (K10, macOS CI). */
  readonly refreshLoaded: () => Promise<void>;
  readonly setSelectedPath: (path?: string) => void;
  readonly setInlineAction: (action?: InlineAction) => void;
  readonly setActionError: (error?: ErrorInfo) => void;
  readonly reset: () => void;
};

function storageKey(projectId?: string): string {
  return `kumicraft.files.${projectId ?? 'default'}`;
}

function readStoredExpanded(projectId?: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === 'string'));
    }
  } catch {
    // Ignore storage parse errors
  }
  return new Set();
}

function persistExpanded(projectId: string | undefined, expanded: ReadonlySet<string>): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify([...expanded]));
  } catch {
    // Ignore storage write errors
  }
}

async function fetchDirectoryEntries(
  dir: string,
  set: (updater: (s: FilesState) => Partial<FilesState>) => void,
): Promise<readonly FileTreeEntry[]> {
  set((s) => {
    const next = new Set(s.loadingDirs);
    next.add(dir);
    return { loadingDirs: next };
  });
  try {
    const listing = await fetchFileTree(dir);
    set((s) => ({
      treeData: { ...s.treeData, [dir]: listing.entries },
    }));
    return listing.entries;
  } finally {
    set((s) => {
      const next = new Set(s.loadingDirs);
      next.delete(dir);
      return { loadingDirs: next };
    });
  }
}

function findParentDirs(filePath: string): readonly string[] {
  const parts = filePath.split('/');
  const parents: string[] = [];
  let current = '';
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (part !== undefined) {
      current = current ? `${current}/${part}` : part;
      parents.push(current);
    }
  }
  return parents;
}

export type FlattenedItem = {
  readonly entry: FileTreeEntry;
  readonly level: number;
};

export function flattenDirectory(
  treeData: Readonly<Record<string, readonly FileTreeEntry[]>>,
  expanded: ReadonlySet<string>,
  dir: string,
  level: number,
): readonly FlattenedItem[] {
  const entries = treeData[dir];
  if (!entries) return [];
  const items: FlattenedItem[] = [];
  for (const entry of entries) {
    items.push({ entry, level });
    if (entry.kind === 'directory' && expanded.has(entry.path)) {
      items.push(...flattenDirectory(treeData, expanded, entry.path, level + 1));
    }
  }
  return items;
}

function createToggleDir(
  set: (updater: (s: FilesState) => Partial<FilesState>) => void,
  get: () => FilesState,
) {
  return async (dir: string) => {
    const { expandedDirs, projectId, loadDir } = get();
    const next = new Set(expandedDirs);
    if (next.has(dir)) {
      next.delete(dir);
      set(() => ({ expandedDirs: next }));
      persistExpanded(projectId, next);
      return;
    }
    next.add(dir);
    set(() => ({ expandedDirs: next }));
    persistExpanded(projectId, next);
    await loadDir(dir);
  };
}

function createExpandParents(
  set: (updater: (s: FilesState) => Partial<FilesState>) => void,
  get: () => FilesState,
) {
  return async (filePath: string) => {
    const parents = findParentDirs(filePath);
    if (parents.length === 0) return;
    const { expandedDirs, projectId, loadDir } = get();
    const next = new Set(expandedDirs);
    let changed = false;
    for (const p of parents) {
      if (!next.has(p)) {
        next.add(p);
        changed = true;
      }
    }
    if (changed) {
      set(() => ({ expandedDirs: next }));
      persistExpanded(projectId, next);
    }
    for (const p of parents) {
      await loadDir(p);
    }
  };
}

function createRefreshAffected(get: () => FilesState) {
  return async (paths: readonly string[]) => {
    const { treeData, loadDir } = get();
    const dirsToRefresh = new Set<string>();
    for (const p of paths) {
      const idx = p.lastIndexOf('/');
      const dir = idx === -1 ? '' : p.slice(0, idx);
      if (treeData[dir] !== undefined) {
        dirsToRefresh.add(dir);
      }
    }
    for (const dir of dirsToRefresh) {
      await loadDir(dir, true);
    }
  };
}

function createSetProjectId(set: (partial: Partial<FilesState>) => void, get: () => FilesState) {
  return (projectId: string | undefined) => {
    const stored = readStoredExpanded(projectId);
    if (projectId === get().projectId) {
      set({ expandedDirs: stored });
      return;
    }
    // Another project: the folders read so far belong to the one before (spec-log #115).
    set({
      projectId,
      expandedDirs: stored,
      treeData: {},
      loadingDirs: new Set(),
      selectedPath: undefined,
      inlineAction: undefined,
      actionError: undefined,
    });
  };
}

export const useFilesStore = create<FilesState>((set, get) => ({
  treeData: {},
  expandedDirs: new Set(),
  loadingDirs: new Set(),
  selectedPath: undefined,
  inlineAction: undefined,
  projectId: undefined,

  setProjectId: createSetProjectId(set, get),

  loadDir: async (dir, force = false) => {
    const { treeData, loadingDirs } = get();
    if (!force && treeData[dir] !== undefined) return;
    if (loadingDirs.has(dir)) return;
    await fetchDirectoryEntries(dir, set);
  },

  toggleDir: createToggleDir(set, get),
  expandParents: createExpandParents(set, get),
  refreshAffected: createRefreshAffected(get),
  refreshLoaded: async () => {
    const { treeData, loadDir } = get();
    for (const dir of Object.keys(treeData)) await loadDir(dir, true);
  },

  setSelectedPath: (selectedPath) => {
    set({ selectedPath });
  },

  setInlineAction: (inlineAction) => {
    set({ inlineAction });
  },

  setActionError: (actionError) => {
    set({ actionError });
  },

  reset: () => {
    set({
      actionError: undefined,
      treeData: {},
      expandedDirs: new Set(),
      loadingDirs: new Set(),
      selectedPath: undefined,
      inlineAction: undefined,
      projectId: undefined,
    });
  },
}));
