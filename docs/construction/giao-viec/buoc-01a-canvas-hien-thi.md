# Bước 1A — Canvas hiển thị đúng như thiết kế (M-CV)

WP-1.07, phần 1/4. Module: M-CV. Spec: SPEC-04.1 mục 7 (7.1 đến 7.6, 7.8), ADR-FE-04, ADR-FE-05. Làm xong 1A mới làm 1B.

## Vì sao cần bước này (đã soi code, 2026-10-12)

Renderer 25 loại node đã commit (`3e64b7b`) và test jsdom đạt, **nhưng trên trình duyệt thật Canvas gần như chắc chắn hiển thị sai**, vì:

1. `features/canvas/canvas-iframe.tsx` hàm `copyParentStyles` chép CSS của chính Studio vào iframe. Iframe **không** nạp Tailwind runtime, nên các class của thiết kế (`grid grid-cols-4`, `gap-4`, `p-[24px]`...) không sinh ra CSS. Đồng thời CSS của Studio rò vào bản thiết kế.
2. Khối `@theme` (token) đang chèn bằng `<style id="rc-theme">` thường; Tailwind runtime chỉ xử lý `@theme` trong `<style type="text/tailwindcss">`.
3. Iframe dùng `size-full` trong khung có chiều cao `min-height` (không cố định) nên có thể chỉ cao 150 px (mặc định của iframe).
4. `canvas-area.tsx` thu phóng bằng CSS `zoom`. Spike VG-11 (đã Đạt) kiểm chứng kéo thả với `transform: scale(...)`, không phải `zoom`. Overlay (1B) và kéo thả (Bước 2) cần toạ độ chắc chắn, nên chuyển sang `transform`.
5. Helper trong iframe đặt `a { pointer-events: none }` và `form { pointer-events: none }`. Điều này làm click xuyên qua Link/Form xuống phần tử bên dưới, hỏng việc chọn node ở 1B.

## Phạm vi (chỉ được sửa/ thêm)

- `packages/studio/src/features/canvas/**` (trừ `rich-text/`)
- `packages/studio/src/features/editor/canvas-area.tsx` (và test của nó nếu có)
- `packages/studio/src/i18n/locales/vi/common.json`, `en/common.json` (khóa `canvas.*`)
- `e2e/canvas-render.e2e.ts` (mới)
- Ghi chú vào `docs/construction/spec-log.md`

Không thêm thư viện. Không sửa model, server, store.

## Việc cần làm

### A. Viết E2E đỏ trước, để thấy lỗi thật

Tạo `e2e/canvas-render.e2e.ts`. Dùng `copyFixture` / `startCli` (xem `e2e/workspace-flow.e2e.ts`, `e2e/support/`). Cách có workspace chứa `all-nodes`: tạo workspace rồi ghi đè file trang bằng nội dung từ `fixtures/designs/all-nodes.json` (hoặc nạp qua API `workspace/operations`; chọn cách đơn giản nhất chạy được, ghi rõ trong báo cáo). Trong iframe dùng `page.frameLocator('[data-testid="canvas-iframe"]')`.

Các kiểm tra tối thiểu (mỗi cái một `test`, tên có mã quy tắc):

1. Có đủ phần tử `[data-rc-node]` cho mọi loại node của fixture; không lỗi `console.error`, không `pageerror`.
2. **CSS của thiết kế có hiệu lực**: một node `Grid` có `display: grid` (đọc bằng `evaluate(getComputedStyle)`), một node có padding/gap theo style có giá trị đúng.
3. **Token có hiệu lực**: đổi màu token qua API `token.set` (hoặc dùng fixture), màu nền/chữ của node dùng token trong iframe đổi theo.
4. Iframe cao ≥ chiều cao khung (`frame.height`), rộng đúng `frame.width`; trang dài hơn khung thì iframe cao bằng nội dung (không có thanh cuộn trong iframe).
5. Offline: chặn mọi request ra ngoài `127.0.0.1` (`page.route`), trang vẫn hiển thị đúng (kiểm tra 2).
6. Ở zoom 50% và 100% (xem việc D) khung vẫn đúng kích thước hiển thị: `boundingBox().width ≈ frame.width * scale` (sai số 1 px).
7. Click vào một `Link` và một `Form` không điều hướng, không submit, và không đổi URL của iframe.

Chạy trên Chromium, Firefox, WebKit (`pnpm test:e2e`). Chạy để thấy test đỏ, ghi vào báo cáo test nào đỏ.

### B. Nạp Tailwind runtime vào iframe

- Dùng gói `@tailwindcss/browser` 4.3.3 đã có trong `packages/studio/package.json`. `package.json` của gói chỉ xuất `"."`, nên dùng `import tailwindRuntimeUrl from '@tailwindcss/browser?url'` để Vite đóng gói thành asset cùng gốc với Studio.
- Chèn `<script src="{url}">` vào `<head>` của iframe. CSP của server là `script-src 'self'` (xem `packages/server/src/adapters/http/security.ts`): **không** dùng script inline, **không** CDN. Tài liệu iframe là `about:blank`/srcdoc kế thừa CSP của trang cha; nếu trình duyệt nào chặn, báo lại, đừng nới CSP.
- Xoá `copyParentStyles`. Iframe chỉ có: Tailwind runtime, khối theme, khối helper, nội dung thiết kế.
- Tham khảo: `scripts/vg/vg-10.mjs` (đã chứng minh chạy offline).

### C. Khối theme và helper

- Khối token: `<style type="text/tailwindcss" id="rc-theme">` chứa `generateThemeCss(tokens)`. Chỉ ghi lại `textContent` khi chuỗi CSS thật sự đổi (R-CV-07; code hiện đã so sánh, giữ nguyên ý đó). Viết test: đổi một node không làm `rc-theme` bị ghi lại (đếm số lần gán qua MutationObserver hoặc spy).
- Helper (`rc-helpers`): giữ `html, body { margin:0 }`, `* { box-sizing: border-box }`. **Bỏ** `pointer-events: none` của `a`, `form`.
- Chặn điều hướng/gửi form bằng listener ở pha capture trên `iframeDocument`: `click` trên `a` → `preventDefault()`; `submit` → `preventDefault()`; `auxclick` (chuột giữa) cũng chặn. Gỡ listener khi unmount.

### D. Kích thước iframe và thu phóng

- Iframe rộng đúng `frame.width` (px). Chiều cao = `max(frame.height, chiều cao nội dung)`; đo bằng `ResizeObserver` trên `iframeDocument.documentElement`/`body` và cập nhật `height` của iframe. Không để iframe có thanh cuộn riêng.
- Thu phóng: thay `style={{ zoom: scale }}` ở `canvas-area.tsx` bằng bao ngoài có kích thước `frame.width*scale × contentHeight*scale` chứa phần tử bên trong `transform: scale(scale); transform-origin: 0 0`. Giữ `fitScale` và test hiện có của nó. Thanh cuộn của vùng Canvas phải đúng theo kích thước sau thu phóng.
- Xuất ra (từ `canvas-area.tsx` hoặc một context nhỏ trong `features/canvas/`) giá trị `scale` hiện tại để 1B đọc, không để 1B tự đoán.
- Ghi vào `spec-log.md`: "Canvas thu phóng bằng transform scale thay vì CSS zoom, để khớp thuật toán SPEC-04.1 mục 9.2 và VG-11".

### E. Rà từng loại node theo bảng SPEC-04.1 mục 7.2 và các quy tắc

Với mỗi mục, đọc `node-registry/*.tsx`, so với spec, sửa chỗ lệch và đảm bảo có test (đặt mã quy tắc trong tên test):

| Mã                                                | Yêu cầu                                                                                                                                                                                                                                                                                                                                         | Ghi chú                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| R-CV-01                                           | Container rỗng: khung nét đứt cao 48 px, chữ `canvas.emptyPlaceholder`.                                                                                                                                                                                                                                                                         | Đã có; giữ test. Khung này không xuất code (không cần làm gì thêm ở đây). |
| R-CV-02                                           | `hidden: true` không render.                                                                                                                                                                                                                                                                                                                    | Đã có; giữ test.                                                          |
| R-CV-04                                           | Ảnh lỗi/không tải được: ô xám có biểu tượng ảnh, kích thước theo thuộc tính. `asset:<tên>` đổi thành `/api/v1/workspace/assets/<tên>`.                                                                                                                                                                                                          | Kiểm tra `onError` và URL.                                                |
| R-CV-10                                           | Node `runtime.initiallyHidden`: vẫn hiện, mờ 50%, có nhãn "Ẩn khi tải trang" (khóa i18n mới).                                                                                                                                                                                                                                                   |                                                                           |
| 7.4                                               | `List`: mẫu render 3 lần, bản 2 và 3 có `data-rc-repeat` và mờ 60%.                                                                                                                                                                                                                                                                             | Đã có; giữ test.                                                          |
| 7.5                                               | `Modal` không `openByDefault`: ẩn trên Canvas **trừ khi đang được chọn** (đọc `selectedNodeId` từ store). Khi hiện: lớp phủ tối phủ khung + hộp ở giữa.                                                                                                                                                                                         | Code hiện chỉ xét `openByDefault`; thêm điều kiện "đang chọn".            |
| 7.2 `Table`                                       | 5 dòng dữ liệu mẫu cố định; chưa gắn dữ liệu thì 3 dòng trống có khung.                                                                                                                                                                                                                                                                         |                                                                           |
| 7.2 `Tabs`                                        | Hiện tab đầu mặc định; trạng thái tab đang mở là state cục bộ của Studio (không ghi model).                                                                                                                                                                                                                                                     |                                                                           |
| 7.6                                               | `ComponentInstance`: render `root` của component với `propValues`, đặt node trong `slots` vào đúng `Slot`. Node bên trong component **không** chọn được từ instance (đánh dấu để 1B bỏ qua: thêm thuộc tính `data-rc-inner="1"` cho node nằm trong phần thân component, **không** cho `data-rc-node`); node trong `slots` chọn được như thường. |                                                                           |
| 7.2 `Slot`                                        | Khi sửa component: khung nét đứt ghi tên slot.                                                                                                                                                                                                                                                                                                  |                                                                           |
| 7.2 `Icon`                                        | Spec: bộ Lucide đóng gói. Kiểm tra hiện đang vẽ gì. Nếu chưa có Lucide, **không tự thêm thư viện**; báo lại trong "Rủi ro".                                                                                                                                                                                                                     |                                                                           |
| 7.2 `Input/Textarea/Select/Checkbox/Radio/Switch` | Hiển thị đúng cấu trúc, không tương tác thật (chỉ đọc).                                                                                                                                                                                                                                                                                         |                                                                           |

R-CV-03 (dữ liệu mẫu theo binding và `contentLocale`) **không làm ở bước này**: hàm `generateMockRecords` chưa có (thuộc Phase 4, WP-4.07). Đừng tự bịa.

## Kiểm tra (dán kết quả thật)

1. `pnpm verify` mã thoát 0; số test tăng so với trước (ghi rõ số cũ/mới).
2. `pnpm build` rồi `pnpm test:e2e` xanh **trên cả Chromium, Firefox, WebKit**, gồm 7 kiểm tra ở việc A.
3. Tự chụp ảnh `all-nodes` ở frame 1440 và 375 (Playwright screenshot, lưu `test-results/canvas/`), xem bằng mắt: bố cục không vỡ. Nêu nhận xét ngắn trong báo cáo.
4. `pnpm lint` 0 cảnh báo; không có `eslint-disable` mới.

## Không được làm

- Không thêm Overlay, hover, chọn node (đó là 1B).
- Không tự gọi CDN, không nới CSP.
- Không đổi model/store/server.
- Không bỏ test cũ trong `canvas-renderer.test.tsx`; sửa cho khớp hành vi mới nếu cần, nói rõ lý do.
