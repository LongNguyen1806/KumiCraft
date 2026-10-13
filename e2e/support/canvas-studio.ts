// Opens the Studio on a workspace written as files (so it is not trusted yet) and waits until the
// Canvas is drawn with its styles, so tests measure and click the final layout.
import { expect, type FrameLocator, type Page } from '@playwright/test';

import type { CliSession } from './cli-session.ts';

export async function openCanvasStudio(page: Page, session: CliSession): Promise<Page> {
  const tab = await page.context().newPage();
  await tab.goto(session.studioUrl);

  // A workspace made outside the Studio always asks for trust once (S-80); answer it first,
  // otherwise the dialog can appear later and catch the next click.
  const trustDialog = tab.getByRole('dialog', { name: /tin tưởng|trust/i });
  await expect(trustDialog).toBeVisible();
  await tab.getByRole('button', { name: /^Chưa|^Not now/i }).click();
  await expect(trustDialog).toHaveCount(0);

  await expect(tab.getByTestId('frame')).toBeVisible();
  await expect(tab.locator('[data-testid="canvas-iframe"][data-rc-styled="1"]')).toBeAttached();
  return tab;
}

export function canvasFrame(page: Page): FrameLocator {
  return page.frameLocator('[data-testid="canvas-iframe"]');
}
