// Class parser attaching properties according to Table 8.2 and R-TW-03.
import { matchProperty } from './properties.ts';
import { parseRawClasses } from './tokenizer.ts';
import type { ClassContext, ClassToken } from './types.ts';

const STANDARD_RESPONSIVE = new Set([
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  'max-sm',
  'max-md',
  'max-lg',
  'max-xl',
  'max-2xl',
]);

const STANDARD_STATES = new Set(['hover', 'focus', 'disabled']);

export function isValidVariant(variant: string, ctx: ClassContext): boolean {
  if (STANDARD_RESPONSIVE.has(variant) || STANDARD_STATES.has(variant)) {
    return true;
  }
  return ctx.theme.breakpoints.some((b) => {
    const rawName = b.name.replace(/^--breakpoint-/, '');
    return variant === rawName || variant === `max-${rawName}`;
  });
}

export function parseClasses(input: string, ctx: ClassContext): ClassToken[] {
  const rawTokens = parseRawClasses(input);
  return rawTokens.map((rawTok) => {
    const allVariantsValid = rawTok.variants.every((v) => isValidVariant(v, ctx));
    if (!allVariantsValid) {
      return {
        ...rawTok,
        property: undefined,
        value: undefined,
      };
    }

    const matched = matchProperty(rawTok.utility, ctx.theme);
    if (matched === undefined) {
      return {
        ...rawTok,
        property: undefined,
        value: undefined,
      };
    }

    return {
      ...rawTok,
      property: matched.property,
      value: matched.value,
    };
  });
}
