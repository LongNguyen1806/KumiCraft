// Read and edit Tailwind v4 @theme tokens from the main CSS file (SPEC-04 R-PJ-17, R-TH-10 to R-TH-14).
import type {
  ThemeEdit,
  ThemeInfo,
  ThemeToken,
  ThemeTokenKind,
  ThemeUsage,
} from '@reactcraft/shared';

import { computeSha256, type HistoryService } from '../history/history-service.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { withFileLocks } from './page-common.ts';
import type { ProjectServiceDeps, WorkspaceState } from './project-types.ts';
import { applyThemeEdit, countTokenUses } from './theme-edit.ts';

const THEME_BLOCK_REGEX = /@theme\s*(?:inline)?\s*\{([^}]+)\}/g;
const CSS_VAR_REGEX = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;

type TokenBuckets = {
  readonly colors: ThemeToken[];
  readonly fontSizes: ThemeToken[];
  readonly radii: ThemeToken[];
  readonly fonts: ThemeToken[];
  readonly shadows: ThemeToken[];
  readonly breakpoints: ThemeToken[];
};

function parseVariablesFromBlock(blockBody: string, buckets: TokenBuckets): void {
  CSS_VAR_REGEX.lastIndex = 0;
  let varMatch: RegExpExecArray | undefined = CSS_VAR_REGEX.exec(blockBody) ?? undefined;
  while (varMatch !== undefined) {
    const rawName = varMatch[1];
    const rawVal = varMatch[2];
    if (rawName && rawVal) {
      const fullVarName = rawName.trim();
      const val = rawVal.trim();

      if (fullVarName.startsWith('color-')) {
        buckets.colors.push({ name: fullVarName.replace(/^color-/, ''), value: val });
      } else if (fullVarName.startsWith('text-')) {
        // R-PJ-17: skip --text-*--line-height
        if (!fullVarName.includes('--line-height')) {
          buckets.fontSizes.push({ name: fullVarName.replace(/^text-/, ''), value: val });
        }
      } else if (fullVarName.startsWith('radius-')) {
        buckets.radii.push({ name: fullVarName.replace(/^radius-/, ''), value: val });
      } else if (fullVarName.startsWith('font-')) {
        buckets.fonts.push({ name: fullVarName.replace(/^font-/, ''), value: val });
      } else if (fullVarName.startsWith('shadow-')) {
        buckets.shadows.push({ name: fullVarName.replace(/^shadow-/, ''), value: val });
      } else if (fullVarName.startsWith('breakpoint-')) {
        buckets.breakpoints.push({ name: fullVarName.replace(/^breakpoint-/, ''), value: val });
      }
    }
    varMatch = CSS_VAR_REGEX.exec(blockBody) ?? undefined;
  }
}

export async function readThemeTokens(
  fs: FileSystemPort,
  root: string,
  cssFilePath: string,
): Promise<Result<ThemeInfo>> {
  const read = await fs.readText(root, cssFilePath, { maxBytes: 1024 * 1024 });
  if (!read.ok) return read;

  const content = read.value;
  const buckets: TokenBuckets = {
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
  };

  THEME_BLOCK_REGEX.lastIndex = 0;
  let blockMatch: RegExpExecArray | undefined = THEME_BLOCK_REGEX.exec(content) ?? undefined;
  while (blockMatch !== undefined) {
    const blockBody = blockMatch[1];
    if (blockBody) {
      parseVariablesFromBlock(blockBody, buckets);
    }
    blockMatch = THEME_BLOCK_REGEX.exec(content) ?? undefined;
  }

  return ok({
    file: cssFilePath,
    ...buckets,
  });
}

function getBucketForKind(theme: ThemeInfo, kind: ThemeTokenKind): readonly ThemeToken[] {
  switch (kind) {
    case 'color':
      return theme.colors;
    case 'font':
      return theme.fonts;
    case 'fontSize':
      return theme.fontSizes;
    case 'radius':
      return theme.radii;
    case 'shadow':
      return theme.shadows;
  }
}

function verifyThemeTokens(theme: ThemeInfo, edit: ThemeEdit): boolean {
  const bucket = getBucketForKind(theme, edit.kind);
  if (edit.op === 'remove') {
    return !bucket.some((token) => token.name === edit.name);
  }
  const expected = edit.value.trim();
  return bucket.some((token) => token.name === edit.name && token.value === expected);
}

function isFullHistoryService(h: ProjectServiceDeps['history']): h is HistoryService {
  return h !== undefined && 'push' in h && 'recordInternalWrite' in h;
}

function recordWrite(
  history: ProjectServiceDeps['history'],
  cssPath: string,
  content: string,
): void {
  if (isFullHistoryService(history)) history.recordInternalWrite(cssPath, computeSha256(content));
}

function pushThemeHistory(
  history: ProjectServiceDeps['history'],
  edit: ThemeEdit,
  cssPath: string,
  before: string,
  after: string,
): void {
  if (!isFullHistoryService(history)) return;
  const beforeHash = computeSha256(before);
  const afterHash = computeSha256(after);
  history.push({
    label: { key: 'history:theme', params: { op: edit.op, name: edit.name } },
    files: [{ path: cssPath, before, beforeHash, after, afterHash }],
  });
}

export async function editProjectTheme(
  current: WorkspaceState,
  deps: ProjectServiceDeps,
  edit: ThemeEdit,
): Promise<Result<ThemeInfo>> {
  if (current.status !== 'open') {
    return err({ code: 'E021', params: { missing: 'project' } });
  }
  const cssPath = current.support.tailwindCss;
  if (!cssPath) {
    return err({ code: 'E016', params: { reason: 'noThemeFile' } });
  }
  const root = current.root;

  return withFileLocks(root, [cssPath], async () => {
    // keepBom: a BOM is a byte outside the edited value and must survive the edit (R-TH-11).
    const beforeRead = await deps.fs.readText(root, cssPath, {
      maxBytes: 1024 * 1024,
      keepBom: true,
    });
    if (!beforeRead.ok) return beforeRead;
    const beforeContent = beforeRead.value;

    const edited = applyThemeEdit(beforeContent, edit);
    if (!edited.ok) return edited;
    const afterContent = edited.value;

    // Marked before writing, so the watcher never takes Studio's own write for an outside edit.
    recordWrite(deps.history, cssPath, afterContent);
    const written = await deps.fs.writeTextAtomic(root, cssPath, afterContent);
    if (!written.ok) return written;

    const verified = await readThemeTokens(deps.fs, root, cssPath);
    if (!verified.ok || !verifyThemeTokens(verified.value, edit)) {
      recordWrite(deps.history, cssPath, beforeContent);
      await deps.fs.writeTextAtomic(root, cssPath, beforeContent);
      return err({ code: 'E024' });
    }

    pushThemeHistory(deps.history, edit, cssPath, beforeContent, afterContent);
    return ok(verified.value);
  });
}

const SOURCE_FILE_RE = /\.(tsx|jsx|ts|js)$/;
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.reactcraft']);

export async function countProjectThemeUsage(
  current: WorkspaceState,
  deps: ProjectServiceDeps,
  kind: ThemeTokenKind,
  name: string,
): Promise<Result<ThemeUsage>> {
  if (current.status !== 'open') {
    return err({ code: 'E021', params: { missing: 'project' } });
  }
  const root = current.root;
  const pendingDirs = [current.file.sourceDir];
  let total = 0;

  while (pendingDirs.length > 0) {
    const dir = pendingDirs.shift() ?? '';
    const entries = await deps.fs.readDir(root, dir);
    if (!entries.ok) continue;
    for (const entry of entries.value) {
      if (entry.kind === 'directory') {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          pendingDirs.push(`${dir}/${entry.name}`);
        }
      } else if (SOURCE_FILE_RE.test(entry.name)) {
        const filePath = `${dir}/${entry.name}`;
        const read = await deps.fs.readText(root, filePath, { maxBytes: 1024 * 1024 });
        if (read.ok) {
          total += countTokenUses(read.value, kind, name);
        }
      }
    }
  }

  return ok({ count: total });
}
