// Neutral definitions for data state & scaffold blocks (TK-33..35, R-ST-12).
import type { NeutralBlock } from './types.ts';

export const NEUTRAL_DATA_BLOCKS = {
  'data.loading': {
    jsx: {
      vi: `<div className="@root" aria-busy="true" aria-label="Đang tải dữ liệu">\n  <div className="@bar-lg" />\n  <div className="@bar-md" />\n  <div className="@bar-sm" />\n</div>`,
      en: `<div className="@root" aria-busy="true" aria-label="Loading data">\n  <div className="@bar-lg" />\n  <div className="@bar-md" />\n  <div className="@bar-sm" />\n</div>`,
    },
    styles: {
      root: {
        display: 'flex',
        'flex-direction': 'column',
        gap: '12px',
        padding: '20px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      'bar-lg': {
        height: '20px',
        width: '45%',
        'background-color': '{surface-muted}',
        'border-radius': '{radius}',
      },
      'bar-md': {
        height: '14px',
        width: '85%',
        'background-color': '{surface-muted}',
        'border-radius': '{radius}',
      },
      'bar-sm': {
        height: '14px',
        width: '65%',
        'background-color': '{surface-muted}',
        'border-radius': '{radius}',
      },
    },
    bootstrap: {
      root: 'card p-4 placeholder-glow d-flex flex-column gap-2',
      'bar-lg': 'placeholder col-5 rounded',
      'bar-md': 'placeholder col-10 rounded',
      'bar-sm': 'placeholder col-7 rounded',
    },
  },
  'data.empty': {
    jsx: {
      vi: `<div className="@root">\n  <p className="@title">Chưa có dữ liệu</p>\n  <p className="@desc">Hãy thêm mục đầu tiên để bắt đầu làm việc.</p>\n  <button type="button" className="@btn">Thêm mới</button>\n</div>`,
      en: `<div className="@root">\n  <p className="@title">No data yet</p>\n  <p className="@desc">Add your first item to get started.</p>\n  <button type="button" className="@btn">Add item</button>\n</div>`,
    },
    styles: {
      root: {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'text-align': 'center',
        gap: '10px',
        padding: '32px 24px',
        'background-color': '{surface}',
        border: '1px dashed {border}',
        'border-radius': '{radius}',
      },
      title: { 'font-size': '16px', 'font-weight': '600', color: '{text}', margin: '0' },
      desc: { 'font-size': '14px', color: '{muted}', margin: '0' },
      btn: {
        'margin-top': '4px',
        padding: '8px 16px',
        'background-color': '{primary}',
        color: '{on-primary}',
        'border-radius': '{radius}',
        border: 'none',
        'font-weight': '500',
      },
    },
    bootstrap: {
      root: 'card p-4 text-center d-flex flex-column align-items-center gap-2',
      title: 'h6 fw-semibold mb-0',
      desc: 'small text-secondary mb-1',
      btn: 'btn btn-primary btn-sm',
    },
  },
  'data.error': {
    jsx: {
      vi: `<div role="alert" className="@root">\n  <p className="@title">Không thể tải dữ liệu</p>\n  <p className="@desc">Kết nối tạm thời gián đoạn. Vui lòng thử lại.</p>\n  <button type="button" className="@btn">Thử lại</button>\n</div>`,
      en: `<div role="alert" className="@root">\n  <p className="@title">Could not load data</p>\n  <p className="@desc">The connection was interrupted. Please try again.</p>\n  <button type="button" className="@btn">Retry</button>\n</div>`,
    },
    styles: {
      root: {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'flex-start',
        gap: '8px',
        padding: '20px 24px',
        'background-color': '#fef2f2',
        border: '1px solid #fecaca',
        'border-radius': '{radius}',
      },
      title: { 'font-size': '15px', 'font-weight': '600', color: '#991b1b', margin: '0' },
      desc: { 'font-size': '13px', color: '#7f1d1d', margin: '0' },
      btn: {
        'margin-top': '4px',
        padding: '8px 14px',
        'background-color': '#dc2626',
        color: '#ffffff',
        'border-radius': '{radius}',
        border: 'none',
        'font-weight': '500',
      },
    },
    bootstrap: {
      root: 'alert alert-danger d-flex flex-column align-items-start gap-2 mb-0',
      title: 'fw-semibold mb-0',
      desc: 'small mb-1',
      btn: 'btn btn-danger btn-sm',
    },
  },
  'data.states': {
    jsx: {
      vi: `<div className="@root">\n  <div className="@card" aria-busy="true" aria-label="Đang tải">\n    <div className="@bar" />\n    <div className="@bar-short" />\n  </div>\n  <div className="@card">\n    <p className="@title">Chưa có dữ liệu</p>\n    <button type="button" className="@btn">Thêm mới</button>\n  </div>\n  <div role="alert" className="@error-card">\n    <p className="@error-title">Tải dữ liệu thất bại</p>\n    <button type="button" className="@error-btn">Thử lại</button>\n  </div>\n</div>`,
      en: `<div className="@root">\n  <div className="@card" aria-busy="true" aria-label="Loading">\n    <div className="@bar" />\n    <div className="@bar-short" />\n  </div>\n  <div className="@card">\n    <p className="@title">No data yet</p>\n    <button type="button" className="@btn">Add item</button>\n  </div>\n  <div role="alert" className="@error-card">\n    <p className="@error-title">Failed to load data</p>\n    <button type="button" className="@error-btn">Retry</button>\n  </div>\n</div>`,
    },
    styles: {
      root: { display: 'flex', 'flex-wrap': 'wrap', gap: '16px' },
      card: {
        flex: '1 1 220px',
        padding: '20px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      bar: {
        height: '16px',
        width: '80%',
        'margin-bottom': '10px',
        'background-color': '{surface-muted}',
        'border-radius': '{radius}',
      },
      'bar-short': {
        height: '12px',
        width: '55%',
        'background-color': '{surface-muted}',
        'border-radius': '{radius}',
      },
      title: { 'font-size': '15px', 'font-weight': '600', color: '{text}', margin: '0 0 10px 0' },
      btn: {
        padding: '8px 14px',
        'background-color': '{primary}',
        color: '{on-primary}',
        'border-radius': '{radius}',
        border: 'none',
      },
      'error-card': {
        flex: '1 1 220px',
        padding: '20px',
        'background-color': '#fef2f2',
        border: '1px solid #fecaca',
        'border-radius': '{radius}',
      },
      'error-title': {
        'font-size': '15px',
        'font-weight': '600',
        color: '#991b1b',
        margin: '0 0 10px 0',
      },
      'error-btn': {
        padding: '8px 14px',
        'background-color': '#dc2626',
        color: '#ffffff',
        'border-radius': '{radius}',
        border: 'none',
      },
    },
    bootstrap: {
      root: 'row g-3',
      card: 'col-12 col-md-4 p-3 border rounded bg-body placeholder-glow',
      bar: 'placeholder col-9 rounded mb-2',
      'bar-short': 'placeholder col-6 rounded',
      title: 'h6 fw-semibold mb-2',
      btn: 'btn btn-primary btn-sm',
      'error-card': 'col-12 col-md-4 p-3 alert alert-danger mb-0',
      'error-title': 'fw-semibold mb-2',
      'error-btn': 'btn btn-danger btn-sm',
    },
  },
  'data.form-from-source': {
    jsx: {
      vi: `<form className="@root">\n  <div className="@field">\n    <label htmlFor="field-name" className="@label">Tên</label>\n    <input id="field-name" type="text" required className="@input" />\n  </div>\n  <button type="submit" className="@btn">Lưu</button>\n</form>`,
      en: `<form className="@root">\n  <div className="@field">\n    <label htmlFor="field-name" className="@label">Name</label>\n    <input id="field-name" type="text" required className="@input" />\n  </div>\n  <button type="submit" className="@btn">Save</button>\n</form>`,
    },
    styles: {
      root: {
        display: 'flex',
        'flex-direction': 'column',
        gap: '16px',
        padding: '20px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
      field: { display: 'flex', 'flex-direction': 'column', gap: '6px' },
      label: { 'font-size': '14px', 'font-weight': '500', color: '{text}' },
      input: {
        padding: '8px 12px',
        border: '1px solid {border}',
        'border-radius': '{radius}',
        'background-color': '{surface}',
        color: '{text}',
      },
      btn: {
        'align-self': 'flex-start',
        padding: '10px 18px',
        'background-color': '{primary}',
        color: '{on-primary}',
        border: 'none',
        'border-radius': '{radius}',
        'font-weight': '500',
      },
    },
    bootstrap: {
      root: 'card p-4 d-flex flex-column gap-3',
      field: 'd-flex flex-column gap-1',
      label: 'form-label mb-0',
      input: 'form-control',
      btn: 'btn btn-primary align-self-start',
    },
  },
  'data.table-from-source': {
    jsx: {
      vi: `<div className="@root">\n  <DataTable data={[{ id: '1', name: 'Mục mẫu', status: 'Sẵn sàng' }]} columns={[{ key: 'name', label: 'Tên' }, { key: 'status', label: 'Trạng thái' }]} searchPlaceholder="Tìm kiếm..." emptyMessage="Chưa có dữ liệu" />\n</div>`,
      en: `<div className="@root">\n  <DataTable data={[{ id: '1', name: 'Sample item', status: 'Active' }]} columns={[{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }]} searchPlaceholder="Search..." emptyMessage="Chưa có dữ liệu" />\n</div>`,
    },
    styles: {
      root: {
        padding: '16px',
        'background-color': '{surface}',
        border: '1px solid {border}',
        'border-radius': '{radius}',
      },
    },
    bootstrap: {
      root: 'card p-3',
    },
  },
} satisfies Record<string, NeutralBlock>;
