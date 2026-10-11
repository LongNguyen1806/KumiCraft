// Typed translation keys (ADR-FE-16): a key missing from the en files is a type error.
import 'i18next';

import type { resources } from './i18n.ts';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: (typeof resources)['en'];
  }
}
