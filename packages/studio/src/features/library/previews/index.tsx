import type { JSX } from 'react';

import { PREVIEWS_BASIC } from './previews-basic.tsx';
import { PREVIEWS_DISPLAY_NAV } from './previews-display-nav.tsx';
import { PREVIEWS_INTERACTIVE } from './previews-interactive.tsx';
import { PREVIEWS_LANDING } from './previews-landing.tsx';
import { PREVIEWS_SCREEN } from './previews-screen.tsx';

export const BLOCK_PREVIEWS: Readonly<Record<string, () => JSX.Element>> = {
  ...PREVIEWS_BASIC,
  ...PREVIEWS_DISPLAY_NAV,
  ...PREVIEWS_INTERACTIVE,
  ...PREVIEWS_LANDING,
  ...PREVIEWS_SCREEN,
};

export function hasBlockPreview(blockId: string): boolean {
  return Object.hasOwn(BLOCK_PREVIEWS, blockId);
}

export function renderBlockPreview(blockId: string): JSX.Element | undefined {
  const renderer = Object.hasOwn(BLOCK_PREVIEWS, blockId) ? BLOCK_PREVIEWS[blockId] : undefined;
  return renderer !== undefined ? renderer() : undefined;
}
