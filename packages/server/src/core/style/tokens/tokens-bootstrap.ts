// Bootstrap 5 token adapter (SPEC-04 R-ST-11).
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
import { emptyBuckets, escapeRegExp, pushTokenToBucket } from './token-buckets.ts';
import type { TokenAdapter, TokenFiles } from './token-service.ts';
import { insertVariable, listVariables, removeVariable, setVariable } from './variable-edit.ts';

const BOOTSTRAP_IMPORT_RE =
  /@(?:import|use)\s+['"][^'"]*(?:bootstrap\/scss\/bootstrap|~bootstrap)[^'"]*['"]/;
const HEX3_OR_6_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** Bootstrap 5 utility and component classes named after a theme colour (R-TH-14). */
const COLOR_CLASS_PREFIXES = 'btn-outline|btn|text-bg|text|bg|border|link|alert|badge';

type BootstrapDef = {
  readonly kind: ThemeTokenKind;
  readonly name: string;
  readonly sassVar: string;
  readonly cssVar: string;
  readonly defaultValue: string;
};

const BOOTSTRAP_TOKENS: readonly BootstrapDef[] = [
  {
    kind: 'color',
    name: 'primary',
    sassVar: 'primary',
    cssVar: 'primary',
    defaultValue: '#0d6efd',
  },
  {
    kind: 'color',
    name: 'secondary',
    sassVar: 'secondary',
    cssVar: 'secondary',
    defaultValue: '#6c757d',
  },
  {
    kind: 'color',
    name: 'success',
    sassVar: 'success',
    cssVar: 'success',
    defaultValue: '#198754',
  },
  { kind: 'color', name: 'info', sassVar: 'info', cssVar: 'info', defaultValue: '#0dcaf0' },
  {
    kind: 'color',
    name: 'warning',
    sassVar: 'warning',
    cssVar: 'warning',
    defaultValue: '#ffc107',
  },
  { kind: 'color', name: 'danger', sassVar: 'danger', cssVar: 'danger', defaultValue: '#dc3545' },
  { kind: 'color', name: 'light', sassVar: 'light', cssVar: 'light', defaultValue: '#f8f9fa' },
  { kind: 'color', name: 'dark', sassVar: 'dark', cssVar: 'dark', defaultValue: '#212529' },
  {
    kind: 'font',
    name: 'sans',
    sassVar: 'font-family-sans-serif',
    cssVar: 'font-sans-serif',
    defaultValue:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif',
  },
  {
    kind: 'fontSize',
    name: 'base',
    sassVar: 'font-size-base',
    cssVar: 'body-font-size',
    defaultValue: '1rem',
  },
  {
    kind: 'radius',
    name: 'sm',
    sassVar: 'border-radius-sm',
    cssVar: 'border-radius-sm',
    defaultValue: '0.25rem',
  },
  {
    kind: 'radius',
    name: 'base',
    sassVar: 'border-radius',
    cssVar: 'border-radius',
    defaultValue: '0.375rem',
  },
  {
    kind: 'radius',
    name: 'lg',
    sassVar: 'border-radius-lg',
    cssVar: 'border-radius-lg',
    defaultValue: '0.5rem',
  },
  {
    kind: 'shadow',
    name: 'sm',
    sassVar: 'box-shadow-sm',
    cssVar: 'box-shadow-sm',
    defaultValue: '0 .125rem .25rem rgba(0, 0, 0, .075)',
  },
  {
    kind: 'shadow',
    name: 'base',
    sassVar: 'box-shadow',
    cssVar: 'box-shadow',
    defaultValue: '0 .5rem 1rem rgba(0, 0, 0, .15)',
  },
  {
    kind: 'shadow',
    name: 'lg',
    sassVar: 'box-shadow-lg',
    cssVar: 'box-shadow-lg',
    defaultValue: '0 1rem 3rem rgba(0, 0, 0, .175)',
  },
];

function hexToRgb(hex: string): string {
  const clean = hex.replace(/^#/, '');
  let full = clean;
  if (clean.length === 3) {
    full = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${String(r)}, ${String(g)}, ${String(b)}`;
}

type BootstrapMode =
  | { readonly kind: 'sass'; readonly file: string; readonly importOffset: number }
  | { readonly kind: 'css'; readonly file: string };

async function detectBootstrapMode(fs: FileSystemPort, files: TokenFiles): Promise<BootstrapMode> {
  if (files.tokenFile) {
    if (/\.(scss|sass)$/i.test(files.tokenFile)) {
      const read = await fs.readText(files.root, files.tokenFile, { maxBytes: 1024 * 1024 });
      const importOffset = read.ok
        ? (BOOTSTRAP_IMPORT_RE.exec(read.value)?.index ?? read.value.length)
        : 0;
      return { kind: 'sass', file: files.tokenFile, importOffset };
    }
    if (files.tokenFile.endsWith('.css')) {
      return { kind: 'css', file: files.tokenFile };
    }
  }

  const scssFiles = (files.styling?.globalCss ?? []).filter((f) => /\.(scss|sass)$/.test(f));
  for (const f of scssFiles) {
    const read = await fs.readText(files.root, f, { maxBytes: 1024 * 1024 });
    if (!read.ok) continue;
    const match = BOOTSTRAP_IMPORT_RE.exec(read.value) ?? undefined;
    if (match !== undefined) {
      return { kind: 'sass', file: f, importOffset: match.index };
    }
  }

  const cssFiles = (files.styling?.globalCss ?? []).filter((f) => f.endsWith('.css'));
  return { kind: 'css', file: cssFiles[0] ?? 'src/index.css' };
}

function readSassTokens(content: string, importOffset: number, file: string): ThemeInfo {
  const header = content.slice(0, importOffset);
  const existingVars = listVariables(header, file, 'sass');
  const buckets = emptyBuckets();

  for (const def of BOOTSTRAP_TOKENS) {
    const found = existingVars.find((v) => v.variable === `$${def.sassVar}`);
    const overridden = found !== undefined;
    const val = overridden ? found.value : def.defaultValue;
    const token: ThemeToken = {
      name: def.name,
      value: val,
      variable: `$${def.sassVar}`,
      ...(overridden ? {} : { inherited: true }),
    };
    pushTokenToBucket(buckets, def.kind, token);
  }

  return { system: 'bootstrap5', ...buckets };
}

function readCssTokens(content: string, file: string): ThemeInfo {
  const existingVars = listVariables(content, file, 'root');
  const buckets = emptyBuckets();

  for (const def of BOOTSTRAP_TOKENS) {
    const found = existingVars.find((v) => v.variable === `--bs-${def.cssVar}`);
    const overridden = found !== undefined;
    const val = overridden ? found.value : def.defaultValue;
    const token: ThemeToken = {
      name: def.name,
      value: val,
      variable: `--bs-${def.cssVar}`,
      ...(overridden ? {} : { inherited: true }),
    };
    pushTokenToBucket(buckets, def.kind, token);
  }

  return { system: 'bootstrap5', ...buckets };
}

function planSassBootstrap(
  content: string,
  mode: { readonly file: string; readonly importOffset: number },
  def: BootstrapDef,
  edit: Exclude<ThemeEdit, { readonly op: 'importFont' }>,
): Result<string> {
  const header = content.slice(0, mode.importOffset);
  const existingVars = listVariables(header, mode.file, 'sass');
  const hasOverride = existingVars.some((v) => v.variable === `$${def.sassVar}`);

  if (edit.op === 'remove') {
    if (!hasOverride) return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
    return removeVariable(content, mode.file, 'sass', `$${def.sassVar}`);
  }

  if (edit.op === 'add' && hasOverride) {
    return err({ code: 'E016', params: { reason: 'tokenExists' } });
  }

  if (hasOverride) {
    return setVariable(content, mode.file, 'sass', `$${def.sassVar}`, edit.value.trim());
  }

  return insertVariable(content, mode.file, 'sass', `$${def.sassVar}`, edit.value.trim(), {
    importOffset: mode.importOffset,
  });
}

function applyCssColorOverride(
  content: string,
  file: string,
  varName: string,
  hexVal: string,
  hasOverride: boolean,
): Result<string> {
  const rgbVal = hexToRgb(hexVal);
  if (hasOverride) {
    const setPrimary = setVariable(content, file, 'root', varName, hexVal);
    if (!setPrimary.ok) return setPrimary;
    const existing = listVariables(setPrimary.value, file, 'root');
    const hasRgb = existing.some((v) => v.variable === `${varName}-rgb`);
    if (hasRgb) {
      return setVariable(setPrimary.value, file, 'root', `${varName}-rgb`, rgbVal);
    }
    return insertVariable(setPrimary.value, file, 'root', `${varName}-rgb`, rgbVal);
  }

  const insPrimary = insertVariable(content, file, 'root', varName, hexVal);
  if (!insPrimary.ok) return insPrimary;
  return insertVariable(insPrimary.value, file, 'root', `${varName}-rgb`, rgbVal);
}

function planCssBootstrap(
  content: string,
  file: string,
  def: BootstrapDef,
  edit: Exclude<ThemeEdit, { readonly op: 'importFont' }>,
): Result<string> {
  const varName = `--bs-${def.cssVar}`;
  const isColor = def.kind === 'color';

  if (edit.op !== 'remove') {
    if (isColor && !HEX3_OR_6_RE.test(edit.value.trim())) {
      return err({ code: 'E016', params: { reason: 'invalidValue' } });
    }
  }

  const existingVars = listVariables(content, file, 'root');
  const hasOverride = existingVars.some((v) => v.variable === varName);

  if (edit.op === 'remove') {
    if (!hasOverride) return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
    const remPrimary = removeVariable(content, file, 'root', varName);
    if (!remPrimary.ok) return remPrimary;
    if (isColor && existingVars.some((v) => v.variable === `${varName}-rgb`)) {
      return removeVariable(remPrimary.value, file, 'root', `${varName}-rgb`);
    }
    return remPrimary;
  }

  if (edit.op === 'add' && hasOverride) {
    return err({ code: 'E016', params: { reason: 'tokenExists' } });
  }

  const hexVal = edit.value.trim();
  if (isColor) {
    return applyCssColorOverride(content, file, varName, hexVal, hasOverride);
  }

  if (hasOverride) {
    return setVariable(content, file, 'root', varName, hexVal);
  }
  return insertVariable(content, file, 'root', varName, hexVal);
}

export const bootstrapAdapter: TokenAdapter = {
  system: 'bootstrap5',
  async read(fs: FileSystemPort, files: TokenFiles): Promise<Result<ThemeInfo>> {
    const mode = await detectBootstrapMode(fs, files);
    const read = await fs.readText(files.root, mode.file, { maxBytes: 1024 * 1024 });
    const content = read.ok ? read.value : '';

    const theme =
      mode.kind === 'sass'
        ? readSassTokens(content, mode.importOffset, mode.file)
        : readCssTokens(content, mode.file);
    return ok({ file: mode.file, ...theme });
  },

  async plan(
    fs: FileSystemPort,
    files: TokenFiles,
    edit: ThemeEdit,
  ): Promise<Result<{ readonly file: RelPath; readonly before: string; readonly after: string }>> {
    if (edit.op === 'importFont') {
      return err({ code: 'E016', params: { reason: 'unsupportedOp' } });
    }
    const def = BOOTSTRAP_TOKENS.find((t) => t.kind === edit.kind && t.name === edit.name);
    if (def === undefined) {
      return err({ code: 'E016', params: { reason: 'unknownToken' } });
    }
    if (edit.op !== 'remove' && !isValidThemeValue(edit.kind, edit.value)) {
      return err({ code: 'E016', params: { reason: 'invalidValue' } });
    }

    const mode = await detectBootstrapMode(fs, files);
    const read = await fs.readText(files.root, mode.file, { maxBytes: 1024 * 1024, keepBom: true });
    const before = read.ok ? read.value : '';

    const res =
      mode.kind === 'sass'
        ? planSassBootstrap(before, mode, def, edit)
        : planCssBootstrap(before, mode.file, def, edit);

    if (!res.ok) return res;
    return ok({ file: mode.file, before, after: res.value });
  },

  countUses(source: string, _file: string, kind: ThemeTokenKind, token: ThemeToken): number {
    let count = 0;
    if (kind === 'color') {
      // Theme-colour classes only (`btn-primary`, `text-bg-primary`…); a class is bounded by
      // spaces or quotes, since `\b` would also split `nav-primary-link` at the dashes.
      const clsPattern = new RegExp(
        `(?<![\\w-])(?:${COLOR_CLASS_PREFIXES})-${escapeRegExp(token.name)}(?![\\w-])`,
        'g',
      );
      count += (source.match(clsPattern) ?? []).length;
    }
    if (token.variable) {
      const varPattern = new RegExp(`var\\(\\s*${escapeRegExp(token.variable)}\\s*\\)`, 'g');
      count += (source.match(varPattern) ?? []).length;
    }
    return count;
  },
};
