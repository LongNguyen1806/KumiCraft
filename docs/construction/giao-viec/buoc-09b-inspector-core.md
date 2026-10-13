# Bước 9B — Inspector: thanh phạm vi, ô giá trị, nhóm Bố cục, Khoảng cách, Hiệu ứng (WP-1.09, phần B)

Làm theo **Quy trình v3** trong [README](README.md). Spec: SPEC-04.1 mục 11.1, 11.3 (R-IN-01 đến R-IN-05), 11.2 (chỉ 3 nhóm dưới đây); SPEC-03 mục 2.2a, 4.5, V-28. Dùng các hàm của 9A: `editBreakpoint`, `effectiveStyleValue`, `styleScope`, `BREAKPOINT_MIN`.

## Test khóa (đã viết sẵn, KHÔNG được sửa)

`e2e/inspector.e2e.ts` (9 test). Hiện tất cả đỏ ở cùng một chỗ: chưa có `data-testid="inspector"`. Phần dựng workspace và chọn Card đã chạy đúng.

Chạy nhanh khi làm: `pnpm build` rồi `pnpm exec playwright test e2e/inspector.e2e.ts --project=chromium`. Xem trực tiếp trên trình duyệt: `pnpm dev <thư mục workspace>`.

## Hợp đồng giao diện (test dựa vào đúng các tên này)

| `data-testid`             | Là gì                                      | Yêu cầu                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inspector`               | Khung Inspector trong panel phải           | Hiện khi chọn **đúng một** node. Không chọn gì: giữ gợi ý hiện có. Giữ nguyên `selected-id` đang có                                                                                                                                                                                                                 |
| `inspector-scope`         | Thanh phạm vi (11.1)                       | Chữ: `Đang sửa: <nhãn khung> <rộng> · Gốc`; khi khóa ≠ base: `· Ghi đè < <mốc> px` (desktop-first) hoặc `· Ghi đè ≥ <mốc> px` (mobile-first); khi có trạng thái thêm ` · <tên trạng thái>`. Ví dụ: `Đang sửa: Desktop 1440 · Gốc`, `Đang sửa: Mobile 375 · Ghi đè < 640 px`, `Đang sửa: Desktop 1440 · Gốc · Hover` |
| `inspector-state`         | `<select>` trạng thái                      | Giá trị `normal`, `hover`, `focus`, `disabled`; chữ vi: Bình thường, Hover, Focus, Vô hiệu hóa (en: Normal, Hover, Focus, Disabled). **`disabled` (thuộc tính HTML) khi khóa ≠ base** (V-28); đổi khung sang khóa ≠ base thì tự về `normal`                                                                         |
| `inspector-group-layout`  | Nhóm Bố cục                                | Chỉ hiện với node container (`CONTAINER_TYPES`)                                                                                                                                                                                                                                                                     |
| `inspector-group-spacing` | Nhóm Khoảng cách                           | Luôn hiện, trừ khi đang ở một trạng thái                                                                                                                                                                                                                                                                            |
| `inspector-group-effects` | Nhóm Hiệu ứng                              | Luôn hiện. Trong 9B chỉ có `opacity`                                                                                                                                                                                                                                                                                |
| `field-<id>`              | Một ô giá trị                              | `<id>` xem bảng dưới                                                                                                                                                                                                                                                                                                |
| `field-<id>-label`        | Nhãn của ô                                 | Kéo ngang để scrub (R-IN-04)                                                                                                                                                                                                                                                                                        |
| `field-<id>-mode`         | Nút đổi chế độ token ↔ tùy chỉnh (R-IN-01) | Chỉ ô có token                                                                                                                                                                                                                                                                                                      |
| `field-<id>-input`        | `<input>` số px (chế độ tùy chỉnh)         | Ghi khi **Enter** hoặc **blur**, không ghi theo từng phím. Sai: `aria-invalid="true"`, viền đỏ, `title` nêu khoảng hợp lệ, **không dispatch** (R-IN-05)                                                                                                                                                             |
| `field-<id>-token`        | `<select>` token (chế độ token)            | `value` của option là chuỗi token đầy đủ, ví dụ `token:spacing.4`; chữ hiển thị `4 · 16 px`. Lấy từ **token của workspace** (`document.tokens.spacing`), không lấy bộ mặc định                                                                                                                                      |
| `field-<id>-override`     | Chấm ghi đè (R-IN-02)                      | Chỉ có khi khóa ≠ base **và** `node.responsive[khóa]` có thuộc tính này. Bấm mở hộp nhỏ                                                                                                                                                                                                                             |
| `field-<id>-base`         | Trong hộp nhỏ: giá trị gốc                 | Chứa số px gốc, ví dụ `24`                                                                                                                                                                                                                                                                                          |
| `field-<id>-clear`        | Trong hộp nhỏ: nút "Xóa ghi đè"            | `setStyle` với `scope` của khóa và `unset: [thuộc tính]`                                                                                                                                                                                                                                                            |
| `field-<id>-inherited`    | Dấu "kế thừa" (R-IN-03)                    | Có khi giá trị hiệu lực đến từ khóa **khác** khóa đang sửa (`from !== khóa đang sửa`, `from !== undefined`). Chữ mờ, ví dụ `từ Desktop`                                                                                                                                                                             |
| `field-direction-input`   | `<select>` hướng                           | `row`, `column`. **Root của trang: `disabled`** (V-20: root luôn là Stack hướng cột)                                                                                                                                                                                                                                |

### Các ô trong 9B

| `<id>`                                                           | Thuộc tính style | Loại                                      | Hợp lệ                                              |
| ---------------------------------------------------------------- | ---------------- | ----------------------------------------- | --------------------------------------------------- |
| `padding-top`, `padding-right`, `padding-bottom`, `padding-left` | `padding.top`…   | Spacing (token hoặc px)                   | px 0..10000, tối đa 2 chữ số thập phân (`PxSchema`) |
| `gap`                                                            | `gap`            | Spacing                                   | như trên                                            |
| `direction`                                                      | `direction`      | Liệt kê                                   | `row` \| `column`                                   |
| `opacity`                                                        | `opacity`        | Số, **không có token, không có nút mode** | số nguyên 0..100, bội của 5                         |

Trong một trạng thái (`hover`, `focus`, `disabled`) **chỉ hiện** các thuộc tính `StateStylePropsSchema` cho phép (SPEC-03 mục 4.5); trong 9B tức là chỉ `opacity`. Ô padding phải **không có trong DOM** (test kiểm `toHaveCount(0)`).

## Thuật toán ghi (đúng như sau)

- Khóa đang sửa: `b = editBreakpoint(khung đang xem.width, khung chuẩn.width, workspace.responsiveMode)`. Trạng thái `s` (hoặc không). `scope = styleScope(b, s)`.
- Giá trị hiện trong ô:
  - Không có trạng thái: `effectiveStyleValue(node, prop, khung.width, mode)`.
  - Có trạng thái: `node.states?.[s]?.[prop]`, không có thì giá trị hiệu lực ở base.
- **Ghi một cạnh padding:** `setStyle` ghi **cả object** `padding` ở `scope`, các cạnh còn lại lấy **giá trị hiệu lực hiện tại**. Ví dụ ở Mobile sửa top = 8 thì `set: { padding: { top: {px:8}, right/bottom/left: giá trị hiệu lực ở 375 } }`. Như vậy chỉ một thao tác, một bước Undo.
- Mỗi lần xác nhận là **một** `dispatch` với `{ source: 'user', label: 'Change <thuộc tính>' }`. **Không** truyền `coalesce: false`: scrub cần store gộp các lần sửa liên tiếp trong 500 ms (R-IN-04, đã có sẵn trong `coalesceKeyOf`).
- **Scrub (R-IN-04):** `pointerdown` trên `field-<id>-label` → `setPointerCapture`; mỗi `pointermove`: giá trị = giá trị lúc bắt đầu + `Math.round(dx / 2)` px (tối thiểu 0), dispatch ngay để Canvas cập nhật; `pointerup` thả capture. Chỉ cho ô dạng số px (spacing, opacity: bước 5).

## Nối vào Studio (file và chỗ cần sửa)

- `features/editor/editor-shell.tsx`: `EditorShell` giữ khung đang xem (`frameId`). Truyền xuống `RightPanel`: `frame` (đang xem), `primaryFrame`, `responsiveMode`. Không đổi cách chọn khung.
- `features/editor/side-panels.tsx`: `RightPanel` hiện `InspectorPanel` khi có đúng một node chọn.
- Mới, trong `features/inspector/`:
  - `inspector-panel.tsx` (khung + thanh phạm vi + các nhóm),
  - `style-field.tsx` (một ô: label, mode, input, token, chấm, kế thừa),
  - `field-descriptors.ts` (bảng ô: id, đường dẫn thuộc tính, loại, kiểm hợp lệ),
  - `style-edit.ts` (hàm thuần dựng `setStyle`: cạnh padding, unset) + `style-edit.test.ts` (unit test của bạn cho hàm này),
  - `use-inspector-scope.ts` (tính `b`, `s`, `scope`, chữ thanh phạm vi).
- i18n: thêm khóa `inspector.*` vào **cả** `vi` và `en`.

## Bẫy đã biết

- Ô nhập phải dùng **bản nháp cục bộ** (state) để gõ, và **đặt lại** khi đổi node, khung hoặc trạng thái. Cách gọn: đặt `key={node.id + b + s}` cho ô. Nếu không, chữ cũ của node trước sẽ còn trong ô.
- Đọc store bằng selector hẹp: node đang chọn `s.flatNodes[id]`, token `s.document?.tokens`. **Cấm** `useEditorStore((s) => s.document)` trong component vẽ (R-CV-05).
- `NodeRecord` trong `flatNodes` có `style`, `responsive`, `states` giống `DesignNode`, nên dùng được thẳng với `effectiveStyleValue`.
- Kiểu `StyleScope` của thao tác: base là `{}` (không có `breakpoint`).
- QC-40 (không `null`), hàm ≤ 50 dòng, không chữ cứng trong JSX.

## Ngoài phạm vi 9B (đừng làm)

Các nhóm khác của 11.2, chọn nhiều node (R-IN-06), AC-03 có Grid, PB-14: làm ở 9C.

## Xong khi

1. `e2e/inspector.e2e.ts` xanh 9/9 trên Chromium, rồi trên cả 3 trình duyệt.
2. `pnpm verify` mã thoát 0 (gồm unit test `style-edit.test.ts` của bạn).
3. `pnpm test:e2e` toàn bộ xanh (không làm vỡ E2E cũ).

Gặp test đỏ sau 3 lần sửa: dừng và báo theo quy tắc 4 của README.
