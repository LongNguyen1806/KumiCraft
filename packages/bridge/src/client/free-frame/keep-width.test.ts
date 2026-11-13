// @vitest-environment happy-dom
// A frame whose width comes from its content keeps it when turned on (spec-log #129): a card
// placed in a free frame is `absolute` with no width, and collapsed once its children left the flow.
import { afterEach, describe, expect, it } from 'vitest';

import { hasWidthClass, widthFollowsContent } from './free-geometry.ts';

function frameIn(parentStyle: string, frameStyle: string, frameClass = ''): Element {
  document.body.innerHTML = `<div style="${parentStyle}"><div id="f" class="${frameClass}" style="${frameStyle}">x</div></div>`;
  const frame = document.getElementById('f');
  if (!frame) throw new Error('No frame');
  return frame;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('widthFollowsContent [spec-log #129]', () => {
  it.each([
    ['absolute', '', 'position: absolute'],
    ['fixed', '', 'position: fixed'],
    ['floated', '', 'float: left'],
    ['inline-block', '', 'display: inline-block'],
    ['a flex item in a row', 'display: flex', ''],
    [
      'a column item not stretched',
      'display: flex; flex-direction: column; align-items: center',
      '',
    ],
    ['a grid item not stretched', 'display: grid; justify-items: start', ''],
  ])('true for %s', (_name, parentStyle, frameStyle) => {
    expect(widthFollowsContent(frameIn(parentStyle, frameStyle))).toBe(true);
  });

  it.each([
    ['a block in a block', '', ''],
    ['a stretched column item', 'display: flex; flex-direction: column', ''],
    ['a stretched grid item', 'display: grid', ''],
    ['relative (still in the flow)', '', 'position: relative'],
  ])('false for %s', (_name, parentStyle, frameStyle) => {
    expect(widthFollowsContent(frameIn(parentStyle, frameStyle))).toBe(false);
  });

  it('hasWidthClass sees unprefixed w-/min-w- only', () => {
    expect(hasWidthClass(frameIn('', '', 'p-6 w-80'))).toBe(true);
    expect(hasWidthClass(frameIn('', '', 'min-w-[200px]'))).toBe(true);
    expect(hasWidthClass(frameIn('', '', 'md:w-80 p-6'))).toBe(false);
  });
});
