// The server works out the classes of a class edit with the project's own reading context
// (03 section 3.3): its theme, responsive mode and Tailwind major.
import { err, ok, type SetClassesEdit } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { createClassEditResolver } from './class-edits.ts';

const EMPTY_THEME = {
  colors: [],
  fontSizes: [],
  radii: [],
  fonts: [],
  shadows: [],
  breakpoints: [],
};
const tailwind = (version: string) => ({
  systems: [{ id: 'tailwind' as const, version }],
  editable: true,
  globalCss: [],
});

const brandText: SetClassesEdit = {
  kind: 'setClasses',
  loc: 'src/App.tsx:3:5',
  tag: 'p',
  before: 'mt-2',
  steps: [
    {
      kind: 'value',
      property: 'textColor',
      scope: { breakpoint: 'base' },
      value: { kind: 'theme', name: 'brand' },
    },
  ],
};

describe('class edit resolver [ADR-A4]', () => {
  it('reads theme tokens of the project', async () => {
    const resolver = createClassEditResolver({
      theme: () =>
        Promise.resolve(
          ok({
            ...EMPTY_THEME,
            colors: [{ name: 'brand', value: '#4f46e5', variable: '--color-brand' }],
          }),
        ),
      project: () => ok({ responsiveMode: 'desktop-first', styling: tailwind('4.1.0') }),
    });

    const out = await resolver.resolve(brandText);

    expect(out).toEqual(
      ok({
        kind: 'setClassName',
        loc: brandText.loc,
        tag: 'p',
        before: 'mt-2',
        after: 'mt-2 text-brand',
      }),
    );
  });

  it('writes Tailwind 3 classes in a Tailwind 3 project', async () => {
    const resolver = createClassEditResolver({
      theme: () => Promise.resolve(ok(EMPTY_THEME)),
      project: () => ok({ styling: tailwind('3.4.17') }),
    });

    const out = await resolver.resolve({
      ...brandText,
      before: 'p-4',
      steps: [{ kind: 'place', placement: { kind: 'free', left: 16, top: 40 } }],
    });

    expect(out.ok && out.value.after).toBe('p-4 absolute left-[16px] top-[40px]');
  });

  it('a theme that cannot be read is the empty theme the Studio also falls back to', async () => {
    const resolver = createClassEditResolver({
      theme: () => Promise.resolve(err({ code: 'E021', params: { missing: 'project' } })),
      project: () => ok({ styling: tailwind('4.1.0') }),
    });

    const out = await resolver.resolve({
      ...brandText,
      steps: [{ kind: 'raw', className: 'p-2' }],
    });

    expect(out.ok && out.value.after).toBe('p-2');
  });

  it('no open project: the error is passed on', async () => {
    const resolver = createClassEditResolver({
      theme: () => Promise.resolve(ok(EMPTY_THEME)),
      project: () => err({ code: 'E021', params: { missing: 'project' } }),
    });

    expect(await resolver.resolve(brandText)).toEqual(
      err({ code: 'E021', params: { missing: 'project' } }),
    );
  });
});
