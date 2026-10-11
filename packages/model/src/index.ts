// Public entry point of @reactcraft/model (QC-03).
export type { FeatureId } from './features.ts';
export { FEATURES, RELEASED_PHASE, resolveEnabledFeatures } from './features.ts';
export type { AppError, ErrorCode, ErrorDetail, Result } from './result.ts';
export { err, ok } from './result.ts';
export type { Binding, ValueFormat } from './schema/binding.schema.ts';
export { BindingSchema, ValueFormatSchema } from './schema/binding.schema.ts';
export type {
  ContentKind,
  ContentProps,
  DataOptions,
  FieldValidation,
  TableColumn,
  TableRowAction,
  TextRun,
} from './schema/content.schema.ts';
export {
  areRunsConsistent,
  ContentPropsSchema,
  IMAGE_SRC_PATTERN,
  LINK_HREF_PATTERN,
  TextRunSchema,
} from './schema/content.schema.ts';
export type {
  BackendLink,
  ComponentPropDef,
  DataSourceCatalog,
  DesignDocument,
  DesignTokens,
  Endpoint,
  Entity,
  EntityField,
  FieldType,
  Page,
  Provenance,
  UserComponent,
  WorkspaceMeta,
} from './schema/document.schema.ts';
export {
  DataSourceCatalogSchema,
  DesignDocumentSchema,
  DesignTokensSchema,
  MAX_NODES_PER_PAGE,
  MAX_TREE_DEPTH,
  PageSchema,
  ROUTE_PATTERN,
  SCHEMA_VERSION,
  UserComponentSchema,
  WorkspaceMetaSchema,
} from './schema/document.schema.ts';
export type {
  Interaction,
  InteractionAction,
  InteractionTrigger,
  ParamSource,
} from './schema/interaction.schema.ts';
export { InteractionActionSchema, InteractionSchema } from './schema/interaction.schema.ts';
export type { DesignNode, NodeType } from './schema/node.schema.ts';
export {
  checkNodeRules,
  CONTAINER_TYPES,
  CONTENT_KIND_BY_TYPE,
  DesignNodeSchema,
  NODE_TYPES,
  TRIGGER_NODE_TYPES,
} from './schema/node.schema.ts';
export type {
  Breakpoint,
  Color,
  ComponentId,
  DataSourceId,
  EndpointId,
  Frame,
  HexColor,
  InteractionState,
  LimitValue,
  NodeId,
  PageId,
  Px,
  ResponsiveKey,
  ResponsiveMode,
  SizeValue,
  Spacing,
  TokenGroup,
  TokenRef,
} from './schema/primitives.schema.ts';
export {
  BREAKPOINT_WIDTHS,
  FrameSchema,
  NodeIdSchema,
  PageIdSchema,
  RESPONSIVE_KEYS,
  TOKEN_GROUPS,
  tokenRefSchema,
} from './schema/primitives.schema.ts';
export type { BackgroundImage, StateStyleProps, StyleProps } from './schema/style.schema.ts';
export { StylePropsSchema } from './schema/style.schema.ts';
export { walkTree } from './schema/tree.ts';
