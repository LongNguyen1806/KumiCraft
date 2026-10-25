// Styling detection for Vite + React projects (Phase 3 Round S1, R-PJ-02).
import type { RelPath, StylingReport, StylingSystem, StylingSystemId } from '@kumicraft/shared';
import { STYLING_SYSTEMS } from '@kumicraft/shared';

import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { parseMajorVersion, resolvePackageVersion } from './detect.ts';

const MAX_SCAN_FILES = 3000;
const MAX_SCAN_DEPTH = 12;
const MAX_GLOBAL_CSS = 20;

const IGNORED_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.git']);

const ENTRY_CANDIDATES = ['main.tsx', 'main.jsx', 'index.tsx', 'index.jsx'] as const;

const RELATIVE_CSS_IMPORT_RE = /import\s+['"](\.[^'"]*\.(?:css|scss|sass|less))['"]/g;

const UI_LIB_PRIMARY_ORDER: readonly StylingSystemId[] = [
  'mui',
  'antd',
  'chakra',
  'bootstrap',
  'styledComponents',
  'emotion',
];

type FileScanSummary = {
  hasPlainCss: boolean;
  hasCssModules: boolean;
  hasSassFiles: boolean;
  hasLessFiles: boolean;
};

function normalizeRelPath(baseDir: string, rel: string): string {
  const parts = [...baseDir.split('/').filter(Boolean), ...rel.split('/').filter(Boolean)];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

function classifyFile(
  name: string,
  relPath: string,
  tailwindCss: RelPath | undefined,
  summary: FileScanSummary,
): void {
  if (name.endsWith('.module.css') || name.endsWith('.module.scss')) {
    summary.hasCssModules = true;
  } else if (name.endsWith('.css')) {
    if (tailwindCss === undefined || relPath !== tailwindCss) {
      summary.hasPlainCss = true;
    }
  } else if (name.endsWith('.scss') || name.endsWith('.sass')) {
    summary.hasSassFiles = true;
  } else if (name.endsWith('.less')) {
    summary.hasLessFiles = true;
  }
}

async function scanDirectory(
  fs: FileSystemPort,
  root: string,
  dir: string,
  depth: number,
  state: { count: number },
  tailwindCss: RelPath | undefined,
  summary: FileScanSummary,
): Promise<void> {
  if (depth > MAX_SCAN_DEPTH || state.count >= MAX_SCAN_FILES) return;
  const read = await fs.readDir(root, dir);
  if (!read.ok) return;

  for (const entry of read.value) {
    if (state.count >= MAX_SCAN_FILES) break;
    if (entry.name.startsWith('.') || IGNORED_DIR_NAMES.has(entry.name)) continue;

    const childPath = dir.length === 0 ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === 'file') {
      state.count += 1;
      classifyFile(entry.name, childPath, tailwindCss, summary);
    } else {
      await scanDirectory(fs, root, childPath, depth + 1, state, tailwindCss, summary);
    }
  }
}

async function findEntryFile(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
): Promise<string | undefined> {
  for (const candidate of ENTRY_CANDIDATES) {
    const fullPath = `${sourceDir}/${candidate}`;
    if (await fs.exists(root, fullPath)) {
      return fullPath;
    }
  }
  for (const candidate of ENTRY_CANDIDATES) {
    const fullPath = `src/${candidate}`;
    if (await fs.exists(root, fullPath)) {
      return fullPath;
    }
  }
  return undefined;
}

async function extractGlobalCss(
  fs: FileSystemPort,
  root: string,
  entryFile: string | undefined,
  tailwindCss: RelPath | undefined,
): Promise<string[]> {
  const result: string[] = [];
  if (tailwindCss !== undefined) {
    result.push(tailwindCss);
  }
  if (entryFile === undefined) return result;

  const read = await fs.readText(root, entryFile, { maxBytes: 512 * 1024 });
  if (!read.ok) return result;

  const entryDir = entryFile.includes('/') ? entryFile.slice(0, entryFile.lastIndexOf('/')) : '';

  RELATIVE_CSS_IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | undefined = RELATIVE_CSS_IMPORT_RE.exec(read.value) ?? undefined;
  while (match !== undefined) {
    const importTarget = match[1];
    if (importTarget !== undefined) {
      const resolved = normalizeRelPath(entryDir, importTarget);
      if (!result.includes(resolved) && (await fs.exists(root, resolved))) {
        result.push(resolved);
      }
    }
    match = RELATIVE_CSS_IMPORT_RE.exec(read.value) ?? undefined;
  }

  return result.slice(0, MAX_GLOBAL_CSS);
}

function determinePrimarySystem(
  detected: ReadonlyMap<StylingSystemId, StylingSystem>,
): StylingSystemId | undefined {
  if (detected.has('tailwind')) return 'tailwind';
  for (const lib of UI_LIB_PRIMARY_ORDER) {
    if (detected.has(lib)) return lib;
  }
  if (detected.has('cssModules')) return 'cssModules';
  if (detected.has('sass')) return 'sass';
  if (detected.has('less')) return 'less';
  if (detected.has('css')) return 'css';
  return undefined;
}

function buildSystemsList(
  detected: ReadonlyMap<StylingSystemId, StylingSystem>,
  primary: StylingSystemId | undefined,
): StylingSystem[] {
  const list: StylingSystem[] = [];
  if (primary !== undefined) {
    const primarySys = detected.get(primary);
    if (primarySys !== undefined) list.push(primarySys);
  }
  for (const id of STYLING_SYSTEMS) {
    if (id !== primary) {
      const sys = detected.get(id);
      if (sys !== undefined) list.push(sys);
    }
  }
  return list;
}

export type DetectStylingInput = {
  readonly fs: FileSystemPort;
  readonly root: string;
  readonly sourceDir: string;
  readonly allDeps: Readonly<Record<string, string>>;
  readonly tailwindCss?: RelPath | undefined;
  readonly tailwindVersion?: string | undefined;
};

export async function detectStyling(input: DetectStylingInput): Promise<StylingReport> {
  const { fs, root, sourceDir, allDeps, tailwindCss, tailwindVersion } = input;
  const detected = new Map<StylingSystemId, StylingSystem>();

  // The dependency names the system; editing needs the Tailwind 3 (`@tailwind`) or Tailwind 4
  // (`@import "tailwindcss"`) CSS entry as well (see `editable` below).
  if (allDeps['tailwindcss'] !== undefined) {
    detected.set('tailwind', { id: 'tailwind', version: tailwindVersion });
  }

  const scanSummary: FileScanSummary = {
    hasPlainCss: false,
    hasCssModules: false,
    hasSassFiles: false,
    hasLessFiles: false,
  };
  await scanDirectory(fs, root, sourceDir, 0, { count: 0 }, tailwindCss, scanSummary);

  if (scanSummary.hasCssModules) detected.set('cssModules', { id: 'cssModules' });
  if (scanSummary.hasPlainCss) detected.set('css', { id: 'css' });

  await checkDependencySystems(fs, root, allDeps, scanSummary, detected);

  const primary = determinePrimarySystem(detected);
  const primaryMajor =
    primary === 'tailwind' && tailwindVersion !== undefined
      ? parseMajorVersion(tailwindVersion)
      : undefined;
  const editable =
    primary === 'tailwind' &&
    (primaryMajor === 3 || primaryMajor === 4) &&
    tailwindCss !== undefined;

  const entryFile = await findEntryFile(fs, root, sourceDir);
  const globalCss = await extractGlobalCss(fs, root, entryFile, tailwindCss);

  return {
    systems: buildSystemsList(detected, primary),
    primary,
    editable,
    globalCss,
  };
}

async function checkDependencySystems(
  fs: FileSystemPort,
  root: string,
  allDeps: Readonly<Record<string, string>>,
  scan: FileScanSummary,
  out: Map<StylingSystemId, StylingSystem>,
): Promise<void> {
  const checks: readonly [StylingSystemId, readonly string[], boolean][] = [
    ['bootstrap', ['bootstrap', 'react-bootstrap'], false],
    ['sass', ['sass', 'sass-embedded'], scan.hasSassFiles],
    ['less', ['less'], scan.hasLessFiles],
    ['styledComponents', ['styled-components'], false],
    ['emotion', ['@emotion/react', '@emotion/styled'], false],
    ['mui', ['@mui/material'], false],
    ['antd', ['antd'], false],
    ['chakra', ['@chakra-ui/react'], false],
  ];

  for (const [id, pkgNames, fallback] of checks) {
    const matched = pkgNames.find((name) => allDeps[name] !== undefined);
    if (matched !== undefined) {
      const res = await resolvePackageVersion(fs, root, matched, allDeps[matched]);
      out.set(id, { id, version: res.version });
    } else if (fallback) {
      out.set(id, { id });
    }
  }
}
