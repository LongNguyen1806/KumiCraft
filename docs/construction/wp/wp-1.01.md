# WP-1.01 — Dọn hướng cũ, tạo `packages/shared`, thay spec

**Trạng thái:** Chờ commit  
**Người làm:** Claude  
**Spec:** SPEC-07 mục 3.1 (WP-1.01), SPEC-03 mục 3, 5.1 đến 5.3, 10; SPEC-02; SPEC-05

## Việc đã làm

1. **Xóa hướng Design Model:** `packages/model` (schema, operation, migration, preset, styling map), Design Store và watcher của server, các route `/workspace/*` (tài liệu, operation, reload, backup), Canvas dựng từ model, Overlay, kéo thả, Inspector, Layer Tree, Library, màn hình tạo workspace, màn hình lỗi có khôi phục backup, store và lịch sử của Studio, `fixtures/designs`, `fixtures/target-projects`, spike và script VG cũ (VG-09a, 10, 11, 14), E2E của Canvas, Inspector, Layer Tree, perf.
2. **`packages/shared` mới:** mã lỗi 1.0 (bỏ E004–E010, E022; thêm E023–E028), `Result`, cờ tính năng theo phase mới, `bandOf`/`editBreakpoint` (giữ thuật toán và test của 0.18), `RelPath` (V-100), schema `workspace.json` v2 (V-07, V-09, V-105, khung mặc định).
3. **Server:** đọc `.reactcraft/workspace.json` v2 (lỗi E003 `invalid`/`unsupportedVersion`, không ghi đè), `SessionInfo.project` theo SPEC-03 mục 5.1, `POST /project/trust`, tin cậy theo dấu vân tay backend (S-84), cấu hình người dùng mới (editor, package manager, agent; đọc được file 0.18 — V-107; không API key — V-108), bảng HTTP status mới. Giữ: bảo mật (token, Host/Origin, header), khóa phiên (quy tắc thành R-PJ-19), nhớ cổng, WebSocket, log.
4. **Studio:** màn hình "Chưa mở dự án", màn hình lỗi dự án, Editor gồm thanh công cụ, panel co giãn, Canvas chờ (WP-1.04), thanh trạng thái tin cậy; hộp thoại tin cậy theo dự án; Cài đặt có ngôn ngữ, editor, package manager; bản dịch `vi`/`en` viết lại; sửa lỗi hộp thoại thừa hưởng `whitespace-nowrap` của thanh công cụ (chữ bị cắt).
5. **Repo:** `docs/spec.md` thay bằng bản 1.0 (Prettier định dạng), thêm R-PJ-19; `scripts/trace.mjs` nhận ô mã có khoảng trắng đệm; `trace-scope.json` theo mã 1.0; scope commitlint mới; ESLint cho `shared`; Vitest, ngưỡng độ phủ; `playwright.config.js` có `actionTimeout` 15 s; VG-12 viết lại cho màn hình mới và thêm phép kiểm chữ bị khung cắt; tài liệu thi công 0.18 chuyển vào `archive-0.18/`.

## Kiểm chứng

| Lệnh                            | Kết quả                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm verify`                   | Mã thoát 0; Vitest 28 file, 143 test xanh; `trace` phase 0: 32/32 mã         |
| `pnpm test --coverage`          | 94,06 % dòng, đạt mọi ngưỡng SPEC-02 mục 9                                   |
| `pnpm test:e2e` (3 trình duyệt) | 24/24 xanh (khởi động, ngôn ngữ, token, không dự án, tin cậy, file cũ, E018) |
| `node scripts/vg/vg-12.mjs`     | 30/30 màn hình sạch (`vi`, `en`, 1024 và 1440 px)                            |

## Lệch spec

`spec-log.md` #1 đến #5.

## Commit gợi ý

Xem tin nhắn bàn giao của Claude (hai commit: code và tài liệu).
