// Base types of the Design Model (SPEC-03 section 2): identifiers, breakpoints, frames, values.
import { z } from 'zod';

// --- Identifiers (SPEC-03 section 2.1, ADR-BE-10) ---

export const NodeIdSchema = z.string().regex(/^n_[A-Za-z0-9_-]{10}$/);
export type NodeId = z.infer<typeof NodeIdSchema>;

export const PageIdSchema = z.string().regex(/^p_[A-Za-z0-9_-]{10}$/);
export type PageId = z.infer<typeof PageIdSchema>;

export const ComponentIdSchema = z.string().regex(/^c_[A-Za-z0-9_-]{10}$/);
export type ComponentId = z.infer<typeof ComponentIdSchema>;

export const DataSourceIdSchema = z.string().regex(/^ds_[a-z0-9_]{1,40}$/);
export type DataSourceId = z.infer<typeof DataSourceIdSchema>;

export const EndpointIdSchema = z.string().regex(/^ep_[A-Za-z0-9_-]{10}$/);
export type EndpointId = z.infer<typeof EndpointIdSchema>;

export const BackendIdSchema = z.string().regex(/^b_[A-Za-z0-9_-]{10}$/);
export type BackendId = z.infer<typeof BackendIdSchema>;

export const JobIdSchema = z.string().regex(/^j_[A-Za-z0-9_-]{12}$/);
export type JobId = z.infer<typeof JobIdSchema>;

// --- Breakpoints and states (SPEC-03 section 2.2) ---

export const RESPONSIVE_KEYS = ['sm', 'md', 'lg', 'xl', '2xl'] as const;
export const ResponsiveKeySchema = z.enum(RESPONSIVE_KEYS);
export type ResponsiveKey = z.infer<typeof ResponsiveKeySchema>;

export const BreakpointSchema = z.enum(['base', ...RESPONSIVE_KEYS]);
export type Breakpoint = z.infer<typeof BreakpointSchema>;

/** Minimum width of each responsive key, equal to the Tailwind default breakpoints. */
export const BREAKPOINT_WIDTHS: Readonly<Record<ResponsiveKey, number>> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export const ResponsiveModeSchema = z.enum(['desktop-first', 'mobile-first']);
export type ResponsiveMode = z.infer<typeof ResponsiveModeSchema>;

export const InteractionStateSchema = z.enum(['hover', 'focus', 'disabled']);
export type InteractionState = z.infer<typeof InteractionStateSchema>;

// --- Design frames (SPEC-03 section 2.2a) ---

export const FrameSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  label: z.string().min(1).max(32),
  width: z.int().min(320).max(3840),
  height: z.int().min(320).max(2160),
});
export type Frame = z.infer<typeof FrameSchema>;

// --- Design values (SPEC-03 section 2.3) ---

export const TOKEN_GROUPS = [
  'color',
  'spacing',
  'radius',
  'shadow',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'fontFamily',
] as const;
export const TokenGroupSchema = z.enum(TOKEN_GROUPS);
export type TokenGroup = z.infer<typeof TokenGroupSchema>;

export type TokenRef<G extends TokenGroup = TokenGroup> = `token:${G}.${string}`;

/** Name of a design token: lowercase words joined by hyphens, for example `surface-muted`. */
export const TOKEN_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Reference to a token of `group` (V-01: the group must match the property). Whether the token
 * exists is checked against the document by `validateDocument`.
 */
export function tokenRefSchema<G extends TokenGroup>(group: G) {
  const prefix = `token:${group}.`;
  return z
    .templateLiteral([z.literal(prefix), z.string()])
    .refine((value) => TOKEN_NAME_PATTERN.test(value.slice(prefix.length)), {
      message: `Expected ${prefix}<name> with a lowercase kebab-case name`,
    }) as unknown as z.ZodType<TokenRef<G>>;
}

/** Any token reference, whatever its group. */
export const TokenRefSchema = z
  .templateLiteral([z.literal('token:'), TokenGroupSchema, z.literal('.'), z.string()])
  .refine((value) => TOKEN_NAME_PATTERN.test(value.slice(value.indexOf('.') + 1)), {
    message: 'Expected token:<group>.<name> with a lowercase kebab-case name',
  }) as unknown as z.ZodType<TokenRef>;

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;

export const PxSchema = z.strictObject({
  px: z.number().min(0).max(10000).refine(hasAtMostTwoDecimals, {
    message: 'Expected at most two decimal places',
  }),
});
export type Px = z.infer<typeof PxSchema>;

export type HexColor = `#${string}`;

/** V-02: lowercase hex with 6 or 8 digits. */
export const HexColorSchema = z.string().regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/, {
  message: 'Expected lowercase #rrggbb or #rrggbbaa',
}) as unknown as z.ZodType<HexColor>;

export const ColorSchema = z.union([tokenRefSchema('color'), HexColorSchema]);
export type Color = TokenRef<'color'> | HexColor;

export const SpacingSchema = z.union([tokenRefSchema('spacing'), PxSchema]);
export type Spacing = TokenRef<'spacing'> | Px;

export const SizeValueSchema = z.union([
  z.literal('hug'),
  z.literal('fill'),
  z.strictObject({ fixed: PxSchema }),
  z.strictObject({ percent: z.int().min(1).max(100) }),
]);
export type SizeValue = z.infer<typeof SizeValueSchema>;

export const LimitValueSchema = z.union([PxSchema, z.literal('none')]);
export type LimitValue = z.infer<typeof LimitValueSchema>;
