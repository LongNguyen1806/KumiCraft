// Neutral definitions for the 16 starter library blocks (SPEC-04 R-ST-12, spec-log #68).
import type { NeutralBlock } from './types.ts';

const SVG_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg viewBox='0 0 400 300' fill='%23e5e7eb'%3E%3Crect width='400' height='300'/%3E%3C/svg%3E";

export const NEUTRAL_BLOCKS = {
  'layout.row': {
    jsx: {
      vi: `<div className="@root">\n  <div className="@cell">\n    <p className="@text">Cột 1</p>\n  </div>\n  <div className="@cell">\n    <p className="@text">Cột 2</p>\n  </div>\n</div>`,
      en: `<div className="@root">\n  <div className="@cell">\n    <p className="@text">Column 1</p>\n  </div>\n  <div className="@cell">\n    <p className="@text">Column 2</p>\n  </div>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-direction': 'row', gap: '16px' },
      cell: {
        flex: '1 1 0%',
        padding: '16px',
        'background-color': '#f3f4f6',
        'border-radius': '4px',
      },
      text: { 'font-size': '14px', 'line-height': '20px', color: '#6b7280' },
    },
    bootstrap: {
      root: 'row g-3',
      cell: 'col p-3 bg-light rounded',
      text: 'small text-secondary mb-0',
    },
  },
  'layout.column': {
    jsx: {
      vi: `<div className="@root">\n  <div className="@item">\n    <p className="@text">Mục trên</p>\n  </div>\n  <div className="@item">\n    <p className="@text">Mục dưới</p>\n  </div>\n</div>`,
      en: `<div className="@root">\n  <div className="@item">\n    <p className="@text">Top item</p>\n  </div>\n  <div className="@item">\n    <p className="@text">Bottom item</p>\n  </div>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-direction': 'column', gap: '16px' },
      item: { padding: '16px', 'background-color': '#f3f4f6', 'border-radius': '4px' },
      text: { 'font-size': '14px', 'line-height': '20px', color: '#6b7280' },
    },
    bootstrap: {
      root: 'd-flex flex-column gap-3',
      item: 'p-3 bg-light rounded',
      text: 'small text-secondary mb-0',
    },
  },
  'layout.grid': {
    jsx: {
      vi: `<div className="@root">\n  <div className="@cell">\n    <p className="@text">Ô 1</p>\n  </div>\n  <div className="@cell">\n    <p className="@text">Ô 2</p>\n  </div>\n</div>`,
      en: `<div className="@root">\n  <div className="@cell">\n    <p className="@text">Cell 1</p>\n  </div>\n  <div className="@cell">\n    <p className="@text">Cell 2</p>\n  </div>\n</div>`,
    },
    styles: {
      root: { display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '16px' },
      cell: { padding: '16px', 'background-color': '#f3f4f6', 'border-radius': '4px' },
      text: { 'font-size': '14px', 'line-height': '20px', color: '#6b7280' },
    },
    bootstrap: {
      root: 'row row-cols-2 g-3',
      cell: 'col p-3 bg-light rounded',
      text: 'small text-secondary mb-0',
    },
  },
  'layout.section': {
    jsx: {
      vi: `<section className="@root">\n  <div className="@inner">\n    <h2 className="@title">Tiêu đề phần</h2>\n    <p className="@body">Nội dung trong phần này.</p>\n  </div>\n</section>`,
      en: `<section className="@root">\n  <div className="@inner">\n    <h2 className="@title">Section Title</h2>\n    <p className="@body">Content inside this section.</p>\n  </div>\n</section>`,
    },
    styles: {
      root: { padding: '48px 16px' },
      inner: { 'max-width': '1024px', 'margin-left': 'auto', 'margin-right': 'auto' },
      title: {
        'font-size': '24px',
        'line-height': '32px',
        'font-weight': '700',
        'margin-bottom': '16px',
        color: '#111827',
      },
      body: { color: '#4b5563' },
    },
    bootstrap: {
      root: 'py-5 px-3',
      inner: 'container',
      title: 'h3 fw-bold mb-3',
      body: 'text-secondary',
    },
  },
  'content.heading': {
    jsx: {
      vi: `<h2 className="@root">\n  Tiêu đề bài viết\n</h2>`,
      en: `<h2 className="@root">\n  Article Heading\n</h2>`,
    },
    styles: {
      root: { 'font-size': '24px', 'line-height': '32px', 'font-weight': '700', color: '#111827' },
    },
    bootstrap: {
      root: 'h2 fw-bold',
    },
  },
  'content.paragraph': {
    jsx: {
      vi: `<p className="@root">\n  Đây là nội dung đoạn văn bản mẫu giúp bạn dễ dàng hình dung bố cục.\n</p>`,
      en: `<p className="@root">\n  This is sample paragraph text to help you preview the visual layout.\n</p>`,
    },
    styles: {
      root: { 'font-size': '16px', 'line-height': '1.625', color: '#4b5563' },
    },
    bootstrap: {
      root: 'text-secondary',
    },
  },
  'content.image': {
    jsx: {
      vi: `<img src="${SVG_PLACEHOLDER}" alt="Hình ảnh mẫu" className="@root" />`,
      en: `<img src="${SVG_PLACEHOLDER}" alt="Sample image" className="@root" />`,
    },
    styles: {
      root: { width: '100%', height: 'auto', 'border-radius': '8px', 'object-fit': 'cover' },
    },
    bootstrap: {
      root: 'img-fluid rounded',
    },
  },
  'content.link': {
    jsx: {
      vi: `<a href="#" className="@root">\n  Xem thêm chi tiết\n</a>`,
      en: `<a href="#" className="@root">\n  Learn more details\n</a>`,
    },
    styles: {
      root: { color: '#2563eb', 'text-decoration': 'underline', 'font-weight': '500' },
    },
    bootstrap: {
      root: 'link-primary fw-medium',
    },
  },
  'form.button': {
    jsx: {
      vi: `<button type="button" className="@root">\n  Bấm vào đây\n</button>`,
      en: `<button type="button" className="@root">\n  Click here\n</button>`,
    },
    styles: {
      root: {
        padding: '8px 16px',
        'background-color': '#2563eb',
        color: '#ffffff',
        'border-radius': '6px',
        'font-weight': '500',
        border: 'none',
      },
    },
    bootstrap: {
      root: 'btn btn-primary',
    },
  },
  'form.input': {
    jsx: {
      vi: `<div className="@root">\n  <label className="@label">\n    Họ và tên\n  </label>\n  <input type="text" placeholder="Nhập văn bản..." className="@field" />\n</div>`,
      en: `<div className="@root">\n  <label className="@label">\n    Full Name\n  </label>\n  <input type="text" placeholder="Enter text..." className="@field" />\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-direction': 'column', gap: '6px' },
      label: { 'font-size': '14px', 'line-height': '20px', 'font-weight': '500', color: '#374151' },
      field: { padding: '8px 12px', border: '1px solid #d1d5db', 'border-radius': '6px' },
    },
    bootstrap: {
      root: 'mb-3',
      label: 'form-label',
      field: 'form-control',
    },
  },
  'form.form': {
    jsx: {
      vi: `<form className="@root">\n  <div className="@group">\n    <label className="@label">\n      Email\n    </label>\n    <input type="email" placeholder="ban@vidu.com" className="@field" />\n  </div>\n  <button type="submit" className="@submit">\n    Gửi thông tin\n  </button>\n</form>`,
      en: `<form className="@root">\n  <div className="@group">\n    <label className="@label">\n      Email\n    </label>\n    <input type="email" placeholder="you@example.com" className="@field" />\n  </div>\n  <button type="submit" className="@submit">\n    Submit\n  </button>\n</form>`,
    },
    styles: {
      root: {
        display: 'flex',
        'flex-direction': 'column',
        gap: '16px',
        padding: '24px',
        'background-color': '#ffffff',
        border: '1px solid #e5e7eb',
        'border-radius': '8px',
      },
      group: { display: 'flex', 'flex-direction': 'column', gap: '6px' },
      label: { 'font-size': '14px', 'line-height': '20px', 'font-weight': '500', color: '#374151' },
      field: { padding: '8px 12px', border: '1px solid #d1d5db', 'border-radius': '6px' },
      submit: {
        width: '100%',
        padding: '8px 16px',
        'background-color': '#2563eb',
        color: '#ffffff',
        'border-radius': '6px',
        'font-weight': '500',
        border: 'none',
      },
    },
    bootstrap: {
      root: 'card card-body',
      group: 'mb-3',
      label: 'form-label',
      field: 'form-control',
      submit: 'btn btn-primary w-100',
    },
  },
  'data.table': {
    jsx: {
      vi: `<div className="@root">\n  <table className="@table">\n    <thead className="@head">\n      <tr>\n        <th className="@th">Cột 1</th>\n        <th className="@th">Cột 2</th>\n      </tr>\n    </thead>\n    <tbody className="@body">\n      <tr>\n        <td className="@td">Dữ liệu 1</td>\n        <td className="@td">Dữ liệu 2</td>\n      </tr>\n    </tbody>\n  </table>\n</div>`,
      en: `<div className="@root">\n  <table className="@table">\n    <thead className="@head">\n      <tr>\n        <th className="@th">Column 1</th>\n        <th className="@th">Column 2</th>\n      </tr>\n    </thead>\n    <tbody className="@body">\n      <tr>\n        <td className="@td">Data 1</td>\n        <td className="@td">Data 2</td>\n      </tr>\n    </tbody>\n  </table>\n</div>`,
    },
    styles: {
      root: { 'overflow-x': 'auto', border: '1px solid #e5e7eb', 'border-radius': '8px' },
      table: {
        width: '100%',
        'border-collapse': 'collapse',
        'font-size': '14px',
        'text-align': 'left',
      },
      head: { 'background-color': '#f9fafb' },
      th: {
        padding: '8px 16px',
        'font-weight': '500',
        color: '#374151',
        'border-bottom': '1px solid #e5e7eb',
      },
      body: { 'background-color': '#ffffff' },
      td: { padding: '8px 16px', color: '#4b5563', 'border-bottom': '1px solid #e5e7eb' },
    },
    bootstrap: {
      root: 'table-responsive',
      table: 'table',
      head: 'table-light',
      th: 'fw-medium',
      body: 'table-group-divider',
      td: 'text-secondary',
    },
  },
  'composite.card': {
    jsx: {
      vi: `<div className="@root">\n  <h3 className="@title">\n    Tiêu đề thẻ\n  </h3>\n  <p className="@body">\n    Nội dung mô tả ngắn gọn giúp người dùng hiểu thông tin chính của thẻ này.\n  </p>\n  <button type="button" className="@action">\n    Xem chi tiết\n  </button>\n</div>`,
      en: `<div className="@root">\n  <h3 className="@title">\n    Card Title\n  </h3>\n  <p className="@body">\n    A short description helping the user understand the primary card details.\n  </p>\n  <button type="button" className="@action">\n    View details\n  </button>\n</div>`,
    },
    styles: {
      root: {
        padding: '24px',
        'background-color': '#ffffff',
        border: '1px solid #e5e7eb',
        'border-radius': '12px',
      },
      title: {
        'font-size': '18px',
        'line-height': '28px',
        'font-weight': '600',
        color: '#111827',
        'margin-bottom': '8px',
      },
      body: {
        'font-size': '14px',
        'line-height': '20px',
        color: '#4b5563',
        'margin-bottom': '16px',
      },
      action: {
        'font-size': '14px',
        'font-weight': '500',
        color: '#2563eb',
        background: 'none',
        border: 'none',
        padding: '0',
      },
    },
    bootstrap: {
      root: 'card card-body',
      title: 'card-title',
      body: 'card-text text-secondary',
      action: 'btn btn-primary',
    },
  },
  'composite.navbar': {
    jsx: {
      vi: `<nav className="@root">\n  <span className="@brand">\n    Logo\n  </span>\n  <div className="@links">\n    <a href="#" className="@link">Trang chủ</a>\n    <a href="#" className="@link">Giới thiệu</a>\n    <a href="#" className="@link">Liên hệ</a>\n  </div>\n</nav>`,
      en: `<nav className="@root">\n  <span className="@brand">\n    Logo\n  </span>\n  <div className="@links">\n    <a href="#" className="@link">Home</a>\n    <a href="#" className="@link">About</a>\n    <a href="#" className="@link">Contact</a>\n  </div>\n</nav>`,
    },
    styles: {
      root: {
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        padding: '16px 24px',
        'background-color': '#ffffff',
        'border-bottom': '1px solid #e5e7eb',
      },
      brand: { 'font-size': '20px', 'font-weight': '700', color: '#111827' },
      links: {
        display: 'flex',
        'align-items': 'center',
        gap: '24px',
        'font-size': '14px',
        'font-weight': '500',
      },
      link: { color: '#4b5563', 'text-decoration': 'none' },
    },
    bootstrap: {
      root: 'navbar navbar-expand px-4 py-3 bg-white border-bottom',
      brand: 'navbar-brand fw-bold',
      links: 'navbar-nav d-flex flex-row gap-3',
      link: 'nav-link',
    },
  },
  'composite.footer': {
    jsx: {
      vi: `<footer className="@root">\n  <p>\n    Bản quyền 2026. Mọi quyền được bảo lưu.\n  </p>\n</footer>`,
      en: `<footer className="@root">\n  <p>\n    Copyright 2026. All rights reserved.\n  </p>\n</footer>`,
    },
    styles: {
      root: {
        padding: '32px 16px',
        'background-color': '#f9fafb',
        'border-top': '1px solid #e5e7eb',
        'text-align': 'center',
        'font-size': '14px',
        color: '#6b7280',
      },
    },
    bootstrap: {
      root: 'py-4 px-3 bg-light border-top text-center small text-secondary',
    },
  },
  'composite.hero': {
    jsx: {
      vi: `<section className="@root">\n  <div className="@inner">\n    <h1 className="@title">\n      Chào mừng đến với chúng tôi\n    </h1>\n    <p className="@subtitle">\n      Giải pháp thiết kế giao diện hiện đại và nhanh chóng.\n    </p>\n    <button type="button" className="@cta">\n      Bắt đầu ngay\n    </button>\n  </div>\n</section>`,
      en: `<section className="@root">\n  <div className="@inner">\n    <h1 className="@title">\n      Welcome to our website\n    </h1>\n    <p className="@subtitle">\n      Modern and swift visual interface design solution.\n    </p>\n    <button type="button" className="@cta">\n      Get Started\n    </button>\n  </div>\n</section>`,
    },
    styles: {
      root: { padding: '80px 16px', 'background-color': '#f9fafb', 'text-align': 'center' },
      inner: { 'max-width': '768px', 'margin-left': 'auto', 'margin-right': 'auto' },
      title: {
        'font-size': '36px',
        'line-height': '40px',
        'font-weight': '800',
        color: '#111827',
        'margin-bottom': '16px',
      },
      subtitle: {
        'font-size': '18px',
        'line-height': '28px',
        color: '#4b5563',
        'margin-bottom': '32px',
      },
      cta: {
        padding: '12px 24px',
        'background-color': '#2563eb',
        color: '#ffffff',
        'border-radius': '8px',
        'font-weight': '600',
        border: 'none',
      },
    },
    bootstrap: {
      root: 'py-5 px-3 bg-light text-center',
      inner: 'container',
      title: 'display-5 fw-bold mb-3',
      subtitle: 'lead text-secondary mb-4',
      cta: 'btn btn-primary btn-lg',
    },
  },
} as const satisfies Readonly<Record<string, NeutralBlock>>;
