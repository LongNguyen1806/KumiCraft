// Types and schemas for project probing, framework support, project lifecycle and theme (SPEC-03 section 5.3).
import { z } from 'zod';

import { FeatureIdSchema } from './features.ts';
import { RelPathSchema } from './rel-path.ts';
import { ResponsiveModeSchema } from './responsive.ts';
import { AppErrorSchema } from './result.ts';
import { StyleSystemIdSchema } from './style.ts';
import {
  BackendLinkSchema,
  DEFAULT_LOGIN_SESSIONS,
  DEFAULT_WORKSPACE_AI,
  DevPortSchema,
  FrameSchema,
  FRAMEWORK_IDS,
  LoginSessionsSchema,
  ResolvedDesignDirsSchema,
  StyleFilesSchema,
  WorkspaceAiSchema,
} from './workspace-file.ts';

export const UNSUPPORTED_REASONS = [
  'noPackageJson',
  'noVite',
  'viteVersion',
  'noReact',
  'reactVersion',
  // Retained for backwards compatibility with saved probe data; no longer produced by detect (Round S1)
  'noTailwind',
  'tailwindVersion',
  'noViteConfig',
  'noTailwindCss',
  'noExpress',
  'noPug',
  'noServerEntry',
  'craUnsupported',
  'nextUnsupported',
  'webpackUnsupported',
] as const;
export const UnsupportedReasonSchema = z.enum(UNSUPPORTED_REASONS);
export type UnsupportedReason = z.infer<typeof UnsupportedReasonSchema>;

export const EDIT_MODES = ['full', 'viewOnly'] as const;
export type EditMode = (typeof EDIT_MODES)[number];

export const STYLING_SYSTEMS = [
  'tailwind',
  'css',
  'cssModules',
  'sass',
  'less',
  'bootstrap',
  'styledComponents',
  'emotion',
  'mui',
  'antd',
  'chakra',
] as const;
export const StylingSystemIdSchema = z.enum(STYLING_SYSTEMS);
export type StylingSystemId = z.infer<typeof StylingSystemIdSchema>;

export const StylingSystemSchema = z.strictObject({
  id: StylingSystemIdSchema,
  version: z.string().max(50).optional(),
});
export type StylingSystem = z.infer<typeof StylingSystemSchema>;

export const StylingReportSchema = z.strictObject({
  systems: z.array(StylingSystemSchema).max(20),
  primary: StylingSystemIdSchema.optional(),
  editable: z.boolean(),
  globalCss: z.array(RelPathSchema).max(20),
});
export type StylingReport = z.infer<typeof StylingReportSchema>;

export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn'] as const;
export const PackageManagerSchema = z.enum(PACKAGE_MANAGERS);
export type PackageManager = z.infer<typeof PackageManagerSchema>;

export const SupportReportSchema = z.strictObject({
  supported: z.boolean(),
  reasons: z.array(UnsupportedReasonSchema).readonly(),
  framework: z.enum(FRAMEWORK_IDS).optional(),
  workspaceRoot: z.string().min(1).optional(),
  versions: z.strictObject({
    vite: z.string().optional(),
    react: z.string().optional(),
    tailwindcss: z.string().optional(),
    express: z.string().optional(),
    pug: z.string().optional(),
  }),
  language: z.enum(['ts', 'js']),
  packageManager: PackageManagerSchema.optional(),
  viteConfig: RelPathSchema.optional(),
  tailwindCss: RelPathSchema.optional(),
  styling: StylingReportSchema.optional(),
  editMode: z.enum(EDIT_MODES).optional(),
  serverEntry: RelPathSchema.optional(),
  viewsDir: RelPathSchema.optional(),
});
export type SupportReport = z.infer<typeof SupportReportSchema>;

export const AppCandidateSchema = z.strictObject({
  path: RelPathSchema,
  framework: z.enum(FRAMEWORK_IDS).optional(),
  kind: z.enum(['vite-react', 'express-pug', 'cra', 'next', 'webpack', 'other']),
  supported: z.boolean(),
  reasons: z.array(UnsupportedReasonSchema).readonly(),
});
export type AppCandidate = z.infer<typeof AppCandidateSchema>;

export const ProjectProbeSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('missing'),
    canCreate: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal('empty'),
  }),
  z.strictObject({
    kind: z.literal('project'),
    support: SupportReportSchema,
    hasWorkspace: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal('apps'),
    apps: z.array(AppCandidateSchema).min(1).max(20).readonly(),
  }),
  z.strictObject({
    kind: z.literal('other'),
  }),
]);
export type ProjectProbe = z.infer<typeof ProjectProbeSchema>;

export const BACKEND_STATUSES = ['ok', 'missing', 'blocked'] as const;
export const BackendStatusSchema = z.enum(BACKEND_STATUSES);
export type BackendStatus = z.infer<typeof BackendStatusSchema>;

export const BackendInfoSchema = BackendLinkSchema.extend({
  status: BackendStatusSchema,
  /** Absolute path after resolving the stored path against the project root (S-80). */
  resolvedPath: z.string().min(1).max(1024),
  /** True when the backend is not inside the parent folder of the project (S-80). */
  outsideParent: z.boolean(),
});
export type BackendInfo = z.infer<typeof BackendInfoSchema>;

export const ProjectInfoSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  name: z.string().min(1).max(64),
  root: z.string().min(1),
  sourceDir: RelPathSchema,
  support: SupportReportSchema,
  needsInstall: z.boolean(),
  installCommand: z.array(z.string()).readonly().optional(),
  responsiveMode: ResponsiveModeSchema,
  frames: z.array(FrameSchema).readonly(),
  primaryFrameId: z.string(),
  backends: z.array(BackendInfoSchema).readonly(),
  trusted: z.boolean(),
  /** The port saved in workspace.json; absent: read from the project (R-RN-04). */
  devPort: DevPortSchema.optional(),
  /** Default design directories (R-CP-16). */
  designDirs: ResolvedDesignDirsSchema,
  styleFiles: StyleFilesSchema.optional(),
  sessions: LoginSessionsSchema.readonly().default(DEFAULT_LOGIN_SESSIONS),
  ai: WorkspaceAiSchema.default(DEFAULT_WORKSPACE_AI),
});
export type ProjectInfo = z.input<typeof ProjectInfoSchema>;

export const ThemeTokenSchema = z.strictObject({
  name: z.string(),
  value: z.string(),
  variable: z.string().max(100).optional(),
  inherited: z.boolean().optional(),
});
export type ThemeToken = z.infer<typeof ThemeTokenSchema>;

export const ThemeInfoSchema = z.strictObject({
  file: RelPathSchema.optional(),
  system: StyleSystemIdSchema.optional(),
  colors: z.array(ThemeTokenSchema).readonly(),
  fontSizes: z.array(ThemeTokenSchema).readonly(),
  radii: z.array(ThemeTokenSchema).readonly(),
  fonts: z.array(ThemeTokenSchema).readonly(),
  shadows: z.array(ThemeTokenSchema).readonly(),
  breakpoints: z.array(ThemeTokenSchema).readonly(),
});
export type ThemeInfo = z.infer<typeof ThemeInfoSchema>;

export {
  type AddPage,
  AddPageSchema,
  type DeletePage,
  DeletePageSchema,
  type PageInfo,
  PageInfoSchema,
  type PagesInfo,
  PagesInfoSchema,
  type RenamePage,
  RenamePageSchema,
  type RouterKind,
  RouterKindSchema,
  type RouterStatus,
  RouterStatusSchema,
} from './pages-info.ts';

export const ProjectDirsResponseSchema = z.strictObject({
  dirs: z.array(RelPathSchema),
});
export type ProjectDirsResponse = z.infer<typeof ProjectDirsResponseSchema>;

export const ProjectComponentSchema = z.strictObject({
  name: z.string().min(1),
  file: RelPathSchema,
  kind: z.enum(['component', 'layout']),
  usages: z.number().int().min(0),
  importStatement: z.string(),
  /** The tag to insert, its required props filled with placeholders; absent: `<Name />`. */
  insertJsx: z.string().max(2000).optional(),
});
export type ProjectComponent = z.infer<typeof ProjectComponentSchema>;

export const ProjectComponentsSchema = z.strictObject({
  components: z.array(ProjectComponentSchema),
});
export type ProjectComponents = z.infer<typeof ProjectComponentsSchema>;

export const ExtractComponentSchema = z.strictObject({
  loc: z.string().min(1),
  tag: z.string().min(1),
  name: z.string().trim().min(1).max(64),
  dir: RelPathSchema.optional(),
  fileName: z.string().max(100).optional(),
});
export type ExtractComponent = z.infer<typeof ExtractComponentSchema>;

export {
  type CreateDraft,
  CreateDraftSchema,
  type DraftFile,
  DraftFileSchema,
  type DraftInfo,
  DraftInfoSchema,
  type DraftsInfo,
  DraftsInfoSchema,
  type PromoteDraft,
  PromoteDraftSchema,
  type RenameDraft,
  RenameDraftSchema,
} from './drafts.ts';

export const ProjectAssetsSchema = z.strictObject({
  files: z.array(RelPathSchema).max(500),
});
export type ProjectAssets = z.infer<typeof ProjectAssetsSchema>;

export const THEME_TOKEN_KINDS = ['color', 'font', 'fontSize', 'radius', 'shadow'] as const;
export const ThemeTokenKindSchema = z.enum(THEME_TOKEN_KINDS);
export type ThemeTokenKind = z.infer<typeof ThemeTokenKindSchema>;

export const THEME_TOKEN_NAME = /^[a-z][a-z0-9-]{0,39}$/;

export const ThemeEditSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('set'),
    kind: ThemeTokenKindSchema,
    name: z.string().regex(THEME_TOKEN_NAME),
    value: z.string().trim().min(1).max(300),
  }),
  z.strictObject({
    op: z.literal('add'),
    kind: ThemeTokenKindSchema,
    name: z.string().regex(THEME_TOKEN_NAME),
    value: z.string().trim().min(1).max(300),
  }),
  z.strictObject({
    op: z.literal('remove'),
    kind: ThemeTokenKindSchema,
    name: z.string().regex(THEME_TOKEN_NAME),
  }),
]);
export type ThemeEdit = z.infer<typeof ThemeEditSchema>;

export const ThemeUsageSchema = z.strictObject({
  count: z.number().int().min(0),
});
export type ThemeUsage = z.infer<typeof ThemeUsageSchema>;

export const THEME_VAR_PREFIX: Readonly<Record<ThemeTokenKind, string>> = {
  color: '--color-',
  font: '--font-',
  fontSize: '--text-',
  radius: '--radius-',
  shadow: '--shadow-',
};

export const SERVER_EVENT_TYPES = [
  'session.changed',
  'project.changed',
  'project.filesChanged',
  'runner.status',
  'runner.log',
  'history.changed',
  'settings.changed',
  'job.progress',
  'job.completed',
  'job.failed',
  'job.cancelled',
  'server.shuttingDown',
  'agent.event',
] as const;
export const ServerEventTypeSchema = z.enum(SERVER_EVENT_TYPES);
export type ServerEventType = z.infer<typeof ServerEventTypeSchema>;

export const ServerShuttingDownEventSchema = z.strictObject({});
export type ServerShuttingDownEvent = z.infer<typeof ServerShuttingDownEventSchema>;

export const StudioServerEventSchema = z.strictObject({
  v: z.literal(1),
  type: ServerEventTypeSchema,
  at: z.string(),
  correlationId: z.string().optional(),
  payload: z.unknown(),
});
export type StudioServerEvent = z.infer<typeof StudioServerEventSchema>;

export const PLATFORMS = ['win32', 'darwin', 'linux'] as const;
export const PlatformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof PlatformSchema>;

export const ProjectStateSchema = z.discriminatedUnion('state', [
  z.strictObject({
    state: z.literal('none'),
    suggestedPath: z.string().optional(),
  }),
  z.strictObject({
    state: z.literal('open'),
    id: z.string().min(1),
    name: z.string().min(1),
    trusted: z.boolean(),
  }),
  z.strictObject({
    state: z.literal('error'),
    error: AppErrorSchema,
  }),
]);
export type ProjectState = z.infer<typeof ProjectStateSchema>;

export const SessionInfoSchema = z.strictObject({
  version: z.string().min(1),
  platform: PlatformSchema,
  features: z.array(FeatureIdSchema).readonly(),
  project: ProjectStateSchema,
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;

export const INTERFACE_LANGUAGES = ['vi', 'en'] as const;
export const InterfaceLanguageSchema = z.enum(INTERFACE_LANGUAGES);
export type InterfaceLanguage = z.infer<typeof InterfaceLanguageSchema>;

export const EDITORS = ['vscode', 'cursor', 'webstorm', 'zed'] as const;
export const EditorSchema = z.enum(EDITORS);
export type Editor = z.infer<typeof EditorSchema>;

export const AGENT_CHOICES = ['auto', 'agy', 'claude'] as const;
export const AgentChoiceSchema = z.enum(AGENT_CHOICES);
export type AgentChoice = z.infer<typeof AgentChoiceSchema>;

/** Studio colours (P5 round 4): light, dark, or whatever the system uses. */
export const THEMES = ['light', 'dark', 'system'] as const;
export const ThemeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof ThemeSchema>;

export const SettingsSchema = z.strictObject({
  language: InterfaceLanguageSchema.optional(),
  editor: EditorSchema,
  packageManager: PackageManagerSchema.optional(),
  agent: z.strictObject({
    preferred: AgentChoiceSchema,
  }),
  /** Login sessions on the Canvas toolbar (spec-log #77); off by default, hidden when off. */
  loginSessions: z.boolean().optional(),
  /** Unset means `system`. */
  theme: ThemeSchema.optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const SettingsPatchSchema = z.strictObject({
  language: InterfaceLanguageSchema.optional(),
  editor: EditorSchema.optional(),
  packageManager: PackageManagerSchema.optional(),
  agent: z
    .strictObject({
      preferred: AgentChoiceSchema.optional(),
    })
    .optional(),
  loginSessions: z.boolean().optional(),
  theme: ThemeSchema.optional(),
});
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
