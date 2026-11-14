// Pure selector-part rewriting for dark mode and interaction states in style-probe (K9.8-1).
import { type StyleState } from '@kumicraft/shared';

function lastCompoundStart(selector: string): number {
  let depth = 0;
  let quote: string | undefined;
  let splitAt = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && (ch === ' ' || ch === '\t' || ch === '>' || ch === '+' || ch === '~')) {
      splitAt = i + 1;
    }
  }
  return splitAt;
}

function applyDarkFilter(part: string, dark: boolean | undefined): string | undefined {
  const hasDark =
    /:where\(\.dark\s*,\s*\.dark\s*\*\)/.test(part) ||
    /(?:^|[\s>+~(])(?:html)?\.dark(?=[\s>+~),]|$)/.test(part);
  if (dark !== true) {
    return hasDark ? undefined : part;
  }
  if (!hasDark) return part;
  return part
    .replace(/:where\(\.dark\s*,\s*\.dark\s*\*\)/g, '')
    .replace(/(^|[\s>+~(])(?:html)?\.dark(?=[\s>+~),]|$)/g, '$1')
    .replace(/^\s*[>+~]\s*/, '')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripPseudoStateInTail(part: string, pseudo: string): string | undefined {
  const tokenRe = new RegExp(`(?<!:):${pseudo}(?![\\w-])`);
  if (!tokenRe.test(part)) return part;
  if (new RegExp(`:not\\([^)]*(?<!:):${pseudo}(?![\\w-])[^)]*\\)`).test(part)) return undefined;
  const splitAt = lastCompoundStart(part);
  const head = part.slice(0, splitAt);
  const tail = part.slice(splitAt);
  if (tokenRe.test(head)) return undefined;
  const strippedTail =
    tail.replace(new RegExp(`(?<!:):${pseudo}(?![\\w-])`, 'g'), '').trim() || '*';
  return `${head}${strippedTail}`;
}

function stripSelectedInTail(part: string): string | undefined {
  const selRe = /\[data-selected=(?:"true"|'true'|true)\]/g;
  if (!selRe.test(part)) return part;
  const splitAt = lastCompoundStart(part);
  const head = part.slice(0, splitAt);
  const tail = part.slice(splitAt);
  selRe.lastIndex = 0;
  if (selRe.test(head)) return undefined;
  selRe.lastIndex = 0;
  const strippedTail = tail.replace(selRe, '').trim() || '*';
  return `${head}${strippedTail}`;
}

function stripGroupHoverInHead(part: string, groupSelector: string): string | undefined {
  const splitAt = lastCompoundStart(part);
  const head = part.slice(0, splitAt);
  const tail = part.slice(splitAt);
  if (!head.includes(':hover') && !tail.includes(':hover')) return part;
  if (/:hover/.test(tail)) return undefined;
  const esc = escapeRegExp(groupSelector);
  const re = new RegExp(`(${esc}):hover(?=[\\s>+~]|$)`, 'g');
  if (!re.test(head)) {
    // Generic fallback for any ancestor `:hover` rule when groupSelector is `.group` or custom.
    if (/\.group:hover(?![\w-])/.test(head)) {
      return `${head.replace(/\.group:hover(?![\w-])/g, '.group')}${tail}`;
    }
    return undefined;
  }
  re.lastIndex = 0;
  return `${head.replace(re, '$1')}${tail}`;
}

export function rewriteSelectorPartForProbe(
  part: string,
  state?: StyleState,
  dark?: boolean,
  groupSelector?: string,
): string | undefined {
  const withDark = applyDarkFilter(part, dark);
  if (withDark === undefined || withDark === '') return undefined;
  if (state === undefined) return withDark;
  if (state === 'selected') return stripSelectedInTail(withDark);
  if (state === 'groupHover') return stripGroupHoverInHead(withDark, groupSelector ?? '.group');
  return stripPseudoStateInTail(withDark, state);
}
