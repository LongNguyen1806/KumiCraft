// New workspace content (SPEC-04.1 section 2.4): one Home page, default tokens, standard frames
// and an empty Data Source Catalog. Pure: the workspace service writes the files.
import {
  createDefaultTokens,
  type DesignDocument,
  type Frame,
  FrameSchema,
  type Page,
  type ResponsiveMode,
  SCHEMA_VERSION,
} from '@reactcraft/model';
import { z } from 'zod';

const MOBILE: Frame = { id: 'mobile', label: 'Mobile', width: 375, height: 812 };
const TABLET: Frame = { id: 'tablet', label: 'Tablet', width: 768, height: 1024 };
const DESKTOP: Frame = { id: 'desktop', label: 'Desktop', width: 1440, height: 900 };

export const FRAME_PRESETS = {
  'desktop-1440': DESKTOP,
  'desktop-1920': { id: 'desktop', label: 'Desktop', width: 1920, height: 1080 },
  'laptop-1280': { id: 'laptop', label: 'Laptop', width: 1280, height: 800 },
  'mobile-375': MOBILE,
} as const satisfies Record<string, Frame>;
type FramePreset = keyof typeof FRAME_PRESETS;

const PresetSchema = z.enum(Object.keys(FRAME_PRESETS) as [FramePreset, ...FramePreset[]]);

export const CreateWorkspaceRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(64),
  responsiveMode: z.enum(['desktop-first', 'mobile-first']).default('desktop-first'),
  /** Defaults to Desktop 1440 (desktop-first) or Mobile 375 (mobile-first). */
  primaryFrame: z.union([PresetSchema, FrameSchema]).optional(),
  /** Defaults to the interface language: vi → vi-VN, en → en-US. */
  contentLocale: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-\d{3})?$/)
    .optional(),
  darkMode: z.enum(['none', 'media', 'class']).default('none'),
});
export type CreateWorkspaceRequest = z.input<typeof CreateWorkspaceRequestSchema>;

/**
 * The primary frame first, then the standard frames on the side its responsive mode allows (V-07),
 * so a custom or narrow primary frame never produces an invalid workspace.
 */
export function buildFrames(mode: ResponsiveMode, primary: Frame): Frame[] {
  const isAllowed = (frame: Frame) =>
    frame.id !== primary.id &&
    (mode === 'desktop-first' ? frame.width < primary.width : frame.width > primary.width);
  const others = (mode === 'desktop-first' ? [TABLET, MOBILE] : [TABLET, DESKTOP]).filter(
    isAllowed,
  );
  return [primary, ...others];
}

export type NewWorkspaceDeps = {
  /** Random url-safe id of the given length (nanoid). */
  readonly newId: (size: number) => string;
  readonly now: Date;
  /** Interface language, for the default content locale. */
  readonly language?: 'vi' | 'en';
};

function homePage(id: string, rootId: string, primary: Frame): Page {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: 'Home',
    route: '/',
    root: {
      id: rootId,
      type: 'Stack',
      content: { kind: 'none' },
      style: { direction: 'column', width: 'fill', minHeight: { px: primary.height } },
    },
  };
}

/** The document of a new workspace. The request must be parsed already. */
export function createWorkspaceDocument(
  request: z.output<typeof CreateWorkspaceRequestSchema>,
  deps: NewWorkspaceDeps,
): DesignDocument {
  const mode = request.responsiveMode;
  const choice = request.primaryFrame ?? (mode === 'desktop-first' ? 'desktop-1440' : 'mobile-375');
  const primary = typeof choice === 'string' ? FRAME_PRESETS[choice] : choice;
  const page = homePage(`p_${deps.newId(10)}`, `n_${deps.newId(10)}`, primary);
  const timestamp = deps.now.toISOString();
  return {
    workspace: {
      schemaVersion: SCHEMA_VERSION,
      id: deps.newId(10),
      name: request.name,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 0,
      pageOrder: [page.id],
      backends: [],
      responsiveMode: mode,
      frames: buildFrames(mode, primary),
      primaryFrameId: primary.id,
      contentLocale: request.contentLocale ?? (deps.language === 'vi' ? 'vi-VN' : 'en-US'),
      darkMode: request.darkMode,
    },
    tokens: createDefaultTokens(),
    pages: { [page.id]: page },
    components: {},
    dataSources: {
      schemaVersion: SCHEMA_VERSION,
      auth: { kind: 'none' },
      entities: [],
      endpoints: [],
    },
  };
}
