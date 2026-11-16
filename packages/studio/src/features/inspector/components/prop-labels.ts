// How the "Customize" group names and orders a component's knobs (thiet-ke-component.md §3):
// plain words for common prop names, the code name under them, grouped by what the knob does.
import type { ComponentPropRole, ComponentPropSpec } from '@kumicraft/shared';

/** Groups in the order the Inspector shows them; `advanced` folds at the end. */
export const GROUP_ORDER = [
  'content',
  'image',
  'link',
  'toggle',
  'style',
  'state',
  'behavior',
  'data',
] as const satisfies readonly ComponentPropRole[];

export type ShownGroup = (typeof GROUP_ORDER)[number];

type Words = readonly [vi: string, en: string];

const NAMES: Readonly<Record<string, Words>> = {
  title: ['Tiêu đề', 'Title'],
  heading: ['Tiêu đề', 'Heading'],
  subtitle: ['Phụ đề', 'Subtitle'],
  name: ['Tên', 'Name'],
  label: ['Nhãn', 'Label'],
  text: ['Chữ', 'Text'],
  description: ['Mô tả', 'Description'],
  caption: ['Chú thích', 'Caption'],
  content: ['Nội dung', 'Content'],
  message: ['Thông báo', 'Message'],
  price: ['Giá', 'Price'],
  badge: ['Nhãn nhỏ', 'Badge'],
  author: ['Tác giả', 'Author'],
  date: ['Ngày', 'Date'],
  code: ['Mã', 'Code'],
  placeholder: ['Chữ gợi ý', 'Placeholder'],
  alt: ['Mô tả ảnh', 'Image description'],
  image: ['Ảnh', 'Image'],
  img: ['Ảnh', 'Image'],
  src: ['Ảnh', 'Image'],
  photo: ['Ảnh', 'Photo'],
  avatar: ['Ảnh đại diện', 'Avatar'],
  logo: ['Logo', 'Logo'],
  thumbnail: ['Ảnh nhỏ', 'Thumbnail'],
  poster: ['Ảnh bìa', 'Poster'],
  cover: ['Ảnh bìa', 'Cover'],
  icon: ['Biểu tượng', 'Icon'],
  href: ['Đi tới', 'Goes to'],
  to: ['Đi tới', 'Goes to'],
  url: ['Đường dẫn', 'URL'],
  link: ['Liên kết', 'Link'],
  target: ['Mở ở', 'Opens in'],
  variant: ['Kiểu', 'Variant'],
  size: ['Cỡ', 'Size'],
  color: ['Màu', 'Color'],
  tone: ['Tông màu', 'Tone'],
  shape: ['Hình dạng', 'Shape'],
  align: ['Căn lề', 'Alignment'],
  rounded: ['Bo góc', 'Rounded'],
  shadow: ['Đổ bóng', 'Shadow'],
  featured: ['Nổi bật', 'Featured'],
  disabled: ['Vô hiệu', 'Disabled'],
  loading: ['Đang tải', 'Loading'],
  required: ['Bắt buộc', 'Required'],
  readOnly: ['Chỉ đọc', 'Read only'],
  checked: ['Đã chọn', 'Checked'],
  open: ['Đang mở', 'Open'],
  active: ['Đang chọn', 'Active'],
  selected: ['Đã chọn', 'Selected'],
  fullWidth: ['Chiếm hết chiều ngang', 'Full width'],
  count: ['Số lượng', 'Count'],
  limit: ['Số mục hiển thị', 'Items shown'],
  type: ['Loại', 'Type'],
  value: ['Giá trị', 'Value'],
  rating: ['Đánh giá', 'Rating'],
  search: ['Ô tìm kiếm', 'Search'],
  sale: ['Nhãn giảm giá', 'Sale badge'],
};

const OPTIONS: Readonly<Record<string, Words>> = {
  primary: ['Chính', 'Primary'],
  secondary: ['Phụ', 'Secondary'],
  outline: ['Viền', 'Outline'],
  outlined: ['Viền', 'Outlined'],
  ghost: ['Trong suốt', 'Ghost'],
  contained: ['Đặc', 'Contained'],
  solid: ['Đặc', 'Solid'],
  text: ['Chữ', 'Text'],
  link: ['Liên kết', 'Link'],
  flat: ['Phẳng', 'Flat'],
  elevated: ['Nổi', 'Elevated'],
  raised: ['Nổi', 'Raised'],
  bordered: ['Viền', 'Bordered'],
  filled: ['Đặc', 'Filled'],
  soft: ['Nhạt', 'Soft'],
  default: ['Mặc định', 'Default'],
  sm: ['Nhỏ', 'Small'],
  small: ['Nhỏ', 'Small'],
  md: ['Vừa', 'Medium'],
  medium: ['Vừa', 'Medium'],
  lg: ['Lớn', 'Large'],
  large: ['Lớn', 'Large'],
  left: ['Trái', 'Left'],
  center: ['Giữa', 'Center'],
  right: ['Phải', 'Right'],
};

function pick(words: Words | undefined, lang: string): string | undefined {
  if (words === undefined) return undefined;
  return lang.startsWith('vi') ? words[0] : words[1];
}

/** Plain words for a prop name (`showSale` → "Hiện nhãn giảm giá"); undefined when unknown. */
export function propLabel(name: string, lang: string): string | undefined {
  const known = pick(NAMES[name], lang);
  if (known !== undefined) return known;
  const toggle = /^(show|has|with)([A-Z]\w*)$/.exec(name);
  const rest = toggle?.[2];
  if (rest === undefined) return undefined;
  const part = pick(NAMES[rest.charAt(0).toLowerCase() + rest.slice(1)], lang);
  if (part === undefined) return undefined;
  return lang.startsWith('vi') ? `Hiện ${part.toLowerCase()}` : `Show ${part.toLowerCase()}`;
}

/** Plain words for a choice of a variant-like prop; the value itself when unknown. */
export function optionLabel(value: string, lang: string): string {
  return pick(OPTIONS[value], lang) ?? value;
}

function rank(spec: ComponentPropSpec): number {
  if (spec.hasValue) return 0;
  return spec.required ? 1 : 2;
}

/** The knobs by group, set ones first, then required ones, each group in its fixed order. */
export function groupSpecs(specs: readonly ComponentPropSpec[]): {
  readonly groups: readonly (readonly [ShownGroup, readonly ComponentPropSpec[]])[];
  readonly advanced: readonly ComponentPropSpec[];
} {
  const sorted = [...specs].sort((a, b) => rank(a) - rank(b));
  const inGroup = (role: ComponentPropRole) =>
    sorted.filter((s) => (s.role ?? 'advanced') === role);
  return {
    groups: GROUP_ORDER.map((g) => [g, inGroup(g)] as const).filter(([, list]) => list.length > 0),
    advanced: inGroup('advanced'),
  };
}
