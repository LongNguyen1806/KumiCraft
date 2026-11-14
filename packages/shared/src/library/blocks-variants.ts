// Variant definitions for button, card, heading, and hero blocks (TK-47).
import { SVG_PLACEHOLDER } from './blocks-neutral.ts';
import {
  BUTTON_NEUTRAL_VARIANTS,
  CARD_NEUTRAL_VARIANTS,
  HEADING_NEUTRAL_VARIANTS,
  HERO_NEUTRAL_VARIANTS,
} from './blocks-variants-neutral.ts';
import type { LibraryBlockVariant } from './types.ts';

export const HEADING_VARIANTS: readonly LibraryBlockVariant[] = [
  {
    id: 'lg',
    labelKey: 'library:variants.headingLg',
    jsx: {
      vi: `<h1 className="text-4xl font-extrabold font-{heading} text-{text}">\n  Tiêu đề chính\n</h1>`,
      en: `<h1 className="text-4xl font-extrabold font-{heading} text-{text}">\n  Main Heading\n</h1>`,
    },
    neutral: HEADING_NEUTRAL_VARIANTS.lg,
  },
  {
    id: 'sm',
    labelKey: 'library:variants.headingSm',
    jsx: {
      vi: `<h3 className="text-lg font-semibold font-{heading} text-{text}">\n  Tiêu đề nhỏ\n</h3>`,
      en: `<h3 className="text-lg font-semibold font-{heading} text-{text}">\n  Subheading\n</h3>`,
    },
    neutral: HEADING_NEUTRAL_VARIANTS.sm,
  },
];

export const BUTTON_VARIANTS: readonly LibraryBlockVariant[] = [
  {
    id: 'outline',
    labelKey: 'library:variants.outline',
    jsx: {
      vi: `<button type="button" className="px-4 py-2 border border-{primary} text-{primary} bg-transparent rounded-{radius} font-medium hover:bg-{surface-muted}">\n  Bấm vào đây\n</button>`,
      en: `<button type="button" className="px-4 py-2 border border-{primary} text-{primary} bg-transparent rounded-{radius} font-medium hover:bg-{surface-muted}">\n  Click here\n</button>`,
    },
    neutral: BUTTON_NEUTRAL_VARIANTS.outline,
  },
  {
    id: 'ghost',
    labelKey: 'library:variants.ghost',
    jsx: {
      vi: `<button type="button" className="px-4 py-2 text-{primary} bg-transparent rounded-{radius} font-medium hover:bg-{surface-muted}">\n  Bấm vào đây\n</button>`,
      en: `<button type="button" className="px-4 py-2 text-{primary} bg-transparent rounded-{radius} font-medium hover:bg-{surface-muted}">\n  Click here\n</button>`,
    },
    neutral: BUTTON_NEUTRAL_VARIANTS.ghost,
  },
  {
    id: 'sm',
    labelKey: 'library:variants.sm',
    jsx: {
      vi: `<button type="button" className="px-3 py-1.5 text-sm bg-{primary} text-{on-primary} rounded-{radius} font-medium hover:bg-{primary}/90">\n  Bấm vào đây\n</button>`,
      en: `<button type="button" className="px-3 py-1.5 text-sm bg-{primary} text-{on-primary} rounded-{radius} font-medium hover:bg-{primary}/90">\n  Click here\n</button>`,
    },
    neutral: BUTTON_NEUTRAL_VARIANTS.sm,
  },
  {
    id: 'lg',
    labelKey: 'library:variants.lg',
    jsx: {
      vi: `<button type="button" className="px-6 py-3 text-base bg-{primary} text-{on-primary} rounded-{radius} font-semibold hover:bg-{primary}/90">\n  Bấm vào đây\n</button>`,
      en: `<button type="button" className="px-6 py-3 text-base bg-{primary} text-{on-primary} rounded-{radius} font-semibold hover:bg-{primary}/90">\n  Click here\n</button>`,
    },
    neutral: BUTTON_NEUTRAL_VARIANTS.lg,
  },
];

export const CARD_VARIANTS: readonly LibraryBlockVariant[] = [
  {
    id: 'flat',
    labelKey: 'library:variants.flat',
    jsx: {
      vi: `<div className="min-w-0 p-6 bg-{surface-muted} rounded-{radius} {effect}">\n  <h3 className="text-lg font-semibold font-{heading} text-{text} mb-2">\n    Tiêu đề thẻ\n  </h3>\n  <p className="text-sm text-{muted} mb-4">\n    Nội dung mô tả ngắn gọn giúp người dùng hiểu thông tin chính của thẻ này.\n  </p>\n  <button type="button" className="text-sm font-medium text-{primary} hover:underline">\n    Xem chi tiết\n  </button>\n</div>`,
      en: `<div className="min-w-0 p-6 bg-{surface-muted} rounded-{radius} {effect}">\n  <h3 className="text-lg font-semibold font-{heading} text-{text} mb-2">\n    Card Title\n  </h3>\n  <p className="text-sm text-{muted} mb-4">\n    A short description helping the user understand the primary card details.\n  </p>\n  <button type="button" className="text-sm font-medium text-{primary} hover:underline">\n    View details\n  </button>\n</div>`,
    },
    neutral: CARD_NEUTRAL_VARIANTS.flat,
  },
  {
    id: 'elevated',
    labelKey: 'library:variants.elevated',
    jsx: {
      vi: `<div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n  <h3 className="text-lg font-semibold font-{heading} text-{text} mb-2">\n    Tiêu đề thẻ\n  </h3>\n  <p className="text-sm text-{muted} mb-4">\n    Nội dung mô tả ngắn gọn giúp người dùng hiểu thông tin chính của thẻ này.\n  </p>\n  <button type="button" className="text-sm font-medium text-{primary} hover:underline">\n    Xem chi tiết\n  </button>\n</div>`,
      en: `<div className="min-w-0 p-6 bg-{surface} border border-{border} rounded-{radius} {shadow} {effect}">\n  <h3 className="text-lg font-semibold font-{heading} text-{text} mb-2">\n    Card Title\n  </h3>\n  <p className="text-sm text-{muted} mb-4">\n    A short description helping the user understand the primary card details.\n  </p>\n  <button type="button" className="text-sm font-medium text-{primary} hover:underline">\n    View details\n  </button>\n</div>`,
    },
    neutral: CARD_NEUTRAL_VARIANTS.elevated,
  },
];

export const HERO_VARIANTS: readonly LibraryBlockVariant[] = [
  {
    id: 'split',
    labelKey: 'library:variants.split',
    jsx: {
      vi: `<section className="py-16 px-4 bg-{surface-muted}">\n  <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-8">\n    <div className="flex-1 basis-60">\n      <h1 className="text-4xl font-extrabold font-{heading} text-{text} mb-4">\n        Chào mừng đến với chúng tôi\n      </h1>\n      <p className="text-lg text-{muted} mb-8">\n        Giải pháp thiết kế giao diện hiện đại và nhanh chóng.\n      </p>\n      <button type="button" className="px-6 py-3 bg-{primary} text-{on-primary} rounded-{radius} font-semibold hover:bg-{primary}/90">\n        Bắt đầu ngay\n      </button>\n    </div>\n    <div className="flex-1 basis-60">\n      <img src="${SVG_PLACEHOLDER}" alt="Hình minh họa" className="w-full max-w-full h-auto rounded-{radius} object-cover" />\n    </div>\n  </div>\n</section>`,
      en: `<section className="py-16 px-4 bg-{surface-muted}">\n  <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-8">\n    <div className="flex-1 basis-60">\n      <h1 className="text-4xl font-extrabold font-{heading} text-{text} mb-4">\n        Welcome to our website\n      </h1>\n      <p className="text-lg text-{muted} mb-8">\n        Modern and swift visual interface design solution.\n      </p>\n      <button type="button" className="px-6 py-3 bg-{primary} text-{on-primary} rounded-{radius} font-semibold hover:bg-{primary}/90">\n        Get Started\n      </button>\n    </div>\n    <div className="flex-1 basis-60">\n      <img src="${SVG_PLACEHOLDER}" alt="Hero illustration" className="w-full max-w-full h-auto rounded-{radius} object-cover" />\n    </div>\n  </div>\n</section>`,
    },
    neutral: HERO_NEUTRAL_VARIANTS.split,
  },
];
