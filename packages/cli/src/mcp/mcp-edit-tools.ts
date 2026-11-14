// MCP tools that change one element's class names, text or attributes (R-AG-19, round 7b). Each
// call is one history step; the Studio shows it at once and can undo it.
import {
  EditableAttrSchema,
  HTML_SETTABLE_TAGS,
  HtmlSettableTagSchema,
  isValidSettablePropName,
  SetPropValueSchema,
  VOID_HTML_TAGS,
} from '@kumicraft/shared';
import { z } from 'zod';

import type { ApiClient, ApiResult } from './api-client.ts';
import { applyEdit, cannot, LocSchema, readElement } from './mcp-element.ts';
import type { McpTool } from './mcp-tools.ts';

const SetClassInput = z.strictObject({
  loc: LocSchema,
  className: z
    .string()
    .max(2000)
    .describe('The whole new className, e.g. "rounded bg-red-600 p-4"'),
});

const UpdateClassesInput = z.strictObject({
  loc: LocSchema,
  add: z.array(z.string().min(1).max(200)).max(50).default([]),
  remove: z.array(z.string().min(1).max(200)).max(50).default([]),
});

const SetTextInput = z.strictObject({ loc: LocSchema, text: z.string().max(10_000) });

const SetAttributeInput = z.strictObject({
  loc: LocSchema,
  name: EditableAttrSchema,
  value: z.string().max(2000).optional().describe('Leave out to remove the attribute'),
});

const SetTagInput = z.strictObject({
  loc: LocSchema,
  tag: HtmlSettableTagSchema,
});

const SetPropInput = z.strictObject({
  loc: LocSchema,
  name: z
    .string()
    .min(1)
    .max(64)
    .refine(isValidSettablePropName, { message: 'Prop name is blocked or invalid' }),
  value: SetPropValueSchema.optional().describe('Omit to remove the prop'),
  required: z.boolean().optional(),
});

const NOT_STATIC_CLASS =
  'E023: className of this element is not a plain string (an expression), so tools cannot change it.';

async function setClassName(api: ApiClient, loc: string, next: (current: string) => string) {
  const element = await readElement(api, loc);
  if (!element.ok) return element;
  const { className, tag } = element.value;
  if (className.kind !== 'static' && className.kind !== 'none') return cannot(NOT_STATIC_CLASS);
  const before = className.kind === 'static' ? className.value : undefined;
  const after = next(before ?? '');
  return applyEdit(api, {
    kind: 'setClassName',
    loc,
    tag,
    ...(before === undefined ? {} : { before }),
    after,
  });
}

function updatedClasses(
  current: string,
  add: readonly string[],
  remove: readonly string[],
): string {
  const removed = new Set(remove);
  const kept = current.split(/\s+/).filter((name) => name !== '' && !removed.has(name));
  for (const name of add) if (!kept.includes(name)) kept.push(name);
  return kept.join(' ');
}

async function setText(api: ApiClient, loc: string, text: string): Promise<ApiResult> {
  const element = await readElement(api, loc);
  if (!element.ok) return element;
  const current = element.value.text;
  if (current.kind !== 'static') {
    return cannot(
      `E023: the text of this element is not plain text (${current.kind}); change its children with the structure tools instead.`,
    );
  }
  return applyEdit(api, {
    kind: 'setText',
    loc,
    tag: element.value.tag,
    before: current.value,
    after: text,
  });
}

async function setAttribute(api: ApiClient, input: z.infer<typeof SetAttributeInput>) {
  const element = await readElement(api, input.loc);
  if (!element.ok) return element;
  const current = element.value.attributes[input.name];
  if (current?.kind === 'expression') {
    return cannot(
      `E023: ${input.name} of this element is an expression, so tools cannot change it.`,
    );
  }
  const before = current?.kind === 'static' ? current.value : undefined;
  return applyEdit(api, {
    kind: 'setAttribute',
    loc: input.loc,
    tag: element.value.tag,
    name: input.name,
    ...(before === undefined ? {} : { before }),
    ...(input.value === undefined ? {} : { after: input.value }),
  });
}

async function setTag(api: ApiClient, loc: string, nextTag: z.infer<typeof HtmlSettableTagSchema>) {
  const element = await readElement(api, loc);
  if (!element.ok) return element;
  const currentTag = element.value.tag;
  if (/^[A-Z]/.test(currentTag) || VOID_HTML_TAGS.has(currentTag)) {
    return cannot(`E023: cannot change tag of <${currentTag}>.`);
  }
  return applyEdit(api, {
    kind: 'setTag',
    loc,
    tag: currentTag,
    after: nextTag,
  });
}

async function setProp(api: ApiClient, input: z.infer<typeof SetPropInput>) {
  const element = await readElement(api, input.loc);
  if (!element.ok) return element;
  return applyEdit(api, {
    kind: 'setProp',
    loc: input.loc,
    tag: element.value.tag,
    name: input.name,
    ...(input.value === undefined ? {} : { value: input.value }),
    ...(input.required === undefined ? {} : { required: input.required }),
  });
}

export const EDIT_TOOLS: readonly McpTool[] = [
  {
    name: 'kumicraft_set_class_name',
    description:
      'Replace the whole className of one element. Works for any styling system (Tailwind classes or CSS class names).',
    input: SetClassInput,
    run: (api, args) => {
      const { loc, className } = SetClassInput.parse(args);
      return setClassName(api, loc, () => className.trim());
    },
  },
  {
    name: 'kumicraft_update_classes',
    description: 'Add and/or remove class names on one element, keeping the others.',
    input: UpdateClassesInput,
    run: (api, args) => {
      const { loc, add, remove } = UpdateClassesInput.parse(args);
      return setClassName(api, loc, (current) => updatedClasses(current, add, remove));
    },
  },
  {
    name: 'kumicraft_set_text',
    description: 'Replace the plain text inside one element (no JSX inside).',
    input: SetTextInput,
    run: (api, args) => {
      const { loc, text } = SetTextInput.parse(args);
      return setText(api, loc, text);
    },
  },
  {
    name: 'kumicraft_set_attribute',
    description:
      'Set or remove an HTML attribute (href, src, alt, placeholder, type, id, title, target, rel, role, tabIndex, aria-*, data-*).',
    input: SetAttributeInput,
    run: (api, args) => setAttribute(api, SetAttributeInput.parse(args)),
  },
  {
    name: 'kumicraft_set_tag',
    description: `Change the HTML tag of one intrinsic element while preserving attributes and children (${HTML_SETTABLE_TAGS.join(', ')}).`,
    input: SetTagInput,
    run: (api, args) => {
      const { loc, tag } = SetTagInput.parse(args);
      return setTag(api, loc, tag);
    },
  },
  {
    name: 'kumicraft_set_prop',
    description:
      'Set or remove a constant JSX component prop (string, number, or boolean). Rejects children, key, ref, on*, className, style, dangerouslySetInnerHTML, and expressions.',
    input: SetPropInput,
    run: (api, args) => setProp(api, SetPropInput.parse(args)),
  },
];
