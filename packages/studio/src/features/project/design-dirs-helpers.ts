import { DEFAULT_DESIGN_DIRS, type DesignDirs, type StyleFiles } from '@kumicraft/shared';
import type { TFunction } from 'i18next';

import { saveDesignDirs } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useProjectStore } from './project-store.ts';

export type DirsKind = 'pages' | 'layouts' | 'components';

export function toInitialList(
  input: readonly string[] | string | undefined,
  fallback: readonly string[],
): string[] {
  if (Array.isArray(input) && input.length > 0) return input.map((s) => String(s));
  if (typeof input === 'string' && input.trim()) return [input.trim()];
  return [...fallback];
}

export function addDirToList(list: readonly string[]): string[] {
  return list.length < 10 ? [...list, ''] : [...list];
}

export function removeDirFromList(list: readonly string[], idx: number): string[] {
  return list.length > 1 ? list.filter((_, i) => i !== idx) : [...list];
}

export function moveDirToTop(list: readonly string[], idx: number): string[] {
  if (idx <= 0 || idx >= list.length) return [...list];
  const item = list[idx];
  return item !== undefined ? [item, ...list.filter((_, i) => i !== idx)] : [...list];
}

export function updateDirInList(list: readonly string[], idx: number, val: string): string[] {
  const next = [...list];
  next[idx] = val;
  return next;
}

export async function executeSaveDesignDirs(
  pages: readonly string[],
  layouts: readonly string[],
  components: readonly string[],
  newCssDir: string,
  styleFiles: StyleFiles | undefined,
  tError: TFunction<'errors'>,
  onSaved?: (updated: DesignDirs, styleFiles?: StyleFiles) => void,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const p = pages.map((d) => d.trim()).filter((d) => d.length > 0);
    const l = layouts.map((d) => d.trim()).filter((d) => d.length > 0);
    const c = components.map((d) => d.trim()).filter((d) => d.length > 0);

    const payload: DesignDirs = {
      pages: p.length > 0 ? p : [DEFAULT_DESIGN_DIRS.pages[0] ?? 'src/pages'],
      layouts: l.length > 0 ? l : [DEFAULT_DESIGN_DIRS.layouts[0] ?? 'src/layouts'],
      components: c.length > 0 ? c : [DEFAULT_DESIGN_DIRS.components[0] ?? 'src/components'],
    };

    const cleanCss = newCssDir.trim();
    const updatedSf: StyleFiles | undefined =
      cleanCss || styleFiles?.tokenFile
        ? {
            ...(cleanCss ? { newCssDir: cleanCss } : {}),
            ...(styleFiles?.tokenFile ? { tokenFile: styleFiles.tokenFile } : {}),
          }
        : undefined;

    const projectRes = await saveDesignDirs(payload, updatedSf);
    useProjectStore.getState().setProject(projectRes);
    onSaved?.(payload, updatedSf);
    return { success: true };
  } catch (err) {
    const info = toErrorInfo(err);
    return { error: errorText(tError, info.code, info.params) };
  }
}

export function useDirListMutations(
  setPages: React.Dispatch<React.SetStateAction<string[]>>,
  setLayouts: React.Dispatch<React.SetStateAction<string[]>>,
  setComponents: React.Dispatch<React.SetStateAction<string[]>>,
) {
  const mutateList = (k: DirsKind, fn: (cur: readonly string[]) => string[]) => {
    if (k === 'pages') setPages((prev) => fn(prev));
    else if (k === 'layouts') setLayouts((prev) => fn(prev));
    else setComponents((prev) => fn(prev));
  };
  return {
    addDir: (k: DirsKind) => {
      mutateList(k, addDirToList);
    },
    removeDir: (k: DirsKind, idx: number) => {
      mutateList(k, (l) => removeDirFromList(l, idx));
    },
    moveToTop: (k: DirsKind, idx: number) => {
      mutateList(k, (l) => moveDirToTop(l, idx));
    },
    updateDir: (k: DirsKind, idx: number, val: string) => {
      mutateList(k, (l) => updateDirInList(l, idx, val));
    },
  };
}
