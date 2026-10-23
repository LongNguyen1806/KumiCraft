// MCP tools that change the element structure, pages, theme and history (R-AG-19, round 7b). Edits
// go through the same API as the Studio, so each is one history step the Studio can undo.
import { AddPageSchema, ThemeEditSchema } from '@reactcraft/shared';
import { z } from 'zod';

import type { ApiClient, ApiResult } from './api-client.ts';
import {
  applyEdit,
  insertTarget,
  LocSchema,
  readGuards,
  type Target,
  TargetSchema,
} from './mcp-element.ts';
import type { McpTool } from './mcp-tools.ts';

const LocsSchema = z.array(LocSchema).min(1).max(50);

const InsertJsxInput = z.strictObject({
  target: TargetSchema,
  jsx: z
    .string()
    .min(1)
    .max(200_000)
    .describe('One or more JSX elements, e.g. <section className="p-8"><h2>Title</h2></section>'),
});

const InsertImageInput = z.strictObject({
  target: TargetSchema,
  src: z
    .string()
    .min(2)
    .max(512)
    .startsWith('/')
    .describe('Path of an image in public/, e.g. /hero.png'),
  alt: z.string().trim().min(1).max(200),
  className: z.string().max(500).default(''),
});

const MoveInput = z.strictObject({ locs: LocsSchema, target: TargetSchema });
const LocsInput = z.strictObject({ locs: LocsSchema });
const WrapInput = z.strictObject({ locs: LocsSchema, wrapper: z.enum(['row', 'column', 'grid']) });
const UnwrapInput = z.strictObject({ loc: LocSchema });
const NoInput = z.strictObject({});

async function withTarget(
  api: ApiClient,
  target: Target,
  build: (resolved: unknown) => unknown,
): Promise<ApiResult> {
  const resolved = await insertTarget(api, target);
  if (!resolved.ok) return resolved;
  return applyEdit(api, build(resolved.value));
}

async function onElements(
  api: ApiClient,
  locs: readonly string[],
  build: (elements: { loc: string; tag: string }[]) => unknown,
): Promise<ApiResult> {
  const guards = await readGuards(api, locs);
  if (!guards.ok) return guards;
  return applyEdit(api, build(guards.value));
}

async function move(api: ApiClient, input: z.infer<typeof MoveInput>): Promise<ApiResult> {
  const guards = await readGuards(api, input.locs);
  if (!guards.ok) return guards;
  return withTarget(api, input.target, (target) => ({
    kind: 'move',
    elements: guards.value,
    target,
  }));
}

const ELEMENT_TOOLS: readonly McpTool[] = [
  {
    name: 'reactcraft_insert_jsx',
    description:
      'Insert JSX next to or inside an element and return the locs of what was inserted. ReactCraft keeps the JSX as you write it: put each element on its own line with 2-space indentation. Prefer components of the project (reactcraft_list_components) when one fits.',
    input: InsertJsxInput,
    run: (api, args) => {
      const { target, jsx } = InsertJsxInput.parse(args);
      return withTarget(api, target, (resolved) => ({ kind: 'insert', target: resolved, jsx }));
    },
  },
  {
    name: 'reactcraft_insert_image',
    description: 'Insert an <img> of an image that is in public/ (see reactcraft_list_assets).',
    input: InsertImageInput,
    run: (api, args) => {
      const { target, src, alt, className } = InsertImageInput.parse(args);
      return withTarget(api, target, (resolved) => ({
        kind: 'insertImage',
        target: resolved,
        image: { kind: 'existing', src },
        alt,
        className,
      }));
    },
  },
  {
    name: 'reactcraft_move_elements',
    description: 'Move elements next to or inside another element.',
    input: MoveInput,
    run: (api, args) => move(api, MoveInput.parse(args)),
  },
  {
    name: 'reactcraft_duplicate_elements',
    description: 'Duplicate elements; each copy goes right after its original.',
    input: LocsInput,
    run: (api, args) =>
      onElements(api, LocsInput.parse(args).locs, (elements) => ({ kind: 'duplicate', elements })),
  },
  {
    name: 'reactcraft_remove_elements',
    description: 'Remove elements (undo brings them back).',
    input: LocsInput,
    run: (api, args) =>
      onElements(api, LocsInput.parse(args).locs, (elements) => ({ kind: 'remove', elements })),
  },
  {
    name: 'reactcraft_wrap_elements',
    description: 'Wrap sibling elements in a new row, column or grid container.',
    input: WrapInput,
    run: (api, args) => {
      const { locs, wrapper } = WrapInput.parse(args);
      return onElements(api, locs, (elements) => ({ kind: 'wrap', elements, wrapper }));
    },
  },
  {
    name: 'reactcraft_unwrap_element',
    description: 'Remove a container element and keep its children in its place.',
    input: UnwrapInput,
    run: (api, args) =>
      onElements(api, [UnwrapInput.parse(args).loc], ([element]) => ({ kind: 'unwrap', element })),
  },
];

const PROJECT_TOOLS: readonly McpTool[] = [
  {
    name: 'reactcraft_create_page',
    description: 'Create a page (file and route) in the project.',
    input: AddPageSchema,
    run: (api, args) => api.post('project/pages', AddPageSchema.parse(args)),
  },
  {
    name: 'reactcraft_set_theme_token',
    description:
      'Set, add or remove one design token (color, font, fontSize, radius, shadow) when the styling system supports tokens.',
    input: ThemeEditSchema,
    run: (api, args) => api.patch('project/theme', ThemeEditSchema.parse(args)),
  },
  {
    name: 'reactcraft_undo',
    description: 'Undo the last change made in ReactCraft (by you or in the Studio).',
    input: NoInput,
    run: (api) => api.post('history/undo', {}),
  },
  {
    name: 'reactcraft_redo',
    description: 'Redo the last undone change.',
    input: NoInput,
    run: (api) => api.post('history/redo', {}),
  },
];

export const STRUCTURE_TOOLS: readonly McpTool[] = [...ELEMENT_TOOLS, ...PROJECT_TOOLS];
