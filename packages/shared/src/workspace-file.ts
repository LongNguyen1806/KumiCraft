// `.kumicraft/workspace.json`, schema version 2 (SPEC-03 section 3): what KumiCraft keeps about a
// project besides its source code. The source code itself is never copied here (C-02).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';
import { type ResponsiveMode, ResponsiveModeSchema } from './responsive.ts';
import { type AppError, err, ok, type Result } from './result.ts';

export const WORKSPACE_DIR = '.kumicraft';
export const WORKSPACE_FILE = `${WORKSPACE_DIR}/workspace.json`;
export const WORKSPACE_SCHEMA_VERSION = 2;
/** V-106 */
export const WORKSPACE_FILE_MAX_BYTES = 1024 * 1024;

export const FrameSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  label: z.string().min(1).max(32),
  width: z.int().min(320).max(3840),
  height: z.int().min(320).max(2160),
});
export type Frame = z.infer<typeof FrameSchema>;

export const BackendLinkSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  path: z.string().min(1).max(1024),
  label: z.string().min(1).max(64),
});
export type BackendLink = z.infer<typeof BackendLinkSchema>;

/** A port the user picks for the project's dev server in the Canvas (SPEC-04 R-RN-04). */
export const DevPortSchema = z.int().min(1024).max(65535);

export const FRAMEWORK_IDS = ['vite-react'] as const;
export type FrameworkId = (typeof FRAMEWORK_IDS)[number];

type FrameRules = {
  readonly frames: readonly Frame[];
  readonly primaryFrameId: string;
  readonly responsiveMode: ResponsiveMode;
};

/** V-09 (ids unique, primary present) and V-07 (side of the primary frame); messages per rule. */
export function frameRuleProblems(value: FrameRules): { rule: string; message: string }[] {
  const problems: { rule: string; message: string }[] = [];
  const ids = new Set(value.frames.map((frame) => frame.id));
  const primary = value.frames.find((frame) => frame.id === value.primaryFrameId);
  if (ids.size !== value.frames.length || primary === undefined) {
    problems.push({ rule: 'V-09', message: 'Frames need unique ids and one primary frame' });
    return problems;
  }
  for (const frame of value.frames) {
    const isWrongSide =
      value.responsiveMode === 'desktop-first'
        ? frame.width > primary.width
        : frame.width < primary.width;
    if (isWrongSide) {
      problems.push({ rule: 'V-07', message: `Frame "${frame.id}" is on the wrong side` });
    }
  }
  return problems;
}

const DirListSchema = z.union([RelPathSchema, z.array(RelPathSchema).min(1).max(10).readonly()]);

export const DesignDirsSchema = z.strictObject({
  pages: DirListSchema,
  layouts: DirListSchema,
  components: DirListSchema,
  drafts: RelPathSchema.optional(),
});
export type DesignDirs = z.infer<typeof DesignDirsSchema>;

export const ResolvedDesignDirsSchema = z.strictObject({
  pages: z.array(RelPathSchema).min(1).max(10).readonly(),
  layouts: z.array(RelPathSchema).min(1).max(10).readonly(),
  components: z.array(RelPathSchema).min(1).max(10).readonly(),
  drafts: RelPathSchema,
});
export type ResolvedDesignDirs = z.infer<typeof ResolvedDesignDirsSchema>;

export const StyleFilesSchema = z.strictObject({
  newCssDir: RelPathSchema.optional(),
  tokenFile: RelPathSchema.optional(),
});
export type StyleFiles = z.infer<typeof StyleFilesSchema>;

export const RoutingSchema = z.strictObject({
  file: RelPathSchema.optional(),
});
export type Routing = z.infer<typeof RoutingSchema>;

export const DEFAULT_DESIGN_DIRS: ResolvedDesignDirs = {
  pages: ['src/pages'],
  layouts: ['src/layouts'],
  components: ['src/components'],
  drafts: 'src/drafts',
};

export function normalizeDesignDirs(d: DesignDirs | undefined): ResolvedDesignDirs {
  if (!d) return DEFAULT_DESIGN_DIRS;
  const toArr = (
    v: string | readonly string[] | undefined,
    def: readonly string[],
  ): readonly string[] => {
    if (v === undefined) return def;
    if (typeof v === 'string') return [v];
    return v;
  };
  return {
    pages: toArr(d.pages, DEFAULT_DESIGN_DIRS.pages),
    layouts: toArr(d.layouts, DEFAULT_DESIGN_DIRS.layouts),
    components: toArr(d.components, DEFAULT_DESIGN_DIRS.components),
    drafts: d.drafts ?? DEFAULT_DESIGN_DIRS.drafts,
  };
}

export const WorkspaceFileSchema = z
  .strictObject({
    schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
    id: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
    name: z.string().min(1).max(64),
    createdAt: z.iso.datetime(),
    framework: z.enum(FRAMEWORK_IDS),
    sourceDir: RelPathSchema,
    backends: z.array(BackendLinkSchema).max(10),
    responsiveMode: ResponsiveModeSchema,
    frames: z.array(FrameSchema).min(1).max(8),
    primaryFrameId: z.string(),
    devPort: DevPortSchema.optional(),
    designDirs: DesignDirsSchema.optional(),
    styleFiles: StyleFilesSchema.optional(),
    routing: RoutingSchema.optional(),
  })
  .superRefine((value, ctx) => {
    for (const problem of frameRuleProblems(value)) {
      ctx.addIssue({
        code: 'custom',
        message: `${problem.rule}: ${problem.message}`,
        path: ['frames'],
      });
    }
  });
export type WorkspaceFile = z.infer<typeof WorkspaceFileSchema>;

const DESKTOP: Frame = { id: 'desktop', label: 'Desktop', width: 1440, height: 900 };
const TABLET: Frame = { id: 'tablet', label: 'Tablet', width: 768, height: 1024 };
const MOBILE: Frame = { id: 'mobile', label: 'Mobile', width: 375, height: 812 };

/** Default frames of SPEC-03 section 3; the primary frame comes first. */
export function defaultFrames(mode: ResponsiveMode): {
  readonly frames: readonly Frame[];
  readonly primaryFrameId: string;
} {
  return mode === 'desktop-first'
    ? { frames: [DESKTOP, TABLET, MOBILE], primaryFrameId: DESKTOP.id }
    : { frames: [MOBILE, TABLET, DESKTOP], primaryFrameId: MOBILE.id };
}

export type NewWorkspaceInput = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly responsiveMode: ResponsiveMode;
  readonly framework?: FrameworkId;
};

/** The content of a new `workspace.json` (R-PJ-08). */
export function newWorkspaceFile(input: NewWorkspaceInput): WorkspaceFile {
  const { frames, primaryFrameId } = defaultFrames(input.responsiveMode);
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    framework: input.framework ?? 'vite-react',
    sourceDir: 'src',
    backends: [],
    responsiveMode: input.responsiveMode,
    frames: [...frames],
    primaryFrameId,
  };
}

const loadError = (reason: 'invalid' | 'unsupportedVersion', message: string): AppError => ({
  code: 'E003',
  params: { file: WORKSPACE_FILE, reason },
  details: [{ path: WORKSPACE_FILE, message }],
});

/** V-105: parses the JSON of `workspace.json`; another schema version is not opened. */
export function parseWorkspaceFile(value: unknown): Result<WorkspaceFile> {
  // `Boolean(value)` keeps JSON null out without writing the literal (QC-40).
  const version =
    typeof value === 'object' && Boolean(value) && 'schemaVersion' in (value as object)
      ? (value as { schemaVersion: unknown }).schemaVersion
      : undefined;
  if (version !== WORKSPACE_SCHEMA_VERSION) {
    return err(
      loadError('unsupportedVersion', `schemaVersion ${String(version)} is not supported`),
    );
  }
  const parsed = WorkspaceFileSchema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return err(loadError('invalid', message));
  }
  return ok(parsed.data);
}

/** Serialized form: two-space JSON with a final newline, as people read it in Git. */
export const serializeWorkspaceFile = (file: WorkspaceFile): string =>
  `${JSON.stringify(file, undefined, 2)}\n`;
