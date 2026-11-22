// The open project's design folders and style files, checked and listed for the services
// (R-PG-11 to R-PG-14, R-ST-15). Independent of the view language.
import {
  type DesignDirs,
  err,
  isTokenFileFor,
  normalizeDesignDirs,
  ok,
  type Result,
  type StyleFiles,
  type StyleSystemId,
  type StylingReport,
} from '@kumicraft/shared';

import type { PageEditDeps } from '../../kernel/features.ts';
import type { HistoryService } from '../../kernel/history/history-service.ts';
import { isInside } from '../../kernel/paths.ts';
import type { Platform } from '../../kernel/session.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';

function isHistoryService(h: unknown): h is HistoryService {
  return !!h && typeof h === 'object' && 'push' in h;
}

export function buildPageEditDeps(
  current: {
    readonly status: string;
    readonly root?: string | undefined;
    readonly file?:
      { readonly sourceDir: string; readonly designDirs?: DesignDirs | undefined } | undefined;
    readonly support?:
      { readonly language: 'ts' | 'js'; readonly styling?: StylingReport | undefined } | undefined;
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
    designDirs: normalizeDesignDirs(current.file.designDirs),
    styling: current.support.styling,
  });
}

export function validateDesignDirs(
  designDirs: DesignDirs,
  sourceDir: string,
  platform: Platform,
): boolean {
  const normalized = normalizeDesignDirs(designDirs);
  const allDirs = [
    ...normalized.pages,
    ...normalized.layouts,
    ...normalized.components,
    normalized.drafts,
  ];

  for (const p of allDirs) {
    if (!isInside(sourceDir, p, platform)) return false;
  }

  const seen = new Set<string>();
  for (const p of allDirs) {
    const key = platform === 'linux' ? p : p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
  }

  const nonDrafts = [...normalized.pages, ...normalized.layouts, ...normalized.components];
  for (const p of nonDrafts) {
    if (isInside(normalized.drafts, p, platform) || isInside(p, normalized.drafts, platform)) {
      return false;
    }
  }

  return true;
}

export async function validateStyleFiles(
  fs: FileSystemPort,
  root: string,
  styleFiles: StyleFiles | undefined,
  sourceDir: string,
  primarySystem: StyleSystemId | undefined,
  platform: Platform,
): Promise<Result<void>> {
  if (!styleFiles) return ok(undefined);
  if (styleFiles.newCssDir !== undefined) {
    if (!isInside(sourceDir, styleFiles.newCssDir, platform)) {
      return err({ code: 'E016', params: { reason: 'styleFileInvalid' } });
    }
  }
  if (styleFiles.tokenFile !== undefined) {
    const file = styleFiles.tokenFile;
    if (!isTokenFileFor(file, primarySystem)) {
      return err({ code: 'E016', params: { reason: 'styleFileInvalid' } });
    }
    const exists = await fs.exists(root, file);
    if (!exists) {
      return err({ code: 'E016', params: { reason: 'styleFileInvalid' } });
    }
  }
  return ok(undefined);
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
