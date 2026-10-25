// Basic library blocks: layout and content (R-LB-10, R-LB-11, R-LB-12).
import { NEUTRAL_BLOCKS } from './blocks-neutral.ts';
import type { LibraryBlock } from './types.ts';

const SVG_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg viewBox='0 0 400 300' fill='%23e5e7eb'%3E%3Crect width='400' height='300'/%3E%3C/svg%3E";

export const BASIC_BLOCKS: readonly LibraryBlock[] = [
  // 1. Layout: Row
  {
    id: 'layout.row',
    category: 'layout',
    labelKey: 'library:blocks.row',
    keywords: {
      vi: ['hàng', 'hang', 'ngang', 'flex-row'],
      en: ['row', 'horizontal', 'flex-row'],
    },
    icon: 'Rows',
    jsx: {
      vi: `<div className="flex flex-row gap-4">
  <div className="flex-1 p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Cột 1</p>
  </div>
  <div className="flex-1 p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Cột 2</p>
  </div>
</div>`,
      en: `<div className="flex flex-row gap-4">
  <div className="flex-1 p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Column 1</p>
  </div>
  <div className="flex-1 p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Column 2</p>
  </div>
</div>`,
    },
    neutral: NEUTRAL_BLOCKS['layout.row'],
  },

  // 2. Layout: Column
  {
    id: 'layout.column',
    category: 'layout',
    labelKey: 'library:blocks.column',
    keywords: {
      vi: ['cột', 'cot', 'dọc', 'flex-col'],
      en: ['column', 'vertical', 'flex-col'],
    },
    icon: 'Columns',
    jsx: {
      vi: `<div className="flex flex-col gap-4">
  <div className="p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Mục trên</p>
  </div>
  <div className="p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Mục dưới</p>
  </div>
</div>`,
      en: `<div className="flex flex-col gap-4">
  <div className="p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Top item</p>
  </div>
  <div className="p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Bottom item</p>
  </div>
</div>`,
    },
    neutral: NEUTRAL_BLOCKS['layout.column'],
  },

  // 3. Layout: Grid
  {
    id: 'layout.grid',
    category: 'layout',
    labelKey: 'library:blocks.grid',
    keywords: {
      vi: ['lưới', 'luoi', 'grid'],
      en: ['grid', 'cols', 'layout'],
    },
    icon: 'Grid',
    jsx: {
      vi: `<div className="grid grid-cols-2 gap-4">
  <div className="p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Ô 1</p>
  </div>
  <div className="p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Ô 2</p>
  </div>
</div>`,
      en: `<div className="grid grid-cols-2 gap-4">
  <div className="p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Cell 1</p>
  </div>
  <div className="p-4 bg-gray-100 rounded">
    <p className="text-sm text-gray-500">Cell 2</p>
  </div>
</div>`,
    },
    neutral: NEUTRAL_BLOCKS['layout.grid'],
  },

  // 4. Layout: Section
  {
    id: 'layout.section',
    category: 'layout',
    labelKey: 'library:blocks.section',
    keywords: {
      vi: ['phần', 'phan', 'khu vực', 'section'],
      en: ['section', 'container', 'block'],
    },
    icon: 'Square',
    jsx: {
      vi: `<section className="py-12 px-4">
  <div className="max-w-5xl mx-auto">
    <h2 className="text-2xl font-bold mb-4 text-gray-900">Tiêu đề phần</h2>
    <p className="text-gray-600">Nội dung trong phần này.</p>
  </div>
</section>`,
      en: `<section className="py-12 px-4">
  <div className="max-w-5xl mx-auto">
    <h2 className="text-2xl font-bold mb-4 text-gray-900">Section Title</h2>
    <p className="text-gray-600">Content inside this section.</p>
  </div>
</section>`,
    },
    neutral: NEUTRAL_BLOCKS['layout.section'],
  },

  // 5. Content: Heading
  {
    id: 'content.heading',
    category: 'content',
    labelKey: 'library:blocks.heading',
    keywords: {
      vi: ['tiêu đề', 'tieu de', 'heading', 'title', 'h2'],
      en: ['heading', 'title', 'headline', 'h2'],
    },
    icon: 'Heading',
    jsx: {
      vi: `<h2 className="text-2xl font-bold text-gray-900">
  Tiêu đề bài viết
</h2>`,
      en: `<h2 className="text-2xl font-bold text-gray-900">
  Article Heading
</h2>`,
    },
    neutral: NEUTRAL_BLOCKS['content.heading'],
  },

  // 6. Content: Paragraph
  {
    id: 'content.paragraph',
    category: 'content',
    labelKey: 'library:blocks.paragraph',
    keywords: {
      vi: ['đoạn văn', 'doan van', 'văn bản', 'chu', 'paragraph', 'text'],
      en: ['paragraph', 'text', 'body', 'content'],
    },
    icon: 'AlignLeft',
    jsx: {
      vi: `<p className="text-base text-gray-600 leading-relaxed">
  Đây là nội dung đoạn văn bản mẫu giúp bạn dễ dàng hình dung bố cục.
</p>`,
      en: `<p className="text-base text-gray-600 leading-relaxed">
  This is sample paragraph text to help you preview the visual layout.
</p>`,
    },
    neutral: NEUTRAL_BLOCKS['content.paragraph'],
  },

  // 7. Content: Image
  {
    id: 'content.image',
    category: 'content',
    labelKey: 'library:blocks.image',
    keywords: {
      vi: ['ảnh', 'anh', 'hình', 'hinh', 'image', 'picture', 'img'],
      en: ['image', 'picture', 'photo', 'img'],
    },
    icon: 'Image',
    jsx: {
      vi: `<img src="${SVG_PLACEHOLDER}" alt="Hình ảnh mẫu" className="w-full h-auto rounded-lg object-cover" />`,
      en: `<img src="${SVG_PLACEHOLDER}" alt="Sample image" className="w-full h-auto rounded-lg object-cover" />`,
    },
    neutral: NEUTRAL_BLOCKS['content.image'],
  },

  // 8. Content: Link
  {
    id: 'content.link',
    category: 'content',
    labelKey: 'library:blocks.link',
    keywords: {
      vi: ['liên kết', 'lien ket', 'đường dẫn', 'link', 'anchor'],
      en: ['link', 'anchor', 'url', 'href'],
    },
    icon: 'Link',
    jsx: {
      vi: `<a href="#" className="text-blue-600 hover:text-blue-800 underline font-medium">
  Xem thêm chi tiết
</a>`,
      en: `<a href="#" className="text-blue-600 hover:text-blue-800 underline font-medium">
  Learn more details
</a>`,
    },
    neutral: NEUTRAL_BLOCKS['content.link'],
  },
];
