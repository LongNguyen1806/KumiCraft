// Neutral definitions for composite starter library blocks (SPEC-04 R-ST-12, TK-43, TK-48).
import type { NeutralBlock } from './types.ts';

export const NEUTRAL_COMPOSITE_BLOCKS = {
  'composite.card': {
    jsx: {
      vi: `<div className="@root">\n  <h3 className="@title">\n    Tiêu đề thẻ\n  </h3>\n  <p className="@body">\n    Nội dung mô tả ngắn gọn giúp người dùng hiểu thông tin chính của thẻ này.\n  </p>\n  <button type="button" className="@action">\n    Xem chi tiết\n  </button>\n</div>`,
      en: `<div className="@root">\n  <h3 className="@title">\n    Card Title\n  </h3>\n  <p className="@body">\n    A short description helping the user understand the primary card details.\n  </p>\n  <button type="button" className="@action">\n    View details\n  </button>\n</div>`,
    },
    styles: {
      root: {
        'min-width': '0',
        padding: '24px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
        'box-shadow': '{shadow}',
        'backdrop-filter': '{effect}',
      },
      title: {
        'font-size': '18px',
        'line-height': '28px',
        'font-weight': '600',
        color: '{text}',
        'font-family': '{heading}',
        'margin-bottom': '8px',
      },
      body: {
        'font-size': '14px',
        'line-height': '20px',
        color: '{muted}',
        'margin-bottom': '16px',
      },
      action: {
        'font-size': '14px',
        'font-weight': '500',
        color: '{primary}',
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
        'flex-wrap': 'wrap',
        'align-items': 'center',
        'justify-content': 'space-between',
        gap: '16px',
        padding: '16px 24px',
        'background-color': '{surface}',
        'border-bottom': '1px solid {border}',
      },
      brand: {
        'font-size': '20px',
        'font-weight': '700',
        color: '{text}',
        'font-family': '{heading}',
      },
      links: {
        display: 'flex',
        'flex-wrap': 'wrap',
        'align-items': 'center',
        gap: '24px',
        'font-size': '14px',
        'font-weight': '500',
      },
      link: { color: '{muted}', 'text-decoration': 'none' },
    },
    bootstrap: {
      root: 'navbar navbar-expand flex-wrap gap-3 px-4 py-3 bg-white border-bottom',
      brand: 'navbar-brand fw-bold',
      links: 'navbar-nav d-flex flex-row flex-wrap gap-3',
      link: 'nav-link',
    },
  },
  'composite.footer': {
    jsx: {
      vi: `<footer className="@root">\n  <div className="@inner">\n    <div className="@col">\n      <p className="@brand">Thương hiệu</p>\n      <p className="@copy">Bản quyền 2026. Mọi quyền được bảo lưu.</p>\n    </div>\n    <div className="@links">\n      <a href="#" className="@link">Giới thiệu</a>\n      <a href="#" className="@link">Điều khoản</a>\n      <a href="#" className="@link">Liên hệ</a>\n    </div>\n  </div>\n</footer>`,
      en: `<footer className="@root">\n  <div className="@inner">\n    <div className="@col">\n      <p className="@brand">Brand</p>\n      <p className="@copy">Copyright 2026. All rights reserved.</p>\n    </div>\n    <div className="@links">\n      <a href="#" className="@link">About</a>\n      <a href="#" className="@link">Terms</a>\n      <a href="#" className="@link">Contact</a>\n    </div>\n  </div>\n</footer>`,
    },
    styles: {
      root: {
        padding: '32px 24px',
        'background-color': '{surface-muted}',
        'border-top': '1px solid {border}',
        'font-size': '14px',
        color: '{muted}',
      },
      inner: {
        'max-width': '1024px',
        'margin-left': 'auto',
        'margin-right': 'auto',
        display: 'grid',
        'grid-template-columns': 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px',
      },
      col: { display: 'flex', 'flex-direction': 'column', gap: '8px' },
      brand: { 'font-weight': '600', color: '{text}', 'font-family': '{heading}' },
      copy: { color: '{muted}' },
      links: { display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center', gap: '16px' },
      link: { color: '{muted}', 'text-decoration': 'none' },
    },
    bootstrap: {
      root: 'py-4 px-3 bg-light border-top small text-secondary',
      inner: 'container row g-3',
      col: 'col-12 col-md-6',
      brand: 'fw-semibold text-dark mb-1',
      copy: 'mb-0',
      links: 'col-12 col-md-6 d-flex flex-wrap gap-3 align-items-center',
      link: 'text-decoration-none text-secondary',
    },
  },
  'composite.hero': {
    jsx: {
      vi: `<section className="@root">\n  <div className="@inner">\n    <h1 className="@title">\n      Chào mừng đến với chúng tôi\n    </h1>\n    <p className="@subtitle">\n      Giải pháp thiết kế giao diện hiện đại và nhanh chóng.\n    </p>\n    <button type="button" className="@cta">\n      Bắt đầu ngay\n    </button>\n  </div>\n</section>`,
      en: `<section className="@root">\n  <div className="@inner">\n    <h1 className="@title">\n      Welcome to our website\n    </h1>\n    <p className="@subtitle">\n      Modern and swift visual interface design solution.\n    </p>\n    <button type="button" className="@cta">\n      Get Started\n    </button>\n  </div>\n</section>`,
    },
    styles: {
      root: { padding: '80px 16px', 'background-color': '{surface-muted}', 'text-align': 'center' },
      inner: { 'max-width': '768px', 'margin-left': 'auto', 'margin-right': 'auto' },
      title: {
        'font-size': '36px',
        'line-height': '40px',
        'font-weight': '800',
        color: '{text}',
        'font-family': '{heading}',
        'margin-bottom': '16px',
      },
      subtitle: {
        'font-size': '18px',
        'line-height': '28px',
        color: '{muted}',
        'margin-bottom': '32px',
      },
      cta: {
        padding: '12px 24px',
        'background-color': '{primary}',
        color: '{on-primary}',
        'border-radius': '{radius}',
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
