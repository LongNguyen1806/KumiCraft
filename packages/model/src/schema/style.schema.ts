// Visual properties of a node (SPEC-03 section 4.5). Rules that need the node type or the parent
// (V-26, V-27) are checked by validateDocument; this schema checks shapes and ranges.
import { z } from 'zod';

import {
  ColorSchema,
  LimitValueSchema,
  PxSchema,
  SizeValueSchema,
  SpacingSchema,
  tokenRefSchema,
} from './primitives.schema.ts';

export function sidesSchema<T extends z.ZodType>(value: T) {
  return z.strictObject({
    top: value.optional(),
    right: value.optional(),
    bottom: value.optional(),
    left: value.optional(),
  });
}

const GradientStopSchema = z.strictObject({
  color: ColorSchema,
  at: z.number().min(0).max(100),
});

/** V-38: 2..5 stops in increasing order. Image sources follow V-24 (checked with the assets). */
export const BackgroundImageSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      kind: z.literal('linear-gradient'),
      angle: z.int().min(0).max(359),
      stops: z.array(GradientStopSchema).min(2).max(5),
    })
    .refine(
      (gradient) =>
        gradient.stops.every((stop, i, all) => i === 0 || stop.at > (all[i - 1]?.at ?? -1)),
      {
        message: 'Gradient stops must be in increasing order (V-38)',
        path: ['stops'],
      },
    ),
  z.strictObject({
    kind: z.literal('image'),
    src: z.string().min(1),
    size: z.enum(['cover', 'contain', 'auto']),
    position: z.enum(['center', 'top', 'bottom', 'left', 'right']),
    repeat: z.boolean(),
  }),
]);
export type BackgroundImage = z.infer<typeof BackgroundImageSchema>;

const span = z.int().min(1).max(12);

export const StylePropsSchema = z
  .strictObject({
    // Layout (containers only, V-26)
    direction: z.enum(['row', 'column']).optional(),
    gap: SpacingSchema.optional(),
    align: z.enum(['start', 'center', 'end', 'stretch', 'baseline']).optional(),
    justify: z.enum(['start', 'center', 'end', 'between', 'around', 'evenly']).optional(),
    wrap: z.boolean().optional(),
    columns: span.optional(),
    rows: span.optional(),
    autoFit: z.strictObject({ minColumnWidth: PxSchema }).optional(),

    // Position inside the parent (V-27)
    grow: z.boolean().optional(),
    alignSelf: z.enum(['auto', 'start', 'center', 'end', 'stretch']).optional(),
    colSpan: z.union([span, z.literal('full')]).optional(),
    rowSpan: span.optional(),

    // Size
    width: SizeValueSchema.optional(),
    height: SizeValueSchema.optional(),
    minWidth: LimitValueSchema.optional(),
    maxWidth: LimitValueSchema.optional(),
    minHeight: LimitValueSchema.optional(),
    maxHeight: LimitValueSchema.optional(),
    aspectRatio: z.enum(['1/1', '4/3', '3/2', '16/9', '21/9']).optional(),

    // Spacing
    padding: sidesSchema(SpacingSchema).optional(),
    margin: sidesSchema(SpacingSchema).optional(),

    // Typography
    fontFamily: tokenRefSchema('fontFamily').optional(),
    fontSize: z.union([tokenRefSchema('fontSize'), PxSchema]).optional(),
    fontWeight: z
      .union([tokenRefSchema('fontWeight'), z.int().min(100).max(900).multipleOf(100)])
      .optional(),
    lineHeight: z.union([tokenRefSchema('lineHeight'), z.number().positive().max(10)]).optional(),
    textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
    textColor: ColorSchema.optional(),
    textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
    truncate: z.boolean().optional(),

    // Colour, border, effects
    background: ColorSchema.optional(),
    borderWidth: sidesSchema(
      z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4), z.literal(8)]),
    ).optional(),
    borderColor: ColorSchema.optional(),
    borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    radius: z.union([tokenRefSchema('radius'), PxSchema]).optional(),
    shadow: z.union([tokenRefSchema('shadow'), z.literal('none')]).optional(),
    opacity: z.int().min(0).max(100).multipleOf(5).optional(),

    // Visibility per breakpoint
    display: z.enum(['visible', 'hidden']).optional(),

    // Position, overflow, layer (V-37: no absolute or fixed)
    position: z.enum(['static', 'sticky']).optional(),
    stickyTop: SpacingSchema.optional(),
    zIndex: z
      .union([
        z.literal(0),
        z.literal(10),
        z.literal(20),
        z.literal(30),
        z.literal(40),
        z.literal(50),
      ])
      .optional(),
    overflowX: z.enum(['visible', 'hidden', 'auto']).optional(),
    overflowY: z.enum(['visible', 'hidden', 'auto']).optional(),

    backgroundImage: BackgroundImageSchema.optional(),

    transition: z
      .strictObject({
        property: z.enum(['colors', 'opacity', 'shadow', 'all']),
        durationMs: z.union([
          z.literal(75),
          z.literal(100),
          z.literal(150),
          z.literal(200),
          z.literal(300),
          z.literal(500),
          z.literal(700),
          z.literal(1000),
        ]),
      })
      .optional(),
  })
  .refine((style) => style.stickyTop === undefined || style.position === 'sticky', {
    message: 'stickyTop needs position "sticky" (V-37)',
    path: ['stickyTop'],
  })
  .refine((style) => style.autoFit === undefined || style.columns === undefined, {
    message: 'autoFit and columns cannot be set in the same breakpoint (V-26)',
    path: ['autoFit'],
  });
export type StyleProps = z.infer<typeof StylePropsSchema>;

/** Properties allowed in hover, focus and disabled states (SPEC-03 section 4.5). */
export const StateStylePropsSchema = z.strictObject({
  background: ColorSchema.optional(),
  textColor: ColorSchema.optional(),
  borderColor: ColorSchema.optional(),
  shadow: z.union([tokenRefSchema('shadow'), z.literal('none')]).optional(),
  opacity: z.int().min(0).max(100).multipleOf(5).optional(),
});
export type StateStyleProps = z.infer<typeof StateStylePropsSchema>;
