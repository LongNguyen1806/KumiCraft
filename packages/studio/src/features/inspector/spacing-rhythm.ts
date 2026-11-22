// Spacing rhythm detection and nearest-step snapping for Inspector (TK-72).
import type { PropertyId } from '@kumicraft/style-tailwind';

export const TAILWIND_RHYTHM_STEPS: readonly number[] = [0, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24];
const TAILWIND_RHYTHM_SET = new Set<number>(TAILWIND_RHYTHM_STEPS);
const PX_RHYTHM_STEPS: readonly number[] = Array.from({ length: 25 }, (_v, idx) => idx * 4);

const SPACING_PROPS = new Set<PropertyId>([
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'gap',
]);

const NUMERIC_RE = /^\d+(?:\.\d+)?$/;
const PX_VALUE_RE = /^(\[)?(\d+(?:\.\d+)?)px(\])?$/;

export function isSpacingRhythmProperty(property: PropertyId): boolean {
  return SPACING_PROPS.has(property);
}

function nearestStep(value: number, steps: readonly number[]): number {
  let best = steps[0] ?? 0;
  let bestDist = Math.abs(value - best);
  for (const candidate of steps) {
    const dist = Math.abs(value - candidate);
    // Ties snap to the larger rhythm value.
    if (dist < bestDist || (dist === bestDist && candidate > best)) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

export type OffbeatSpacing = {
  readonly suggested: string;
};

/** Returns nearest rhythm suggestion when `value` is off-rhythm, or `undefined` if on-rhythm. */
export function checkSpacingRhythm(
  property: PropertyId,
  rawValue: string,
): OffbeatSpacing | undefined {
  if (!isSpacingRhythmProperty(property)) return undefined;
  const trimmed = rawValue.trim();
  if (trimmed === '' || trimmed === 'auto') return undefined;

  if (NUMERIC_RE.test(trimmed)) {
    const num = Number(trimmed);
    if (TAILWIND_RHYTHM_SET.has(num)) return undefined;
    return { suggested: String(nearestStep(num, TAILWIND_RHYTHM_STEPS)) };
  }

  const pxMatch = PX_VALUE_RE.exec(trimmed) ?? undefined;
  if (pxMatch !== undefined) {
    const openBracket = pxMatch[1] ?? '';
    const numText = pxMatch[2];
    const closeBracket = pxMatch[3] ?? '';
    if (numText === undefined) return undefined;
    const px = Number(numText);
    if (Number.isInteger(px) && px >= 0 && px <= 96 && px % 4 === 0) {
      return undefined;
    }
    const snapped = nearestStep(px, PX_RHYTHM_STEPS);
    const hasBrackets = openBracket === '[' && closeBracket === ']';
    const pxText = `${String(snapped)}px`;
    return { suggested: hasBrackets ? `[${pxText}]` : pxText };
  }

  return undefined;
}

/** Places rhythm-aligned spacing suggestions first while keeping all remaining suggestions. */
export function prioritizeSpacingSuggestions(
  property: PropertyId,
  suggestions: readonly string[],
): readonly string[] {
  if (!isSpacingRhythmProperty(property) || suggestions.length === 0) {
    return suggestions;
  }
  const onRhythm: string[] = [];
  const others: string[] = [];
  for (const item of suggestions) {
    if (NUMERIC_RE.test(item) && TAILWIND_RHYTHM_SET.has(Number(item))) {
      onRhythm.push(item);
    } else {
      others.push(item);
    }
  }
  return [...onRhythm, ...others];
}
