import { NEUTRAL_INTERACTIVE_BLOCKS } from './blocks-neutral-interactive.ts';
import type { LibraryBlock } from './types.ts';

export const INTERACTIVE_LIBRARY_BLOCKS: readonly LibraryBlock[] = [
  {
    id: 'interactive.tabs',
    category: 'interactive',
    labelKey: 'library:blocks.tabs',
    keywords: {
      vi: ['tab', 'thẻ chuyển', 'chuyen tab', 'tabs'],
      en: ['tabs', 'tab', 'panel', 'switch view'],
    },
    icon: 'FolderKanban',
    jsx: {
      vi: `<Tabs className="p-4 bg-{surface} border border-{border} rounded-{radius}">\n  <Tab label="Tổng quan">\n    <p className="text-sm text-{text}">Nội dung tổng quan của thẻ thứ nhất.</p>\n  </Tab>\n  <Tab label="Chi tiết">\n    <p className="text-sm text-{text}">Thông tin kỹ thuật ở thẻ thứ hai.</p>\n  </Tab>\n  <Tab label="Hỏi đáp">\n    <p className="text-sm text-{text}">Giải đáp nhanh ở thẻ thứ ba.</p>\n  </Tab>\n</Tabs>`,
      en: `<Tabs className="p-4 bg-{surface} border border-{border} rounded-{radius}">\n  <Tab label="Overview">\n    <p className="text-sm text-{text}">Overview summary inside the first tab panel.</p>\n  </Tab>\n  <Tab label="Details">\n    <p className="text-sm text-{text}">Technical specifications inside the second panel.</p>\n  </Tab>\n  <Tab label="FAQ">\n    <p className="text-sm text-{text}">Common questions answered in the third panel.</p>\n  </Tab>\n</Tabs>`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.tabs'],
    kit: { components: ['Tabs', 'Tab'] },
  },
  {
    id: 'interactive.accordion',
    category: 'interactive',
    labelKey: 'library:blocks.accordion',
    keywords: {
      vi: ['mở đóng', 'xếp gọn', 'accordion', 'mo dong', 'details'],
      en: ['accordion', 'collapse', 'disclosure', 'expand', 'details'],
    },
    icon: 'ChevronsUpDown',
    jsx: {
      vi: `<div className="flex flex-col gap-2">\n  <details className="p-4 bg-{surface} border border-{border} rounded-{radius}" open>\n    <summary className="text-sm font-semibold text-{text} cursor-pointer">Tính năng hoạt động như thế nào?</summary>\n    <p className="text-sm text-{muted} mt-2">Mọi khối dùng thẻ HTML chuẩn nên đóng mở mượt mà không cần cài thêm thư viện.</p>\n  </details>\n  <details className="p-4 bg-{surface} border border-{border} rounded-{radius}">\n    <summary className="text-sm font-semibold text-{text} cursor-pointer">Tôi có thể đổi nội dung trực tiếp?</summary>\n    <p className="text-sm text-{muted} mt-2">Nhấp đúp vào tiêu đề hoặc đoạn văn trên Canvas để sửa ngay.</p>\n  </details>\n</div>`,
      en: `<div className="flex flex-col gap-2">\n  <details className="p-4 bg-{surface} border border-{border} rounded-{radius}" open>\n    <summary className="text-sm font-semibold text-{text} cursor-pointer">How does this accordion work?</summary>\n    <p className="text-sm text-{muted} mt-2">It uses native disclosure elements for instant toggle without extra libraries.</p>\n  </details>\n  <details className="p-4 bg-{surface} border border-{border} rounded-{radius}">\n    <summary className="text-sm font-semibold text-{text} cursor-pointer">Can I edit text inline?</summary>\n    <p className="text-sm text-{muted} mt-2">Double-click any summary or paragraph directly on the canvas.</p>\n  </details>\n</div>`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.accordion'],
  },
  {
    id: 'interactive.toggle',
    category: 'interactive',
    labelKey: 'library:blocks.toggle',
    keywords: {
      vi: ['bật tắt', 'nút gạt', 'toggle', 'bat tat'],
      en: ['toggle', 'switch', 'state', 'on off'],
    },
    icon: 'ToggleLeft',
    jsx: {
      vi: `<Toggle label="Nhận thông báo tức thì" className="p-3 bg-{surface} border border-{border} rounded-{radius}" />`,
      en: `<Toggle label="Enable instant alerts" className="p-3 bg-{surface} border border-{border} rounded-{radius}" />`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.toggle'],
    kit: { components: ['Toggle'] },
  },
  {
    id: 'interactive.choice',
    category: 'interactive',
    labelKey: 'library:blocks.choice',
    keywords: {
      vi: ['lựa chọn', 'chọn một', 'segmented', 'choice', 'lua chon'],
      en: ['choice', 'segmented', 'options', 'selector'],
    },
    icon: 'CheckCircle2',
    jsx: {
      vi: `<Choice name="kc-tier" label="Chọn gói phù hợp" options="Cơ bản, Chuyên nghiệp, Doanh nghiệp" defaultValue="Cơ bản" className="p-4 bg-{surface} border border-{border} rounded-{radius}" />`,
      en: `<Choice name="kc-tier" label="Choose your plan" options="Starter, Pro, Enterprise" defaultValue="Starter" className="p-4 bg-{surface} border border-{border} rounded-{radius}" />`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.choice'],
    kit: { components: ['Choice'] },
  },
  {
    id: 'interactive.carousel',
    category: 'interactive',
    labelKey: 'library:blocks.carousel',
    keywords: {
      vi: ['trình chiếu', 'slide', 'carousel', 'trinh chieu'],
      en: ['carousel', 'slider', 'slides', 'gallery'],
    },
    icon: 'GalleryHorizontal',
    jsx: {
      vi: `<Carousel className="p-5 bg-{surface} border border-{border} rounded-{radius}">\n  <div className="p-3">\n    <h3 className="text-lg font-bold font-{heading} text-{text} mb-1">Slide 1: Bố cục tự động</h3>\n    <p className="text-sm text-{muted}">Tự xuống dòng gọn gàng trên mọi kích thước màn hình.</p>\n  </div>\n  <div className="p-3">\n    <h3 className="text-lg font-bold font-{heading} text-{text} mb-1">Slide 2: Đồng bộ thương hiệu</h3>\n    <p className="text-sm text-{muted}">Khớp ngay màu sắc và bo góc của dự án.</p>\n  </div>\n  <div className="p-3">\n    <h3 className="text-lg font-bold font-{heading} text-{text} mb-1">Slide 3: Chỉnh sửa trực tiếp</h3>\n    <p className="text-sm text-{muted}">Sửa từng dòng chữ ngay trên Canvas.</p>\n  </div>\n</Carousel>`,
      en: `<Carousel className="p-5 bg-{surface} border border-{border} rounded-{radius}">\n  <div className="p-3">\n    <h3 className="text-lg font-bold font-{heading} text-{text} mb-1">Slide 1: Responsive by default</h3>\n    <p className="text-sm text-{muted}">Wraps cleanly without complex breakpoint classes.</p>\n  </div>\n  <div className="p-3">\n    <h3 className="text-lg font-bold font-{heading} text-{text} mb-1">Slide 2: Brand synced</h3>\n    <p className="text-sm text-{muted}">Automatically matches project palette and corners.</p>\n  </div>\n  <div className="p-3">\n    <h3 className="text-lg font-bold font-{heading} text-{text} mb-1">Slide 3: Inline editing</h3>\n    <p className="text-sm text-{muted}">Update any headline right on the visual canvas.</p>\n  </div>\n</Carousel>`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.carousel'],
    kit: { components: ['Carousel'] },
  },
  {
    id: 'interactive.modal',
    category: 'interactive',
    labelKey: 'library:blocks.modal',
    keywords: {
      vi: ['hộp thoại', 'modal', 'hop thoai', 'dialog', 'popup'],
      en: ['modal', 'dialog', 'popup', 'overlay'],
    },
    icon: 'SquareStack',
    jsx: {
      vi: `<Modal triggerLabel="Mở hộp thoại" title="Xác nhận thay đổi" className="inline-block">\n  <p className="text-sm text-{muted}">Bạn có chắc chắn muốn áp dụng cấu hình này cho dự án?</p>\n</Modal>`,
      en: `<Modal triggerLabel="Open dialog" title="Confirm changes" className="inline-block">\n  <p className="text-sm text-{muted}">Are you sure you want to apply these workspace changes?</p>\n</Modal>`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.modal'],
    kit: { components: ['Modal'] },
  },
  {
    id: 'interactive.drawer',
    category: 'interactive',
    labelKey: 'library:blocks.drawer',
    keywords: {
      vi: ['ngăn kéo', 'ngan keo', 'drawer', 'sheet', 'trượt'],
      en: ['drawer', 'sheet', 'slideover', 'panel'],
    },
    icon: 'PanelRight',
    jsx: {
      vi: `<Drawer triggerLabel="Mở ngăn kéo" title="Bộ lọc hiển thị" className="inline-block">\n  <p className="text-sm text-{muted}">Điều chỉnh danh mục và tiêu chí lọc dữ liệu tại đây.</p>\n</Drawer>`,
      en: `<Drawer triggerLabel="Open drawer" title="Display filters" className="inline-block">\n  <p className="text-sm text-{muted}">Adjust categories and display filters inside this panel.</p>\n</Drawer>`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.drawer'],
    kit: { components: ['Drawer'] },
  },
  {
    id: 'interactive.dropdown',
    category: 'interactive',
    labelKey: 'library:blocks.dropdown',
    keywords: {
      vi: ['menu thả', 'xổ xuống', 'dropdown', 'tùy chọn'],
      en: ['dropdown', 'menu', 'popover', 'actions'],
    },
    icon: 'ChevronDownSquare',
    jsx: {
      vi: `<Dropdown triggerLabel="Tùy chọn" className="inline-block">\n  <button type="button" className="w-full text-left px-3 py-1.5 text-sm text-{text} hover:bg-{surface-muted} rounded">Chỉnh sửa</button>\n  <button type="button" className="w-full text-left px-3 py-1.5 text-sm text-{text} hover:bg-{surface-muted} rounded">Nhân bản</button>\n  <button type="button" className="w-full text-left px-3 py-1.5 text-sm text-{text} hover:bg-{surface-muted} rounded">Xóa mục</button>\n</Dropdown>`,
      en: `<Dropdown triggerLabel="Actions" className="inline-block">\n  <button type="button" className="w-full text-left px-3 py-1.5 text-sm text-{text} hover:bg-{surface-muted} rounded">Edit item</button>\n  <button type="button" className="w-full text-left px-3 py-1.5 text-sm text-{text} hover:bg-{surface-muted} rounded">Duplicate</button>\n  <button type="button" className="w-full text-left px-3 py-1.5 text-sm text-{text} hover:bg-{surface-muted} rounded">Delete</button>\n</Dropdown>`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.dropdown'],
    kit: { components: ['Dropdown'] },
  },
  {
    id: 'interactive.tooltip',
    category: 'interactive',
    labelKey: 'library:blocks.tooltip',
    keywords: {
      vi: ['chú thích', 'gợi ý', 'tooltip', 'chu thich'],
      en: ['tooltip', 'hint', 'popover', 'info'],
    },
    icon: 'Info',
    jsx: {
      vi: `<Tooltip label="Di chuột xem gợi ý" content="Thông tin giải thích ngắn gọn cho thao tác này." className="inline-block" />`,
      en: `<Tooltip label="Hover for tip" content="Brief helpful context explaining this action." className="inline-block" />`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.tooltip'],
    kit: { components: ['Tooltip'] },
  },
  {
    id: 'interactive.mobile-menu',
    category: 'interactive',
    labelKey: 'library:blocks.mobileMenu',
    keywords: {
      vi: ['menu di động', 'hamburger', 'mobile menu', 'điều hướng nhỏ'],
      en: ['mobile menu', 'hamburger', 'drawer nav', 'responsive nav'],
    },
    icon: 'Menu',
    jsx: {
      vi: `<MobileMenu brand="KumiCraft" className="w-full bg-{surface} border border-{border} rounded-{radius}">\n  <a href="#" className="text-sm text-{text} hover:underline">Trang chủ</a>\n  <a href="#" className="text-sm text-{text} hover:underline">Tính năng</a>\n  <a href="#" className="text-sm text-{text} hover:underline">Bảng giá</a>\n  <a href="#" className="text-sm text-{text} hover:underline">Liên hệ</a>\n</MobileMenu>`,
      en: `<MobileMenu brand="KumiCraft" className="w-full bg-{surface} border border-{border} rounded-{radius}">\n  <a href="#" className="text-sm text-{text} hover:underline">Home</a>\n  <a href="#" className="text-sm text-{text} hover:underline">Features</a>\n  <a href="#" className="text-sm text-{text} hover:underline">Pricing</a>\n  <a href="#" className="text-sm text-{text} hover:underline">Contact</a>\n</MobileMenu>`,
    },
    neutral: NEUTRAL_INTERACTIVE_BLOCKS['interactive.mobile-menu'],
    kit: { components: ['MobileMenu'] },
  },
];
