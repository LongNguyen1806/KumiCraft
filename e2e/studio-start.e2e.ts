// Startup of the Studio on the built CLI: name, version, language switch and the session token (SPEC-05 S-05 to S-07).
import { expect, test } from './support/studio-server.ts';
import { ui } from './support/ui-text.ts';

type ReloadMarker = { reloadMarker?: boolean };

test('opens the Studio with its name and version and hides the token [S-05, S-06]', async ({
  page,
  studio,
}) => {
  await page.goto(studio.studioUrl);

  await expect(page.getByText('KumiCraft', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: ui('noProject.title') })).toBeVisible();
  await expect(page.getByTestId('studio-version')).toHaveText(/^Phiên bản \d+\.\d+\.\d+/);
  expect(page.url()).not.toContain('#t=');
});

test('switches between Vietnamese and English without reloading', async ({ page, studio }) => {
  await page.goto(studio.studioUrl);
  await expect(page.getByTestId('studio-version')).toHaveText(/^Phiên bản/);
  await page.evaluate(() => {
    (window as ReloadMarker).reloadMarker = true;
  });

  await page.getByTestId('language-select').selectOption('en');

  await expect(page.getByTestId('studio-version')).toHaveText(/^Version /);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.evaluate(() => (window as ReloadMarker).reloadMarker)).toBe(true);
});

test('reports an invalid session when opened without the token [S-07]', async ({
  page,
  studio,
}) => {
  await page.goto(studio.origin);

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('E014');
  await expect(alert).toContainText('Phiên không hợp lệ');
});

test('keeps the token out of other tabs [S-06]', async ({ context, studio }) => {
  const first = await context.newPage();
  await first.goto(studio.studioUrl);
  await expect(first.getByTestId('studio-version')).toBeVisible();

  const second = await context.newPage();
  await second.goto(studio.origin);

  await expect(second.getByRole('alert')).toContainText('E014');
});
