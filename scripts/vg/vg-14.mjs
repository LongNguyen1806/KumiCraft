// VG-14 (SPEC-01.2 section 13): TipTap inside the Canvas iframe. Mounts and removes the editor at
// zoom 50 / 100 / 200 %, types a 200-character Vietnamese passage the way Unikey and EVKey send it
// (backspaces, then the accented letters) and the way system input methods do (composition,
// Chromium only), pastes from Word and from a web page. Chromium, Firefox and WebKit.
// The runs ⇄ document roundtrip (1,000 samples) is a unit test: features/canvas/rich-text.
// Run with: node scripts/vg/vg-14.mjs
/* global document, location, URLSearchParams, window */
import { chromium, firefox, webkit } from '@playwright/test';

import { buildSpikes, serveSpikes } from './spike-server.mjs';

const SAMPLE =
  'Việt Nam có năm mươi tư dân tộc anh em. Mùa thu Hà Nội thật đẹp, lá vàng rơi trên phố cổ. ' +
  'Những người thợ thủ công khéo léo đã giữ gìn nghề truyền thống qua bao thế hệ. Ước mơ của tuổi trẻ luôn rực rỡ.';

const ALLOWED_NODES = new Set(['doc', 'paragraph', 'text', 'hardBreak']);
const ALLOWED_MARKS = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'textStyle',
]);

const WORD_HTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{mso-style-unhide:no}</style></head><body>
<h1 class="MsoTitle">Tiêu đề Word</h1>
<p class="MsoNormal"><b>Đậm</b> <i>nghiêng</i> <u>gạch dưới</u> <span style="color:rgb(239,68,68);font-family:Calibri;mso-bidi-font-family:Arial">màu đỏ</span><o:p></o:p></p>
<table class="MsoTableGrid"><tr><td>ô bảng</td></tr></table>
<p><img src="file:///C:/a.png"><a href="javascript:alert(1)">xấu</a> <a href="https://shop.vn">tốt</a></p>
<script>alert(1)</script></body></html>`;

const WEB_HTML = `<meta charset="utf-8"><b style="font-weight:normal" id="docs-internal-guid-1"><p dir="ltr">
<span style="font-weight:700">Đậm web</span><span style="font-style:italic"> nghiêng</span></p>
<ul><li>mục một</li></ul><h2>Tiêu đề phụ</h2><mark>đánh dấu</mark> <span style="text-decoration:line-through">gạch</span>
<iframe src="https://evil.example"></iframe><button onclick="alert(1)">nút</button></b>`;

/** Unaccented form of a prefix: what is on screen before the input method adds the marks. */
const plain = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

/** Screen states while typing `word`: its plain prefixes, then the word itself. */
const statesOf = (word) => [...Array.from(word, (_char, i) => plain(word.slice(0, i + 1))), word];

const pause = (page, ms = 40) => page.waitForTimeout(ms);

/** Double-clicks the text node inside the scaled iframe. */
async function openEditor(page) {
  const point = await page.evaluate(() => {
    const frame = document.querySelector('iframe');
    const zoom = Number(new URLSearchParams(location.search).get('zoom') ?? '1');
    const outer = frame.getBoundingClientRect();
    const box = frame.contentDocument
      .querySelector('[data-rc-node="text-1"]')
      .getBoundingClientRect();
    return {
      x: outer.left + (box.left + box.width / 2) * zoom,
      y: outer.top + (box.top + box.height / 2) * zoom,
    };
  });
  await page.mouse.dblclick(point.x, point.y);
  await pause(page, 150);
}

async function load(page, origin, zoom) {
  await page.goto(`${origin}/vg-14/index.html?zoom=${String(zoom)}`);
  await page.waitForFunction(() => window.__vg14?.ready === true);
}

async function clearEditor(page) {
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await pause(page);
}

/** Mount on double-click, type, Esc removes the editor and keeps the text. */
async function runMount(page, origin) {
  const results = [];
  for (const zoom of [0.5, 1, 2]) {
    await load(page, origin, zoom);
    await openEditor(page);
    const opened = await page.evaluate(() => window.__vg14.state());
    await page.keyboard.type(' abc', { delay: 20 });
    await page.keyboard.press('Escape');
    await pause(page, 100);
    const closed = await page.evaluate(() => ({
      ...window.__vg14.state(),
      runs: window.__vg14.runs,
    }));
    const text = closed.runs.map((run) => run.text).join('');
    results.push(opened.mounted && opened.focused && !closed.mounted && text === 'Xin chào abc');
  }
  return results.filter(Boolean).length;
}

/** Unikey / EVKey: each accent is sent as backspaces plus the new letters. */
async function runBackspaceInput(page, origin) {
  await load(page, origin, 1);
  await openEditor(page);
  await clearEditor(page);
  const words = SAMPLE.split(' ');
  for (const [w, word] of words.entries()) {
    let screen = '';
    for (const state of statesOf(word)) {
      let common = 0;
      while (common < screen.length && screen[common] === state[common]) common++;
      for (let i = common; i < screen.length; i++) await page.keyboard.press('Backspace');
      if (state.length > common) await page.keyboard.type(state.slice(common));
      screen = state;
    }
    if (w < words.length - 1) await page.keyboard.type(' ');
  }
  await pause(page, 100);
  return (await page.evaluate(() => window.__vg14.state().text)) === SAMPLE;
}

/** macOS and Microsoft input methods: the word is composed, then committed (Chromium only). */
async function runComposition(page, origin) {
  await load(page, origin, 1);
  await openEditor(page);
  await clearEditor(page);
  const cdp = await page.context().newCDPSession(page);
  const words = SAMPLE.split(' ');
  for (const [w, word] of words.entries()) {
    for (const state of statesOf(word).slice(0, -1)) {
      await cdp.send('Input.imeSetComposition', {
        text: state,
        selectionStart: state.length,
        selectionEnd: state.length,
      });
    }
    await cdp.send('Input.insertText', { text: word });
    if (w < words.length - 1) await page.keyboard.type(' ');
  }
  await pause(page, 100);
  return (await page.evaluate(() => window.__vg14.state().text)) === SAMPLE;
}

/** Only allowed nodes and marks survive; unsafe links and colours the model refuses are dropped. */
async function runPaste(page, origin) {
  await load(page, origin, 1);
  await openEditor(page);
  const word = await page.evaluate((html) => window.__vg14.paste(html), WORD_HTML);
  const web = await page.evaluate((html) => window.__vg14.paste(html), WEB_HTML);
  const clean = (result) =>
    result.nodes.every((node) => ALLOWED_NODES.has(node)) &&
    result.marks.every((mark) => ALLOWED_MARKS.has(mark));
  const text = (result) => result.runs.map((run) => run.text).join('');
  const has = (result, part, check) =>
    result.runs.some((run) => run.text.includes(part) && check(run));
  const wordOk =
    clean(word) &&
    has(word, 'Đậm', (run) => run.bold === true) &&
    has(word, 'nghiêng', (run) => run.italic === true) &&
    has(word, 'gạch dưới', (run) => run.underline === true) &&
    has(word, 'màu đỏ', (run) => run.color === '#ef4444') &&
    has(word, 'tốt', (run) => run.link?.href === 'https://shop.vn') &&
    !has(word, 'xấu', (run) => run.link !== undefined) &&
    !text(word).includes('alert');
  const webOk =
    clean(web) &&
    has(web, 'Đậm web', (run) => run.bold === true) &&
    has(web, 'nghiêng', (run) => run.italic === true) &&
    has(web, 'gạch', (run) => run.strike === true) &&
    has(web, 'mục một', () => true) &&
    !has(web, 'Đậm web', (run) => run.text.includes('mục một') && run.bold === true);
  return { word: wordOk, web: webOk, detail: { word, web } };
}

async function main() {
  buildSpikes();
  const { server, origin } = await serveSpikes();
  const summary = [];
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    const page = await browser.newPage({
      viewport: { width: 2000, height: 1200 },
      locale: 'vi-VN',
    });
    const mount = await runMount(page, origin);
    const backspace = await runBackspaceInput(page, origin);
    const composition = engine === chromium ? await runComposition(page, origin) : 'n/a';
    const paste = await runPaste(page, origin);
    await browser.close();
    if (!paste.word || !paste.web) console.log(engine.name(), JSON.stringify(paste.detail));
    summary.push({
      browser: engine.name(),
      mount: `${String(mount)}/3`,
      unikey: backspace,
      ime: composition,
      word: paste.word,
      web: paste.web,
    });
  }
  server.close();
  console.table(summary);
  const passed = summary.every(
    (row) => row.mount === '3/3' && row.unikey && row.ime !== false && row.word && row.web,
  );
  console.log(`VG-14: ${passed ? 'PASSED' : 'FAILED'}`);
  if (!passed) process.exitCode = 1;
}

await main();
