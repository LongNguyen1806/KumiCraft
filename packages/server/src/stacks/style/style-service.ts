// Style layer service: where each style property of an element comes from (SPEC-04 M-ST, R-ST-02 to R-ST-05).
import {
  type BridgeStyleProbePayload,
  CSS_LONGHAND_OF,
  CSS_SHORTHANDS_OF,
  isCompositeStyleProperty,
  type MatchedRule,
  primarySystem,
  type StyleProperty,
  type StyleSource,
  type StyleSystemId,
  unpackBorderRadius,
  unpackBorderWidth,
  type UnpackedBorderRadius,
  type UnpackedBorderWidth,
} from '@kumicraft/shared';

import type { StyleProject, StyleService } from '../../kernel/features.ts';
import type { CompiledCssPort } from '../../ports/compiled-css-port.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { parseUtility } from './bootstrap-utilities.ts';
import { extractRuleOrComputedSubValue } from './css-composite-apply.ts';
import { findRuleSource, locateRule, locateRuleByIndex } from './css-locate.ts';
import { type CompiledCache, locateBySourceMap } from './mapped-source.ts';
import { projectFileOf, projectFileOfSheet } from './project-file.ts';

export { primarySystem, projectFileOf };

const MAX_CSS_BYTES = 2 * 1024 * 1024;

function systemOfFile(file: string): StyleSystemId {
  if (/\.module\.(css|scss|sass|less)$/.test(file)) return 'cssModules';
  if (/\.(scss|sass)$/.test(file)) return 'sass';
  if (file.endsWith('.less')) return 'less';
  return 'css';
}

type Winner =
  | { readonly kind: 'rule'; readonly rule: MatchedRule }
  | { readonly kind: 'inline' }
  | { readonly kind: 'none' };

/** Cascade among what the probe found: important rules, inline style, then normal rules. */
export function winnerFor(probe: BridgeStyleProbePayload, longhand: string): Winner {
  const shorthands = CSS_SHORTHANDS_OF[longhand] ?? [];
  const matches = (p: string) => p === longhand || shorthands.includes(p);
  const declares = (rule: MatchedRule, important: boolean) =>
    rule.declarations.some((d) => matches(d.property) && d.important === important);
  const inline = probe.inline.find((d) => matches(d.property));
  const importantRule = probe.rules.find((r) => declares(r, true));
  if (inline?.important === true) return { kind: 'inline' };
  if (importantRule !== undefined) return { kind: 'rule', rule: importantRule };
  if (inline !== undefined) return { kind: 'inline' };
  const rule = probe.rules.find((r) => declares(r, false));
  return rule === undefined ? { kind: 'none' } : { kind: 'rule', rule };
}

function locateInFile(
  css: string,
  system: StyleSystemId,
  rule: MatchedRule,
  longhand: string,
  file?: string,
): { line: number; selector: string } | undefined {
  if (system === 'cssModules') {
    const loc = locateRuleByIndex(css, rule.ruleIndex, [longhand], file);
    if (loc === undefined) return undefined;
    return { line: loc.declarations[longhand] ?? loc.line, selector: loc.selector };
  }
  const loc = locateRule(css, rule, [longhand], file);
  if (loc === undefined) return undefined;
  return { line: loc.declarations[longhand] ?? loc.line, selector: rule.selector };
}

function isBootstrapSheet(rule: MatchedRule): boolean {
  if (rule.sheet.kind === 'link') return rule.sheet.href.toLowerCase().includes('bootstrap');
  if (rule.sheet.kind === 'module') {
    return rule.sheet.id.replaceAll('\\', '/').toLowerCase().includes('node_modules/bootstrap/');
  }
  return false;
}

function externalRuleSource(
  rule: MatchedRule,
  href: string,
  primary: StyleSystemId | undefined,
): { source: StyleSource; editable: boolean; reason?: StyleProperty['reason'] } {
  if (isBootstrapSheet(rule)) {
    const sel = rule.selector.trim();
    if (/^\.[\w-]+$/.test(sel)) {
      const className = sel.slice(1);
      if (parseUtility(className) !== undefined) {
        return { source: { kind: 'class', system: 'bootstrap5', className }, editable: true };
      }
    }
    if (primary === 'bootstrap5') {
      return { source: { kind: 'external', href }, editable: true };
    }
  }
  return { source: { kind: 'external', href }, editable: false, reason: 'external' };
}

async function resolvePartialRule(
  fs: FileSystemPort,
  root: string,
  file: string,
  rule: MatchedRule,
  longhand: string,
  cache: Map<string, string | undefined>,
): Promise<
  { file: string; system: StyleSystemId; loc: { line: number; selector: string } } | undefined
> {
  const src = await findRuleSource(fs, root, file, rule);
  if (src === undefined) return undefined;
  const targetFile = src.file;
  const system = systemOfFile(src.file);
  if (!cache.has(targetFile)) {
    const read = await fs.readText(root, targetFile, { maxBytes: MAX_CSS_BYTES });
    cache.set(targetFile, read.ok ? read.value : undefined);
  }
  const partialCss = cache.get(targetFile);
  const partialLoc =
    partialCss === undefined
      ? undefined
      : locateInFile(partialCss, system, rule, longhand, targetFile);
  return {
    file: targetFile,
    system,
    loc: partialLoc ?? { line: src.line, selector: src.selector },
  };
}

/** Where a winning rule lives: a line of a project file, or a sheet the project does not own. */
type ReadContext = {
  readonly fs: FileSystemPort;
  readonly compiledCss?: CompiledCssPort | undefined;
  readonly root: string;
  readonly primary: StyleSystemId | undefined;
  readonly globalCss?: readonly string[] | undefined;
  /** Source files read so far in this reading. */
  readonly cache: Map<string, string | undefined>;
  readonly compiled: CompiledCache;
};

type RuleSource = { source: StyleSource; editable: boolean; reason?: StyleProperty['reason'] };

/** The rule's source through the dev server's source map; undefined when there is no map. */
async function mappedRuleSource(
  ctx: ReadContext,
  rule: MatchedRule,
  longhand: string,
): Promise<RuleSource | undefined> {
  const mapped = await locateBySourceMap(ctx, ctx.root, rule, longhand, ctx.compiled);
  if (mapped === undefined) return undefined;
  if (mapped.kind === 'external') {
    return { source: { kind: 'external', href: mapped.href }, editable: false, reason: 'external' };
  }
  const source: StyleSource = {
    kind: 'rule',
    system: systemOfFile(mapped.file),
    file: mapped.file,
    line: mapped.anchor.line,
    selector: rule.selector,
    affects: rule.affects,
    ...(rule.media.length === 0 ? {} : { media: rule.media.join(' and ') }),
  };
  return mapped.editable
    ? { source, editable: true }
    : { source, editable: false, reason: 'expression' };
}

async function ruleSource(
  ctx: ReadContext,
  rule: MatchedRule,
  longhand: string,
): Promise<RuleSource> {
  const { fs, root, cache, primary, globalCss } = ctx;
  const file = projectFileOfSheet(root, rule.sheet, globalCss);
  if (file === undefined) {
    const href =
      rule.sheet.kind === 'link'
        ? rule.sheet.href
        : rule.sheet.kind === 'module'
          ? rule.sheet.id
          : '';
    return externalRuleSource(rule, href, primary);
  }
  const mapped =
    rule.sheet.kind === 'module' ? await mappedRuleSource(ctx, rule, longhand) : undefined;
  if (mapped !== undefined) return mapped;
  if (!cache.has(file)) {
    const read = await fs.readText(root, file, { maxBytes: MAX_CSS_BYTES });
    cache.set(file, read.ok ? read.value : undefined);
  }
  const css = cache.get(file);
  let system = systemOfFile(file);
  let targetFile = file;
  let loc = css === undefined ? undefined : locateInFile(css, system, rule, longhand, file);

  if (loc === undefined && (system === 'sass' || system === 'less')) {
    const partial = await resolvePartialRule(fs, root, file, rule, longhand, cache);
    if (partial !== undefined) {
      targetFile = partial.file;
      system = partial.system;
      loc = partial.loc;
    }
  }

  if (loc === undefined) {
    return { source: { kind: 'external', href: file }, editable: false, reason: 'notFound' };
  }
  const source: StyleSource = {
    kind: 'rule',
    system,
    file: targetFile,
    line: loc.line,
    selector: loc.selector,
    affects: rule.affects,
    ...(rule.media.length === 0 ? {} : { media: rule.media.join(' and ') }),
  };
  return { source, editable: true };
}

function resolveBorderUnpackedCss(
  id: string,
  probe: BridgeStyleProbePayload,
  winner: Winner,
): string | undefined {
  if (id.startsWith('border') && id.endsWith('Radius')) {
    const declVal =
      winner.kind === 'rule'
        ? winner.rule.declarations.find((d) => d.property === 'border-radius')?.value
        : undefined;
    const shVal = probe.computed['border-radius'] ?? declVal;
    if (shVal !== undefined) {
      return unpackBorderRadius(shVal)[id as keyof UnpackedBorderRadius];
    }
  } else if (id.startsWith('border') && id.endsWith('Width')) {
    const declVal =
      winner.kind === 'rule'
        ? winner.rule.declarations.find(
            (d) => d.property === 'border-width' || d.property === 'border',
          )?.value
        : undefined;
    const shVal = probe.computed['border-width'] ?? probe.computed['border'] ?? declVal;
    if (shVal !== undefined) {
      return unpackBorderWidth(shVal)[id as keyof UnpackedBorderWidth];
    }
  }
  return undefined;
}

async function buildStyleProperty(
  ctx: ReadContext,
  id: string,
  css: string,
  winner: Winner,
  longhand: string,
): Promise<StyleProperty> {
  const value = { css };
  if (winner.kind === 'none') {
    return { id, value, source: { kind: 'inherited' }, editable: true };
  }
  if (winner.kind === 'inline') {
    return { id, value, source: { kind: 'inline' }, editable: false, reason: 'inlineDynamic' };
  }
  return { id, value, ...(await ruleSource(ctx, winner.rule, longhand)) };
}

export function createStyleService(deps: {
  readonly fs: FileSystemPort;
  readonly compiledCss?: CompiledCssPort | undefined;
}): Pick<StyleService, 'read'> {
  return {
    async read(project, probe) {
      const primary = primarySystem(project.styling);
      const ctx: ReadContext = {
        fs: deps.fs,
        compiledCss: deps.compiledCss,
        root: project.root,
        primary,
        globalCss: project.styling?.globalCss,
        cache: new Map(),
        compiled: new Map(),
      };
      const properties: StyleProperty[] = [];
      for (const [id, longhand] of Object.entries(CSS_LONGHAND_OF)) {
        const winner = winnerFor(probe, longhand);
        const css = isCompositeStyleProperty(id)
          ? extractRuleOrComputedSubValue(
              id,
              longhand,
              winner.kind === 'rule' ? winner.rule.declarations : undefined,
              probe.computed[longhand],
            )
          : (probe.computed[longhand] ?? resolveBorderUnpackedCss(id, probe, winner));
        if (css === undefined) continue;
        properties.push(await buildStyleProperty(ctx, id, css, winner, longhand));
      }
      return { ...(primary === undefined ? {} : { primary }), properties };
    },
  };
}

export type { StyleProject, StyleService };
