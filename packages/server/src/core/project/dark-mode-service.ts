// Project dark mode (K9.8-1 TK-75), detection only (QA K9.8-1, plan K9.8 "project-wide tools via
// AI"): projects set up dark mode in many ways (a store or ThemeProvider of their own, next-themes,
// data-theme, a UI kit's color mode), and a fixed setup next to them makes two systems fight. The
// Studio only checks whether the Inspector's "Dark" colors will apply, and hands the setup (and a
// light/dark switch) to the AI tab with a prepared request.
import type { EnableDarkModeResult, RelPath, Result, StylingReport } from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { WrittenFile } from '../source-editor/source-editor-service.ts';

export type DarkModeDeps = {
  readonly fs: FileSystemPort;
  readonly styling?: StylingReport | undefined;
  readonly sourceDir?: string | undefined;
  readonly tailwindCss?: RelPath | undefined;
  readonly onWritten?: (files: readonly WrittenFile[], labelKey: string) => void;
};

/** A `.dark` rule, or code that sets the `dark` class: the project has class-based dark mode. */
const CSS_DARK_RE = /(?:^|[\s,}])\.dark[\s.:#[>{,]/m;
const JS_DARK_RE = /classList\.(?:add|toggle)\(\s*['"]dark['"]/;
const STYLE_FILE_RE = /\.(?:css|scss|sass|less)$/;
const CODE_FILE_RE = /\.(?:tsx|jsx|ts|js)$/;
const MAX_FILES = 1500;
const MAX_DEPTH = 8;

export function tailwindMajorVersion(styling?: StylingReport): 3 | 4 | undefined {
  const tw = styling?.systems.find((s) => s.id === 'tailwind');
  if (!tw) return undefined;
  if (tw.version?.startsWith('3')) return 3;
  return 4;
}

export async function findMainCssFile(
  deps: DarkModeDeps,
  root: string,
): Promise<RelPath | undefined> {
  if (deps.tailwindCss && (await deps.fs.exists(root, deps.tailwindCss))) return deps.tailwindCss;
  for (const css of deps.styling?.globalCss ?? []) {
    if (await deps.fs.exists(root, css)) return css;
  }
  const srcDir = deps.sourceDir ?? 'src';
  for (const name of ['index.css', 'App.css', 'main.css', 'styles.css']) {
    const rel = `${srcDir}/${name}`;
    if (await deps.fs.exists(root, rel)) return rel;
  }
  return undefined;
}

type Scan = { readonly fs: FileSystemPort; readonly root: string; count: number };

/** Whether a style or code file under `dir` uses class-based dark mode. */
async function usesDarkClass(scan: Scan, dir: string, depth: number): Promise<boolean> {
  if (depth > MAX_DEPTH) return false;
  const entries = await scan.fs.readDir(scan.root, dir);
  if (!entries.ok) return false;
  for (const entry of entries.value) {
    if (scan.count >= MAX_FILES) return false;
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      if (await usesDarkClass(scan, rel, depth + 1)) return true;
      continue;
    }
    const isStyle = STYLE_FILE_RE.test(entry.name);
    if (!isStyle && !CODE_FILE_RE.test(entry.name)) continue;
    scan.count += 1;
    const text = await scan.fs.readText(scan.root, rel, { maxBytes: 1024 * 1024 });
    if (text.ok && (isStyle ? CSS_DARK_RE : JS_DARK_RE).test(text.value)) return true;
  }
  return false;
}

/**
 * Whether the Inspector's "Dark" colors apply in this project. Tailwind's `dark:` always does (it
 * follows the system setting, or the project's own variant). Other style systems write `.dark …`
 * rules, which apply only when the project already uses a `dark` class. Never writes: asking to
 * set dark mode up is refused with `projectWideViaAi`, a job for the AI tab.
 */
export async function enableProjectDarkMode(
  deps: DarkModeDeps,
  root: string,
  checkOnly = false,
): Promise<Result<EnableDarkModeResult>> {
  if (!checkOnly) return err({ code: 'E023', params: { reason: 'projectWideViaAi' } });
  const cssFile = await findMainCssFile(deps, root);
  const enabled =
    tailwindMajorVersion(deps.styling) !== undefined ||
    (await usesDarkClass({ fs: deps.fs, root, count: 0 }, deps.sourceDir ?? 'src', 0));
  return ok({ enabled, changed: false, files: [], ...(cssFile ? { cssFile } : {}) });
}
