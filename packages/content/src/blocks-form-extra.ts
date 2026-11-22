import { NEUTRAL_FORM_EXTRA_BLOCKS } from './blocks-neutral-form-extra.ts';
import type { LibraryBlock } from './types.ts';

export const FORM_EXTRA_LIBRARY_BLOCKS: readonly LibraryBlock[] = [
  {
    id: 'form.textarea',
    category: 'form',
    labelKey: 'library:blocks.textarea',
    keywords: {
      vi: ['vùng nhập', 'ghi chú', 'mô tả', 'textarea', 'van ban dai'],
      en: ['textarea', 'multiline', 'notes', 'comment'],
    },
    icon: 'AlignLeft',
    jsx: {
      vi: `<div className="flex flex-col gap-1.5">\n  <label htmlFor="kc-textarea" className="text-sm font-medium text-{text}">Ghi chú</label>\n  <textarea id="kc-textarea" placeholder="Nhập nội dung chi tiết..." className="w-full min-h-24 px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n</div>`,
      en: `<div className="flex flex-col gap-1.5">\n  <label htmlFor="kc-textarea" className="text-sm font-medium text-{text}">Notes</label>\n  <textarea id="kc-textarea" placeholder="Enter detailed notes..." className="w-full min-h-24 px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n</div>`,
    },
    neutral: NEUTRAL_FORM_EXTRA_BLOCKS['form.textarea'],
  },
  {
    id: 'form.select',
    category: 'form',
    labelKey: 'library:blocks.select',
    keywords: {
      vi: ['chọn', 'danh sách thả', 'select', 'lua chon', 'dropdown'],
      en: ['select', 'dropdown', 'options', 'picker'],
    },
    icon: 'ChevronDown',
    jsx: {
      vi: `<div className="flex flex-col gap-1.5">\n  <label htmlFor="kc-select" className="text-sm font-medium text-{text}">Chọn gói</label>\n  <select id="kc-select" className="w-full px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}">\n    <option value="starter">Khởi đầu</option>\n    <option value="pro">Chuyên nghiệp</option>\n    <option value="team">Đội nhóm</option>\n  </select>\n</div>`,
      en: `<div className="flex flex-col gap-1.5">\n  <label htmlFor="kc-select" className="text-sm font-medium text-{text}">Select plan</label>\n  <select id="kc-select" className="w-full px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}">\n    <option value="starter">Starter</option>\n    <option value="pro">Pro</option>\n    <option value="team">Team</option>\n  </select>\n</div>`,
    },
    neutral: NEUTRAL_FORM_EXTRA_BLOCKS['form.select'],
  },
  {
    id: 'form.checkbox',
    category: 'form',
    labelKey: 'library:blocks.checkbox',
    keywords: {
      vi: ['hộp kiểm', 'đồng ý', 'tick', 'checkbox', 'hop kiem'],
      en: ['checkbox', 'check', 'agree', 'terms'],
    },
    icon: 'CheckSquare',
    jsx: {
      vi: `<div className="flex items-center gap-2.5">\n  <input id="kc-checkbox" type="checkbox" className="w-4 h-4 accent-{primary} rounded border-{border}" />\n  <label htmlFor="kc-checkbox" className="text-sm text-{text}">Tôi đồng ý với điều khoản sử dụng</label>\n</div>`,
      en: `<div className="flex items-center gap-2.5">\n  <input id="kc-checkbox" type="checkbox" className="w-4 h-4 accent-{primary} rounded border-{border}" />\n  <label htmlFor="kc-checkbox" className="text-sm text-{text}">I agree to the terms of service</label>\n</div>`,
    },
    neutral: NEUTRAL_FORM_EXTRA_BLOCKS['form.checkbox'],
  },
  {
    id: 'form.radio-group',
    category: 'form',
    labelKey: 'library:blocks.radioGroup',
    keywords: {
      vi: ['nhóm chọn', 'radio', 'lựa chọn một', 'chon mot'],
      en: ['radio', 'radio group', 'choice', 'option'],
    },
    icon: 'CircleDot',
    jsx: {
      vi: `<fieldset className="flex flex-col gap-2.5 p-4 border border-{border} rounded-{radius} bg-{surface}">\n  <legend className="px-1 text-sm font-semibold text-{text}">Phương thức thanh toán</legend>\n  <div className="flex items-center gap-2">\n    <input id="kc-radio-card" type="radio" name="kc-payment" defaultChecked className="w-4 h-4 accent-{primary}" />\n    <label htmlFor="kc-radio-card" className="text-sm text-{text}">Thẻ tín dụng</label>\n  </div>\n  <div className="flex items-center gap-2">\n    <input id="kc-radio-bank" type="radio" name="kc-payment" className="w-4 h-4 accent-{primary}" />\n    <label htmlFor="kc-radio-bank" className="text-sm text-{text}">Chuyển khoản</label>\n  </div>\n</fieldset>`,
      en: `<fieldset className="flex flex-col gap-2.5 p-4 border border-{border} rounded-{radius} bg-{surface}">\n  <legend className="px-1 text-sm font-semibold text-{text}">Payment method</legend>\n  <div className="flex items-center gap-2">\n    <input id="kc-radio-card" type="radio" name="kc-payment" defaultChecked className="w-4 h-4 accent-{primary}" />\n    <label htmlFor="kc-radio-card" className="text-sm text-{text}">Credit card</label>\n  </div>\n  <div className="flex items-center gap-2">\n    <input id="kc-radio-bank" type="radio" name="kc-payment" className="w-4 h-4 accent-{primary}" />\n    <label htmlFor="kc-radio-bank" className="text-sm text-{text}">Bank transfer</label>\n  </div>\n</fieldset>`,
    },
    neutral: NEUTRAL_FORM_EXTRA_BLOCKS['form.radio-group'],
  },
  {
    id: 'form.switch',
    category: 'form',
    labelKey: 'library:blocks.switch',
    keywords: {
      vi: ['công tắc', 'bật tắt', 'switch', 'cong tac'],
      en: ['switch', 'toggle', 'setting', 'boolean'],
    },
    icon: 'ToggleRight',
    jsx: {
      vi: `<div className="flex items-center justify-between gap-4 p-3 border border-{border} rounded-{radius} bg-{surface}">\n  <label htmlFor="kc-switch" className="text-sm font-medium text-{text}">Nhận thông báo qua email</label>\n  <input id="kc-switch" type="checkbox" role="switch" className="w-9 h-5 accent-{primary} cursor-pointer" />\n</div>`,
      en: `<div className="flex items-center justify-between gap-4 p-3 border border-{border} rounded-{radius} bg-{surface}">\n  <label htmlFor="kc-switch" className="text-sm font-medium text-{text}">Email notifications</label>\n  <input id="kc-switch" type="checkbox" role="switch" className="w-9 h-5 accent-{primary} cursor-pointer" />\n</div>`,
    },
    neutral: NEUTRAL_FORM_EXTRA_BLOCKS['form.switch'],
  },
  {
    id: 'form.search',
    category: 'form',
    labelKey: 'library:blocks.search',
    keywords: {
      vi: ['tìm kiếm', 'ô tìm', 'tim kiem', 'search'],
      en: ['search', 'find', 'query', 'filter'],
    },
    icon: 'Search',
    jsx: {
      vi: `<div className="flex flex-col gap-1.5">\n  <label htmlFor="kc-search" className="text-sm font-medium text-{text}">Tìm kiếm</label>\n  <div className="flex flex-wrap gap-2">\n    <input id="kc-search" type="search" placeholder="Tìm sản phẩm hoặc bài viết..." className="flex-1 min-w-0 px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n    <button type="submit" className="px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} font-medium">Tìm</button>\n  </div>\n</div>`,
      en: `<div className="flex flex-col gap-1.5">\n  <label htmlFor="kc-search" className="text-sm font-medium text-{text}">Search</label>\n  <div className="flex flex-wrap gap-2">\n    <input id="kc-search" type="search" placeholder="Search products or articles..." className="flex-1 min-w-0 px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n    <button type="submit" className="px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} font-medium">Search</button>\n  </div>\n</div>`,
    },
    neutral: NEUTRAL_FORM_EXTRA_BLOCKS['form.search'],
  },
  {
    id: 'form.date',
    category: 'form',
    labelKey: 'library:blocks.date',
    keywords: {
      vi: ['ngày tháng', 'lịch', 'chon ngay', 'date'],
      en: ['date', 'calendar', 'picker', 'day'],
    },
    icon: 'Calendar',
    jsx: {
      vi: `<div className="flex flex-col gap-1.5">\n  <label htmlFor="kc-date" className="text-sm font-medium text-{text}">Ngày bắt đầu</label>\n  <input id="kc-date" type="date" className="w-full px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n</div>`,
      en: `<div className="flex flex-col gap-1.5">\n  <label htmlFor="kc-date" className="text-sm font-medium text-{text}">Start date</label>\n  <input id="kc-date" type="date" className="w-full px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n</div>`,
    },
    neutral: NEUTRAL_FORM_EXTRA_BLOCKS['form.date'],
  },
  {
    id: 'form.file',
    category: 'form',
    labelKey: 'library:blocks.file',
    keywords: {
      vi: ['tải tệp', 'upload', 'đính kèm', 'tep tin', 'file'],
      en: ['file', 'upload', 'attachment', 'dropzone'],
    },
    icon: 'Upload',
    jsx: {
      vi: `<div className="flex flex-col gap-2 p-4 bg-{surface-muted} border border-dashed border-{border} rounded-{radius}">\n  <label htmlFor="kc-file" className="text-sm font-semibold text-{text}">Tải tệp đính kèm</label>\n  <input id="kc-file" type="file" className="text-sm text-{text}" />\n  <p className="text-xs text-{muted}">Hỗ trợ PNG, JPG hoặc PDF tối đa 10 MB.</p>\n</div>`,
      en: `<div className="flex flex-col gap-2 p-4 bg-{surface-muted} border border-dashed border-{border} rounded-{radius}">\n  <label htmlFor="kc-file" className="text-sm font-semibold text-{text}">Upload attachment</label>\n  <input id="kc-file" type="file" className="text-sm text-{text}" />\n  <p className="text-xs text-{muted}">Supports PNG, JPG or PDF up to 10 MB.</p>\n</div>`,
    },
    neutral: NEUTRAL_FORM_EXTRA_BLOCKS['form.file'],
  },
];
