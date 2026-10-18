// Block library search (R-LB-13).
import { LIBRARY_BLOCKS, type LibraryBlock } from './blocks.ts';

export type LibraryBlockLabelsResolver = (id: string) => { vi: string; en: string };

const DEFAULT_LABELS: Record<string, { vi: string; en: string }> = {
  'layout.row': { vi: 'Hàng', en: 'Row' },
  'layout.column': { vi: 'Cột', en: 'Column' },
  'layout.grid': { vi: 'Lưới', en: 'Grid' },
  'layout.section': { vi: 'Phần', en: 'Section' },
  'content.heading': { vi: 'Tiêu đề', en: 'Heading' },
  'content.paragraph': { vi: 'Đoạn văn', en: 'Paragraph' },
  'content.image': { vi: 'Ảnh', en: 'Image' },
  'content.link': { vi: 'Liên kết', en: 'Link' },
  'form.button': { vi: 'Nút', en: 'Button' },
  'form.input': { vi: 'Ô nhập', en: 'Input' },
  'form.form': { vi: 'Biểu mẫu', en: 'Form' },
  'data.table': { vi: 'Bảng', en: 'Table' },
  'composite.card': { vi: 'Thẻ', en: 'Card' },
  'composite.navbar': { vi: 'Thanh điều hướng', en: 'Navbar' },
  'composite.footer': { vi: 'Chân trang', en: 'Footer' },
  'composite.hero': { vi: 'Hero', en: 'Hero' },
};

/** Normalize text for search: lowercase, NFD strip marks, đ/Đ -> d. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();
}

function resolveLabels(
  id: string,
  resolver?: LibraryBlockLabelsResolver | Record<string, { vi: string; en: string }>,
): { vi: string; en: string } {
  if (typeof resolver === 'function') {
    return resolver(id);
  }
  if (resolver && id in resolver) {
    const entry = resolver[id];
    if (entry !== undefined) return entry;
  }
  return DEFAULT_LABELS[id] ?? { vi: id, en: id };
}

function blockMatches(
  block: LibraryBlock,
  normQuery: string,
  labels: { vi: string; en: string },
): boolean {
  if (normalizeText(labels.vi).includes(normQuery)) return true;
  if (normalizeText(labels.en).includes(normQuery)) return true;
  const matchViKey = block.keywords.vi.some((k) => normalizeText(k).includes(normQuery));
  if (matchViKey) return true;
  return block.keywords.en.some((k) => normalizeText(k).includes(normQuery));
}

/** Search blocks by query matching labels (vi/en) and keywords (vi/en). */
export function searchBlocks(
  query: string,
  labels?: LibraryBlockLabelsResolver | Record<string, { vi: string; en: string }>,
  blocks: readonly LibraryBlock[] = LIBRARY_BLOCKS,
): readonly LibraryBlock[] {
  const normQuery = normalizeText(query);
  if (!normQuery) {
    return blocks;
  }
  return blocks.filter((b) => {
    const l = resolveLabels(b.id, labels);
    return blockMatches(b, normQuery, l);
  });
}
