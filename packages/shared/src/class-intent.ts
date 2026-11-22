// Class edits sent as intents (03 section 3.3, ADR-A4): the Studio says what to change, the server
// works out the classes with the same pure functions (@kumicraft/style-tailwind) and writes them.
import { z } from 'zod';

import { PlacementSchema } from './placement.ts';
import { BreakpointSchema, InteractionStateSchema } from './responsive.ts';

const PropertyIdSchema = z.string().min(1).max(60);

/** A value of one property: a scale step, a keyword, a theme token or arbitrary CSS. */
export const ClassValueSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('scale'), token: z.string().min(1).max(60) }),
  z.strictObject({ kind: z.literal('keyword'), name: z.string().min(1).max(60) }),
  z.strictObject({ kind: z.literal('theme'), name: z.string().min(1).max(60) }),
  z.strictObject({ kind: z.literal('arbitrary'), css: z.string().min(1).max(300) }),
]);

/** Where a value applies: a breakpoint, and optionally a state (hover…) or dark mode. */
export const ClassScopeSchema = z.strictObject({
  breakpoint: BreakpointSchema,
  state: InteractionStateSchema.optional(),
  dark: z.boolean().optional(),
});

/** The widths of the Canvas frames and the one being edited (spec-log #141). */
export const ScreenWidthsSchema = z.strictObject({
  widths: z.array(z.number().int().min(1).max(20_000)).max(50),
  activeIndex: z.number().int().min(0).max(49),
});

/** A Canvas change (drag, resize…) reaches the active screen only, or every screen (#144). */
export const CanvasScopeSchema = z.strictObject({
  screens: ScreenWidthsSchema,
  onlyThisScreen: z.boolean(),
});
export type CanvasScope = z.infer<typeof CanvasScopeSchema>;

const ClassEntrySchema = z.strictObject({
  property: PropertyIdSchema,
  value: ClassValueSchema.optional(), // absent: drop the value
  scope: ClassScopeSchema.optional(), // absent: the step's scope
});

const SizeSchema = {
  width: z.number().min(0).max(100_000).optional(),
  height: z.number().min(0).max(100_000).optional(),
};

export const ClassStepSchema = z.discriminatedUnion('kind', [
  /** Inspector fields: every screen, or only the active one (never "ask": the Studio asked). */
  z.strictObject({
    kind: z.literal('set'),
    entries: z.array(ClassEntrySchema).min(1).max(40),
    scope: ClassScopeSchema,
    screens: ScreenWidthsSchema,
    mode: z.enum(['all', 'only']),
  }),
  /** One value in one scope, with no screen split (several elements selected). */
  z.strictObject({
    kind: z.literal('value'),
    property: PropertyIdSchema,
    scope: ClassScopeSchema,
    value: ClassValueSchema.optional(),
  }),
  /** Free placement, or back to the flow (R-FF-11). */
  z.strictObject({
    kind: z.literal('place'),
    placement: PlacementSchema,
    canvas: CanvasScopeSchema.optional(),
  }),
  z.strictObject({ kind: z.literal('size'), ...SizeSchema, canvas: CanvasScopeSchema.optional() }),
  z.strictObject({ kind: z.literal('clearSize'), canvas: CanvasScopeSchema.optional() }),
  /** A free frame turned on: positioned, keeping the size it shows (spec-log #127, #129). */
  z.strictObject({ kind: z.literal('frameOn'), ...SizeSchema }),
  z.strictObject({ kind: z.literal('frameOff') }),
  /** A marker class the page needs, such as `group` for group-hover. */
  z.strictObject({
    kind: z.literal('addClass'),
    name: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[\w:/.[\]-]+$/),
  }),
  /** The class text the user typed, or the classes a free frame put back (spec-log #126). */
  z.strictObject({ kind: z.literal('raw'), className: z.string().max(4000) }),
]);
export type ClassStep = z.infer<typeof ClassStepSchema>;

/**
 * Changes the static classes of one element. `before` is the class the Studio read: the server
 * refuses the edit when the file holds another one (E017), as for `setClassName`.
 */
export const SetClassesEditSchema = z.strictObject({
  kind: z.literal('setClasses'),
  loc: z.string().min(1),
  tag: z.string().min(1),
  before: z.string().max(4000),
  steps: z.array(ClassStepSchema).min(1).max(50),
});
export type SetClassesEdit = z.infer<typeof SetClassesEditSchema>;
