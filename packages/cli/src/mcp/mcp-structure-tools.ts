// MCP tools that change the element structure, pages, theme and history (R-AG-19, round 7b). Edits
// go through the same API as the Studio, so each is one history step the Studio can undo.
import {
  LIBRARY_BLOCKS,
  LIBRARY_STYLES,
  type LibraryStyle,
  lookFromTheme,
  renderBlock,
} from '@kumicraft/content';
import {
  AddPageSchema,
  primarySystem,
  StylingReportSchema,
  ThemeEditSchema,
  ThemeInfoSchema,
  UiKitReportSchema,
} from '@kumicraft/shared';
import { z } from 'zod';

import type { ApiClient, ApiResult } from './api-client.ts';
import {
  applyEdit,
  cannot,
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

const InsertBlockInput = z.strictObject({
  blockId: z
    .string()
    .min(1)
    .max(100)
    .describe(
      `Library block id, e.g. form.button, composite.card, content.list, content.placeholder-image`,
    ),
  variantId: z.string().min(1).max(80).optional(),
  style: z.enum(LIBRARY_STYLES).optional(),
  lang: z.enum(['vi', 'en']).default('en'),
  target: TargetSchema,
});

const ProjectSupportWrapSchema = z.object({
  support: z
    .object({
      styling: StylingReportSchema.optional(),
      uiKit: UiKitReportSchema.optional(),
    })
    .optional(),
});

async function insertLibraryBlock(
  api: ApiClient,
  input: z.infer<typeof InsertBlockInput>,
): Promise<ApiResult> {
  const block = LIBRARY_BLOCKS.find((b) => b.id === input.blockId);
  if (block === undefined) {
    return cannot(`E016: Unknown library block "${input.blockId}".`);
  }
  if (
    input.variantId !== undefined &&
    !(block.variants ?? []).some((v) => v.id === input.variantId)
  ) {
    return cannot(`E016: Unknown variant "${input.variantId}" for block "${input.blockId}".`);
  }
  const [projectRes, themeRes, resolved] = await Promise.all([
    api.get('project'),
    api.get('project/theme'),
    insertTarget(api, input.target),
  ]);
  if (!resolved.ok) return resolved;

  const projectParsed = projectRes.ok
    ? ProjectSupportWrapSchema.safeParse(projectRes.data)
    : undefined;
  const support = projectParsed?.success ? projectParsed.data.support : undefined;
  const themeParsed = themeRes.ok ? ThemeInfoSchema.safeParse(themeRes.data) : undefined;
  const stylePreset: LibraryStyle = input.style ?? 'default';
  const look = lookFromTheme(themeParsed?.success ? themeParsed.data : undefined, stylePreset);
  const rendered = renderBlock(
    block,
    primarySystem(support?.styling),
    input.lang,
    look,
    input.variantId,
    support?.uiKit,
  );
  const rules = rendered.rules.map((r) => ({ selector: r.selector, declarations: r.declarations }));
  const locFile = input.target.loc.split(':')[0] ?? 'src/App.tsx';
  const imports = rendered.imports ?? [];
  return applyEdit(api, {
    kind: 'insert',
    target: resolved.value,
    jsx: rendered.jsx,
    ...(rules.length > 0 ? { css: { rules } } : {}),
    ...(imports.length > 0 ? { from: { file: locFile, imports } } : {}),
    ...(rendered.kit !== undefined ? { kit: rendered.kit } : {}),
  });
}

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
    name: 'kumicraft_insert_jsx',
    description:
      'Insert JSX next to or inside an element and return the locs of what was inserted. KumiCraft keeps the JSX as you write it: put each element on its own line with 2-space indentation. Prefer components of the project (kumicraft_list_components) when one fits.',
    input: InsertJsxInput,
    run: (api, args) => {
      const { target, jsx } = InsertJsxInput.parse(args);
      return withTarget(api, target, (resolved) => ({ kind: 'insert', target: resolved, jsx }));
    },
  },
  {
    name: 'kumicraft_insert_block',
    description:
      'Insert a KumiCraft Library starter block by blockId (e.g. form.button, composite.card, content.list) styled with the project theme, styling system, and UI kit.',
    input: InsertBlockInput,
    run: (api, args) => insertLibraryBlock(api, InsertBlockInput.parse(args)),
  },
  {
    name: 'kumicraft_insert_image',
    description: 'Insert an <img> of an image that is in public/ (see kumicraft_list_assets).',
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
    name: 'kumicraft_move_elements',
    description: 'Move elements next to or inside another element.',
    input: MoveInput,
    run: (api, args) => move(api, MoveInput.parse(args)),
  },
  {
    name: 'kumicraft_duplicate_elements',
    description: 'Duplicate elements; each copy goes right after its original.',
    input: LocsInput,
    run: (api, args) =>
      onElements(api, LocsInput.parse(args).locs, (elements) => ({ kind: 'duplicate', elements })),
  },
  {
    name: 'kumicraft_remove_elements',
    description: 'Remove elements (undo brings them back).',
    input: LocsInput,
    run: (api, args) =>
      onElements(api, LocsInput.parse(args).locs, (elements) => ({ kind: 'remove', elements })),
  },
  {
    name: 'kumicraft_wrap_elements',
    description: 'Wrap sibling elements in a new row, column or grid container.',
    input: WrapInput,
    run: (api, args) => {
      const { locs, wrapper } = WrapInput.parse(args);
      return onElements(api, locs, (elements) => ({ kind: 'wrap', elements, wrapper }));
    },
  },
  {
    name: 'kumicraft_unwrap_element',
    description: 'Remove a container element and keep its children in its place.',
    input: UnwrapInput,
    run: (api, args) =>
      onElements(api, [UnwrapInput.parse(args).loc], ([element]) => ({ kind: 'unwrap', element })),
  },
];

const PROJECT_TOOLS: readonly McpTool[] = [
  {
    name: 'kumicraft_create_page',
    description: 'Create a page (file and route) in the project.',
    input: AddPageSchema,
    run: (api, args) => api.post('project/pages', AddPageSchema.parse(args)),
  },
  {
    name: 'kumicraft_set_theme_token',
    description:
      'Set, add or remove one design token (color, font, fontSize, radius, shadow) when the styling system supports tokens.',
    input: ThemeEditSchema,
    run: (api, args) => api.patch('project/theme', ThemeEditSchema.parse(args)),
  },
  {
    name: 'kumicraft_undo',
    description: 'Undo the last change made in KumiCraft (by you or in the Studio).',
    input: NoInput,
    run: (api) => api.post('history/undo', {}),
  },
  {
    name: 'kumicraft_redo',
    description: 'Redo the last undone change.',
    input: NoInput,
    run: (api) => api.post('history/redo', {}),
  },
];

export const STRUCTURE_TOOLS: readonly McpTool[] = [...ELEMENT_TOOLS, ...PROJECT_TOOLS];
