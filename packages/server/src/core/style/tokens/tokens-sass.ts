// Sass variables token adapter (SPEC-04 R-ST-11).
import type {
  RelPath,
  Result,
  ThemeEdit,
  ThemeInfo,
  ThemeToken,
  ThemeTokenKind,
} from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { isValidThemeValue } from '../../project/theme-edit.ts';
import { classifyVariable } from './classify.ts';
import {
  emptyBuckets,
  escapeRegExp,
  kindPrefix,
  pushTokenToBucket,
  targetBucket,
  type TokenBuckets,
} from './token-buckets.ts';
import type { TokenAdapter, TokenFiles } from './token-service.ts';
import { insertVariable, listVariables, removeVariable, setVariable } from './variable-edit.ts';

function targetSassFiles(files: TokenFiles): readonly string[] {
  if (files.tokenFile && /\.(scss|sass)$/i.test(files.tokenFile)) {
    return [files.tokenFile];
  }
  const globalSass = (files.styling?.globalCss ?? []).filter((f) => /\.(scss|sass)$/.test(f));
  if (globalSass.length > 0) return globalSass;
  return ['src/styles/main.scss'];
}

export function parseTopLevelSassVars(scss: string, file = 'src/styles/main.scss'): TokenBuckets {
  const buckets = emptyBuckets();
  const seen = new Set<string>();
  const vars = listVariables(scss, file, 'sass');
  for (const v of vars) {
    const rawName = v.variable.replace(/^\$/, '');
    const classified = classifyVariable(rawName, v.value);
    if (classified !== undefined) {
      const key = `${classified.kind}:${classified.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        pushTokenToBucket(buckets, classified.kind, {
          name: classified.name,
          value: v.value,
          variable: v.variable,
        });
      }
    }
  }
  return buckets;
}

export const sassAdapter: TokenAdapter = {
  system: 'sass',
  async read(fs: FileSystemPort, files: TokenFiles): Promise<Result<ThemeInfo>> {
    const sassPaths = targetSassFiles(files);
    const combined = emptyBuckets();
    const seen = new Set<string>();
    let firstFile: string | undefined;

    for (const p of sassPaths) {
      const read = await fs.readText(files.root, p, { maxBytes: 1024 * 1024 });
      if (!read.ok) continue;
      if (firstFile === undefined) firstFile = p;
      const theme = parseTopLevelSassVars(read.value, p);
      for (const kind of ['colors', 'fontSizes', 'radii', 'fonts', 'shadows'] as const) {
        for (const token of theme[kind]) {
          const key = `${kind}:${token.name}`;
          if (!seen.has(key)) {
            seen.add(key);
            combined[kind].push(token);
          }
        }
      }
    }

    return ok({
      file: firstFile ?? sassPaths[0],
      system: 'sass',
      ...combined,
    });
  },

  async plan(
    fs: FileSystemPort,
    files: TokenFiles,
    edit: ThemeEdit,
  ): Promise<Result<{ readonly file: RelPath; readonly before: string; readonly after: string }>> {
    if (edit.op === 'importFont') {
      return err({ code: 'E016', params: { reason: 'unsupportedOp' } });
    }
    if (edit.op !== 'remove' && !isValidThemeValue(edit.kind, edit.value)) {
      return err({ code: 'E016', params: { reason: 'invalidValue' } });
    }
    const currentTheme = await sassAdapter.read(fs, files);
    if (!currentTheme.ok) return currentTheme;

    const sassPaths = targetSassFiles(files);
    const existing = targetBucket(currentTheme.value, edit.kind).find((t) => t.name === edit.name);

    if (edit.op === 'add') {
      if (existing !== undefined) return err({ code: 'E016', params: { reason: 'tokenExists' } });
      const targetFile = currentTheme.value.file ?? sassPaths[0] ?? 'src/styles/main.scss';
      const read = await fs.readText(files.root, targetFile, {
        maxBytes: 1024 * 1024,
        keepBom: true,
      });
      const before = read.ok ? read.value : '';
      const varName = `$${kindPrefix(edit.kind)}${edit.name}`;
      const after = insertVariable(before, targetFile, 'sass', varName, edit.value.trim());
      if (!after.ok) return after;
      return ok({ file: targetFile, before, after: after.value });
    }

    if (existing === undefined || existing.variable === undefined) {
      return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
    }

    for (const p of sassPaths) {
      const read = await fs.readText(files.root, p, { maxBytes: 1024 * 1024, keepBom: true });
      if (!read.ok) continue;
      const content = read.value;
      const fileVars = listVariables(content, p, 'sass');
      if (fileVars.some((v) => v.variable === existing.variable)) {
        const after =
          edit.op === 'set'
            ? setVariable(content, p, 'sass', existing.variable, edit.value.trim())
            : removeVariable(content, p, 'sass', existing.variable);
        if (!after.ok) return after;
        return ok({ file: p, before: content, after: after.value });
      }
    }
    return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
  },

  countUses(source: string, _file: string, _kind: ThemeTokenKind, token: ThemeToken): number {
    if (!token.variable) return 0;
    const varName = token.variable.startsWith('$') ? token.variable : `$${token.variable}`;
    const pattern = new RegExp(`\\${escapeRegExp(varName)}(?![\\w-])`, 'g');
    const totalMatches = (source.match(pattern) ?? []).length;
    // Exclude declaration line if this file declares it
    const declPattern = new RegExp(`^[ \\t]*\\${escapeRegExp(varName)}\\s*:`, 'm');
    const isDeclaredHere = declPattern.test(source);
    return isDeclaredHere ? Math.max(0, totalMatches - 1) : totalMatches;
  },
};
