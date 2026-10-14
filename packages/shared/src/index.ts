// Public entry point of @reactcraft/shared (QC-03).
export { type FeatureId, FEATURES, RELEASED_PHASE, resolveEnabledFeatures } from './features.ts';
export { type RelPath, relPathProblem, RelPathSchema } from './rel-path.ts';
export {
  bandOf,
  type Breakpoint,
  BREAKPOINT_WIDTHS,
  BreakpointSchema,
  editBreakpoint,
  type InteractionState,
  InteractionStateSchema,
  RESPONSIVE_KEYS,
  type ResponsiveKey,
  ResponsiveKeySchema,
  type ResponsiveMode,
  ResponsiveModeSchema,
} from './responsive.ts';
export {
  type AppError,
  err,
  ERROR_CODES,
  type ErrorCode,
  type ErrorDetail,
  issuesToDetails,
  ok,
  type Result,
} from './result.ts';
export {
  type BackendLink,
  BackendLinkSchema,
  defaultFrames,
  type Frame,
  frameRuleProblems,
  FrameSchema,
  FRAMEWORK_IDS,
  type FrameworkId,
  newWorkspaceFile,
  type NewWorkspaceInput,
  parseWorkspaceFile,
  serializeWorkspaceFile,
  WORKSPACE_DIR,
  WORKSPACE_FILE,
  WORKSPACE_FILE_MAX_BYTES,
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceFile,
  WorkspaceFileSchema,
} from './workspace-file.ts';
