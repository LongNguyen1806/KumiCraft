// Reading the HTML of a .cshtml around the C# ranges the Razor helper gives (03c section 2.3), and
// stamping the copy (section 2.4). The ranges below are the ones the helper returns for this text
// (checked against the SDK's Razor compiler while building round 4).
import { describe, expect, it } from 'vitest';

import { inLoop, lineCol, readRazorMarkup, type Span } from './markup.ts';
import { stampRazor } from './stamp.ts';

/** The ranges of `pieces` in `text`, in order: what the helper marks as C#. */
function codeOf(text: string, pieces: readonly string[]): Span[] {
  let from = 0;
  return pieces.map((piece) => {
    const start = text.indexOf(piece, from);
    if (start < 0) throw new Error(`not in text: ${piece}`);
    from = start + piece.length;
    return { start, end: from };
  });
}

const VIEW = [
  '@model List<string>',
  '<ul class="list @(Model.Count > 2 ? "big" : "")" data-x="@Model.Count">',
  '@foreach (var item in Model)',
  '{',
  '    <li class="item">@item <span>me@example.com</span></li>',
  '}',
  '</ul>',
  '<!-- <b>not an element</b> -->',
  '<script>if (a<b) { x = "<div>"; }</script>',
  '<img src="/a.png" alt="A" />',
].join('\n');

const CODE = [
  '@model List<string>\n',
  ' @(Model.Count > 2 ? "big" : "")',
  '@Model.Count',
  '@foreach (var item in Model)\n{\n',
  '@item',
  '}\n',
];

describe('Razor markup [03c 2.3]', () => {
  const doc = readRazorMarkup(VIEW, codeOf(VIEW, CODE));
  const tags = doc.elements.map((e) => e.tag);

  it('reads the elements of the HTML only: not C#, comments or script text', () => {
    expect(tags).toEqual(['ul', 'li', 'span', 'script', 'img']);
  });

  it('splits an attribute value into written text and C#', () => {
    const ul = doc.elements[0];
    const cls = ul?.attrs.find((a) => a.name === 'class')?.value;
    expect(cls?.parts.map((p) => [p.kind, VIEW.slice(p.start, p.end)])).toEqual([
      ['static', 'list'],
      ['code', ' @(Model.Count > 2 ? "big" : "")'],
    ]);
  });

  it('knows an element inside @foreach, and the tag ends of each element', () => {
    const li = doc.elements[1];
    const ul = doc.elements[0];
    expect(li !== undefined && inLoop(doc, li)).toBe(true);
    expect(ul !== undefined && inLoop(doc, ul)).toBe(false);
    expect(VIEW.slice(li?.close?.start, li?.close?.end)).toBe('</li>');
    expect(doc.elements[4]?.selfClosing).toBe(true);
  });

  it('stamps each element with its file, line and column in the original', () => {
    const stamped = stampRazor(doc, 'Pages/Index.cshtml');
    const li = doc.elements[1];
    const at = li === undefined ? { line: 0, col: 0 } : lineCol(VIEW, li.start);
    expect(at).toEqual({ line: 5, col: 5 });
    expect(stamped).toContain('<li data-rc-loc="Pages/Index.cshtml:5:5" class="item">');
    expect(stamped).toContain('<ul data-rc-loc="Pages/Index.cshtml:2:1" class="list');
    // C# and the script's text are left as they were.
    expect(stamped).toContain('@foreach (var item in Model)');
    expect(stamped).toContain('if (a<b) { x = "<div>"; }');
  });
});
