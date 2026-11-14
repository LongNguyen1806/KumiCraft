# Lượt K9.7-2: Sửa phần tử, icon, hiệu ứng, chuyển động (đợt D7, D2, D3)

Kế hoạch: `p4-ke-hoach.md` mục **K9.7**, lượt **K9.7-2**. Người làm: Gemini. Người kiểm: Claude. Làm **một lần** cả mục 3 (TK-1..9) và mục 4 (TK-10..22) (chủ dự án 2026-11-14: không chia chặng nữa).

Nguyên tắc chung (như K9.7-1): code dự án là gốc; code sinh từ mẫu, không dùng AI; mọi thao tác có Hoàn tác; **mọi hệ style chạy như nhau** (Tailwind 4, Tailwind 3, Bootstrap 5, CSS thường, CSS Modules, Sass, Less) qua lớp Style hiện có (bộ nhớ `style-parity`); có công cụ MCP tương ứng; mỗi phần có test unit, E2E và kiểm ngược.

## 1. Hiện trạng (đã đọc code)

- Sửa mã nguồn: `packages/shared/src/source.ts` (`SourceEditSchema`: `setClassName`, `setText`, `setAttribute`, `setFlag`; `StructureEdit`: `insert`, `remove`, `duplicate`, `move`, `wrap`, `unwrap`, `insertImage`). `EDITABLE_ATTRS = ['href','src','alt','placeholder','type']`.
- Thuộc tính Tailwind: `packages/shared/src/tailwind/properties.ts` (bảng tiền tố → `PropertyId`, đọc/ghi giá trị), `property-tables.ts`; CSS tương ứng: `packages/shared/src/style.ts` (`PropertyId` → tên CSS, ví dụ `boxShadow: 'box-shadow'`).
- Inspector: nhóm và ô ở `packages/studio/src/features/inspector/property-groups-config.ts` (đã có nhóm `effects` với `boxShadow`, `opacity`). **Phạm vi trạng thái Hover / Focus / Disabled đã có** (ô Phạm vi trong `inspector-header.tsx`, `currentScope.state`).
- MCP cho AI bên ngoài: `packages/cli/src/mcp/mcp-edit-tools.ts`, `mcp-structure-tools.ts`.
- Icon: `lucide-react@1.48.0` có sẵn trong `packages/studio` (mỗi icon có `__iconData = { name, size, node: [[tag, attrs], …] }`), khoảng 2.000 icon, giấy phép ISC.
- Chèn ảnh: `packages/studio/src/features/draw/insert-image.ts`, sửa `insertImage`.

## 2. Không được làm

- Không `git commit/push/checkout/restore/reset/stash/clean`, không `rm -rf`, không cài hay gỡ gói npm.
- Không `any`, `as unknown as`, `!` non-null, `null` (kể cả `=== null`), `eslint-disable`, `@ts-ignore`, `@ts-expect-error`; không `.then()`; file ≤ 400 dòng, hàm ≤ 50 dòng; React ref dạng callback `el ?? undefined`; không ép kiểu `as Record<…>` (kiểm kiểu bằng `instanceof`/`in`).
- Không nới lỏng test cũ; test cũ đổi kỳ vọng phải có lý do trong báo cáo.
- Không làm hỏng hành vi K9.7-1 (vai trò màu, biến thể, phong cách, shadcn).

## 3. Sửa phần tử và icon (TK-1..9)

### 3.1. Đổi loại thẻ (TK-1)

- Sửa mới `setTag` trong `SourceEditSchema`: `{ kind: 'setTag', loc, tag, after }`. Máy chủ đổi tên cả thẻ mở lẫn thẻ đóng, giữ nguyên mọi thuộc tính, con, chú thích, khoảng trắng. `after` chỉ nhận thẻ HTML thường (danh sách cố định: `div section article aside header footer main nav ul ol li p span h1 h2 h3 h4 h5 h6 a button label figure figcaption blockquote`). Từ chối: component (chữ hoa đầu), thẻ tự đóng ↔ thẻ có con không hợp lệ (`img`, `input`, `br`, `hr`), `a` khi không có `href` thì vẫn được nhưng Inspector gợi ý thêm `href`.
- Inspector: ô "Loại thẻ" (`inspector-tag-select`) ngay dưới tên phần tử. MCP: `kumicraft_set_tag`.

### 3.2. Danh sách (TK-2)

- Khối Thư viện mới `content.list` (ul có 3 li) và `content.list-ordered` (ol), theo đúng cách khối của K9.7-1 (vai trò màu, neutral, Bootstrap).
- Khi chọn `li` hoặc `ul/ol`: Inspector có nút "Thêm mục" (`list-add-item`, nhân bản `li` cuối hoặc `li` đang chọn, dùng `duplicate` có sẵn) và "Bỏ mục" (`list-remove-item`, dùng `remove`; không bỏ khi chỉ còn 1 mục).

### 3.3. Chữ trong dòng (TK-3)

- Khi đang sửa chữ trên Canvas (text-edit có sẵn ở Bridge), bôi đen một đoạn → thanh nhỏ nổi lên (`inline-text-bar`) với: **Đậm**, **Nghiêng**, **Màu** (bảng màu dự án), **Nhãn** (badge). Bấm → máy chủ bọc đoạn đó bằng `<span className="…">` (Tailwind: `font-semibold`, `italic`, `text-{primary}`, nhãn: `rounded px-1.5 py-0.5 text-xs bg-{surface-muted}`; hệ khác: class `kc-inline-…` + luật CSS, như khối Thư viện).
- Sửa mới `wrapText` trong `StructureEdit`: `{ kind: 'wrapText', loc, tag, start, end, wrapper: { tag: 'span' | 'strong' | 'em', className?: string }, css?: { rules } }`; `start/end` là vị trí trong chữ thuần của phần tử (chỉ khi phần tử có **một** nút chữ tĩnh; có biểu thức `{…}` thì từ chối E023). Có Hoàn tác.

### 3.4. Thuộc tính (TK-4)

- Mở rộng `setAttribute.name`: ngoài `EDITABLE_ATTRS` nhận thêm `id`, `title`, `target`, `rel`, `role`, `tabIndex`, `aria-*`, `data-*` (regex `^(aria|data)-[a-z][a-z0-9-]{0,40}$`). **Chặn**: `on*`, `style`, `className`, `class`, `key`, `ref`, `dangerouslySetInnerHTML`, `data-rc-*` (của KumiCraft). Giá trị chỉ là chuỗi tĩnh; thuộc tính đang là biểu thức `{…}` thì chỉ đọc (khóa ô, có chú thích).
- Inspector: nhóm "Thuộc tính" (`inspector-attributes`) liệt kê thuộc tính đang có + nút "Thêm" (ô tên + ô giá trị), sửa, xóa. Gợi ý nhanh: `id`, `aria-label`, `title`, `target="_blank"` (tự thêm `rel="noopener noreferrer"`).
- MCP: mở rộng `kumicraft_set_attribute` theo quy tắc trên.

### 3.5. MCP chèn khối theo mã (TK-5)

- Công cụ `kumicraft_insert_block`: `{ blockId, variantId?, target }` → dựng bằng `renderBlock` với vai trò màu + hệ style của dự án (giống Studio), rồi chèn. Không phải chép JSX.

### 3.6. Bộ icon không cần mạng (TK-6)

- Script build `packages/studio/scripts/build-icons.mjs` đọc `__iconData` từ `lucide-react` có sẵn, sinh `packages/studio/src/features/icons/icons.generated.json` (tên + node + từ khóa từ tên). File này **nạp lười** (dynamic import) chỉ khi mở bảng icon, không vào bundle chính. Ghi giấy phép ISC của Lucide vào `THIRD-PARTY-NOTICES` (hoặc file giấy phép hiện có của gói `kumicraft`).
- Thư viện có khối "Icon" mở bảng icon (`icon-picker`): ô tìm (`icon-search`, tìm theo tên tiếng Anh và vài từ khóa tiếng Việt cho 50 icon thông dụng), lưới icon (`icon-item-<name>`), chọn → chèn `<svg>` inline: `width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"` + `data-icon="<name>"` (thuộc tính để nhận lại icon). **Không** thêm `lucide-react` vào dự án người dùng.
- Khi chọn một `svg` có `data-icon`: Inspector có nhóm "Icon" (`inspector-icon`): đổi icon (mở bảng, thay nội dung svg giữ class), cỡ (`w-*/h-*` hoặc CSS), màu (`text-*` vì `stroke="currentColor"`), độ dày nét (`stroke-width` 1–3). Thay icon dùng sửa mới `replaceSvg` `{ kind:'replaceSvg', loc, tag:'svg', icon: { name, node } }` (máy chủ dựng lại con của svg từ `node`, kiểm tên thẻ chỉ trong `path circle rect line polyline polygon ellipse g`).

### 3.7. Ảnh (TK-7, TK-9)

- Khối "Ảnh giữ chỗ" với tỉ lệ 16:9, 1:1, 4:3 (`aspect-video`, `aspect-square`, `aspect-[4/3]`; CSS `aspect-ratio`), nền `{surface-muted}`, icon ảnh ở giữa.
- Khi chọn `img`: nhóm Inspector "Ảnh" (`inspector-image`): cách lấp (`object-cover|contain|fill|none`), điểm neo (`object-center|top|bottom|left|right`), tỉ lệ khung, bo góc. Chạy cho mọi hệ (CSS: `object-fit`, `object-position`, `aspect-ratio`).
- TK-8 (tải ảnh vào `public`) **không làm**: nút "Image…" hiện có đã làm việc này; chỉ kiểm tra và ghi trong báo cáo nó còn chạy.

### 3.8. Test phần sửa phần tử

1. Máy chủ `setTag`: `div`→`section` giữ thuộc tính, con, chú thích, CRLF; thẻ tự đóng; từ chối component, `img`↔`div` có con, thẻ ngoài danh sách; Hoàn tác trả byte-for-byte.
2. Inspector đổi thẻ gửi đúng `setTag`; MCP `kumicraft_set_tag`.
3. Danh sách: Thêm mục nhân bản đúng `li`; Bỏ mục không bỏ được mục cuối cùng.
4. Máy chủ `wrapText`: bọc giữa chữ, đầu, cuối; giữ thực thể `&amp;`; từ chối khi có `{…}`; Tailwind ra class, CSS thường ra `kc-inline-…` + luật CSS; Hoàn tác.
5. Bridge: bôi đen trong text-edit gửi đúng `start/end` (kể cả chữ có dấu tiếng Việt).
6. `setAttribute`: nhận `id`, `aria-label`, `data-test`; từ chối `onClick`, `style`, `data-rc-free`, `dangerouslySetInnerHTML`; `target="_blank"` kèm `rel`.
7. MCP `kumicraft_insert_block`: dự án Tailwind có token `brand` → JSX có `bg-brand`; dự án CSS → luật CSS có `var(--brand)`.
8. Icon: `build-icons.mjs` sinh JSON hợp lệ (≥ 1000 icon); chèn icon ra `<svg … data-icon="heart">` đúng thuộc tính; `replaceSvg` từ chối thẻ lạ (`script`, `foreignObject`); đổi màu ghi `text-*`.
9. Ảnh: `object-cover` cho Tailwind và `object-fit: cover` cho CSS thường.
10. E2E `e2e/element-basics.e2e.ts` (fixture `vite8-react19-ts`): đổi `div`→`section` trên Canvas; thêm `aria-label`; chèn icon `heart` rồi đổi màu; bôi đen một chữ trong tiêu đề → Màu → file có `<span className="text-brand">`.
11. E2E CSS thường (`react-css`): chèn icon và ảnh giữ chỗ, file JSX không có class Tailwind.

Kiểm ngược phần sửa phần tử: bỏ kiểm danh sách thẻ trong `setTag` → test 1 phần "từ chối" hỏng; bỏ chặn `on*` → test 6 hỏng.

## 4. Hiệu ứng và chuyển động (TK-10..22)

### 4.1. Thuộc tính mới (shared)

Thêm `PropertyId` + đọc/ghi Tailwind (v4 và v3) + tên CSS trong `style.ts`:

| Nhóm                           | PropertyId                                                                        | Tailwind                                                                   | CSS                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Gradient (TK-10)               | `backgroundImage` (`linear` + hướng), `gradientFrom`, `gradientVia`, `gradientTo` | `bg-linear-to-r` (v4) / `bg-gradient-to-r` (v3), `from-*`, `via-*`, `to-*` | `background-image: linear-gradient(to right, a, b, c)` (gộp một khai báo) |
| Chữ gradient                   | dùng chung + `bg-clip-text text-transparent`                                      | —                                                                          | `background-clip: text; color: transparent`                               |
| Bóng có màu, phát sáng (TK-11) | `shadowColor` (+ `boxShadow` có sẵn)                                              | `shadow-{color}/50`; phát sáng = `shadow-[0_0_24px_…]`                     | `box-shadow` có màu                                                       |
| Kính mờ (TK-12)                | `backdropBlur`                                                                    | `backdrop-blur-sm…xl`                                                      | `backdrop-filter: blur(…)`                                                |
| Biến hình (TK-13)              | `rotate`, `scale`, `translateX`, `translateY`, `skewX`                            | `rotate-*`, `scale-*`, `translate-x-*`…                                    | `transform` (gộp)                                                         |
| Bộ lọc (TK-14)                 | `blur` (có), `brightness`, `contrast`, `grayscale`, `mixBlendMode`                | `brightness-*`, `contrast-*`, `grayscale`, `mix-blend-*`                   | `filter` (gộp), `mix-blend-mode`                                          |
| Transition (TK-15)             | `transitionProperty`, `duration`, `ease`, `delay`                                 | `transition`, `transition-colors`…, `duration-*`, `ease-*`, `delay-*`      | `transition` (gộp)                                                        |
| Animation (TK-17)              | `animation`                                                                       | `animate-spin                                                              | ping                                                                      | pulse | bounce` + tên keyframes của dự án | `animation` + `@keyframes` (thêm vào file CSS khi cần) |

Các thuộc tính "gộp" trong CSS (transform, filter, transition, background-image) phải đọc và ghi lại **đúng một khai báo**, giữ phần không đổi (ví dụ đổi `rotate` không mất `scale`).

### 4.2. Inspector

- Nhóm **Hiệu ứng** mở rộng: Gradient (bật/tắt, hướng 8 nút, 2–3 ô màu từ token dự án), Chữ gradient, Bóng (cỡ + màu), Phát sáng, Kính mờ, Biến hình (4 ô số), Bộ lọc.
- Nhóm mới **Chuyển động** (`inspector-motion`): Transition (thuộc tính, thời gian, kiểu, độ trễ), Animation có sẵn, **Mẫu nhanh** (TK-19): "Nổi lên khi rê" (`hover:-translate-y-1 hover:shadow-lg transition`), "Phóng nhẹ" (`hover:scale-105 transition`), "Sáng viền" (`hover:ring-2 ring-{primary} transition`), "Mờ dần khi xuất hiện", "Trượt lên khi xuất hiện".
- Hover/Focus (TK-16): phạm vi trạng thái **đã có**; chỉ cần mọi ô mới ở trên ghi đúng tiền tố trạng thái (`hover:`, `focus:`) và CSS `:hover`, `:focus` như ô cũ.
- Nút **Xem thử** (TK-22, `motion-preview`) chạy lại hiệu ứng trên Canvas một lần (Bridge thêm/bỏ lớp tạm, không ghi file).

### 4.3. Hiện dần khi cuộn (TK-18, TK-20, TK-21)

- Bật "Hiện khi cuộn tới" cho phần tử → KumiCraft sinh **một lần** file `src/kumicraft/Reveal.tsx` (hoặc `.jsx` theo ngôn ngữ dự án) dùng `IntersectionObserver`, không gói ngoài; bọc phần tử bằng `<Reveal effect="fade|slide-up|zoom" delay={…}>`; có import.
- "Xuất hiện lần lượt" (TK-20) cho danh sách/lưới: `<Reveal stagger={80}>` đặt trễ tăng dần cho các con.
- `Reveal` tôn trọng `prefers-reduced-motion` (TK-21): hiện ngay, không chuyển động.
- Tắt → gỡ lớp bọc (dùng `unwrap` có sẵn); file `Reveal` giữ lại nếu còn chỗ khác dùng.

### 4.4. Test phần hiệu ứng

12. Đọc/ghi Tailwind v4 và v3 cho từng thuộc tính bảng 4.1 (`bg-linear-to-r` vs `bg-gradient-to-r`).
13. CSS gộp: đổi `rotate` giữ `scale` trong cùng `transform`; đổi `duration` giữ `transition-property`; `filter` nhiều hàm.
14. Inspector nhóm Hiệu ứng: gradient 3 màu từ token `brand` → `bg-linear-to-r from-brand via-… to-…`; trạng thái Hover ghi `hover:` đúng.
15. Mẫu nhanh "Nổi lên khi rê" ghi đủ class một lần Hoàn tác.
16. Animation tên keyframes riêng ở dự án CSS → thêm `@keyframes` đúng một lần.
17. `Reveal`: sinh file một lần, bọc + import đúng; tắt gỡ đúng; bản sinh ra qua typecheck của fixture TS; reduced-motion hiện ngay (test DOM).
18. Bridge Xem thử: thêm lớp tạm rồi gỡ, không gửi sửa file.
19. E2E `e2e/effects-motion.e2e.ts`: gradient trên nút; "Nổi lên khi rê" rồi rê chuột trên Canvas → `transform` thay đổi (đọc `getComputedStyle`); bật Hiện khi cuộn → file `Reveal` xuất hiện.
20. E2E CSS thường: gradient + transition ghi vào file CSS, JSX không có class Tailwind.

Kiểm ngược phần hiệu ứng: đổi ghi CSS gộp thành ghi đè cả khai báo → test 13 hỏng.

## 5. Kiểm tra cuối

`pnpm format`, `pnpm typecheck`, `npx eslint . --ignore-pattern "Mockup/**"`, `pnpm check:i18n`, `pnpm test`, `pnpm build`, `pnpm test:e2e` (toàn bộ). Ghi một dòng `docs/construction/spec-log.md` (số tiếp theo) .

Báo cáo bằng mục `## BÁO CÁO K9.7-2` (tiếng Việt, ngắn): file đổi/mới, số test mới theo nhóm, kết quả từng lệnh (số test qua), kết quả kiểm ngược, chỗ làm khác bản giao việc và lý do.
