// Public entry point of @reactcraft/model (QC-03).
export type { FeatureId } from './features.ts';
export { FEATURES, RELEASED_PHASE, resolveEnabledFeatures } from './features.ts';
export type { Migration, MigrationOutcome, WorkspaceFiles } from './migrations/migrate.ts';
export { migrateWorkspace, MIGRATIONS, readSchemaVersion } from './migrations/migrate.ts';
export type { WorkspaceFileKind, WorkspaceFileValue } from './migrations/serialize-canonical.ts';
export { serializeCanonical } from './migrations/serialize-canonical.ts';
export type { AssembledDocument } from './migrations/workspace-files.ts';
export {
  assembleDocument,
  documentToFiles,
  WORKSPACE_DIR,
  WORKSPACE_GITIGNORE,
  workspaceFilePath,
} from './migrations/workspace-files.ts';
export type { IdGenerator } from './operations/batch.ts';
export { applyBatch, assignIds, TEMPORARY_ID } from './operations/batch.ts';
export type { CanInsertSubject } from './operations/can-insert.ts';
export { canInsert } from './operations/can-insert.ts';
export { applyOperation, invertOperation } from './operations/engine.ts';
export type { NodeRecord, NormalizedTree } from './operations/normalize.ts';
export { denormalize, normalize } from './operations/normalize.ts';
export type {
  DesignOperation,
  OperationBatch,
  OperationKind,
  OperationOf,
  StyleScope,
  TreeTarget,
} from './operations/operation.schema.ts';
export {
  DesignOperationSchema,
  OperationBatchSchema,
  StyleScopeSchema,
  TreeTargetSchema,
} from './operations/operation.schema.ts';
export { findTokenUses } from './operations/token-refs.ts';
export { validateOperation } from './operations/validate-operation.ts';
export { type InstantiatedPreset, instantiatePreset } from './presets/instantiate.ts';
export { PRESETS } from './presets/presets.ts';
export type { Preset, PresetCategory, PresetContext } from './presets/types.ts';
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
export { BINDING_KEYS } from './schema/validate/rules-data.ts';
export type { ValidateOptions } from './schema/validate/validate-document.ts';
export {
  checkDocument,
  issuesToDetails,
  validateDocument,
} from './schema/validate/validate-document.ts';
export { normalizeResponsiveStyle } from './styling/normalize-responsive.ts';
export {
  bandOf,
  BREAKPOINT_MIN,
  editBreakpoint,
  effectiveStyleValue,
  styleScope,
} from './styling/responsive-scope.ts';
export type { ParentLayout, StylingContext } from './styling/styling-context.ts';
export type { ThemeCssOptions } from './styling/theme-css.ts';
export { generateThemeCss, validateTokenNameCollisions } from './styling/theme-css.ts';
export { toTailwindClasses } from './styling/to-tailwind-classes.ts';
export { createDefaultTokens } from './tokens/default-tokens.ts';
export type {
  CreateWorkspaceRequest,
  FramePreset,
  ParsedCreateWorkspaceRequest,
} from './workspace/new-workspace.ts';
export {
  buildFrames,
  CONTENT_LOCALE_PATTERN,
  CreateWorkspaceRequestSchema,
  FRAME_PRESETS,
  resolvePrimaryFrame,
} from './workspace/new-workspace.ts';
