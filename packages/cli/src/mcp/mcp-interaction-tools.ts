// MCP tools for K9.8-1 interactions (SelectGroup, Dark Mode, LoadingButton, Links, ScrollSpy).
import { SelectGroupModeSchema, StyleSystemIdSchema } from '@kumicraft/shared';
import { z } from 'zod';

import type { ApiClient, ApiResult } from './api-client.ts';
import { LocSchema, readElement } from './mcp-element.ts';
import type { McpTool } from './mcp-tools.ts';

async function resolveElements(
  api: ApiClient,
  locs: readonly string[],
): Promise<
  | { readonly ok: true; readonly items: readonly { loc: string; tag: string }[] }
  | { readonly ok: false; readonly err: ApiResult }
> {
  const items: { loc: string; tag: string }[] = [];
  for (const loc of locs) {
    const el = await readElement(api, loc);
    if (!el.ok) return { ok: false, err: el };
    items.push({ loc, tag: el.value.tag });
  }
  return { ok: true, items };
}

const MakeSelectGroupInput = z.strictObject({
  locs: z.array(LocSchema).min(2).max(50),
  mode: SelectGroupModeSchema.default('single'),
  styleSystem: StyleSystemIdSchema.optional(),
});

const LinkSelectContentInput = z.strictObject({
  groupLoc: LocSchema,
  itemLocs: z.array(LocSchema).min(1).max(50),
  targetLoc: LocSchema,
  defaultLabelPrefix: z.string().max(60).optional(),
});

const RemoveSelectGroupInput = z.strictObject({
  groupLoc: LocSchema,
  styleSystem: StyleSystemIdSchema.optional(),
});

const EnableDarkModeInput = z.strictObject({
  checkOnly: z.boolean().optional(),
});

const MakeLoadingButtonInput = z.strictObject({
  loc: LocSchema,
  loadingText: z.string().max(100).optional(),
});

const SetLinkTargetInput = z.strictObject({
  loc: LocSchema,
  targetKind: z.enum(['section', 'route', 'external']),
  target: z.string().min(1).max(500),
  newTab: z.boolean().optional(),
  smoothScroll: z.boolean().optional(),
  targetLoc: LocSchema.optional(),
  headerHeightPx: z.number().int().min(0).max(600).optional(),
});

const MarkActiveNavInput = z.strictObject({ loc: LocSchema });

async function runMakeSelectGroup(api: ApiClient, args: unknown): Promise<ApiResult> {
  const input = MakeSelectGroupInput.parse(args);
  const resolved = await resolveElements(api, input.locs);
  if (!resolved.ok) return resolved.err;
  return api.post('source/interaction', {
    action: 'makeSelectGroup',
    elements: resolved.items,
    mode: input.mode,
    ...(input.styleSystem !== undefined ? { styleSystem: input.styleSystem } : {}),
  });
}

async function runLinkSelectContent(api: ApiClient, args: unknown): Promise<ApiResult> {
  const input = LinkSelectContentInput.parse(args);
  const resolved = await resolveElements(api, [input.groupLoc, input.targetLoc, ...input.itemLocs]);
  if (!resolved.ok) return resolved.err;
  const [group, target, ...items] = resolved.items;
  return api.post('source/interaction', {
    action: 'linkSelectContent',
    group,
    items,
    target,
    ...(input.defaultLabelPrefix !== undefined
      ? { defaultLabelPrefix: input.defaultLabelPrefix }
      : {}),
  });
}

async function runRemoveSelectGroup(api: ApiClient, args: unknown): Promise<ApiResult> {
  const input = RemoveSelectGroupInput.parse(args);
  const grp = await readElement(api, input.groupLoc);
  if (!grp.ok) return grp;
  return api.post('source/interaction', {
    action: 'removeSelectGroup',
    group: { loc: input.groupLoc, tag: grp.value.tag },
    ...(input.styleSystem !== undefined ? { styleSystem: input.styleSystem } : {}),
  });
}

async function runMakeLoadingButton(api: ApiClient, args: unknown): Promise<ApiResult> {
  const input = MakeLoadingButtonInput.parse(args);
  const el = await readElement(api, input.loc);
  if (!el.ok) return el;
  return api.post('source/interaction', {
    action: 'makeLoadingButton',
    element: { loc: input.loc, tag: el.value.tag },
    ...(input.loadingText !== undefined ? { loadingText: input.loadingText } : {}),
  });
}

async function runSetLinkTarget(api: ApiClient, args: unknown): Promise<ApiResult> {
  const input = SetLinkTargetInput.parse(args);
  const el = await readElement(api, input.loc);
  if (!el.ok) return el;
  const res = await api.post('source/interaction', {
    action: 'setLinkTarget',
    element: { loc: input.loc, tag: el.value.tag },
    targetKind: input.targetKind,
    target: input.target,
    ...(input.newTab !== undefined ? { newTab: input.newTab } : {}),
  });
  if (!res.ok) return res;
  if (input.targetKind === 'section' && input.smoothScroll === true) {
    const smoothRes = await api.post('project/smooth-scroll', {
      enabled: true,
      ...(input.targetLoc !== undefined ? { targetLoc: input.targetLoc } : {}),
      ...(input.headerHeightPx !== undefined ? { headerHeightPx: input.headerHeightPx } : {}),
    });
    if (!smoothRes.ok) return smoothRes;
  }
  return res;
}

async function runMarkActiveNav(api: ApiClient, args: unknown): Promise<ApiResult> {
  const input = MarkActiveNavInput.parse(args);
  const el = await readElement(api, input.loc);
  if (!el.ok) return el;
  return api.post('source/interaction', {
    action: 'markActiveNav',
    element: { loc: input.loc, tag: el.value.tag },
  });
}

export const INTERACTION_TOOLS: readonly McpTool[] = [
  {
    name: 'kumicraft_make_select_group',
    description: 'Wrap sibling elements into an accessible SelectGroup + SelectItem group.',
    input: MakeSelectGroupInput,
    run: runMakeSelectGroup,
  },
  {
    name: 'kumicraft_link_select_content',
    description: 'Clone a target container into SelectPanel slots synchronized with a SelectGroup.',
    input: LinkSelectContentInput,
    run: runLinkSelectContent,
  },
  {
    name: 'kumicraft_remove_select_group',
    description: 'Unwrap a SelectGroup and restore plain elements while keeping selected styles.',
    input: RemoveSelectGroupInput,
    run: runRemoveSelectGroup,
  },
  {
    name: 'kumicraft_enable_dark_mode',
    description:
      'Check (checkOnly: true) whether Dark colors apply in the open project. Setting dark mode up is refused (E023 projectWideViaAi): the Studio hands it to the AI tab.',
    input: EnableDarkModeInput,
    run: (api, args) => api.post('project/dark-mode', EnableDarkModeInput.parse(args ?? {})),
  },
  {
    name: 'kumicraft_make_loading_button',
    description: 'Convert a <button> into a LoadingButton kit component.',
    input: MakeLoadingButtonInput,
    run: runMakeLoadingButton,
  },
  {
    name: 'kumicraft_set_link_target',
    description:
      'Configure link target (section #id, app route, or external URL) and smooth scroll.',
    input: SetLinkTargetInput,
    run: runSetLinkTarget,
  },
  {
    name: 'kumicraft_mark_active_nav',
    description: 'Wrap a navigation container with ScrollSpy to mark visible section links active.',
    input: MarkActiveNavInput,
    run: runMarkActiveNav,
  },
];
