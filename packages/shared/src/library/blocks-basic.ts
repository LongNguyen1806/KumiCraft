// Basic library blocks: layout and content (R-LB-10, R-LB-11, R-LB-12, TK-43, TK-47, TK-48).
import { NEUTRAL_BLOCKS, SVG_PLACEHOLDER } from './blocks-neutral.ts';
import { HEADING_VARIANTS, PLACEHOLDER_IMAGE_VARIANTS } from './blocks-variants.ts';
import type { LibraryBlock } from './types.ts';

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
      vi: `<div className="flex flex-wrap gap-4">
  <div className="flex-1 basis-60 p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Cột 1</p>
  </div>
  <div className="flex-1 basis-60 p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Cột 2</p>
  </div>
</div>`,
      en: `<div className="flex flex-wrap gap-4">
  <div className="flex-1 basis-60 p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Column 1</p>
  </div>
  <div className="flex-1 basis-60 p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Column 2</p>
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
  <div className="p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Mục trên</p>
  </div>
  <div className="p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Mục dưới</p>
  </div>
</div>`,
      en: `<div className="flex flex-col gap-4">
  <div className="p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Top item</p>
  </div>
  <div className="p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Bottom item</p>
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
      vi: `<div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
  <div className="p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Ô 1</p>
  </div>
  <div className="p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Ô 2</p>
  </div>
</div>`,
      en: `<div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
  <div className="p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Cell 1</p>
  </div>
  <div className="p-4 bg-{surface-muted} rounded-{radius}">
    <p className="text-sm text-{muted}">Cell 2</p>
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
    <h2 className="text-2xl font-bold font-{heading} mb-4 text-{text}">Tiêu đề phần</h2>
    <p className="text-{muted}">Nội dung trong phần này.</p>
  </div>
</section>`,
      en: `<section className="py-12 px-4">
  <div className="max-w-5xl mx-auto">
    <h2 className="text-2xl font-bold font-{heading} mb-4 text-{text}">Section Title</h2>
    <p className="text-{muted}">Content inside this section.</p>
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
      vi: `<h2 className="text-2xl font-bold font-{heading} text-{text}">
  Tiêu đề bài viết
</h2>`,
      en: `<h2 className="text-2xl font-bold font-{heading} text-{text}">
  Article Heading
</h2>`,
    },
    neutral: NEUTRAL_BLOCKS['content.heading'],
    variants: HEADING_VARIANTS,
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
      vi: `<p className="text-base text-{muted} leading-relaxed">
  Đây là nội dung đoạn văn bản mẫu giúp bạn dễ dàng hình dung bố cục.
</p>`,
      en: `<p className="text-base text-{muted} leading-relaxed">
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
      vi: `<img src="${SVG_PLACEHOLDER}" alt="Hình ảnh mẫu" className="w-full max-w-full h-auto rounded-{radius} object-cover" />`,
      en: `<img src="${SVG_PLACEHOLDER}" alt="Sample image" className="w-full max-w-full h-auto rounded-{radius} object-cover" />`,
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
      vi: `<a href="#" className="text-{primary} hover:opacity-80 underline font-medium">
  Xem thêm chi tiết
</a>`,
      en: `<a href="#" className="text-{primary} hover:opacity-80 underline font-medium">
  Learn more details
</a>`,
    },
    neutral: NEUTRAL_BLOCKS['content.link'],
  },

  // 9b. Content: Bullet List
  {
    id: 'content.list',
    category: 'content',
    labelKey: 'library:blocks.list',
    keywords: {
      vi: ['danh sách', 'danh sach', 'liệt kê', 'list', 'ul', 'gạch đầu dòng'],
      en: ['list', 'bullet', 'ul', 'items'],
    },
    icon: 'List',
    jsx: {
      vi: `<ul className="list-disc pl-5 space-y-2 text-{text}">\n  <li>Mục thứ nhất</li>\n  <li>Mục thứ hai</li>\n  <li>Mục thứ ba</li>\n</ul>`,
      en: `<ul className="list-disc pl-5 space-y-2 text-{text}">\n  <li>First item</li>\n  <li>Second item</li>\n  <li>Third item</li>\n</ul>`,
    },
    neutral: NEUTRAL_BLOCKS['content.list'],
  },

  // 9c. Content: Ordered List
  {
    id: 'content.list-ordered',
    category: 'content',
    labelKey: 'library:blocks.listOrdered',
    keywords: {
      vi: ['danh sách số', 'danh sach so', 'thứ tự', 'ol', 'ordered'],
      en: ['ordered list', 'numbered', 'ol', 'steps'],
    },
    icon: 'ListOrdered',
    jsx: {
      vi: `<ol className="list-decimal pl-5 space-y-2 text-{text}">\n  <li>Bước thứ nhất</li>\n  <li>Bước thứ hai</li>\n  <li>Bước thứ ba</li>\n</ol>`,
      en: `<ol className="list-decimal pl-5 space-y-2 text-{text}">\n  <li>First step</li>\n  <li>Second step</li>\n  <li>Third step</li>\n</ol>`,
    },
    neutral: NEUTRAL_BLOCKS['content.list-ordered'],
  },

  // 9d. Content: Placeholder Image
  {
    id: 'content.placeholder-image',
    category: 'content',
    labelKey: 'library:blocks.placeholderImage',
    keywords: {
      vi: ['ảnh giữ chỗ', 'anh giu cho', 'khung ảnh', 'placeholder', 'image'],
      en: ['placeholder', 'image placeholder', 'aspect', 'frame'],
    },
    icon: 'Image',
    jsx: {
      vi: `<div className="w-full aspect-video bg-{surface-muted} border border-{border} rounded-{radius} flex items-center justify-center text-{muted}">\n  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">\n    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />\n    <circle cx="9" cy="9" r="2" />\n    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />\n  </svg>\n</div>`,
      en: `<div className="w-full aspect-video bg-{surface-muted} border border-{border} rounded-{radius} flex items-center justify-center text-{muted}">\n  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">\n    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />\n    <circle cx="9" cy="9" r="2" />\n    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />\n  </svg>\n</div>`,
    },
    neutral: NEUTRAL_BLOCKS['content.placeholder-image'],
    variants: PLACEHOLDER_IMAGE_VARIANTS,
  },
];
