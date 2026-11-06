// Monorepo (Phase 4 K5, spec-log #81): a repo whose root is not an app, shaped like MarketLink,
// lists the apps inside it; the React + Vite one opens with its packages hoisted to the workspace
// root (no install asked), and Create React App or Next.js say why they do not open.
import { expect, test } from '@playwright/test';

import { type CliSession, startCli } from './support/cli-session.ts';
import { copyFixture, makeTempDir, type TempDir } from './support/copy-fixture.ts';
import { getCanvasFrame, trustIfAsked } from './support/trust.ts';
import { ui } from './support/ui-text.ts';

let folder: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

test.beforeEach(async ({ browserName }) => {
  folder = await copyFixture('projects/monorepo-apps');
  config = await makeTempDir(`monorepo-config-${browserName}`);
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await folder.remove();
  await config.remove();
});

test('a repo root lists its apps; the Vite app opens with hoisted packages, the others say why not [K5]', async ({
  page,
}) => {
  const session = await startCli(folder.path, config.path);
  sessions.push(session);
  await page.goto(session.studioUrl);

  // The root is not an app: the Studio asks which one to open instead of "not a project".
  await expect(page.getByRole('heading', { name: ui('noProject.title') })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId('no-project-open-btn').click();
  await expect(page.getByTestId('app-candidate-frontend')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('not-project-msg')).toHaveCount(0);

  // Apps KumiCraft 1.0 does not run are listed with the reason and no Open button.
  await expect(page.getByTestId('app-candidate-legacy-cra')).toContainText('Create React App');
  await expect(page.getByTestId('app-candidate-open-legacy-cra')).toHaveCount(0);
  await expect(page.getByTestId('app-candidate-next-site')).toContainText('Next.js');
  await expect(page.getByTestId('app-candidate-open-next-site')).toHaveCount(0);
  // A backend with no web framework is not an app to design.
  await expect(page.getByTestId('app-candidate-backend')).toHaveCount(0);

  await page.getByTestId('app-candidate-open-frontend').click();
  await trustIfAsked(page);

  // Its packages live in the workspace root's node_modules only: no install is asked for.
  const canvas = await getCanvasFrame(page);
  await expect(canvas.getByRole('heading', { name: 'Ứng dụng trong monorepo' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('install-dialog')).toHaveCount(0);
});
