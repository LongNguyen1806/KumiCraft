// Preset types for Component Library (SPEC-04.1 section 10.1).
import type { DesignTokens } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';

export type PresetCategory = 'layout' | 'content' | 'form' | 'data' | 'composite';

export type PresetContext = {
  readonly tokens?: DesignTokens | undefined;
  readonly contentLocale?: string | undefined;
};

export type Preset = {
  readonly id: string;
  readonly category: PresetCategory;
  readonly labelKey: string;
  readonly icon: string;
  readonly create: (ctx?: PresetContext) => DesignNode;
};
