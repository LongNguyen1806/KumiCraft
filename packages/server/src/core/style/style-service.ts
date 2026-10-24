// Style layer service: where each style property of an element comes from (SPEC-04 M-ST, R-ST-02 to R-ST-05).
import { isAbsolute, relative, resolve } from 'node:path';

import {
  type BridgeStyleProbePayload,
  CSS_LONGHAND_OF,
  type MatchedRule,
  relPathProblem,
  type StyleProperty,
  type StyleReading,
  type StyleSource,
  type StyleSystemId,
  type StylingReport,
} from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { locateRule, locateRuleByIndex } from './css-locate.ts';

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

/** A Vite module id (`D:/app/src/Card.css?used`) as a path of the project, or undefined outside it. */
export function projectFileOf(root: string, id: string): string | undefined {
  const path = id.split('?')[0] ?? id;
  if (!isAbsolute(path)) return undefined;
  const rel = relative(resolve(root), resolve(path)).replaceAll('\\', '/');
  if (relPathProblem(rel) !== undefined || rel.startsWith('node_modules/')) return undefined;
  return rel;
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
): { line: number; selector: string } | undefined {
  if (system === 'cssModules') {
    const loc = locateRuleByIndex(css, rule.ruleIndex, [longhand]);
    if (loc === undefined) return undefined;
    return { line: loc.declarations[longhand] ?? loc.line, selector: loc.selector };
  }
  const loc = locateRule(css, rule, [longhand]);
  if (loc === undefined) return undefined;
  return { line: loc.declarations[longhand] ?? loc.line, selector: rule.selector };
}

/** Where a winning rule lives: a line of a project file, or a sheet the project does not own. */
async function ruleSource(
  fs: FileSystemPort,
  root: string,
  rule: MatchedRule,
  longhand: string,
  cache: Map<string, string | undefined>,
): Promise<{ source: StyleSource; editable: boolean; reason?: StyleProperty['reason'] }> {
  if (rule.sheet.kind !== 'module') {
    const href = rule.sheet.kind === 'link' ? rule.sheet.href : '';
    return { source: { kind: 'external', href }, editable: false, reason: 'external' };
  }
  const file = projectFileOf(root, rule.sheet.id);
  if (file === undefined) {
    return {
      source: { kind: 'external', href: rule.sheet.id },
      editable: false,
      reason: 'external',
    };
  }
  if (!cache.has(file)) {
    const read = await fs.readText(root, file, { maxBytes: MAX_CSS_BYTES });
    cache.set(file, read.ok ? read.value : undefined);
  }
  const css = cache.get(file);
  const system = systemOfFile(file);
  const loc = css === undefined ? undefined : locateInFile(css, system, rule, longhand);
  if (loc === undefined) {
    return { source: { kind: 'external', href: file }, editable: false, reason: 'notFound' };
  }
  const source: StyleSource = {
    kind: 'rule',
    system,
    file,
    line: loc.line,
    selector: loc.selector,
    affects: rule.affects,
    ...(rule.media.length === 0 ? {} : { media: rule.media.join(' and ') }),
  };
  return { source, editable: true };
}

export function createStyleService(deps: { readonly fs: FileSystemPort }): StyleService {
  return {
    async read(project, probe) {
      const primary = primarySystem(project.styling);
      const cache = new Map<string, string | undefined>();
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
            ...(await ruleSource(deps.fs, project.root, winner.rule, longhand, cache)),
          });
        }
      }
      return { ...(primary === undefined ? {} : { primary }), properties };
    },
  };
}
