import { expect, type FrameLocator, type Page } from '@playwright/test';

export async function trustIfAsked(tab: Page): Promise<void> {
  const confirmBtn = tab.getByRole('button', { name: 'Tin cậy dự án này' });
  try {
    await confirmBtn.click({ timeout: 10_000 });
    await expect(confirmBtn).toHaveCount(0, { timeout: 10_000 });
    return;
  } catch {
    // Confirm button not directly clickable, check review button
  }
  const reviewBtn = tab.getByRole('button', { name: 'Xem và tin cậy' });
  try {
    await reviewBtn.click({ timeout: 3_000 });
    await confirmBtn.click();
    await expect(confirmBtn).toHaveCount(0, { timeout: 10_000 });
  } catch {
    // Prompt did not appear
  }
}

export async function getCanvasFrame(tab: Page): Promise<FrameLocator> {
  const iframeLocator = tab.locator('iframe[data-testid="canvas-iframe"]');
  await expect(iframeLocator).toBeVisible({ timeout: 20_000 });
  return tab.frameLocator('iframe[data-testid="canvas-iframe"]');
}
