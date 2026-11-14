// Safe Google Fonts CSS @import planner for ThemeEdit 'importFont' (TK-71).
import type { RelPath, Result, ThemeEdit } from '@kumicraft/shared';
import { err, googleFontsImportUrl, isAllowedGoogleFont, ok } from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { TokenFiles } from './token-service.ts';

type FontImportEdit = Extract<ThemeEdit, { op: 'importFont' }>;

export function applyFontImportToCss(css: string, edit: FontImportEdit): Result<string> {
  if (edit.families.length === 0 || !edit.families.every((f) => isAllowedGoogleFont(f))) {
    return err({ code: 'E016', params: { reason: 'invalidValue' } });
  }
  const hasBom = css.startsWith('\uFEFF');
  const body = hasBom ? css.slice(1) : css;
  const nl = body.includes('\r\n') ? '\r\n' : '\n';

  const url = googleFontsImportUrl(edit.families);
  const alreadyPresent =
    body.includes(`@import url('${url}')`) ||
    body.includes(`@import url("${url}")`) ||
    body.includes(`@import '${url}'`) ||
    body.includes(`@import "${url}"`);
  if (alreadyPresent) {
    return ok(css);
  }

  const importLine = `@import url('${url}');`;
  const charsetMatch = /^(@charset\s+[^;]+;\s*\r?\n?)/.exec(body);
  let nextBody: string;
  if (charsetMatch?.[1] !== undefined) {
    const head = charsetMatch[1].endsWith('\n') ? charsetMatch[1] : `${charsetMatch[1]}${nl}`;
    const rest = body.slice(charsetMatch[1].length);
    nextBody = `${head}${importLine}${nl}${rest}`;
  } else {
    nextBody = body.length > 0 ? `${importLine}${nl}${body}` : `${importLine}${nl}`;
  }
  return ok(hasBom ? `\uFEFF${nextBody}` : nextBody);
}

const STYLESHEET_RE = /\.(css|scss|sass|less)$/i;

export async function resolveFontImportFile(
  fs: FileSystemPort,
  files: TokenFiles,
): Promise<RelPath | undefined> {
  if (files.tokenFile !== undefined && STYLESHEET_RE.test(files.tokenFile)) {
    return files.tokenFile;
  }
  if (files.tailwindCss !== undefined) {
    return files.tailwindCss;
  }
  const firstGlobal = files.styling?.globalCss.find((f) => STYLESHEET_RE.test(f));
  if (firstGlobal !== undefined) {
    return firstGlobal;
  }
  if (await fs.exists(files.root, 'src/index.css')) {
    return 'src/index.css';
  }
  return undefined;
}

export async function planFontImport(
  fs: FileSystemPort,
  files: TokenFiles,
  edit: FontImportEdit,
): Promise<Result<{ readonly file: RelPath; readonly before: string; readonly after: string }>> {
  if (edit.families.length === 0 || !edit.families.every((f) => isAllowedGoogleFont(f))) {
    return err({ code: 'E016', params: { reason: 'invalidValue' } });
  }
  const cssPath = await resolveFontImportFile(fs, files);
  if (cssPath === undefined) {
    return err({ code: 'E021', params: { missing: 'styleAdapter' } });
  }
  const read = await fs.readText(files.root, cssPath, { maxBytes: 1024 * 1024, keepBom: true });
  if (!read.ok) return read;
  const after = applyFontImportToCss(read.value, edit);
  if (!after.ok) return after;
  return ok({ file: cssPath, before: read.value, after: after.value });
}
