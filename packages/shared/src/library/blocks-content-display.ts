import { NEUTRAL_DISPLAY_BLOCKS } from './blocks-neutral-display.ts';
import type { LibraryBlock } from './types.ts';

export const CONTENT_DISPLAY_EXTRA_BLOCKS: readonly LibraryBlock[] = [
  {
    id: 'content.quote',
    category: 'content',
    labelKey: 'library:blocks.quote',
    keywords: {
      vi: ['trích dẫn', 'trich dan', 'câu nói', 'quote', 'blockquote'],
      en: ['quote', 'blockquote', 'citation'],
    },
    icon: 'Quote',
    jsx: {
      vi: `<blockquote className="p-5 bg-{surface-muted} border-l-4 border-{primary} rounded-{radius}">\n  <p className="text-base italic text-{text} mb-2">“Thiết kế tốt là làm cho sản phẩm dễ hiểu một cách tự nhiên.”</p>\n  <footer className="text-xs text-{muted}">— Nhóm Thiết kế</footer>\n</blockquote>`,
      en: `<blockquote className="p-5 bg-{surface-muted} border-l-4 border-{primary} rounded-{radius}">\n  <p className="text-base italic text-{text} mb-2">“Good design makes a product naturally understandable.”</p>\n  <footer className="text-xs text-{muted}">— Design Team</footer>\n</blockquote>`,
    },
    neutral: NEUTRAL_DISPLAY_BLOCKS['content.quote'],
  },
  {
    id: 'content.divider',
    category: 'content',
    labelKey: 'library:blocks.divider',
    keywords: {
      vi: ['đường kẻ', 'phân cách', 'duong ke', 'hr', 'divider'],
      en: ['divider', 'separator', 'hr', 'line'],
    },
    icon: 'Minus',
    jsx: {
      vi: `<hr className="my-6 border-t border-{border} w-full" />`,
      en: `<hr className="my-6 border-t border-{border} w-full" />`,
    },
    neutral: NEUTRAL_DISPLAY_BLOCKS['content.divider'],
  },
  {
    id: 'content.spacer',
    category: 'content',
    labelKey: 'library:blocks.spacer',
    keywords: {
      vi: ['khoảng trống', 'khoang trong', 'đệm', 'spacer'],
      en: ['spacer', 'gap', 'whitespace', 'space'],
    },
    icon: 'MoveVertical',
    jsx: {
      vi: `<div aria-hidden="true" className="h-12 w-full" />`,
      en: `<div aria-hidden="true" className="h-12 w-full" />`,
    },
    neutral: NEUTRAL_DISPLAY_BLOCKS['content.spacer'],
  },
  {
    id: 'content.video',
    category: 'content',
    labelKey: 'library:blocks.video',
    keywords: {
      vi: ['video', 'phát video', 'nhúng', 'iframe'],
      en: ['video', 'embed', 'iframe', 'media'],
    },
    icon: 'PlayCircle',
    jsx: {
      vi: `<div className="w-full aspect-video bg-{surface-muted} border border-{border} rounded-{radius} overflow-hidden">\n  <iframe src="" title="Trình phát video" className="w-full h-full border-0" />\n</div>`,
      en: `<div className="w-full aspect-video bg-{surface-muted} border border-{border} rounded-{radius} overflow-hidden">\n  <iframe src="" title="Video player" className="w-full h-full border-0" />\n</div>`,
    },
    neutral: NEUTRAL_DISPLAY_BLOCKS['content.video'],
  },
  {
    id: 'display.badge',
    category: 'display',
    labelKey: 'library:blocks.badge',
    keywords: {
      vi: ['nhãn', 'huy hiệu', 'nhan', 'badge', 'tag', 'pill'],
      en: ['badge', 'pill', 'tag', 'status', 'label'],
    },
    icon: 'Tag',
    jsx: {
      vi: `<span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-{surface-muted} text-{primary} border border-{border}">Mới ra mắt</span>`,
      en: `<span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-{surface-muted} text-{primary} border border-{border}">New release</span>`,
    },
    neutral: NEUTRAL_DISPLAY_BLOCKS['display.badge'],
  },
  {
    id: 'display.avatar',
    category: 'display',
    labelKey: 'library:blocks.avatar',
    keywords: {
      vi: ['ảnh đại diện', 'hồ sơ', 'avatar', 'nguoi dung'],
      en: ['avatar', 'profile', 'user', 'initials'],
    },
    icon: 'User',
    jsx: {
      vi: `<div className="flex items-center gap-3">\n  <div className="w-11 h-11 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center text-sm font-bold">KA</div>\n  <div>\n    <p className="text-sm font-semibold text-{text}">Khánh An</p>\n    <p className="text-xs text-{muted}">Trưởng nhóm Thiết kế</p>\n  </div>\n</div>`,
      en: `<div className="flex items-center gap-3">\n  <div className="w-11 h-11 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center text-sm font-bold">KA</div>\n  <div>\n    <p className="text-sm font-semibold text-{text}">Alex Kim</p>\n    <p className="text-xs text-{muted}">Design Lead</p>\n  </div>\n</div>`,
    },
    neutral: NEUTRAL_DISPLAY_BLOCKS['display.avatar'],
  },
  {
    id: 'display.stat',
    category: 'display',
    labelKey: 'library:blocks.stat',
    keywords: {
      vi: ['chỉ số', 'thống kê', 'kpi', 'chi so', 'stat'],
      en: ['stat', 'metric', 'kpi', 'number'],
    },
    icon: 'TrendingUp',
    jsx: {
      vi: `<div className="min-w-0 p-5 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n  <p className="text-xs font-medium text-{muted} mb-1">Doanh thu tháng</p>\n  <p className="text-3xl font-bold font-{heading} text-{text} mb-1">128,4 triệu</p>\n  <p className="text-xs font-semibold text-{primary}">+14,2% so với tháng trước</p>\n</div>`,
      en: `<div className="min-w-0 p-5 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n  <p className="text-xs font-medium text-{muted} mb-1">Monthly revenue</p>\n  <p className="text-3xl font-bold font-{heading} text-{text} mb-1">$48,200</p>\n  <p className="text-xs font-semibold text-{primary}">+14.2% vs last month</p>\n</div>`,
    },
    neutral: NEUTRAL_DISPLAY_BLOCKS['display.stat'],
  },
  {
    id: 'display.progress',
    category: 'display',
    labelKey: 'library:blocks.progress',
    keywords: {
      vi: ['tiến độ', 'thanh tiến trình', 'tien do', 'progress'],
      en: ['progress', 'bar', 'loading', 'completion'],
    },
    icon: 'Activity',
    jsx: {
      vi: `<div className="flex flex-col gap-2">\n  <div className="flex items-center justify-between text-xs">\n    <span className="font-medium text-{text}">Tiến độ hoàn thành</span>\n    <span className="font-semibold text-{primary}">68%</span>\n  </div>\n  <div className="w-full h-2.5 bg-{surface-muted} rounded-full overflow-hidden">\n    <div className="w-2/3 h-full bg-{primary} rounded-full" />\n  </div>\n</div>`,
      en: `<div className="flex flex-col gap-2">\n  <div className="flex items-center justify-between text-xs">\n    <span className="font-medium text-{text}">Completion progress</span>\n    <span className="font-semibold text-{primary}">68%</span>\n  </div>\n  <div className="w-full h-2.5 bg-{surface-muted} rounded-full overflow-hidden">\n    <div className="w-2/3 h-full bg-{primary} rounded-full" />\n  </div>\n</div>`,
    },
    neutral: NEUTRAL_DISPLAY_BLOCKS['display.progress'],
  },
];
