import { areRunsConsistent, type TextRun } from '@reactcraft/model';
import { getSchema } from '@tiptap/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { richTextExtensions } from './extensions.ts';
import { docToRuns, runsToDoc, toModelColor } from './runs.ts';

const schema = getSchema(richTextExtensions());

const formatArb = fc.record(
  {
    bold: fc.constant(true),
    italic: fc.constant(true),
    underline: fc.constant(true),
    strike: fc.constant(true),
    code: fc.constant(true),
    link: fc.record(
      {
        href: fc.constantFrom('https://shop.vn/ao', '/san-pham', '#top', 'mailto:a@shop.vn'),
        newTab: fc.constant(true),
      },
      { requiredKeys: ['href'], noNullPrototype: true },
    ),
    color: fc.constantFrom('#1f2937', '#ef444480', 'token:color.primary'),
  },
  { requiredKeys: [], noNullPrototype: true },
);

const textArb = fc.stringMatching(/^[a-zđêôươăâáàảãạệộ \n]{1,12}$/);

/** Valid runs (V-34): neighbours with the same format are merged, as the model requires. */
const runsArb = fc.array(fc.tuple(textArb, formatArb), { maxLength: 8 }).map((parts) => {
  const runs: TextRun[] = [];
  for (const [text, format] of parts) {
    const run = { text, ...format } as TextRun;
    const last = runs.at(-1);
    const { text: _lastText, ...lastFormat } = last ?? { text: '' };
    if (last !== undefined && JSON.stringify(lastFormat) === JSON.stringify(format)) {
      runs[runs.length - 1] = { ...last, text: last.text + text };
    } else runs.push(run);
  }
  return runs;
});

/** Same runs regardless of key order. */
const canonical = (runs: readonly TextRun[]) =>
  runs.map((run) => JSON.stringify(Object.fromEntries(Object.entries(run).sort())));

describe('runs ⇄ TipTap document (ADR-FE-20)', () => {
  it('gives back the same runs for 1,000 random samples [V-34]', () => {
    fc.assert(
      fc.property(runsArb, (runs) => {
        expect(canonical(docToRuns(runsToDoc(runs)))).toEqual(canonical(runs));
      }),
      { numRuns: 1000 },
    );
  });

  it('survives the real editor schema, which merges and reorders marks', () => {
    fc.assert(
      fc.property(runsArb, (runs) => {
        const node = schema.nodeFromJSON(runsToDoc(runs));
        node.check();
        const back = docToRuns(node.toJSON() as Parameters<typeof docToRuns>[0]);
        expect(canonical(back)).toEqual(canonical(runs));
        expect(areRunsConsistent({ text: runs.map((run) => run.text).join(''), runs: back })).toBe(
          true,
        );
      }),
      { numRuns: 1000 },
    );
  });

  it('keeps a bold code run, which TipTap refuses by default', () => {
    const runs: TextRun[] = [{ text: 'npm i', code: true, bold: true }];

    expect(docToRuns(schema.nodeFromJSON(runsToDoc(runs)).toJSON() as never)).toEqual(runs);
  });

  it('turns pasted colours into model colours and drops the rest', () => {
    expect(toModelColor('rgb(239, 68, 68)')).toBe('#ef4444');
    expect(toModelColor('#ABCDEF')).toBe('#abcdef');
    expect(toModelColor('token:color.primary')).toBe('token:color.primary');
    expect([toModelColor('red'), toModelColor('var(--x)'), toModelColor(4)]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('drops unsafe links and formats the model does not hold [V-35]', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
            { type: 'text', text: ' big', marks: [{ type: 'highlight' }] },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'next' }] },
      ],
    };

    expect(docToRuns(doc)).toEqual([{ text: 'click big\nnext' }]);
  });
});
