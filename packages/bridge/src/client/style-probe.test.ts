// @vitest-environment happy-dom
import { splitSelectorList } from '@kumicraft/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { answerStyleProbe, selectorSpecificity } from './style-probe.ts';

describe('style-probe [R-ST-04]', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('computes Selectors Level 4 specificity, with :is() as its strongest argument and :where() as nothing', () => {
    expect(selectorSpecificity('.card')).toEqual([0, 1, 0]);
    expect(selectorSpecificity('.home .card')).toEqual([0, 2, 0]);
    expect(selectorSpecificity('#app main > article.card:hover')).toEqual([1, 2, 2]);
    expect(selectorSpecificity(':is(#a, .b) p')).toEqual([1, 0, 1]);
    expect(selectorSpecificity(':where(#a) p::before')).toEqual([0, 0, 2]);
  });

  it('splits a selector list only on its top-level commas', () => {
    expect(splitSelectorList('.a, :is(.b, .c) > p, [title="x,y"]')).toEqual([
      '.a',
      ':is(.b, .c) > p',
      '[title="x,y"]',
    ]);
  });

  it('orders the rules of a Vite module by cascade, counts each selector per sheet and the elements it matches [R-ST-05]', () => {
    const style = document.createElement('style');
    style.setAttribute('data-vite-dev-id', 'D:/app/src/components/Card.css');
    style.textContent =
      '.card { padding-top: 16px; } .home .card { background-color: white; } .card { color: red; }';
    document.head.append(style);
    document.body.innerHTML =
      '<main class="home"><article data-rc-loc="src/Card.tsx:4:5" class="card"></article><article data-rc-loc="src/Card.tsx:4:5" class="card"></article></main>';

    const answer = answerStyleProbe(
      {
        ref: { loc: 'src/Card.tsx:4:5', index: 1 },
        properties: ['padding-top', 'color', 'background-color'],
      },
      document,
    );

    expect(answer.found).toBe(true);
    expect(answer.rules.map((r) => [r.selector, r.occurrence, r.affects])).toEqual([
      ['.home .card', 0, 2],
      ['.card', 1, 2],
      ['.card', 0, 2],
    ]);
    // happy-dom has no `sheet.ownerNode`: the module id is checked in a real browser (VG-19 E2E).
    expect(answer.rules[2]?.declarations).toEqual([
      { property: 'padding-top', value: '16px', important: false },
    ]);
  });

  it('counts rules in non-matching @media so subsequent rules have accurate ruleIndex: Sheet có rule A, @media không áp dụng chứa rule B, rule C → C có ruleIndex: 2 [R-ST-04]', () => {
    const style = document.createElement('style');
    style.textContent =
      '.card { color: red; } @media (min-width: 9999px) { .card { color: blue; } } .card { color: green; }';
    document.head.append(style);
    document.body.innerHTML = '<div data-rc-loc="src/App.tsx:1:1" class="card"></div>';

    const answer = answerStyleProbe(
      {
        ref: { loc: 'src/App.tsx:1:1', index: 0 },
        properties: ['color'],
      },
      document,
    );

    expect(answer.found).toBe(true);
    const ruleGreen = answer.rules.find((r) => r.declarations.some((d) => d.value === 'green'));
    const ruleRed = answer.rules.find((r) => r.declarations.some((d) => d.value === 'red'));
    expect(ruleGreen?.ruleIndex).toBe(2);
    expect(ruleRed?.ruleIndex).toBe(0);
  });

  it('answers found: false for an element that is not on the page', () => {
    expect(
      answerStyleProbe({ ref: { loc: 'src/X.tsx:1:1', index: 0 }, properties: [] }, document),
    ).toEqual({
      ref: { loc: 'src/X.tsx:1:1', index: 0 },
      found: false,
      rules: [],
      inline: [],
      computed: {},
    });
  });

  it('orders :hover rule first and sets computed.color to red when state is hover [R-ST-09]', () => {
    const style = document.createElement('style');
    style.textContent = '.a { color: blue; } .a:hover { color: red; }';
    document.head.append(style);
    document.body.innerHTML = '<button data-rc-loc="src/Btn.tsx:1:1" class="a"></button>';

    const answer = answerStyleProbe(
      {
        ref: { loc: 'src/Btn.tsx:1:1', index: 0 },
        properties: ['color'],
        state: 'hover',
      },
      document,
    );

    expect(answer.found).toBe(true);
    expect(answer.rules.map((r) => r.selector)).toEqual(['.a:hover', '.a']);
    expect(answer.computed['color']).toBe('red');
  });

  it('excludes .a:hover rule when state is omitted [R-ST-04]', () => {
    const style = document.createElement('style');
    style.textContent = '.a { color: blue; } .a:hover { color: red; }';
    document.head.append(style);
    document.body.innerHTML = '<button data-rc-loc="src/Btn.tsx:1:1" class="a"></button>';

    const answer = answerStyleProbe(
      {
        ref: { loc: 'src/Btn.tsx:1:1', index: 0 },
        properties: ['color'],
      },
      document,
    );

    expect(answer.found).toBe(true);
    expect(answer.rules.map((r) => r.selector)).toEqual(['.a']);
  });
});
