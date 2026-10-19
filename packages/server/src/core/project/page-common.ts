// Common types and validation for page operations (R-PG-11 to R-PG-14).
import { DEFAULT_DESIGN_DIRS, type DesignDirs, err, ok, type Result } from '@reactcraft/shared';

import type { HistoryService } from '../history/history-service.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import { checkPathSyntax, isInside } from '../shared/paths.ts';
import type { Platform } from '../shared/session.ts';
import { fileQueueKey, queueFileTask } from '../source-editor/file-queue.ts';

export type PageEditDeps = {
  readonly fs: FileSystemPort;
  readonly history: HistoryService;
  readonly projectRoot: string;
  readonly sourceDir: string;
  readonly platform: Platform;
  readonly language: 'ts' | 'js';
  readonly designDirs: DesignDirs;
};

function isHistoryService(h: unknown): h is HistoryService {
  return !!h && typeof h === 'object' && 'push' in h;
}

export function buildPageEditDeps(
  current: {
    readonly status: string;
    readonly root?: string | undefined;
    readonly file?:
      { readonly sourceDir: string; readonly designDirs?: DesignDirs | undefined } | undefined;
    readonly support?: { readonly language: 'ts' | 'js' } | undefined;
  },
  deps: {
    readonly fs: FileSystemPort;
    readonly history?: unknown;
    readonly platform: Platform;
  },
): Result<PageEditDeps> {
  if (current.status !== 'open' || !current.root || !current.file || !current.support) {
    return err({ code: 'E021', params: { missing: 'project' } });
  }
  if (!isHistoryService(deps.history)) {
    return err({ code: 'E021', params: { missing: 'history' } });
  }
  return ok({
    fs: deps.fs,
    history: deps.history,
    projectRoot: current.root,
    sourceDir: current.file.sourceDir,
    platform: deps.platform,
    language: current.support.language,
    designDirs: current.file.designDirs ?? DEFAULT_DESIGN_DIRS,
  });
}

export type AddPageInput = {
  readonly name: string;
  readonly path?: string | undefined;
  readonly dir?: string | undefined;
  readonly fileName?: string | undefined;
};

export type RenamePageInput = {
  readonly path: string;
  readonly newPath?: string | undefined;
  readonly newName?: string | undefined;
};

export type DeletePageInput = {
  readonly path: string;
};

export function withFileLocks<T>(
  projectRoot: string,
  paths: readonly string[],
  task: () => Promise<T>,
): Promise<T> {
  const [first, ...rest] = [...new Set(paths)].sort();
  if (first === undefined) return task();
  return queueFileTask(fileQueueKey(projectRoot, first), () =>
    withFileLocks(projectRoot, rest, task),
  );
}

export function escapeJsxText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('{', '&#123;')
    .replaceAll('}', '&#125;');
}

export function normalizeRoute(raw: string): string {
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function validateRouteSyntax(route: string): boolean {
  if (route.includes('//') || !/^\/[a-z0-9\-/:]*$/.test(route) || route === '') {
    return false;
  }
  return true;
}

export function validateDirectory(
  dir: string,
  sourceDir: string,
  platform: Platform,
): Result<void> {
  if (!isInside(sourceDir, dir, platform)) {
    return err({ code: 'E012', params: { path: dir, reason: 'outsideRoot' } });
  }
  const segments = dir.split(/[\\/]/);
  if (segments.includes('..') || segments.includes('node_modules')) {
    return err({ code: 'E012', params: { path: dir, reason: 'outsideRoot' } });
  }
  const syntaxErr = checkPathSyntax(dir, platform);
  if (syntaxErr) return err(syntaxErr);
  return ok(undefined);
}

export function validateDesignDirs(
  designDirs: DesignDirs,
  sourceDir: string,
  platform: Platform,
): boolean {
  const drafts = designDirs.drafts ?? DEFAULT_DESIGN_DIRS.drafts;
  const list = [designDirs.pages, designDirs.layouts, designDirs.components, drafts];
  for (const p of list) {
    if (!isInside(sourceDir, p, platform)) return false;
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a === undefined || b === undefined) continue;
      if (isInside(a, b, platform) || isInside(b, a, platform)) return false;
    }
  }
  return true;
}

export async function listProjectDirs(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
): Promise<string[]> {
  const dirs: string[] = [];
  const pending = [sourceDir];
  while (pending.length > 0 && dirs.length < 500) {
    const dir = pending.shift() ?? '';
    const entries = await fs.readDir(root, dir);
    if (!entries.ok) continue;
    for (const entry of entries.value) {
      if (entry.kind !== 'directory') continue;
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const rel = `${dir}/${entry.name}`;
      dirs.push(rel);
      pending.push(rel);
    }
  }
  return dirs.sort();
}
