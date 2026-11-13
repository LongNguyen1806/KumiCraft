// Neutral definitions for library block variants (TK-47).
import { SVG_PLACEHOLDER } from './blocks-neutral.ts';
import type { NeutralBlock } from './types.ts';

export const BUTTON_NEUTRAL_VARIANTS = {
  outline: {
    jsx: {
      vi: `<button type="button" className="@root">\n  Bấm vào đây\n</button>`,
      en: `<button type="button" className="@root">\n  Click here\n</button>`,
    },
    styles: {
      root: {
        padding: '8px 16px',
        'background-color': 'transparent',
        color: '{primary}',
        border: '1px solid {primary}',
        'border-radius': '{radius}',
        'font-weight': '500',
      },
    },
    bootstrap: { root: 'btn btn-outline-primary' },
  },
  ghost: {
    jsx: {
      vi: `<button type="button" className="@root">\n  Bấm vào đây\n</button>`,
      en: `<button type="button" className="@root">\n  Click here\n</button>`,
    },
    styles: {
      root: {
        padding: '8px 16px',
        'background-color': 'transparent',
        color: '{primary}',
        border: 'none',
        'border-radius': '{radius}',
        'font-weight': '500',
      },
    },
    bootstrap: { root: 'btn btn-link text-decoration-none' },
  },
  sm: {
    jsx: {
      vi: `<button type="button" className="@root">\n  Bấm vào đây\n</button>`,
      en: `<button type="button" className="@root">\n  Click here\n</button>`,
    },
    styles: {
      root: {
        padding: '6px 12px',
        'font-size': '14px',
        'background-color': '{primary}',
        color: '{on-primary}',
        'border-radius': '{radius}',
        'font-weight': '500',
        border: 'none',
      },
    },
    bootstrap: { root: 'btn btn-primary btn-sm' },
  },
  lg: {
    jsx: {
      vi: `<button type="button" className="@root">\n  Bấm vào đây\n</button>`,
      en: `<button type="button" className="@root">\n  Click here\n</button>`,
    },
    styles: {
      root: {
        padding: '12px 24px',
        'font-size': '16px',
        'background-color': '{primary}',
        color: '{on-primary}',
        'border-radius': '{radius}',
        'font-weight': '600',
        border: 'none',
      },
    },
    bootstrap: { root: 'btn btn-primary btn-lg' },
  },
} as const satisfies Readonly<Record<string, NeutralBlock>>;

export const CARD_NEUTRAL_VARIANTS = {
  flat: {
    jsx: {
      vi: `<div className="@root">\n  <h3 className="@title">\n    Tiêu đề thẻ\n  </h3>\n  <p className="@body">\n    Nội dung mô tả ngắn gọn giúp người dùng hiểu thông tin chính của thẻ này.\n  </p>\n  <button type="button" className="@action">\n    Xem chi tiết\n  </button>\n</div>`,
      en: `<div className="@root">\n  <h3 className="@title">\n    Card Title\n  </h3>\n  <p className="@body">\n    A short description helping the user understand the primary card details.\n  </p>\n  <button type="button" className="@action">\n    View details\n  </button>\n</div>`,
    },
    styles: {
      root: {
        'min-width': '0',
        padding: '24px',
        'background-color': '{surface-muted}',
        'border-radius': '{radius}',
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
      root: 'card card-body border-0 bg-light',
      title: 'card-title',
      body: 'card-text text-secondary',
      action: 'btn btn-primary',
    },
  },
  elevated: {
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
        'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.08)',
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
      root: 'card card-body shadow',
      title: 'card-title',
      body: 'card-text text-secondary',
      action: 'btn btn-primary',
    },
  },
} as const satisfies Readonly<Record<string, NeutralBlock>>;

export const HEADING_NEUTRAL_VARIANTS = {
  lg: {
    jsx: {
      vi: `<h1 className="@root">\n  Tiêu đề chính\n</h1>`,
      en: `<h1 className="@root">\n  Main Heading\n</h1>`,
    },
    styles: {
      root: {
        'font-size': '36px',
        'line-height': '40px',
        'font-weight': '800',
        color: '{text}',
        'font-family': '{heading}',
      },
    },
    bootstrap: { root: 'display-5 fw-bold' },
  },
  sm: {
    jsx: {
      vi: `<h3 className="@root">\n  Tiêu đề nhỏ\n</h3>`,
      en: `<h3 className="@root">\n  Subheading\n</h3>`,
    },
    styles: {
      root: {
        'font-size': '18px',
        'line-height': '28px',
        'font-weight': '600',
        color: '{text}',
        'font-family': '{heading}',
      },
    },
    bootstrap: { root: 'h4 fw-semibold' },
  },
} as const satisfies Readonly<Record<string, NeutralBlock>>;

export const HERO_NEUTRAL_VARIANTS = {
  split: {
    jsx: {
      vi: `<section className="@root">\n  <div className="@inner">\n    <div className="@col">\n      <h1 className="@title">\n        Chào mừng đến với chúng tôi\n      </h1>\n      <p className="@subtitle">\n        Giải pháp thiết kế giao diện hiện đại và nhanh chóng.\n      </p>\n      <button type="button" className="@cta">\n        Bắt đầu ngay\n      </button>\n    </div>\n    <div className="@col">\n      <img src="${SVG_PLACEHOLDER}" alt="Hình minh họa" className="@image" />\n    </div>\n  </div>\n</section>`,
      en: `<section className="@root">\n  <div className="@inner">\n    <div className="@col">\n      <h1 className="@title">\n        Welcome to our website\n      </h1>\n      <p className="@subtitle">\n        Modern and swift visual interface design solution.\n      </p>\n      <button type="button" className="@cta">\n        Get Started\n      </button>\n    </div>\n    <div className="@col">\n      <img src="${SVG_PLACEHOLDER}" alt="Hero illustration" className="@image" />\n    </div>\n  </div>\n</section>`,
    },
    styles: {
      root: { padding: '64px 16px', 'background-color': '{surface-muted}' },
      inner: {
        'max-width': '1024px',
        'margin-left': 'auto',
        'margin-right': 'auto',
        display: 'flex',
        'flex-wrap': 'wrap',
        'align-items': 'center',
        'justify-content': 'space-between',
        gap: '32px',
      },
      col: { flex: '1 1 240px' },
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
      image: {
        width: '100%',
        'max-width': '100%',
        height: 'auto',
        'border-radius': '{radius}',
        'object-fit': 'cover',
      },
    },
    bootstrap: {
      root: 'py-5 px-3 bg-light',
      inner: 'container row align-items-center g-4',
      col: 'col-12 col-md-6',
      title: 'display-5 fw-bold mb-3',
      subtitle: 'lead text-secondary mb-4',
      cta: 'btn btn-primary btn-lg',
      image: 'img-fluid rounded',
    },
  },
} as const satisfies Readonly<Record<string, NeutralBlock>>;
