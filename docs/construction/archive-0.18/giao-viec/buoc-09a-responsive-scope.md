# Bước 9A — Model: khóa responsive theo khung và giá trị hiệu lực (WP-1.09, phần A)

Làm theo **Quy trình v3** trong [README](README.md). Spec: SPEC-03 mục 2.2, 2.2a; SPEC-04.1 mục 11.1, 11.3 (R-IN-02, R-IN-03), V-28, V-29.

## Mục tiêu

Các hàm thuần mà Inspector (9B) dùng: sửa ở khung nào thì ghi vào khóa responsive nào, và giá trị đang có hiệu lực ở một độ rộng là gì, lấy từ khóa nào.

## Test khóa (đã viết sẵn, KHÔNG được sửa)

- `packages/model/src/styling/responsive-scope.test.ts` (12 test). Hiện đỏ vì chưa có `responsive-scope.ts`. Claude đã kiểm bộ test bằng một bản cài đặt nháp: viết đúng hợp đồng dưới đây thì xanh hết.

## Hợp đồng (viết đúng tên, kiểu, file)

File mới `packages/model/src/styling/responsive-scope.ts`, xuất thêm qua `packages/model/src/index.ts`:

```ts
export type Breakpoint = 'base' | ResponsiveKey; // nếu model đã có kiểu này thì dùng lại
export const BREAKPOINT_MIN: Readonly<Record<ResponsiveKey, number>>;
//   { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }

export function bandOf(width: number, mode: ResponsiveMode): Breakpoint;
export function editBreakpoint(
  width: number,
  primaryWidth: number,
  mode: ResponsiveMode,
): Breakpoint;
export function effectiveStyleValue(
  node: Pick<DesignNode, 'style' | 'responsive'>,
  property: keyof StyleProps,
  width: number,
  mode: ResponsiveMode,
): { readonly value: unknown; readonly from: Breakpoint | undefined };
export function styleScope(
  breakpoint: Breakpoint,
  state?: InteractionState,
): StyleScope | undefined;
```

## Thuật toán (đúng như spec, không tự diễn giải)

- `bandOf`:
  - `desktop-first`: khóa **nhỏ nhất** có mốc **lớn hơn** `width`; không có thì `'base'` (tức `width ≥ 1536`).
  - `mobile-first`: khóa **lớn nhất** có mốc **≤** `width`; không có thì `'base'` (tức `width < 640`).
- `editBreakpoint`: `bandOf(width) === bandOf(primaryWidth)` thì `'base'`, ngược lại `bandOf(width)`.
- `effectiveStyleValue`: bắt đầu từ `node.style[property]` (nguồn `'base'`; nếu không có thì `value: undefined, from: undefined`). Sau đó áp các khóa **đang có hiệu lực** ở `width`, theo thứ tự ưu tiên tăng dần, khóa sau đè khóa trước, `from` là khóa cuối cùng có giá trị:
  - `desktop-first`: khóa có hiệu lực khi `mốc > width`; thứ tự áp `2xl, xl, lg, md, sm` (nhỏ hơn thắng).
  - `mobile-first`: khóa có hiệu lực khi `mốc ≤ width`; thứ tự áp `sm, md, lg, xl, 2xl` (lớn hơn thắng).
- `styleScope`: không có `state`: `'base'` thành `{}`, khóa khác thành `{ breakpoint }`. Có `state`: chỉ hợp lệ ở `'base'`, trả `{ state }`; khóa khác trả `undefined` (V-28).

## Sửa kèm (lỗi có sẵn)

- `packages/model/src/styling/normalize-responsive.ts`: `DESKTOP_CASCADE` đang thiếu `'2xl'`. Đổi thành `['2xl', 'xl', 'lg', 'md', 'sm']`. Test "normalizeResponsiveStyle includes 2xl" bắt lỗi này. Sau khi sửa, chạy lại toàn bộ test model và styling: không test cũ nào được đỏ.
- Dùng lại `BREAKPOINT_MIN` và thứ tự áp này ở `normalize-responsive.ts` nếu gọn hơn, nhưng không bắt buộc.

## Phạm vi

Chỉ: `packages/model/src/styling/responsive-scope.ts` (mới), `normalize-responsive.ts`, `packages/model/src/index.ts`. Không sửa Studio.

## Xong khi

1. `pnpm exec vitest run packages/model` xanh hết, gồm 12 test khóa.
2. `pnpm exec eslint packages/model/src` và `pnpm exec tsc --noEmit -p packages/model` sạch.
3. `pnpm verify` mã thoát 0. (Phần này không có E2E.)

Đây là phần nhỏ (khoảng 60 dòng). Nếu quá 30 phút mà chưa xanh, dừng và báo theo quy tắc 4.
