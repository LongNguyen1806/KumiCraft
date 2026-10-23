// Tools ReactCraft offers external AI agents over MCP (R-AG-19, R-AG-20). Round 7a: reading the
// project and reporting missing tools; editing tools come in round 7b.
import { PAGE_TREE_MAX_DEPTH, ToolGapReportSchema } from '@reactcraft/shared';
import { z } from 'zod';

import type { ApiClient, ApiResult } from './api-client.ts';

export type McpTool = {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType;
  readonly run: (api: ApiClient, args: unknown) => Promise<ApiResult>;
};

const NoInput = z.strictObject({});

const TreeInput = z.strictObject({
  file: z.string().min(1).describe('Project-relative .jsx or .tsx file, e.g. src/pages/Home.tsx'),
  maxDepth: z.number().int().min(1).max(PAGE_TREE_MAX_DEPTH).optional(),
});

const ElementInput = z.strictObject({
  loc: z.string().min(1).describe('file:line:column of the element, as get_page_tree returns'),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && Boolean(value) && !Array.isArray(value);

/** What an agent needs of the project; backend paths stay out (S-111). */
function projectSummary(data: unknown): unknown {
  if (!isRecord(data)) return data;
  const support = isRecord(data['support']) ? data['support'] : {};
  const backends = Array.isArray(data['backends']) ? data['backends'] : [];
  return {
    name: data['name'],
    root: data['root'],
    trusted: data['trusted'],
    frames: data['frames'],
    designDirs: data['designDirs'],
    language: support['language'],
    styling: support['styling'],
    backends: backends.map((backend) => (isRecord(backend) ? backend['label'] : undefined)),
  };
}

async function mapped(result: Promise<ApiResult>, map: (data: unknown) => unknown) {
  const done = await result;
  return done.ok ? { ok: true as const, data: map(done.data) } : done;
}

export const MCP_TOOLS: readonly McpTool[] = [
  {
    name: 'reactcraft_get_project',
    description:
      'The open project: name, folder, design frames, page and component folders, language and styling system.',
    input: NoInput,
    run: (api) => mapped(api.get('project'), projectSummary),
  },
  {
    name: 'reactcraft_list_pages',
    description: 'Pages of the project with their routes and files.',
    input: NoInput,
    run: (api) => api.get('project/pages'),
  },
  {
    name: 'reactcraft_get_page_tree',
    description:
      'Element tree of one page or component file. Each element has a loc (file:line:column); use it with the other tools.',
    input: TreeInput,
    run: (api, args) => {
      const { file, maxDepth } = TreeInput.parse(args);
      return api.get('source/tree', {
        file,
        ...(maxDepth === undefined ? {} : { maxDepth: String(maxDepth) }),
      });
    },
  },
  {
    name: 'reactcraft_get_element',
    description: 'One element by its loc: tag, className, text, editable attributes, component.',
    input: ElementInput,
    run: (api, args) => api.get('source/element', { loc: ElementInput.parse(args).loc }),
  },
  {
    name: 'reactcraft_list_components',
    description: 'Components of the project that can be placed on a page.',
    input: NoInput,
    run: (api) => api.get('project/components'),
  },
  {
    name: 'reactcraft_list_assets',
    description: 'Images in the public folder of the project.',
    input: NoInput,
    run: (api) => api.get('project/assets'),
  },
  {
    name: 'reactcraft_get_theme',
    description:
      'Design tokens of the project (colors, fonts, radii) when its styling system has them.',
    input: NoInput,
    run: (api) => api.get('project/theme'),
  },
  {
    name: 'reactcraft_report_tool_gap',
    description:
      'Call this when you need an operation no ReactCraft tool offers. Say what you needed, why, and an example; then continue as best you can.',
    input: ToolGapReportSchema,
    run: (api, args) => api.post('tool-gaps', ToolGapReportSchema.parse(args)),
  },
  {
    name: 'reactcraft_list_tool_gaps',
    description:
      'Operations agents needed that ReactCraft does not offer yet, most reported first.',
    input: NoInput,
    run: (api) => api.get('tool-gaps'),
  },
];
