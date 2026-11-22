// The JSX view language (React): KumiCraft reads and edits .jsx / .tsx (03 section 3.2).
import type { ViewLanguage } from '../../../kernel/stacks.ts';
import { jsxFeatures } from './features.ts';

export const jsxView: ViewLanguage = {
  id: 'jsx',
  sourceExtensions: ['.jsx', '.tsx'],
  markupExtensions: ['.jsx', '.tsx'],
  capability: { edit: true },
  features: jsxFeatures,
};
