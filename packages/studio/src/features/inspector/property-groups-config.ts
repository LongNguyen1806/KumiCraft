import type { PropertyId } from '@kumicraft/shared';
import type { ParseKeys } from 'i18next';

export type PropertyFieldDef = {
  readonly property: PropertyId;
  readonly labelKey: ParseKeys;
  readonly options?: readonly string[] | undefined;
};

export type PropertyGroupDef = {
  readonly id: string;
  readonly labelKey: ParseKeys;
  readonly fields: readonly PropertyFieldDef[];
};

export const PROPERTY_GROUPS: readonly PropertyGroupDef[] = [
  {
    id: 'layout',
    labelKey: 'inspector.groups.layout',
    fields: [
      {
        property: 'display',
        labelKey: 'inspector.fields.display',
        options: [
          'block',
          'inline-block',
          'inline',
          'flex',
          'inline-flex',
          'grid',
          'inline-grid',
          'hidden',
        ],
      },
      {
        property: 'flexDirection',
        labelKey: 'inspector.fields.flexDirection',
        options: ['row', 'row-reverse', 'col', 'col-reverse'],
      },
      {
        property: 'flexWrap',
        labelKey: 'inspector.fields.flexWrap',
        options: ['wrap', 'wrap-reverse', 'nowrap'],
      },
      {
        property: 'justifyContent',
        labelKey: 'inspector.fields.justifyContent',
        options: ['start', 'end', 'center', 'between', 'around', 'evenly'],
      },
      {
        property: 'alignItems',
        labelKey: 'inspector.fields.alignItems',
        options: ['start', 'end', 'center', 'baseline', 'stretch'],
      },
      {
        property: 'gap',
        labelKey: 'inspector.fields.gap',
        options: ['0', '1', '2', '4', '6', '8', '12'],
      },
      {
        property: 'gridCols',
        labelKey: 'inspector.fields.gridCols',
        options: ['1', '2', '3', '4', '6', '12'],
      },
    ],
  },
  {
    id: 'selfLayout',
    labelKey: 'inspector.groups.selfLayout',
    fields: [
      {
        property: 'alignSelf',
        labelKey: 'inspector.fields.alignSelf',
        options: ['auto', 'start', 'end', 'center', 'stretch'],
      },
      {
        property: 'flex',
        labelKey: 'inspector.fields.flex',
        options: ['1', 'auto', 'initial', 'none'],
      },
      { property: 'grow', labelKey: 'inspector.fields.grow', options: ['1', '0'] },
      { property: 'shrink', labelKey: 'inspector.fields.shrink', options: ['1', '0'] },
      {
        property: 'position',
        labelKey: 'inspector.fields.position',
        options: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
      },
      {
        property: 'zIndex',
        labelKey: 'inspector.fields.zIndex',
        options: ['0', '10', '20', '30', '40', '50', 'auto'],
      },
    ],
  },
  {
    id: 'sizing',
    labelKey: 'inspector.groups.sizing',
    fields: [
      {
        property: 'width',
        labelKey: 'inspector.fields.width',
        options: ['full', 'auto', '1/2', 'screen', 'fit'],
      },
      {
        property: 'height',
        labelKey: 'inspector.fields.height',
        options: ['full', 'auto', '16', 'screen', 'fit'],
      },
      {
        property: 'minWidth',
        labelKey: 'inspector.fields.minWidth',
        options: ['0', 'full', 'min', 'max', 'fit'],
      },
      {
        property: 'maxWidth',
        labelKey: 'inspector.fields.maxWidth',
        options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'full'],
      },
      {
        property: 'minHeight',
        labelKey: 'inspector.fields.minHeight',
        options: ['0', 'full', 'screen'],
      },
      {
        property: 'maxHeight',
        labelKey: 'inspector.fields.maxHeight',
        options: ['full', 'screen'],
      },
    ],
  },
  {
    id: 'spacing',
    labelKey: 'inspector.groups.spacing',
    fields: [
      {
        property: 'padding',
        labelKey: 'inspector.fields.padding',
        options: ['0', '1', '2', '4', '6', '8', '12'],
      },
      {
        property: 'paddingTop',
        labelKey: 'inspector.fields.paddingTop',
        options: ['0', '1', '2', '4', '6', '8'],
      },
      {
        property: 'paddingRight',
        labelKey: 'inspector.fields.paddingRight',
        options: ['0', '1', '2', '4', '6', '8'],
      },
      {
        property: 'paddingBottom',
        labelKey: 'inspector.fields.paddingBottom',
        options: ['0', '1', '2', '4', '6', '8'],
      },
      {
        property: 'paddingLeft',
        labelKey: 'inspector.fields.paddingLeft',
        options: ['0', '1', '2', '4', '6', '8'],
      },
      {
        property: 'margin',
        labelKey: 'inspector.fields.margin',
        options: ['auto', '0', '1', '2', '4', '6', '8'],
      },
      {
        property: 'marginTop',
        labelKey: 'inspector.fields.marginTop',
        options: ['auto', '0', '1', '2', '4', '8'],
      },
      {
        property: 'marginRight',
        labelKey: 'inspector.fields.marginRight',
        options: ['auto', '0', '1', '2', '4', '8'],
      },
      {
        property: 'marginBottom',
        labelKey: 'inspector.fields.marginBottom',
        options: ['auto', '0', '1', '2', '4', '8'],
      },
      {
        property: 'marginLeft',
        labelKey: 'inspector.fields.marginLeft',
        options: ['auto', '0', '1', '2', '4', '8'],
      },
    ],
  },
  {
    id: 'typography',
    labelKey: 'inspector.groups.typography',
    fields: [
      {
        property: 'fontSize',
        labelKey: 'inspector.fields.fontSize',
        options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'],
      },
      {
        property: 'fontWeight',
        labelKey: 'inspector.fields.fontWeight',
        options: ['light', 'normal', 'medium', 'semibold', 'bold', 'black'],
      },
      {
        property: 'fontFamily',
        labelKey: 'inspector.fields.fontFamily',
        options: ['sans', 'serif', 'mono'],
      },
      {
        property: 'textAlign',
        labelKey: 'inspector.fields.textAlign',
        options: ['left', 'center', 'right', 'justify'],
      },
      {
        property: 'lineHeight',
        labelKey: 'inspector.fields.lineHeight',
        options: ['none', 'tight', 'normal', 'relaxed', 'loose'],
      },
      {
        property: 'letterSpacing',
        labelKey: 'inspector.fields.letterSpacing',
        options: ['tighter', 'tight', 'normal', 'wide', 'wider'],
      },
      {
        property: 'textTransform',
        labelKey: 'inspector.fields.textTransform',
        options: ['uppercase', 'lowercase', 'capitalize', 'normal-case'],
      },
      {
        property: 'textDecoration',
        labelKey: 'inspector.fields.textDecoration',
        options: ['underline', 'line-through', 'no-underline'],
      },
      {
        property: 'fontStyle',
        labelKey: 'inspector.fields.fontStyle',
        options: ['italic', 'not-italic'],
      },
    ],
  },
  {
    id: 'colors',
    labelKey: 'inspector.groups.colors',
    fields: [
      { property: 'textColor', labelKey: 'inspector.fields.textColor' },
      { property: 'backgroundColor', labelKey: 'inspector.fields.backgroundColor' },
      { property: 'borderColor', labelKey: 'inspector.fields.borderColor' },
    ],
  },
  {
    id: 'borders',
    labelKey: 'inspector.groups.borders',
    fields: [
      {
        property: 'borderWidth',
        labelKey: 'inspector.fields.borderWidth',
        options: ['0', '1', '2', '4', '8'],
      },
      {
        property: 'borderStyle',
        labelKey: 'inspector.fields.borderStyle',
        options: ['solid', 'dashed', 'dotted', 'none'],
      },
      {
        property: 'borderRadius',
        labelKey: 'inspector.fields.borderRadius',
        options: ['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'full'],
      },
    ],
  },
  {
    id: 'effects',
    labelKey: 'inspector.groups.effects',
    fields: [
      {
        property: 'boxShadow',
        labelKey: 'inspector.fields.boxShadow',
        options: ['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl'],
      },
      {
        property: 'opacity',
        labelKey: 'inspector.fields.opacity',
        options: ['0', '25', '50', '75', '100'],
      },
    ],
  },
  {
    id: 'visibility',
    labelKey: 'inspector.groups.visibility',
    fields: [
      {
        property: 'overflow',
        labelKey: 'inspector.fields.overflow',
        options: ['auto', 'hidden', 'visible', 'scroll'],
      },
      {
        property: 'visibility',
        labelKey: 'inspector.fields.visibility',
        options: ['visible', 'invisible'],
      },
      {
        property: 'objectFit',
        labelKey: 'inspector.fields.objectFit',
        options: ['contain', 'cover', 'fill', 'none'],
      },
    ],
  },
];
