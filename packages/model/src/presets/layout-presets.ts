// Layout presets (SPEC-04.1 section 10.2).
import type { DesignNode } from '../schema/node.schema.ts';
import type { Preset } from './types.ts';

function createStackRow(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Stack',
    content: { kind: 'none' },
    style: { direction: 'row', gap: 'token:spacing.4', align: 'center' },
    children: [],
  };
}

function createStackColumn(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Stack',
    content: { kind: 'none' },
    style: { direction: 'column', gap: 'token:spacing.4' },
    children: [],
  };
}

function createGrid3Col(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Grid',
    content: { kind: 'none' },
    style: { columns: 3, gap: 'token:spacing.6' },
    children: [],
  };
}

function createGridAutoFit(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Grid',
    content: { kind: 'none' },
    style: { autoFit: { minColumnWidth: { px: 240 } }, gap: 'token:spacing.6' },
    children: [],
  };
}

function createSection(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Section',
    content: { kind: 'section', as: 'section' },
    style: {
      direction: 'column',
      width: 'fill',
      padding: {
        top: 'token:spacing.16',
        bottom: 'token:spacing.16',
        left: 'token:spacing.6',
        right: 'token:spacing.6',
      },
    },
    children: [],
  };
}

function createContainer(): DesignNode {
  return {
    id: 'tmp_1',
    type: 'Container',
    content: { kind: 'container', maxWidth: 'xl' },
    style: { padding: { left: 'token:spacing.6', right: 'token:spacing.6' } },
    children: [],
  };
}

export const LAYOUT_PRESETS: readonly Preset[] = [
  {
    id: 'layout.stack-row',
    category: 'layout',
    labelKey: 'presets.stackRow',
    icon: 'Rows',
    create: createStackRow,
  },
  {
    id: 'layout.stack-column',
    category: 'layout',
    labelKey: 'presets.stackColumn',
    icon: 'Columns',
    create: createStackColumn,
  },
  {
    id: 'layout.grid-3-col',
    category: 'layout',
    labelKey: 'presets.grid3Col',
    icon: 'Grid3X3',
    create: createGrid3Col,
  },
  {
    id: 'layout.grid-auto-fit',
    category: 'layout',
    labelKey: 'presets.gridAutoFit',
    icon: 'LayoutGrid',
    create: createGridAutoFit,
  },
  {
    id: 'layout.section',
    category: 'layout',
    labelKey: 'presets.section',
    icon: 'SquareSplitVertical',
    create: createSection,
  },
  {
    id: 'layout.container',
    category: 'layout',
    labelKey: 'presets.container',
    icon: 'Box',
    create: createContainer,
  },
];
