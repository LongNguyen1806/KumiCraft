// Data binding of a node property (SPEC-03 section 6). Keys allowed per node type and catalog
// references (V-30, V-31) are checked by validateDocument.
import { z } from 'zod';

import { DataSourceIdSchema, EndpointIdSchema } from './primitives.schema.ts';

export const ValueFormatSchema = z.enum([
  'text',
  'number',
  'currency',
  'percent',
  'date',
  'datetime',
  'boolean',
  'image',
]);
export type ValueFormat = z.infer<typeof ValueFormatSchema>;

export const BindingSchema = z.strictObject({
  source: DataSourceIdSchema,
  /** Field path, for example `name` or `category.name`. */
  field: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/)
    .optional(),
  endpoint: EndpointIdSchema.optional(),
  format: ValueFormatSchema.optional(),
});
export type Binding = z.infer<typeof BindingSchema>;
