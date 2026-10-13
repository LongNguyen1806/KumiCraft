import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, type FrameLocator, type Page, test } from '@playwright/test';
import { type DesignDocument, documentToFiles } from '@reactcraft/model';

import allNodesFixture from '../fixtures/designs/all-nodes.json' with { type: 'json' };
import { openCanvasStudio } from './support/canvas-studio.ts';
import { type CliSession, startCli } from './support/cli-session.ts';
import { makeTempDir } from './support/copy-fixture.ts';

const SAMPLE =
  'Việt Nam có năm mươi tư dân tộc anh em. Mùa thu Hà Nội thật đẹp, lá vàng rơi trên phố cổ. ' +
  'Những người thợ thủ công khéo léo đã giữ gìn nghề truyền thống qua bao thế hệ. Ước mơ của tuổi trẻ luôn rực rỡ.';

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const statesOf = (word: string) => [
  ...Array.from(word, (_char, i) => plain(word.slice(0, i + 1))),
  word,
];

const selectAllKey = (browserName: string) =>
  browserName === 'webkit' ? 'Meta+a' : 'ControlOrMeta+a';
const undoKey = (browserName: string) => (browserName === 'webkit' ? 'Meta+z' : 'ControlOrMeta+z');
const redoKey = (browserName: string) =>
  browserName === 'webkit' ? 'Meta+Shift+z' : 'ControlOrMeta+Shift+z';

let workspace: { path: string; remove: () => Promise<void> };
let config: { path: string; remove: () => Promise<void> };
const sessions: CliSession[] = [];

const start = async (): Promise<CliSession> => {
  const session = await startCli(workspace.path, config.path);
  sessions.push(session);
  return session;
};

async function setupWorkspaceForTextEdit(): Promise<void> {
  const doc = structuredClone(allNodesFixture) as unknown as DesignDocument;
  const homePage = doc.pages['p_home000001'];
  if (homePage?.root.children !== undefined) {
    homePage.root.children.unshift({
      id: 'n_txt_stack1',
      type: 'Stack',
      content: { kind: 'none' },
      style: {
        direction: 'column',
        padding: { top: { px: 20 }, right: { px: 20 }, bottom: { px: 20 }, left: { px: 20 } },
      },
      children: [
        {
          id: 'n_btn_sample',
          type: 'Button',
          content: {
            kind: 'button',
            text: 'Original Button',
            buttonType: 'button',
            variant: 'primary',
          },
          style: {},
          children: [],
        },
        {
          id: 'n_lnk_sample',
          type: 'Link',
          content: { kind: 'link', text: 'Original Link', href: 'https://example.com' },
          style: {},
          children: [],
        },
        {
          id: 'n_hdg_sample',
          type: 'Heading',
          content: { kind: 'heading', level: 2, text: 'Original Heading' },
          style: {},
          children: [],
        },
        {
          id: 'n_txt_sample',
          type: 'Text',
          content: { kind: 'text', as: 'p', text: 'Original Paragraph' },
          style: {},
          children: [],
        },
        {
          id: 'n_det_sample',
          type: 'DetailView',
          content: {
            kind: 'detail',
            loadingText: 'Đang tải',
            errorText: 'Lỗi',
            notFoundText: 'Không thấy',
          },
          style: {},
          bindings: {
            record: {
              source: 'ds_products',
              endpoint: 'ep_detl000001',
            },
          },
          children: [
            {
              id: 'n_txt_bound1',
              type: 'Text',
              content: { kind: 'text', as: 'p', text: 'Bound Text' },
              style: {},
              bindings: {
                text: {
                  source: 'ds_products',
                  field: 'name',
                },
              },
              children: [],
            },
          ],
        },
        {
          id: 'n_txt_runs01',
          type: 'Text',
          content: {
            kind: 'text',
            as: 'p',
            text: 'Formatted Text',
            runs: [{ text: 'Formatted Text', bold: true }],
          },
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
  test.setTimeout(60000);
  workspace = await makeTempDir(`canvas-text-${browserName}`);
  config = await makeTempDir(`canvas-text-config-${browserName}`);
  await setupWorkspaceForTextEdit();
});

test.afterEach(async () => {
  for (const session of sessions.splice(0)) await session.stop();
  await workspace.remove();
  await config.remove();
});

test('1. double click Button, Link, Heading, Text -> edit -> Enter -> text changes, Undo and Redo work', async ({
  page,
  browserName,
}) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  // Edit Button
  const btn = canvas.locator('[data-rc-node="n_btn_sample"]');
  await expect(btn).toBeVisible();
  await btn.dblclick();
  await tab.keyboard.type('Updated Button');
  await tab.keyboard.press('Enter');
  await expect(btn).toHaveText('Updated Button');

  // Single Undo reverts back to original
  await tab.keyboard.press(undoKey(browserName));
  await expect(btn).toHaveText('Original Button');

  // Redo reapplies updated text
  await tab.keyboard.press(redoKey(browserName));
  await expect(btn).toHaveText('Updated Button');

  // Edit Text
  const txt = canvas.locator('[data-rc-node="n_txt_sample"]');
  await txt.dblclick();
  await tab.keyboard.type('Updated Paragraph');
  await tab.keyboard.press('Enter');
  await expect(txt).toHaveText('Updated Paragraph');

  // Edit Heading
  const hdg = canvas.locator('[data-rc-node="n_hdg_sample"]');
  await hdg.dblclick();
  await tab.keyboard.type('Updated Heading');
  await tab.keyboard.press('Enter');
  await expect(hdg).toHaveText('Updated Heading');

  // Edit Link
  const lnk = canvas.locator('[data-rc-node="n_lnk_sample"]');
  await lnk.dblclick();
  await tab.keyboard.type('Updated Link');
  await tab.keyboard.press('Enter');
  await expect(lnk).toHaveText('Updated Link');
});

test('2. Escape cancels editing and blur (click outside) commits editing', async ({ page }) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  // Escape cancels
  const btn = canvas.locator('[data-rc-node="n_btn_sample"]');
  await btn.dblclick();
  await tab.keyboard.type('Cancelled Text');
  await tab.keyboard.press('Escape');
  await expect(btn).toHaveText('Original Button');

  // Click outside (blur) commits
  const txt = canvas.locator('[data-rc-node="n_txt_sample"]');
  await txt.dblclick();
  await tab.keyboard.type('Blurred Text');
  // Click on another element or canvas
  await btn.click();
  await expect(txt).toHaveText('Blurred Text');
});

test('3. Shift+Enter in Text creates newline; in Button does not create newline', async ({
  page,
  browserName,
}) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  // Text allows Shift+Enter
  const txt = canvas.locator('[data-rc-node="n_txt_sample"]');
  await txt.dblclick();
  await tab.keyboard.press(selectAllKey(browserName));
  await tab.keyboard.type('Line 1');
  await tab.keyboard.press('Shift+Enter');
  await tab.keyboard.type('Line 2');
  await tab.keyboard.press('Enter');
  await expect(txt).toContainText('Line 1');
  await expect(txt).toContainText('Line 2');

  // Button strips newlines
  const btn = canvas.locator('[data-rc-node="n_btn_sample"]');
  await btn.dblclick();
  await tab.keyboard.press(selectAllKey(browserName));
  await tab.keyboard.type('BtnLine1');
  await tab.keyboard.press('Shift+Enter');
  await tab.keyboard.type('BtnLine2');
  await tab.keyboard.press('Enter');
  await expect(btn).toHaveText('BtnLine1BtnLine2');
});

test('4. Nodes with runs or bindings show status hint and cannot be edited', async ({ page }) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  // Bound node (n_txt_bound1 has text binding to ds_products)
  const boundNode = canvas.locator('[data-rc-node="n_txt_bound1"]');
  await boundNode.dblclick();
  await expect(tab.getByTestId('text-edit-status')).toBeVisible();
  await expect(tab.getByTestId('text-edit-status')).toContainText(/dữ liệu|data/i);

  // Formatted node (n_txt_runs01 has runs)
  const runsNode = canvas.locator('[data-rc-node="n_txt_runs01"]');
  await runsNode.dblclick();
  await expect(tab.getByTestId('text-edit-status')).toBeVisible();
  await expect(tab.getByTestId('text-edit-status')).toContainText(/định dạng|formatted/i);
});

test('5. Pasting HTML content strips HTML and only inserts plain text', async ({
  page,
  browserName,
}) => {
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const txt = canvas.locator('[data-rc-node="n_txt_sample"]');
  await txt.dblclick();
  await tab.keyboard.press(selectAllKey(browserName));

  // Simulate pasting HTML via dispatchEvent in the iframe
  await txt.evaluate((el) => {
    const data = new DataTransfer();
    data.setData('text/html', '<b>Bold</b> <a href="https://example.com">Link</a>');
    data.setData('text/plain', 'Bold Link');
    const evt = new CustomEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'clipboardData', { value: data });
    el.dispatchEvent(evt);
  });

  await tab.keyboard.press('Enter');
  await expect(txt).toHaveText('Bold Link');
  // Confirm no <b> or <a> elements were inserted
  const tagCount = await txt.locator('b, a').count();
  expect(tagCount).toBe(0);
});

test('6. Editing same node twice consecutively, then Undo/Redo produces no console errors', async ({
  page,
  browserName,
}) => {
  const session = await start();
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const btn = canvas.locator('[data-rc-node="n_btn_sample"]');
  // First edit
  await btn.dblclick();
  await tab.keyboard.type('Edit 1');
  await tab.keyboard.press('Enter');
  await expect(btn).toHaveText('Edit 1');

  // Second edit immediately on same node
  await btn.dblclick();
  await tab.keyboard.type('Edit 2');
  await tab.keyboard.press('Enter');
  await expect(btn).toHaveText('Edit 2');

  // Undo twice
  await tab.keyboard.press(undoKey(browserName));
  await expect(btn).toHaveText('Edit 1');
  await tab.keyboard.press(undoKey(browserName));
  await expect(btn).toHaveText('Original Button');

  // Redo twice
  await tab.keyboard.press(redoKey(browserName));
  await expect(btn).toHaveText('Edit 1');
  await tab.keyboard.press(redoKey(browserName));
  await expect(btn).toHaveText('Edit 2');

  expect(errors).toEqual([]);
});

test('7. Typing Vietnamese Unikey style simulation in Text node', async ({ page, browserName }) => {
  // Harness time, not a budget: 200 characters typed key by key are slow in WebKit under load.
  test.setTimeout(browserName === 'webkit' ? 240_000 : 90_000);
  const session = await start();
  const tab = await openStudio(page, session);
  const canvas = getCanvasFrame(tab);

  const txt = canvas.locator('[data-rc-node="n_txt_sample"]');
  await txt.dblclick();
  await tab.keyboard.press(selectAllKey(browserName));

  // Simulate typing Vietnamese with backspaces
  const words = SAMPLE.split(' ');
  for (const [w, word] of words.entries()) {
    let screen = '';
    for (const state of statesOf(word)) {
      let common = 0;
      while (common < screen.length && screen[common] === state[common]) common++;
      for (let i = common; i < screen.length; i++) await tab.keyboard.press('Backspace');
      if (state.length > common) await tab.keyboard.type(state.slice(common));
      screen = state;
    }
    if (w < words.length - 1) await tab.keyboard.type(' ');
  }

  await tab.keyboard.press('Enter');
  await expect(txt).toHaveText(SAMPLE);

  // If Chromium: also verify CDP composition method
  if (browserName === 'chromium') {
    await txt.dblclick();
    await tab.keyboard.press(selectAllKey(browserName));

    const cdp = await tab.context().newCDPSession(tab);
    for (const [w, word] of words.entries()) {
      for (const state of statesOf(word).slice(0, -1)) {
        await cdp.send('Input.imeSetComposition', {
          text: state,
          selectionStart: state.length,
          selectionEnd: state.length,
        });
      }
      await cdp.send('Input.insertText', { text: word });
      if (w < words.length - 1) await tab.keyboard.type(' ');
    }

    await tab.keyboard.press('Enter');
    await expect(txt).toHaveText(SAMPLE);
  }
});
