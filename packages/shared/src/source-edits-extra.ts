// Tag change, extended attributes, inline wrapText, and replaceSvg schemas (K9.7-2 TK-1, TK-3, TK-4, TK-6).
import { z } from 'zod';

export const EDITABLE_ATTRS = ['href', 'src', 'alt', 'placeholder', 'type'] as const;

export const HTML_SETTABLE_TAGS = [
  'div',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'main',
  'nav',
  'ul',
  'ol',
  'li',
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'a',
  'button',
  'label',
  'figure',
  'figcaption',
  'blockquote',
] as const;
export type HtmlSettableTag = (typeof HTML_SETTABLE_TAGS)[number];
export const HtmlSettableTagSchema = z.enum(HTML_SETTABLE_TAGS);

export const VOID_HTML_TAGS: ReadonlySet<string> = new Set([
  'img',
  'input',
  'br',
  'hr',
  'meta',
  'link',
  'area',
  'base',
  'col',
  'embed',
  'param',
  'source',
  'track',
  'wbr',
]);

export const EXTENDED_EDITABLE_ATTRS = [
  ...EDITABLE_ATTRS,
  'id',
  'title',
  'target',
  'rel',
  'role',
  'tabIndex',
] as const;

const EXTENDED_ATTR_SET = new Set<string>(EXTENDED_EDITABLE_ATTRS);
const PREFIXED_ATTR_RE = /^(aria|data)-[a-z][a-z0-9-]{0,40}$/;
const BLOCKED_ATTRS = new Set([
  'style',
  'className',
  'class',
  'key',
  'ref',
  'dangerouslySetInnerHTML',
]);

/** Returns true iff an attribute name is allowed for static editing (TK-4). */
export function isValidSettableAttrName(name: string): boolean {
  if (name === '' || name.startsWith('on') || name.startsWith('data-rc-')) return false;
  if (BLOCKED_ATTRS.has(name)) return false;
  if (EXTENDED_ATTR_SET.has(name)) return true;
  return PREFIXED_ATTR_RE.test(name);
}

export const EditableAttrSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidSettableAttrName, { message: 'Attribute name is blocked or unsupported' });
export type EditableAttr = z.infer<typeof EditableAttrSchema>;

export const SetTagEditSchema = z.strictObject({
  kind: z.literal('setTag'),
  loc: z.string().min(1),
  tag: z.string().min(1),
  after: HtmlSettableTagSchema,
});
export type SetTagEdit = z.infer<typeof SetTagEditSchema>;

const InsertedCssValueSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((v) => !/[;{}]/.test(v) && !v.includes('/*'), { message: 'invalidValue' });

export const InsertedCssRuleSchema = z.strictObject({
  selector: z.string().regex(/^\.kc-[a-z0-9-]+$/),
  declarations: z.record(z.string().min(1).max(100), InsertedCssValueSchema),
});
export type InsertedCssRule = z.infer<typeof InsertedCssRuleSchema>;

export const InsertedCssSchema = z.strictObject({
  rules: z.array(InsertedCssRuleSchema).max(100).readonly(),
});
export type InsertedCss = z.infer<typeof InsertedCssSchema>;

export const WrapTextEditSchema = z.strictObject({
  kind: z.literal('wrapText'),
  loc: z.string().min(1),
  tag: z.string().min(1),
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  wrapper: z.strictObject({
    tag: z.enum(['span', 'strong', 'em']),
    className: z.string().max(1000).optional(),
  }),
  css: InsertedCssSchema.optional(),
});
export type WrapTextEdit = z.infer<typeof WrapTextEditSchema>;

export const SVG_ALLOWED_TAGS = [
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'g',
] as const;
export type SvgAllowedTag = (typeof SVG_ALLOWED_TAGS)[number];
export const SvgAllowedTagSchema = z.enum(SVG_ALLOWED_TAGS);

/**
 * SVG attribute names written verbatim into JSX: letters, digits and dashes only (no quotes,
 * braces or spaces that could break out into code), and never an event handler, `style`, a
 * link (`href`, `xlink:href`) or React internals.
 */
const SVG_ATTR_NAME_RE = /^[a-zA-Z][a-zA-Z0-9-]{0,39}$/;
const SVG_BLOCKED_ATTRS = new Set(['style', 'href', 'dangerouslysetinnerhtml', 'ref']);
export function isSafeSvgAttrName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    SVG_ATTR_NAME_RE.test(name) &&
    !lower.startsWith('on') &&
    !lower.startsWith('xlink') &&
    !SVG_BLOCKED_ATTRS.has(lower)
  );
}

export const SvgNodeItemSchema = z.tuple([
  SvgAllowedTagSchema,
  z.record(
    z.string().min(1).max(40).refine(isSafeSvgAttrName, { message: 'blockedAttribute' }),
    z.union([z.string().max(4000), z.number()]),
  ),
]);
export type SvgNodeItem = z.infer<typeof SvgNodeItemSchema>;

export const ReplaceSvgEditSchema = z.strictObject({
  kind: z.literal('replaceSvg'),
  loc: z.string().min(1),
  tag: z.literal('svg'),
  icon: z.strictObject({
    name: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
    node: z.array(SvgNodeItemSchema).min(1).max(200),
  }),
});
export type ReplaceSvgEdit = z.infer<typeof ReplaceSvgEditSchema>;

export const RevealEffectSchema = z.enum(['fade', 'slide-up', 'zoom']);
export type RevealEffect = z.infer<typeof RevealEffectSchema>;

export const RevealRequestSchema = z.strictObject({
  action: z.enum(['wrap', 'unwrap']),
  loc: z.string().min(1),
  tag: z.string().min(1),
  effect: RevealEffectSchema.optional(),
  delay: z.number().min(0).max(5000).optional(),
  stagger: z.number().min(0).max(2000).optional(),
});
export type RevealRequest = z.infer<typeof RevealRequestSchema>;

export const RevealResultSchema = z.strictObject({
  files: z.array(z.string()),
  revealFile: z.string(),
  created: z.boolean(),
  wrapped: z.boolean(),
});
export type RevealResult = z.infer<typeof RevealResultSchema>;
