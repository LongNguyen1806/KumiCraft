// Advanced library blocks: form, data, and composite (R-LB-10, R-LB-11, R-LB-12).
import type { LibraryBlock } from './types.ts';

export const ADVANCED_BLOCKS: readonly LibraryBlock[] = [
  // 9. Form: Button
  {
    id: 'form.button',
    category: 'form',
    labelKey: 'library:blocks.button',
    keywords: {
      vi: ['nút', 'nut', 'bấm', 'bam', 'button', 'btn'],
      en: ['button', 'btn', 'click', 'action'],
    },
    icon: 'MousePointerClick',
    jsx: {
      vi: `<button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
  Bấm vào đây
</button>`,
      en: `<button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
  Click here
</button>`,
    },
  },

  // 10. Form: Input
  {
    id: 'form.input',
    category: 'form',
    labelKey: 'library:blocks.input',
    keywords: {
      vi: ['ô nhập', 'o nhap', 'nhập liệu', 'input', 'field'],
      en: ['input', 'text field', 'form field'],
    },
    icon: 'TextCursorInput',
    jsx: {
      vi: `<div className="flex flex-col gap-1.5">
  <label className="text-sm font-medium text-gray-700">
    Họ và tên
  </label>
  <input type="text" placeholder="Nhập văn bản..." className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
</div>`,
      en: `<div className="flex flex-col gap-1.5">
  <label className="text-sm font-medium text-gray-700">
    Full Name
  </label>
  <input type="text" placeholder="Enter text..." className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
</div>`,
    },
  },

  // 11. Form: Form
  {
    id: 'form.form',
    category: 'form',
    labelKey: 'library:blocks.form',
    keywords: {
      vi: ['biểu mẫu', 'bieu mau', 'form', 'nhập'],
      en: ['form', 'submit', 'fields'],
    },
    icon: 'FormInput',
    jsx: {
      vi: `<form className="space-y-4 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-gray-700">
      Email
    </label>
    <input type="email" placeholder="ban@vidu.com" className="px-3 py-2 border border-gray-300 rounded-md" />
  </div>
  <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700">
    Gửi thông tin
  </button>
</form>`,
      en: `<form className="space-y-4 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-gray-700">
      Email
    </label>
    <input type="email" placeholder="you@example.com" className="px-3 py-2 border border-gray-300 rounded-md" />
  </div>
  <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700">
    Submit
  </button>
</form>`,
    },
  },

  // 12. Data: Table
  {
    id: 'data.table',
    category: 'data',
    labelKey: 'library:blocks.table',
    keywords: {
      vi: ['bảng', 'bang', 'dữ liệu', 'table', 'grid'],
      en: ['table', 'data', 'rows', 'columns'],
    },
    icon: 'Table',
    jsx: {
      vi: `<div className="overflow-x-auto border border-gray-200 rounded-lg">
  <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-2 font-medium text-gray-700">Cột 1</th>
        <th className="px-4 py-2 font-medium text-gray-700">Cột 2</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200">
      <tr>
        <td className="px-4 py-2 text-gray-600">Dữ liệu 1</td>
        <td className="px-4 py-2 text-gray-600">Dữ liệu 2</td>
      </tr>
    </tbody>
  </table>
</div>`,
      en: `<div className="overflow-x-auto border border-gray-200 rounded-lg">
  <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-2 font-medium text-gray-700">Column 1</th>
        <th className="px-4 py-2 font-medium text-gray-700">Column 2</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200">
      <tr>
        <td className="px-4 py-2 text-gray-600">Data 1</td>
        <td className="px-4 py-2 text-gray-600">Data 2</td>
      </tr>
    </tbody>
  </table>
</div>`,
    },
  },

  // 13. Composite: Card
  {
    id: 'composite.card',
    category: 'composite',
    labelKey: 'library:blocks.card',
    keywords: {
      vi: ['thẻ', 'the', 'card', 'hộp'],
      en: ['card', 'box', 'panel', 'tile'],
    },
    icon: 'CreditCard',
    jsx: {
      vi: `<div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    Tiêu đề thẻ
  </h3>
  <p className="text-sm text-gray-600 mb-4">
    Nội dung mô tả ngắn gọn giúp người dùng hiểu thông tin chính của thẻ này.
  </p>
  <button type="button" className="text-sm font-medium text-blue-600 hover:underline">
    Xem chi tiết
  </button>
</div>`,
      en: `<div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    Card Title
  </h3>
  <p className="text-sm text-gray-600 mb-4">
    A short description helping the user understand the primary card details.
  </p>
  <button type="button" className="text-sm font-medium text-blue-600 hover:underline">
    View details
  </button>
</div>`,
    },
  },

  // 14. Composite: Navbar
  {
    id: 'composite.navbar',
    category: 'composite',
    labelKey: 'library:blocks.navbar',
    keywords: {
      vi: ['thanh điều hướng', 'menu', 'dieu huong', 'navbar', 'nav', 'header'],
      en: ['navbar', 'nav', 'menu', 'navigation', 'header'],
    },
    icon: 'Menu',
    jsx: {
      vi: `<nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
  <span className="text-xl font-bold text-gray-900">
    Logo
  </span>
  <div className="flex items-center gap-6 text-sm font-medium text-gray-600">
    <a href="#" className="hover:text-gray-900">Trang chủ</a>
    <a href="#" className="hover:text-gray-900">Giới thiệu</a>
    <a href="#" className="hover:text-gray-900">Liên hệ</a>
  </div>
</nav>`,
      en: `<nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
  <span className="text-xl font-bold text-gray-900">
    Logo
  </span>
  <div className="flex items-center gap-6 text-sm font-medium text-gray-600">
    <a href="#" className="hover:text-gray-900">Home</a>
    <a href="#" className="hover:text-gray-900">About</a>
    <a href="#" className="hover:text-gray-900">Contact</a>
  </div>
</nav>`,
    },
  },

  // 15. Composite: Footer
  {
    id: 'composite.footer',
    category: 'composite',
    labelKey: 'library:blocks.footer',
    keywords: {
      vi: ['chân trang', 'chan trang', 'footer', 'cuoi trang'],
      en: ['footer', 'bottom', 'copyright'],
    },
    icon: 'PanelBottom',
    jsx: {
      vi: `<footer className="py-8 px-4 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
  <p>
    Bản quyền 2026. Mọi quyền được bảo lưu.
  </p>
</footer>`,
      en: `<footer className="py-8 px-4 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
  <p>
    Copyright 2026. All rights reserved.
  </p>
</footer>`,
    },
  },

  // 16. Composite: Hero
  {
    id: 'composite.hero',
    category: 'composite',
    labelKey: 'library:blocks.hero',
    keywords: {
      vi: ['hero', 'chào mừng', 'banner', 'dau trang'],
      en: ['hero', 'banner', 'welcome', 'intro'],
    },
    icon: 'Sparkles',
    jsx: {
      vi: `<section className="py-20 px-4 bg-gray-50 text-center">
  <div className="max-w-3xl mx-auto">
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
      Chào mừng đến với chúng tôi
    </h1>
    <p className="text-lg text-gray-600 mb-8">
      Giải pháp thiết kế giao diện hiện đại và nhanh chóng.
    </p>
    <button type="button" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
      Bắt đầu ngay
    </button>
  </div>
</section>`,
      en: `<section className="py-20 px-4 bg-gray-50 text-center">
  <div className="max-w-3xl mx-auto">
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
      Welcome to our website
    </h1>
    <p className="text-lg text-gray-600 mb-8">
      Modern and swift visual interface design solution.
    </p>
    <button type="button" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
      Get Started
    </button>
  </div>
</section>`,
    },
  },
];
