// The Razor view language (docs/architecture/03c): .cshtml of ASP.NET Razor Pages and MVC. The
// editor is `createRazorEditor`; the JSX-only tools (component props, data arrays) do not apply.
import type { ViewLanguage } from '../../../kernel/stacks.ts';

export const razorView: ViewLanguage = {
  id: 'razor',
  sourceExtensions: ['.cshtml'],
  markupExtensions: ['.cshtml'],
  capability: { edit: true },
};
