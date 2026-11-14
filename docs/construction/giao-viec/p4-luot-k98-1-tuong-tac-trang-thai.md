# Lượt K9.8-1: Tương tác và trạng thái (TK-73..80)

Kế hoạch: `p4-ke-hoach.md` mục **K9.8**, lượt **K9.8-1**. Người làm: Gemini (làm **một lần** cả lượt). Người kiểm: Claude (QA xong tự tách hàm dài nếu còn).

**Vì sao:** bài thử TK-68 dựng lại `/landing` của Test UI giống 99,9% về hình, nhưng **không bấm chọn được**: ảnh nhỏ trong bộ sưu tập, nút chọn màu, thẻ chế độ ANC, nút EQ; không có chế độ tối, không có thông báo "Đã thêm vào giỏ". Ngoài ra không sửa được chữ của phần tử có icon bên trong. Lượt này làm các công cụ để **người dùng** tự làm những việc đó trong Studio, không viết code.

Nguyên tắc chung (như K9.7): code dự án là gốc; code sinh từ mẫu, không dùng AI; mọi thay đổi có **Hoàn tác** (một bước cho mỗi thao tác, kể cả khi đổi nhiều file); **mọi hệ style chạy như nhau** (Tailwind 4, Tailwind 3, Bootstrap 5, CSS thường, CSS Modules, Sass, Less); cần JavaScript thì dùng **kit** (`kit-service.ts`, sinh một lần vào `src/kumicraft/`, chỉ React, tất cả hoặc không); mỗi công cụ có **lệnh MCP** tương ứng (MCP chỉ để AI **test** công cụ chạy đúng); test unit, E2E và kiểm ngược. Kết quả phải **đẹp** và **dễ dùng**.

## 1. Hiện trạng (đã đọc code)

- **Trạng thái trong Inspector:** `InteractionStateSchema = z.enum(['hover','focus','disabled'])` ở `packages/shared/src/responsive.ts`; ô chọn trạng thái ở `studio/src/features/inspector/components/inspector-header.tsx`; phạm vi ở `inspector/inspector-scope.ts`; Tailwind đọc/ghi tiền tố ở `shared/src/tailwind/reader.ts`, `types.ts`; CSS ghi bộ chọn ở `server/src/core/style/css-edit.ts` (`withStateSelector`, `hasStateInSelector`), `style-apply.ts`, `style-apply-bootstrap.ts`, `style-apply-modules`.
- **Kit:** `server/src/core/source-editor/structure/kit-service.ts`, `kit-templates/` (`tabs.ts`, `toggle-choice.ts`, `modal-drawer.ts`, `dropdown-tooltip.ts`, `carousel.ts`, `mobile-menu.ts`, `reveal.ts`, `data-table.ts`), `restoreWrites` (rollback).
- **Sửa chữ:** `setText` chỉ nhận chữ tĩnh (`text.kind === 'static'`); chữ lẫn phần tử con (`mixed`) bị từ chối, cả trên Canvas (`studio/src/features/text-edit/use-canvas-text-edit.ts`) lẫn MCP.
- **Thuộc tính:** `EXTENDED_EDITABLE_ATTRS` (`href`, `id`, …, `aria-*`, `data-*`) ở `shared/src/source-edits-extra.ts`.
- **Nhóm Inspector:** `inspector/property-groups-config.ts` (layout, selfLayout, sizing, spacing, typography, colors, borders, effects, visibility) và các mục riêng (`inspector-icon-section`, `inspector-image-section`, `inspector-motion-section`, `a11y-hints-section`, `component-props-section`, `data-grid-section`).
- **MCP:** `packages/cli/src/mcp/` (`mcp-edit-tools.ts`, `mcp-structure-tools.ts`, `mcp-tools.ts`).
- **Đọc thêm:** trang thử `Project test/Test UI/src/pages/LandingPage.tsx` (bản gốc có tương tác) để hiểu nhu cầu; **không sửa** dự án đó.

## 2. Không được làm

- Không `git commit/push/checkout/restore/reset/stash/clean`, không `rm -rf`, không cài hay gỡ gói npm (cả dự án người dùng).
- Không `any`, `as unknown as`, `!`, `null` (kể cả `=== null`), `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, ép kiểu `as Record<…>`; không `.then()`; **file ≤ 400 dòng, hàm ≤ 50 dòng** (không thêm cảnh báo `max-lines*`); React ref dạng callback `el ?? undefined`.
- Không chạy mã của dự án người dùng; không gọi mạng; không nới lỏng test cũ; không làm hỏng hành vi K9.7.

## 3. Chỗ đặt trong giao diện (bắt buộc, để người dùng không lạc)

| Công cụ                                                                | Chỗ                                                                                                                                                                           | Khi nào hiện                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Trạng thái (TK-74)                                                     | Ô chọn trạng thái hiện có ở đầu Inspector: **Bình thường, Hover, Đang nhấn, Focus, Vô hiệu, Đang chọn, Rê vào khung cha**; cạnh đó công tắc **Tối** (`inspector-dark-toggle`) | Luôn; "Đang chọn" chỉ bật khi phần tử là mục của nhóm chọn hoặc link trong menu đánh dấu (TK-80), còn lại mờ kèm lý do |
| Nhóm chọn, Khi bấm (toast), Nút xử lý, Liên kết, Đánh dấu mục đang xem | Mục Inspector mới **"Tương tác"** (`inspector-interaction`), đặt ngay sau nhóm Layout                                                                                         | Chỉ hiện dòng áp dụng được cho phần tử đang chọn                                                                       |
| Xem tối                                                                | Nút mặt trăng trên thanh Canvas (`canvas-dark-preview`)                                                                                                                       | Luôn; dự án chưa bật chế độ tối thì bấm sẽ hỏi bật (TK-75)                                                             |
| Nút Sáng/Tối, Thông báo                                                | Thư viện nhóm "Tương tác": `interactive.theme-toggle`, `interactive.toast-demo`                                                                                               | Luôn                                                                                                                   |
| Sửa chữ có icon                                                        | Như sửa chữ hiện có (bấm đúp trên Canvas, ô chữ ở Inspector)                                                                                                                  | Khi phần tử có chữ lẫn phần tử con                                                                                     |

Mọi nút có `data-testid`, chữ `vi`/`en` (`pnpm check:i18n`), tooltip một câu nói làm gì. Lỗi hiện ngay dưới công cụ, nói lý do và cách sửa.

## 4. Công việc

### 4.1. TK-73 Nhóm chọn

- Người dùng chọn **2 phần tử anh em trở lên** (chọn nhiều) hoặc **khung chứa chúng** → mục "Tương tác" → **"Biến thành nhóm chọn"** (`make-select-group`). Tùy chọn: chọn một (mặc định) hoặc chọn nhiều; mục chọn sẵn = mục đầu tiên.
- Kit mới `SelectGroup` (`src/kumicraft/SelectGroup.tsx`): `SelectGroup` (context, `multiple?`, `defaultValue`), `SelectItem` (`as` giữ nguyên thẻ gốc, `value`, đặt `data-selected="true|false"`, bấm/Enter/Space để chọn, phím mũi tên chuyển mục, `role="radio"`/`aria-checked` hoặc `role="tab"`/`aria-selected` khi có nội dung nối), `SelectPanel` (`value`, chỉ hiện khi mục đó được chọn, `role="tabpanel"`). `SelectGroup` không tạo hộp (`display: contents`) để không đổi bố cục.
- **Kiểu dáng khi chuyển:** máy chủ so class của mục đầu (đang tô) với mục thứ hai: class chung giữ làm nền; class chỉ mục đầu có thành kiểu **Đang chọn** (Tailwind `data-[selected=true]:…`; hệ CSS: luật `[data-selected="true"]` cùng bộ chọn), class chỉ mục khác có thành nền. Sau khi chuyển, mọi mục cùng một class nền. Hình trên Canvas phải **giữ nguyên** như trước khi chuyển.
- **Nối nội dung** (`select-group-link`): chọn một khung trên trang (ví dụ khung ảnh lớn, khung chữ trên ảnh ANC) → máy chủ bọc `SelectGroup` ở tổ tiên chung gần nhất của các mục và khung đó, nhân khung thành một `SelectPanel` cho mỗi mục (bản đầu giữ nguyên, các bản sau là bản sao để người dùng sửa). Inspector có dãy nút **"Xem lựa chọn 1 2 3 4"** để Canvas hiện mục đó mà sửa (không đổi file).
- Gỡ: **"Bỏ nhóm chọn"** trả lại phần tử thường (giữ kiểu Đang chọn của mục đang chọn làm class thường).
- Từ chối kèm lý do khi: các mục không cùng cha, đã nằm trong `.map`, hoặc là component không nhận `className`.

### 4.2. TK-74 Trạng thái mới

- Thêm vào schema: `active` (Đang nhấn), `groupHover` (Rê vào khung cha), `selected` (Đang chọn); chế độ tối là **trục riêng** `dark: boolean` trong phạm vi (kết hợp được với trạng thái khác, ví dụ Tối + Hover).
- Ghi: Tailwind `active:`, `group-hover:`, `data-[selected=true]:`, `dark:` (kết hợp `dark:hover:`); CSS thường/Modules/Sass/Less `:active`, `.<cha>:hover .<con>`, `[data-selected="true"]`, `.dark .<lớp>`; Bootstrap như CSS. Đọc lại đúng cả hai chiều (Inspector hiện giá trị đang có ở trạng thái đó).
- **Rê vào khung cha:** khi chọn trạng thái này, Inspector hỏi khung cha nào (mặc định cha gần nhất có nền hoặc viền); máy chủ thêm class `group` (Tailwind) hoặc dùng class của cha (CSS; cha chưa có class thì tạo `kc-…`).
- Canvas xem thử: chọn trạng thái nào thì Bridge ép hiển thị trạng thái đó cho phần tử đang chọn (đã có cho hover/focus thì mở rộng, kèm `data-selected`, cha `:hover` giả, lớp `.dark`).

### 4.3. TK-75 Chế độ tối

- **Bật chế độ tối cho dự án** (hỏi một lần khi người dùng dùng bất kỳ công cụ tối nào): dùng chiến lược **lớp `.dark` trên `<html>`**. Tailwind 4: thêm `@custom-variant dark (&:where(.dark, .dark *));` vào file CSS chính. Tailwind 3: sửa `darkMode: 'class'` trong file cấu hình khi là đối tượng đơn giản (đọc AST), nếu không thì từ chối kèm dòng cần thêm. CSS: không cần gì. Kit `src/kumicraft/theme.ts` (đọc `localStorage`, nếu chưa có thì theo hệ điều hành) được gọi một lần ở file vào (`main.tsx`) để không nháy màu.
- **Xem tối** trên Canvas: Bridge bật/tắt `.dark` trên `<html>` của mọi khung (không đổi file).
- **Khối `interactive.theme-toggle`:** kit `ThemeToggle` (icon mặt trời/mặt trăng Lucide offline, `aria-label`, `aria-pressed`, lưu `localStorage`, nhãn tùy chọn "Chế độ Tối/Sáng").
- **Gợi ý màu tối** (nút trong công tắc Tối của Inspector): với phần tử đang chọn, đề xuất màu nền/chữ/viền tối theo bảng màu dự án (cùng sắc, đủ tương phản 4.5:1 như TK-70), người dùng bấm "Áp dụng".

### 4.4. TK-76 Thông báo khi bấm

- Chọn nút hoặc link → "Tương tác" → **"Khi bấm: hiện thông báo"**: nhập chữ chính, chữ phụ (tùy chọn), loại (thành công, lỗi, thông tin), thời gian (3–5 giây, mặc định 4), vị trí (dưới phải mặc định).
- Kit `Toast.tsx`: `ToastHost` (chèn một lần ở gốc trang khi cần, `aria-live="polite"`, không lấy focus, có nút đóng, xếp chồng tối đa 3, tôn trọng giảm chuyển động) và `ToastTrigger` bọc phần tử (thêm `onClick` qua `cloneElement`, giữ `onClick` cũ nếu có). Kiểu dáng dùng vai trò màu và phong cách dự án (K9.7-1).
- Khối Thư viện `interactive.toast-demo`: một nút mẫu kèm thông báo, để thấy ngay.

### 4.5. TK-77 Nút đang xử lý

- Chọn nút → "Tương tác" → **"Có trạng thái đang xử lý"**: chuyển thành kit `LoadingButton` (`as` giữ thẻ, `loading`, `loadingText`, vòng xoay `aria-hidden`, `aria-busy`, khóa bấm, giữ nguyên độ rộng khi đổi chữ). Prop `demo` (bật mặc định khi tạo): bấm thì giả lập xử lý 1,5 giây rồi trở lại, để người dùng thấy trên Preview. Thuộc tính chỉnh qua bảng thuộc tính có kiểu của K9.7-4.
- Trạng thái xem thử trên Canvas: ô trạng thái có thêm "Đang xử lý" chỉ khi phần tử là `LoadingButton`.

### 4.6. TK-78 Sửa chữ khi có icon hoặc chữ tô

- Phần tử có chữ lẫn phần tử con (icon, `<span>` tô, `<strong>`, `<br />`): chữ được chia thành **đoạn** (các khúc chữ nằm giữa phần tử con). Bấm đúp trên Canvas sửa đúng đoạn dưới con trỏ; Inspector ô chữ hiện từng đoạn thành ô riêng, phần tử con hiện dạng thẻ nhỏ không sửa được (ví dụ `[icon zap]`).
- Sửa mới `setTextRun { loc, tag, index, before, after }`: chỉ đổi chữ của đoạn `index`, giữ nguyên phần tử con và khoảng trắng JSX (`{' '}`); `before` sai thì từ chối (như `setText`). Đoạn chứa biểu thức thì chỉ đọc.
- MCP `kumicraft_set_text` nhận thêm `run?` (số thứ tự đoạn).

### 4.7. TK-79 Chọn đích liên kết

- Chọn `a` (hoặc nút) → "Tương tác" → **"Liên kết tới"**: ô chọn liệt kê (1) **phần trong trang** có `id` (tên lấy từ tiêu đề đầu tiên bên trong), (2) **trang** của dự án (route), (3) địa chỉ ngoài (ô chữ, tự thêm `target="_blank" rel="noopener noreferrer"` khi bật "Mở tab mới"). Ghi `href` bằng `setAttribute`.
- Phần chưa có `id`: nút **"Đặt tên cho phần này"** trên phần `section`/`div` đang chọn → `id` dạng chữ thường có gạch nối, không trùng trong file.
- **Cuộn mượt** (công tắc, mặc định bật khi chọn đích trong trang): thêm `scroll-smooth` (Tailwind) hoặc `scroll-behavior: smooth` (CSS) cho `html` qua file CSS chính, tôn trọng giảm chuyển động. Có header dính (`sticky`/`fixed`) thì thêm khoảng trừ cho phần đích (`scroll-mt-[chiều cao header]` hoặc `scroll-margin-top`).
- Route của dự án dùng `react-router` → link trang dùng `<Link to>` khi file đã import, không thì `href`.

### 4.8. TK-80 Đánh dấu mục đang xem

- Chọn khung menu (`nav` hoặc khung chứa các link) → "Tương tác" → **"Đánh dấu mục đang xem"**: bọc kit `ScrollSpy` (`src/kumicraft/ScrollSpy.tsx`, `display: contents`): link `#id` có `data-selected="true"` và `aria-current="true"` khi phần đó đang ở vùng nhìn (IntersectionObserver, phần gần đỉnh nhất thắng); link trang có `aria-current="page"` khi khớp route (dùng `useLocation` nếu có `react-router`, không thì `window.location`).
- Kiểu dáng mục đang xem chỉnh bằng trạng thái **Đang chọn** (TK-74), dùng chung với nhóm chọn.

### 4.9. MCP (để AI test)

`kumicraft_make_select_group`, `kumicraft_link_select_content`, `kumicraft_remove_select_group`, `kumicraft_update_classes` thêm `state?` và `dark?`, `kumicraft_enable_dark_mode`, `kumicraft_add_toast_on_click`, `kumicraft_make_loading_button`, `kumicraft_set_text` thêm `run?`, `kumicraft_set_link_target`, `kumicraft_mark_active_nav`. Mỗi lệnh dùng đúng route Studio dùng, không có đường riêng.

## 5. Test bắt buộc

1. Nhóm chọn: 4 thẻ anh em → kit đúng, class nền chung, class "Đang chọn" đúng phần khác biệt, hình Canvas không đổi (so hộp đo); bấm/phím mũi tên đổi `data-selected`; `aria-checked` đúng; từ chối khi khác cha hoặc trong `.map`; Hoàn tác một bước.
2. Nối nội dung: khung đích nhân đúng số `SelectPanel`, chỉ panel của mục chọn hiện; "Xem lựa chọn 3" trên Canvas hiện panel 3 mà file không đổi.
3. Trạng thái mới ghi/đọc đúng ở **7 hệ style** (bảng test): `active`, `groupHover` (thêm `group` cho cha), `selected`, `dark`, `dark + hover`.
4. Chế độ tối: Tailwind 4 thêm `@custom-variant` một lần; Tailwind 3 sửa `darkMode`; cấu hình phức tạp → từ chối kèm lý do; `theme.ts` gọi một lần; xem tối trên Canvas bật/tắt `.dark` mà file không đổi; `ThemeToggle` đổi lớp và lưu `localStorage` (test DOM).
5. Toast: `ToastTrigger` giữ `onClick` cũ; `ToastHost` chèn một lần; `aria-live`; tự tắt theo thời gian (đồng hồ giả); giảm chuyển động tắt hiệu ứng.
6. `LoadingButton`: `aria-busy`, khóa bấm, giữ độ rộng; `demo` trở lại sau 1,5 giây.
7. `setTextRun`: phần tử `<h3><svg/> Pin & Kết nối</h3>` đổi chữ mà icon giữ nguyên; chữ có `<span>` tô sửa từng đoạn; `before` sai → từ chối; biểu thức → chỉ đọc; bấm đúp trên Canvas sửa đúng đoạn.
8. Liên kết: danh sách phần có `id`; "Đặt tên cho phần này" tạo `id` không trùng; cuộn mượt + `scroll-mt` khi có header dính; link ngoài có `rel`.
9. `ScrollSpy`: cuộn tới phần 2 → link 2 có `data-selected="true"` và `aria-current` (IntersectionObserver giả).
10. Giao diện: mục "Tương tác" chỉ hiện dòng áp dụng được; dòng không áp dụng hiện mờ kèm lý do; mọi chữ có `vi`/`en`.
11. E2E `e2e/interaction-tools.e2e.ts` (fixture `vite8-react19-ts` hoặc fixture mới nhỏ): trang có 4 thẻ ảnh nhỏ + khung ảnh lớn → "Biến thành nhóm chọn" → "Nối nội dung" với khung lớn → ở Preview bấm thẻ 3 thì thẻ 3 có viền chọn và khung lớn đổi; bật chế độ tối, chèn `ThemeToggle`, chỉnh màu nền khi Tối → bấm nút trên Preview thì nền đổi; nút "Thêm vào giỏ" → "Khi bấm: hiện thông báo" → bấm thì thông báo hiện rồi tự tắt; tiêu đề có icon → sửa chữ trên Canvas, icon còn.
12. E2E CSS thường (`react-css`): nhóm chọn và chế độ tối ra luật CSS, JSX không có class Tailwind.

Kiểm ngược (ghi vào báo cáo): bỏ bước tách class nền/Đang chọn → test 1 hỏng; bỏ kiểm `before` trong `setTextRun` → test 7 hỏng.

## 6. Kiểm tra cuối

`pnpm format`, `pnpm typecheck`, `npx eslint . --ignore-pattern "Mockup/**"` (không thêm cảnh báo `max-lines*`), `pnpm check:i18n`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Ghi một dòng `docs/construction/spec-log.md` (số tiếp theo, hiện là #136).

Báo cáo bằng mục `## BÁO CÁO K9.8-1` (tiếng Việt, ngắn): file đổi/mới, số test mới theo nhóm 1–12, kết quả từng lệnh (số test qua, số cảnh báo lint), kết quả kiểm ngược, chỗ làm khác bản giao việc và lý do.
