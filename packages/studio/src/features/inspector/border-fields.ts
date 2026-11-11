// The per-side and per-corner border fields the Borders group can switch to (R-IN-10).
import type { ClassToken, PropertyId } from '@kumicraft/shared';

import type { PropertyFieldDef } from './property-groups-config.ts';

const WIDTHS = ['0', '1', '2', '4', '8'] as const;
const RADII = ['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'full'] as const;

export const INDIVIDUAL_SIDE_FIELDS: readonly PropertyFieldDef[] = [
  { property: 'borderTopWidth', labelKey: 'inspector.fields.borderTopWidth', options: WIDTHS },
  { property: 'borderRightWidth', labelKey: 'inspector.fields.borderRightWidth', options: WIDTHS },
  {
    property: 'borderBottomWidth',
    labelKey: 'inspector.fields.borderBottomWidth',
    options: WIDTHS,
  },
  { property: 'borderLeftWidth', labelKey: 'inspector.fields.borderLeftWidth', options: WIDTHS },
  {
    property: 'borderStyle',
    labelKey: 'inspector.fields.borderStyle',
    options: ['solid', 'dashed', 'dotted', 'none'],
  },
];

export const INDIVIDUAL_CORNER_FIELDS: readonly PropertyFieldDef[] = [
  {
    property: 'borderTopLeftRadius',
    labelKey: 'inspector.fields.borderTopLeftRadius',
    options: RADII,
  },
  {
    property: 'borderTopRightRadius',
    labelKey: 'inspector.fields.borderTopRightRadius',
    options: RADII,
  },
  {
    property: 'borderBottomRightRadius',
    labelKey: 'inspector.fields.borderBottomRightRadius',
    options: RADII,
  },
  {
    property: 'borderBottomLeftRadius',
    labelKey: 'inspector.fields.borderBottomLeftRadius',
    options: RADII,
  },
];

const SIDE_WIDTHS: readonly PropertyId[] = [
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
];
const CORNER_RADII: readonly PropertyId[] = INDIVIDUAL_CORNER_FIELDS.map((f) => f.property);

const usesAny = (tokens: readonly ClassToken[], properties: readonly PropertyId[]): boolean =>
  tokens.some((t) => t.property !== undefined && properties.includes(t.property));

export const hasSideWidths = (tokens: readonly ClassToken[]): boolean =>
  usesAny(tokens, SIDE_WIDTHS);
export const hasCornerRadii = (tokens: readonly ClassToken[]): boolean =>
  usesAny(tokens, CORNER_RADII);

export function resolveBorderFields(
  showSides: boolean,
  showCorners: boolean,
  baseFields: readonly PropertyFieldDef[],
): readonly PropertyFieldDef[] {
  const widthFields = showSides
    ? INDIVIDUAL_SIDE_FIELDS
    : baseFields.filter((f) => f.property === 'borderWidth' || f.property === 'borderStyle');
  const radiusFields = showCorners
    ? INDIVIDUAL_CORNER_FIELDS
    : baseFields.filter((f) => f.property === 'borderRadius');
  return [...widthFields, ...radiusFields];
}

/** Every property a group can write, to count how many of them have a value. */
export function groupProperties(
  groupId: string,
  fields: readonly PropertyFieldDef[],
): readonly PropertyId[] {
  const own = fields.map((f) => f.property);
  return groupId === 'borders' ? [...own, ...SIDE_WIDTHS, ...CORNER_RADII] : own;
}
