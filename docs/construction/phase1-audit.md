# Rà soát Phase 1 (2026-10-16)

Cách làm: `pnpm trace` với `currentPhase: 1` liệt kê **95 mã** Phase 1 chưa có test gắn tag. Với từng mã, đọc quy tắc trong `docs/spec.md` rồi tìm bằng chứng trong code và test (file:dòng). Chỉ đọc, không sửa code. Mã nào chưa đủ bằng chứng ghi "cần xác minh", không coi là lỗi.

Phân loại:

- **(a)** Đã có test kiểm đúng quy tắc, chỉ thiếu hoặc sai dạng tag (ví dụ `[R-RN-06, Test 1]`, `R-TX-02: …`, `[SPEC-04 R-IN-18]` làm `trace` không đọc được).
- **(b)** Code đã làm, chưa có test.
- **(c)** Chưa làm hoặc làm khác spec.
- **(d)** Lệch có chủ đích, ghi spec-log, không sửa code.
- **(p)** Quy tắc hiệu năng, đo ở cổng G1-03 (PB).

## 0. Đã xử lý (2026-10-16)

- **R-HI-08**: đóng dự án và mở dự án khác đều xóa lịch sử (`project-service.ts`), test `project-service-watch.test.ts`.
- **S-100**: iframe Canvas có `sandbox` đúng spec (`canvas-area.tsx`), test `canvas-area.test.tsx`.
- **S-104**: runner ép `cors: false` (`runners/vite-server-config.ts`), test `vite-server-config.test.ts`.
- **V-114**: nonce 22 ký tự (`runner-service.ts`), test trong `runner-service.test.ts`.
- **S-36**: logger Fastify che thêm `*.token`; logger server đã che `token` (test `create-logger.test.ts` gắn thêm `[S-36]`).
- **R-FW-05**, **R-QA-01**: chuyển sang (d), ghi spec-log.
- Sửa tag: R-RN-05, R-RN-06, R-RN-01 (`, Test n` bỏ), S-105.
- **S-13**: luật ESLint chặn `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` trong Studio; test lint trên code thật `studio/src/security/no-html-injection.test.ts`.
- **S-102**: Studio không đọc `contentDocument` của iframe nữa; đổi chế độ Thiết kế/Xem thử chỉ gửi `set-mode`, không gỡ kênh (trước đây có thể làm mất kênh vì iframe khác origin). Code iframe chuyển sang `editor/canvas-frame.tsx`.
- **R-RN-21**: iframe mở đúng trang đang xem khi tải lại; **R-RN-22** đổi khung không tải lại; dev server khởi động lại thì iframe mới (khóa theo origin, nonce).
- **R-RN-24**: dải cảnh báo khi Bridge im lặng 10 s, nút xem log.
- **R-RN-26**: thanh công cụ Canvas hiện đường dẫn trang.
- **R-SL-10**: cây mới bỏ ref đã mất, phần tử chính là ref còn lại sau cùng; cây bị cắt (V-113) giữ nguyên vùng chọn.
- **R-HI-10**: lỗi Undo/Redo trước đây không hiện ở đâu; giờ thanh công cụ hiện câu đã dịch (vi, en) kèm nút đóng.
- **R-IN-20**: ô Inspector đang có tiêu điểm giữ giá trị đang gõ, rời ô mới hiện giá trị nguồn.
- **V-112**: Bridge không gửi thông điệp quá 1 MB (đếm byte UTF-8).

Còn mở sau đợt này:

- **R-IN-19** (chưa làm): ô màu, cỡ chữ, bo góc, bóng, font chưa ưu tiên token `@theme` và bảng màu; cần một gói giao diện riêng.
- **R-PJ-24** (thiếu một phần): thanh công cụ chưa hiện trạng thái dev server; cần dùng chung luồng trạng thái runner (hiện mỗi nơi gọi `useRunnerStatus` mở một WebSocket).
- **R-SE-16**, **R-SL-12**: quyết theo bài đo PB-03, PB/R-SL-12.
- Mục 3 (sửa tag) và mục 4 (viết test) còn lại, cổng G1.

## 1. Tóm tắt

| Loại                    | Số mã | Việc cần làm                                    |
| ----------------------- | ----- | ----------------------------------------------- |
| (c) chưa làm / làm khác | 19    | Sửa nhỏ trong đúng module, mỗi chỗ có test      |
| (a) chỉ sửa tag         | 24    | Sửa tên test, không đổi nội dung                |
| (b) thiếu test          | 45    | Viết test kiểm **code thật** theo mô tả ở mục 4 |
| (d) lệch có chủ đích    | 1     | Ghi spec-log                                    |
| (p) hiệu năng           | 6     | Bài đo PB                                       |

Không có phát hiện nào cần viết lại module. Phase 1 về cơ bản đã đủ tính năng; phần thiếu là các chỗ nhỏ ở mục 2 và test.

## 2. (c) Chưa làm hoặc làm khác spec, xếp theo mức nghiêm trọng

| Mã      | Mức          | Bằng chứng                                                                                                                                                                                                         | Việc sửa (ước lượng)                                                                |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| R-HI-08 | **Cao**      | `routes/project.ts:93` `close()` không xóa lịch sử; `historyService.clear()` chỉ gọi khi tắt server (`server/src/index.ts:379,396`). Mở dự án B sau A rồi Undo có thể ghi nội dung của A vào file cùng tên trong B | Xóa lịch sử khi đóng dự án và khi mở dự án khác (~10 dòng)                          |
| S-100   | **Cao**      | `studio/.../editor/canvas-area.tsx:418` iframe không có `sandbox`                                                                                                                                                  | Thêm `sandbox` đúng chuỗi spec (~1 dòng)                                            |
| S-104   | Vừa          | `server/src/runners/vite-react.ts:81` không đặt `server.cors = false`, `host` lấy từ options                                                                                                                       | Ép `host: '127.0.0.1'`, `cors: false` (~2 dòng)                                     |
| S-13    | Vừa          | `eslint.config.js` không có luật chặn `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write`                                                                                               | Thêm `no-restricted-syntax`/`no-restricted-properties` (~10 dòng)                   |
| V-112   | Vừa          | Bridge không giới hạn 1 MB mỗi thông điệp (`bridge-client-runtime.ts:155` gửi thẳng)                                                                                                                               | Đo kích thước JSON trước khi gửi, quá thì bỏ và ghi `console.warn` (~10 dòng)       |
| S-36    | Vừa          | `create-http-app.ts:52` `redact` thiếu `*.token`                                                                                                                                                                   | Thêm đường dẫn (~1 dòng)                                                            |
| R-IN-20 | Vừa          | Làm mới khi `project.filesChanged` đã có (`use-inspector-target.ts`), nhưng không có chặn "ô đang có tiêu điểm không bị ghi đè"                                                                                    | Giữ giá trị ô đang focus tới khi blur (~20 dòng)                                    |
| R-SL-10 | Vừa          | `selection-store.ts:47` `setTree` không bỏ ref đã mất khỏi cây                                                                                                                                                     | Lọc `selectedRefs` theo cây mới, giữ phần tử chính (~15 dòng)                       |
| R-RN-24 | Vừa          | Không có cảnh báo khi iframe tải xong mà 10 s không nhận `ready`                                                                                                                                                   | Hẹn giờ trong Canvas, dải cảnh báo + nút xem log (~30 dòng)                         |
| R-HI-10 | Thấp         | `studio/.../history/history-store.ts:39-40` câu báo viết cứng tiếng Việt, giao diện `en` vẫn hiện tiếng Việt                                                                                                       | Đưa vào i18n (~6 dòng)                                                              |
| R-RN-21 | Thấp         | `canvas-area.tsx:418` `src` luôn là `origin + '/'`, không theo trang hiện tại                                                                                                                                      | Dùng `route` hiện tại (~3 dòng)                                                     |
| R-RN-26 | Thấp         | Thanh công cụ Canvas có chọn khung, thu phóng, chưa hiện đường dẫn trang                                                                                                                                           | Hiện `route` (~8 dòng)                                                              |
| R-FW-05 | Thấp         | `project-workspace-file.ts` đọc `workspace.json` có sẵn mà không so `framework` với kết quả phát hiện                                                                                                              | So và ghi lại khi khác (~10 dòng)                                                   |
| S-102   | Thấp         | `canvas-area.tsx:382` đọc `iframe.contentDocument?.readyState` (khác origin nên trả `undefined`, nhưng trái quy tắc)                                                                                               | Bỏ, chỉ dựa vào sự kiện `load` (~3 dòng)                                            |
| V-114   | Thấp         | `runner-service.ts:293` `nanoid()` cho 21 ký tự, spec ghi 22                                                                                                                                                       | `nanoid(22)` (~1 dòng)                                                              |
| R-SE-16 | Thấp         | Source Editor không có cache phân tích LRU 50 file (chỉ `component-usages.ts:173` có cache riêng)                                                                                                                  | Thêm cache theo (file, hash) (~30 dòng) hoặc ghi lệch nếu PB-03 đạt không cần cache |
| R-IN-19 | Cần xác minh | Không thấy ô màu/cỡ chữ ưu tiên token `@theme` trong `features/inspector`                                                                                                                                          | Đọc `property-field.tsx` và `property-groups-config.ts` để kết luận trước khi giao  |
| R-PJ-24 | Cần xác minh | Tên dự án có trên thanh công cụ; trạng thái dev server có thể nằm ở thanh trạng thái                                                                                                                               | Xem giao diện thật; nếu ở thanh trạng thái thì ghi lệch (d)                         |
| R-SL-12 | Cần đo       | Layer Tree không ảo hóa danh sách (`useVirtualizer` không có)                                                                                                                                                      | Đo với 5.000 nút trước; chỉ sửa nếu chậm                                            |

## 3. (a) Đã có test, chỉ sửa tag

| Mã                                       | Test hiện có                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| R-RN-05, R-RN-06                         | `server/src/core/runner/runner-service.test.ts` tên có `[R-RN-0x, Test 1]` → bỏ `, Test 1`                                   |
| R-RN-03                                  | `server/src/runners/vite-react.test.ts` (chạy Vite thật)                                                                     |
| R-RN-20                                  | `studio/.../editor/canvas-area.test.tsx` "renders untrusted prompt…", "renders iframe when runner is ready"                  |
| R-TX-02, R-TX-08                         | `bridge/src/client/text-edit.test.ts` tên bắt đầu `R-TX-02:`                                                                 |
| R-TW-01, R-TW-02                         | `shared/src/tailwind/tokenizer.test.ts` `describe('… [SPEC-04 section 8, R-TW-01, R-TW-02]')`                                |
| R-TW-03 đến R-TW-09, R-TW-11             | `shared/src/tailwind/model.test.ts` các "Scenario" (đối chiếu số kịch bản với bảng kiểm thử M-TW trong spec rồi gắn đúng mã) |
| R-IN-13, R-IN-14, R-IN-20 (phần làm mới) | `studio/.../inspector/use-live-edit.test.ts` `describe('useLiveEdit [SPEC-04 R-IN-13, …]')`                                  |
| R-IN-11, R-IN-15                         | `inspector-panel.test.tsx` "Scenario 2" (nhãn kế thừa), "Scenario 5" (khóa khi `expression`)                                 |
| R-IN-18                                  | `tag-attributes-section.test.tsx`, `use-attribute-edit.test.ts` (`describe` đang ghi `[SPEC-04 R-IN-18]`)                    |
| R-BR-13                                  | `bridge-client-runtime.test.ts` test chặn click ở chế độ Thiết kế (dùng `clickIsIntercepted`)                                |
| R-BR-18                                  | `bridge-client-runtime.test.ts` test gửi `shortcut`                                                                          |
| R-BR-30                                  | `studio/.../selection/bridge-channel.test.ts` test bỏ thông điệp sai nguồn/origin/nonce                                      |
| R-PJ-15                                  | `server/src/core/project/project-lifecycle.test.ts` test mở dự án chưa tin cậy                                               |
| R-PJ-16                                  | `project-service-watch.test.ts` test S-84 (`workspace.json` đổi ngoài)                                                       |
| R-PJ-20                                  | `project-dialog.test.tsx` "renders directory browser and probes initial path"                                                |
| S-54                                     | `project-install-job.test.ts` "a wrong command fails at once"                                                                |
| V-60                                     | `server/src/core/jobs/job-service.test.ts` kiểm `stepKey: 'jobs:install.running'`                                            |
| S-14                                     | `studio/.../canvas-errors/build-error-banner.test.tsx` test chuỗi `<img onerror>` hiện dạng chữ                              |

## 4. (b) Code đã làm, thiếu test

Mỗi dòng ghi **hành vi phải kiểm trên code thật**. Test chỉ kiểm hằng số, biến của chính test, hay `typeof` là không đạt.

| Mã            | Code                                                   | Test phải kiểm                                                                                         |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| R-BR-10       | `bridge/src/client/entry.ts:24`                        | Khi `window.parent === window` không tạo runtime, không gửi `ready`                                    |
| R-BR-11       | `overlay.ts:76,90`                                     | Host có shadow root (đóng), style đúng; xóa host khỏi DOM thì được gắn lại                             |
| R-BR-12       | `bridge-client-runtime.ts` `scheduleTreeScan`          | Thêm phần tử `data-rc-loc` → sau 100 ms có **thêm** đúng 1 tin `tree` chứa phần tử mới                 |
| R-BR-14       | `bridge-client-runtime.ts:246`                         | Click lên phần tử con không có `data-rc-loc` → `select` mang ref của tổ tiên gần nhất có `data-rc-loc` |
| R-BR-15       | `overlay.ts:147`                                       | Nhiều lần cập nhật trong một khung → vẽ một lần trong `requestAnimationFrame` (spy rAF)                |
| R-BR-20       | runtime `handleSelectMessage`                          | `select` `reveal: true` → `scrollIntoView({block:'nearest',inline:'nearest'})` trên phần tử chính      |
| S-101         | `bridge-channel.ts:211`, runtime `:155`                | `postMessage` được gọi với đúng origin, không bao giờ `'*'`                                            |
| S-103         | `bridge/src/integrations/vite.ts:53`                   | Plugin có `apply: 'serve'` (và VG/E2E: bản build không có `data-rc-loc`)                               |
| S-105         | `runner-service.ts:99`                                 | `start()` khi chưa tin cậy → E011 `untrusted`, không spawn                                             |
| R-RN-08, V-71 | `runner-service.ts:55-58,72`                           | Dòng > 2.000 ký tự bị cắt; giữ 500 dòng cuối cho E025                                                  |
| R-RN-22       | `canvas-area.tsx`                                      | Đổi khung → iframe đổi `width/height`, `src` không đổi                                                 |
| R-RN-23       | `canvas-area.tsx:143,377`                              | Mặc định Thiết kế; bấm nút gửi `setMode('preview')` qua channel                                        |
| R-IN-10       | `inspector-panel.tsx:263`                              | Chọn 2 phần tử → `selected-multiple-message` có số 2, không gọi `fetchElementSource`                   |
| R-IN-12       | `inspector-header.tsx`                                 | Chọn Hover → tiền tố ghi thành `hover:`                                                                |
| R-IN-16       | `inspector-header.tsx:58-60`                           | `usages > 1` → dải "dùng ở N chỗ"; `inLoop` → dải "Lặp N lần"                                          |
| R-IN-17       | `other-classes-section.tsx:26,34`                      | Sửa ô "Chuỗi class", Enter → gọi ghi cả chuỗi                                                          |
| R-SL-05       | `selection-store.ts`                                   | Chọn A rồi Shift+B → `selectedRefs` = [A, B], phần tử chính là B                                       |
| R-PJ-01       | `core/project/probe.ts`                                | Thư mục không tồn tại có cha → `missing`, `canCreate`; thư mục trống → `empty`                         |
| R-PJ-06       | `project-install.ts` `checkNeedsInstall`               | Có/thiếu `node_modules/vite/package.json`, `react/package.json`                                        |
| R-PJ-09       | `detect-responsive.ts`                                 | Nhiều `max-` hơn → `desktop-first`; ngược lại `mobile-first`                                           |
| R-PJ-14       | `project-backends.ts`                                  | Trùng backend → E016 `duplicateBackend`; backend thứ 11 → E016                                         |
| R-PJ-17       | `theme.ts`                                             | `@theme inline` được đọc; bỏ `--text-*--line-height`                                                   |
| R-PJ-21       | `project-dialog-probe-view.tsx:54`                     | Dự án không hỗ trợ → danh sách lý do dịch theo `reason`                                                |
| R-PJ-23       | `backends-view.tsx`                                    | Danh sách nhãn/đường dẫn/trạng thái; gỡ có xác nhận                                                    |
| R-SE-03       | `source-editor-service.ts`                             | Mỗi `reason` của E023 có ít nhất một ca                                                                |
| R-SE-09       | `source-editor` (thụt lề)                              | File dùng tab → chèn bằng tab; file 4 dấu cách → bậc 4                                                 |
| R-SE-17       | `source-editor`                                        | Mọi byte ngoài đoạn sửa giữ nguyên (so từng byte)                                                      |
| R-TW-10       | `shared/src/tailwind`                                  | `[13px_auto]` đọc ra `13px auto`; ghi ngược lại                                                        |
| R-FW-03       | toàn repo                                              | Test quét: không file nào ngoài 3 thư mục cho phép so sánh `FrameworkId`/`'vite-react'`                |
| R-FW-04       | `bridge/src/transform`, `client`                       | Test quét import: `transform/` không import Vite, `client/` không import React                         |
| R-QA-02       | `e2e/support/cli-session.ts`                           | E2E khởi động CLI với `REACTCRAFT_CONFIG_DIR` (và DATA, CACHE) trỏ thư mục tạm                         |
| R-QA-04       | `scripts/trace.mjs`                                    | Test chạy trace trên một spec/test mẫu nhỏ: mã có tag được đếm, mã thiếu bị báo                        |
| S-25          | `adapters/fs/node-file-system.ts:70`                   | Liệt kê thư mục có symlink trỏ ra ngoài → không đi theo                                                |
| S-26          | `core/shared/paths.ts`                                 | Vi phạm → E012 và log `warn` có đường dẫn chuẩn hóa                                                    |
| S-28, S-83    | `checkBlockedPath`, `computeBackendInfos`              | Ổ đĩa gốc, home, `C:\Windows`, `/etc` bị từ chối; backend vi phạm → `status: 'blocked'`                |
| S-50, S-52    | `adapters/system/node-process.ts`, các nơi gọi `spawn` | Runner, cài đặt chạy với `cwd` = gốc dự án; mở editor không đặt `cwd`                                  |
| S-55          | `project-install.ts`, `runner-service.ts`              | Cài đặt `timeoutMs: 600000`; dev server 60 s; hủy dừng cả cây                                          |
| S-86          | `tokenizer`, `detect-responsive`                       | Chuỗi 1 MB xử lý ≤ 100 ms (đặt ở bài đo, không ở unit test thường)                                     |
| S-87          | `create-http-app.ts:49`                                | Body > 10 MB → E016, không parse                                                                       |
| V-81          | `shared/src/result.ts` `ERROR_CODES`                   | Không chứa E004–E010, E022                                                                             |
| V-106         | `core/workspace/read-workspace.ts`                     | `workspace.json` > 1 MB hoặc sâu > 64 → lỗi đúng mã                                                    |

## 5. (d) Lệch có chủ đích

| Mã      | Lệch                                                                                                                                           | Ghi spec-log                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| R-QA-01 | Fixture không nằm trong pnpm workspace; test chép sang thư mục tạm và liên kết `node_modules` tới gói của repo (`e2e/support/copy-fixture.ts`) | Có. Cách này chạy được cho Vite 8/React 19; với Vite 7 (VG-15) cần quyết lại |

## 6. (p) Hiệu năng, đo ở cổng G1-03

R-BR-15 (≤ 16 ms/khung), R-IN-21 (≤ 500 ms P95), R-SL-12 (5.000 nút), R-HI-10 không thuộc nhóm này. S-86 (1 MB ≤ 100 ms), R-SE-16 (gắn với PB-03), cùng PB-01 đến PB-05.

## 7. Cổng G1 còn lại

| Mục                                   | Trạng thái                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------- |
| G1-01 E2E AC × 3 trình duyệt × vi, en | **Đạt** (72 test, lượt 3 phần A)                                           |
| G1-01 trace Phase 1                   | Chưa: cần làm xong mục 2, 3, 4                                             |
| G1-02 VG-15                           | Chưa: cần fixture Vite 7 + React 18 + JS (chủ dự án quyết thêm dependency) |
| G1-02 VG-16                           | Chưa chạy: `scripts/vg/vg-16.mjs` có sẵn                                   |
| G1-03 PB-01 đến PB-05                 | Chưa có bài đo                                                             |
| G1-04 nghiệm thu tay Windows, macOS   | Chủ dự án làm                                                              |

## 8. Gói việc đề xuất (theo module, theo thứ tự, mỗi gói đóng hẳn phần của nó)

| Gói | Module                               | Nội dung                                                                         | Ai                                 |
| --- | ------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------- |
| G1  | Server                               | R-HI-08, S-104, S-36, V-114, R-FW-05 (sửa + test) và (a), (b) của server, shared | Claude viết test trước, Gemini sửa |
| G2  | Studio Canvas                        | S-100, S-102, R-RN-21, R-RN-24, R-RN-26 (sửa + test) và (a), (b) của Canvas      | Gemini, theo bảng                  |
| G3  | Bridge                               | V-112 (sửa + test) và (a), (b) của Bridge                                        | Gemini, theo bảng                  |
| G4  | Studio Inspector, vùng chọn, lịch sử | R-IN-20, R-SL-10, R-HI-10 (sửa + test), xác minh R-IN-19, (a), (b) phần này      | Gemini, theo bảng                  |
| G5  | Công cụ                              | S-13 (luật ESLint), R-QA-04 (test cho trace), R-FW-03/04 (test quét)             | Gemini                             |
| G6  | Cổng                                 | VG-16, PB-01 đến PB-05, VG-15 (sau khi chủ dự án quyết)                          | Gemini, Claude QA                  |

Quy tắc cho mọi gói: chỉ sửa file trong module của gói; không đổi hợp đồng (kiểu, API, sự kiện); code đang chạy đúng thì không tách, không viết lại; test phải đỏ nếu bỏ phần code nó kiểm.
