// Tokenizer for Tailwind class strings (SPEC-04 section 8, R-TW-01, R-TW-02, R-TW-03).
import type { ClassToken } from './types.ts';

export type RawToken = {
  readonly raw: string;
  readonly start: number;
  readonly end: number;
};

const FRACTION_PREFIXES = [
  'w-',
  'h-',
  'min-w-',
  'max-w-',
  'min-h-',
  'max-h-',
  'inset-',
  'inset-x-',
  'inset-y-',
  'top-',
  'bottom-',
  'left-',
  'right-',
  'basis-',
  'aspect-',
  'gap-',
  'gap-x-',
  'gap-y-',
  'translate-',
  'translate-x-',
  'translate-y-',
] as const;

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}

function updateBracketState(
  char: string,
  state: { bracket: number; paren: number; quote?: string | undefined },
): void {
  if (state.quote !== undefined) {
    if (char === state.quote) state.quote = undefined;
    return;
  }
  if (char === "'" || char === '"') {
    state.quote = char;
  } else if (char === '[') {
    state.bracket += 1;
  } else if (char === ']' && state.bracket > 0) {
    state.bracket -= 1;
  } else if (char === '(') {
    state.paren += 1;
  } else if (char === ')' && state.paren > 0) {
    state.paren -= 1;
  }
}

/** Tách token theo khoảng trắng ASCII nằm ngoài `[]` và `()`, giữ start và end (R-TW-01). */
export function tokenizeClasses(input: string): RawToken[] {
  const tokens: RawToken[] = [];
  const state = { bracket: 0, paren: 0, quote: undefined as string | undefined };
  let tokenStart = -1;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i] ?? '';
    updateBracketState(char, state);

    const outside = state.bracket === 0 && state.paren === 0 && state.quote === undefined;
    if (outside && isWhitespace(char)) {
      if (tokenStart !== -1) {
        tokens.push({ raw: input.slice(tokenStart, i), start: tokenStart, end: i });
        tokenStart = -1;
      }
    } else if (tokenStart === -1) {
      tokenStart = i;
    }
  }

  if (tokenStart !== -1) {
    tokens.push({
      raw: input.slice(tokenStart, input.length),
      start: tokenStart,
      end: input.length,
    });
  }

  return tokens;
}

export function splitOutsideDelimiters(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  const state = { bracket: 0, paren: 0, quote: undefined as string | undefined };
  let start = 0;

  for (let i = 0; i < str.length; i += 1) {
    const char = str[i] ?? '';
    updateBracketState(char, state);

    const outside = state.bracket === 0 && state.paren === 0 && state.quote === undefined;
    if (outside && char === delimiter) {
      parts.push(str.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(str.slice(start));
  return parts;
}

function isFractionUtility(utility: string): boolean {
  return FRACTION_PREFIXES.some((prefix) => utility.startsWith(prefix));
}

function extractOpacity(utility: string): {
  baseUtility: string;
  opacity?: string | undefined;
} {
  if (isFractionUtility(utility)) {
    return { baseUtility: utility, opacity: undefined };
  }
  const slashParts = splitOutsideDelimiters(utility, '/');
  if (slashParts.length > 1) {
    const opacity = slashParts[slashParts.length - 1];
    const base = slashParts.slice(0, -1).join('/');
    return { baseUtility: base, opacity: opacity && opacity.length > 0 ? opacity : undefined };
  }
  return { baseUtility: utility, opacity: undefined };
}

function extractImportant(rawUtility: string): {
  utility: string;
  important: boolean;
} {
  let utility = rawUtility;
  let important = false;
  if (utility.startsWith('!')) {
    important = true;
    utility = utility.slice(1);
  } else if (utility.endsWith('!')) {
    important = true;
    utility = utility.slice(0, -1);
  }
  return { utility, important };
}

/** Tách biến thể `:`, cờ important `!`, cờ âm `-` và opacity `/` (R-TW-02, R-TW-03). */
export function parseTokenModifiers(rawToken: RawToken): ClassToken {
  const colonParts = splitOutsideDelimiters(rawToken.raw, ':');
  const rawUtility = colonParts[colonParts.length - 1] ?? '';
  const variants = colonParts.slice(0, -1);

  const { utility: withoutImportant, important } = extractImportant(rawUtility);

  let negative = false;
  let utilityAfterNegative = withoutImportant;
  if (utilityAfterNegative.startsWith('-')) {
    negative = true;
    utilityAfterNegative = utilityAfterNegative.slice(1);
  }

  const { baseUtility, opacity } = extractOpacity(utilityAfterNegative);

  return {
    raw: rawToken.raw,
    start: rawToken.start,
    end: rawToken.end,
    variants,
    important,
    negative,
    utility: baseUtility,
    opacity,
  };
}

export function parseRawClasses(input: string): ClassToken[] {
  const rawTokens = tokenizeClasses(input);
  return rawTokens.map(parseTokenModifiers);
}
