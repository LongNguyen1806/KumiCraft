import type { NeutralBlock } from './types.ts';

export const NEUTRAL_DISPLAY_BLOCKS = {
  'content.quote': {
    jsx: {
      vi: `<blockquote className="@root">\n  <p className="@text">“Thiết kế tốt là làm cho sản phẩm dễ hiểu một cách tự nhiên.”</p>\n  <footer className="@author">— Nhóm Thiết kế</footer>\n</blockquote>`,
      en: `<blockquote className="@root">\n  <p className="@text">“Good design makes a product naturally understandable.”</p>\n  <footer className="@author">— Design Team</footer>\n</blockquote>`,
    },
    styles: {
      root: {
        'border-left': '4px solid {primary}',
        'padding-left': '16px',
        'background-color': '{surface-muted}',
        padding: '16px 20px',
        'border-radius': '{radius}',
      },
      text: { 'font-size': '16px', 'font-style': 'italic', color: '{text}', margin: '0 0 8px 0' },
      author: { 'font-size': '13px', color: '{muted}' },
    },
    bootstrap: {
      root: 'blockquote p-3 bg-light border-start border-4 border-primary rounded',
      text: 'mb-2 fst-italic',
      author: 'blockquote-footer mb-0',
    },
  },
  'content.divider': {
    jsx: {
      vi: `<hr className="@root" />`,
      en: `<hr className="@root" />`,
    },
    styles: {
      root: { border: 'none', 'border-top': '1px solid {border}', margin: '24px 0', width: '100%' },
    },
    bootstrap: { root: 'my-4 border-top' },
  },
  'content.spacer': {
    jsx: {
      vi: `<div aria-hidden="true" className="@root" />`,
      en: `<div aria-hidden="true" className="@root" />`,
    },
    styles: {
      root: { height: '48px', width: '100%' },
    },
    bootstrap: { root: 'py-4 w-100' },
  },
  'content.video': {
    jsx: {
      vi: `<div className="@root">\n  <iframe src="about:blank" title="Trình phát video" className="@frame" />\n</div>`,
      en: `<div className="@root">\n  <iframe src="about:blank" title="Video player" className="@frame" />\n</div>`,
    },
    styles: {
      root: {
        width: '100%',
        'aspect-ratio': '16 / 9',
        'background-color': '{surface-muted}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
        overflow: 'hidden',
      },
      frame: { width: '100%', height: '100%', border: 'none' },
    },
    bootstrap: {
      root: 'ratio ratio-16x9 bg-light border rounded overflow-hidden',
      frame: 'w-100 h-100 border-0',
    },
  },
  'display.badge': {
    jsx: {
      vi: `<span className="@root">Mới ra mắt</span>`,
      en: `<span className="@root">New release</span>`,
    },
    styles: {
      root: {
        display: 'inline-block',
        padding: '4px 12px',
        'font-size': '12px',
        'font-weight': '600',
        'background-color': '{surface-muted}',
        color: '{primary}',
        border: '1px solid {border}',
        'border-radius': '9999px',
      },
    },
    bootstrap: { root: 'badge rounded-pill text-bg-primary' },
  },
  'display.avatar': {
    jsx: {
      vi: `<div className="@root">\n  <div className="@circle">KA</div>\n  <div>\n    <p className="@name">Khánh An</p>\n    <p className="@role">Trưởng nhóm Thiết kế</p>\n  </div>\n</div>`,
      en: `<div className="@root">\n  <div className="@circle">KA</div>\n  <div>\n    <p className="@name">Alex Kim</p>\n    <p className="@role">Design Lead</p>\n  </div>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'align-items': 'center', gap: '12px' },
      circle: {
        width: '44px',
        height: '44px',
        'border-radius': '9999px',
        'background-color': '{primary}',
        color: '{on-primary}',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'font-weight': '700',
        'font-size': '14px',
      },
      name: { 'font-size': '14px', 'font-weight': '600', color: '{text}', margin: '0' },
      role: { 'font-size': '12px', color: '{muted}', margin: '0' },
    },
    bootstrap: {
      root: 'd-flex align-items-center gap-3',
      circle:
        'rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold',
      name: 'fw-semibold mb-0',
      role: 'small text-secondary mb-0',
    },
  },
  'display.stat': {
    jsx: {
      vi: `<div className="@root">\n  <p className="@label">Doanh thu tháng</p>\n  <p className="@value">128,4 triệu</p>\n  <p className="@delta">+14,2% so với tháng trước</p>\n</div>`,
      en: `<div className="@root">\n  <p className="@label">Monthly revenue</p>\n  <p className="@value">$48,200</p>\n  <p className="@delta">+14.2% vs last month</p>\n</div>`,
    },
    styles: {
      root: {
        padding: '20px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
        'box-shadow': '{shadow}',
      },
      label: { 'font-size': '13px', color: '{muted}', margin: '0 0 6px 0' },
      value: {
        'font-size': '28px',
        'font-weight': '700',
        color: '{text}',
        'font-family': '{heading}',
        margin: '0 0 4px 0',
      },
      delta: { 'font-size': '12px', 'font-weight': '600', color: '{primary}', margin: '0' },
    },
    bootstrap: {
      root: 'card card-body',
      label: 'small text-secondary mb-1',
      value: 'h3 fw-bold mb-1',
      delta: 'small text-primary fw-semibold mb-0',
    },
  },
  'display.progress': {
    jsx: {
      vi: `<div className="@root">\n  <div className="@top">\n    <span className="@label">Tiến độ hoàn thành</span>\n    <span className="@pct">68%</span>\n  </div>\n  <div className="@track">\n    <div className="@fill" />\n  </div>\n</div>`,
      en: `<div className="@root">\n  <div className="@top">\n    <span className="@label">Completion progress</span>\n    <span className="@pct">68%</span>\n  </div>\n  <div className="@track">\n    <div className="@fill" />\n  </div>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-direction': 'column', gap: '8px' },
      top: { display: 'flex', 'justify-content': 'space-between', 'font-size': '13px' },
      label: { 'font-weight': '500', color: '{text}' },
      pct: { 'font-weight': '600', color: '{primary}' },
      track: {
        width: '100%',
        height: '10px',
        'background-color': '{surface-muted}',
        'border-radius': '9999px',
        overflow: 'hidden',
      },
      fill: {
        width: '68%',
        height: '100%',
        'background-color': '{primary}',
        'border-radius': '9999px',
      },
    },
    bootstrap: {
      root: 'mb-2',
      top: 'd-flex justify-content-between small mb-1',
      label: 'fw-medium',
      pct: 'fw-semibold text-primary',
      track: 'progress',
      fill: 'progress-bar w-75',
    },
  },
} satisfies Record<string, NeutralBlock>;
