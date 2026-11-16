// Free position and frame placement helpers (SPEC-04 section 18E, R-FF-11, R-FF-12).
import { z } from 'zod';

import { matchProperty } from './properties.ts';
import { parseRawClasses } from './tokenizer.ts';
import type { ClassToken, ClassValue, PropertyId } from './types.ts';

export const CONTAINER_TAGS = [
  'div',
  'section',
  'main',
  'header',
  'footer',
  'nav',
  'aside',
  'article',
  'form',
  'fieldset',
  'ul',
  'ol',
] as const;

const CONTAINER_TAG_SET: ReadonlySet<string> = new Set(CONTAINER_TAGS);

export function isContainerTag(tag: string): boolean {
  return CONTAINER_TAG_SET.has(tag.toLowerCase());
}

/** `ProjectInfo.support.versions.tailwindcss` → 3 | 4; unreadable → 4 (WP-2.12a section 3.1). */
export function tailwindMajorOf(version: string | undefined): 3 | 4 {
  const match = version === undefined ? undefined : /\d+/.exec(version);
  return match?.[0] === '3' ? 3 : 4;
}

/** Offset of the n-th element in a multi-element free drop or paste (R-FF-12). */
export const FREE_STACK_OFFSET_PX = 16;

export type FreeBox = {
  readonly left: number;
  readonly top: number;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
};

export const FreeBoxSchema = z.strictObject({
  left: z.number(),
  top: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const PlacementSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('free'),
    left: z.number(),
    top: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.strictObject({
    kind: z.literal('flow'),
  }),
]);
export type Placement = z.infer<typeof PlacementSchema>;

/** R-FF-11: Tailwind v4 và px chia hết cho 4 → thang chuẩn (`left-30`); còn lại → `left-[123px]`. */
export function pxClass(
  prop: 'left' | 'top' | 'w' | 'h',
  px: number,
  tailwindMajor: 3 | 4 = 4,
): string {
  if (tailwindMajor === 4 && px % 4 === 0) {
    return `${prop}-${String(px / 4)}`;
  }
  return `${prop}-[${String(px)}px]`;
}

/** Làm tròn gần nhất theo ô lưới, không âm. */
export function snap(px: number, grid: 1 | 4 | 8 | 16): number {
  return Math.max(0, Math.round(px / grid) * grid);
}

const COORDINATE_PROPERTIES: ReadonlySet<PropertyId> = new Set([
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'insetX',
  'insetY',
  'zIndex',
]);

function propertyOf(tok: ClassToken): PropertyId | undefined {
  return matchProperty(tok.utility)?.property;
}

function isRemovedInFree(tok: ClassToken, hasWidth: boolean, hasHeight: boolean): boolean {
  const property = propertyOf(tok);
  if (property === undefined) return false;
  if (property === 'position' || COORDINATE_PROPERTIES.has(property)) return true;
  if (hasWidth && property === 'width') return true;
  if (hasHeight && property === 'height') return true;
  return false;
}

function isRemovedInFlow(tok: ClassToken): boolean {
  if (tok.utility === 'absolute') return true;
  const property = propertyOf(tok);
  return property !== undefined && COORDINATE_PROPERTIES.has(property);
}

/** Keeps every class except unprefixed ones matching `predicate`, in their original order. */
function filterExistingClasses(
  classString: string,
  predicate: (tok: ClassToken) => boolean,
): string[] {
  return parseRawClasses(classString)
    .filter((tok) => tok.variants.length > 0 || !predicate(tok))
    .map((tok) => tok.raw);
}

function buildFreeClasses(
  placement: Extract<Placement, { kind: 'free' }>,
  tailwindMajor: 3 | 4,
): string[] {
  const added: string[] = [
    'absolute',
    pxClass('left', placement.left, tailwindMajor),
    pxClass('top', placement.top, tailwindMajor),
  ];
  if (placement.width !== undefined) {
    added.push(pxClass('w', placement.width, tailwindMajor));
  }
  if (placement.height !== undefined) {
    added.push(pxClass('h', placement.height, tailwindMajor));
  }
  return added;
}

/**
 * Đổi chuỗi class theo placement, giữ nguyên mọi class khác và thứ tự của chúng.
 * - free: bỏ absolute/relative/fixed/static/sticky, left-*, top-*, right-*, bottom-*, inset-*, z-*
 *   rồi thêm absolute, left-…, top-…, và w-…/h-… khi có width/height (thay w-/h- cũ).
 * - flow: bỏ absolute, left-*, top-*, right-*, bottom-*, inset-*, z-*; giữ w-/h-.
 * Chỉ đụng các class không có tiền tố (không đụng md:left-4, hover:…).
 */
export function applyPlacement(
  classString: string,
  placement: Placement,
  tailwindMajor: 3 | 4 = 4,
): string {
  if (placement.kind === 'flow') {
    const kept = filterExistingClasses(classString, isRemovedInFlow);
    return kept.join(' ');
  }

  const hasWidth = placement.width !== undefined;
  const hasHeight = placement.height !== undefined;
  const kept = filterExistingClasses(classString, (tok) =>
    isRemovedInFree(tok, hasWidth, hasHeight),
  );
  const added = buildFreeClasses(placement, tailwindMajor);

  return [...kept, ...added].join(' ');
}

function valueToPx(value: ClassValue | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (value.kind === 'scale') {
    if (value.token === 'px') return 1;
    return /^\d+(\.\d+)?$/.test(value.token) ? Number(value.token) * 4 : undefined;
  }
  if (value.kind === 'arbitrary') {
    const match = /^(\d+(\.\d+)?)px$/.exec(value.css);
    return match?.[1] === undefined ? undefined : Number(match[1]);
  }
  return undefined;
}

/**
 * Reads the px value of an unprefixed `left-*`, `top-*`, `w-*` or `h-*` class through the
 * Tailwind model; keywords and fractions (`w-full`, `w-1/2`) give `undefined`.
 */
export function readClassPx(
  classString: string,
  prop: 'left' | 'top' | 'width' | 'height',
): number | undefined {
  for (const tok of parseRawClasses(classString)) {
    if (tok.variants.length > 0) continue;
    const matched = matchProperty(tok.utility);
    if (matched?.property !== prop) continue;
    const px = valueToPx(matched.value);
    if (px !== undefined) return tok.negative ? -px : px;
  }
  return undefined;
}

/** R-FF-14 outside a free frame: replaces unprefixed `w-*`/`h-*` with the given px sizes. */
export function applySize(
  classString: string,
  size: { readonly width?: number | undefined; readonly height?: number | undefined },
  tailwindMajor: 3 | 4 = 4,
): string {
  const kept = filterExistingClasses(classString, (tok) => {
    const property = propertyOf(tok);
    return (
      (size.width !== undefined && property === 'width') ||
      (size.height !== undefined && property === 'height')
    );
  });
  if (size.width !== undefined) kept.push(pxClass('w', size.width, tailwindMajor));
  if (size.height !== undefined) kept.push(pxClass('h', size.height, tailwindMajor));
  return kept.join(' ');
}

/** R-FF-14 double-click on a handle: drops every unprefixed `w-*`/`h-*` (natural size). */
export function clearSize(classString: string): string {
  return filterExistingClasses(classString, (tok) => {
    const property = propertyOf(tok);
    return property === 'width' || property === 'height';
  }).join(' ');
}

/**
 * True when the classes only place an element in a free frame (`absolute left-4 top-4 w-60`): the
 * class list of the `<div>` the Studio puts around a component that takes no `className`.
 */
export function isPlacementOnly(classString: string): boolean {
  const tokens = parseRawClasses(classString);
  return (
    hasFreePosition(classString) &&
    tokens.every((tok) => tok.variants.length === 0 && isRemovedInFree(tok, true, true))
  );
}

/** True when the class string positions the element absolutely with `left`/`top`. */
export function hasFreePosition(classString: string): boolean {
  const tokens = parseRawClasses(classString).filter((tok) => tok.variants.length === 0);
  return (
    tokens.some((tok) => tok.utility === 'absolute') &&
    (readClassPx(classString, 'left') !== undefined ||
      readClassPx(classString, 'top') !== undefined)
  );
}
