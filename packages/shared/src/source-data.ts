// Schemas for data-tools (TK-31..35) and typed component props (TK-49, TK-51).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';

const BLOCKED_PROP_NAMES = new Set([
  'children',
  'key',
  'ref',
  'dangerouslySetInnerHTML',
  'className',
  'style',
]);
const PROP_IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Returns true iff `name` is a safe React component prop identifier for static `setProp`. */
export function isValidSettablePropName(name: string): boolean {
  if (!PROP_IDENT_RE.test(name)) return false;
  if (BLOCKED_PROP_NAMES.has(name) || name.startsWith('on')) return false;
  return true;
}

export const SetPropValueSchema = z.union([z.string().max(10_000), z.number(), z.boolean()]);
export type SetPropValue = z.infer<typeof SetPropValueSchema>;

export const SetPropEditSchema = z.strictObject({
  kind: z.literal('setProp'),
  loc: z.string().min(1),
  tag: z.string().min(1),
  name: z.string().min(1).max(64).refine(isValidSettablePropName, {
    message: 'Prop name is blocked or invalid',
  }),
  value: SetPropValueSchema.optional(),
  required: z.boolean().optional(),
  /** The user chose a fixed value over the code (`image={item.img}` → `image="/a.png"`). */
  replaceExpression: z.literal(true).optional(),
});
export type SetPropEdit = z.infer<typeof SetPropEditSchema>;

export const DataPrimitiveValueSchema = z.union([z.string().max(5000), z.number(), z.boolean()]);
export type DataPrimitiveValue = z.infer<typeof DataPrimitiveValueSchema>;

export const DataArrayRowSchema = z.record(
  z.string().regex(PROP_IDENT_RE).max(64),
  DataPrimitiveValueSchema,
);
export type DataArrayRow = z.infer<typeof DataArrayRowSchema>;

export const SetDataArrayEditSchema = z.strictObject({
  kind: z.literal('setDataArray'),
  file: RelPathSchema,
  exportName: z.string().regex(PROP_IDENT_RE).max(64),
  rows: z.array(DataArrayRowSchema).max(500).readonly(),
});
export type SetDataArrayEdit = z.infer<typeof SetDataArrayEditSchema>;

export const ElementDataContextSchema = z.strictObject({
  file: RelPathSchema,
  exportName: z.string().min(1),
  columns: z.array(z.string()).readonly(),
  rows: z.array(DataArrayRowSchema).readonly(),
  readonlyReason: z.string().optional(),
});
export type ElementDataContext = z.infer<typeof ElementDataContextSchema>;

export const DATA_FIELD_TYPES = [
  'text',
  'email',
  'number',
  'date',
  'datetime',
  'boolean',
  'select',
  'textarea',
  'url',
  'password',
] as const;
export const DataFieldTypeSchema = z.enum(DATA_FIELD_TYPES);
export type DataFieldType = z.infer<typeof DataFieldTypeSchema>;

export const DataFieldSchema = z.strictObject({
  name: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  type: DataFieldTypeSchema,
  required: z.boolean(),
  options: z.array(z.string().max(200)).max(100).readonly().optional(),
  maxLength: z.number().int().positive().max(100_000).optional(),
});
export type DataField = z.infer<typeof DataFieldSchema>;

export const DataSourceKindSchema = z.enum(['typescript', 'zod', 'django', 'openapi']);
export type DataSourceKind = z.infer<typeof DataSourceKindSchema>;

export const DataSourceItemSchema = z.strictObject({
  id: z.string().min(1),
  kind: DataSourceKindSchema,
  name: z.string().min(1),
  file: RelPathSchema,
  label: z.string().min(1),
});
export type DataSourceItem = z.infer<typeof DataSourceItemSchema>;

export const DataSourceListResponseSchema = z.strictObject({
  sources: z.array(DataSourceItemSchema).readonly(),
  yamlUnsupportedFiles: z.array(RelPathSchema).readonly().optional(),
});
export type DataSourceListResponse = z.infer<typeof DataSourceListResponseSchema>;

export const DataSourceFieldsRequestSchema = z.strictObject({
  kind: DataSourceKindSchema,
  file: RelPathSchema,
  name: z.string().min(1),
});
export type DataSourceFieldsRequest = z.infer<typeof DataSourceFieldsRequestSchema>;

export const DataSourceFieldsResponseSchema = z.strictObject({
  source: DataSourceItemSchema,
  fields: z.array(DataFieldSchema).readonly(),
});
export type DataSourceFieldsResponse = z.infer<typeof DataSourceFieldsResponseSchema>;

export const ComponentPropKindSchema = z.enum(['union', 'boolean', 'number', 'string', 'complex']);
export type ComponentPropKind = z.infer<typeof ComponentPropKindSchema>;

/**
 * What a prop does on screen, read from where the component uses it (thiet-ke-component.md §3):
 * printed as text, put in `src`, in `href`, as a show/hide condition, as a style lookup…
 */
export const ComponentPropRoleSchema = z.enum([
  'content',
  'image',
  'link',
  'toggle',
  'style',
  'state',
  'behavior',
  'data',
  'advanced',
]);
export type ComponentPropRole = z.infer<typeof ComponentPropRoleSchema>;

export const ComponentPropSpecSchema = z.strictObject({
  name: z.string().min(1),
  kind: ComponentPropKindSchema,
  required: z.boolean(),
  options: z.array(z.string()).readonly().optional(),
  value: SetPropValueSchema.optional(),
  hasValue: z.boolean(),
  readonlyExpression: z.boolean(),
  role: ComponentPropRoleSchema.optional(),
  /** The default the definition gives (`featured = false`), shown when the use sets nothing. */
  defaultValue: SetPropValueSchema.optional(),
  /** The code of a value that is not a constant (`{item.image}`), shown as "from the code". */
  expression: z.string().max(200).optional(),
  /**
   * The component never reads this prop (`image` named but not shown): the page sets it, but a
   * change shows nothing, so the Inspector offers no control for it (owner, 2026-11-18).
   */
  unused: z.literal(true).optional(),
});
export type ComponentPropSpec = z.infer<typeof ComponentPropSpecSchema>;

export const ComponentPropsRequestSchema = z.strictObject({
  loc: z.string().min(1),
  tag: z.string().min(1),
  parentLoc: z.string().min(1).optional(),
  componentName: z.string().min(1).optional(),
});
export type ComponentPropsRequest = z.infer<typeof ComponentPropsRequestSchema>;

export const ComponentPropsResponseSchema = z.strictObject({
  loc: z.string().min(1).optional(),
  tag: z.string().min(1),
  sourceKind: z.enum(['typescript', 'propTypes', 'attributes', 'unknown']),
  props: z.array(ComponentPropSpecSchema).readonly(),
  /** The project file that defines the component, when it is one of the project's. */
  componentFile: RelPathSchema.optional(),
  /** The package the component comes from (`@mui/material`): its inside cannot be edited. */
  packageName: z.string().min(1).max(214).optional(),
});
export type ComponentPropsResponse = z.infer<typeof ComponentPropsResponseSchema>;
