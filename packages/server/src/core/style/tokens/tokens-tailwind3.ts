// Tailwind 3 tailwind.config.* token adapter (SPEC-04 R-ST-11).
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
import { countTokenUses } from '../../project/theme-edit.ts';
import { type AstNode, detectFormat, parseJsxAst } from '../../source-editor/ast-helpers.ts';
import {
  collectTokensInScope,
  findConfigObject,
  findObjectChild,
  indentUnitOf,
  KIND_TO_TW3_GROUP,
  type LocatedTw3Token,
  objectProperties,
} from './tailwind3-ast.ts';
import { emptyBuckets, pushTokenToBucket, type TokenBuckets } from './token-buckets.ts';
import type { TokenAdapter, TokenFiles } from './token-service.ts';

const CONFIG_CANDIDATES: readonly RelPath[] = [
  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
];

async function findTailwindConfigFile(
  fs: FileSystemPort,
  root: string,
): Promise<RelPath | undefined> {
  for (const candidate of CONFIG_CANDIDATES) {
    if (await fs.exists(root, candidate)) {
      return candidate;
    }
  }
  return undefined;
}

type ParsedConfig = {
  readonly rawContent: string;
  readonly code: string;
  readonly hasBom: boolean;
  readonly newline: '\r\n' | '\n';
  readonly configObj: AstNode | undefined;
  readonly themeTokens: readonly LocatedTw3Token[];
  readonly extendTokens: readonly LocatedTw3Token[];
};

function parseConfigContent(rawContent: string): Result<ParsedConfig> {
  const { hasBom, newline } = detectFormat(rawContent);
  const code = hasBom ? rawContent.slice(1) : rawContent;
  try {
    const ast = parseJsxAst(code);
    const configObj = findConfigObject(ast);
    if (!configObj) {
      return ok({
        rawContent,
        code,
        hasBom,
        newline,
        configObj: undefined,
        themeTokens: [],
        extendTokens: [],
      });
    }
    const themeObj = findObjectChild(configObj, 'theme');
    const extendObj = themeObj ? findObjectChild(themeObj, 'extend') : undefined;
    const themeTokens = themeObj ? collectTokensInScope(themeObj, false) : [];
    const extendTokens = extendObj ? collectTokensInScope(extendObj, true) : [];
    return ok({ rawContent, code, hasBom, newline, configObj, themeTokens, extendTokens });
  } catch {
    return err({ code: 'E024', params: { reason: 'configParse' } });
  }
}

function buildBuckets(
  themeTokens: readonly LocatedTw3Token[],
  extendTokens: readonly LocatedTw3Token[],
): TokenBuckets {
  const buckets = emptyBuckets();
  const extendKeySet = new Set(extendTokens.map((t) => `${t.kind}:${t.name}`));
  for (const tok of themeTokens) {
    if (extendKeySet.has(`${tok.kind}:${tok.name}`)) continue;
    pushTokenToBucket(buckets, tok.kind, { name: tok.name, value: tok.value, inherited: true });
  }
  for (const tok of extendTokens) {
    pushTokenToBucket(buckets, tok.kind, { name: tok.name, value: tok.value });
  }
  return buckets;
}

function applySetToken(code: string, target: LocatedTw3Token, rawValue: string): string {
  const start = target.valueNode.start ?? 0;
  const end = target.valueNode.end ?? start;
  const val = rawValue.trim();
  const quote = target.valueNode.type === 'StringLiteral' && code[start] === '"' ? '"' : "'";
  const escaped = val.replace(/\\/g, '\\\\').replaceAll(quote, `\\${quote}`);
  return `${code.slice(0, start)}${quote}${escaped}${quote}${code.slice(end)}`;
}

function applyRemoveToken(code: string, target: LocatedTw3Token): string {
  const propStart = target.propNode.start ?? 0;
  const propEnd = target.propNode.end ?? propStart;
  const afterComma = /^[ \t]*,/.exec(code.slice(propEnd)) ?? undefined;
  let delStart = propStart;
  let delEnd = afterComma !== undefined ? propEnd + afterComma[0].length : propEnd;

  if (afterComma === undefined) {
    const props = objectProperties(target.parentObject);
    const idx = props.indexOf(target.propNode);
    if (idx > 0) {
      const prevEnd = props[idx - 1]?.end ?? propStart;
      const between = code.slice(prevEnd, propStart);
      if (!between.includes('\n')) {
        const commaIdx = between.lastIndexOf(',');
        if (commaIdx >= 0) delStart = prevEnd + commaIdx;
      }
    }
  }

  const lineStart = code.lastIndexOf('\n', delStart - 1) + 1;
  if (/^[ \t]*$/.test(code.slice(lineStart, delStart))) {
    const lineEnd = /^[ \t]*\r?\n/.exec(code.slice(delEnd)) ?? undefined;
    if (lineEnd !== undefined) {
      return `${code.slice(0, lineStart)}${code.slice(delEnd + lineEnd[0].length)}`;
    }
  }
  if (afterComma !== undefined && code[delEnd] === ' ') {
    delEnd += 1;
  }
  return `${code.slice(0, delStart)}${code.slice(delEnd)}`;
}

function insertPropertyIntoObject(
  code: string,
  obj: AstNode,
  buildProp: (propIndent: string) => string,
  unit: string,
  newline: string,
): string {
  const objStart = obj.start ?? 0;
  const objEnd = obj.end ?? objStart;
  const lineStart = code.lastIndexOf('\n', objStart - 1) + 1;
  const baseIndent = /^[ \t]*/.exec(code.slice(lineStart, objStart))?.[0] ?? '';
  const propIndent = `${baseIndent}${unit}`;
  const propText = buildProp(propIndent);
  const props = objectProperties(obj);

  if (props.length === 0) {
    return `${code.slice(0, objStart + 1)}${newline}${propIndent}${propText},${newline}${baseIndent}${code.slice(objEnd - 1)}`;
  }
  const lastEnd = props[props.length - 1]?.end ?? objStart + 1;
  const commaMatch = /^[ \t]*,/.exec(code.slice(lastEnd, objEnd - 1)) ?? undefined;
  if (commaMatch !== undefined) {
    const insertAt = lastEnd + commaMatch[0].length;
    return `${code.slice(0, insertAt)}${newline}${propIndent}${propText},${code.slice(insertAt)}`;
  }
  return `${code.slice(0, lastEnd)},${newline}${propIndent}${propText}${code.slice(lastEnd)}`;
}

function applyAddToken(
  code: string,
  configObj: AstNode,
  edit: { readonly kind: ThemeTokenKind; readonly name: string; readonly value: string },
  newline: string,
): string {
  const unit = indentUnitOf(code);
  const groupName = KIND_TO_TW3_GROUP[edit.kind];
  const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(edit.name) ? edit.name : `'${edit.name}'`;
  const escapedVal = edit.value.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const leaf = `${keyStr}: '${escapedVal}'`;

  const themeObj = findObjectChild(configObj, 'theme');
  const extendObj = themeObj ? findObjectChild(themeObj, 'extend') : undefined;
  const groupObj = extendObj ? findObjectChild(extendObj, groupName) : undefined;

  if (groupObj !== undefined) {
    return insertPropertyIntoObject(code, groupObj, () => leaf, unit, newline);
  }
  if (extendObj !== undefined) {
    return insertPropertyIntoObject(
      code,
      extendObj,
      (ind) => `${groupName}: {${newline}${ind}${unit}${leaf},${newline}${ind}}`,
      unit,
      newline,
    );
  }
  if (themeObj !== undefined) {
    return insertPropertyIntoObject(
      code,
      themeObj,
      (ind) =>
        `extend: {${newline}${ind}${unit}${groupName}: {${newline}${ind}${unit}${unit}${leaf},${newline}${ind}${unit}},${newline}${ind}}`,
      unit,
      newline,
    );
  }
  return insertPropertyIntoObject(
    code,
    configObj,
    (ind) =>
      `theme: {${newline}${ind}${unit}extend: {${newline}${ind}${unit}${unit}${groupName}: {${newline}${ind}${unit}${unit}${unit}${leaf},${newline}${ind}${unit}${unit}},${newline}${ind}${unit}},${newline}${ind}}`,
    unit,
    newline,
  );
}

function planParsedEdit(parsed: ParsedConfig, edit: ThemeEdit): Result<string> {
  if (edit.op === 'importFont') {
    return err({ code: 'E016', params: { reason: 'unsupportedOp' } });
  }
  if (!parsed.configObj) {
    return err({ code: 'E021', params: { missing: 'styleAdapter' } });
  }
  const inExtend = parsed.extendTokens.find((t) => t.kind === edit.kind && t.name === edit.name);
  const inTheme = parsed.themeTokens.find((t) => t.kind === edit.kind && t.name === edit.name);

  if (edit.op === 'add') {
    if (inExtend !== undefined) {
      return err({ code: 'E016', params: { reason: 'tokenExists', name: edit.name } });
    }
    const nextCode = applyAddToken(parsed.code, parsed.configObj, edit, parsed.newline);
    return ok(parsed.hasBom ? `\uFEFF${nextCode}` : nextCode);
  }

  if (inExtend === undefined) {
    if (inTheme !== undefined) {
      return err({ code: 'E016', params: { reason: 'tokenNotEditable', name: edit.name } });
    }
    return err({ code: 'E016', params: { reason: 'tokenNotFound', name: edit.name } });
  }

  const nextCode =
    edit.op === 'set'
      ? applySetToken(parsed.code, inExtend, edit.value)
      : applyRemoveToken(parsed.code, inExtend);
  return ok(parsed.hasBom ? `\uFEFF${nextCode}` : nextCode);
}

export const tailwind3Adapter: TokenAdapter = {
  system: 'tailwind3',
  async read(fs: FileSystemPort, files: TokenFiles): Promise<Result<ThemeInfo>> {
    const configFile = await findTailwindConfigFile(fs, files.root);
    if (!configFile) {
      return ok({ system: 'tailwind3', ...emptyBuckets() });
    }
    const readRes = await fs.readText(files.root, configFile, {
      maxBytes: 1024 * 1024,
      keepBom: true,
    });
    if (!readRes.ok) return readRes;
    const parsed = parseConfigContent(readRes.value);
    if (!parsed.ok) return parsed;
    const buckets = buildBuckets(parsed.value.themeTokens, parsed.value.extendTokens);
    return ok({ system: 'tailwind3', file: configFile, ...buckets });
  },

  async plan(
    fs: FileSystemPort,
    files: TokenFiles,
    edit: ThemeEdit,
  ): Promise<Result<{ readonly file: RelPath; readonly before: string; readonly after: string }>> {
    const configFile = await findTailwindConfigFile(fs, files.root);
    if (!configFile) {
      return err({ code: 'E021', params: { missing: 'styleAdapter' } });
    }
    const readRes = await fs.readText(files.root, configFile, {
      maxBytes: 1024 * 1024,
      keepBom: true,
    });
    if (!readRes.ok) return readRes;
    const parsed = parseConfigContent(readRes.value);
    if (!parsed.ok) return parsed;
    const afterRes = planParsedEdit(parsed.value, edit);
    if (!afterRes.ok) return afterRes;
    return ok({ file: configFile, before: readRes.value, after: afterRes.value });
  },

  countUses(source: string, _file: string, kind: ThemeTokenKind, token: ThemeToken): number {
    return countTokenUses(source, kind, token.name);
  },
};
