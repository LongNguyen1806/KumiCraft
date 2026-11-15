// @vitest-environment happy-dom
// The use of a component (`<Card …>` in the page) found from its first element, through React's
// record of the components it rendered. Built here as plain objects shaped like React's fibers.
import { describe, expect, it } from 'vitest';

import { transformJsx } from '../transform/transform-jsx.ts';
import { componentUseOf } from './component-use.ts';

type Fiber = {
  type: unknown;
  return: Fiber | undefined;
  child?: Fiber;
  stateNode?: unknown;
  memoizedProps: Record<string, unknown>;
};

/** `<Card data-rc-use=…>` rendering `<div><h3/></div>`, its div then its h3 as DOM elements. */
function renderCard(use: string) {
  const div = document.createElement('div');
  const h3 = document.createElement('h3');
  div.appendChild(h3);
  // A real fiber always has `return` (the root's is empty).
  const card: Fiber = {
    type: () => undefined,
    return: undefined,
    memoizedProps: { 'data-rc-use': use },
  };
  const divFiber: Fiber = { type: 'div', return: card, stateNode: div, memoizedProps: {} };
  const h3Fiber: Fiber = { type: 'h3', return: divFiber, stateNode: h3, memoizedProps: {} };
  card.child = divFiber;
  divFiber.child = h3Fiber;
  Reflect.set(div, '__reactFiber$test', divFiber);
  Reflect.set(h3, '__reactFiber$test', h3Fiber);
  return { div, h3 };
}

describe('componentUseOf', () => {
  it('gives the place and tag of the use for the first element of a component [R-IN-11]', () => {
    const { div } = renderCard('src/pages/Home.tsx:7:7|RelativeCard');
    expect(componentUseOf(div)).toEqual({ loc: 'src/pages/Home.tsx:7:7', tag: 'RelativeCard' });
  });

  it('gives nothing for an element inside the component, or without React [R-IN-11]', () => {
    const { h3 } = renderCard('src/pages/Home.tsx:7:7|Card');
    expect(componentUseOf(h3)).toBe(undefined);
    expect(componentUseOf(document.createElement('div'))).toBe(undefined);
  });
});

describe('transformJsx marks component uses', () => {
  const options = { rootDir: 'D:/project', sourceDir: 'src' };
  it('puts data-rc-use with the tag as written on a component, none on React tags [R-BR-01]', () => {
    const code = [
      'export function A() {',
      '  return (',
      '    <Fragment>',
      '      <RelativeCard title="x" />',
      '      <Ctx.Provider value={1}><div /></Ctx.Provider>',
      '    </Fragment>',
      '  );',
      '}',
    ].join('\n');
    const out = transformJsx(code, 'D:/project/src/A.tsx', options)?.code ?? '';
    expect(out).toContain('<RelativeCard data-rc-use="src/A.tsx:4:7|RelativeCard" title="x" />');
    expect(out).toContain('<Fragment>');
    expect(out).toContain('<Ctx.Provider value={1}>');
    expect(out).toContain('<div data-rc-loc="src/A.tsx:5:31" />');
  });
});
