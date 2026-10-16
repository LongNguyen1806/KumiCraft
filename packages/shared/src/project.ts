// Types and schemas for project probing, framework support, project lifecycle and theme (SPEC-03 section 5.3).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';
import { ResponsiveModeSchema } from './responsive.ts';
import { BackendLinkSchema, FrameSchema, FRAMEWORK_IDS } from './workspace-file.ts';

export const UNSUPPORTED_REASONS = [
  'noPackageJson',
  'noVite',
  'viteVersion',
  'noReact',
  'reactVersion',
  'noTailwind',
  'tailwindVersion',
  'noViteConfig',
  'noTailwindCss',
] as const;
export const UnsupportedReasonSchema = z.enum(UNSUPPORTED_REASONS);
export type UnsupportedReason = z.infer<typeof UnsupportedReasonSchema>;

export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn'] as const;
export const PackageManagerSchema = z.enum(PACKAGE_MANAGERS);
export type PackageManager = z.infer<typeof PackageManagerSchema>;

export const SupportReportSchema = z.strictObject({
  supported: z.boolean(),
  reasons: z.array(UnsupportedReasonSchema).readonly(),
  framework: z.enum(FRAMEWORK_IDS).optional(),
  versions: z.strictObject({
    vite: z.string().optional(),
    react: z.string().optional(),
    tailwindcss: z.string().optional(),
  }),
  language: z.enum(['ts', 'js']),
  packageManager: PackageManagerSchema.optional(),
  viteConfig: RelPathSchema.optional(),
  tailwindCss: RelPathSchema.optional(),
});
export type SupportReport = z.infer<typeof SupportReportSchema>;

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
});
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>;

export const ThemeTokenSchema = z.strictObject({
  name: z.string(),
  value: z.string(),
});
export type ThemeToken = z.infer<typeof ThemeTokenSchema>;

export const ThemeInfoSchema = z.strictObject({
  file: RelPathSchema.optional(),
  colors: z.array(ThemeTokenSchema).readonly(),
  fontSizes: z.array(ThemeTokenSchema).readonly(),
  radii: z.array(ThemeTokenSchema).readonly(),
  fonts: z.array(ThemeTokenSchema).readonly(),
  shadows: z.array(ThemeTokenSchema).readonly(),
  breakpoints: z.array(ThemeTokenSchema).readonly(),
});
export type ThemeInfo = z.infer<typeof ThemeInfoSchema>;

/** A page of the project as its router declares it (SPEC-04 M-PG). */
export const PageInfoSchema = z.strictObject({
  path: z.string().min(1),
  component: z.string().optional(),
  file: RelPathSchema.optional(),
  /** The path has `:param`; the user gives a value before navigating (R-PG-15). */
  dynamic: z.boolean(),
});
export type PageInfo = z.infer<typeof PageInfoSchema>;

export const PagesInfoSchema = z.strictObject({
  /** The project follows R-PG-10, so pages can be added, renamed and removed (Phase 2). */
  convention: z.boolean(),
  routesFile: RelPathSchema.optional(),
  pages: z.array(PageInfoSchema),
});
export type PagesInfo = z.infer<typeof PagesInfoSchema>;
