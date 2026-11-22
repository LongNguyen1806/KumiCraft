import { NEUTRAL_LANDING_A_BLOCKS } from './blocks-neutral-landing-a.ts';
import type { LibraryBlock } from './types.ts';

const ICON_ZAP = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-icon="zap" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>`;
const ICON_SHIELD = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-icon="shield" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>`;
const ICON_LAYERS = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-icon="layers" aria-hidden="true"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></svg>`;

export const LANDING_A_LIBRARY_BLOCKS: readonly LibraryBlock[] = [
  {
    id: 'landing.pricing',
    category: 'landing',
    labelKey: 'library:blocks.pricing',
    keywords: {
      vi: ['bảng giá', 'bang gia', 'giá', 'gia', 'gói dịch vụ', 'pricing'],
      en: ['pricing', 'plans', 'tiers', 'cost', 'subscription'],
    },
    icon: 'CreditCard',
    jsx: {
      vi: `<section className="py-12 px-4">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-6">\n    <div className="min-w-0 p-7 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <p className="text-sm font-semibold text-{muted} mb-2">Cơ bản</p>\n      <p className="text-3xl font-bold font-{heading} text-{text} mb-3">199k / tháng</p>\n      <p className="text-sm text-{muted} mb-6">Phù hợp cho cá nhân mới bắt đầu.</p>\n      <button type="button" className="w-full px-4 py-2.5 border border-{border} rounded-{radius} font-semibold text-{text}">Chọn gói</button>\n    </div>\n    <div className="min-w-0 p-7 bg-{surface} border-2 border-{primary} rounded-{radius} {shadow} {effect}">\n      <p className="text-sm font-semibold text-{primary} mb-2">Chuyên nghiệp</p>\n      <p className="text-3xl font-bold font-{heading} text-{text} mb-3">499k / tháng</p>\n      <p className="text-sm text-{muted} mb-6">Đầy đủ tính năng cho nhóm tăng trưởng.</p>\n      <button type="button" className="w-full px-4 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Dùng thử ngay</button>\n    </div>\n  </div>\n</section>`,
      en: `<section className="py-12 px-4">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-6">\n    <div className="min-w-0 p-7 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <p className="text-sm font-semibold text-{muted} mb-2">Starter</p>\n      <p className="text-3xl font-bold font-{heading} text-{text} mb-3">$19 / month</p>\n      <p className="text-sm text-{muted} mb-6">Ideal for solo builders getting started.</p>\n      <button type="button" className="w-full px-4 py-2.5 border border-{border} rounded-{radius} font-semibold text-{text}">Choose plan</button>\n    </div>\n    <div className="min-w-0 p-7 bg-{surface} border-2 border-{primary} rounded-{radius} {shadow} {effect}">\n      <p className="text-sm font-semibold text-{primary} mb-2">Pro</p>\n      <p className="text-3xl font-bold font-{heading} text-{text} mb-3">$49 / month</p>\n      <p className="text-sm text-{muted} mb-6">Complete toolkit for growing product teams.</p>\n      <button type="button" className="w-full px-4 py-2.5 bg-{primary} text-{on-primary} rounded-{radius} font-semibold">Start free trial</button>\n    </div>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_A_BLOCKS['landing.pricing'],
  },
  {
    id: 'landing.testimonials',
    category: 'landing',
    labelKey: 'library:blocks.testimonials',
    keywords: {
      vi: ['đánh giá', 'khách hàng nói', 'nhận xét', 'danh gia', 'testimonials'],
      en: ['testimonials', 'reviews', 'quotes', 'customers'],
    },
    icon: 'MessageSquare',
    jsx: {
      vi: `<section className="py-12 px-4 bg-{surface-muted}">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-6">\n    <figure className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <blockquote className="text-sm leading-relaxed text-{text} mb-3">“Thời gian dựng giao diện giảm một nửa nhờ bộ khối dựng sẵn.”</blockquote>\n      <figcaption className="text-xs font-semibold text-{muted}">Minh Trí — Giám đốc Sản phẩm</figcaption>\n    </figure>\n    <figure className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <blockquote className="text-sm leading-relaxed text-{text} mb-3">“Màu sắc và font chữ tự khớp theo hệ thiết kế của công ty.”</blockquote>\n      <figcaption className="text-xs font-semibold text-{muted}">Thu Hà — Trưởng nhóm Frontend</figcaption>\n    </figure>\n  </div>\n</section>`,
      en: `<section className="py-12 px-4 bg-{surface-muted}">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-6">\n    <figure className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <blockquote className="text-sm leading-relaxed text-{text} mb-3">“We cut UI assembly time in half using these building blocks.”</blockquote>\n      <figcaption className="text-xs font-semibold text-{muted}">Alex Rivera — Product Lead</figcaption>\n    </figure>\n    <figure className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <blockquote className="text-sm leading-relaxed text-{text} mb-3">“Colors and typography match our design tokens right away.”</blockquote>\n      <figcaption className="text-xs font-semibold text-{muted}">Hannah Chen — Frontend Lead</figcaption>\n    </figure>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_A_BLOCKS['landing.testimonials'],
  },
  {
    id: 'landing.faq',
    category: 'landing',
    labelKey: 'library:blocks.faq',
    keywords: {
      vi: ['hỏi đáp', 'câu hỏi', 'hoi dap', 'faq'],
      en: ['faq', 'questions', 'answers', 'help'],
    },
    icon: 'HelpCircle',
    jsx: {
      vi: `<section className="py-12 px-4">\n  <div className="max-w-3xl mx-auto flex flex-col gap-3">\n    <h2 className="text-2xl font-bold font-{heading} text-{text} mb-2">Câu hỏi thường gặp</h2>\n    <details className="p-4 bg-{surface} border border-{border} rounded-{radius}" open>\n      <summary className="font-semibold text-{text} cursor-pointer">Tôi có thể tùy biến màu sắc dự án không?</summary>\n      <p className="text-sm text-{muted} mt-2">Có, toàn bộ khối tự động dùng bảng màu và bo góc hiện tại.</p>\n    </details>\n    <details className="p-4 bg-{surface} border border-{border} rounded-{radius}">\n      <summary className="font-semibold text-{text} cursor-pointer">Mã xuất ra có phụ thuộc thư viện ngoài?</summary>\n      <p className="text-sm text-{muted} mt-2">Không, chỉ dùng React thuần và CSS của chính dự án.</p>\n    </details>\n  </div>\n</section>`,
      en: `<section className="py-12 px-4">\n  <div className="max-w-3xl mx-auto flex flex-col gap-3">\n    <h2 className="text-2xl font-bold font-{heading} text-{text} mb-2">Frequently asked questions</h2>\n    <details className="p-4 bg-{surface} border border-{border} rounded-{radius}" open>\n      <summary className="font-semibold text-{text} cursor-pointer">Can I customize colors for my project?</summary>\n      <p className="text-sm text-{muted} mt-2">Yes, every block inherits your project palette and radius tokens.</p>\n    </details>\n    <details className="p-4 bg-{surface} border border-{border} rounded-{radius}">\n      <summary className="font-semibold text-{text} cursor-pointer">Does the generated code need extra libraries?</summary>\n      <p className="text-sm text-{muted} mt-2">No, it outputs clean React components and project styles.</p>\n    </details>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_A_BLOCKS['landing.faq'],
  },
  {
    id: 'landing.stats',
    category: 'landing',
    labelKey: 'library:blocks.landingStats',
    keywords: {
      vi: ['số liệu', 'thành tựu', 'so lieu', 'stats'],
      en: ['stats', 'metrics', 'numbers', 'proof'],
    },
    icon: 'BarChart2',
    jsx: {
      vi: `<section className="py-10 px-4 bg-{surface-muted}">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-5">\n    <div className="p-5 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <p className="text-3xl font-extrabold font-{heading} text-{primary}">12.400+</p>\n      <p className="text-xs text-{muted} mt-1">Dự án đang chạy</p>\n    </div>\n    <div className="p-5 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <p className="text-3xl font-extrabold font-{heading} text-{primary}">99,9%</p>\n      <p className="text-xs text-{muted} mt-1">Thời gian ổn định</p>\n    </div>\n    <div className="p-5 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <p className="text-3xl font-extrabold font-{heading} text-{primary}">4,9/5</p>\n      <p className="text-xs text-{muted} mt-1">Đánh giá người dùng</p>\n    </div>\n  </div>\n</section>`,
      en: `<section className="py-10 px-4 bg-{surface-muted}">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-5">\n    <div className="p-5 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <p className="text-3xl font-extrabold font-{heading} text-{primary}">12,400+</p>\n      <p className="text-xs text-{muted} mt-1">Active projects</p>\n    </div>\n    <div className="p-5 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <p className="text-3xl font-extrabold font-{heading} text-{primary}">99.9%</p>\n      <p className="text-xs text-{muted} mt-1">Service uptime</p>\n    </div>\n    <div className="p-5 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <p className="text-3xl font-extrabold font-{heading} text-{primary}">4.9/5</p>\n      <p className="text-xs text-{muted} mt-1">Customer rating</p>\n    </div>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_A_BLOCKS['landing.stats'],
  },
  {
    id: 'landing.logos',
    category: 'landing',
    labelKey: 'library:blocks.logos',
    keywords: {
      vi: ['đối tác', 'thương hiệu', 'doi tac', 'logos'],
      en: ['logos', 'partners', 'brands', 'trust'],
    },
    icon: 'Award',
    jsx: {
      vi: `<section className="py-8 px-4 text-center">\n  <p className="text-xs font-medium text-{muted} mb-5">Được tin dùng bởi hơn 500 đội ngũ sản phẩm</p>\n  <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-8 text-sm font-bold tracking-widest text-{muted}">\n    <span>NORTHSTAR</span>\n    <span>VERDANT</span>\n    <span>KINETIC</span>\n    <span>SOLARIS</span>\n  </div>\n</section>`,
      en: `<section className="py-8 px-4 text-center">\n  <p className="text-xs font-medium text-{muted} mb-5">Trusted by 500+ product teams</p>\n  <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-8 text-sm font-bold tracking-widest text-{muted}">\n    <span>NORTHSTAR</span>\n    <span>VERDANT</span>\n    <span>KINETIC</span>\n    <span>SOLARIS</span>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_A_BLOCKS['landing.logos'],
  },
  {
    id: 'landing.team',
    category: 'landing',
    labelKey: 'library:blocks.team',
    keywords: {
      vi: ['đội ngũ', 'thành viên', 'doi ngu', 'team'],
      en: ['team', 'members', 'people', 'about'],
    },
    icon: 'Users',
    jsx: {
      vi: `<section className="py-12 px-4">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-6">\n    <div className="p-6 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center font-bold">LA</div>\n      <h3 className="text-base font-semibold text-{text}">Lan Anh</h3>\n      <p className="text-xs text-{muted}">Thiết kế sản phẩm</p>\n    </div>\n    <div className="p-6 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center font-bold">QM</div>\n      <h3 className="text-base font-semibold text-{text}">Quang Minh</h3>\n      <p className="text-xs text-{muted}">Kỹ sư trưởng</p>\n    </div>\n    <div className="p-6 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center font-bold">HT</div>\n      <h3 className="text-base font-semibold text-{text}">Hoàng Tùng</h3>\n      <p className="text-xs text-{muted}">Quản lý vận hành</p>\n    </div>\n  </div>\n</section>`,
      en: `<section className="py-12 px-4">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-6">\n    <div className="p-6 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center font-bold">LA</div>\n      <h3 className="text-base font-semibold text-{text}">Claire Lin</h3>\n      <p className="text-xs text-{muted}">Product Designer</p>\n    </div>\n    <div className="p-6 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center font-bold">QM</div>\n      <h3 className="text-base font-semibold text-{text}">Marcus Reed</h3>\n      <p className="text-xs text-{muted}">Principal Engineer</p>\n    </div>\n    <div className="p-6 bg-{surface} border border-{border} rounded-{radius} text-center">\n      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-{primary} text-{on-primary} flex items-center justify-center font-bold">HT</div>\n      <h3 className="text-base font-semibold text-{text}">Devon Park</h3>\n      <p className="text-xs text-{muted}">Operations Lead</p>\n    </div>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_A_BLOCKS['landing.team'],
  },
  {
    id: 'landing.features',
    category: 'landing',
    labelKey: 'library:blocks.features',
    keywords: {
      vi: ['tính năng', 'tinh nang', 'ưu điểm', 'features'],
      en: ['features', 'benefits', 'highlights', 'capabilities'],
    },
    icon: 'Sparkles',
    jsx: {
      vi: `<section className="py-12 px-4">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">\n    <div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <div className="w-10 h-10 mb-3 rounded-{radius} bg-{surface-muted} text-{primary} inline-flex items-center justify-center">${ICON_ZAP}</div>\n      <h3 className="text-base font-semibold font-{heading} text-{text} mb-1">Tốc độ cao</h3>\n      <p className="text-sm text-{muted}">Khởi tạo bố cục chuẩn xác chỉ trong vài giây.</p>\n    </div>\n    <div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <div className="w-10 h-10 mb-3 rounded-{radius} bg-{surface-muted} text-{primary} inline-flex items-center justify-center">${ICON_SHIELD}</div>\n      <h3 className="text-base font-semibold font-{heading} text-{text} mb-1">An toàn mã nguồn</h3>\n      <p className="text-sm text-{muted}">Sửa trực tiếp JSX sạch sẽ không tạo mã rác.</p>\n    </div>\n    <div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <div className="w-10 h-10 mb-3 rounded-{radius} bg-{surface-muted} text-{primary} inline-flex items-center justify-center">${ICON_LAYERS}</div>\n      <h3 className="text-base font-semibold font-{heading} text-{text} mb-1">Đồng bộ giao diện</h3>\n      <p className="text-sm text-{muted}">Tự động nhận màu, font và bo góc của dự án.</p>\n    </div>\n  </div>\n</section>`,
      en: `<section className="py-12 px-4">\n  <div className="max-w-5xl mx-auto grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">\n    <div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <div className="w-10 h-10 mb-3 rounded-{radius} bg-{surface-muted} text-{primary} inline-flex items-center justify-center">${ICON_ZAP}</div>\n      <h3 className="text-base font-semibold font-{heading} text-{text} mb-1">Fast workflow</h3>\n      <p className="text-sm text-{muted}">Assemble clean layouts in seconds without boilerplate.</p>\n    </div>\n    <div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <div className="w-10 h-10 mb-3 rounded-{radius} bg-{surface-muted} text-{primary} inline-flex items-center justify-center">${ICON_SHIELD}</div>\n      <h3 className="text-base font-semibold font-{heading} text-{text} mb-1">Clean code</h3>\n      <p className="text-sm text-{muted}">Writes readable JSX directly into your project files.</p>\n    </div>\n    <div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n      <div className="w-10 h-10 mb-3 rounded-{radius} bg-{surface-muted} text-{primary} inline-flex items-center justify-center">${ICON_LAYERS}</div>\n      <h3 className="text-base font-semibold font-{heading} text-{text} mb-1">Theme aware</h3>\n      <p className="text-sm text-{muted}">Inherits project colors, fonts and corner radius.</p>\n    </div>\n  </div>\n</section>`,
    },
    neutral: NEUTRAL_LANDING_A_BLOCKS['landing.features'],
  },
];
