import { SVG_PLACEHOLDER } from './blocks-neutral.ts';
import { NEUTRAL_LANDING_B_BLOCKS } from './blocks-neutral-landing-b.ts';
import type { LibraryBlock } from './types.ts';

export const LANDING_B_LIBRARY_BLOCKS: readonly LibraryBlock[] = [
  {
    id: 'landing.cta',
    category: 'landing',
    labelKey: 'library:blocks.cta',
    keywords: {
      vi: ['kêu gọi hành động', 'cta', 'keu goi'],
      en: ['cta', 'call to action', 'banner', 'signup'],
    },
    icon: 'Megaphone',
    jsx: {
      vi: `<section className="py-12 px-4">\n  <div className="max-w-4xl mx-auto p-8 bg-{surface-muted} border border-{border} rounded-{radius} text-center {shadow} {effect}">\n    <h2 className="text-2xl font-bold font-{heading} text-{text} mb-2">Sẵn sàng nâng cấp giao diện hôm nay?</h2>\n    <p className="text-sm text-{muted} mb-6">Bắt đầu miễn phí cùng bộ khối tương thích mọi hệ thiết kế.</p>\n    <div className="flex flex-wrap justify-center gap-3">\n      <button type="button" className="px-5 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Dùng thử ngay</button>\n      <button type="button" className="px-5 py-2.5 bg-{surface} text-{text} border border-{border} rounded-{radius} font-semibold">Xem tài liệu</button>\n    </div>\n  </div>\n</section>`,
      en: `<section className="py-12 px-4">\n  <div className="max-w-4xl mx-auto p-8 bg-{surface-muted} border border-{border} rounded-{radius} text-center {shadow} {effect}">\n    <h2 className="text-2xl font-bold font-{heading} text-{text} mb-2">Ready to ship cleaner interfaces today?</h2>\n    <p className="text-sm text-{muted} mb-6">Start free with blocks that match your design system automatically.</p>\n    <div className="flex flex-wrap justify-center gap-3">\n      <button type="button" className="px-5 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Get started free</button>\n      <button type="button" className="px-5 py-2.5 bg-{surface} text-{text} border border-{border} rounded-{radius} font-semibold">Read docs</button>\n    </div>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_B_BLOCKS['landing.cta'],
  },
  {
    id: 'landing.comparison',
    category: 'landing',
    labelKey: 'library:blocks.comparison',
    keywords: {
      vi: ['so sánh', 'so sanh', 'đối chiếu', 'comparison'],
      en: ['comparison', 'before after', 'compare', 'vs'],
    },
    icon: 'Columns',
    jsx: {
      vi: `<section className="py-10 px-4">\n  <div className="max-w-4xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-5">\n    <div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius}">\n      <h3 className="text-lg font-semibold font-{heading} text-{text} mb-3">Trước khi dùng</h3>\n      <p className="text-sm text-{muted} mb-2">Chỉnh tay từng class màu và khoảng cách</p>\n      <p className="text-sm text-{muted}">Phải tự kiểm tra độ tương phản</p>\n    </div>\n    <div className="min-w-0 p-6 bg-{surface-muted} border-2 border-{primary} rounded-{radius}">\n      <h3 className="text-lg font-semibold font-{heading} text-{text} mb-3">Với bộ khối mới</h3>\n      <p className="text-sm text-{muted} mb-2">Khớp sẵn bảng màu và font chữ dự án</p>\n      <p className="text-sm text-{muted}">Tương thích Tailwind, Bootstrap và CSS</p>\n    </div>\n  </div>\n</section>`,
      en: `<section className="py-10 px-4">\n  <div className="max-w-4xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-5">\n    <div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius}">\n      <h3 className="text-lg font-semibold font-{heading} text-{text} mb-3">Manual setup</h3>\n      <p className="text-sm text-{muted} mb-2">Tune every spacing and color class manually</p>\n      <p className="text-sm text-{muted}">Verify color contrast by hand</p>\n    </div>\n    <div className="min-w-0 p-6 bg-{surface-muted} border-2 border-{primary} rounded-{radius}">\n      <h3 className="text-lg font-semibold font-{heading} text-{text} mb-3">With smart blocks</h3>\n      <p className="text-sm text-{muted} mb-2">Inherits project colors and font scale</p>\n      <p className="text-sm text-{muted}">Works across Tailwind, Bootstrap and CSS</p>\n    </div>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_B_BLOCKS['landing.comparison'],
  },
  {
    id: 'landing.timeline',
    category: 'landing',
    labelKey: 'library:blocks.timeline',
    keywords: {
      vi: ['quy trình', 'tiến trình', 'các bước', 'timeline', 'quy trinh'],
      en: ['timeline', 'steps', 'process', 'roadmap'],
    },
    icon: 'GitCommit',
    jsx: {
      vi: `<section className="py-10 px-4">\n  <ol className="max-w-2xl mx-auto flex flex-col gap-4">\n    <li className="flex items-start gap-3.5 p-4 bg-{surface} border border-{border} rounded-{radius}">\n      <span className="w-7 h-7 shrink-0 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center text-xs font-bold">1</span>\n      <div><h3 className="text-base font-semibold text-{text}">Chọn khung khối</h3><p className="text-sm text-{muted}">Kéo thả các phần tử phù hợp vào trang.</p></div>\n    </li>\n    <li className="flex items-start gap-3.5 p-4 bg-{surface} border border-{border} rounded-{radius}">\n      <span className="w-7 h-7 shrink-0 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center text-xs font-bold">2</span>\n      <div><h3 className="text-base font-semibold text-{text}">Tinh chỉnh chữ</h3><p className="text-sm text-{muted}">Nhấp đúp trực tiếp trên Canvas để sửa nội dung.</p></div>\n    </li>\n    <li className="flex items-start gap-3.5 p-4 bg-{surface} border border-{border} rounded-{radius}">\n      <span className="w-7 h-7 shrink-0 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center text-xs font-bold">3</span>\n      <div><h3 className="text-base font-semibold text-{text}">Xuất bản ngay</h3><p className="text-sm text-{muted}">Mã React sạch sẵn sàng đưa lên máy chủ.</p></div>\n    </li>\n  </ol>\n</section>`,
      en: `<section className="py-10 px-4">\n  <ol className="max-w-2xl mx-auto flex flex-col gap-4">\n    <li className="flex items-start gap-3.5 p-4 bg-{surface} border border-{border} rounded-{radius}">\n      <span className="w-7 h-7 shrink-0 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center text-xs font-bold">1</span>\n      <div><h3 className="text-base font-semibold text-{text}">Pick blocks</h3><p className="text-sm text-{muted}">Drop pre-styled sections directly onto your page.</p></div>\n    </li>\n    <li className="flex items-start gap-3.5 p-4 bg-{surface} border border-{border} rounded-{radius}">\n      <span className="w-7 h-7 shrink-0 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center text-xs font-bold">2</span>\n      <div><h3 className="text-base font-semibold text-{text}">Edit copy</h3><p className="text-sm text-{muted}">Double-click text directly on the visual canvas.</p></div>\n    </li>\n    <li className="flex items-start gap-3.5 p-4 bg-{surface} border border-{border} rounded-{radius}">\n      <span className="w-7 h-7 shrink-0 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center text-xs font-bold">3</span>\n      <div><h3 className="text-base font-semibold text-{text}">Ship clean React</h3><p className="text-sm text-{muted}">Clean JSX committed straight to your repository.</p></div>\n    </li>\n  </ol>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_B_BLOCKS['landing.timeline'],
  },
  {
    id: 'landing.blog-card',
    category: 'landing',
    labelKey: 'library:blocks.blogCard',
    keywords: {
      vi: ['thẻ bài viết', 'tin tức', 'blog', 'bai viet'],
      en: ['blog', 'article', 'post', 'news card'],
    },
    icon: 'FileText',
    jsx: {
      vi: `<article className="min-w-0 bg-{surface} border border-{border} rounded-{radius} overflow-hidden {shadow} {effect}">\n  <img src="${SVG_PLACEHOLDER}" alt="Ảnh bìa bài viết" className="w-full h-44 object-cover" />\n  <div className="p-5">\n    <p className="text-xs font-semibold text-{primary} mb-1.5">Thiết kế · 4 phút đọc</p>\n    <h3 className="text-lg font-semibold font-{heading} text-{text} mb-2">Nguyên tắc nhịp khoảng cách trong giao diện</h3>\n    <p className="text-sm text-{muted}">Cách dùng thang 4px giúp bố cục gọn gàng và dễ mở rộng trên nhiều màn hình.</p>\n  </div>\n</article>`,
      en: `<article className="min-w-0 bg-{surface} border border-{border} rounded-{radius} overflow-hidden {shadow} {effect}">\n  <img src="${SVG_PLACEHOLDER}" alt="Article cover" className="w-full h-44 object-cover" />\n  <div className="p-5">\n    <p className="text-xs font-semibold text-{primary} mb-1.5">Design · 4 min read</p>\n    <h3 className="text-lg font-semibold font-{heading} text-{text} mb-2">Spacing rhythm for clearer interfaces</h3>\n    <p className="text-sm text-{muted}">How a 4px rhythm keeps multi-column layouts balanced without extra rules.</p>\n  </div>\n</article>`,
    },
    neutral: NEUTRAL_LANDING_B_BLOCKS['landing.blog-card'],
  },
  {
    id: 'landing.footer-columns',
    category: 'landing',
    labelKey: 'library:blocks.footerColumns',
    keywords: {
      vi: ['chân trang nhiều cột', 'chan trang', 'footer', 'lien ket'],
      en: ['footer columns', 'footer', 'links', 'sitemap'],
    },
    icon: 'LayoutTemplate',
    jsx: {
      vi: `<footer className="py-10 px-6 bg-{surface-muted} border-t border-{border}">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-6">\n    <div>\n      <p className="text-lg font-bold font-{heading} text-{text} mb-2">KumiCraft</p>\n      <p className="text-xs text-{muted}">Bộ công cụ dựng giao diện trực quan cho React.</p>\n    </div>\n    <div className="flex flex-col gap-2 text-xs text-{muted}">\n      <p className="font-semibold text-{text}">Sản phẩm</p>\n      <a href="#" className="hover:text-{text}">Tính năng</a>\n      <a href="#" className="hover:text-{text}">Bảng giá</a>\n    </div>\n    <div className="flex flex-col gap-2 text-xs text-{muted}">\n      <p className="font-semibold text-{text}">Tài nguyên</p>\n      <a href="#" className="hover:text-{text}">Tài liệu</a>\n      <a href="#" className="hover:text-{text}">Liên hệ</a>\n    </div>\n  </div>\n</footer>`,
      en: `<footer className="py-10 px-6 bg-{surface-muted} border-t border-{border}">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-6">\n    <div>\n      <p className="text-lg font-bold font-{heading} text-{text} mb-2">KumiCraft</p>\n      <p className="text-xs text-{muted}">Visual React workspace for product teams.</p>\n    </div>\n    <div className="flex flex-col gap-2 text-xs text-{muted}">\n      <p className="font-semibold text-{text}">Product</p>\n      <a href="#" className="hover:text-{text}">Features</a>\n      <a href="#" className="hover:text-{text}">Pricing</a>\n    </div>\n    <div className="flex flex-col gap-2 text-xs text-{muted}">\n      <p className="font-semibold text-{text}">Resources</p>\n      <a href="#" className="hover:text-{text}">Docs</a>\n      <a href="#" className="hover:text-{text}">Contact</a>\n    </div>\n  </div>\n</footer>`,
    },
    neutral: NEUTRAL_LANDING_B_BLOCKS['landing.footer-columns'],
  },
  {
    id: 'landing.hero-image',
    category: 'landing',
    labelKey: 'library:blocks.heroImage',
    keywords: {
      vi: ['hero có ảnh', 'giới thiệu', 'hero', 'anh bia'],
      en: ['hero image', 'hero', 'split hero', 'banner'],
    },
    icon: 'Sparkles',
    jsx: {
      vi: `<section className="py-14 px-4 bg-{surface-muted}">\n  <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-8">\n    <div className="flex-1 basis-72">\n      <h1 className="text-4xl font-extrabold font-{heading} text-{text} mb-3">Thiết kế sản phẩm nhanh gấp đôi</h1>\n      <p className="text-base text-{muted} mb-6">Tạo trang đích hoàn chỉnh với màu sắc và chữ đồng bộ ngay từ đầu.</p>\n      <button type="button" className="px-6 py-3 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Khám phá ngay</button>\n    </div>\n    <div className="flex-1 basis-72">\n      <img src="${SVG_PLACEHOLDER}" alt="Ảnh minh họa sản phẩm" className="w-full h-auto rounded-{radius} object-cover" />\n    </div>\n  </div>\n</section>`,
      en: `<section className="py-14 px-4 bg-{surface-muted}">\n  <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-8">\n    <div className="flex-1 basis-72">\n      <h1 className="text-4xl font-extrabold font-{heading} text-{text} mb-3">Design interfaces twice as fast</h1>\n      <p className="text-base text-{muted} mb-6">Build cohesive landing pages with your project tokens from day one.</p>\n      <button type="button" className="px-6 py-3 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Explore now</button>\n    </div>\n    <div className="flex-1 basis-72">\n      <img src="${SVG_PLACEHOLDER}" alt="Product showcase" className="w-full h-auto rounded-{radius} object-cover" />\n    </div>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_B_BLOCKS['landing.hero-image'],
  },
  {
    id: 'landing.hero-form',
    category: 'landing',
    labelKey: 'library:blocks.heroForm',
    keywords: {
      vi: ['hero có form', 'đăng ký nhận tin', 'hero', 'newsletter'],
      en: ['hero form', 'newsletter', 'waitlist', 'hero'],
    },
    icon: 'Mail',
    jsx: {
      vi: `<section className="py-14 px-4 bg-{surface-muted} text-center">\n  <div className="max-w-xl mx-auto">\n    <h1 className="text-3xl font-extrabold font-{heading} text-{text} mb-3">Nhận bản tin thiết kế hàng tuần</h1>\n    <p className="text-sm text-{muted} mb-6">Cập nhật mẹo bố cục và thành phần UI mới nhất trực tiếp qua hộp thư.</p>\n    <form className="flex flex-wrap items-center justify-center gap-2">\n      <label htmlFor="kc-hero-email" className="text-xs font-medium text-{text}">Email</label>\n      <input id="kc-hero-email" type="email" placeholder="ban@congty.vn" className="flex-1 min-w-0 px-3.5 py-2.5 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n      <button type="submit" className="px-5 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Đăng ký</button>\n    </form>\n  </div>\n</section>`,
      en: `<section className="py-14 px-4 bg-{surface-muted} text-center">\n  <div className="max-w-xl mx-auto">\n    <h1 className="text-3xl font-extrabold font-{heading} text-{text} mb-3">Get weekly interface notes</h1>\n    <p className="text-sm text-{muted} mb-6">Layout patterns and UI tips delivered straight to your inbox.</p>\n    <form className="flex flex-wrap items-center justify-center gap-2">\n      <label htmlFor="kc-hero-email" className="text-xs font-medium text-{text}">Email</label>\n      <input id="kc-hero-email" type="email" placeholder="you@company.com" className="flex-1 min-w-0 px-3.5 py-2.5 bg-{surface} text-{text} border border-{border} rounded-{radius}" />\n      <button type="submit" className="px-5 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Subscribe</button>\n    </form>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_B_BLOCKS['landing.hero-form'],
  },
];
