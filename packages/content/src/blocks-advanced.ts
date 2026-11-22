// Advanced library blocks: form, data, and composite (R-LB-10, R-LB-11, R-LB-12, TK-43, TK-47, TK-48).
import { NEUTRAL_BLOCKS } from './blocks-neutral.ts';
import { BUTTON_VARIANTS, CARD_VARIANTS, HERO_VARIANTS } from './blocks-variants.ts';
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
      vi: `<button type="button" className="px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} hover:bg-{primary}/90 font-medium">
  Bấm vào đây
</button>`,
      en: `<button type="button" className="px-4 py-2 bg-{primary} text-{on-primary} rounded-{radius} hover:bg-{primary}/90 font-medium">
  Click here
</button>`,
    },
    neutral: NEUTRAL_BLOCKS['form.button'],
    variants: BUTTON_VARIANTS,
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
  <label className="text-sm font-medium text-{text}">
    Họ và tên
  </label>
  <input type="text" placeholder="Nhập văn bản..." className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius} focus:outline-none focus:ring-2 focus:ring-{primary}" />
</div>`,
      en: `<div className="flex flex-col gap-1.5">
  <label className="text-sm font-medium text-{text}">
    Full Name
  </label>
  <input type="text" placeholder="Enter text..." className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius} focus:outline-none focus:ring-2 focus:ring-{primary}" />
</div>`,
    },
    neutral: NEUTRAL_BLOCKS['form.input'],
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
      vi: `<form className="space-y-4 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-{text}">
      Email
    </label>
    <input type="email" placeholder="ban@vidu.com" className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />
  </div>
  <button type="submit" className="w-full py-2 bg-{primary} text-{on-primary} rounded-{radius} font-medium hover:bg-{primary}/90">
    Gửi thông tin
  </button>
</form>`,
      en: `<form className="space-y-4 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-{text}">
      Email
    </label>
    <input type="email" placeholder="you@example.com" className="px-3 py-2 bg-{surface} text-{text} border border-{border} rounded-{radius}" />
  </div>
  <button type="submit" className="w-full py-2 bg-{primary} text-{on-primary} rounded-{radius} font-medium hover:bg-{primary}/90">
    Submit
  </button>
</form>`,
    },
    neutral: NEUTRAL_BLOCKS['form.form'],
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
      vi: `<div className="overflow-x-auto border border-{border} rounded-{radius}">
  <table className="min-w-full divide-y divide-{border} text-sm text-left">
    <thead className="bg-{surface-muted}">
      <tr>
        <th className="px-4 py-2 font-medium text-{text}">Cột 1</th>
        <th className="px-4 py-2 font-medium text-{text}">Cột 2</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-{border} bg-{surface}">
      <tr>
        <td className="px-4 py-2 text-{muted}">Dữ liệu 1</td>
        <td className="px-4 py-2 text-{muted}">Dữ liệu 2</td>
      </tr>
    </tbody>
  </table>
</div>`,
      en: `<div className="overflow-x-auto border border-{border} rounded-{radius}">
  <table className="min-w-full divide-y divide-{border} text-sm text-left">
    <thead className="bg-{surface-muted}">
      <tr>
        <th className="px-4 py-2 font-medium text-{text}">Column 1</th>
        <th className="px-4 py-2 font-medium text-{text}">Column 2</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-{border} bg-{surface}">
      <tr>
        <td className="px-4 py-2 text-{muted}">Data 1</td>
        <td className="px-4 py-2 text-{muted}">Data 2</td>
      </tr>
    </tbody>
  </table>
</div>`,
    },
    neutral: NEUTRAL_BLOCKS['data.table'],
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
      vi: `<div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">
  <h3 className="text-lg font-semibold font-{heading} text-{text} mb-2">
    Tiêu đề thẻ
  </h3>
  <p className="text-sm text-{muted} mb-4">
    Nội dung mô tả ngắn gọn giúp người dùng hiểu thông tin chính của thẻ này.
  </p>
  <button type="button" className="text-sm font-medium text-{primary} hover:underline">
    Xem chi tiết
  </button>
</div>`,
      en: `<div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">
  <h3 className="text-lg font-semibold font-{heading} text-{text} mb-2">
    Card Title
  </h3>
  <p className="text-sm text-{muted} mb-4">
    A short description helping the user understand the primary card details.
  </p>
  <button type="button" className="text-sm font-medium text-{primary} hover:underline">
    View details
  </button>
</div>`,
    },
    neutral: NEUTRAL_BLOCKS['composite.card'],
    variants: CARD_VARIANTS,
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
      vi: `<nav className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-{surface} border-b border-{border}">
  <span className="text-xl font-bold font-{heading} text-{text}">
    Logo
  </span>
  <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-{muted}">
    <a href="#" className="hover:text-{text}">Trang chủ</a>
    <a href="#" className="hover:text-{text}">Giới thiệu</a>
    <a href="#" className="hover:text-{text}">Liên hệ</a>
  </div>
</nav>`,
      en: `<nav className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-{surface} border-b border-{border}">
  <span className="text-xl font-bold font-{heading} text-{text}">
    Logo
  </span>
  <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-{muted}">
    <a href="#" className="hover:text-{text}">Home</a>
    <a href="#" className="hover:text-{text}">About</a>
    <a href="#" className="hover:text-{text}">Contact</a>
  </div>
</nav>`,
    },
    neutral: NEUTRAL_BLOCKS['composite.navbar'],
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
      vi: `<footer className="py-8 px-6 bg-{surface-muted} border-t border-{border} text-sm text-{muted}">
  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
    <div>
      <p className="font-semibold font-{heading} text-{text} mb-1">Thương hiệu</p>
      <p>Bản quyền 2026. Mọi quyền được bảo lưu.</p>
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <a href="#" className="hover:text-{text}">Giới thiệu</a>
      <a href="#" className="hover:text-{text}">Điều khoản</a>
      <a href="#" className="hover:text-{text}">Liên hệ</a>
    </div>
  </div>
</footer>`,
      en: `<footer className="py-8 px-6 bg-{surface-muted} border-t border-{border} text-sm text-{muted}">
  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
    <div>
      <p className="font-semibold font-{heading} text-{text} mb-1">Brand</p>
      <p>Copyright 2026. All rights reserved.</p>
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <a href="#" className="hover:text-{text}">About</a>
      <a href="#" className="hover:text-{text}">Terms</a>
      <a href="#" className="hover:text-{text}">Contact</a>
    </div>
  </div>
</footer>`,
    },
    neutral: NEUTRAL_BLOCKS['composite.footer'],
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
      vi: `<section className="py-20 px-4 bg-{surface-muted} text-center">
  <div className="max-w-3xl mx-auto">
    <h1 className="text-4xl font-extrabold font-{heading} text-{text} mb-4">
      Chào mừng đến với chúng tôi
    </h1>
    <p className="text-lg text-{muted} mb-8">
      Giải pháp thiết kế giao diện hiện đại và nhanh chóng.
    </p>
    <button type="button" className="px-6 py-3 bg-{primary} text-{on-primary} rounded-{radius} font-semibold hover:bg-{primary}/90">
      Bắt đầu ngay
    </button>
  </div>
</section>`,
      en: `<section className="py-20 px-4 bg-{surface-muted} text-center">
  <div className="max-w-3xl mx-auto">
    <h1 className="text-4xl font-extrabold font-{heading} text-{text} mb-4">
      Welcome to our website
    </h1>
    <p className="text-lg text-{muted} mb-8">
      Modern and swift visual interface design solution.
    </p>
    <button type="button" className="px-6 py-3 bg-{primary} text-{on-primary} rounded-{radius} font-semibold hover:bg-{primary}/90">
      Get Started
    </button>
  </div>
</section>`,
    },
    neutral: NEUTRAL_BLOCKS['composite.hero'],
    variants: HERO_VARIANTS,
  },
];
