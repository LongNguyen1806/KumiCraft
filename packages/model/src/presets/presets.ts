// Component Library presets index (SPEC-04.1 section 10.1, 10.2).
import { COMPOSITE_PRESETS } from './composite-presets.ts';
import { CONTENT_PRESETS } from './content-presets.ts';
import { DATA_PRESETS } from './data-presets.ts';
import { FORM_PRESETS } from './form-presets.ts';
import { LAYOUT_PRESETS } from './layout-presets.ts';
import type { Preset } from './types.ts';

export const PRESETS: readonly Preset[] = [
  ...LAYOUT_PRESETS,
  ...CONTENT_PRESETS,
  ...FORM_PRESETS,
  ...DATA_PRESETS,
  ...COMPOSITE_PRESETS,
];
