// Style layer service: where each style property of an element comes from (SPEC-04 M-ST, R-ST-02 to R-ST-05).
import {
  type BridgeStyleProbePayload,
  CSS_LONGHAND_OF,
  type MatchedRule,
  type StyleProperty,
  type StyleReading,
  type StyleSource,
  type StyleSystemId,
  type StylingReport,
} from '@kumicraft/shared';

import type { CompiledCssPort } from '../ports/compiled-css-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import { parseUtility } from './bootstrap-utilities.ts';
import { findRuleSource, locateRule, locateRuleByIndex } from './css-locate.ts';
import { type CompiledCache, locateBySourceMap } from './mapped-source.ts';
import { projectFileOf } from './project-file.ts';

export { projectFileOf };

const MAX_CSS_BYTES = 2 * 1024 * 1024;

export type StyleProject = {
  readonly root: string;
  readonly styling?: StylingReport | undefined;
};

export interface StyleService {
  /** R-ST-04: the probe of one element (from the Bridge) as properties with their sources. */
  read(project: StyleProject, probe: BridgeStyleProbePayload): Promise<StyleReading>;
}

/** R-ST-03: the system new declarations go to, from what the project uses. */
export function primarySystem(styling: StylingReport | undefined): StyleSystemId | undefined {
  const ids = new Set(styling?.systems.map((s) => s.id) ?? []);
  if (ids.has('tailwind')) {
    const version = styling?.systems.find((s) => s.id === 'tailwind')?.version ?? '4';
    return version.startsWith('3') ? 'tailwind3' : 'tailwind4';
  }
  if (ids.has('bootstrap')) return 'bootstrap5';
  if (ids.has('cssModules')) return 'cssModules';
  if (ids.has('sass')) return 'sass';
  if (ids.has('less')) return 'less';
  if (ids.has('css')) return 'css';
  return undefined;
}

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
  const declares = (rule: MatchedRule, important: boolean) =>
    rule.declarations.some((d) => d.property === longhand && d.important === important);
  const inline = probe.inline.find((d) => d.property === longhand);
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
  const { fs, root, cache, primary } = ctx;
  if (rule.sheet.kind !== 'module') {
    const href = rule.sheet.kind === 'link' ? rule.sheet.href : '';
    return externalRuleSource(rule, href, primary);
  }
  const file = projectFileOf(root, rule.sheet.id);
  if (file === undefined) {
    return externalRuleSource(rule, rule.sheet.id, primary);
  }
  const mapped = await mappedRuleSource(ctx, rule, longhand);
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

export function createStyleService(deps: {
  readonly fs: FileSystemPort;
  readonly compiledCss?: CompiledCssPort | undefined;
}): StyleService {
  return {
    async read(project, probe) {
      const primary = primarySystem(project.styling);
      const ctx: ReadContext = {
        fs: deps.fs,
        compiledCss: deps.compiledCss,
        root: project.root,
        primary,
        cache: new Map(),
        compiled: new Map(),
      };
      const properties: StyleProperty[] = [];
      for (const [id, longhand] of Object.entries(CSS_LONGHAND_OF)) {
        const css = probe.computed[longhand];
        if (css === undefined) continue;
        const value = { css };
        const winner = winnerFor(probe, longhand);
        if (winner.kind === 'none') {
          properties.push({ id, value, source: { kind: 'inherited' }, editable: true });
        } else if (winner.kind === 'inline') {
          properties.push({
            id,
            value,
            source: { kind: 'inline' },
            editable: false,
            reason: 'inlineDynamic',
          });
        } else {
          properties.push({
            id,
            value,
            ...(await ruleSource(ctx, winner.rule, longhand)),
          });
        }
      }
      return { ...(primary === undefined ? {} : { primary }), properties };
    },
  };
}
