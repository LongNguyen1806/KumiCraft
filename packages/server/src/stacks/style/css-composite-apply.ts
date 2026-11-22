// Reads existing composite CSS declarations before writing merged values and injects @keyframes once (K9.7-2 TK-10..17).
import {
  extractCompositeSubValue,
  isCompositeStyleProperty,
  mergeCompositeCssDeclaration,
} from '@kumicraft/shared';
import type { Container, Declaration, Root } from 'postcss';

import { findRuleBySelector } from './css-edit.ts';
import { findRule, findRuleByIndex, parseStylesheet, type RuleKey } from './css-locate.ts';

function lastDeclValue(container: Container | undefined, longhand: string): string | undefined {
  if (container === undefined) return undefined;
  let found: Declaration | undefined;
  container.each((child) => {
    if (child.type === 'decl' && child.prop.toLowerCase() === longhand) found = child;
  });
  return found?.value;
}

export type CompositeWriteContext = {
  readonly propertyId: string;
  readonly longhand: string;
  readonly value: string | undefined;
  readonly selector: string;
  readonly media?: string | undefined;
  readonly ruleKey?: RuleKey | undefined;
  readonly ruleIndex?: number | undefined;
  readonly file?: string | undefined;
};

export function resolveMergedCssValue(css: string, ctx: CompositeWriteContext): string | undefined {
  if (!isCompositeStyleProperty(ctx.propertyId)) return ctx.value;
  let root: Root;
  try {
    root = parseStylesheet(css, ctx.file);
  } catch {
    return mergeCompositeCssDeclaration(ctx.propertyId, undefined, ctx.value);
  }
  const container =
    ctx.ruleIndex !== undefined
      ? findRuleByIndex(root, ctx.ruleIndex)
      : ctx.ruleKey !== undefined
        ? findRule(root, ctx.ruleKey)
        : findRuleBySelector(root, ctx.selector, ctx.media);
  const existing = lastDeclValue(container, ctx.longhand);
  return mergeCompositeCssDeclaration(ctx.propertyId, existing, ctx.value);
}

const ANIMATION_KEYWORDS = new Set([
  'none',
  'infinite',
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
  'forwards',
  'backwards',
  'both',
  'running',
  'paused',
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
]);

function extractAnimationName(val: string): string | undefined {
  const firstLayer = val.split(',')[0] ?? '';
  const tokens = firstLayer.trim().split(/\s+/);
  for (const tok of tokens) {
    if (tok === '' || /^\d/.test(tok) || tok.includes('(')) continue;
    if (ANIMATION_KEYWORDS.has(tok.toLowerCase())) continue;
    if (/^[A-Za-z_-][\w-]*$/.test(tok)) return tok;
  }
  return undefined;
}

function keyframeBodyFor(name: string, eol: '\r\n' | '\n'): string {
  const lower = name.toLowerCase();
  if (lower === 'fadein' || lower === 'kc-fade-in') {
    return `  from {${eol}    opacity: 0;${eol}  }${eol}  to {${eol}    opacity: 1;${eol}  }`;
  }
  if (lower === 'zoomin' || lower === 'kc-zoom-in') {
    return `  from {${eol}    opacity: 0;${eol}    transform: scale(0.95);${eol}  }${eol}  to {${eol}    opacity: 1;${eol}    transform: scale(1);${eol}  }`;
  }
  if (lower === 'pulse') {
    return `  0%, 100% {${eol}    opacity: 1;${eol}  }${eol}  50% {${eol}    opacity: 0.5;${eol}  }`;
  }
  if (lower === 'bounce') {
    return `  0%, 100% {${eol}    transform: translateY(-25%);${eol}  }${eol}  50% {${eol}    transform: translateY(0);${eol}  }`;
  }
  return `  from {${eol}    opacity: 0;${eol}    transform: translateY(16px);${eol}  }${eol}  to {${eol}    opacity: 1;${eol}    transform: translateY(0);${eol}  }`;
}

export function ensureKeyframesBlock(
  css: string,
  propertyId: string,
  value: string | undefined,
): string {
  if (propertyId !== 'animation' || value === undefined || value.trim() === '') return css;
  const name = extractAnimationName(value);
  if (name === undefined) return css;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`@keyframes\\s+${escaped}(?![\\w-])`, 'i').test(css)) return css;
  const eol = css.includes('\r\n') ? '\r\n' : '\n';
  const body = keyframeBodyFor(name, eol);
  const block = `@keyframes ${name} {${eol}${body}${eol}}`;
  const sep = css.trimEnd() === '' ? '' : `${eol}${eol}`;
  const tail = css.endsWith('\n') || css === '' ? eol : '';
  return `${css.trimEnd()}${sep}${block}${tail}`;
}

export function extractRuleOrComputedSubValue(
  id: string,
  longhand: string,
  ruleDecls: readonly { readonly property: string; readonly value: string }[] | undefined,
  computedVal: string | undefined,
): string | undefined {
  if (!isCompositeStyleProperty(id)) return undefined;
  const authored = ruleDecls?.find((d) => d.property === longhand)?.value;
  return extractCompositeSubValue(id, authored ?? computedVal);
}
