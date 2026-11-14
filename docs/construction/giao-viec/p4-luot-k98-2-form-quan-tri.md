# Lượt K9.8-2: Form, màn hình quản trị và kiểm tra chất lượng (TK-81..87)

Kế hoạch: `p4-ke-hoach.md` mục **K9.8**, lượt **K9.8-2**. Làm **sau** khi K9.8-1 đã QA và commit (dùng lại `Toast`, mục "Tương tác", trạng thái mới). Người làm: Gemini (làm **một lần** cả lượt). Người kiểm: Claude.

**Vì sao:** màn hình quản trị (danh sách + form + modal) cần những thứ chưa có: form báo lỗi đúng chỗ, form nhiều bước, chọn nhiều dòng để làm hàng loạt, hỏi trước khi xóa, Hoàn tác sau khi xóa. Đối chiếu 119 quy tắc UX của ui-ux-pro-max còn thiếu thêm vài kiểm tra chất lượng (tiêu đề nhảy cấp, vùng bấm nhỏ, mất viền focus), tối ưu ảnh và tiện ích chữ.

Nguyên tắc chung: như K9.8-1 (code dự án là gốc, sinh từ mẫu, Hoàn tác, **7 hệ style như nhau**, kit chỉ React, mỗi công cụ một lệnh MCP để AI test, test unit + E2E + kiểm ngược, đẹp và dễ dùng). Cấm như K9.8-1 mục 2.

## 1. Hiện trạng (đã đọc code)

- **Form:** khối `form.*` (`form.form`, `form.input`, `form.textarea`, `form.select`, `form.checkbox`, `form.radio-group`, `form.switch`, `form.date`, `form.file`, `form.search`), `data.form-from-source` (K9.7-4, có `required`, `type`, `maxLength`, nhãn gắn `id`).
- **Bảng:** kit `data-table.ts` (tìm kiếm, phân trang, sắp theo cột có `aria-sort`, "Chưa có dữ liệu"), khối `data.table`, `data.table-from-source`; thuộc tính có kiểu (`component-props-section.tsx`, `setProp`).
- **Modal:** kit `modal-drawer.ts` (`interactive.modal`, `interactive.drawer`).
- **Kiểm tra:** `a11y-hints-section.tsx` (tương phản, `alt`, nút không nhãn, ô không nhãn), nút "Soát responsive" (TK-66).
- **Ảnh:** `inspector-image-section.tsx`; thuộc tính cho phép ở `EXTENDED_EDITABLE_ATTRS` (`shared/src/source-edits-extra.ts`) **chưa có** `loading`, `decoding`, `width`, `height`, `fetchPriority`.
- **Trình chiếu:** kit `carousel.ts` có `autoPlay` (tắt mặc định) và tôn trọng giảm chuyển động, **chưa có** nút dừng/tiếp và chưa dừng khi rê chuột hoặc focus.
- **Từ K9.8-1:** `Toast`/`ToastHost`, mục Inspector "Tương tác", trạng thái mới.

## 2. Chỗ đặt trong giao diện

| Công cụ                                                   | Chỗ                                                                                                                        | Khi nào hiện                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Kiểm tra form, Form nhiều bước                            | Mục "Tương tác"                                                                                                            | Khi chọn `form` hoặc phần tử trong form |
| Hiện/ẩn mật khẩu                                          | Mục "Tương tác"                                                                                                            | Khi chọn `input type="password"`        |
| Bảng quản trị (chọn nhiều, hàng loạt, xác nhận, Hoàn tác) | Bảng thuộc tính của `DataTable` (đã có)                                                                                    | Khi chọn `DataTable`                    |
| Hỏi xác nhận khi bấm                                      | Mục "Tương tác"                                                                                                            | Khi chọn nút hoặc link                  |
| Kiểm tra thêm                                             | Mục cảnh báo hiện có + nút **"Soát trang"** (đổi tên "Soát responsive" thành "Soát trang", có 2 tab: Responsive, Trợ năng) | Luôn                                    |
| Ảnh tối ưu                                                | Mục ảnh hiện có                                                                                                            | Khi chọn `img`                          |
| Tiện ích chữ                                              | Nhóm Chữ (typography) hiện có                                                                                              | Khi phần tử có chữ                      |
| Khối mới                                                  | Thư viện: `form.stepper`, `form.password`, `interactive.confirm`, `screen.admin-list`                                      | Luôn                                    |

Mọi nút có `data-testid`, chữ `vi`/`en`, tooltip một câu; dòng không áp dụng hiện mờ kèm lý do.

## 2b. Thư viện của dự án trước, kit sau; không xung đột với code người dùng

Dự án người dùng có thể đang được viết tay song song. Mọi công cụ lượt này phải **dò trước khi sinh** và **không bao giờ tạo bản thứ hai** của thứ dự án đã có:

- **Dùng thư viện của dự án khi có** (dò bằng `package.json` và `uiKit` của TK-44, không cài gì thêm): hộp xác nhận → `alert-dialog` của shadcn; nút gửi đang xử lý → `Button` của dự án; ô mật khẩu → `Input` của dự án; thông báo → thư viện toast đã cài (`sonner`: gọi `toast()`, `<Toaster />`; `react-hot-toast`; `react-toastify`), nếu không có mới dùng kit `Toast` của K9.8-1. Dự án có shadcn nhưng thiếu component cần dùng → dùng kit và Inspector ghi một dòng "Dự án chưa có `alert-dialog`, đang dùng bản của KumiCraft".
- **Chỗ chứa dùng chung chỉ có một:** trước khi chèn `ToastHost`/`<Toaster />`, nhà cung cấp chủ đề, `theme.ts`, dò trong file vào (`main.tsx`, `App.tsx`, layout) xem đã có chưa; có rồi thì dùng lại, không chèn thêm.
- **Form đã có thư viện kiểm tra** (`react-hook-form`, `formik`, `@tanstack/react-form`, hoặc `onSubmit` tự viết có `preventDefault`): **không** bọc `ValidatedForm`; dòng "Kiểm tra khi gửi" hiện mờ kèm lý do "Form này đã có kiểm tra bằng react-hook-form".
- **Không đè hành vi có sẵn:** phần tử đã có `onClick`, `onSubmit`, `onChange` thì giữ nguyên và gọi trước/sau đúng thứ tự (đã áp dụng cho `ToastTrigger`); prop do lập trình viên đặt không bị ghi đè.
- **Trùng tên:** file đã có biến hoặc import trùng tên với component kit (`Toast`, `Stepper`, `ConfirmDialog`…) → import kèm tên khác (`import { Stepper as KcStepper }`), không đổi code của người dùng.
- **File kit đã bị sửa tay** (so dấu băm như TK-87) → không ghi đè, báo và hỏi.
- **File đổi trên đĩa từ lúc đọc** (người dùng vừa lưu trong editor) → từ chối như các sửa hiện có (`before` không khớp), Studio đọc lại rồi mới cho làm.
- **Không bao giờ** cài hay gỡ gói, không sửa `package.json` của dự án.

Test thêm (nhóm 13 ở mục 4): dự án có `sonner` → thông báo dùng `toast()` của sonner, không có `ToastHost` thứ hai; đã có `<Toaster />` → không chèn thêm; form có `react-hook-form` → công cụ kiểm tra hiện mờ; file có biến `Stepper` sẵn → import đổi tên; dự án shadcn thiếu `alert-dialog` → dùng kit kèm dòng thông báo.

## 3. Công việc

### 3.1. TK-81 Form có kiểm tra

- Chọn `form` → **"Kiểm tra khi gửi"** (`form-validation`): bọc kit `ValidatedForm` (`src/kumicraft/ValidatedForm.tsx`, giữ thẻ `form` và class). Luật lấy từ thuộc tính sẵn có của ô (`required`, `type="email|url|number"`, `minLength`, `maxLength`, `min`, `max`, `pattern`); kiểm khi rời ô (không kiểm từng phím), kiểm tất cả khi gửi.
- Lỗi hiện **ngay dưới ô**, nói nguyên nhân và cách sửa ("Email chưa đúng dạng, ví dụ ten@congty.vn"; chữ `vi`/`en` theo ngôn ngữ trang, chỉnh được ở Inspector), gắn `aria-describedby` và `aria-invalid`; viền ô đổi màu lỗi (vai trò màu `{danger}`, đủ tương phản). Gửi lỗi → **tóm tắt lỗi** ở đầu form (`role="alert"`, mỗi lỗi là link tới ô) và focus vào tóm tắt.
- **Dấu bắt buộc:** nhãn của ô `required` tự có dấu `*` (`aria-hidden`) và chữ ẩn "(bắt buộc)" cho trình đọc màn hình.
- **Trạng thái gửi:** nút gửi chuyển thành `LoadingButton` (K9.8-1); prop `demo` giả lập gửi 1,5 giây rồi hiện thông báo thành công bằng `Toast`. Có prop `onSubmit` để lập trình viên nối API sau.
- Áp dụng được cho form chèn từ `data.form-from-source` (công tắc "Kiểm tra khi gửi" bật sẵn khi chèn).

### 3.2. TK-81b Hiện/ẩn mật khẩu

- Khối `form.password` và nút **"Thêm hiện/ẩn"** cho ô mật khẩu có sẵn: kit `PasswordInput` (nút mắt Lucide, `aria-label` "Hiện mật khẩu"/"Ẩn mật khẩu", `aria-pressed`, không mất focus ô, giữ `autoComplete`).

### 3.3. TK-82 Form nhiều bước

- Khối `form.stepper` và nút **"Chia thành nhiều bước"** cho form có sẵn (chọn các nhóm ô, mỗi nhóm một bước): kit `Stepper`/`Step` (thanh bước có số và tên, bước hiện tại `aria-current="step"`, nút Quay lại/Tiếp/Gửi, chỉ sang bước sau khi bước này hợp lệ (dùng `ValidatedForm`), giữ dữ liệu khi quay lại).
- Inspector: thêm/xóa/đổi tên/đổi thứ tự bước; dãy **"Xem bước 1 2 3"** để Canvas hiện bước đó mà sửa (không đổi file).

### 3.4. TK-83 Bảng quản trị

- `DataTable` thêm prop (chỉnh qua bảng thuộc tính có kiểu):
  - `selectable`: cột ô chọn mỗi dòng + "chọn tất cả trang này" (trạng thái lửng khi chọn một phần), `aria-label` từng ô.
  - `bulkActions` (`delete`, `export`): khi có dòng được chọn, hiện thanh "Đã chọn N" với nút Xóa (màu nguy hiểm, tách xa nút khác) và Xuất CSV (chỉ các dòng chọn).
  - `confirmDelete` (bật mặc định): Xóa hỏi bằng `ConfirmDialog` ("Xóa 3 dòng? Không thể khôi phục sau 5 giây."), nút Hủy focus mặc định.
  - `undoDelete` (bật mặc định): sau khi xóa hiện `Toast` "Đã xóa 3 dòng" có nút **Hoàn tác** trong 5 giây (dữ liệu trong bộ nhớ trang; có prop `onDelete` để lập trình viên nối API).
  - `rowActions`: cột cuối có nút Sửa/Xóa từng dòng (Sửa mở `interactive.modal` có form sinh từ cùng nguồn dữ liệu nếu bảng sinh từ nguồn).
- Kit `ConfirmDialog` (dùng lại phần modal: bẫy focus, Esc đóng, trả focus về nút gốc, `role="alertdialog"`).
- **Hỏi xác nhận khi bấm** cho nút bất kỳ (mục "Tương tác"): bọc `ConfirmTrigger` với chữ tiêu đề, mô tả, nút đồng ý, kiểu nguy hiểm hay thường.
- Khối mẫu màn hình `screen.admin-list`: tiêu đề + nút "Thêm mới" (mở modal form) + ô tìm kiếm + `DataTable` đủ các prop trên + 3 trạng thái tải/trống/lỗi, đẹp theo phong cách dự án.

### 3.5. TK-84 Kiểm tra thêm

Thêm vào cảnh báo phần tử và tab **Trợ năng** của "Soát trang" (bấm dòng → chọn phần tử):

- **Tiêu đề nhảy cấp** (h1 → h3, nhiều h1): báo trên trang; sửa nhanh đổi cấp bằng `setTag` (giữ class nên hình không đổi).
- **Vùng bấm nhỏ:** nút/link nhỏ hơn 24×24 px ở mọi khung, hoặc nhỏ hơn 44×44 px ở khung điện thoại (đo trên Canvas); sửa nhanh thêm khoảng đệm (`p-2`/`min-h-11 min-w-11` hoặc CSS tương ứng).
- **Mất viền focus:** phần tử bấm được có `outline-none`/`outline: none` mà không có kiểu focus thay thế (`focus-visible:`); sửa nhanh thêm vòng focus theo vai trò màu `{primary}`.
- **Thiếu `cursor-pointer`** ở phần tử có `onClick` hoặc là kit tương tác (gợi ý, không phải lỗi).

### 3.6. TK-85 Ảnh tối ưu

- Cho phép thuộc tính `loading`, `decoding`, `width`, `height`, `fetchPriority` (thêm vào danh sách an toàn, kiểm giá trị: `loading` chỉ `lazy|eager`, kích thước là số nguyên dương).
- Mục ảnh: công tắc **"Tải chậm"** (gợi ý bật cho ảnh nằm dưới màn hình đầu, tắt cho ảnh hero và đặt `fetchPriority="high"`), nút **"Giữ khung"** ghi `width`/`height` theo kích thước thật của ảnh (đo trên Canvas) hoặc tỉ lệ (`aspect-[…]`/`aspect-ratio`).
- Tab Trợ năng/Hiệu năng của "Soát trang" báo ảnh không có kích thước và ảnh lớn dưới màn hình đầu chưa tải chậm.

### 3.7. TK-86 Tiện ích chữ

- Nhóm Chữ thêm: **"Cân dòng tiêu đề"** (`text-balance` / `text-wrap: balance`, gợi ý cho h1–h3), **"Số đều cột"** (`tabular-nums` / `font-variant-numeric: tabular-nums`, gợi ý cho giá, số liệu, bảng), cảnh báo **dòng quá dài** (đoạn văn rộng hơn khoảng 75 ký tự) kèm sửa nhanh `max-w-prose` / `max-width: 65ch`.

### 3.8. TK-87 Trình chiếu ảnh có nút dừng

- Kit `Carousel`: khi `autoPlay` bật thì có nút **Dừng/Tiếp** nhìn thấy được, tự dừng khi rê chuột hoặc focus vào trong, thông báo "Ảnh 2 trên 5" (`aria-live="polite"` chỉ khi người dùng bấm). Kit đã sinh trong dự án cũ: nút "Cập nhật kit" (chỉ khi file kit chưa bị sửa tay, so dấu băm; đã sửa thì báo, không ghi đè).

### 3.9. MCP (để AI test)

`kumicraft_enable_form_validation`, `kumicraft_add_password_toggle`, `kumicraft_make_stepper`, `kumicraft_add_confirm_on_click`, `kumicraft_page_audit` (trả danh sách lỗi Responsive/Trợ năng/Hiệu năng), `kumicraft_optimize_image`, `kumicraft_set_text_helpers`; bảng quản trị chỉnh qua `kumicraft_set_prop` có sẵn.

## 4. Test bắt buộc

1. `ValidatedForm`: rời ô email sai → lỗi dưới ô có `aria-describedby`/`aria-invalid`; gửi khi còn lỗi → tóm tắt có link, focus vào tóm tắt; không kiểm từng phím; `required` → dấu `*` và chữ ẩn; 7 hệ style cho kiểu lỗi.
2. `PasswordInput`: bấm mắt đổi `type`, `aria-pressed`, focus vẫn ở ô.
3. `Stepper`: không sang bước khi bước hiện tại lỗi; quay lại giữ dữ liệu; `aria-current="step"`; "Xem bước 2" trên Canvas không đổi file.
4. `DataTable`: chọn dòng, chọn tất cả (trạng thái lửng), thanh hàng loạt, xác nhận rồi xóa, Hoàn tác trả lại đúng dòng và thứ tự, xuất CSV đúng dòng chọn (test DOM).
5. `ConfirmDialog`/`ConfirmTrigger`: bẫy focus, Esc, trả focus, Hủy là mặc định.
6. Kiểm tra: tiêu đề nhảy cấp, vùng bấm 20×20 → báo, 44×44 → không báo ở điện thoại; `outline-none` không có `focus-visible:` → báo, có → không; sửa nhanh ghi đúng ở 7 hệ.
7. Ảnh: thuộc tính mới chỉ nhận giá trị hợp lệ; "Giữ khung" ghi đúng số; "Soát trang" báo ảnh thiếu kích thước.
8. Chữ: ba tiện ích ghi đúng ở 7 hệ; cảnh báo dòng dài.
9. `Carousel`: nút Dừng/Tiếp, dừng khi rê chuột/focus, giảm chuyển động không tự chạy; "Cập nhật kit" không ghi đè file đã sửa tay.
10. E2E `e2e/admin-tools.e2e.ts`: chèn `screen.admin-list` → ở Preview tìm kiếm lọc, chọn 2 dòng → Xóa → xác nhận → còn đúng dòng → Hoàn tác → trở lại; "Thêm mới" mở modal form, gửi trống → lỗi dưới ô và tóm tắt.
11. E2E `e2e/page-audit.e2e.ts`: trang có h1 → h3, nút 16×16, ảnh thiếu kích thước → "Soát trang" báo đủ 3 loại, bấm dòng chọn đúng phần tử, sửa nhanh tiêu đề thì hết báo.
12. E2E CSS thường (`react-css`): form có kiểm tra và bảng quản trị ra luật CSS, JSX không có class Tailwind.
13. Không xung đột (mục 2b): dự án có `sonner` → dùng `toast()` của sonner, không thêm `ToastHost`; đã có `<Toaster />` → không chèn thêm; form có `react-hook-form` → "Kiểm tra khi gửi" hiện mờ kèm lý do; file có biến `Stepper` sẵn → import đổi tên; shadcn thiếu `alert-dialog` → dùng kit kèm dòng thông báo; file kit đã sửa tay → không ghi đè.

Kiểm ngược (ghi vào báo cáo): bỏ bẫy focus của `ConfirmDialog` → test 5 hỏng; bỏ kiểm giá trị `loading` → test 7 hỏng.

## 5. Kiểm tra cuối

`pnpm format`, `pnpm typecheck`, `npx eslint . --ignore-pattern "Mockup/**"` (không thêm cảnh báo `max-lines*`), `pnpm check:i18n`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Ghi một dòng `docs/construction/spec-log.md` (số tiếp theo).

Báo cáo bằng mục `## BÁO CÁO K9.8-2` (tiếng Việt, ngắn): file đổi/mới, số test mới theo nhóm 1–13, kết quả từng lệnh, kết quả kiểm ngược, chỗ làm khác bản giao việc và lý do.
