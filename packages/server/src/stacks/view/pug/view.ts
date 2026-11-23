// The Pug view language (docs/architecture/03d): .pug views of Express apps, shown, selected and
// edited (the editor is `createPugEditor`); the JSX-only tools do not apply.
import type { ViewLanguage } from '../../../kernel/stacks.ts';

export const pugView: ViewLanguage = {
  id: 'pug',
  sourceExtensions: ['.pug'],
  markupExtensions: ['.pug'],
  capability: { edit: true },
};
