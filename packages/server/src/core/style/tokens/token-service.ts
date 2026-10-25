// Unified theme token service for all style systems (SPEC-04 R-TH-10 to R-TH-14, R-ST-11).
import type {
  RelPath,
  Result,
  StyleSystemId,
  StylingReport,
  ThemeEdit,
  ThemeInfo,
  ThemeToken,
  ThemeTokenKind,
  ThemeUsage,
} from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';

import { computeSha256, type HistoryService } from '../../history/history-service.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { withFileLocks } from '../../project/page-common.ts';
import type { ProjectServiceDeps } from '../../project/project-types.ts';
import { getBucketForKind } from './token-buckets.ts';
import { bootstrapAdapter } from './tokens-bootstrap.ts';
import { cssAdapter } from './tokens-css.ts';
import { lessAdapter } from './tokens-less.ts';
import { sassAdapter } from './tokens-sass.ts';
import { tailwind3Adapter } from './tokens-tailwind3.ts';
import { tailwind4Adapter } from './tokens-tailwind4.ts';

export type TokenFiles = {
  readonly root: string;
  readonly styling: StylingReport | undefined;
  readonly tailwindCss: RelPath | undefined;
  readonly sourceDir: string;
  readonly tokenFile?: RelPath | undefined;
};

export interface TokenAdapter {
  readonly system: StyleSystemId;
  read(fs: FileSystemPort, files: TokenFiles): Promise<Result<ThemeInfo>>;
  plan(
    fs: FileSystemPort,
    files: TokenFiles,
    edit: ThemeEdit,
  ): Promise<Result<{ readonly file: RelPath; readonly before: string; readonly after: string }>>;
  countUses(source: string, file: string, kind: ThemeTokenKind, token: ThemeToken): number;
}

const ADAPTERS: Readonly<Record<string, TokenAdapter>> = {
  tailwind4: tailwind4Adapter,
  tailwind3: tailwind3Adapter,
  css: cssAdapter,
  sass: sassAdapter,
  less: lessAdapter,
  bootstrap5: bootstrapAdapter,
  // A CSS Modules project keeps its shared variables in the global CSS (`:root`).
  cssModules: cssAdapter,
};

export function adapterFor(
  system: StyleSystemId | undefined,
  files?: TokenFiles,
): TokenAdapter | undefined {
  if (system !== undefined) return ADAPTERS[system];
  if (files?.tailwindCss !== undefined) return ADAPTERS.tailwind4;
  return undefined;
}

function isFullHistoryService(h: ProjectServiceDeps['history']): h is HistoryService {
  return h !== undefined && 'push' in h && 'recordInternalWrite' in h;
}

export function recordWrite(
  history: ProjectServiceDeps['history'],
  cssPath: string,
  content: string,
): void {
  if (isFullHistoryService(history)) history.recordInternalWrite(cssPath, computeSha256(content));
}

export function pushThemeHistory(
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

function verifyThemeTokens(theme: ThemeInfo, edit: ThemeEdit): boolean {
  const bucket = getBucketForKind(theme, edit.kind);
  if (edit.op === 'remove') {
    const existing = bucket.find((token) => token.name === edit.name);
    return existing === undefined || existing.inherited === true;
  }
  const expected = edit.value.trim();
  return bucket.some((token) => token.name === edit.name && token.value.trim() === expected);
}

export async function readTokens(
  deps: { readonly fs: FileSystemPort },
  files: TokenFiles,
  primary: StyleSystemId | undefined,
): Promise<Result<ThemeInfo>> {
  const adapter = adapterFor(primary, files);
  if (adapter === undefined) {
    return ok({
      colors: [],
      fontSizes: [],
      radii: [],
      fonts: [],
      shadows: [],
      breakpoints: [],
    });
  }
  return adapter.read(deps.fs, files);
}

export async function editTokens(
  deps: ProjectServiceDeps,
  files: TokenFiles,
  primary: StyleSystemId | undefined,
  edit: ThemeEdit,
): Promise<Result<ThemeInfo>> {
  const adapter = adapterFor(primary, files);
  if (adapter === undefined) {
    return err({ code: 'E021', params: { missing: 'styleAdapter' } });
  }

  // The first plan only names the file to lock; the edit is planned again under the lock so a
  // save from the editor in between is never overwritten (R-TH-11).
  const located = await adapter.plan(deps.fs, files, edit);
  if (!located.ok) return located;

  return withFileLocks(files.root, [located.value.file], async () => {
    const planned = await adapter.plan(deps.fs, files, edit);
    if (!planned.ok) return planned;
    const { file: targetFile, before, after } = planned.value;
    if (targetFile !== located.value.file) return err({ code: 'E024' });
    recordWrite(deps.history, targetFile, after);
    const written = await deps.fs.writeTextAtomic(files.root, targetFile, after);
    if (!written.ok) return written;

    const verified = await adapter.read(deps.fs, files);
    if (!verified.ok || !verifyThemeTokens(verified.value, edit)) {
      recordWrite(deps.history, targetFile, before);
      await deps.fs.writeTextAtomic(files.root, targetFile, before);
      return err({ code: 'E024' });
    }

    pushThemeHistory(deps.history, edit, targetFile, before, after);
    return ok(verified.value);
  });
}

const USAGE_FILE_RE = /\.(tsx|jsx|ts|js|css|scss|sass|less)$/;
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.kumicraft']);

export async function countUsage(
  deps: { readonly fs: FileSystemPort },
  files: TokenFiles,
  primary: StyleSystemId | undefined,
  kind: ThemeTokenKind,
  name: string,
): Promise<Result<ThemeUsage>> {
  const adapter = adapterFor(primary, files);
  if (adapter === undefined) return ok({ count: 0 });

  const themeRes = await adapter.read(deps.fs, files);
  const bucket = themeRes.ok ? getBucketForKind(themeRes.value, kind) : [];
  const token = bucket.find((t) => t.name === name) ?? { name, value: '' };

  const pendingDirs = [files.sourceDir];
  let total = 0;

  while (pendingDirs.length > 0) {
    const dir = pendingDirs.shift() ?? '';
    const entries = await deps.fs.readDir(files.root, dir);
    if (!entries.ok) continue;
    for (const entry of entries.value) {
      if (entry.kind === 'directory') {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          pendingDirs.push(`${dir}/${entry.name}`);
        }
      } else if (USAGE_FILE_RE.test(entry.name)) {
        const filePath = `${dir}/${entry.name}`;
        const read = await deps.fs.readText(files.root, filePath, { maxBytes: 1024 * 1024 });
        if (read.ok) {
          total += adapter.countUses(read.value, filePath, kind, token);
        }
      }
    }
  }

  return ok({ count: total });
}
