// A class edit resolver for route tests: a Tailwind 4 project with no theme tokens.
import { ok, type ResponsiveMode } from '@kumicraft/shared';

import type { ClassEditResolver } from '../../kernel/editing.ts';
import { createClassEditResolver } from './class-edits.ts';

export function testClassEdits(
  responsiveMode: ResponsiveMode = 'desktop-first',
): ClassEditResolver {
  return createClassEditResolver({
    theme: () =>
      Promise.resolve(
        ok({ colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] }),
      ),
    project: () =>
      ok({
        responsiveMode,
        styling: {
          systems: [{ id: 'tailwind', version: '4' }],
          editable: true,
          globalCss: [],
        },
      }),
  });
}
