import type { DesignTokens } from '../schema/document.schema.ts';
import type { ResponsiveMode } from '../schema/primitives.schema.ts';

export type ParentLayout = 'flex-row' | 'flex-column' | 'grid' | 'none';

export type StylingContext = {
  readonly tailwind: 'v3' | 'v4';
  readonly responsiveMode: ResponsiveMode;
  readonly parentLayout?: ParentLayout;
  readonly tokens: DesignTokens;
  readonly runtimeHidden?: boolean;
};
