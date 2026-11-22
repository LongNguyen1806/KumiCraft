// Data library blocks: loading, empty, error, states, form-from-source, table-from-source (TK-33..35).
import { NEUTRAL_DATA_BLOCKS } from './blocks-neutral-data.ts';
import type { LibraryBlock } from './types.ts';

export const DATA_LIBRARY_BLOCKS: readonly LibraryBlock[] = [
  {
    id: 'data.form-from-source',
    category: 'data',
    labelKey: 'library:blocks.dataFormFromSource',
    keywords: {
      vi: ['form', 'nguồn dữ liệu', 'mô hình', 'model', 'typescript', 'zod', 'openapi', 'django'],
      en: ['form', 'data source', 'schema', 'model', 'typescript', 'zod', 'openapi', 'django'],
    },
    icon: 'FileCode2',
    jsx: {
      vi: `<form className="flex flex-col gap-4 p-5 bg-{surface} border border-{border} rounded-{radius} {shadow}">\n  <div className="flex flex-col gap-1.5">\n    <label htmlFor="field-name" className="text-sm font-medium text-{text}">Tên</label>\n    <input id="field-name" type="text" required className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n  </div>\n  <button type="submit" className="self-start px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} font-medium">Lưu</button>\n</form>`,
      en: `<form className="flex flex-col gap-4 p-5 bg-{surface} border border-{border} rounded-{radius} {shadow}">\n  <div className="flex flex-col gap-1.5">\n    <label htmlFor="field-name" className="text-sm font-medium text-{text}">Name</label>\n    <input id="field-name" type="text" required className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n  </div>\n  <button type="submit" className="self-start px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} font-medium">Save</button>\n</form>`,
    },
    neutral: NEUTRAL_DATA_BLOCKS['data.form-from-source'],
  },
  {
    id: 'data.table-from-source',
    category: 'data',
    labelKey: 'library:blocks.dataTableFromSource',
    keywords: {
      vi: ['bảng', 'table', 'dữ liệu', 'nguồn', 'lọc', 'sắp xếp', 'phân trang'],
      en: ['table', 'data table', 'data source', 'filter', 'sort', 'pagination'],
    },
    icon: 'Table2',
    jsx: {
      vi: `<div className="p-4 bg-{surface} border border-{border} rounded-{radius} {shadow}">\n  <DataTable data={[{ id: '1', name: 'Mục mẫu', status: 'Sẵn sàng' }]} columns={[{ key: 'name', label: 'Tên' }, { key: 'status', label: 'Trạng thái' }]} searchPlaceholder="Tìm kiếm..." emptyMessage="Chưa có dữ liệu" />\n</div>`,
      en: `<div className="p-4 bg-{surface} border border-{border} rounded-{radius} {shadow}">\n  <DataTable data={[{ id: '1', name: 'Sample item', status: 'Active' }]} columns={[{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }]} searchPlaceholder="Search..." emptyMessage="Chưa có dữ liệu" />\n</div>`,
    },
    neutral: NEUTRAL_DATA_BLOCKS['data.table-from-source'],
    kit: { components: ['DataTable'] },
  },
  {
    id: 'data.states',
    category: 'data',
    labelKey: 'library:blocks.dataStates',
    keywords: {
      vi: ['trạng thái', 'tải', 'trống', 'lỗi', 'skeleton', 'loading', 'empty', 'error'],
      en: ['states', 'loading', 'empty', 'error', 'skeleton', 'retry'],
    },
    icon: 'Layers',
    jsx: {
      vi: `<div className="flex flex-wrap gap-4">\n  <div className="flex-1 min-w-[220px] p-5 bg-{surface} border border-{border} rounded-{radius} {shadow}" aria-busy="true" aria-label="Đang tải">\n    <div className="h-4 w-4/5 rounded bg-{surface-muted} motion-safe:animate-pulse mb-2.5" />\n    <div className="h-3 w-3/5 rounded bg-{surface-muted} motion-safe:animate-pulse" />\n  </div>\n  <div className="flex-1 min-w-[220px] p-5 bg-{surface} border border-{border} rounded-{radius} {shadow} flex flex-col items-start gap-2.5">\n    <p className="text-sm font-semibold text-{text}">Chưa có dữ liệu</p>\n    <button type="button" className="px-3.5 py-1.5 text-sm bg-{primary} text-{on-primary} rounded-{radius} font-medium">Thêm mới</button>\n  </div>\n  <div role="alert" className="flex-1 min-w-[220px] p-5 bg-red-50 border border-red-200 rounded-{radius} flex flex-col items-start gap-2.5">\n    <p className="text-sm font-semibold text-red-800">Tải dữ liệu thất bại</p>\n    <button type="button" className="px-3.5 py-1.5 text-sm bg-red-600 text-white rounded-{radius} font-medium">Thử lại</button>\n  </div>\n</div>`,
      en: `<div className="flex flex-wrap gap-4">\n  <div className="flex-1 min-w-[220px] p-5 bg-{surface} border border-{border} rounded-{radius} {shadow}" aria-busy="true" aria-label="Loading">\n    <div className="h-4 w-4/5 rounded bg-{surface-muted} motion-safe:animate-pulse mb-2.5" />\n    <div className="h-3 w-3/5 rounded bg-{surface-muted} motion-safe:animate-pulse" />\n  </div>\n  <div className="flex-1 min-w-[220px] p-5 bg-{surface} border border-{border} rounded-{radius} {shadow} flex flex-col items-start gap-2.5">\n    <p className="text-sm font-semibold text-{text}">No data yet</p>\n    <button type="button" className="px-3.5 py-1.5 text-sm bg-{primary} text-{on-primary} rounded-{radius} font-medium">Add item</button>\n  </div>\n  <div role="alert" className="flex-1 min-w-[220px] p-5 bg-red-50 border border-red-200 rounded-{radius} flex flex-col items-start gap-2.5">\n    <p className="text-sm font-semibold text-red-800">Failed to load data</p>\n    <button type="button" className="px-3.5 py-1.5 text-sm bg-red-600 text-white rounded-{radius} font-medium">Retry</button>\n  </div>\n</div>`,
    },
    neutral: NEUTRAL_DATA_BLOCKS['data.states'],
  },
  {
    id: 'data.loading',
    category: 'data',
    labelKey: 'library:blocks.dataLoading',
    keywords: {
      vi: ['đang tải', 'loading', 'khung xương', 'skeleton'],
      en: ['loading', 'skeleton', 'placeholder'],
    },
    icon: 'Loader',
    jsx: {
      vi: `<div className="flex flex-col gap-3 p-5 bg-{surface} border border-{border} rounded-{radius} {shadow}" aria-busy="true" aria-label="Đang tải dữ liệu">\n  <div className="h-5 w-2/5 rounded bg-{surface-muted} motion-safe:animate-pulse" />\n  <div className="h-3.5 w-5/6 rounded bg-{surface-muted} motion-safe:animate-pulse" />\n  <div className="h-3.5 w-2/3 rounded bg-{surface-muted} motion-safe:animate-pulse" />\n</div>`,
      en: `<div className="flex flex-col gap-3 p-5 bg-{surface} border border-{border} rounded-{radius} {shadow}" aria-busy="true" aria-label="Loading data">\n  <div className="h-5 w-2/5 rounded bg-{surface-muted} motion-safe:animate-pulse" />\n  <div className="h-3.5 w-5/6 rounded bg-{surface-muted} motion-safe:animate-pulse" />\n  <div className="h-3.5 w-2/3 rounded bg-{surface-muted} motion-safe:animate-pulse" />\n</div>`,
    },
    neutral: NEUTRAL_DATA_BLOCKS['data.loading'],
  },
  {
    id: 'data.empty',
    category: 'data',
    labelKey: 'library:blocks.dataEmpty',
    keywords: {
      vi: ['trống', 'chưa có dữ liệu', 'empty'],
      en: ['empty', 'no data', 'empty state'],
    },
    icon: 'Inbox',
    jsx: {
      vi: `<div className="flex flex-col items-center text-center gap-2.5 p-8 bg-{surface} border border-dashed border-{border} rounded-{radius}">\n  <p className="text-base font-semibold text-{text}">Chưa có dữ liệu</p>\n  <p className="text-sm text-{muted}">Hãy thêm mục đầu tiên để bắt đầu làm việc.</p>\n  <button type="button" className="mt-1 px-4 py-2 text-sm bg-{primary} text-{on-primary} rounded-{radius} font-medium">Thêm mới</button>\n</div>`,
      en: `<div className="flex flex-col items-center text-center gap-2.5 p-8 bg-{surface} border border-dashed border-{border} rounded-{radius}">\n  <p className="text-base font-semibold text-{text}">No data yet</p>\n  <p className="text-sm text-{muted}">Add your first item to get started.</p>\n  <button type="button" className="mt-1 px-4 py-2 text-sm bg-{primary} text-{on-primary} rounded-{radius} font-medium">Add item</button>\n</div>`,
    },
    neutral: NEUTRAL_DATA_BLOCKS['data.empty'],
  },
  {
    id: 'data.error',
    category: 'data',
    labelKey: 'library:blocks.dataError',
    keywords: {
      vi: ['lỗi', 'thử lại', 'error', 'retry'],
      en: ['error', 'retry', 'alert', 'failed'],
    },
    icon: 'AlertTriangle',
    jsx: {
      vi: `<div role="alert" className="flex flex-col items-start gap-2 p-5 bg-red-50 border border-red-200 rounded-{radius}">\n  <p className="text-sm font-semibold text-red-800">Không thể tải dữ liệu</p>\n  <p className="text-xs text-red-700">Kết nối tạm thời gián đoạn. Vui lòng thử lại.</p>\n  <button type="button" className="mt-1 px-3.5 py-1.5 text-sm bg-red-600 text-white rounded-{radius} font-medium">Thử lại</button>\n</div>`,
      en: `<div role="alert" className="flex flex-col items-start gap-2 p-5 bg-red-50 border border-red-200 rounded-{radius}">\n  <p className="text-sm font-semibold text-red-800">Could not load data</p>\n  <p className="text-xs text-red-700">The connection was interrupted. Please try again.</p>\n  <button type="button" className="mt-1 px-3.5 py-1.5 text-sm bg-red-600 text-white rounded-{radius} font-medium">Retry</button>\n</div>`,
    },
    neutral: NEUTRAL_DATA_BLOCKS['data.error'],
  },
];
