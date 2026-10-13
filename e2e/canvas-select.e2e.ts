// E2E test verifying Canvas overlay hover, single, and multiple selection (M-OV, SPEC-04.1 section 8)
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, type FrameLocator, type Page, test } from '@playwright/test';
import { type DesignDocument, documentToFiles } from '@reactcraft/model';

import allNodesFixture from '../fixtures/designs/all-nodes.json' with { type: 'json' };
import { openCanvasStudio } from './support/canvas-studio.ts';
import { type CliSession, startCli } from './support/cli-session.ts';
import { makeTempDir, type TempDir } from './support/copy-fixture.ts';

let workspace: TempDir;
let config: TempDir;
const sessions: CliSession[] = [];

const start = async () => {
  const session = await startCli(workspace.path, config.path);
  sessions.push(session);
  return session;
};

async function setupWorkspaceWithNestedNodes(): Promise<void> {
  const doc = structuredClone(allNodesFixture) as unknown as DesignDocument;
  const homePage = doc.pages['p_home000001'];
  if (homePage?.root.children !== undefined) {
    homePage.root.children.unshift({
      id: 'n_box_level1',
      type: 'Stack',
      content: { kind: 'none' },
      style: {
        padding: { top: { px: 24 }, right: { px: 24 }, bottom: { px: 24 }, left: { px: 24 } },
        background: '#f1f5f9',
      },
      children: [
        {
          id: 'n_box_level2',
          type: 'Stack',
          content: { kind: 'none' },
          style: {
            padding: { top: { px: 24 }, right: { px: 24 }, bottom: { px: 24 }, left: { px: 24 } },
            background: '#e2e8f0',
          },
          children: [
            {
              id: 'n_btn_level3',
              type: 'Button',
              content: {
                kind: 'button',
                text: 'Drilldown Target',
                buttonType: 'button',
                variant: 'primary',
              },
              style: {},
              children: [],
            },
          ],
        },
      ],
    });
  }

  const files = documentToFiles(doc);
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(workspace.path, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
  }
}

const openStudio = openCanvasStudio;

function getCanvasFrame(page: Page): FrameLocator {
  return page.frameLocator('[data-testid="canvas-iframe"]');
}

test.beforeEach(async ({ browserName }) => {
  workspace = await makeTempDir(`canvas-select-${browserName}`);
  config = await makeTempDir(`canvas-select-config-${browserName}`);
  await setupWorkspaceWithNestedNodes();
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await workspace.remove();
  await config.remove();
});

test('1. hover displays hover-box with bounding dimensions matching element [R-OV-01]', async ({
  page,
}) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const target = canvas.locator('[data-rc-node="n_btn_level3"]');
  await expect(target).toBeVisible();

  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  if (!targetBox) return;

  await target.hover();

  const hoverBox = tab.locator('[data-testid="hover-box"]');
  await expect(hoverBox).toBeVisible();

  const overlayBox = await hoverBox.boundingBox();
  expect(overlayBox).not.toBeNull();
  if (!overlayBox) return;

  expect(Math.abs(overlayBox.width - targetBox.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(overlayBox.height - targetBox.height)).toBeLessThanOrEqual(2);
});

test('2. 3-level click drill-down selects level 1, then level 2, then level 3 [R-OV-01, R-OV-02]', async ({
  page,
}) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const target = canvas.locator('[data-rc-node="n_btn_level3"]');
  await expect(target).toBeVisible();

  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  if (!targetBox) return;

  const clickX = targetBox.x + targetBox.width / 2;
  const clickY = targetBox.y + targetBox.height / 2;

  // Click 1: selects level 1 parent under root [R-OV-01]
  await tab.mouse.click(clickX, clickY);
  await expect(
    tab.locator('[data-testid="selection-box"][data-node-id="n_box_level1"]'),
  ).toBeVisible();

  // Click 2: selects level 2 parent [R-OV-02]
  await tab.mouse.click(clickX, clickY);
  await expect(
    tab.locator('[data-testid="selection-box"][data-node-id="n_box_level2"]'),
  ).toBeVisible();

  // Click 3: selects innermost target
  await tab.mouse.click(clickX, clickY);
  await expect(
    tab.locator('[data-testid="selection-box"][data-node-id="n_btn_level3"]'),
  ).toBeVisible();
});

test('3. deep click (Ctrl/Meta) directly selects deepest node, Shift multi-selects', async ({
  page,
}) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const target = canvas.locator('[data-rc-node="n_btn_level3"]');
  await expect(target).toBeVisible();

  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  if (!targetBox) return;

  // Ctrl+Click directly selects the innermost button
  await tab.keyboard.down('Control');
  await tab.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await tab.keyboard.up('Control');
  await expect(
    tab.locator('[data-testid="selection-box"][data-node-id="n_btn_level3"]'),
  ).toBeVisible();

  // Shift+Click on another node adds it to selection
  const linkNode = canvas.locator('[data-rc-node="n_allnode008"]');
  const linkBox = await linkNode.boundingBox();
  expect(linkBox).not.toBeNull();
  if (!linkBox) return;

  await tab.keyboard.down('Shift');
  await tab.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
  await tab.keyboard.up('Shift');

  await expect(
    tab.locator('[data-testid="selection-box"][data-node-id="n_btn_level3"]'),
  ).toBeVisible();
  await expect(
    tab.locator('[data-testid="selection-box"][data-node-id="n_allnode010"]'),
  ).toBeVisible();
  await expect(tab.locator('[data-testid="selection-bounding-box"]')).toBeVisible();
  await expect(tab.locator('[data-testid="breadcrumb"]')).toContainText(/phần tử|item/i);

  // Shift+Click again to toggle off
  await tab.keyboard.down('Shift');
  await tab.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
  await tab.keyboard.up('Shift');
  await expect(
    tab.locator('[data-testid="selection-box"][data-node-id="n_allnode010"]'),
  ).toHaveCount(0);
});

test('4. clicking canvas backdrop or pressing Escape deselects', async ({ page }) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const target = canvas.locator('[data-rc-node="n_btn_level3"]');
  await expect(target).toBeVisible();

  const targetBox = await target.boundingBox();
  if (!targetBox) return;

  // Select target with Ctrl+Click
  await tab.keyboard.down('Control');
  await tab.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await tab.keyboard.up('Control');
  await expect(tab.locator('[data-testid="selection-box"]')).toHaveCount(1);

  // Click canvas background outside frame
  await tab.locator('[data-testid="editor"]').click({ position: { x: 10, y: 10 } });
  await expect(tab.locator('[data-testid="selection-box"]')).toHaveCount(0);

  // Select again, then press Escape
  await tab.keyboard.down('Control');
  await tab.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await tab.keyboard.up('Control');
  await expect(tab.locator('[data-testid="selection-box"]')).toHaveCount(1);

  await tab.keyboard.press('Escape');
  await expect(tab.locator('[data-testid="selection-box"]')).toHaveCount(0);
});

test('5. clicking link or button in design selects without navigation', async ({ page }) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const initialUrl = tab.url();
  const linkNode = canvas.locator('[data-rc-node="n_allnode008"]');
  await expect(linkNode).toBeVisible();

  const linkBox = await linkNode.boundingBox();
  if (!linkBox) return;

  await tab.keyboard.down('Control');
  await tab.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
  await tab.keyboard.up('Control');

  await expect(
    tab.locator('[data-testid="selection-box"][data-node-id="n_allnode008"]'),
  ).toBeVisible();
  expect(tab.url()).toBe(initialUrl);
});

test('6. two-way sync with Layer Tree', async ({ page }) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const target = canvas.locator('[data-rc-node="n_btn_level3"]');
  await expect(target).toBeVisible();
  const targetBox = await target.boundingBox();
  if (!targetBox) return;

  // Select on Canvas -> row in Layer tree is selected
  await tab.keyboard.down('Control');
  await tab.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await tab.keyboard.up('Control');

  const layerRow = tab.locator('[role="treeitem"][aria-selected="true"]');
  await expect(layerRow).toBeVisible();

  // Select another node from Layer tree -> overlay updates
  const navbarRow = tab.locator('[role="treeitem"]:has-text("Top bar")');
  await navbarRow.click();
  await expect(
    tab.locator('[data-testid="selection-box"][data-node-id="n_allnode010"]'),
  ).toBeVisible();
});
