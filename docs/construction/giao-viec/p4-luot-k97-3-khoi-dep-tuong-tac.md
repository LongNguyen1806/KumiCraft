# Lượt K9.7-3: Khối đẹp, ô Thư viện, tương tác không cần code (đợt D4, D5)

Kế hoạch: `p4-ke-hoach.md` mục **K9.7**, lượt **K9.7-3**. Người làm: Gemini (làm **một lần** cả lượt). Người kiểm: Claude (QA xong tự tách hàm dài nếu còn).

**Điều kiện bắt đầu:** phần sửa "tách 14 hàm dài" của K9.7-2 đã xong và đã lưu code.

Nguyên tắc chung (như K9.7-1, K9.7-2): code dự án là gốc; code sinh từ mẫu, không dùng AI; có Hoàn tác; **mọi hệ style chạy như nhau** (Tailwind 4, Tailwind 3, Bootstrap 5, CSS thường, CSS Modules, Sass, Less); khối mới **phải** dùng vai trò màu `{primary}`…, phong cách `{shadow}`/`{effect}`, tự co giãn không tiền tố, biến thể khi hợp lý, và component shadcn của dự án khi có (`uiKit`), đúng như `p4-luot-k97-1-khoi-hop-du-an.md`. Có MCP tương ứng (`kumicraft_insert_block` đã có, khối mới tự dùng được). Mỗi phần có test unit, E2E, kiểm ngược. **Khối phải đẹp**: khoảng cách đều theo nhịp, chữ có thứ bậc rõ, bóng và bo góc theo phong cách; KumiCraft là công cụ thiết kế.

## 1. Hiện trạng (đã đọc code)

- Khối: `packages/shared/src/library/` (`blocks-basic.ts`, `blocks-advanced.ts`, `blocks-neutral*.ts`, `blocks-variants*.ts`, `types.ts` với `LibraryBlockCategory = 'layout' | 'content' | 'form' | 'data' | 'composite'`), dựng bằng `render-block.ts`, shadcn ở `ui-kit-blocks.ts`, tìm kiếm ở `search.ts`.
- Ô Thư viện: `packages/studio/src/features/library/library-panel.tsx`, `library-search-header.tsx`, `library-variant-menu.tsx`, `library-variants.ts`, `library-styles.ts`.
- **Sinh file component một lần** đã có cho `Reveal`: `packages/server/src/core/source-editor/structure/reveal-service.ts` (+ `reveal-template.ts`), route `POST /source/reveal` trong `packages/server/src/adapters/http/routes/source.ts`; file đặt ở `src/kumicraft/` (`.tsx` nếu dự án TS).
- Import khi chèn: trường `from: { file, imports }` của sửa `insert` (`packages/shared/src/source.ts`), máy chủ chặn import trùng.

## 2. Không được làm

- Không `git commit/push/checkout/restore/reset/stash/clean`, không `rm -rf`, không cài hay gỡ gói npm (dự án người dùng cũng **không** được thêm gói: mọi component sinh ra chỉ dùng React).
- Không `any`, `as unknown as`, `!`, `null` (kể cả `=== null`), `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, ép kiểu `as Record<…>`; không `.then()`; **file ≤ 400 dòng, hàm ≤ 50 dòng** (chạy lint, không để cảnh báo `max-lines-per-function` mới); React ref dạng callback `el ?? undefined`.
- Không nới lỏng test cũ; không làm hỏng hành vi K9.7-1, K9.7-2.
- Component sinh ra không dùng `dangerouslySetInnerHTML`, không `eval`, không gọi mạng.

## 3. Khối đẹp (TK-37..42)

### 3.1. Nhóm mới

Mở rộng `LibraryBlockCategory` thêm `display`, `navigation`, `landing`, `screen`, `interactive`; i18n tên nhóm vi/en. Thứ tự hiện: layout, content, form, display, navigation, interactive, data, composite, landing, screen.

### 3.2. Danh sách khối

| Nhóm       | Khối (id)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| form       | `form.textarea`, `form.select`, `form.checkbox`, `form.radio-group`, `form.switch`, `form.search`, `form.date`, `form.file` (mỗi ô có nhãn, chữ gợi ý, trạng thái focus đẹp; nhãn gắn `htmlFor`/`id`)                                                                                                                                                                                                                             |
| content    | `content.quote`, `content.divider`, `content.spacer`, `content.video` (khung tỉ lệ 16:9 với `<iframe>` để trống `src`, `title` bắt buộc)                                                                                                                                                                                                                                                                                          |
| display    | `display.badge`, `display.avatar` (ảnh tròn + chữ cái dự phòng), `display.stat` (số lớn + nhãn + tăng/giảm có màu), `display.alert` (4 biến thể: thông tin, thành công, cảnh báo, lỗi), `display.progress`                                                                                                                                                                                                                        |
| navigation | `navigation.breadcrumb` (`nav aria-label`), `navigation.pagination`, `navigation.sidebar` (nhóm link + mục đang chọn)                                                                                                                                                                                                                                                                                                             |
| landing    | `landing.pricing` (3 gói, gói giữa nổi bật), `landing.testimonials`, `landing.faq` (dùng mở/đóng ở mục 5), `landing.stats`, `landing.logos`, `landing.team`, `landing.features` (lưới có icon svg inline như K9.7-2), `landing.cta`, `landing.comparison` (bảng so sánh), `landing.timeline`, `landing.blog-card`, `landing.footer-columns`, `landing.hero-image` (chia đôi có ảnh giữ chỗ), `landing.hero-form` (hero + ô email) |
| screen     | `screen.login`, `screen.dashboard` (sidebar + 4 thẻ số liệu + bảng), `screen.settings`, `screen.list-detail`, `screen.not-found`, `screen.landing-a`, `screen.landing-b` (ghép từ khối landing)                                                                                                                                                                                                                                   |

Mỗi khối có `vi`/`en`, bản `neutral` (CSS + Bootstrap), từ khóa tìm kiếm vi/en (cả không dấu). Khối `screen.*` chèn được vào phần tử đang chọn hoặc gốc bản nháp; dùng `<main>`/`<section>` đúng ngữ nghĩa.

## 4. Ô Thư viện (TK-52..54)

- **Gần đây / Yêu thích (TK-52):** hàng đầu bảng (`library-recent`, `library-favorites`); ngôi sao trên ô khối (`library-fav-<id>`); lưu `localStorage` theo dự án (`kumicraft.libraryRecent.<projectId>` tối đa 8, `kumicraft.libraryFav.<projectId>`), bọc `try/catch`.
- **Hình xem trước tĩnh (TK-53):** rê chuột lên ô khối (hoặc focus bàn phím) hiện hình xem trước (`library-preview-<id>`) là **SVG phác thảo vẽ tay** của bố cục khối (khung, thanh chữ, nút), đặt trong `packages/studio/src/features/library/previews/` (mỗi nhóm một file ≤ 400 dòng). **Không** chạy khối thật, không iframe. Hình theo màu theme sáng/tối của Studio.
- **Tìm kiếm (TK-54):** `search.ts` khớp cả từ khóa không dấu và từ đồng nghĩa (ví dụ "đăng nhập", "dang nhap", "login" ra `screen.login`, `form.form`; "giá", "pricing" ra `landing.pricing`).

## 5. Tương tác không cần code (TK-23..30)

### 5.1. Bộ component sinh một lần ("kit")

Tổng quát hóa cơ chế `Reveal` thành **kit**: `packages/server/src/core/source-editor/structure/kit-service.ts` + `kit-templates/` (mỗi component một file mẫu TS và JS). Thêm vào sửa `insert` trường tùy chọn `kit?: { readonly components: readonly KitComponentId[] }`: máy chủ tạo `src/kumicraft/<Name>.tsx|jsx` nếu chưa có (giữ file đã có, không ghi đè), thêm import vào file đích (dùng lại chặn import trùng), tất cả **một lần Hoàn tác**. `Reveal` chuyển sang dùng kit (giữ route cũ chạy như trước).

| Khối (`interactive.*`) | Component kit                           | Ghi chú                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs` (TK-23)         | `Tabs`, `Tab`                           | `role="tablist"`, `aria-selected`, phím ← → Home End                                                                                                                                                    |
| `accordion` (TK-24)    | **không cần kit**: `<details><summary>` | mở/đóng thuần HTML, có mũi tên xoay                                                                                                                                                                     |
| `toggle` (TK-25)       | `Toggle`                                | công tắc `role="switch"` `aria-checked`, ví dụ sáng/tối                                                                                                                                                 |
| `choice` (TK-26)       | `Choice`                                | chọn một trong nhiều (ví dụ chọn màu đổi ảnh), `role="radiogroup"`                                                                                                                                      |
| `carousel` (TK-27)     | `Carousel`                              | nút trước/sau, chấm, phím ← →, không tự chạy khi `prefers-reduced-motion`                                                                                                                               |
| `modal` (TK-28)        | `Modal`                                 | dùng `<dialog>` gốc (`showModal`), Esc đóng, trả focus về nút mở                                                                                                                                        |
| `drawer` (TK-28)       | `Drawer`                                | `<dialog>` trượt từ cạnh                                                                                                                                                                                |
| `dropdown` (TK-29)     | `Dropdown`                              | `aria-expanded`, đóng khi bấm ngoài / Esc                                                                                                                                                               |
| `tooltip` (TK-29)      | `Tooltip`                               | hiện khi rê và khi focus, `role="tooltip"`                                                                                                                                                              |
| `mobile-menu` (TK-30)  | `MobileMenu`                            | nút ☰ có `aria-label`, menu ẩn/hiện, tự ẩn ở màn rộng bằng CSS (không cần tiền tố responsive: dùng `@media` trong chính file kit hoặc class `hidden`/`flex` theo container query nếu dự án Tailwind 4) |

- Nội dung (chữ, mục, ảnh) nằm **trong JSX của trang** dưới dạng con của component (ví dụ `<Tabs><Tab label="…">…</Tab></Tabs>`), nên sửa chữ trên Canvas như phần tử thường. "Thêm mục / Bỏ mục" dùng lại nút của K9.7-2 (nhân bản `Tab`, `<details>`, slide).
- Kiểu dáng của component kit đi qua `className` truyền vào và vai trò màu khi chèn, theo hệ style của dự án (Tailwind ra class, hệ khác ra class `kc-…` + luật CSS như khối thường). Bản thân file kit chỉ chứa logic và vài style tối thiểu bắt buộc.
- **shadcn (`uiKit`):** dự án có `tabs`, `accordion`, `dialog`, `sheet`, `dropdown-menu`, `tooltip` thì dùng component đó (import đúng alias), không sinh kit.
- Trên Canvas trong chế độ Thiết kế, component tương tác phải **chọn được và sửa được chữ** bên trong (ví dụ `Modal` có nút "Xem nội dung" trong Inspector để mở khi đang thiết kế; Bridge không chặn bấm).

## 6. Test bắt buộc

1. Mọi khối mới × biến thể × 7 hệ: dựng không còn `{role}`/`@key`, JSX hợp lệ (mở rộng `library-render-all.test.ts`), không có tiền tố `sm: md: lg: xl: max-` (trừ `max-w-`).
2. Mỗi ô form mới có nhãn gắn đúng `id`; `content.video` có `title`; `navigation.breadcrumb` có `aria-label`.
3. `search.ts`: "dang nhap", "đăng nhập", "login" → `screen.login` đứng đầu; "gia" → `landing.pricing`.
4. Gần đây / Yêu thích: thứ tự, giới hạn 8, theo dự án, `localStorage` lỗi không làm hỏng bảng.
5. Hình xem trước: mỗi khối có một hình (`previews` phủ đủ id), hiện khi rê và khi focus, không có `<iframe>`.
6. Kit máy chủ: chèn `interactive.tabs` lần đầu tạo `src/kumicraft/Tabs.tsx` + import; lần hai không tạo lại, không import trùng; file kit đã có không bị ghi đè; Hoàn tác gỡ cả file mới và import trong một bước.
7. Mỗi file kit (TS và JS) qua TypeScript nghiêm ngặt (như test Reveal) và không chứa `dangerouslySetInnerHTML`, `eval`, `fetch`.
8. Hành vi kit (test DOM với happy-dom, dựng bản JS bằng bộ biên dịch có sẵn trong repo hoặc kiểm bằng React Testing Library ở studio nếu đặt bản mẫu dùng chung): Tabs phím ← →; Modal Esc đóng và trả focus; Dropdown đóng khi bấm ngoài; Carousel không tự chạy khi reduced-motion.
9. shadcn: dự án `react-shadcn` có `tabs.tsx` → `interactive.tabs` dùng `<Tabs>` của dự án, không sinh kit (thêm `tabs.tsx` tối thiểu vào fixture).
10. `Reveal` vẫn chạy như K9.7-2 sau khi chuyển sang kit (test cũ qua).
11. E2E `e2e/library-landing.e2e.ts` (fixture `vite8-react19-ts`): tìm "dang nhap" → chèn `screen.login` vào bản nháp; chèn `landing.pricing`; ngôi sao Yêu thích giữ sau khi tải lại.
12. E2E `e2e/interactive-blocks.e2e.ts`: chèn Tabs → file kit + import xuất hiện; ở Preview bấm tab 2 thì nội dung tab 2 hiện; chèn Modal → nút mở hộp thoại, Esc đóng; chèn `landing.faq` → `<details>` mở/đóng.
13. E2E CSS thường (`react-css`): chèn Tabs và `landing.pricing` → JSX không có class Tailwind, luật CSS ghi vào file CSS.

Kiểm ngược (ghi vào báo cáo): bỏ chặn tạo lại file kit → test 6 hỏng; bỏ từ khóa không dấu → test 3 hỏng.

## 7. Kiểm tra cuối

`pnpm format`, `pnpm typecheck`, `npx eslint . --ignore-pattern "Mockup/**"` (không cảnh báo `max-lines`/`max-lines-per-function` mới), `pnpm check:i18n`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Ghi một dòng `docs/construction/spec-log.md` (số tiếp theo).

Báo cáo bằng mục `## BÁO CÁO K9.7-3` (tiếng Việt, ngắn): file đổi/mới, số khối mới theo nhóm, số test mới theo nhóm 1–13, kết quả từng lệnh (số test qua, số cảnh báo lint), kết quả kiểm ngược, chỗ làm khác bản giao việc và lý do.
