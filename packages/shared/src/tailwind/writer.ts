// writeValue implementation conforming to R-TW-05, R-TW-06, and R-TW-07.
import type { InteractionState } from '../responsive.ts';
import { parseClasses } from './parser.ts';
import { ALL_TO_MEMBERS, formatClassValue } from './properties.ts';
import type { ClassContext, ClassToken, ClassValue, PropertyId, Scope } from './types.ts';

const STATE_TO_VARIANT: Readonly<Record<InteractionState, string>> = {
  hover: 'hover',
  active: 'active',
  focus: 'focus',
  disabled: 'disabled',
  groupHover: 'group-hover',
  selected: 'data-[selected=true]',
};

function getTargetVariants(scope: Scope, ctx: ClassContext): string[] {
  const list: string[] = [];
  if (scope.breakpoint !== 'base') {
    if (ctx.mode === 'desktop-first') {
      list.push(`max-${scope.breakpoint}`);
    } else {
      list.push(scope.breakpoint);
    }
  }
  if (scope.dark === true) {
    list.push('dark');
  }
  if (scope.state !== undefined) {
    list.push(STATE_TO_VARIANT[scope.state]);
  }
  return list;
}

function variantsMatch(
  tokenVariants: readonly string[],
  targetVariants: readonly string[],
): boolean {
  if (tokenVariants.length !== targetVariants.length) return false;
  const targetSet = new Set(targetVariants);
  return tokenVariants.every((v) => targetSet.has(v));
}

function deleteTokenRange(text: string, start: number, end: number): string {
  let delStart = start;
  while (delStart > 0 && /\s/.test(text[delStart - 1] ?? '')) {
    delStart -= 1;
  }
  if (delStart < start) {
    return text.slice(0, delStart) + text.slice(end);
  }
  let delEnd = end;
  while (delEnd < text.length && /\s/.test(text[delEnd] ?? '')) {
    delEnd += 1;
  }
  return text.slice(0, start) + text.slice(delEnd);
}

function buildTokenString(
  property: PropertyId,
  value: ClassValue,
  variants: readonly string[],
  important: boolean,
  major: 3 | 4 = 4,
): string {
  const util = formatClassValue(property, value, major);
  const imp = important ? '!' : '';
  const prefix = variants.length > 0 ? `${variants.join(':')}:` : '';
  return `${prefix}${imp}${util}`;
}

const BORDER_SIDE_PROPS = [
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
] as const;

const BORDER_CORNER_PROPS = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
] as const;

const BORDER_SIDE_SET: ReadonlySet<string> = new Set(BORDER_SIDE_PROPS);
const BORDER_CORNER_SET: ReadonlySet<string> = new Set(BORDER_CORNER_PROPS);

function valuesEqual(a?: ClassValue, b?: ClassValue): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'scale' && b.kind === 'scale') return a.token === b.token;
  if (a.kind === 'keyword' && b.kind === 'keyword') return a.name === b.name;
  if (a.kind === 'theme' && b.kind === 'theme') return a.name === b.name;
  if (a.kind === 'arbitrary' && b.kind === 'arbitrary') return a.css === b.css;
  return false;
}

function mergeEqualSidesOrCorners(
  current: string,
  targetVariants: readonly string[],
  ctx: ClassContext,
  major: 3 | 4,
): string {
  const tokens = parseClasses(current, ctx);
  const matched = tokens.filter(
    (t) => t.property !== undefined && variantsMatch(t.variants, targetVariants),
  );

  const sideTokens: ClassToken[] = [];
  for (const prop of BORDER_SIDE_PROPS) {
    const found = matched.find((t) => t.property === prop);
    if (found !== undefined) sideTokens.push(found);
  }
  if (sideTokens.length === BORDER_SIDE_PROPS.length) {
    const firstVal = sideTokens[0]?.value;
    if (firstVal !== undefined && sideTokens.every((t) => valuesEqual(t.value, firstVal))) {
      const next = removeMatchedTokens(current, sideTokens);
      return appendNewToken(next, 'borderWidth', firstVal, targetVariants, major);
    }
  }

  const cornerTokens: ClassToken[] = [];
  for (const prop of BORDER_CORNER_PROPS) {
    const found = matched.find((t) => t.property === prop);
    if (found !== undefined) cornerTokens.push(found);
  }
  if (cornerTokens.length === BORDER_CORNER_PROPS.length) {
    const firstVal = cornerTokens[0]?.value;
    if (firstVal !== undefined && cornerTokens.every((t) => valuesEqual(t.value, firstVal))) {
      const next = removeMatchedTokens(current, cornerTokens);
      return appendNewToken(next, 'borderRadius', firstVal, targetVariants, major);
    }
  }

  return current;
}

function expandShorthandBeforeSideWrite(
  input: string,
  property: PropertyId,
  tokens: readonly ClassToken[],
  targetVariants: readonly string[],
  major: 3 | 4,
): string {
  if (BORDER_SIDE_SET.has(property)) {
    const bwToken = tokens.find(
      (t) => t.property === 'borderWidth' && variantsMatch(t.variants, targetVariants),
    );
    if (bwToken?.value) {
      let next = removeMatchedTokens(input, [bwToken]);
      for (const side of BORDER_SIDE_PROPS.filter((s) => s !== property)) {
        next = appendNewToken(next, side, bwToken.value, targetVariants, major);
      }
      return next;
    }
  }
  if (BORDER_CORNER_SET.has(property)) {
    const brToken = tokens.find(
      (t) => t.property === 'borderRadius' && variantsMatch(t.variants, targetVariants),
    );
    if (brToken?.value) {
      let next = removeMatchedTokens(input, [brToken]);
      for (const corner of BORDER_CORNER_PROPS.filter((c) => c !== property)) {
        next = appendNewToken(next, corner, brToken.value, targetVariants, major);
      }
      return next;
    }
  }
  return input;
}

export function writeValue(
  input: string,
  property: PropertyId,
  scope: Scope,
  value: ClassValue | undefined,
  ctx: ClassContext,
): string {
  const major = ctx.major ?? 4;
  const targetVariants = getTargetVariants(scope, ctx);
  const initialTokens = parseClasses(input, ctx);
  const workingInput =
    value !== undefined
      ? expandShorthandBeforeSideWrite(input, property, initialTokens, targetVariants, major)
      : input;
  const tokens = workingInput === input ? initialTokens : parseClasses(workingInput, ctx);
  const familyMembers = ALL_TO_MEMBERS[property] ?? [];
  const targetProps = new Set<string>([property, ...familyMembers]);

  const matched = tokens.filter(
    (t) =>
      t.property !== undefined &&
      targetProps.has(t.property) &&
      variantsMatch(t.variants, targetVariants),
  );

  let result: string;
  if (value === undefined) {
    result = removeMatchedTokens(workingInput, matched);
  } else {
    const exactToken = matched.find((t) => t.property === property);
    if (exactToken !== undefined) {
      result = replaceExactToken(workingInput, exactToken, property, value, matched, major);
    } else if (matched.length > 0 && matched[0] !== undefined) {
      result = replaceFirstOtherToken(
        workingInput,
        matched[0],
        property,
        value,
        targetVariants,
        matched,
        major,
      );
    } else {
      result = appendNewToken(workingInput, property, value, targetVariants, major);
    }
  }

  return mergeEqualSidesOrCorners(result, targetVariants, ctx, major);
}

function removeMatchedTokens(input: string, matched: readonly ClassToken[]): string {
  let result = input;
  const sorted = [...matched].sort((a, b) => b.start - a.start);
  for (const tok of sorted) {
    result = deleteTokenRange(result, tok.start, tok.end);
  }
  return result;
}

function replaceExactToken(
  input: string,
  exactToken: ClassToken,
  property: PropertyId,
  value: ClassValue,
  allMatched: readonly ClassToken[],
  major: 3 | 4,
): string {
  const newStr = buildTokenString(
    property,
    value,
    exactToken.variants,
    exactToken.important,
    major,
  );
  let result = input.slice(0, exactToken.start) + newStr + input.slice(exactToken.end);
  const others = allMatched.filter((t) => t !== exactToken);
  if (others.length === 0) return result;
  const delta = newStr.length - (exactToken.end - exactToken.start);
  const sortedOthers = [...others].sort((a, b) => b.start - a.start);
  for (const other of sortedOthers) {
    const adjStart = other.start > exactToken.start ? other.start + delta : other.start;
    const adjEnd = other.end > exactToken.start ? other.end + delta : other.end;
    result = deleteTokenRange(result, adjStart, adjEnd);
  }
  return result;
}

function replaceFirstOtherToken(
  input: string,
  firstOther: ClassToken,
  property: PropertyId,
  value: ClassValue,
  targetVariants: readonly string[],
  allMatched: readonly ClassToken[],
  major: 3 | 4,
): string {
  const newStr = buildTokenString(property, value, targetVariants, false, major);
  let result = input.slice(0, firstOther.start) + newStr + input.slice(firstOther.end);
  const remaining = allMatched.slice(1);
  if (remaining.length === 0) return result;
  const delta = newStr.length - (firstOther.end - firstOther.start);
  const sortedRemaining = [...remaining].sort((a, b) => b.start - a.start);
  for (const tok of sortedRemaining) {
    const adjStart = tok.start > firstOther.start ? tok.start + delta : tok.start;
    const adjEnd = tok.end > firstOther.start ? tok.end + delta : tok.end;
    result = deleteTokenRange(result, adjStart, adjEnd);
  }
  return result;
}

function appendNewToken(
  input: string,
  property: PropertyId,
  value: ClassValue,
  targetVariants: readonly string[],
  major: 3 | 4,
): string {
  const newStr = buildTokenString(property, value, targetVariants, false, major);
  if (input.trim().length === 0) {
    return newStr;
  }
  return `${input} ${newStr}`;
}
