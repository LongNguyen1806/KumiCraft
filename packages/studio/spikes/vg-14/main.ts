// VG-14 spike (ADR-FE-20): TipTap mounted on a Text node inside the Canvas iframe on double-click,
// removed with Esc, at zoom 50 / 100 / 200 %. scripts/vg/vg-14.mjs drives it through
// `window.__vg14`. With `?manual=1` the page also checks text typed by hand with a real Vietnamese
// input method (Unikey, EVKey, macOS) against a sample passage.
import type { TextRun } from '@reactcraft/model';
import { Editor, type JSONContent } from '@tiptap/core';

import { richTextExtensions } from '../../src/features/canvas/rich-text/extensions.ts';
import { docToRuns, runsToDoc } from '../../src/features/canvas/rich-text/runs.ts';

type Probe = {
  ready: boolean;
  runs: TextRun[];
  /** Whether the editor is mounted inside the iframe and holds the keyboard focus. */
  state: () => { mounted: boolean; focused: boolean; text: string };
  close: () => void;
  /** Pastes HTML through the editor's own paste pipeline (what a real paste runs). */
  paste: (html: string) => { nodes: string[]; marks: string[]; runs: TextRun[] };
};

declare global {
  interface Window {
    __vg14: Probe;
  }
}

export const SAMPLE =
  'Việt Nam có năm mươi tư dân tộc anh em. Mùa thu Hà Nội thật đẹp, lá vàng rơi trên phố cổ. ' +
  'Những người thợ thủ công khéo léo đã giữ gìn nghề truyền thống qua bao thế hệ. Ước mơ của tuổi trẻ luôn rực rỡ.';

const ZOOM = Number(new URLSearchParams(location.search).get('zoom') ?? '1');
const CANVAS = `<!doctype html><html><head><style>
body { font: 16px system-ui, sans-serif; padding: 24px; margin: 0; }
[data-rc-node] { padding: 8px; border: 1px dashed #cbd5e1; margin-bottom: 12px; min-height: 24px; }
.ProseMirror { outline: 2px solid #6d3fe0; white-space: pre-wrap; }
</style></head><body>
<div data-rc-node="heading-1" style="font-size: 28px; font-weight: 700">Tiêu đề</div>
<p data-rc-node="text-1">Xin chào</p>
</body></html>`;

let editor: Editor | undefined;
let runs: TextRun[] = [{ text: 'Xin chào' }];

const frame = document.createElement('iframe');
frame.srcdoc = CANVAS;
frame.title = 'canvas';
frame.style.cssText = `width: 900px; height: 500px; border: 0; transform: scale(${String(ZOOM)}); transform-origin: 0 0; outline: 1px solid #ccc`;
const holder = document.createElement('div');
holder.style.cssText = `width: ${String(900 * ZOOM)}px; height: ${String(500 * ZOOM)}px; overflow: hidden`;
holder.append(frame);
document.getElementById('stage')?.append(holder);

const textNode = () => frame.contentDocument?.querySelector('[data-rc-node="text-1"]') ?? undefined;

/** Renders runs back into the node once editing ends (what the Canvas Renderer does). */
function render(element: Element) {
  element.replaceChildren(
    ...runs.map((run) => {
      const span = element.ownerDocument.createElement('span');
      span.textContent = run.text;
      if (run.bold === true) span.style.fontWeight = '700';
      if (run.italic === true) span.style.fontStyle = 'italic';
      return span;
    }),
  );
}

function open() {
  const element = textNode();
  if (element === undefined || editor !== undefined) return;
  element.replaceChildren();
  editor = new Editor({
    element,
    extensions: richTextExtensions(),
    content: runsToDoc(runs),
    autofocus: 'end',
  });
  editor.view.dom.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

function close() {
  const element = textNode();
  if (editor === undefined || element === undefined) return;
  runs = docToRuns(editor.getJSON());
  editor.destroy();
  editor = undefined;
  render(element);
  checkManual();
}

function collect(json: JSONContent, nodes: Set<string>, marks: Set<string>) {
  nodes.add(json.type ?? '');
  for (const mark of json.marks ?? []) marks.add(mark.type);
  for (const child of json.content ?? []) collect(child, nodes, marks);
}

/** ?manual=1: compares what was typed by hand with the sample passage. */
function checkManual() {
  const panel = document.getElementById('manual') ?? undefined;
  if (panel === undefined || !location.search.includes('manual=1')) return;
  panel.hidden = false;
  const typed = editor?.getText() ?? runs.map((run) => run.text).join('');
  const verdict =
    typed === SAMPLE
      ? 'KHỚP: không mất, không lặp ký tự'
      : `CHƯA KHỚP (${String(typed.length)}/${String(SAMPLE.length)} ký tự)`;
  panel.textContent = `Gõ đoạn này vào ô "Xin chào" (bấm đúp để sửa, xóa chữ cũ trước): ${SAMPLE} — ${verdict}`;
}

frame.addEventListener('load', () => {
  frame.contentDocument?.addEventListener('dblclick', (event) => {
    if ((event.target as Element | undefined)?.closest('[data-rc-node="text-1"]')) open();
  });
  window.__vg14.ready = true;
  checkManual();
  setInterval(checkManual, 500);
});

window.__vg14 = {
  ready: false,
  get runs() {
    return runs;
  },
  set runs(value) {
    runs = value;
  },
  state: () => {
    const doc = frame.contentDocument ?? undefined;
    const dom = doc?.querySelector('.ProseMirror') ?? undefined;
    const active = doc?.activeElement ?? undefined;
    return {
      mounted: dom !== undefined,
      focused: dom !== undefined && active !== undefined && dom.contains(active),
      text: editor?.getText() ?? '',
    };
  },
  close,
  paste: (html) => {
    if (editor === undefined) open();
    editor?.commands.clearContent();
    editor?.view.pasteHTML(html);
    const nodes = new Set<string>();
    const marks = new Set<string>();
    if (editor !== undefined) collect(editor.getJSON(), nodes, marks);
    return {
      nodes: [...nodes],
      marks: [...marks],
      runs: editor === undefined ? [] : docToRuns(editor.getJSON()),
    };
  },
};
