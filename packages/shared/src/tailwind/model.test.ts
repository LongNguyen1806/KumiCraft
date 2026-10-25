// Unit tests for M-TW model covering Scenarios 2–15 of Table 8.1 (SPEC-04 section 8).
import { describe, expect, it } from 'vitest';

import { BREAKPOINT_WIDTHS } from '../responsive.ts';
import { parseClasses } from './parser.ts';
import { formatClassValue, pxToSpacing } from './properties.ts';
import { readValue } from './reader.ts';
import type { ClassContext } from './types.ts';
import { writeValue } from './writer.ts';

const defaultContext: ClassContext = {
  theme: {
    colors: [{ name: 'brand', value: '#123456' }],
    fontSizes: [{ name: 'hero', value: '4rem' }],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [{ name: '3xl', value: '1920' }],
  },
  mode: 'mobile-first',
  breakpoints: BREAKPOINT_WIDTHS,
};

const desktopContext: ClassContext = {
  ...defaultContext,
  mode: 'desktop-first',
};

describe('M-TW Table 8.2 properties & scenarios [SPEC-04 section 8]', () => {
  it('Scenario 2: recognizes every row of Table 8.2 (>= 2 examples each) and 10 strange classes', () => {
    const validPairs: [string, string][] = [
      ['flex', 'display'],
      ['hidden', 'display'],
      ['flex-col', 'flexDirection'],
      ['flex-row-reverse', 'flexDirection'],
      ['flex-wrap', 'flexWrap'],
      ['flex-nowrap', 'flexWrap'],
      ['justify-between', 'justifyContent'],
      ['justify-center', 'justifyContent'],
      ['items-center', 'alignItems'],
      ['items-start', 'alignItems'],
      ['gap-4', 'gap'],
      ['gap-[15px]', 'gap'],
      ['gap-x-2', 'gapX'],
      ['gap-x-8', 'gapX'],
      ['gap-y-6', 'gapY'],
      ['gap-y-1', 'gapY'],
      ['grid-cols-3', 'gridCols'],
      ['grid-cols-[repeat(2,1fr)]', 'gridCols'],
      ['self-auto', 'alignSelf'],
      ['self-stretch', 'alignSelf'],
      ['flex-1', 'flex'],
      ['flex-auto', 'flex'],
      ['grow', 'grow'],
      ['grow-0', 'grow'],
      ['shrink', 'shrink'],
      ['shrink-0', 'shrink'],
      ['absolute', 'position'],
      ['relative', 'position'],
      ['z-10', 'zIndex'],
      ['z-50', 'zIndex'],
      ['inset-0', 'inset'],
      ['inset-4', 'inset'],
      ['inset-x-4', 'insetX'],
      ['inset-x-0', 'insetX'],
      ['inset-y-2', 'insetY'],
      ['inset-y-8', 'insetY'],
      ['top-0', 'top'],
      ['top-4', 'top'],
      ['right-2', 'right'],
      ['right-full', 'right'],
      ['bottom-0', 'bottom'],
      ['bottom-10', 'bottom'],
      ['left-1/2', 'left'],
      ['left-4', 'left'],
      ['w-full', 'width'],
      ['w-1/2', 'width'],
      ['h-16', 'height'],
      ['h-screen', 'height'],
      ['min-w-0', 'minWidth'],
      ['min-w-full', 'minWidth'],
      ['max-w-lg', 'maxWidth'],
      ['max-w-prose', 'maxWidth'],
      ['min-h-screen', 'minHeight'],
      ['min-h-0', 'minHeight'],
      ['max-h-96', 'maxHeight'],
      ['max-h-full', 'maxHeight'],
      ['p-4', 'padding'],
      ['p-[10px]', 'padding'],
      ['px-2', 'paddingX'],
      ['px-6', 'paddingX'],
      ['py-1', 'paddingY'],
      ['py-8', 'paddingY'],
      ['pt-2', 'paddingTop'],
      ['pt-5', 'paddingTop'],
      ['pr-3', 'paddingRight'],
      ['pr-8', 'paddingRight'],
      ['pb-4', 'paddingBottom'],
      ['pb-12', 'paddingBottom'],
      ['pl-1', 'paddingLeft'],
      ['pl-6', 'paddingLeft'],
      ['m-auto', 'margin'],
      ['m-4', 'margin'],
      ['mx-auto', 'marginX'],
      ['mx-2', 'marginX'],
      ['my-4', 'marginY'],
      ['my-10', 'marginY'],
      ['mt-2', 'marginTop'],
      ['mt-8', 'marginTop'],
      ['mr-4', 'marginRight'],
      ['mr-auto', 'marginRight'],
      ['mb-6', 'marginBottom'],
      ['mb-2', 'marginBottom'],
      ['ml-auto', 'marginLeft'],
      ['ml-1', 'marginLeft'],
      ['text-sm', 'fontSize'],
      ['text-2xl', 'fontSize'],
      ['font-bold', 'fontWeight'],
      ['font-semibold', 'fontWeight'],
      ['font-mono', 'fontFamily'],
      ['font-sans', 'fontFamily'],
      ['leading-tight', 'lineHeight'],
      ['leading-loose', 'lineHeight'],
      ['tracking-wide', 'letterSpacing'],
      ['tracking-tight', 'letterSpacing'],
      ['text-center', 'textAlign'],
      ['text-right', 'textAlign'],
      ['uppercase', 'textTransform'],
      ['capitalize', 'textTransform'],
      ['underline', 'textDecoration'],
      ['line-through', 'textDecoration'],
      ['italic', 'fontStyle'],
      ['not-italic', 'fontStyle'],
      ['text-red-500', 'textColor'],
      ['text-blue-600', 'textColor'],
      ['bg-white', 'backgroundColor'],
      ['bg-slate-900', 'backgroundColor'],
      ['border-gray-200', 'borderColor'],
      ['border-black', 'borderColor'],
      ['border', 'borderWidth'],
      ['border-2', 'borderWidth'],
      ['border-dashed', 'borderStyle'],
      ['border-dotted', 'borderStyle'],
      ['rounded', 'borderRadius'],
      ['rounded-lg', 'borderRadius'],
      ['shadow', 'boxShadow'],
      ['shadow-md', 'boxShadow'],
      ['opacity-50', 'opacity'],
      ['opacity-100', 'opacity'],
      ['overflow-hidden', 'overflow'],
      ['overflow-auto', 'overflow'],
      ['visible', 'visibility'],
      ['invisible', 'visibility'],
      ['object-cover', 'objectFit'],
      ['object-contain', 'objectFit'],
    ];

    for (const [cls, expectedProp] of validPairs) {
      const tokens = parseClasses(cls, defaultContext);
      expect(tokens[0]?.property, `expected ${cls} to be ${expectedProp}`).toBe(expectedProp);
    }

    const strangeClasses = [
      'dark:text-white',
      'group-hover:flex',
      '[&>*]:p-2',
      'border-t-2',
      'rounded-tl-lg',
      'custom-card',
      'animate-spin',
      'cursor-pointer',
      'select-none',
      'backdrop-blur-md',
    ];
    for (const cls of strangeClasses) {
      const tokens = parseClasses(cls, defaultContext);
      expect(
        tokens[0]?.property,
        `expected strange class ${cls} to have no property`,
      ).toBeUndefined();
    }
  });

  it('Scenario 3: R-TW-09 disambiguation for text-* and border-* [R-TW-09]', () => {
    const textSamples = parseClasses(
      'text-lg text-center text-brand text-hero text-[14px] text-[#fff]',
      defaultContext,
    );
    expect(textSamples[0]).toMatchObject({
      property: 'fontSize',
      value: { kind: 'scale', token: 'lg' },
    });
    expect(textSamples[1]).toMatchObject({
      property: 'textAlign',
      value: { kind: 'keyword', name: 'center' },
    });
    expect(textSamples[2]).toMatchObject({
      property: 'textColor',
      value: { kind: 'theme', name: 'brand' },
    });
    expect(textSamples[3]).toMatchObject({
      property: 'fontSize',
      value: { kind: 'theme', name: 'hero' },
    });
    expect(textSamples[4]).toMatchObject({
      property: 'fontSize',
      value: { kind: 'arbitrary', css: '14px' },
    });
    expect(textSamples[5]).toMatchObject({
      property: 'textColor',
      value: { kind: 'arbitrary', css: '#fff' },
    });

    const borderSamples = parseClasses('border-2 border-dashed border-slate-200', defaultContext);
    expect(borderSamples[0]).toMatchObject({
      property: 'borderWidth',
      value: { kind: 'scale', token: '2' },
    });
    expect(borderSamples[1]).toMatchObject({
      property: 'borderStyle',
      value: { kind: 'keyword', name: 'dashed' },
    });
    expect(borderSamples[2]).toMatchObject({
      property: 'borderColor',
      value: { kind: 'scale', token: 'slate-200' },
    });
  });

  it('Scenario 4: readValue p-4 max-md:p-2 max-sm:p-1 at 1440, 700, 500 (desktop-first) [R-TW-04]', () => {
    const input = 'p-4 max-md:p-2 max-sm:p-1';
    const tokens = parseClasses(input, desktopContext);

    const r1440 = readValue(tokens, 'padding', { width: 1440 }, desktopContext);
    expect(r1440.value).toEqual({ kind: 'scale', token: '4' });
    expect(r1440.from?.breakpoint).toBe('base');

    const r700 = readValue(tokens, 'padding', { width: 700 }, desktopContext);
    expect(r700.value).toEqual({ kind: 'scale', token: '2' });
    expect(r700.from?.breakpoint).toBe('md');

    const r500 = readValue(tokens, 'padding', { width: 500 }, desktopContext);
    expect(r500.value).toEqual({ kind: 'scale', token: '1' });
    expect(r500.from?.breakpoint).toBe('sm');
  });

  it('Scenario 5: readValue p-1 md:p-2 lg:p-3 at 375, 800, 1200 (mobile-first) [R-TW-04]', () => {
    const input = 'p-1 md:p-2 lg:p-3';
    const tokens = parseClasses(input, defaultContext);

    const r375 = readValue(tokens, 'padding', { width: 375 }, defaultContext);
    expect(r375.value).toEqual({ kind: 'scale', token: '1' });

    const r800 = readValue(tokens, 'padding', { width: 800 }, defaultContext);
    expect(r800.value).toEqual({ kind: 'scale', token: '2' });

    const r1200 = readValue(tokens, 'padding', { width: 1200 }, defaultContext);
    expect(r1200.value).toEqual({ kind: 'scale', token: '3' });
  });

  it('Scenario 6: bg-white hover:bg-gray-100 with hover state and without', () => {
    const tokens = parseClasses('bg-white hover:bg-gray-100', defaultContext);

    const withHover = readValue(
      tokens,
      'backgroundColor',
      { width: 1024, state: 'hover' },
      defaultContext,
    );
    expect(withHover.value).toEqual({ kind: 'scale', token: 'gray-100' });

    const withoutHover = readValue(tokens, 'backgroundColor', { width: 1024 }, defaultContext);
    expect(withoutHover.value).toEqual({ kind: 'scale', token: 'white' });
  });

  it('Scenario 7: p-4 pt-2 reads paddingTop/Bottom; px-3 pl-1 reads paddingLeft/Right [R-TW-07]', () => {
    const t1 = parseClasses('p-4 pt-2', defaultContext);
    expect(readValue(t1, 'paddingTop', { width: 1024 }, defaultContext).value).toEqual({
      kind: 'scale',
      token: '2',
    });
    expect(readValue(t1, 'paddingBottom', { width: 1024 }, defaultContext).value).toEqual({
      kind: 'scale',
      token: '4',
    });

    const t2 = parseClasses('px-3 pl-1', defaultContext);
    expect(readValue(t2, 'paddingLeft', { width: 1024 }, defaultContext).value).toEqual({
      kind: 'scale',
      token: '1',
    });
    expect(readValue(t2, 'paddingRight', { width: 1024 }, defaultContext).value).toEqual({
      kind: 'scale',
      token: '3',
    });
  });

  it('Scenario 8: p-4 p-2 reads padding with conflict: true', () => {
    const tokens = parseClasses('p-4 p-2', defaultContext);
    const read = readValue(tokens, 'padding', { width: 1024 }, defaultContext);
    expect(read.value).toEqual({ kind: 'scale', token: '2' });
    expect(read.conflict).toBe(true);
  });

  it('Scenario 9: writeValue replaces in-place flex p-4 text-sm -> padding = 6 [R-TW-05]', () => {
    const res = writeValue(
      'flex p-4 text-sm',
      'padding',
      { breakpoint: 'base' },
      { kind: 'scale', token: '6' },
      defaultContext,
    );
    expect(res).toBe('flex p-6 text-sm');
  });

  it('Scenario 10: writeValue scope sm desktop-first when not present, when present, and undefined [R-TW-05]', () => {
    const added = writeValue(
      'flex text-sm',
      'padding',
      { breakpoint: 'sm' },
      { kind: 'scale', token: '2' },
      desktopContext,
    );
    expect(added).toBe('flex text-sm max-sm:p-2');

    const replaced = writeValue(
      added,
      'padding',
      { breakpoint: 'sm' },
      { kind: 'scale', token: '4' },
      desktopContext,
    );
    expect(replaced).toBe('flex text-sm max-sm:p-4');

    const deleted = writeValue(
      replaced,
      'padding',
      { breakpoint: 'sm' },
      undefined,
      desktopContext,
    );
    expect(deleted).toBe('flex text-sm');
  });

  it('Scenario 11: writeValue scope { breakpoint: md, state: hover } mobile-first [R-TW-05]', () => {
    const res = writeValue(
      'p-4',
      'padding',
      { breakpoint: 'md', state: 'hover' },
      { kind: 'scale', token: '6' },
      defaultContext,
    );
    expect(res).toBe('p-4 md:hover:p-6');
  });

  it('Scenario 12: writeValue all deletes side/axis tokens in px-2 pt-1 md:pt-3 [R-TW-07]', () => {
    const res = writeValue(
      'px-2 pt-1 md:pt-3',
      'padding',
      { breakpoint: 'base' },
      { kind: 'scale', token: '4' },
      defaultContext,
    );
    expect(res).toBe('p-4 md:pt-3');
  });

  it('Scenario 13: pxToSpacing conversions with default 4px and custom 8px spacing [R-TW-08]', () => {
    expect(pxToSpacing(40)).toEqual({ kind: 'scale', token: '10' });
    expect(pxToSpacing(13)).toEqual({ kind: 'arbitrary', css: '13px' });
    expect(pxToSpacing(10)).toEqual({ kind: 'scale', token: '2.5' });
    expect(pxToSpacing(0)).toEqual({ kind: 'scale', token: '0' });
    expect(pxToSpacing(1)).toEqual({ kind: 'scale', token: 'px' });
    expect(pxToSpacing(40, 8)).toEqual({ kind: 'scale', token: '5' });
  });

  it('Scenario 14: preserves arbitrary whitespace and newlines between unrelated classes [R-TW-06]', () => {
    const input = '   flex   \n\t  p-4   \n   text-sm   ';
    const res = writeValue(
      input,
      'padding',
      { breakpoint: 'base' },
      { kind: 'scale', token: '8' },
      defaultContext,
    );
    expect(res).toBe('   flex   \n\t  p-8   \n   text-sm   ');
  });

  it('Scenario 15: roundtrip R-TW-11 on diverse class strings [R-TW-11]', () => {
    const testCases: [string, string][] = [
      ['p-4 flex text-sm', 'padding'],
      ['w-full h-16 bg-white', 'width'],
      ['md:p-6 text-center text-red-500', 'padding'],
      ['hover:bg-gray-100 relative z-10', 'backgroundColor'],
      ['mt-4 block font-bold', 'marginTop'],
      ['grid grid-cols-3 gap-4', 'gridCols'],
    ];

    for (const [classStr, prop] of testCases) {
      const tokens = parseClasses(classStr, defaultContext);
      const read = readValue(tokens, prop, { width: 1024, state: 'hover' }, defaultContext);
      if (read.value !== undefined && read.from !== undefined) {
        const roundtripped = writeValue(classStr, prop, read.from, read.value, defaultContext);
        expect(roundtripped).toBe(classStr);
      }
    }
  });

  it('7. [R-ST-02] major: 3 writes small shadow as shadow and major: 4 writes shadow-sm without changing existing behavior', () => {
    const v3Context: ClassContext = { ...defaultContext, major: 3 };
    const v4Context: ClassContext = { ...defaultContext, major: 4 };
    const smallShadow = { kind: 'scale', token: 'sm' } as const;
    const base = { breakpoint: 'base' } as const;

    expect(formatClassValue('boxShadow', smallShadow, 3)).toBe('shadow');
    expect(formatClassValue('boxShadow', smallShadow, 4)).toBe('shadow-sm');
    expect(formatClassValue('boxShadow', smallShadow)).toBe('shadow-sm');
    expect(writeValue('p-4', 'boxShadow', base, smallShadow, v3Context)).toBe('p-4 shadow');
    expect(writeValue('p-4', 'boxShadow', base, smallShadow, v4Context)).toBe('p-4 shadow-sm');
    expect(writeValue('p-4', 'boxShadow', base, smallShadow, defaultContext)).toBe('p-4 shadow-sm');
  });

  it('8. [R-ST-02] major: 3 reads shadow as small shadow and outline-none as hidden outline', () => {
    const v3Context: ClassContext = { ...defaultContext, major: 3 };
    const tokens = parseClasses('shadow outline-none', v3Context);

    expect(readValue(tokens, 'boxShadow', { width: 1024 }, v3Context).value).toEqual({
      kind: 'scale',
      token: 'sm',
    });
    expect(readValue(tokens, 'outline', { width: 1024 }, v3Context).value).toEqual({
      kind: 'keyword',
      name: 'hidden',
    });
  });
});
