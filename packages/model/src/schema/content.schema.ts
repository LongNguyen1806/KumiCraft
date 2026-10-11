// Content of a node, one variant per node kind (SPEC-03 section 4.4). Rules local to one content
// object are checked here; rules that need the document live in validateDocument.
import { z } from 'zod';

import { ValueFormatSchema } from './binding.schema.ts';
import { InteractionActionsSchema } from './interaction.schema.ts';
import { ColorSchema, ComponentIdSchema, EndpointIdSchema, PxSchema } from './primitives.schema.ts';

const MAX_TEXT = 10_000; // V-22

/** V-99: schemes allowed for links typed by a user or proposed by the AI. */
export const LINK_HREF_PATTERN = /^(https:|http:|mailto:|tel:|\/|#)/;
/** V-24: remote images or `asset:<file name>` inside `.reactcraft/assets/` (no folders). */
export const IMAGE_SRC_PATTERN = /^(https:\/\/\S+|http:\/\/\S+|asset:[^/\\:]+)$/;

const text = z.string().max(MAX_TEXT);
const href = z.string().regex(LINK_HREF_PATTERN, { message: 'Link scheme not allowed (V-99)' });
const imageSrc = z
  .string()
  .regex(IMAGE_SRC_PATTERN, { message: 'Image source not allowed (V-24)' });
const iconName = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const fieldName = z
  .string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, { message: 'Invalid field name (V-23)' });
const isoDate = z.iso.date();

export const TextRunSchema = z.strictObject({
  text: z.string().min(1),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  link: z.strictObject({ href, newTab: z.boolean().optional() }).optional(),
  color: ColorSchema.optional(),
});
export type TextRun = z.infer<typeof TextRunSchema>;

const formatKey = (run: TextRun) =>
  JSON.stringify([
    run.bold === true,
    run.italic === true,
    run.underline === true,
    run.strike === true,
    run.code === true,
    run.link?.href,
    run.link?.newTab === true,
    run.color,
  ]);

/** V-34: `text` equals the joined runs, and neighbouring runs never share the same format. */
export function areRunsConsistent(value: { text: string; runs?: readonly TextRun[] | undefined }) {
  const { runs } = value;
  if (runs === undefined) return true;
  if (runs.map((run) => run.text).join('') !== value.text) return false;
  return runs.every((run, i) => i === 0 || formatKey(run) !== formatKey(runs[i - 1] as TextRun));
}

const runsRule = {
  message: 'text must equal the joined runs, and adjacent runs must differ in format (V-34)',
  path: ['runs'],
};

export const FieldValidationSchema = z
  .strictObject({
    minLength: z.int().min(0).max(10_000).optional(),
    maxLength: z.int().min(1).max(10_000).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    minDate: isoDate.optional(),
    maxDate: isoDate.optional(),
    format: z.enum(['email', 'phone', 'url', 'digits']).optional(),
    message: z.string().min(1).max(500).optional(),
  })
  .refine(
    (v) =>
      (v.minLength === undefined || v.maxLength === undefined || v.minLength <= v.maxLength) &&
      (v.min === undefined || v.max === undefined || v.min <= v.max) &&
      (v.minDate === undefined || v.maxDate === undefined || v.minDate <= v.maxDate),
    { message: 'Lower bounds must not exceed upper bounds (V-36)' },
  );
export type FieldValidation = z.infer<typeof FieldValidationSchema>;

export const TableColumnSchema = z.strictObject({
  id: z.string().min(1).max(64),
  header: text,
  field: z.string().min(1).optional(),
  format: ValueFormatSchema.optional(),
});
export type TableColumn = z.infer<typeof TableColumnSchema>;

export const TableRowActionSchema = z.strictObject({
  id: z.string().min(1).max(64),
  label: text,
  icon: iconName.optional(),
  tone: z.enum(['default', 'danger']),
  actions: InteractionActionsSchema,
});
export type TableRowAction = z.infer<typeof TableRowActionSchema>;

export const DataOptionsSchema = z.strictObject({
  searchable: z.boolean().optional(),
  searchPlaceholder: text.optional(),
  pageSize: z.int().min(5).max(100).optional(),
  sortableColumns: z.array(z.string().min(1)).optional(),
});
export type DataOptions = z.infer<typeof DataOptionsSchema>;

const optionList = z.array(z.strictObject({ value: z.string(), label: text }));
const stateTexts = {
  loadingText: text.optional(),
  errorText: text.optional(),
};

const INPUT_TYPES = [
  'text',
  'email',
  'password',
  'number',
  'date',
  'datetime-local',
  'tel',
  'url',
] as const;

const InputContentSchema = z
  .strictObject({
    kind: z.literal('input'),
    label: text,
    placeholder: text.optional(),
    inputType: z.enum(INPUT_TYPES),
    fieldName,
    required: z.boolean().optional(),
    validation: FieldValidationSchema.optional(),
  })
  .refine(
    (c) =>
      ((c.validation?.min === undefined && c.validation?.max === undefined) ||
        c.inputType === 'number') &&
      ((c.validation?.minDate === undefined && c.validation?.maxDate === undefined) ||
        c.inputType === 'date'),
    {
      message: 'min/max need inputType number, minDate/maxDate need inputType date (V-36)',
      path: ['validation'],
    },
  );

const TextareaValidationSchema = FieldValidationSchema.refine(
  (v) =>
    v.min === undefined &&
    v.max === undefined &&
    v.minDate === undefined &&
    v.maxDate === undefined,
  { message: 'Textarea accepts length and format rules only (V-36)' },
);

export const ContentPropsSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      kind: z.literal('text'),
      text,
      runs: z.array(TextRunSchema).min(1).optional(),
      as: z.enum(['p', 'span']).optional(),
    })
    .refine(areRunsConsistent, runsRule),
  z
    .strictObject({
      kind: z.literal('heading'),
      text,
      runs: z.array(TextRunSchema).min(1).optional(),
      level: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
      ]),
    })
    .refine(areRunsConsistent, runsRule),
  z.strictObject({
    kind: z.literal('image'),
    src: imageSrc,
    alt: text,
    fit: z.enum(['cover', 'contain']).optional(),
  }),
  z.strictObject({ kind: z.literal('icon'), name: iconName, size: PxSchema }),
  // Empty href: the link navigates through a click interaction instead (V-95).
  z.strictObject({
    kind: z.literal('link'),
    text,
    href: z.union([z.literal(''), href]),
    newTab: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('button'),
    text,
    variant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'danger']),
    buttonType: z.enum(['button', 'submit']).optional(),
    iconLeft: iconName.optional(),
    iconRight: iconName.optional(),
  }),
  InputContentSchema,
  z.strictObject({
    kind: z.literal('textarea'),
    label: text,
    placeholder: text.optional(),
    fieldName,
    rows: z.int().min(1).max(50).optional(),
    required: z.boolean().optional(),
    validation: TextareaValidationSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal('select'),
    label: text,
    fieldName,
    options: optionList,
    required: z.boolean().optional(),
    optionsFrom: z
      .strictObject({
        endpoint: EndpointIdSchema,
        valueField: z.string().min(1),
        labelField: z.string().min(1),
      })
      .optional(),
  }),
  z.strictObject({
    kind: z.literal('choice'),
    label: text,
    fieldName,
    options: optionList.optional(),
  }),
  z.strictObject({
    kind: z.literal('table'),
    columns: z.array(TableColumnSchema).min(1),
    emptyText: text,
    rowActions: z.array(TableRowActionSchema).optional(),
    rowClick: InteractionActionsSchema.optional(),
    dataOptions: DataOptionsSchema.optional(),
    ...stateTexts,
  }),
  z.strictObject({
    kind: z.literal('list'),
    emptyText: text,
    dataOptions: DataOptionsSchema.optional(),
    ...stateTexts,
  }),
  z.strictObject({ kind: z.literal('detail'), ...stateTexts, notFoundText: text.optional() }),
  z.strictObject({
    kind: z.literal('section'),
    as: z.enum(['section', 'header', 'main', 'aside', 'article']).optional(),
  }),
  z.strictObject({
    kind: z.literal('container'),
    maxWidth: z.enum(['sm', 'md', 'lg', 'xl', '2xl', 'full']),
  }),
  z.strictObject({ kind: z.literal('modal'), title: text, openByDefault: z.boolean().optional() }),
  z.strictObject({
    kind: z.literal('tabs'),
    items: z
      .array(z.strictObject({ id: z.string().regex(/^[a-z0-9-]{1,32}$/), label: text }))
      .min(1)
      .max(12),
  }),
  z.strictObject({
    kind: z.literal('instance'),
    componentId: ComponentIdSchema,
    propValues: z.record(z.string(), z.string()),
  }),
  z.strictObject({ kind: z.literal('slot'), name: z.string().regex(/^[a-z][A-Za-z0-9]{0,31}$/) }),
  z.strictObject({ kind: z.literal('none') }),
]);
export type ContentProps = z.infer<typeof ContentPropsSchema>;
export type ContentKind = ContentProps['kind'];
