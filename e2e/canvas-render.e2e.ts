// E2E test verifying Canvas rendering inside sandboxed iframe (M-CV, SPEC-04.1 section 7)
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

async function setupWorkspaceWithAllNodes(): Promise<void> {
  const doc = structuredClone(allNodesFixture) as unknown as DesignDocument;
  const homePage = doc.pages['p_home000001'];
  if (homePage?.root.children !== undefined) {
    homePage.root.children.push({
      id: 'n_form000001',
      type: 'Form',
      content: { kind: 'none' },
      style: {},
      children: [
        {
          id: 'n_inpt000001',
          type: 'Input',
          content: { kind: 'input', label: 'Email', inputType: 'text', fieldName: 'testEmail' },
          style: {},
          children: [],
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
  workspace = await makeTempDir(`canvas-${browserName}`);
  config = await makeTempDir(`canvas-config-${browserName}`);
  await setupWorkspaceWithAllNodes();
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await workspace.remove();
  await config.remove();
});

type FixtureNode = {
  readonly id: string;
  readonly type: string;
  readonly hidden?: boolean;
  readonly children?: readonly FixtureNode[];
};

/** Ids of the nodes that the Canvas must draw on the page: not hidden, not inside a closed Modal. */
function drawnIds(node: FixtureNode, into: string[] = []): string[] {
  if (node.hidden === true || node.type === 'Modal') return into;
  into.push(node.id);
  if (node.type === 'ComponentInstance' || node.type === 'Tabs') return into;
  for (const child of node.children ?? []) drawnIds(child, into);
  return into;
}

test('1. draws every visible node of the all-nodes page without console or page errors [R-CV-02]', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);
  const home = (allNodesFixture as unknown as DesignDocument).pages['p_home000001'];
  const ids = drawnIds(home?.root as unknown as FixtureNode);
  expect(ids.length).toBeGreaterThan(20);

  await expect(canvas.locator('[data-rc-node="n_allnode051"]')).toBeVisible();
  const drawn = await canvas
    .locator('[data-rc-node]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-rc-node')));
  expect(ids.filter((id) => !drawn.includes(id))).toEqual([]);
  await expect(canvas.locator('[data-rc-node="n_form000001"]')).toBeVisible();
  expect(errors).toHaveLength(0);
});

test('2. design CSS takes effect via the Tailwind runtime', async ({ page }) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const gridNode = canvas.locator('[data-rc-node="n_allnode026"]');
  await expect(gridNode).toBeVisible();

  const display = await gridNode.evaluate((el) => window.getComputedStyle(el).display);
  expect(display).toBe('grid');
});

test('3. the token colours reach the Canvas through a single @theme block [R-CV-07]', async ({
  page,
}) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  // n_allnode051 has background: token:color.surface (#ffffff); a missing @theme would leave it transparent.
  const rootNode = canvas.locator('[data-rc-node="n_allnode051"]');
  await expect(rootNode).toBeVisible();
  const background = await rootNode.evaluate((el) => window.getComputedStyle(el).backgroundColor);

  expect(background).toBe('rgb(255, 255, 255)');
  await expect(canvas.locator('style#rc-theme')).toHaveCount(1);
});

test('4. iframe dimensions match frame.width and auto-expands to content height without scrollbar', async ({
  page,
}) => {
  const session = await start();
  const tab = await openStudio(page, session);

  const iframe = tab.locator('[data-testid="canvas-iframe"]');
  await expect(iframe).toBeVisible();

  // Test true logical dimensions of the iframe element inside transform container
  const dimensions = await iframe.evaluate((el) => {
    const frameEl = el as HTMLIFrameElement;
    return {
      offsetWidth: frameEl.offsetWidth,
      offsetHeight: frameEl.offsetHeight,
      contentHeight: frameEl.contentDocument?.documentElement.scrollHeight ?? 0,
    };
  });

  expect(dimensions.offsetWidth).toBe(1440);
  expect(dimensions.offsetHeight).toBeGreaterThanOrEqual(900);

  // Check no scrollbar on iframe (contentHeight <= iframe height)
  expect(dimensions.contentHeight).toBeLessThanOrEqual(dimensions.offsetHeight + 2);
});

test('5. offline safe: renders styling when external requests are blocked', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!url.startsWith('http://127.0.0.1')) {
      await route.abort();
    } else {
      await route.continue();
    }
  });

  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const gridNode = canvas.locator('[data-rc-node="n_allnode026"]');
  await expect(gridNode).toBeVisible();
  const display = await gridNode.evaluate((el) => window.getComputedStyle(el).display);
  expect(display).toBe('grid');
});

test('6. a narrow window scales the frame down and keeps its proportions', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  const session = await start();
  const tab = await openStudio(page, session);

  const iframe = tab.locator('[data-testid="canvas-iframe"]');
  const natural = await iframe.evaluate((el) => ({
    width: (el as HTMLIFrameElement).offsetWidth,
    height: (el as HTMLIFrameElement).offsetHeight,
  }));
  const box = await iframe.boundingBox();

  expect(natural.width).toBe(1440);
  expect(box).not.toBeNull();
  const shown = box ?? { width: 0, height: 0 };
  expect(shown.width).toBeLessThan(natural.width);
  expect(shown.width).toBeGreaterThan(natural.width * 0.05);
  // Same scale on both axes (1 px of rounding).
  const scaleX = shown.width / natural.width;
  expect(Math.abs(shown.height - natural.height * scaleX)).toBeLessThanOrEqual(2);
});

test('7. link click and form submit are prevented without changing iframe URL', async ({
  page,
}) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const initialIframeUrl = await tab.evaluate(() => {
    const frameEl = document.querySelector('[data-testid="canvas-iframe"]') as HTMLIFrameElement;
    return frameEl.contentWindow?.location.href;
  });

  const link = canvas.locator('[data-rc-node="n_allnode008"]');
  await expect(link).toBeVisible();
  const clickWasPrevented = await link.evaluate((el) => {
    // dispatchEvent returns false when a listener called preventDefault().
    return !el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  expect(clickWasPrevented).toBe(true);
  await link.click();

  const postClickUrl = await tab.evaluate(() => {
    const frameEl = document.querySelector('[data-testid="canvas-iframe"]') as HTMLIFrameElement;
    return frameEl.contentWindow?.location.href;
  });
  expect(postClickUrl).toBe(initialIframeUrl);

  const form = canvas.locator('[data-rc-node="n_form000001"]');
  await expect(form).toBeVisible();
  const submitWasPrevented = await form.evaluate((f) => {
    let prevented = false;
    f.ownerDocument.addEventListener('submit', (event) => {
      prevented = event.defaultPrevented;
    });
    (f as HTMLFormElement).requestSubmit();
    return prevented;
  });
  expect(submitWasPrevented).toBe(true);

  const postSubmitUrl = await tab.evaluate(() => {
    const frameEl = document.querySelector('[data-testid="canvas-iframe"]') as HTMLIFrameElement;
    return frameEl.contentWindow?.location.href;
  });
  expect(postSubmitUrl).toBe(initialIframeUrl);
});

test('8. visual screenshot of all-nodes on frame 1440 and frame 375', async ({ page }) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  await expect(canvas.locator('[data-rc-node="n_allnode051"]')).toBeVisible();
  await mkdir('test-results/canvas', { recursive: true });

  // Settle time for Tailwind compilation
  await tab.waitForTimeout(600);

  // 1440 Desktop Screenshot
  await tab.screenshot({ path: 'test-results/canvas/all-nodes-1440.png', fullPage: true });

  // Switch to Mobile 375 frame
  const dialog = tab.locator('dialog[open]');
  if (await dialog.isVisible().catch(() => false)) {
    await tab.getByRole('button', { name: /Chưa|Not yet/i }).click();
    await expect(dialog).toHaveCount(0);
  }

  const mobileBtn = tab.getByRole('button', { name: 'Mobile 375' });
  await mobileBtn.click();
  await tab.waitForTimeout(600);
  await tab.screenshot({ path: 'test-results/canvas/all-nodes-375.png', fullPage: true });
});
