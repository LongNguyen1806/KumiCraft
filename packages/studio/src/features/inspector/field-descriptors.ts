// Field descriptors for the Inspector panel (SPEC-04.1 section 11.2, WP-1.09 part B).
import type { StyleProps } from '@reactcraft/model';

export type FieldId =
  | 'padding-top'
  | 'padding-right'
  | 'padding-bottom'
  | 'padding-left'
  | 'gap'
  | 'direction'
  | 'opacity';

export type FieldGroup = 'layout' | 'spacing' | 'effects';

export type FieldKind = 'spacing-edge' | 'spacing' | 'enum' | 'number';

export type PaddingEdge = 'top' | 'right' | 'bottom' | 'left';

export type FieldLabelKey =
  | 'inspector.fields.direction'
  | 'inspector.fields.paddingTop'
  | 'inspector.fields.paddingRight'
  | 'inspector.fields.paddingBottom'
  | 'inspector.fields.paddingLeft'
  | 'inspector.fields.gap'
  | 'inspector.fields.opacity';

export type ValidationKey = 'inspector.validation.pxRange' | 'inspector.validation.opacityRange';

export type FieldDescriptor = {
  readonly id: FieldId;
  readonly labelKey: FieldLabelKey;
  readonly group: FieldGroup;
  readonly kind: FieldKind;
  readonly property: keyof StyleProps;
  readonly edge?: PaddingEdge;
  readonly hasToken: boolean;
  readonly validate: (value: string) => boolean;
  readonly validationMessageKey?: ValidationKey;
};

const validatePx = (value: string): boolean => {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return false;
  const num = Number(value.trim());
  return num >= 0 && num <= 10000;
};

const validateOpacity = (value: string): boolean => {
  if (!/^\d+$/.test(value.trim())) return false;
  const num = Number(value.trim());
  return num >= 0 && num <= 100 && num % 5 === 0;
};

const validateAlways = (): boolean => true;

export const FIELD_DESCRIPTORS: readonly FieldDescriptor[] = [
  // Layout group
  {
    id: 'direction',
    labelKey: 'inspector.fields.direction',
    group: 'layout',
    kind: 'enum',
    property: 'direction',
    hasToken: false,
    validate: validateAlways,
  },
  // Spacing group
  {
    id: 'padding-top',
    labelKey: 'inspector.fields.paddingTop',
    group: 'spacing',
    kind: 'spacing-edge',
    property: 'padding',
    edge: 'top',
    hasToken: true,
    validate: validatePx,
    validationMessageKey: 'inspector.validation.pxRange',
  },
  {
    id: 'padding-right',
    labelKey: 'inspector.fields.paddingRight',
    group: 'spacing',
    kind: 'spacing-edge',
    property: 'padding',
    edge: 'right',
    hasToken: true,
    validate: validatePx,
    validationMessageKey: 'inspector.validation.pxRange',
  },
  {
    id: 'padding-bottom',
    labelKey: 'inspector.fields.paddingBottom',
    group: 'spacing',
    kind: 'spacing-edge',
    property: 'padding',
    edge: 'bottom',
    hasToken: true,
    validate: validatePx,
    validationMessageKey: 'inspector.validation.pxRange',
  },
  {
    id: 'padding-left',
    labelKey: 'inspector.fields.paddingLeft',
    group: 'spacing',
    kind: 'spacing-edge',
    property: 'padding',
    edge: 'left',
    hasToken: true,
    validate: validatePx,
    validationMessageKey: 'inspector.validation.pxRange',
  },
  {
    id: 'gap',
    labelKey: 'inspector.fields.gap',
    group: 'spacing',
    kind: 'spacing',
    property: 'gap',
    hasToken: true,
    validate: validatePx,
    validationMessageKey: 'inspector.validation.pxRange',
  },
  // Effects group
  {
    id: 'opacity',
    labelKey: 'inspector.fields.opacity',
    group: 'effects',
    kind: 'number',
    property: 'opacity',
    hasToken: false,
    validate: validateOpacity,
    validationMessageKey: 'inspector.validation.opacityRange',
  },
];
