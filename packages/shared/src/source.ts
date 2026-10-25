// Schemas and types for Source Editor (SPEC-03 section 5.5, SPEC-04 section 6).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';
import { PlacementSchema } from './tailwind/free-position.ts';

export const EDITABLE_ATTRS = ['href', 'src', 'alt', 'placeholder', 'type'] as const;
export type EditableAttr = (typeof EDITABLE_ATTRS)[number];
export const EditableAttrSchema = z.enum(EDITABLE_ATTRS);

export type SourceLoc = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
};

/**
 * V-101, V-102: Parses loc string from right to left (`${file}:${line}:${column}`).
 */
export function parseLocString(loc: string): SourceLoc | undefined {
  const lastColon = loc.lastIndexOf(':');
  if (lastColon <= 0) return undefined;
  const secondLastColon = loc.lastIndexOf(':', lastColon - 1);
  if (secondLastColon <= 0) return undefined;

  const file = loc.slice(0, secondLastColon);
  const lineStr = loc.slice(secondLastColon + 1, lastColon);
  const colStr = loc.slice(lastColon + 1);

  const line = Number(lineStr);
  const column = Number(colStr);
  if (!Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1) {
    return undefined;
  }

  return { file, line, column };
}

export const StaticOrStringSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('static'),
    value: z.string(),
  }),
  z.strictObject({
    kind: z.literal('expression'),
    code: z.string().max(200),
  }),
  z.strictObject({
    kind: z.literal('none'),
  }),
]);
export type StaticOrString = z.infer<typeof StaticOrStringSchema>;

export const ElementClassNameSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('static'), value: z.string() }),
  z.strictObject({ kind: z.literal('expression'), code: z.string().max(200) }),
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('duplicate') }),
]);
export type ElementClassName = z.infer<typeof ElementClassNameSchema>;

export const ElementSourceTextSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('static'), value: z.string() }),
  z.strictObject({ kind: z.literal('expression'), code: z.string().max(200) }),
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('mixed') }),
  z.strictObject({ kind: z.literal('selfClosing') }),
]);
export type ElementSourceText = z.infer<typeof ElementSourceTextSchema>;

export const ElementTextSchema = z.strictObject({
  jsx: z.string(),
  file: RelPathSchema,
  imports: z.array(z.string()).readonly(),
});
export type ElementText = z.infer<typeof ElementTextSchema>;

export const ElementAttributesSchema = z.strictObject({
  href: StaticOrStringSchema.optional(),
  src: StaticOrStringSchema.optional(),
  alt: StaticOrStringSchema.optional(),
  placeholder: StaticOrStringSchema.optional(),
  type: StaticOrStringSchema.optional(),
});
export type ElementAttributes = z.infer<typeof ElementAttributesSchema>;

export const ElementSourceSchema = z.strictObject({
  loc: z.string().min(1),
  tag: z.string().min(1),
  fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  readonly: z.enum(['outsideSource', 'tooLarge']).optional(),
  className: ElementClassNameSchema,
  text: ElementSourceTextSchema,
  attributes: ElementAttributesSchema,
  component: z
    .strictObject({
      name: z.string().min(1),
      usages: z.number().int().min(0),
    })
    .optional(),
  inLoop: z.boolean(),
  free: z.boolean().optional(),
});
export type ElementSource = z.infer<typeof ElementSourceSchema>;

export const SetClassNameEditSchema = z.strictObject({
  kind: z.literal('setClassName'),
  loc: z.string().min(1),
  tag: z.string().min(1),
  before: z.string().optional(),
  after: z.string(),
});
export type SetClassNameEdit = z.infer<typeof SetClassNameEditSchema>;

export const SetTextEditSchema = z.strictObject({
  kind: z.literal('setText'),
  loc: z.string().min(1),
  tag: z.string().min(1),
  before: z.string(),
  after: z.string(),
});
export type SetTextEdit = z.infer<typeof SetTextEditSchema>;

export const SetAttributeEditSchema = z.strictObject({
  kind: z.literal('setAttribute'),
  loc: z.string().min(1),
  tag: z.string().min(1),
  name: EditableAttrSchema,
  before: z.string().optional(),
  after: z.string().optional(),
});
export type SetAttributeEdit = z.infer<typeof SetAttributeEditSchema>;

export const SetFlagEditSchema = z.strictObject({
  kind: z.literal('setFlag'),
  loc: z.string().min(1),
  tag: z.string().min(1),
  name: z.literal('data-rc-free'),
  on: z.boolean(),
  before: z.string().optional(),
  after: z.string().optional(),
});
export type SetFlagEdit = z.infer<typeof SetFlagEditSchema>;

export const SourceEditSchema = z.discriminatedUnion('kind', [
  SetClassNameEditSchema,
  SetTextEditSchema,
  SetAttributeEditSchema,
  SetFlagEditSchema,
]);
export type SourceEdit = z.infer<typeof SourceEditSchema>;

export const ElementGuardSchema = z.strictObject({
  loc: z.string().min(1),
  tag: z.string().min(1),
});
export type ElementGuard = z.infer<typeof ElementGuardSchema>;

export const InsertTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('sibling'),
    ref: ElementGuardSchema,
    where: z.enum(['before', 'after']),
  }),
  z.strictObject({
    kind: z.literal('child'),
    parent: ElementGuardSchema,
    where: z.enum(['start', 'end']),
  }),
]);
export type InsertTarget = z.infer<typeof InsertTargetSchema>;

export const ImageSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('existing'), src: z.string().min(2).max(512).startsWith('/') }),
  z.strictObject({
    kind: z.literal('upload'),
    name: z.string().min(1).max(200),
    dataBase64: z.string().min(1).max(7_000_000),
  }),
]);
export type ImageSource = z.infer<typeof ImageSourceSchema>;

export const InsertImageEditSchema = z.strictObject({
  kind: z.literal('insertImage'),
  target: InsertTargetSchema,
  image: ImageSourceSchema,
  alt: z.string().trim().min(1).max(200),
  className: z.string().max(500),
  placement: PlacementSchema.optional(),
  tailwindMajor: z.union([z.literal(3), z.literal(4)]).optional(),
});
export type InsertImageEdit = z.infer<typeof InsertImageEditSchema>;

/** Largest JSX one insert takes: a Library block or a KumiCraft clipboard paste (S-17). */
export const INSERT_JSX_MAX_BYTES = 1024 * 1024;

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

export const InsertEditSchema = z.strictObject({
  kind: z.literal('insert'),
  target: InsertTargetSchema,
  jsx: z.string().min(1).max(INSERT_JSX_MAX_BYTES),
  from: z
    .strictObject({
      file: RelPathSchema,
      imports: z.array(z.string().max(2000)).max(50),
    })
    .optional(),
  css: z
    .strictObject({
      rules: z.array(InsertedCssRuleSchema).max(100).readonly(),
    })
    .optional(),
  placement: PlacementSchema.optional(),
  tailwindMajor: z.union([z.literal(3), z.literal(4)]).optional(),
});
export type InsertEdit = z.infer<typeof InsertEditSchema>;

export const RemoveEditSchema = z.strictObject({
  kind: z.literal('remove'),
  elements: z.array(ElementGuardSchema).min(1).max(50),
});
export type RemoveEdit = z.infer<typeof RemoveEditSchema>;

export const DuplicateEditSchema = z.strictObject({
  kind: z.literal('duplicate'),
  elements: z.array(ElementGuardSchema).min(1).max(50),
  placement: PlacementSchema.optional(),
  tailwindMajor: z.union([z.literal(3), z.literal(4)]).optional(),
});
export type DuplicateEdit = z.infer<typeof DuplicateEditSchema>;

export const MoveEditSchema = z.strictObject({
  kind: z.literal('move'),
  elements: z.array(ElementGuardSchema).min(1).max(50),
  target: InsertTargetSchema,
  placement: PlacementSchema.optional(),
  tailwindMajor: z.union([z.literal(3), z.literal(4)]).optional(),
});
export type MoveEdit = z.infer<typeof MoveEditSchema>;

export const WrapEditSchema = z.strictObject({
  kind: z.literal('wrap'),
  elements: z.array(ElementGuardSchema).min(1).max(50),
  wrapper: z.enum(['row', 'column', 'grid']),
});
export type WrapEdit = z.infer<typeof WrapEditSchema>;

export const UnwrapEditSchema = z.strictObject({
  kind: z.literal('unwrap'),
  element: ElementGuardSchema,
});
export type UnwrapEdit = z.infer<typeof UnwrapEditSchema>;

export const StructureEditSchema = z.discriminatedUnion('kind', [
  InsertEditSchema,
  InsertImageEditSchema,
  RemoveEditSchema,
  DuplicateEditSchema,
  MoveEditSchema,
  WrapEditSchema,
  UnwrapEditSchema,
]);
export type StructureEdit = z.infer<typeof StructureEditSchema>;

export const AnyEditSchema = z.discriminatedUnion('kind', [
  SetClassNameEditSchema,
  SetTextEditSchema,
  SetAttributeEditSchema,
  SetFlagEditSchema,
  InsertEditSchema,
  InsertImageEditSchema,
  RemoveEditSchema,
  DuplicateEditSchema,
  MoveEditSchema,
  WrapEditSchema,
  UnwrapEditSchema,
]);
export type AnyEdit = z.infer<typeof AnyEditSchema>;

export const EditRequestSchema = z.strictObject({
  edit: AnyEditSchema,
  coalesceKey: z.string().max(200).optional(),
});
export type EditRequest = z.infer<typeof EditRequestSchema>;

export const EditResultSchema = z.strictObject({
  changed: z.boolean(),
  historyId: z.string().optional(),
  file: RelPathSchema,
  fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  element: ElementSourceSchema,
});
export type EditResult = z.infer<typeof EditResultSchema>;

export const StructureResultSchema = z.strictObject({
  changed: z.boolean(),
  files: z.array(RelPathSchema),
  locs: z.array(z.string()),
  warnings: z.array(z.string()).optional(),
  pagePath: z.string().optional(),
  draftFile: RelPathSchema.optional(),
});
export type StructureResult = z.infer<typeof StructureResultSchema>;

export const AttributeLevelEditSchema = z.discriminatedUnion('kind', [
  SetClassNameEditSchema,
  SetAttributeEditSchema,
  SetTextEditSchema,
  SetFlagEditSchema,
]);
export type AttributeLevelEdit = z.infer<typeof AttributeLevelEditSchema>;

export const BatchEditRequestSchema = z.strictObject({
  edits: z.array(AttributeLevelEditSchema).min(1).max(50),
  coalesceKey: z.string().max(200).optional(),
});
export type BatchEditRequest = z.infer<typeof BatchEditRequestSchema>;

export const BatchEditResultSchema = z.strictObject({
  changed: z.boolean(),
  files: z.array(RelPathSchema),
});
export type BatchEditResult = z.infer<typeof BatchEditResultSchema>;
