// Request of a new workspace and its frames (SPEC-04.1 section 2.4). Shared by the server, which
// creates the workspace, and the Studio, whose Welcome form previews the frames.
import { z } from 'zod';

import { type Frame, FrameSchema, type ResponsiveMode } from '../schema/primitives.schema.ts';

const MOBILE: Frame = { id: 'mobile', label: 'Mobile', width: 375, height: 812 };
const TABLET: Frame = { id: 'tablet', label: 'Tablet', width: 768, height: 1024 };
const DESKTOP: Frame = { id: 'desktop', label: 'Desktop', width: 1440, height: 900 };

export const FRAME_PRESETS = {
  'desktop-1440': DESKTOP,
  'desktop-1920': { id: 'desktop', label: 'Desktop', width: 1920, height: 1080 },
  'laptop-1280': { id: 'laptop', label: 'Laptop', width: 1280, height: 800 },
  'mobile-375': MOBILE,
} as const satisfies Record<string, Frame>;
export type FramePreset = keyof typeof FRAME_PRESETS;

const PresetSchema = z.enum(Object.keys(FRAME_PRESETS) as [FramePreset, ...FramePreset[]]);

/** BCP 47 tag of the content language, for example `vi-VN` (same rule as WorkspaceMeta). */
export const CONTENT_LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-\d{3})?$/;

export const CreateWorkspaceRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(64),
  responsiveMode: z.enum(['desktop-first', 'mobile-first']).default('desktop-first'),
  /** Defaults to Desktop 1440 (desktop-first) or Mobile 375 (mobile-first). */
  primaryFrame: z.union([PresetSchema, FrameSchema]).optional(),
  /** Defaults to the interface language: vi → vi-VN, en → en-US. */
  contentLocale: z.string().regex(CONTENT_LOCALE_PATTERN).optional(),
  darkMode: z.enum(['none', 'media', 'class']).default('none'),
});
/** What a client sends. */
export type CreateWorkspaceRequest = z.input<typeof CreateWorkspaceRequestSchema>;
/** After parsing, with defaults applied. */
export type ParsedCreateWorkspaceRequest = z.output<typeof CreateWorkspaceRequestSchema>;

/** The primary frame a request asks for, or the default of its responsive mode. */
export function resolvePrimaryFrame(
  mode: ResponsiveMode,
  choice: FramePreset | Frame | undefined,
): Frame {
  const picked = choice ?? (mode === 'desktop-first' ? 'desktop-1440' : 'mobile-375');
  return typeof picked === 'string' ? FRAME_PRESETS[picked] : picked;
}

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
