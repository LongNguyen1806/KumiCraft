// Style layer writing for CSS Modules (SPEC-04 M-ST, R-ST-06, R-ST-08, R-ST-09, R-ST-15).
import { posix } from 'node:path';

import {
  err,
  type MatchedRule,
  ok,
  parseLocString,
  type Result,
  type StyleApplyRequest,
} from '@kumicraft/shared';
import { customAlphabet } from 'nanoid';

import { asAstNode, type AstNode, isAstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { findNodeAt } from '../source-editor/source-editor-lookup.ts';
import { ensureKeyframesBlock, resolveMergedCssValue } from './css-composite-apply.ts';
import {
  appendRule,
  hasStateInSelector,
  setDeclarationAt,
  upsertRuleDeclaration,
  withStateSelector,
} from './css-edit.ts';
import { locateRuleByIndex } from './css-locate.ts';
import { readFile, type StyleApplied, type StyleApplyDeps, writeFile } from './style-apply.ts';
import { projectFileOf } from './style-service.ts';

const OWN_MODULE_CLASS = /_rc[a-z0-9]{4}$/;
const JS_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function isModuleSheetId(id: string): boolean {
  return /\.module\.(css|scss|sass|less)$/.test(id.split('?')[0] ?? '');
}

type ClassNameMember = { readonly objectName: string; readonly propertyName: string };

export type ParsedClassName = {
  readonly objectName: string;
  readonly properties: readonly string[];
  readonly containerStart: number;
  readonly containerEnd: number;
  readonly isTemplate: boolean;
};

function extractMember(node: unknown): ClassNameMember | undefined {
  if (!isAstNode(node) || node.type !== 'MemberExpression') return undefined;
  const obj = asAstNode(node['object']);
  if (obj === undefined || obj.type !== 'Identifier') return undefined;
  const objectName = typeof obj['name'] === 'string' ? obj['name'] : undefined;
  if (objectName === undefined) return undefined;
  const prop = asAstNode(node['property']);
  if (prop === undefined) return undefined;
  if (node['computed'] === true) {
    return prop.type === 'StringLiteral' && typeof prop['value'] === 'string'
      ? { objectName, propertyName: prop['value'] }
      : undefined;
  }
  return prop.type === 'Identifier' && typeof prop['name'] === 'string'
    ? { objectName, propertyName: prop['name'] }
    : undefined;
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && Boolean(val);
}

function getQuasiRaw(quasi: unknown): string | undefined {
  if (!isObject(quasi)) return undefined;
  const val = quasi['value'];
  if (!isObject(val)) return undefined;
  const raw = val['raw'];
  return typeof raw === 'string' ? raw : undefined;
}

function validateQuasis(quasisRaw: readonly unknown[], exprCount: number): boolean {
  if (quasisRaw.length !== exprCount + 1) return false;
  for (let i = 0; i < quasisRaw.length; i++) {
    const raw = getQuasiRaw(quasisRaw[i]);
    if (raw === undefined) return false;
    if (i === 0 || i === quasisRaw.length - 1 ? raw !== '' : raw !== ' ') return false;
  }
  return true;
}

function parseTemplate(expr: AstNode, start: number, end: number): ParsedClassName | undefined {
  const quasis = expr['quasis'];
  const rawExprs = expr['expressions'];
  if (!Array.isArray(quasis) || !Array.isArray(rawExprs)) return undefined;
  const members = rawExprs.map(extractMember);
  if (members.some((m) => m === undefined)) return undefined;
  const valid = members.filter((m): m is ClassNameMember => m !== undefined);
  if (valid.length === 0) return undefined;
  const objectName = valid[0]?.objectName;
  if (objectName === undefined || valid.some((m) => m.objectName !== objectName)) return undefined;
  if (!validateQuasis(quasis, valid.length)) return undefined;
  return {
    objectName,
    properties: valid.map((m) => m.propertyName),
    containerStart: start,
    containerEnd: end,
    isTemplate: true,
  };
}

export function parseClassNameAttr(attrNode: AstNode | undefined): ParsedClassName | undefined {
  if (attrNode === undefined) return undefined;
  const container = asAstNode(attrNode['value']);
  if (container?.type !== 'JSXExpressionContainer') return undefined;
  const start = typeof container.start === 'number' ? container.start : undefined;
  const end = typeof container.end === 'number' ? container.end : undefined;
  if (start === undefined || end === undefined) return undefined;
  const expr = asAstNode(container['expression']);
  if (expr === undefined) return undefined;
  const single = extractMember(expr);
  if (single !== undefined) {
    return {
      objectName: single.objectName,
      properties: [single.propertyName],
      containerStart: start,
      containerEnd: end,
      isTemplate: false,
    };
  }
  return expr.type === 'TemplateLiteral' ? parseTemplate(expr, start, end) : undefined;
}

export function findClassNameAttr(opening: AstNode | undefined): AstNode | undefined {
  const attrs = opening?.['attributes'];
  if (!Array.isArray(attrs)) return undefined;
  for (const item of attrs) {
    const attr = asAstNode(item);
    if (attr?.type === 'JSXAttribute' && asAstNode(attr['name'])?.['name'] === 'className') {
      return attr;
    }
  }
  return undefined;
}

export function findModuleImport(ast: AstNode, identifier: string): string | undefined {
  const body = asAstNode(ast['program'])?.['body'];
  if (!Array.isArray(body)) return undefined;
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const src = asAstNode(stmt['source'])?.['value'];
    if (typeof src !== 'string' || !/\.module\.(css|scss|sass|less)$/.test(src)) continue;
    const specs = stmt['specifiers'];
    if (!Array.isArray(specs)) continue;
    for (const spec of specs) {
      const s = asAstNode(spec);
      if (s?.type === 'ImportDefaultSpecifier' && asAstNode(s['local'])?.['name'] === identifier) {
        return src;
      }
    }
  }
  return undefined;
}

export async function isModulesApplicable(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
  winnerRule: MatchedRule | undefined,
): Promise<boolean> {
  if (winnerRule?.sheet.kind === 'module' && isModuleSheetId(winnerRule.sheet.id)) return true;
  const parsedLoc = parseLocString(request.probe.ref.loc);
  if (parsedLoc === undefined) return false;
  const read = await readFile(deps.fs, root, parsedLoc.file);
  if (!read.ok) return false;
  let ast: AstNode;
  try {
    ast = parseJsxAst(read.value);
  } catch {
    return false;
  }
  const el = findNodeAt(ast, parsedLoc.line, parsedLoc.column);
  if (el === undefined) return false;
  const classNameAttr = findClassNameAttr(asAstNode(el['openingElement']));
  if (classNameAttr === undefined) return false;
  const parsed = parseClassNameAttr(classNameAttr);
  return parsed !== undefined && findModuleImport(ast, parsed.objectName) !== undefined;
}

export async function applyModulesToRule(
  deps: StyleApplyDeps,
  root: string,
  rule: MatchedRule,
  longhand: string,
  change: StyleApplyRequest['change'],
): Promise<Result<StyleApplied>> {
  if (rule.sheet.kind !== 'module') {
    return err({ code: 'E016', params: { reason: 'externalSheet' } });
  }
  const file = projectFileOf(root, rule.sheet.id);
  if (file === undefined) return err({ code: 'E016', params: { reason: 'externalSheet' } });
  const css = await readFile(deps.fs, root, file);
  if (!css.ok) return css;
  const located = locateRuleByIndex(css.value, rule.ruleIndex, []);
  if (located === undefined) return err({ code: 'E016', params: { reason: 'ruleNotFound' } });

  const { property, value, media, state } = change;
  const inPlaceMedia = media === undefined || rule.media.length > 0;
  const inPlaceState = state === undefined || hasStateInSelector(located.selector, state);
  const inPlace = inPlaceMedia && inPlaceState;
  const effectiveMedia = rule.media[0] ?? media;
  const targetSelector =
    state === undefined ? located.selector : withStateSelector(located.selector, state);
  const resolvedValue = resolveMergedCssValue(css.value, {
    propertyId: property,
    longhand,
    value,
    selector: targetSelector,
    media: effectiveMedia,
    ruleIndex: inPlace ? rule.ruleIndex : undefined,
    file,
  });

  const next = inPlace
    ? setDeclarationAt(css.value, rule.ruleIndex, longhand, resolvedValue)
    : upsertRuleDeclaration(css.value, targetSelector, longhand, resolvedValue, effectiveMedia);
  if (!next.ok) return next;
  const withKeyframes = ensureKeyframesBlock(next.value, property, resolvedValue);
  if (withKeyframes === css.value) return ok({ files: [] });
  const written = await writeFile(deps.fs, root, file, css.value, withKeyframes);
  return written.ok ? ok({ files: [written.value] }) : written;
}

/** `card-title` → `card_title`: the new key must read as `styles.<key>` (no `-`). */
function identifierBase(name: string | undefined): string {
  const base = (name ?? '').replace(/[^\w$]/g, '_');
  return /^[A-Za-z_$]/.test(base) ? base : `el${base}`;
}

/** `styles.card`, or `styles['card-title']` for a key that is not an identifier. */
function memberText(objectName: string, key: string): string {
  return JS_IDENTIFIER.test(key)
    ? `${objectName}.${key}`
    : `${objectName}['${key.replace(/[\\']/g, '\\$&')}']`;
}

async function applyNewOwnClass(
  deps: StyleApplyDeps,
  root: string,
  info: JsxElementInfo,
  cssFile: string,
  longhand: string,
  change: StyleApplyRequest['change'],
): Promise<Result<StyleApplied>> {
  const { property, value, media, state } = change;
  if (value === undefined) return ok({ files: [] });
  const { code: jsxCode, jsxFile, parsed } = info;
  const idGen = deps.newId ?? customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  const newClass = `${identifierBase(parsed.properties[0])}_rc${idGen()}`;
  const selector = state === undefined ? `.${newClass}` : `.${newClass}:${state}`;

  const css = await readFile(deps.fs, root, cssFile);
  if (!css.ok) return css;
  const resolvedValue =
    resolveMergedCssValue(css.value, {
      propertyId: property,
      longhand,
      value,
      selector,
      media,
      file: cssFile,
    }) ?? value;
  const nextCss = appendRule(
    css.value,
    selector,
    [{ property: longhand, value: resolvedValue }],
    media,
  );
  if (!nextCss.ok) return nextCss;
  const finalCss = ensureKeyframesBlock(nextCss.value, property, resolvedValue);

  const allProps = [...parsed.properties, newClass];
  const templateBody = allProps.map((p) => `\${${memberText(parsed.objectName, p)}}`).join(' ');
  const replacement = `{\`${templateBody}\`}`;
  const nextJsx =
    jsxCode.slice(0, parsed.containerStart) + replacement + jsxCode.slice(parsed.containerEnd);

  try {
    parseJsxAst(nextJsx);
  } catch {
    return err({ code: 'E024', params: { reason: 'jsxParse' } });
  }

  const writtenJsx = await writeFile(deps.fs, root, jsxFile, jsxCode, nextJsx);
  if (!writtenJsx.ok) return writtenJsx;
  const writtenCss = await writeFile(deps.fs, root, cssFile, css.value, finalCss);
  if (!writtenCss.ok) return writtenCss;

  return ok({ files: [writtenJsx.value, writtenCss.value], className: newClass });
}

/**
 * The element's own rule as the browser ranks it (cascade winner first), so on a smaller frame the
 * copy inside that frame's `@media` is changed rather than duplicated (R-ST-09).
 */
async function ownRuleOf(
  deps: StyleApplyDeps,
  root: string,
  cssFile: string,
  ownProp: string,
  probeRules: readonly MatchedRule[],
): Promise<MatchedRule | undefined> {
  const css = await readFile(deps.fs, root, cssFile);
  if (!css.ok) return undefined;
  const re = new RegExp(`^\\.${ownProp}(?::[\\w-]+)*$`);
  return probeRules.find(
    (r) =>
      r.sheet.kind === 'module' &&
      projectFileOf(root, r.sheet.id) === cssFile &&
      re.test(locateRuleByIndex(css.value, r.ruleIndex, [])?.selector.trim() ?? ''),
  );
}

type JsxElementInfo = {
  readonly ast: AstNode;
  readonly code: string;
  readonly jsxFile: string;
  readonly parsed: ParsedClassName;
};

async function loadJsxElementInfo(
  deps: StyleApplyDeps,
  root: string,
  loc: string,
): Promise<Result<JsxElementInfo>> {
  const parsedLoc = parseLocString(loc);
  if (parsedLoc === undefined) return err({ code: 'E016', params: { reason: 'invalidLoc' } });
  const jsxFile = parsedLoc.file;
  const read = await readFile(deps.fs, root, jsxFile);
  if (!read.ok) return read;
  let ast: AstNode;
  try {
    ast = parseJsxAst(read.value);
  } catch {
    return err({ code: 'E024', params: { reason: 'jsxParse' } });
  }
  const el = findNodeAt(ast, parsedLoc.line, parsedLoc.column);
  if (el === undefined) return err({ code: 'E016', params: { reason: 'elementNotFound' } });
  const parsed = parseClassNameAttr(findClassNameAttr(asAstNode(el['openingElement'])));
  if (parsed === undefined) return err({ code: 'E016', params: { reason: 'expression' } });
  return ok({ ast, code: read.value, jsxFile, parsed });
}

export async function applyModulesToElement(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
  longhand: string,
): Promise<Result<StyleApplied>> {
  const info = await loadJsxElementInfo(deps, root, request.probe.ref.loc);
  if (!info.ok) return info;
  const { ast, jsxFile, parsed } = info.value;
  const importPath = findModuleImport(ast, parsed.objectName);
  if (importPath === undefined) {
    return err({ code: 'E016', params: { reason: 'moduleImportNotFound' } });
  }
  const cssFile = posix.normalize(posix.join(posix.dirname(jsxFile), importPath));
  const ownProp = parsed.properties.find((p) => OWN_MODULE_CLASS.test(p));
  const own =
    ownProp === undefined
      ? undefined
      : await ownRuleOf(deps, root, cssFile, ownProp, request.probe.rules);
  if (own !== undefined) {
    return applyModulesToRule(deps, root, own, longhand, request.change);
  }

  return applyNewOwnClass(deps, root, info.value, cssFile, longhand, request.change);
}

export async function applyModulesChange(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
  longhand: string,
  winnerRule: MatchedRule | undefined,
): Promise<Result<StyleApplied>> {
  // Like plain CSS: "all" with no project rule to change falls back to a class of its own.
  const ruleInProject =
    winnerRule?.sheet.kind === 'module' && projectFileOf(root, winnerRule.sheet.id) !== undefined;
  if (request.change.target === 'rule' && winnerRule !== undefined && ruleInProject) {
    return applyModulesToRule(deps, root, winnerRule, longhand, request.change);
  }
  return applyModulesToElement(deps, root, request, longhand);
}
