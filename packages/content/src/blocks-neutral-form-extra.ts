import type { NeutralBlock } from './types.ts';

export const NEUTRAL_FORM_EXTRA_BLOCKS = {
  'form.textarea': {
    jsx: {
      vi: `<div className="@root">\n  <label htmlFor="kc-textarea" className="@label">Ghi chú</label>\n  <textarea id="kc-textarea" placeholder="Nhập nội dung chi tiết..." className="@field" />\n</div>`,
      en: `<div className="@root">\n  <label htmlFor="kc-textarea" className="@label">Notes</label>\n  <textarea id="kc-textarea" placeholder="Enter detailed notes..." className="@field" />\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-direction': 'column', gap: '6px' },
      label: { 'font-size': '14px', 'font-weight': '500', color: '{text}' },
      field: {
        width: '100%',
        'min-height': '96px',
        padding: '10px 12px',
        'background-color': '{surface}',
        color: '{text}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
    },
    bootstrap: { root: 'mb-3', label: 'form-label', field: 'form-control' },
  },
  'form.select': {
    jsx: {
      vi: `<div className="@root">\n  <label htmlFor="kc-select" className="@label">Chọn gói</label>\n  <select id="kc-select" className="@field">\n    <option value="starter">Khởi đầu</option>\n    <option value="pro">Chuyên nghiệp</option>\n    <option value="team">Đội nhóm</option>\n  </select>\n</div>`,
      en: `<div className="@root">\n  <label htmlFor="kc-select" className="@label">Select plan</label>\n  <select id="kc-select" className="@field">\n    <option value="starter">Starter</option>\n    <option value="pro">Pro</option>\n    <option value="team">Team</option>\n  </select>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-direction': 'column', gap: '6px' },
      label: { 'font-size': '14px', 'font-weight': '500', color: '{text}' },
      field: {
        width: '100%',
        padding: '8px 12px',
        'background-color': '{surface}',
        color: '{text}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
    },
    bootstrap: { root: 'mb-3', label: 'form-label', field: 'form-select' },
  },
  'form.checkbox': {
    jsx: {
      vi: `<div className="@root">\n  <input id="kc-checkbox" type="checkbox" className="@box" />\n  <label htmlFor="kc-checkbox" className="@label">Tôi đồng ý với điều khoản sử dụng</label>\n</div>`,
      en: `<div className="@root">\n  <input id="kc-checkbox" type="checkbox" className="@box" />\n  <label htmlFor="kc-checkbox" className="@label">I agree to the terms of service</label>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'align-items': 'center', gap: '10px' },
      box: { width: '16px', height: '16px', 'accent-color': '{primary}' },
      label: { 'font-size': '14px', color: '{text}' },
    },
    bootstrap: { root: 'form-check', box: 'form-check-input', label: 'form-check-label' },
  },
  'form.radio-group': {
    jsx: {
      vi: `<fieldset className="@root">\n  <legend className="@legend">Phương thức thanh toán</legend>\n  <div className="@item">\n    <input id="kc-radio-card" type="radio" name="kc-payment" defaultChecked className="@radio" />\n    <label htmlFor="kc-radio-card" className="@label">Thẻ tín dụng</label>\n  </div>\n  <div className="@item">\n    <input id="kc-radio-bank" type="radio" name="kc-payment" className="@radio" />\n    <label htmlFor="kc-radio-bank" className="@label">Chuyển khoản</label>\n  </div>\n</fieldset>`,
      en: `<fieldset className="@root">\n  <legend className="@legend">Payment method</legend>\n  <div className="@item">\n    <input id="kc-radio-card" type="radio" name="kc-payment" defaultChecked className="@radio" />\n    <label htmlFor="kc-radio-card" className="@label">Credit card</label>\n  </div>\n  <div className="@item">\n    <input id="kc-radio-bank" type="radio" name="kc-payment" className="@radio" />\n    <label htmlFor="kc-radio-bank" className="@label">Bank transfer</label>\n  </div>\n</fieldset>`,
    },
    styles: {
      root: {
        display: 'flex',
        'flex-direction': 'column',
        gap: '10px',
        border: '1px solid {border}',
        'border-radius': '{radius}',
        padding: '14px',
      },
      legend: { 'font-size': '14px', 'font-weight': '600', color: '{text}', padding: '0 4px' },
      item: { display: 'flex', 'align-items': 'center', gap: '8px' },
      radio: { width: '16px', height: '16px', 'accent-color': '{primary}' },
      label: { 'font-size': '14px', color: '{text}' },
    },
    bootstrap: {
      root: 'border rounded p-3',
      legend: 'fs-6 fw-semibold px-1',
      item: 'form-check',
      radio: 'form-check-input',
      label: 'form-check-label',
    },
  },
  'form.switch': {
    jsx: {
      vi: `<div className="@root">\n  <label htmlFor="kc-switch" className="@label">Nhận thông báo qua email</label>\n  <input id="kc-switch" type="checkbox" role="switch" className="@toggle" />\n</div>`,
      en: `<div className="@root">\n  <label htmlFor="kc-switch" className="@label">Email notifications</label>\n  <input id="kc-switch" type="checkbox" role="switch" className="@toggle" />\n</div>`,
    },
    styles: {
      root: {
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        gap: '12px',
      },
      label: { 'font-size': '14px', 'font-weight': '500', color: '{text}' },
      toggle: { width: '36px', height: '20px', 'accent-color': '{primary}' },
    },
    bootstrap: {
      root: 'form-check form-switch d-flex align-items-center justify-content-between ps-0',
      label: 'form-check-label',
      toggle: 'form-check-input ms-2',
    },
  },
  'form.search': {
    jsx: {
      vi: `<div className="@root">\n  <label htmlFor="kc-search" className="@label">Tìm kiếm</label>\n  <div className="@row">\n    <input id="kc-search" type="search" placeholder="Tìm sản phẩm hoặc bài viết..." className="@field" />\n    <button type="submit" className="@btn">Tìm</button>\n  </div>\n</div>`,
      en: `<div className="@root">\n  <label htmlFor="kc-search" className="@label">Search</label>\n  <div className="@row">\n    <input id="kc-search" type="search" placeholder="Search products or articles..." className="@field" />\n    <button type="submit" className="@btn">Search</button>\n  </div>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-direction': 'column', gap: '6px' },
      label: { 'font-size': '14px', 'font-weight': '500', color: '{text}' },
      row: { display: 'flex', 'flex-wrap': 'wrap', gap: '8px' },
      field: {
        flex: '1 1 200px',
        padding: '8px 12px',
        'background-color': '{surface}',
        color: '{text}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      btn: {
        padding: '8px 16px',
        'background-color': '{primary}',
        color: '{on-primary}',
        border: 'none',
        'border-radius': '{radius}',
        'font-weight': '500',
      },
    },
    bootstrap: {
      root: 'mb-3',
      label: 'form-label',
      row: 'input-group',
      field: 'form-control',
      btn: 'btn btn-primary',
    },
  },
  'form.date': {
    jsx: {
      vi: `<div className="@root">\n  <label htmlFor="kc-date" className="@label">Ngày bắt đầu</label>\n  <input id="kc-date" type="date" className="@field" />\n</div>`,
      en: `<div className="@root">\n  <label htmlFor="kc-date" className="@label">Start date</label>\n  <input id="kc-date" type="date" className="@field" />\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-direction': 'column', gap: '6px' },
      label: { 'font-size': '14px', 'font-weight': '500', color: '{text}' },
      field: {
        padding: '8px 12px',
        'background-color': '{surface}',
        color: '{text}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
    },
    bootstrap: { root: 'mb-3', label: 'form-label', field: 'form-control' },
  },
  'form.file': {
    jsx: {
      vi: `<div className="@root">\n  <label htmlFor="kc-file" className="@label">Tải tệp đính kèm</label>\n  <input id="kc-file" type="file" className="@field" />\n  <p className="@hint">Hỗ trợ PNG, JPG hoặc PDF tối đa 10 MB.</p>\n</div>`,
      en: `<div className="@root">\n  <label htmlFor="kc-file" className="@label">Upload attachment</label>\n  <input id="kc-file" type="file" className="@field" />\n  <p className="@hint">Supports PNG, JPG or PDF up to 10 MB.</p>\n</div>`,
    },
    styles: {
      root: {
        display: 'flex',
        'flex-direction': 'column',
        gap: '8px',
        padding: '16px',
        'background-color': '{surface-muted}',
        border: '1px dashed {border}',
        'border-radius': '{radius}',
      },
      label: { 'font-size': '14px', 'font-weight': '600', color: '{text}' },
      field: { 'font-size': '14px', color: '{text}' },
      hint: { 'font-size': '12px', color: '{muted}', margin: '0' },
    },
    bootstrap: {
      root: 'p-3 border rounded bg-light',
      label: 'form-label fw-semibold',
      field: 'form-control',
      hint: 'form-text text-secondary mb-0',
    },
  },
} satisfies Record<string, NeutralBlock>;
