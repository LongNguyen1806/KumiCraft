# Tiến độ thi công

Cập nhật: 2026-10-11 · Spec: phiên bản 0.18 · Phase hiện tại: 0 → bắt đầu 1 · Chế độ: **local** (SPEC-07 mục 12.6)

Trạng thái theo module: [modules.md](modules.md). Lệch và thiếu so với Spec: [spec-log.md](spec-log.md).

## Cách làm việc hiện hành

- Repo Git chỉ trên máy chủ sản phẩm, chưa lên GitHub. Chủ sản phẩm tự commit; Claude không ghi vào `.git`.
- Claude chia việc thành phần nhỏ, báo trước phần đang làm, mỗi bộ thay đổi thuộc một module.
- Spec chưa hoàn thiện nên không chặn thi công. Mọi chỗ lệch hoặc Spec còn thiếu ghi vào [spec-log.md](spec-log.md) để bổ sung Spec sau.
- Kiểm tra local: `pnpm verify` (lint, typecheck, format, `check:i18n`, unit test, `trace`, build), `pnpm test:e2e`, `pnpm fixtures:check`.

## Kiểm tra gần nhất (2026-10-12, Windows 11, Node 22.19.0)

| Lệnh                    | Kết quả                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm verify`           | Đạt: 36/36 test files (236 tests xanh 100%), lint 0/0, typecheck, format, trace 14/14, build |
| `pnpm test:e2e`         | Đạt: 8/8 (Chromium, Firefox)                                                                 |
| `node scripts/vg/*.mjs` | 7/7 script chạy và báo Đạt (xem đánh giá ở bảng VG bên dưới)                                 |

## Tổng quan phase

| Phase                      | Trạng thái   | WP xong / tổng | Cổng           |
| -------------------------- | ------------ | -------------- | -------------- |
| 0 — Nền móng               | Gần xong     | 8 / 10         | `G0`: chưa đạt |
| 1 — Studio Core            | Đang làm     | 4 / 11         | `G1`           |
| 2 — Xuất code và tương tác | Chưa bắt đầu | 0 / 13         | `G2`           |
| 3 — AI                     | Chưa bắt đầu | 0 / 8          | `G3`           |
| 4 — Ngữ cảnh backend       | Chưa bắt đầu | 0 / 12         | `G4`           |
| 5 — Nâng cao và phát hành  | Chưa bắt đầu | 0 / 7          | `G5`           |

Phase 1 bắt đầu song song với phần còn lại của Phase 0 (chủ sản phẩm đồng ý 2026-10-11): WP-1.01 là model thuần, không phụ thuộc VG-11, VG-14.

## Phase 0: gói công việc

| WP      | Tên                         | Trạng thái   | Còn lại                                                                                                                  |
| ------- | --------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| WP-0.01 | Khởi tạo repo               | Xong (local) | Bước GitHub hoãn                                                                                                         |
| WP-0.02 | CI                          | Xong (local) | Chạy thật khi lên GitHub                                                                                                 |
| WP-0.03 | Khung 4 package             | Xong         | —                                                                                                                        |
| WP-0.04 | Nền bảo mật mạng            | Xong         | Phần WebSocket của S-07 làm cùng `/api/v1/events` (WP-1.05)                                                              |
| WP-0.05 | Hạ tầng i18n                | Xong         | Lưu ngôn ngữ vào cấu hình người dùng (WP-1.05)                                                                           |
| WP-0.06 | Hạ tầng kiểm thử, SPEC-06.0 | Xong         | SPEC-06.0 đã có trong Spec (bản nháp)                                                                                    |
| WP-0.07 | Fixture ban đầu             | Xong         | 2 target project, `all-nodes.json` (qua `checkDocument`, phủ đủ schema), `pnpm gen:large-workspace` (xác định theo seed) |
| WP-0.08 | Spike VG-01, VG-07          | Xong         | —                                                                                                                        |
| WP-0.09 | Spike Studio                | Đang làm     | Làm lại VG-11 (trước WP-1.08), VG-14 (trước Phase 2); báo cáo VG-12                                                      |
| WP-0.10 | Chuyển tài liệu vào repo    | Xong         | —                                                                                                                        |

## Verification Gate

| VG                           | Kết quả       | Đánh giá                                                                      |
| ---------------------------- | ------------- | ----------------------------------------------------------------------------- |
| VG-01 Ghi file Windows       | Đạt           | Dùng `write-file-atomic` thật                                                 |
| VG-07 Server local           | Đạt           | Server thật; P95 batch 6,8 ms (ngân sách 20 ms)                               |
| VG-09A Canvas khớp code      | Đạt           | Tailwind runtime so với bản build bằng engine thật                            |
| VG-10 Tailwind runtime       | Đạt           | `@tailwindcss/browser` thật, chạy offline                                     |
| VG-11 Kéo thả trong iframe   | **Làm lại**   | Spike dùng bộ kéo thả tự viết, chưa kiểm `@dnd-kit` (spec-log #17)            |
| VG-12 Đầy đủ bản dịch        | Thiếu báo cáo | Công cụ đã chạy trong `verify` (spec-log #19)                                 |
| VG-13 React Compiler         | Đạt           | Bundle có mã của compiler; build, unit, E2E đạt. Chưa so PB-14 khi bật và tắt |
| VG-14 Rich text trong iframe | **Làm lại**   | Không dùng TipTap; gõ Unikey/EVKey chưa thử tay (spec-log #18)                |

## Phase 1: gói công việc

| WP           | Tên                                                                  | Trạng thái                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WP-1.01      | Model: schema Zod đầy đủ, quy tắc V-xx                               | Xong (83 test model). V-29, V-33 dời sang WP-1.02 (spec-log #28)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| WP-1.02      | Model: mọi operation, `applyBatch`, `assignIds`, dạng phẳng          | Xong: 24 loại operation; property test 400 + 150 lượt (`apply(invert(op))`); PB-01 trung bình 2,1 ms, p99 4,0 ms (ngân sách 5 ms)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| WP-1.03      | Model: khung migration, `serializeCanonical`                         | Xong: ghi hai lần giống từng byte (kể cả sau khi đọc lại); pipeline migration chạy với 1 → 1 rỗng và chuỗi giả 0 → 1 → 2; tách và ghép file `.reactcraft/`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| WP-1.04      | Model: M-TK, M-SM (Styling Map, toTailwindClasses, generateThemeCss) | Xong: Đủ bảng 5.3 cả v4 và v3, desktop-first và mobile-first, states, runtime hidden, 9 nhóm class (R-SM-01), V-29 normalizeResponsive, R-SM-05. 23 test styling đạt.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| WP-1.05      | Server API, Design Store (M-DS), WebSocket Events & Watcher          | Xong: DesignStore (debounce 500 ms, tối đa 2 s, giữ 20 bản sao lưu), route workspace và `/settings`, WebSocket `/api/v1/events`, theo dõi file (R-DS-11). Test khởi động lại: tạo → sửa → tắt → mở lại còn nguyên. PB-02 1,8 ms, PB-03 24 ms. Sửa lỗi revision không lưu xuống `workspace.json` (spec-log #60)                                                                                                                                                                                                                                                                                                   |
| WP-1.06      | Studio: Welcome, Editor, Settings, Undo/Redo                         | Đang làm. Xong: client HTTP/WS, editor store, undo/redo; hướng giao diện đã duyệt (spec-log #64); B0 token và font; B1 chọn màn hình theo trạng thái workspace, lớp phủ mất kết nối; B2 form Welcome tạo workspace (đã chạy thật trên bản build). B3 màn hình lỗi workspace (đã chạy thật); B4 khung Editor: thanh công cụ, panel ẩn hiện và kéo giãn được, thanh trạng thái, Undo/Redo đúng mục 13, giữ lịch sử khi F5, nhớ cổng; chạy được trên Windows và macOS (phím tắt theo máy, Safari/WebKit, gói cài thử `pnpm package`); B5 Cài đặt (ngôn ngữ và tùy chọn xuất code được nhớ). Còn: B6 tin cậy, B7 E2E |
| WP-1.07–1.11 | Theo SPEC-07 mục 5.2                                                 | Chưa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Việc chờ chủ sản phẩm

| #   | Việc                                      | Chặn                 |
| --- | ----------------------------------------- | -------------------- |
| 1   | Duyệt Spec (khi tiện)                     | Đóng `G0` chính thức |
| 2   | Thử tay gõ Unikey/EVKey khi làm lại VG-14 | VG-14                |

## Rủi ro đang mở

| #   | Vấn đề                                  | Hướng xử lý                                                                 |
| --- | --------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `@dnd-kit` xuyên iframe chưa kiểm chứng | Làm lại VG-11 trước WP-1.08; nếu không đạt, xử lý theo SPEC-07 mục 14       |
| 2   | TipTap trong iframe, gõ tiếng Việt      | Làm lại VG-14 trước Phase 2                                                 |
| 3   | Chỉ kiểm tra trên Windows, Node 22      | Ubuntu, macOS, Node 24 kiểm khi bật CI, bắt buộc trước lần phát hành đầu    |
| 4   | `oxc-transform-react` còn mới (0.x)     | Đường lui sang compiler Babel đã ghi trong `packages/studio/vite.config.ts` |

## Bước tiếp theo

1. WP-1.06 (M-SH, M-HS): Studio Welcome, Editor, Settings, Undo/Redo.
2. WP-1.07 (M-CV, M-OV): Canvas Renderer (iframe, portal, Tailwind runtime, 25 loại node), Overlay hover/selection.
3. Làm lại VG-11 trước WP-1.08; VG-14 trước Phase 2.
