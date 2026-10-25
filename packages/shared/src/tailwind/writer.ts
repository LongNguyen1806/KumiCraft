// writeValue implementation conforming to R-TW-05, R-TW-06, and R-TW-07.
import { parseClasses } from './parser.ts';
import { ALL_TO_MEMBERS, formatClassValue } from './properties.ts';
import type { ClassContext, ClassToken, ClassValue, PropertyId, Scope } from './types.ts';

function getTargetVariants(scope: Scope, ctx: ClassContext): string[] {
  const list: string[] = [];
  if (scope.breakpoint !== 'base') {
    if (ctx.mode === 'desktop-first') {
      list.push(`max-${scope.breakpoint}`);
    } else {
      list.push(scope.breakpoint);
    }
  }
  if (scope.state !== undefined) {
    list.push(scope.state);
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

export function writeValue(
  input: string,
  property: PropertyId,
  scope: Scope,
  value: ClassValue | undefined,
  ctx: ClassContext,
): string {
  const major = ctx.major ?? 4;
  const targetVariants = getTargetVariants(scope, ctx);
  const tokens = parseClasses(input, ctx);
  const familyMembers = ALL_TO_MEMBERS[property] ?? [];
  const targetProps = new Set<string>([property, ...familyMembers]);

  const matched = tokens.filter(
    (t) =>
      t.property !== undefined &&
      targetProps.has(t.property) &&
      variantsMatch(t.variants, targetVariants),
  );

  if (value === undefined) {
    return removeMatchedTokens(input, matched);
  }

  const exactToken = matched.find((t) => t.property === property);
  if (exactToken !== undefined) {
    return replaceExactToken(input, exactToken, property, value, matched, major);
  }

  if (matched.length > 0) {
    const firstOther = matched[0];
    if (firstOther !== undefined) {
      return replaceFirstOtherToken(
        input,
        firstOther,
        property,
        value,
        targetVariants,
        matched,
        major,
      );
    }
  }

  return appendNewToken(input, property, value, targetVariants, major);
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
