// Style layer: one model of style properties for every styling system (SPEC-04 M-ST, ADR-BE-35).
import { z } from 'zod';

import { ElementRefSchema } from './bridge.ts';
import type { StylingReport } from './project.ts';
import { RelPathSchema } from './rel-path.ts';
import {
  type Breakpoint,
  BREAKPOINT_WIDTHS,
  type ResponsiveKey,
  type ResponsiveMode,
} from './responsive.ts';

export const STYLE_SYSTEM_IDS = [
  'tailwind4',
  'tailwind3',
  'bootstrap5',
  'cssModules',
  'css',
  'sass',
  'less',
] as const;
export const StyleSystemIdSchema = z.enum(STYLE_SYSTEM_IDS);
export type StyleSystemId = z.infer<typeof StyleSystemIdSchema>;

export const STYLE_STATES = ['hover', 'focus', 'disabled'] as const;
export const StyleStateSchema = z.enum(STYLE_STATES);
export type StyleState = z.infer<typeof StyleStateSchema>;

/**
 * Inspector properties (the `PropertyId`s of M-TW) that are one CSS longhand. The style layer reads
 * them from the browser by these names (R-ST-04); grouped properties (`paddingX`) come later.
 */
export const CSS_LONGHAND_OF: Readonly<Record<string, string>> = {
  paddingTop: 'padding-top',
  paddingRight: 'padding-right',
  paddingBottom: 'padding-bottom',
  paddingLeft: 'padding-left',
  marginTop: 'margin-top',
  marginRight: 'margin-right',
  marginBottom: 'margin-bottom',
  marginLeft: 'margin-left',
  width: 'width',
  height: 'height',
  minWidth: 'min-width',
  maxWidth: 'max-width',
  minHeight: 'min-height',
  maxHeight: 'max-height',
  display: 'display',
  position: 'position',
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
  flexDirection: 'flex-direction',
  flexWrap: 'flex-wrap',
  justifyContent: 'justify-content',
  alignItems: 'align-items',
  gapX: 'column-gap',
  gapY: 'row-gap',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  fontStyle: 'font-style',
  lineHeight: 'line-height',
  textAlign: 'text-align',
  textColor: 'color',
  textTransform: 'text-transform',
  backgroundColor: 'background-color',
  borderWidth: 'border-top-width',
  borderStyle: 'border-top-style',
  borderColor: 'border-top-color',
  borderRadius: 'border-top-left-radius',
  boxShadow: 'box-shadow',
  opacity: 'opacity',
  visibility: 'visibility',
};

/**
 * Shorthands that set a longhand, so `padding: 16px` is the source of `padding-top`. Browsers give
 * an empty longhand when its shorthand holds `var()`, so the Bridge reads the shorthand then.
 */
export const CSS_SHORTHANDS_OF: Readonly<Record<string, readonly string[]>> = {
  'padding-top': ['padding', 'padding-block', 'padding-block-start'],
  'padding-bottom': ['padding', 'padding-block', 'padding-block-end'],
  'padding-left': ['padding', 'padding-inline', 'padding-inline-start'],
  'padding-right': ['padding', 'padding-inline', 'padding-inline-end'],
  'margin-top': ['margin', 'margin-block', 'margin-block-start'],
  'margin-bottom': ['margin', 'margin-block', 'margin-block-end'],
  'margin-left': ['margin', 'margin-inline', 'margin-inline-start'],
  'margin-right': ['margin', 'margin-inline', 'margin-inline-end'],
  'border-top-width': ['border', 'border-width', 'border-top'],
  'border-top-style': ['border', 'border-style', 'border-top'],
  'border-top-color': ['border', 'border-color', 'border-top'],
  'border-top-left-radius': ['border-radius'],
  'background-color': ['background'],
  'font-family': ['font'],
  'font-size': ['font'],
  'font-weight': ['font'],
  'font-style': ['font'],
  'line-height': ['font'],
  'column-gap': ['gap'],
  'row-gap': ['gap'],
  'flex-direction': ['flex-flow'],
  'flex-wrap': ['flex-flow'],
  top: ['inset'],
  right: ['inset'],
  bottom: ['inset'],
  left: ['inset'],
};

/** Splits a selector list on its top-level commas (not those inside `:is(a, b)` or `[x="a,b"]`). */
export function splitSelectorList(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(list.slice(start).trim());
  return parts.filter((p) => p !== '');
}

// ---- Bridge protocol (SPEC-03 section 7) ---------------------------------------------------------

/** Where a CSS rule lives in the page: a Vite module (`data-vite-dev-id`), a `<link>`, or a bare `<style>`. */
export const StyleSheetRefSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('module'), id: z.string().min(1).max(2048) }),
  z.strictObject({ kind: z.literal('link'), href: z.string().max(2048) }),
  z.strictObject({ kind: z.literal('inline') }),
]);
export type StyleSheetRef = z.infer<typeof StyleSheetRefSchema>;

export const StyleDeclarationSchema = z.strictObject({
  property: z.string().min(1).max(100), // CSS longhand
  value: z.string().max(2000),
  important: z.boolean(),
});
export type StyleDeclaration = z.infer<typeof StyleDeclarationSchema>;

export const MatchedRuleSchema = z.strictObject({
  sheet: StyleSheetRefSchema,
  selector: z.string().min(1).max(4000), // the rule's whole selector list, as the browser has it
  media: z.array(z.string().max(1000)).max(10), // enclosing @media conditions, outermost first
  /** How many earlier rules of the same sheet have this selector and media (0 for the first). */
  occurrence: z.number().int().min(0),
  /** Order (0-based) of this rule among all CSSStyleRules in its sheet (R-ST-08). */
  ruleIndex: z.number().int().min(0),
  declarations: z.array(StyleDeclarationSchema).max(200), // only the probed longhands
  affects: z.number().int().min(0), // elements of the page the selector matches (R-ST-05)
});
export type MatchedRule = z.infer<typeof MatchedRuleSchema>;

/** A CSS value: one value, never a way to close the declaration or the rule. */
export const CssValueSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((v) => !/[;{}]/.test(v) && !v.includes('/*'), { message: 'invalidValue' });

// Studio -> Bridge: style-probe (R-ST-04)
export const StudioStyleProbePayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  properties: z.array(z.string().min(1).max(100)).max(120), // CSS longhands
  state: StyleStateSchema.optional(),
});
export type StudioStyleProbePayload = z.infer<typeof StudioStyleProbePayloadSchema>;

// Studio -> Bridge: style-preview and style-preview-clear (R-ST-13)
export const StudioStylePreviewPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  property: z.string().min(1).max(100), // CSS longhand
  value: CssValueSchema,
});
export type StudioStylePreviewPayload = z.infer<typeof StudioStylePreviewPayloadSchema>;

export const StudioStylePreviewClearPayloadSchema = z.strictObject({});
export type StudioStylePreviewClearPayload = z.infer<typeof StudioStylePreviewClearPayloadSchema>;

// Bridge -> Studio: style-probe-result, rules in cascade order, winner first (R-ST-04)
export const BridgeStyleProbePayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  found: z.boolean(),
  rules: z.array(MatchedRuleSchema).max(100),
  inline: z.array(StyleDeclarationSchema).max(200), // the element's `style` attribute
  computed: z.record(z.string(), z.string().max(2000)),
});
export type BridgeStyleProbePayload = z.infer<typeof BridgeStyleProbePayloadSchema>;

// ---- REST: POST /style/read ----------------------------------------------------------------------

export const StyleValueSchema = z.strictObject({
  css: z.string().max(2000),
  token: z.string().max(100).optional(),
});
export type StyleValue = z.infer<typeof StyleValueSchema>;

export const StyleSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('class'),
    system: StyleSystemIdSchema,
    className: z.string().max(200),
  }),
  z.strictObject({
    kind: z.literal('rule'),
    system: StyleSystemIdSchema,
    file: RelPathSchema,
    line: z.number().int().min(1),
    selector: z.string().max(4000),
    media: z.string().max(1000).optional(),
    affects: z.number().int().min(0),
  }),
  z.strictObject({ kind: z.literal('inline') }),
  z.strictObject({ kind: z.literal('external'), href: z.string().max(2048) }),
  z.strictObject({ kind: z.literal('inherited') }),
]);
export type StyleSource = z.infer<typeof StyleSourceSchema>;

export const StylePropertySchema = z.strictObject({
  id: z.string().min(1).max(60),
  value: StyleValueSchema.optional(),
  source: StyleSourceSchema.optional(),
  editable: z.boolean(),
  reason: z.enum(['expression', 'external', 'noAdapter', 'inlineDynamic', 'notFound']).optional(),
});
export type StyleProperty = z.infer<typeof StylePropertySchema>;

export const StyleReadingSchema = z.strictObject({
  primary: StyleSystemIdSchema.optional(), // absent: no adapter for the project's styling yet
  properties: z.array(StylePropertySchema).max(120),
});
export type StyleReading = z.infer<typeof StyleReadingSchema>;

export const StyleReadRequestSchema = z.strictObject({
  probe: BridgeStyleProbePayloadSchema,
});
export type StyleReadRequest = z.infer<typeof StyleReadRequestSchema>;

// ---- REST: POST /style/apply (R-ST-06 to R-ST-09, R-ST-15) ---------------------------------------

export const StyleChangeSchema = z.strictObject({
  property: z.string().min(1).max(60), // a key of CSS_LONGHAND_OF
  value: CssValueSchema.optional(), // absent: remove the declaration
  target: z.enum(['rule', 'element']),
  /** `@media` condition of the frame being edited, absent on the base frame (R-ST-09). */
  media: z.string().min(1).max(200).optional(),
  state: StyleStateSchema.optional(),
});
export type StyleChange = z.infer<typeof StyleChangeSchema>;

export const StyleApplyRequestSchema = z.strictObject({
  probe: BridgeStyleProbePayloadSchema,
  tag: z.string().min(1).max(100),
  change: StyleChangeSchema,
});
export type StyleApplyRequest = z.infer<typeof StyleApplyRequestSchema>;

export const StyleApplyResultSchema = z.strictObject({
  files: z.array(RelPathSchema).max(3),
  /** The class made for the element when the change went to `target: 'element'`. */
  className: z.string().max(200).optional(),
});
export type StyleApplyResult = z.infer<typeof StyleApplyResultSchema>;

/**
 * R-ST-09: the `@media` condition a CSS edit in a frame of breakpoint `bp` writes, the same bands
 * as Tailwind variants (`max-sm:` is under 640px in desktop-first, `md:` from 768px in
 * mobile-first). The base breakpoint writes no `@media`.
 */
export function mediaForBreakpoint(
  bp: Breakpoint,
  mode: ResponsiveMode,
  widths: Readonly<Record<ResponsiveKey, number>> = BREAKPOINT_WIDTHS,
): string | undefined {
  if (bp === 'base') return undefined;
  return mode === 'desktop-first'
    ? `(max-width: ${String(widths[bp] - 1)}px)`
    : `(min-width: ${String(widths[bp])}px)`;
}

/** R-ST-03: the system new declarations go to, from what the project uses. */
export function primarySystem(styling: StylingReport | undefined): StyleSystemId | undefined {
  const ids = new Set(styling?.systems.map((s) => s.id) ?? []);
  if (ids.has('tailwind')) {
    const version = styling?.systems.find((s) => s.id === 'tailwind')?.version ?? '4';
    return version.startsWith('3') ? 'tailwind3' : 'tailwind4';
  }
  if (ids.has('bootstrap')) return 'bootstrap5';
  if (ids.has('cssModules')) return 'cssModules';
  if (ids.has('sass')) return 'sass';
  if (ids.has('less')) return 'less';
  if (ids.has('css')) return 'css';
  return undefined;
}
