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

export const ComponentPropSpecSchema = z.strictObject({
  name: z.string().min(1),
  kind: ComponentPropKindSchema,
  required: z.boolean(),
  options: z.array(z.string()).readonly().optional(),
  value: SetPropValueSchema.optional(),
  hasValue: z.boolean(),
  readonlyExpression: z.boolean(),
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
});
export type ComponentPropsResponse = z.infer<typeof ComponentPropsResponseSchema>;
