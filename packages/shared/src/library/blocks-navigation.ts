import { NEUTRAL_NAV_BLOCKS } from './blocks-neutral-nav.ts';
import type { LibraryBlock } from './types.ts';

export const NAVIGATION_LIBRARY_BLOCKS: readonly LibraryBlock[] = [
  {
    id: 'navigation.breadcrumb',
    category: 'navigation',
    labelKey: 'library:blocks.breadcrumb',
    keywords: {
      vi: ['đường dẫn', 'duong dan', 'phân cấp', 'breadcrumb'],
      en: ['breadcrumb', 'trail', 'navigation', 'path'],
    },
    icon: 'ChevronRight',
    jsx: {
      vi: `<nav aria-label="Breadcrumb">\n  <ol className="flex flex-wrap items-center gap-2 text-sm text-{muted}">\n    <li><a href="#" className="hover:text-{text}">Trang chủ</a></li>\n    <li aria-hidden="true">/</li>\n    <li><a href="#" className="hover:text-{text}">Sản phẩm</a></li>\n    <li aria-hidden="true">/</li>\n    <li aria-current="page" className="font-semibold text-{text}">Chi tiết</li>\n  </ol>\n</nav>`,
      en: `<nav aria-label="Breadcrumb">\n  <ol className="flex flex-wrap items-center gap-2 text-sm text-{muted}">\n    <li><a href="#" className="hover:text-{text}">Home</a></li>\n    <li aria-hidden="true">/</li>\n    <li><a href="#" className="hover:text-{text}">Products</a></li>\n    <li aria-hidden="true">/</li>\n    <li aria-current="page" className="font-semibold text-{text}">Details</li>\n  </ol>\n</nav>`,
    },
    neutral: NEUTRAL_NAV_BLOCKS['navigation.breadcrumb'],
  },
  {
    id: 'navigation.pagination',
    category: 'navigation',
    labelKey: 'library:blocks.pagination',
    keywords: {
      vi: ['phân trang', 'phan trang', 'số trang', 'pagination'],
      en: ['pagination', 'pager', 'pages', 'next'],
    },
    icon: 'MoreHorizontal',
    jsx: {
      vi: `<nav aria-label="Phân trang" className="flex flex-wrap items-center gap-2">\n  <a href="#" className="px-3 py-1.5 text-sm border border-{border} rounded-{radius} bg-{surface} text-{text}">Trước</a>\n  <a href="#" aria-current="page" className="px-3 py-1.5 text-sm font-semibold rounded-{radius} bg-{primary} text-{on-primary}">1</a>\n  <a href="#" className="px-3 py-1.5 text-sm border border-{border} rounded-{radius} bg-{surface} text-{text}">2</a>\n  <a href="#" className="px-3 py-1.5 text-sm border border-{border} rounded-{radius} bg-{surface} text-{text}">3</a>\n  <a href="#" className="px-3 py-1.5 text-sm border border-{border} rounded-{radius} bg-{surface} text-{text}">Sau</a>\n</nav>`,
      en: `<nav aria-label="Pagination" className="flex flex-wrap items-center gap-2">\n  <a href="#" className="px-3 py-1.5 text-sm border border-{border} rounded-{radius} bg-{surface} text-{text}">Prev</a>\n  <a href="#" aria-current="page" className="px-3 py-1.5 text-sm font-semibold rounded-{radius} bg-{primary} text-{on-primary}">1</a>\n  <a href="#" className="px-3 py-1.5 text-sm border border-{border} rounded-{radius} bg-{surface} text-{text}">2</a>\n  <a href="#" className="px-3 py-1.5 text-sm border border-{border} rounded-{radius} bg-{surface} text-{text}">3</a>\n  <a href="#" className="px-3 py-1.5 text-sm border border-{border} rounded-{radius} bg-{surface} text-{text}">Next</a>\n</nav>`,
    },
    neutral: NEUTRAL_NAV_BLOCKS['navigation.pagination'],
  },
  {
    id: 'navigation.sidebar',
    category: 'navigation',
    labelKey: 'library:blocks.sidebar',
    keywords: {
      vi: ['thanh bên', 'thanh ben', 'menu dọc', 'sidebar'],
      en: ['sidebar', 'aside', 'vertical nav', 'menu'],
    },
    icon: 'PanelLeft',
    jsx: {
      vi: `<aside aria-label="Thanh điều hướng phụ" className="w-full max-w-64 p-4 bg-{surface} border border-{border} rounded-{radius}">\n  <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-wide text-{muted}">Tổng quan</p>\n  <nav className="flex flex-col gap-1">\n    <a href="#" className="px-3 py-2 text-sm font-semibold rounded-{radius} bg-{primary} text-{on-primary}">Bảng điều khiển</a>\n    <a href="#" className="px-3 py-2 text-sm rounded-{radius} text-{text} hover:bg-{surface-muted}">Dự án</a>\n    <a href="#" className="px-3 py-2 text-sm rounded-{radius} text-{text} hover:bg-{surface-muted}">Thành viên</a>\n    <a href="#" className="px-3 py-2 text-sm rounded-{radius} text-{text} hover:bg-{surface-muted}">Cài đặt</a>\n  </nav>\n</aside>`,
      en: `<aside aria-label="Sidebar navigation" className="w-full max-w-64 p-4 bg-{surface} border border-{border} rounded-{radius}">\n  <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-wide text-{muted}">Overview</p>\n  <nav className="flex flex-col gap-1">\n    <a href="#" className="px-3 py-2 text-sm font-semibold rounded-{radius} bg-{primary} text-{on-primary}">Dashboard</a>\n    <a href="#" className="px-3 py-2 text-sm rounded-{radius} text-{text} hover:bg-{surface-muted}">Projects</a>\n    <a href="#" className="px-3 py-2 text-sm rounded-{radius} text-{text} hover:bg-{surface-muted}">Members</a>\n    <a href="#" className="px-3 py-2 text-sm rounded-{radius} text-{text} hover:bg-{surface-muted}">Settings</a>\n  </nav>\n</aside>`,
    },
    neutral: NEUTRAL_NAV_BLOCKS['navigation.sidebar'],
  },
];
