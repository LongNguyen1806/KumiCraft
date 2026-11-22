// The JSX view language (React): KumiCraft reads and edits .jsx / .tsx, and .js with JSX as
// create-next-app writes JavaScript pages (03 section 3.2, 03b section 1.2). Only stamped elements
// are edited, so a .js file without JSX is never touched.
import type { ViewLanguage } from '../../../kernel/stacks.ts';
import { jsxFeatures } from './features.ts';

const JSX_FILES = ['.jsx', '.tsx', '.js'] as const;

export const jsxView: ViewLanguage = {
  id: 'jsx',
  sourceExtensions: JSX_FILES,
  markupExtensions: JSX_FILES,
  capability: { edit: true },
  features: jsxFeatures,
};
