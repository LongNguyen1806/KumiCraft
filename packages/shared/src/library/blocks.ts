// Library blocks catalog and type definitions (SPEC-04, TK-45, K9.7-3).
import { ADVANCED_BLOCKS } from './blocks-advanced.ts';
import { BASIC_BLOCKS } from './blocks-basic.ts';
import { CONTENT_DISPLAY_EXTRA_BLOCKS } from './blocks-content-display.ts';
import { DATA_LIBRARY_BLOCKS } from './blocks-data.ts';
import { FORM_EXTRA_LIBRARY_BLOCKS } from './blocks-form-extra.ts';
import { INTERACTIVE_LIBRARY_BLOCKS } from './blocks-interactive.ts';
import { LANDING_A_LIBRARY_BLOCKS } from './blocks-landing-a.ts';
import { LANDING_B_LIBRARY_BLOCKS } from './blocks-landing-b.ts';
import { NAVIGATION_LIBRARY_BLOCKS } from './blocks-navigation.ts';
import { SCREEN_LIBRARY_BLOCKS } from './blocks-screen.ts';
import type { LibraryBlock } from './types.ts';

export * from './data-generators.ts';
export * from './fonts.ts';
export * from './palette.ts';
export * from './project-look.ts';
export * from './render-block.ts';
export type {
  LibraryBlock,
  LibraryBlockCategory,
  LibraryBlockVariant,
  NeutralBlock,
} from './types.ts';
export { LIBRARY_CATEGORIES } from './types.ts';
export { supportsUiKitBlock } from './ui-kit-blocks.ts';

export const LIBRARY_BLOCKS: readonly LibraryBlock[] = [
  ...BASIC_BLOCKS,
  ...CONTENT_DISPLAY_EXTRA_BLOCKS,
  ...FORM_EXTRA_LIBRARY_BLOCKS,
  ...NAVIGATION_LIBRARY_BLOCKS,
  ...INTERACTIVE_LIBRARY_BLOCKS,
  ...DATA_LIBRARY_BLOCKS,
  ...ADVANCED_BLOCKS,
  ...LANDING_A_LIBRARY_BLOCKS,
  ...LANDING_B_LIBRARY_BLOCKS,
  ...SCREEN_LIBRARY_BLOCKS,
];
