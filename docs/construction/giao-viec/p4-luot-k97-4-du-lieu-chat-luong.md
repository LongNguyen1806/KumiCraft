# Lượt K9.7-4: Dữ liệu, thuộc tính component, Canvas và kiểm tra chất lượng (đợt D6, D8, D9)

Kế hoạch: `p4-ke-hoach.md` mục **K9.7**, lượt **K9.7-4** (lượt Gemini cuối của K9.7). Người làm: Gemini (làm **một lần** cả lượt). Người kiểm: Claude (QA xong tự tách hàm dài nếu còn).

Nguyên tắc chung (như K9.7-1..3): code dự án là gốc; code sinh từ mẫu, không dùng AI; có Hoàn tác; **mọi hệ style chạy như nhau** (Tailwind 4, Tailwind 3, Bootstrap 5, CSS thường, CSS Modules, Sass, Less); khối và form sinh ra dùng vai trò màu, phong cách, biến thể, shadcn `uiKit` như K9.7-1; cần JavaScript thì dùng **kit** của K9.7-3 (`kit-service.ts`, sinh một lần vào `src/kumicraft/`, chỉ React); có MCP tương ứng; mỗi phần có test unit, E2E và kiểm ngược. Kết quả phải **đẹp** (KumiCraft là công cụ thiết kế).

## 1. Hiện trạng (đã đọc code)

- **Đọc kiểu bằng TypeScript của dự án:** `packages/server/src/runners/prop-types.ts` (tiến trình con, chỉ chạy với dự án tin cậy, nạp `typescript` **của dự án**), dùng qua `PropTypesPort` ở `packages/server/src/core/project/component-props.ts`. Dùng lại cách này, không thêm gói.
- **Kit:** `packages/server/src/core/source-editor/structure/kit-service.ts`, `kit-templates/`, trường `insert.kit`, `restoreWrites` (chèn là tất cả hoặc không).
- **Sửa mã:** `packages/shared/src/source.ts`, `source-edits-extra.ts` (`setTag`, `wrapText`, `replaceSvg`, `setAttribute` mở rộng với `isValidSettableAttrName`).
- **Khối form:** `form.*` của K9.7-1 và K9.7-3 (`form.input`, `form.textarea`, `form.select`, `form.checkbox`, `form.switch`, `form.date`…), shadcn ở `ui-kit-blocks.ts`.
- **Khung tự do:** `packages/bridge/src/client/free-frame/` (`free-overlay.ts` vẽ khung, `smart-guides.ts`), Inspector `packages/studio/src/features/free-frame/` (`free-frame-toggle.tsx`, `free-frame-page-warning.tsx`), nhóm Layout trong `inspector/property-groups-config.ts`.
- **Nhiều khung (frame):** `packages/studio/src/features/editor/canvas-view-store.ts` (`frames`, `openFrames`), mỗi khung một iframe có Bridge.

## 2. Không được làm

- Không `git commit/push/checkout/restore/reset/stash/clean`, không `rm -rf`, không cài hay gỡ gói npm (cả dự án người dùng).
- Không `any`, `as unknown as`, `!`, `null` (kể cả `=== null`), `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, ép kiểu `as Record<…>`; không `.then()`; **file ≤ 400 dòng, hàm ≤ 50 dòng** (không để cảnh báo `max-lines*` mới); React ref dạng callback `el ?? undefined`.
- Không chạy mã của dự án người dùng (chỉ đọc bằng bộ đọc AST hoặc TypeScript checker như `prop-types.ts`); không gọi mạng.
- Không nới lỏng test cũ; không làm hỏng hành vi K9.7-1..3.

## 3. Dữ liệu (TK-31..35)

### 3.1. Lặp theo danh sách (TK-31)

- Chọn một phần tử (ví dụ một thẻ) → Inspector nút **"Lặp theo danh sách"** (`repeat-from-element`). Máy chủ (sửa mới `repeatElement { loc, tag, name, count }`):
  1. Tạo `src/kumicraft/data/<name>.data.ts|js` với mảng `count` mục (mặc định 3), mỗi mục có `id` và các trường lấy từ chữ tĩnh, `src`, `href`, `alt` của phần tử (tên trường đặt theo vai trò: `title`, `description`, `image`, `link`, `label`…; chữ của mục 2, 3 là bản sao có số thứ tự).
  2. Thay phần tử bằng `{<name>.map((item) => (<…key={item.id}>…{item.title}…</…>))}` và thêm import file dữ liệu.
  3. Một lần Hoàn tác cho cả hai file.
- Từ chối khi phần tử đã nằm trong `.map`, có biểu thức phức tạp, hoặc là gốc của `return`.

### 3.2. Bảng sửa dữ liệu (TK-32)

- Chọn phần tử nằm trong `.map` trên một mảng đến từ file `*.data.ts|js` (dạng mảng các đối tượng chỉ có chuỗi, số, boolean) → Inspector hiện **bảng như Excel** (`data-grid`): mỗi dòng một mục, mỗi cột một trường; sửa ô, thêm dòng, xóa dòng, kéo đổi thứ tự dòng, thêm cột (tên hợp lệ). Ghi bằng sửa mới `setDataArray { file, exportName, rows }` (máy chủ kiểm file đúng dạng, giữ chú thích đầu file, định dạng ổn định). File không đúng dạng → chỉ đọc, có lý do.

### 3.3. Nguồn dữ liệu cho form và bảng

Máy chủ đọc **trường** (`name`, `label`, `type: text|email|number|date|datetime|boolean|select|textarea|url|password`, `required`, `options?`, `maxLength?`) từ một trong các nguồn (route mới `GET /project/data-sources` liệt kê, `POST /project/data-sources/fields` đọc trường):

- **TypeScript:** `interface`/`type` đối tượng trong file dự án (dùng TypeScript của dự án như `prop-types.ts`; union chuỗi → `select`, `boolean`, `number`, `Date`/`string` theo tên `email`/`url`/`password`/`date`).
- **Zod:** `z.object({...})` (đọc AST tĩnh: `.email()`, `.url()`, `.min()`, `.max()`, `.optional()`, `z.enum([...])`, `z.boolean()`, `z.number()`, `z.date()`).
- **Django:** `models.py` (đọc tĩnh bằng biểu thức chính quy có kiểm: `CharField(max_length)`, `TextField`, `EmailField`, `IntegerField`, `DecimalField`, `BooleanField`, `DateField`, `DateTimeField`, `URLField`, `choices=` → `select`, `blank=True`/`null=True` → không bắt buộc, `verbose_name` → nhãn). Tìm `models.py` cả trong thư mục backend của monorepo (`project.backends`).
- **OpenAPI:** file `openapi.json|yaml` hoặc `schema.json` trong dự án (`components.schemas`; YAML chỉ khi đã có bộ đọc YAML trong repo, nếu không thì chỉ JSON và ghi trong báo cáo).

### 3.4. Form sinh từ dữ liệu (TK-33)

Khối Thư viện `data.form-from-source` mở hộp thoại chọn nguồn → chọn mô hình → chọn/ẩn/sắp xếp trường → chèn `<form>` dùng đúng khối form tương ứng từng kiểu (nhãn gắn `id`, `required`, `type` đúng, `maxLength`), lưới 1–2 cột tự co giãn, nút gửi `{primary}`. Dự án có shadcn thì dùng `Input`, `Label`, `Select`, `Checkbox`… của dự án.

### 3.5. Bảng sinh từ dữ liệu (TK-34)

Khối `data.table-from-source`: như 3.4 nhưng ra **bảng**: cột theo trường đã chọn, dữ liệu mẫu ở file `*.data.ts|js` (5 dòng, giá trị hợp kiểu), có ô tìm kiếm và phân trang qua kit mới `DataTable` (sắp theo cột khi bấm tiêu đề, `aria-sort`), trạng thái "Chưa có dữ liệu" khi lọc ra rỗng. Dữ liệu mẫu sửa được bằng bảng ở 3.2.

### 3.6. Ba trạng thái (TK-35)

Khối `data.states`: chèn ba khối cạnh nhau có chú thích rõ: **Đang tải** (khung xám nhấp nháy theo bố cục thẻ, tôn trọng `prefers-reduced-motion`), **Trống** (icon + "Chưa có dữ liệu" + nút), **Lỗi** (icon + thông báo + nút "Thử lại"), mỗi khối cũng có trong Thư viện riêng (`data.loading`, `data.empty`, `data.error`).

## 4. Thuộc tính có kiểu cho component (TK-49, gộp TK-51)

- Chọn một **thể hiện component** (`<Button variant="outline">`, component của dự án hoặc thư viện đã cài như MUI, shadcn) → Inspector nhóm **"Thuộc tính component"** (`component-props`): máy chủ đọc kiểu props bằng TypeScript của dự án (route mới `POST /project/component-props`, tiến trình con như `prop-types.ts`): union chuỗi → ô chọn, `boolean` → công tắc, `number` → ô số, `string` → ô chữ; prop là hàm, `ReactNode`, đối tượng phức tạp → dòng chỉ đọc "sửa trong editor" + nút mở file.
- Sửa mới `setProp { loc, tag, name, value: string | number | boolean | undefined }`: chuỗi → `name="…"`, số → `name={1}`, `true` → `name`, `false`/`undefined` → bỏ prop (hoặc `{false}` nếu kiểu bắt buộc). Tên prop chỉ là định danh hợp lệ; chặn `children`, `key`, `ref`, `dangerouslySetInnerHTML`, `on*`, `className`, `style`; prop đang là biểu thức không phải hằng số → chỉ đọc.
- Dự án JS (không TypeScript) → đọc `propTypes` nếu có, không thì liệt kê prop đang dùng dạng ô chữ.
- MCP: `kumicraft_set_prop`.

## 5. Canvas và kiểm tra chất lượng (TK-61..66)

- **TK-61:** chọn phần tử con của khung tự do → Canvas vẽ viền nét đứt quanh khung cha kèm nhãn "Khung tự do" (đã có khi chọn chính khung, nay thêm khi chọn con) và đường gióng X/Y từ mép khung tới phần tử, kèm số px (cỡ chữ và nét theo màn hình như tay cầm ở spec-log #129).
- **TK-62:** nhóm Layout đổi tên hiển thị **"Auto layout"**; trên trang thật (không phải bản nháp) công tắc "Khung tự do" chuyển xuống cuối nhóm Layout dưới mục thu gọn "Nâng cao" (`free-frame-advanced`); trong bản nháp giữ chỗ cũ.
- **TK-63 đo khoảng cách:** đang chọn phần tử, giữ **Alt** và rê lên phần tử khác → Canvas vẽ đường đo và số px giữa hai phần tử (trên, dưới, trái, phải; lồng nhau thì đo tới mép trong). Nhả Alt thì tắt. Không đổi file.
- **TK-65 trợ năng:** Inspector có dòng cảnh báo nhẹ (`a11y-hints`, không chặn): chữ có tương phản < 4.5:1 với nền (đo màu tính toán trên Canvas), `img` thiếu `alt`, `button`/`a` không có chữ và không có `aria-label`, ô nhập không có nhãn. Mỗi cảnh báo có nút sửa nhanh khi làm được (thêm `alt=""` hoặc ô nhập `alt`, thêm `aria-label`).
- **TK-66 soát responsive:** nút **"Soát responsive"** (`responsive-audit`) trên thanh Canvas: Bridge mỗi khung đang mở (hoặc tạm đổi độ rộng một khung qua 375, 768, 1280) báo phần tử **tràn ngang** (rộng hơn khung, tạo thanh cuộn ngang) và **chồng nhau** (hai phần tử anh em có vùng giao > 20% mà không phải `absolute`/`fixed`); bảng kết quả liệt kê (khung, phần tử `file:dòng`, loại lỗi), bấm một dòng → chuyển khung và chọn phần tử.

## 6. Test bắt buộc

1. `repeatElement`: tạo file dữ liệu đúng trường, thay phần tử bằng `.map` có `key`, import đúng; từ chối khi đã trong `.map`; Hoàn tác một bước cho cả hai file; JSX hợp lệ, TS qua typecheck của fixture.
2. `setDataArray`: sửa ô, thêm/xóa/đổi thứ tự dòng, thêm cột; file sai dạng → từ chối và Studio chỉ đọc.
3. Đọc trường: TypeScript (union → select, `email` → email, tùy chọn → không bắt buộc), Zod, Django (`CharField(max_length=120)`, `choices`, `blank=True`, `verbose_name`), OpenAPI JSON. Mỗi nguồn ít nhất 2 mô hình mẫu trong fixture.
4. Form sinh ra: mỗi kiểu ra đúng khối, nhãn gắn `id`, `required`, `maxLength`; 7 hệ style; shadcn dùng `Input`/`Label` của dự án.
5. Bảng sinh ra + kit `DataTable`: tìm kiếm lọc, phân trang, sắp theo cột có `aria-sort`, rỗng hiện "Chưa có dữ liệu" (test DOM).
6. `data.states`: ba khối dựng đúng ở 7 hệ; reduced-motion tắt nhấp nháy.
7. Props: union → ô chọn; `setProp` chuỗi/số/boolean/bỏ; chặn `on*`, `children`, `dangerouslySetInnerHTML`; biểu thức không hằng → chỉ đọc; dự án JS dùng `propTypes`.
8. Bridge TK-61 đường gióng và nhãn; TK-63 đo khoảng cách khi giữ Alt (số px đúng với hộp đo giả).
9. TK-62: trang thật → công tắc khung tự do nằm trong "Nâng cao"; bản nháp → chỗ cũ.
10. TK-65: thiếu `alt`, nút không nhãn, tương phản thấp (màu tính toán giả) → cảnh báo; sửa nhanh thêm `aria-label`.
11. TK-66: phần tử rộng hơn khung → "tràn"; hai anh em giao nhau 30% → "chồng"; `absolute` không bị báo.
12. E2E `e2e/data-tools.e2e.ts` (fixture mới `fixtures/projects/react-data`: Vite + React + TS + Tailwind 4, có `src/types/user.ts` (interface), `src/schemas/product.ts` (Zod tối thiểu tự viết, **không** cài zod: chỉ cần mã nguồn để đọc AST), `backend/app/models.py` (Django), `openapi.json`): chèn form từ interface `User` → file có ô `type="email"` `required`; chèn bảng từ model Django → bảng có cột, ở Preview gõ tìm kiếm lọc dòng; "Lặp theo danh sách" một thẻ → file `.data.ts` + `.map`, sửa một ô trong bảng dữ liệu → Canvas đổi chữ.
13. E2E `e2e/quality-tools.e2e.ts`: đổi `variant` của `<Button>` shadcn (`react-shadcn`) bằng ô chọn → file đổi; "Soát responsive" trên trang có phần tử `w-[2000px]` → báo tràn, bấm dòng → phần tử được chọn; ảnh thiếu `alt` → cảnh báo, sửa nhanh.
14. E2E CSS thường (`react-css`): form từ dữ liệu ra luật CSS, JSX không có class Tailwind.

Kiểm ngược (ghi vào báo cáo): bỏ chặn `on*` trong `setProp` → test 7 hỏng; bỏ kiểm "đã trong `.map`" → test 1 hỏng.

## 7. Kiểm tra cuối

`pnpm format`, `pnpm typecheck`, `npx eslint . --ignore-pattern "Mockup/**"` (không cảnh báo `max-lines*` mới), `pnpm check:i18n`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Ghi một dòng `docs/construction/spec-log.md` (số tiếp theo).

Báo cáo bằng mục `## BÁO CÁO K9.7-4` (tiếng Việt, ngắn): file đổi/mới, số test mới theo nhóm 1–14, kết quả từng lệnh (số test qua, số cảnh báo lint), kết quả kiểm ngược, chỗ làm khác bản giao việc và lý do (ví dụ OpenAPI YAML).
