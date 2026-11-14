// SVG attribute names from a replaceSvg edit are written verbatim into JSX: only plain names pass
// (QA K9.7-2). A name like `x={alert(1)}` or `onload` must never reach the user's code.
import { describe, expect, it } from 'vitest';

import { isSafeSvgAttrName, ReplaceSvgEditSchema } from './source.ts';

const edit = (attrs: Record<string, string>) => ({
  kind: 'replaceSvg',
  loc: 'src/App.tsx:3:5',
  tag: 'svg',
  icon: { name: 'heart', node: [['path', attrs]] },
});

describe('isSafeSvgAttrName [K9.7-2 QA]', () => {
  it.each(['d', 'cx', 'stroke-width', 'strokeLinecap', 'fill', 'points', 'x1'])(
    'accepts %s',
    (n) => {
      expect(isSafeSvgAttrName(n)).toBe(true);
    },
  );

  it.each([
    'x={alert(1)}',
    'a b',
    'x"',
    'onload',
    'onClick',
    'ONCLICK',
    'style',
    'href',
    'xlink:href',
    'xlinkHref',
    'dangerouslySetInnerHTML',
    'ref',
  ])('rejects %s', (n) => {
    expect(isSafeSvgAttrName(n)).toBe(false);
  });

  it('the replaceSvg schema refuses an unsafe name and keeps a lucide-like node', () => {
    expect(ReplaceSvgEditSchema.safeParse(edit({ 'x={alert(1)}': '1' })).success).toBe(false);
    expect(
      ReplaceSvgEditSchema.safeParse(edit({ d: 'M2 9.5a5.5', 'stroke-width': '2' })).success,
    ).toBe(true);
  });
});
