// The Pug view language: views are shown and selected on the Canvas; no editor yet (view only).
import type { ViewLanguage } from '../../../kernel/stacks.ts';

export const pugView: ViewLanguage = {
  id: 'pug',
  sourceExtensions: [],
  markupExtensions: ['.pug'],
  capability: { edit: false, reason: 'viewOnly' },
};
