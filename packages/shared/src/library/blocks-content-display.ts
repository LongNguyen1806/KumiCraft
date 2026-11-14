import { NEUTRAL_DISPLAY_BLOCKS } from './blocks-neutral-display.ts';
import type { LibraryBlock, LibraryBlockVariant, NeutralBlock } from './types.ts';

function alertNeutral(bg: string, fg: string, bs: string): NeutralBlock {
  return {
    jsx: {
      vi: `<div role="alert" className="@root">\n  <p className="@title">Thông báo hệ thống</p>\n  <p className="@body">Dữ liệu của bạn đã được đồng bộ an toàn.</p>\n</div>`,
      en: `<div role="alert" className="@root">\n  <p className="@title">System notice</p>\n  <p className="@body">Your changes have been saved safely.</p>\n</div>`,
    },
    styles: {
      root: {
        padding: '14px 16px',
        'background-color': bg,
        border: `1px solid ${fg}`,
        'border-radius': '{radius}',
      },
      title: { 'font-size': '14px', 'font-weight': '600', color: fg, margin: '0 0 4px 0' },
      body: { 'font-size': '13px', color: '{text}', margin: '0' },
    },
    bootstrap: { root: `alert ${bs}`, title: 'fw-semibold mb-1', body: 'mb-0 small' },
  };
}

const ALERT_INFO: LibraryBlockVariant = {
  id: 'info',
  labelKey: 'library:variants.info',
  jsx: {
    vi: `<div role="alert" className="p-4 rounded-{radius} border border-{primary} bg-{surface-muted}">\n  <p className="text-sm font-semibold text-{primary}">Thông tin</p>\n  <p className="text-sm text-{text} mt-1">Phiên bản mới đã sẵn sàng để cập nhật.</p>\n</div>`,
    en: `<div role="alert" className="p-4 rounded-{radius} border border-{primary} bg-{surface-muted}">\n  <p className="text-sm font-semibold text-{primary}">Information</p>\n  <p className="text-sm text-{text} mt-1">A new update is ready to install.</p>\n</div>`,
  },
  neutral: alertNeutral('{surface-muted}', '{primary}', 'alert-info'),
};

export const ALERT_VARIANTS: readonly LibraryBlockVariant[] = [
  ALERT_INFO,
  {
    id: 'success',
    labelKey: 'library:variants.success',
    jsx: {
      vi: `<div role="alert" className="p-4 rounded-{radius} border border-emerald-300 bg-emerald-50 text-emerald-900">\n  <p className="text-sm font-semibold">Thành công</p>\n  <p className="text-sm mt-1">Các thay đổi đã được lưu thành công.</p>\n</div>`,
      en: `<div role="alert" className="p-4 rounded-{radius} border border-emerald-300 bg-emerald-50 text-emerald-900">\n  <p className="text-sm font-semibold">Success</p>\n  <p className="text-sm mt-1">Your changes have been saved successfully.</p>\n</div>`,
    },
    neutral: alertNeutral('#ecfdf5', '#065f46', 'alert-success'),
  },
  {
    id: 'warn',
    labelKey: 'library:variants.warn',
    jsx: {
      vi: `<div role="alert" className="p-4 rounded-{radius} border border-amber-300 bg-amber-50 text-amber-900">\n  <p className="text-sm font-semibold">Cảnh báo</p>\n  <p className="text-sm mt-1">Dung lượng lưu trữ sắp đạt giới hạn.</p>\n</div>`,
      en: `<div role="alert" className="p-4 rounded-{radius} border border-amber-300 bg-amber-50 text-amber-900">\n  <p className="text-sm font-semibold">Warning</p>\n  <p className="text-sm mt-1">Storage capacity is almost full.</p>\n</div>`,
    },
    neutral: alertNeutral('#fffbeb', '#92400e', 'alert-warning'),
  },
  {
    id: 'error',
    labelKey: 'library:variants.error',
    jsx: {
      vi: `<div role="alert" className="p-4 rounded-{radius} border border-rose-300 bg-rose-50 text-rose-900">\n  <p className="text-sm font-semibold">Lỗi kết nối</p>\n  <p className="text-sm mt-1">Không thể kết nối máy chủ, vui lòng thử lại.</p>\n</div>`,
      en: `<div role="alert" className="p-4 rounded-{radius} border border-rose-300 bg-rose-50 text-rose-900">\n  <p className="text-sm font-semibold">Connection error</p>\n  <p className="text-sm mt-1">Could not reach the server. Please try again.</p>\n</div>`,
    },
    neutral: alertNeutral('#fff1f2', '#9f1239', 'alert-danger'),
  },
];

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
    id: 'display.alert',
    category: 'display',
    labelKey: 'library:blocks.alert',
    keywords: {
      vi: ['cảnh báo', 'thông báo', 'alert', 'thong bao', 'banner'],
      en: ['alert', 'notice', 'banner', 'callout', 'warning'],
    },
    icon: 'AlertCircle',
    jsx: ALERT_INFO.jsx,
    neutral: ALERT_INFO.neutral,
    variants: ALERT_VARIANTS,
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
