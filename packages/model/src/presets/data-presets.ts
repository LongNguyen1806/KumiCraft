// Data presets (SPEC-04.1 section 10.2): shown with sample rows until bound in Phase 4.
import type { DesignNode } from '../schema/node.schema.ts';
import type { Preset, PresetContext } from './types.ts';

const isVi = (locale?: string) => locale?.startsWith('vi') === true;

function createTable(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'Table',
    content: {
      kind: 'table',
      columns: [
        { id: 'col_1', header: vi ? 'Cột 1' : 'Column 1' },
        { id: 'col_2', header: vi ? 'Cột 2' : 'Column 2' },
        { id: 'col_3', header: vi ? 'Cột 3' : 'Column 3' },
      ],
      emptyText: vi ? 'Chưa có dữ liệu' : 'No data',
    },
  };
}

function createList(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  return {
    id: 'tmp_1',
    type: 'List',
    content: { kind: 'list', emptyText: vi ? 'Danh sách trống' : 'Empty list' },
    children: [
      {
        id: 'tmp_2',
        type: 'Card',
        content: { kind: 'none' },
        style: {
          padding: {
            top: 'token:spacing.4',
            bottom: 'token:spacing.4',
            left: 'token:spacing.4',
            right: 'token:spacing.4',
          },
          radius: 'token:radius.md',
        },
        children: [
          {
            id: 'tmp_3',
            type: 'Text',
            content: { kind: 'text', text: vi ? 'Mục danh sách mẫu' : 'Sample list item' },
          },
        ],
      },
    ],
  };
}

function createDetailView(ctx?: PresetContext): DesignNode {
  const vi = isVi(ctx?.contentLocale);
  const pairs = [
    [vi ? 'Nhãn 1' : 'Label 1', vi ? 'Giá trị 1' : 'Value 1'],
    [vi ? 'Nhãn 2' : 'Label 2', vi ? 'Giá trị 2' : 'Value 2'],
    [vi ? 'Nhãn 3' : 'Label 3', vi ? 'Giá trị 3' : 'Value 3'],
  ];
  return {
    id: 'tmp_1',
    type: 'DetailView',
    content: { kind: 'detail' },
    style: { direction: 'column', gap: 'token:spacing.2' },
    children: pairs.map(([lbl, val], i) => ({
      id: `tmp_${String(i * 3 + 2)}`,
      type: 'Stack' as const,
      content: { kind: 'none' as const },
      style: { direction: 'row' as const, gap: 'token:spacing.2' as const },
      children: [
        {
          id: `tmp_${String(i * 3 + 3)}`,
          type: 'Text' as const,
          content: { kind: 'text' as const, text: lbl as string },
          style: { fontWeight: 'token:fontWeight.bold' as const },
        },
        {
          id: `tmp_${String(i * 3 + 4)}`,
          type: 'Text' as const,
          content: { kind: 'text' as const, text: val as string },
        },
      ],
    })),
  };
}

export const DATA_PRESETS: readonly Preset[] = [
  {
    id: 'data.table',
    category: 'data',
    labelKey: 'presets.table',
    icon: 'Table',
    create: createTable,
  },
  { id: 'data.list', category: 'data', labelKey: 'presets.list', icon: 'List', create: createList },
  {
    id: 'data.detail-view',
    category: 'data',
    labelKey: 'presets.detailView',
    icon: 'FileText',
    create: createDetailView,
  },
];
