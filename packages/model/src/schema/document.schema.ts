// Design Document and its workspace files (SPEC-03 section 3). Tree-wide rules of a page or a
// component (V-06, V-16, V-19, V-20, V-57, V-91) and workspace rules (V-07, V-09) are checked here;
// rules across files are checked by validateDocument.
import { z } from 'zod';

import { type DesignNode, DesignNodeSchema } from './node.schema.ts';
import {
  BackendIdSchema,
  ComponentIdSchema,
  DataSourceIdSchema,
  EndpointIdSchema,
  FrameSchema,
  HexColorSchema,
  PageIdSchema,
  PxSchema,
  ResponsiveModeSchema,
  TOKEN_NAME_PATTERN,
} from './primitives.schema.ts';
import { walkTree } from './tree.ts';

export const SCHEMA_VERSION = 1;
const schemaVersion = z.int().min(1);

export const MAX_TREE_DEPTH = 32; // V-19
export const MAX_NODES_PER_PAGE = 2000; // V-19

/** V-06: lowercase segments, or `:param` segments such as `/products/:id`. */
export const ROUTE_PATTERN =
  /^\/(([a-z0-9-]+|:[a-z][A-Za-z0-9]*)(\/([a-z0-9-]+|:[a-z][A-Za-z0-9]*))*)?$/;

type RefinementContext = z.RefinementCtx;

const report = (
  ctx: RefinementContext,
  rule: string,
  message: string,
  path: (string | number)[],
) => {
  ctx.addIssue({ code: 'custom', message: `${message} (${rule})`, path, params: { rule } });
};

/** Rules every tree shares: depth and node count (V-19). */
function checkTreeSize(root: DesignNode, ctx: RefinementContext, path: string) {
  let count = 0;
  walkTree(root, (_node, { depth, path: nodePath }) => {
    count++;
    if (depth === MAX_TREE_DEPTH + 1) {
      report(ctx, 'V-19', `Tree deeper than ${String(MAX_TREE_DEPTH)}`, [path, ...nodePath]);
    }
  });
  if (count > MAX_NODES_PER_PAGE) {
    report(ctx, 'V-19', `More than ${String(MAX_NODES_PER_PAGE)} nodes`, [path]);
  }
}

// --- Page (SPEC-03 section 3.5) ---

export const PageSchema = z
  .strictObject({
    schemaVersion,
    id: PageIdSchema,
    name: z.string().min(1).max(64),
    route: z.string().regex(ROUTE_PATTERN, { message: 'Invalid route (V-06)' }),
    title: z.string().min(1).max(70).optional(),
    description: z.string().min(1).max(300).optional(),
    root: DesignNodeSchema,
  })
  .superRefine((page, ctx) => {
    const { root } = page;
    if (root.type !== 'Stack' || root.style?.direction === 'row') {
      report(ctx, 'V-20', 'The page root is a column Stack', ['root']);
    }
    checkTreeSize(root, ctx, 'root');
    walkTree(root, (node, { path }) => {
      if (node.type === 'Slot')
        report(ctx, 'V-16', 'Slot exists only inside a component', ['root', ...path]);
      if (node.propRef !== undefined) {
        report(ctx, 'V-57', 'propRef exists only inside a component', ['root', ...path, 'propRef']);
      }
    });
  });
export type Page = z.infer<typeof PageSchema>;

// --- User Component (SPEC-03 section 3.6) ---

export const ComponentPropDefSchema = z.strictObject({
  name: z.string().regex(/^[a-z][A-Za-z0-9]{0,63}$/),
  kind: z.enum(['text', 'image', 'link']),
  defaultValue: z.string().max(10_000),
});
export type ComponentPropDef = z.infer<typeof ComponentPropDefSchema>;

export const UserComponentSchema = z
  .strictObject({
    schemaVersion,
    id: ComponentIdSchema,
    name: z.string().regex(/^[A-Z][A-Za-z0-9]{0,63}$/),
    props: z.array(ComponentPropDefSchema),
    recordEntity: DataSourceIdSchema.optional(),
    root: DesignNodeSchema,
  })
  .superRefine((component, ctx) => {
    checkTreeSize(component.root, ctx, 'root');
    const propNames = new Set(component.props.map((prop) => prop.name));
    if (propNames.size !== component.props.length) {
      report(ctx, 'V-56', 'Prop names must be unique', ['props']);
    }
    const slotNames = new Set<string>();
    walkTree(component.root, (node, { path }) => {
      const at = ['root', ...path];
      if (node.content?.kind === 'slot') {
        if (slotNames.has(node.content.name)) report(ctx, 'V-16', 'Slot names must be unique', at);
        slotNames.add(node.content.name);
      }
      if (node.propRef !== undefined && !propNames.has(node.propRef.prop)) {
        report(ctx, 'V-57', `propRef "${node.propRef.prop}" is not a prop`, [...at, 'propRef']);
      }
      if ((node.interactions?.length ?? 0) > 0) {
        report(ctx, 'V-91', 'Component definitions have no interactions', [...at, 'interactions']);
      }
    });
  });
export type UserComponent = z.infer<typeof UserComponentSchema>;

// --- Workspace (SPEC-03 sections 3.2, 2.2a) ---

export const BackendLinkSchema = z.strictObject({
  id: BackendIdSchema,
  path: z.string().min(1),
  label: z.string().min(1).max(64),
});
export type BackendLink = z.infer<typeof BackendLinkSchema>;

export const WorkspaceMetaSchema = z
  .strictObject({
    schemaVersion,
    id: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
    name: z.string().min(1).max(64),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    revision: z.int().min(0),
    pageOrder: z.array(PageIdSchema),
    targetProject: z.strictObject({ path: z.string().min(1) }).optional(),
    backends: z.array(BackendLinkSchema),
    responsiveMode: ResponsiveModeSchema,
    frames: z.array(FrameSchema).min(1).max(8),
    primaryFrameId: z.string(),
    contentLocale: z.string().regex(/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-\d{3})?$/),
    darkMode: z.enum(['none', 'media', 'class']),
  })
  .superRefine((meta, ctx) => {
    const ids = meta.frames.map((frame) => frame.id);
    const primary = meta.frames.find((frame) => frame.id === meta.primaryFrameId);
    if (new Set(ids).size !== ids.length || primary === undefined) {
      report(ctx, 'V-09', 'Frames need unique ids and exactly one primary frame', ['frames']);
      return;
    }
    meta.frames.forEach((frame, i) => {
      const isWider = frame.width > primary.width;
      const isNarrower = frame.width < primary.width;
      if (meta.responsiveMode === 'desktop-first' ? isWider : isNarrower) {
        report(ctx, 'V-07', `Frame "${frame.id}" is on the wrong side of the primary frame`, [
          'frames',
          i,
        ]);
      }
    });
  });
export type WorkspaceMeta = z.infer<typeof WorkspaceMetaSchema>;

// --- Design tokens (SPEC-03 section 3.4) ---

const tokenName = z.string().regex(TOKEN_NAME_PATTERN);
const tokenEntry = <T extends z.ZodType>(value: T) =>
  z.record(tokenName, z.strictObject({ value, label: z.string().min(1).max(64).optional() }));

export const DesignTokensSchema = z.strictObject({
  schemaVersion,
  color: z.record(
    tokenName,
    z.strictObject({
      value: HexColorSchema,
      label: z.string().min(1).max(64).optional(),
      dark: HexColorSchema.optional(),
    }),
  ),
  spacing: tokenEntry(PxSchema),
  radius: tokenEntry(PxSchema),
  shadow: tokenEntry(z.string().min(1).max(200)),
  fontSize: tokenEntry(
    z.strictObject({ size: PxSchema, lineHeight: z.number().positive().max(10).optional() }),
  ),
  fontWeight: tokenEntry(z.int().min(100).max(900).multipleOf(100)),
  lineHeight: tokenEntry(z.number().positive().max(10)),
  fontFamily: tokenEntry(z.array(z.string().min(1).max(100)).min(1)),
});
export type DesignTokens = z.infer<typeof DesignTokensSchema>;

// --- Data Source Catalog (SPEC-03 section 3.7) ---

export const FIELD_TYPES = [
  'string',
  'text',
  'integer',
  'number',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'email',
  'url',
  'image',
  'enum',
  'id',
  'relation',
  'json',
] as const;
export const FieldTypeSchema = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const ProvenanceSchema = z.strictObject({
  origin: z.enum(['openapi', 'code', 'ai', 'manual']),
  confidence: z.enum(['high', 'medium', 'low']),
  file: z.string().min(1).optional(),
  line: z.int().min(1).optional(),
  backendId: BackendIdSchema.optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const EntityFieldSchema = z.strictObject({
  name: z.string().min(1).max(128),
  type: FieldTypeSchema,
  required: z.boolean(),
  readOnly: z.boolean(),
  enumValues: z.array(z.string()).optional(),
  relation: z.strictObject({ entity: DataSourceIdSchema, many: z.boolean() }).optional(),
  label: z.string().min(1).max(128).optional(),
  stale: z.boolean().optional(),
  provenance: ProvenanceSchema,
});
export type EntityField = z.infer<typeof EntityFieldSchema>;

export const EntitySchema = z.strictObject({
  id: DataSourceIdSchema,
  name: z.string().min(1).max(128),
  fields: z.array(EntityFieldSchema),
  stale: z.boolean().optional(),
  provenance: ProvenanceSchema,
});
export type Entity = z.infer<typeof EntitySchema>;

export const EndpointSchema = z.strictObject({
  id: EndpointIdSchema,
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().startsWith('/'),
  purpose: z.enum(['list', 'detail', 'create', 'update', 'delete', 'other']),
  entity: DataSourceIdSchema.optional(),
  params: z.array(
    z.strictObject({
      name: z.string().min(1),
      in: z.enum(['path', 'query']),
      type: FieldTypeSchema,
      required: z.boolean(),
      role: z.enum(['search', 'sort', 'page', 'pageSize', 'offset', 'limit', 'cursor']).optional(),
    }),
  ),
  pagination: z.strictObject({ style: z.enum(['page', 'offset', 'cursor']) }).optional(),
  responseEnvelope: z.enum(['none', 'results', 'data', 'items', 'content']).optional(),
  stale: z.boolean().optional(),
  provenance: ProvenanceSchema,
});
export type Endpoint = z.infer<typeof EndpointSchema>;

export const DataSourceCatalogSchema = z.strictObject({
  schemaVersion,
  baseUrl: z.url().optional(),
  auth: z.strictObject({
    kind: z.enum(['none', 'bearer', 'header', 'cookie']),
    headerName: z.string().min(1).max(128).optional(),
  }),
  entities: z.array(EntitySchema),
  endpoints: z.array(EndpointSchema),
});
export type DataSourceCatalog = z.infer<typeof DataSourceCatalogSchema>;

// --- Whole document (SPEC-03 section 3.1) ---

export const DesignDocumentSchema = z.strictObject({
  workspace: WorkspaceMetaSchema,
  tokens: DesignTokensSchema,
  pages: z.record(PageIdSchema, PageSchema),
  components: z.record(ComponentIdSchema, UserComponentSchema),
  dataSources: DataSourceCatalogSchema,
});
export type DesignDocument = z.infer<typeof DesignDocumentSchema>;
