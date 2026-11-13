// Neutral definitions for the 16 starter library blocks (SPEC-04 R-ST-12, TK-43, TK-48).
import { NEUTRAL_COMPOSITE_BLOCKS } from './blocks-neutral-composite.ts';
import type { NeutralBlock } from './types.ts';

export const SVG_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg viewBox='0 0 400 300' fill='%23e5e7eb'%3E%3Crect width='400' height='300'/%3E%3C/svg%3E";

export const NEUTRAL_BLOCKS = {
  'layout.row': {
    jsx: {
      vi: `<div className="@root">\n  <div className="@cell">\n    <p className="@text">Cột 1</p>\n  </div>\n  <div className="@cell">\n    <p className="@text">Cột 2</p>\n  </div>\n</div>`,
      en: `<div className="@root">\n  <div className="@cell">\n    <p className="@text">Column 1</p>\n  </div>\n  <div className="@cell">\n    <p className="@text">Column 2</p>\n  </div>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-wrap': 'wrap', gap: '16px' },
      cell: {
        flex: '1 1 240px',
        padding: '16px',
        'background-color': '{surface-muted}',
        'border-radius': '{radius}',
      },
      text: { 'font-size': '14px', 'line-height': '20px', color: '{muted}' },
    },
    bootstrap: {
      root: 'row g-3',
      cell: 'col-12 col-md-6 p-3 bg-light rounded',
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
      item: { padding: '16px', 'background-color': '{surface-muted}', 'border-radius': '{radius}' },
      text: { 'font-size': '14px', 'line-height': '20px', color: '{muted}' },
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
      root: {
        display: 'grid',
        'grid-template-columns': 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px',
      },
      cell: { padding: '16px', 'background-color': '{surface-muted}', 'border-radius': '{radius}' },
      text: { 'font-size': '14px', 'line-height': '20px', color: '{muted}' },
    },
    bootstrap: {
      root: 'row row-cols-1 row-cols-md-2 g-3',
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
        color: '{text}',
        'font-family': '{heading}',
      },
      body: { color: '{muted}' },
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
      root: {
        'font-size': '24px',
        'line-height': '32px',
        'font-weight': '700',
        color: '{text}',
        'font-family': '{heading}',
      },
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
      root: { 'font-size': '16px', 'line-height': '1.625', color: '{muted}' },
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
      root: {
        width: '100%',
        'max-width': '100%',
        height: 'auto',
        'border-radius': '{radius}',
        'object-fit': 'cover',
      },
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
      root: { color: '{primary}', 'text-decoration': 'underline', 'font-weight': '500' },
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
        'background-color': '{primary}',
        color: '{on-primary}',
        'border-radius': '{radius}',
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
      label: { 'font-size': '14px', 'line-height': '20px', 'font-weight': '500', color: '{text}' },
      field: {
        padding: '8px 12px',
        'background-color': '{surface}',
        color: '{text}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
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
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      group: { display: 'flex', 'flex-direction': 'column', gap: '6px' },
      label: { 'font-size': '14px', 'line-height': '20px', 'font-weight': '500', color: '{text}' },
      field: {
        padding: '8px 12px',
        'background-color': '{surface}',
        color: '{text}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      submit: {
        width: '100%',
        padding: '8px 16px',
        'background-color': '{primary}',
        color: '{on-primary}',
        'border-radius': '{radius}',
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
      root: { 'overflow-x': 'auto', border: '1px solid {border}', 'border-radius': '{radius}' },
      table: {
        width: '100%',
        'border-collapse': 'collapse',
        'font-size': '14px',
        'text-align': 'left',
      },
      head: { 'background-color': '{surface-muted}' },
      th: {
        padding: '8px 16px',
        'font-weight': '500',
        color: '{text}',
        'border-bottom': '1px solid {border}',
      },
      body: { 'background-color': '{surface}' },
      td: { padding: '8px 16px', color: '{muted}', 'border-bottom': '1px solid {border}' },
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
  ...NEUTRAL_COMPOSITE_BLOCKS,
} as const satisfies Readonly<Record<string, NeutralBlock>>;
