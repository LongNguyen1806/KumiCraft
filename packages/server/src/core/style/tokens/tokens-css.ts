// CSS variables token adapter (SPEC-04 R-ST-11).
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
import { cssFilesWithImports } from './css-imports.ts';
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

function targetCssFiles(files: TokenFiles): readonly string[] {
  if (files.tokenFile && files.tokenFile.endsWith('.css')) {
    return [files.tokenFile];
  }
  const list = (files.styling?.globalCss ?? []).filter((f) => f.endsWith('.css'));
  return list.length > 0 ? list : ['src/index.css'];
}

export function parseCssVariables(css: string, file = 'src/index.css'): TokenBuckets {
  const buckets = emptyBuckets();
  const seen = new Set<string>();
  const vars = listVariables(css, file, 'root');
  for (const v of vars) {
    const rawName = v.variable.replace(/^--/, '');
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

export const cssAdapter: TokenAdapter = {
  system: 'css',
  async read(fs: FileSystemPort, files: TokenFiles): Promise<Result<ThemeInfo>> {
    const cssPaths = await cssFilesWithImports(fs, files.root, targetCssFiles(files));
    const combined = emptyBuckets();
    const seen = new Set<string>();
    let firstFile: string | undefined;
    // New variables go where the project already keeps its variables, not into the entry file.
    let tokenFile: string | undefined;

    for (const p of cssPaths) {
      const read = await fs.readText(files.root, p, { maxBytes: 1024 * 1024 });
      if (!read.ok) continue;
      if (firstFile === undefined) firstFile = p;
      const parsed = parseCssVariables(read.value, p);
      if (tokenFile === undefined && Object.values(parsed).some((b) => b.length > 0)) tokenFile = p;
      for (const kind of ['colors', 'fontSizes', 'radii', 'fonts', 'shadows'] as const) {
        for (const token of parsed[kind]) {
          const key = `${kind}:${token.name}`;
          if (!seen.has(key)) {
            seen.add(key);
            combined[kind].push(token);
          }
        }
      }
    }

    return ok({
      file: tokenFile ?? firstFile ?? cssPaths[0],
      system: 'css',
      ...combined,
    });
  },

  async plan(
    fs: FileSystemPort,
    files: TokenFiles,
    edit: ThemeEdit,
  ): Promise<Result<{ readonly file: RelPath; readonly before: string; readonly after: string }>> {
    if (edit.op !== 'remove' && !isValidThemeValue(edit.kind, edit.value)) {
      return err({ code: 'E016', params: { reason: 'invalidValue' } });
    }
    const currentTheme = await cssAdapter.read(fs, files);
    if (!currentTheme.ok) return currentTheme;

    const cssPaths = await cssFilesWithImports(fs, files.root, targetCssFiles(files));
    const existing = targetBucket(currentTheme.value, edit.kind).find((t) => t.name === edit.name);

    if (edit.op === 'add') {
      if (existing !== undefined) return err({ code: 'E016', params: { reason: 'tokenExists' } });
      const targetFile = currentTheme.value.file ?? cssPaths[0] ?? 'src/index.css';
      const read = await fs.readText(files.root, targetFile, {
        maxBytes: 1024 * 1024,
        keepBom: true,
      });
      const before = read.ok ? read.value : '';
      const varName = `--${kindPrefix(edit.kind)}${edit.name}`;
      const after = insertVariable(before, targetFile, 'root', varName, edit.value.trim());
      if (!after.ok) return after;
      return ok({ file: targetFile, before, after: after.value });
    }

    if (existing === undefined || existing.variable === undefined) {
      return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
    }

    for (const p of cssPaths) {
      const read = await fs.readText(files.root, p, { maxBytes: 1024 * 1024, keepBom: true });
      if (!read.ok) continue;
      const content = read.value;
      const fileVars = listVariables(content, p, 'root');
      if (fileVars.some((v) => v.variable === existing.variable)) {
        const after =
          edit.op === 'set'
            ? setVariable(content, p, 'root', existing.variable, edit.value.trim())
            : removeVariable(content, p, 'root', existing.variable);
        if (!after.ok) return after;
        return ok({ file: p, before: content, after: after.value });
      }
    }
    return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
  },

  countUses(source: string, _file: string, _kind: ThemeTokenKind, token: ThemeToken): number {
    if (!token.variable) return 0;
    const re = new RegExp(`var\\(\\s*${escapeRegExp(token.variable)}\\s*\\)`, 'g');
    return (source.match(re) ?? []).length;
  },
};
