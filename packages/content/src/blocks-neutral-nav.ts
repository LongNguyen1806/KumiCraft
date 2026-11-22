import type { NeutralBlock } from './types.ts';

export const NEUTRAL_NAV_BLOCKS = {
  'navigation.breadcrumb': {
    jsx: {
      vi: `<nav aria-label="Đường dẫn" className="@root">\n  <ol className="@list">\n    <li><a href="#" className="@link">Trang chủ</a></li>\n    <li className="@sep">/</li>\n    <li><a href="#" className="@link">Sản phẩm</a></li>\n    <li className="@sep">/</li>\n    <li aria-current="page" className="@current">Chi tiết</li>\n  </ol>\n</nav>`,
      en: `<nav aria-label="Breadcrumb" className="@root">\n  <ol className="@list">\n    <li><a href="#" className="@link">Home</a></li>\n    <li className="@sep">/</li>\n    <li><a href="#" className="@link">Products</a></li>\n    <li className="@sep">/</li>\n    <li aria-current="page" className="@current">Details</li>\n  </ol>\n</nav>`,
    },
    styles: {
      root: { width: '100%' },
      list: {
        display: 'flex',
        'flex-wrap': 'wrap',
        'align-items': 'center',
        gap: '8px',
        'list-style': 'none',
        margin: '0',
        padding: '0',
        'font-size': '14px',
      },
      link: { color: '{muted}', 'text-decoration': 'none' },
      sep: { color: '{muted}' },
      current: { color: '{text}', 'font-weight': '600' },
    },
    bootstrap: {
      root: 'mb-2',
      list: 'breadcrumb mb-0',
      link: 'breadcrumb-item text-decoration-none',
      sep: 'text-secondary',
      current: 'breadcrumb-item active',
    },
  },
  'navigation.pagination': {
    jsx: {
      vi: `<nav aria-label="Phân trang" className="@root">\n  <a href="#" className="@item">Trước</a>\n  <a href="#" aria-current="page" className="@active">1</a>\n  <a href="#" className="@item">2</a>\n  <a href="#" className="@item">3</a>\n  <a href="#" className="@item">Sau</a>\n</nav>`,
      en: `<nav aria-label="Pagination" className="@root">\n  <a href="#" className="@item">Prev</a>\n  <a href="#" aria-current="page" className="@active">1</a>\n  <a href="#" className="@item">2</a>\n  <a href="#" className="@item">3</a>\n  <a href="#" className="@item">Next</a>\n</nav>`,
    },
    styles: {
      root: { display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center', gap: '8px' },
      item: {
        padding: '6px 12px',
        'font-size': '14px',
        color: '{text}',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
        'text-decoration': 'none',
      },
      active: {
        padding: '6px 12px',
        'font-size': '14px',
        'font-weight': '600',
        color: '{on-primary}',
        'background-color': '{primary}',
        border: '1px solid {primary}',
        'border-radius': '{radius}',
        'text-decoration': 'none',
      },
    },
    bootstrap: {
      root: 'pagination mb-0 gap-1',
      item: 'page-link rounded',
      active: 'page-link active rounded',
    },
  },
  'navigation.sidebar': {
    jsx: {
      vi: `<aside aria-label="Thanh điều hướng phụ" className="@root">\n  <p className="@heading">Tổng quan</p>\n  <nav className="@menu">\n    <a href="#" className="@active">Bảng điều khiển</a>\n    <a href="#" className="@link">Dự án</a>\n    <a href="#" className="@link">Thành viên</a>\n    <a href="#" className="@link">Cài đặt</a>\n  </nav>\n</aside>`,
      en: `<aside aria-label="Sidebar navigation" className="@root">\n  <p className="@heading">Overview</p>\n  <nav className="@menu">\n    <a href="#" className="@active">Dashboard</a>\n    <a href="#" className="@link">Projects</a>\n    <a href="#" className="@link">Members</a>\n    <a href="#" className="@link">Settings</a>\n  </nav>\n</aside>`,
    },
    styles: {
      root: {
        width: '100%',
        'max-width': '256px',
        padding: '16px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      heading: {
        'font-size': '12px',
        'font-weight': '600',
        'text-transform': 'uppercase',
        color: '{muted}',
        margin: '0 0 12px 10px',
      },
      menu: { display: 'flex', 'flex-direction': 'column', gap: '4px' },
      active: {
        padding: '8px 12px',
        'font-size': '14px',
        'font-weight': '600',
        color: '{on-primary}',
        'background-color': '{primary}',
        'border-radius': '{radius}',
        'text-decoration': 'none',
      },
      link: {
        padding: '8px 12px',
        'font-size': '14px',
        color: '{text}',
        'border-radius': '{radius}',
        'text-decoration': 'none',
      },
    },
    bootstrap: {
      root: 'p-3 bg-white border rounded',
      heading: 'small fw-semibold text-uppercase text-secondary mb-2 px-2',
      menu: 'nav nav-pills flex-column gap-1',
      active: 'nav-link active',
      link: 'nav-link text-body',
    },
  },
} satisfies Record<string, NeutralBlock>;
