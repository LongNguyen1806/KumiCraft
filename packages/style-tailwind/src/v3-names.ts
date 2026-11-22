// Tailwind v4 <-> v3 class name translation table (SPEC-04 R-ST-02, spec-log #68).
import { splitOutsideDelimiters, tokenizeClasses } from './tokenizer.ts';

export const V4_TO_V3_UTILITY: Readonly<Record<string, string>> = {
  'shadow-xs': 'shadow-sm',
  'shadow-sm': 'shadow',
  'rounded-xs': 'rounded-sm',
  'rounded-sm': 'rounded',
  'blur-xs': 'blur-sm',
  'blur-sm': 'blur',
  'backdrop-blur-xs': 'backdrop-blur-sm',
  'backdrop-blur-sm': 'backdrop-blur',
  'bg-linear-to-t': 'bg-gradient-to-t',
  'bg-linear-to-tr': 'bg-gradient-to-tr',
  'bg-linear-to-r': 'bg-gradient-to-r',
  'bg-linear-to-br': 'bg-gradient-to-br',
  'bg-linear-to-b': 'bg-gradient-to-b',
  'bg-linear-to-bl': 'bg-gradient-to-bl',
  'bg-linear-to-l': 'bg-gradient-to-l',
  'bg-linear-to-tl': 'bg-gradient-to-tl',
  'outline-hidden': 'outline-none',
  'ring-3': 'ring',
  grow: 'flex-grow',
  shrink: 'flex-shrink',
};

export const V3_TO_V4_UTILITY: Readonly<Record<string, string>> = {
  'shadow-sm': 'shadow-xs',
  shadow: 'shadow-sm',
  'rounded-sm': 'rounded-xs',
  rounded: 'rounded-sm',
  'blur-sm': 'blur-xs',
  blur: 'blur-sm',
  'backdrop-blur-sm': 'backdrop-blur-xs',
  'backdrop-blur': 'backdrop-blur-sm',
  'bg-gradient-to-t': 'bg-linear-to-t',
  'bg-gradient-to-tr': 'bg-linear-to-tr',
  'bg-gradient-to-r': 'bg-linear-to-r',
  'bg-gradient-to-br': 'bg-linear-to-br',
  'bg-gradient-to-b': 'bg-linear-to-b',
  'bg-gradient-to-bl': 'bg-linear-to-bl',
  'bg-gradient-to-l': 'bg-linear-to-l',
  'bg-gradient-to-tl': 'bg-linear-to-tl',
  'outline-none': 'outline-hidden',
  ring: 'ring-3',
  'flex-grow': 'grow',
  'flex-shrink': 'shrink',
};

export function v4ToV3Utility(utility: string): string {
  return V4_TO_V3_UTILITY[utility] ?? utility;
}

export function v3ToV4Utility(utility: string): string {
  return V3_TO_V4_UTILITY[utility] ?? utility;
}

function translateToken(token: string, map: Readonly<Record<string, string>>): string {
  const parts = splitOutsideDelimiters(token, ':');
  const rawUtility = parts[parts.length - 1] ?? '';
  const variants = parts.slice(0, -1);

  let prefixImp = '';
  let suffixImp = '';
  let util = rawUtility;
  if (util.startsWith('!')) {
    prefixImp = '!';
    util = util.slice(1);
  } else if (util.endsWith('!')) {
    suffixImp = '!';
    util = util.slice(0, -1);
  }

  const mapped = map[util];
  if (mapped === undefined) return token;

  const nextUtil = `${prefixImp}${mapped}${suffixImp}`;
  return variants.length > 0 ? `${variants.join(':')}:${nextUtil}` : nextUtil;
}

export function v4ToV3Class(token: string): string {
  return translateToken(token, V4_TO_V3_UTILITY);
}

export function v3ToV4Class(token: string): string {
  return translateToken(token, V3_TO_V4_UTILITY);
}

function translateClassList(input: string, map: Readonly<Record<string, string>>): string {
  const tokens = tokenizeClasses(input);
  if (tokens.length === 0) return input;
  let result = input;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const tok = tokens[i];
    if (tok !== undefined) {
      const next = translateToken(tok.raw, map);
      if (next !== tok.raw) {
        result = result.slice(0, tok.start) + next + result.slice(tok.end);
      }
    }
  }
  return result;
}

export function v4ToV3Classes(input: string): string {
  return translateClassList(input, V4_TO_V3_UTILITY);
}

export function v3ToV4Classes(input: string): string {
  return translateClassList(input, V3_TO_V4_UTILITY);
}
