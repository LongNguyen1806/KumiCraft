# Tiến độ thi công

Cập nhật: 2026-10-11 · Spec: phiên bản 0.18 · Phase hiện tại: 0 — Nền móng · Chế độ: **local** (SPEC-07 mục 12.6)

Báo cáo theo mẫu SPEC-07 mục 19.4. Trạng thái theo module: [modules.md](modules.md).

## Cách làm việc hiện hành

- Repo Git chỉ trên máy chủ sản phẩm, chưa lên GitHub (SPEC-07 mục 12.6.1).
- Claude chia việc thành phần nhỏ, báo trước phần đang làm, mỗi bộ thay đổi thuộc một module. Chủ sản phẩm tự commit; Claude không ghi vào `.git` (CW-43).
- Kiểm tra local: `pnpm verify` (lint, typecheck, format, `check:i18n`, unit test, `trace`, build) và `pnpm test:e2e`.

## Kiểm tra gần nhất (2026-10-11)

| Lệnh                  | Kết quả                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `pnpm verify`         | Đạt: lint, typecheck, format, `check:i18n`, 35/35 unit test, trace 14/14, build |
| `pnpm test:e2e`       | Đạt: 8/8 (Chromium, Firefox)                                                    |
| `pnpm fixtures:check` | Đạt: 2/2 target project build được                                              |

Môi trường: Windows 11, Node 22.19.0, pnpm 10.34.6.

## Trạng thái commit

| Commit    | Nội dung                                                |
| --------- | ------------------------------------------------------- |
| `c0b394b` | Bộ khởi tạo repo `CS-0.01-1` và tài liệu `CS-0.10-1`    |
| `afc9c0d` | Commit rỗng "Test" (trước khi cài hook), không đổi file |
| `24c6de6` | Spec 0.18 (rà soát nhất quán) và báo cáo bước khởi tạo  |

**Chưa commit:** toàn bộ code Phase 0 làm sau `24c6de6` (phần 1 đến 8: server, Studio, CLI, `pnpm dev`/`build`, bảo mật mạng, i18n, hạ tầng kiểm thử, project mẫu) và các báo cáo này. Commit theo thứ tự dưới đây (mỗi dòng một commit; hook kiểm định dạng message):

```sh
git add tsconfig.base.json package.json pnpm-lock.yaml eslint.config.js .github scripts/dev.mjs scripts/not-implemented.mjs e2e/.gitkeep fixtures/target-projects/.gitkeep
git commit -m "build(repo): add dev, build, test and i18n scripts, lint rules and ci jobs" -m "Refs: SPEC-07 WP-0.02 to WP-0.06, M-RP"
git add packages/model && git commit -m "feat(model): add feature flags by phase" -m "Refs: SPEC-07 section 3.4, M-MC"
git add packages/server && git commit -m "feat(server): add fastify app, session endpoint and network security" -m "Refs: SPEC-07 WP-0.03, WP-0.04, SPEC-05 S-01 to S-12, M-SV"
git add packages/studio scripts/check-i18n.mjs && git commit -m "feat(studio): add vite app with session token and vi, en translations" -m "Refs: SPEC-07 WP-0.03 to WP-0.05, M-ST"
git add packages/cli && git commit -m "feat(cli): start server, pick port and open studio with session token" -m "Refs: SPEC-07 WP-0.03, ADR-BE-03, M-CL"
git add vitest.config.js playwright.config.js e2e scripts/trace.mjs scripts/trace-scope.json scripts/vg fixtures && git commit -m "test(e2e): add vitest, playwright, trace and target project fixtures" -m "Refs: SPEC-07 WP-0.06, WP-0.07, M-QA"
git add docs && git commit -m "docs(docs): record phase 0 construction progress" -m "Refs: SPEC-07 section 12.5"
```

## Tổng quan phase

| Phase                      | Trạng thái   | WP xong / tổng | Cổng           |
| -------------------------- | ------------ | -------------- | -------------- |
| 0 — Nền móng               | Đang làm     | 5 / 10         | `G0`: chưa đạt |
| 1 — Studio Core            | Chưa bắt đầu | 0 / 11         | `G1`           |
| 2 — Xuất code và tương tác | Chưa bắt đầu | 0 / 13         | `G2`           |
| 3 — AI                     | Chưa bắt đầu | 0 / 8          | `G3`           |
| 4 — Ngữ cảnh backend       | Chưa bắt đầu | 0 / 12         | `G4`           |
| 5 — Nâng cao và phát hành  | Chưa bắt đầu | 0 / 7          | `G5`           |

## Phase 0: gói công việc

| WP      | Tên                                      | Trạng thái   | Ghi chú                                                                                                                        |
| ------- | ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| WP-0.01 | Khởi tạo repo                            | Xong (local) | [wp-0.01](wp/wp-0.01.md). Bước GitHub hoãn (CW-47)                                                                             |
| WP-0.02 | CI                                       | Xong (local) | `ci.yml` (install, lint, trace, typecheck, test, e2e, i18n, build, audit), `nightly.yml` (bench). Chạy thật khi lên GitHub     |
| WP-0.03 | Khung 4 package                          | Xong         | `node packages/cli/dist/index.js` mở Studio "ReactCraft" + phiên bản; `pnpm dev`, `pnpm build`                                 |
| WP-0.04 | Nền bảo mật mạng                         | Xong         | S-01 đến S-12 có test. Phần WebSocket của S-07 làm cùng `/api/v1/events` (WP-1.05)                                             |
| WP-0.05 | Hạ tầng i18n                             | Xong         | `vi`/`en`, đổi ngôn ngữ không tải lại, `check:i18n`, `no-literal-string`. Lưu ngôn ngữ vào cấu hình người dùng: WP-1.05        |
| WP-0.06 | Hạ tầng kiểm thử, SPEC-06.0              | Đang làm     | Vitest (35 test, phủ 94,85%), Playwright (8 E2E, Chromium + Firefox), `bench`, `trace`, `copyFixture`. **Còn: viết SPEC-06.0** |
| WP-0.07 | Fixture ban đầu                          | Đang làm     | 2 target project build được (`pnpm fixtures:check`). **Còn: `all-nodes.json`, `gen-large-workspace.ts`** (cần schema WP-1.01)  |
| WP-0.08 | Spike VG-01, VG-07                       | Sẵn sàng     | —                                                                                                                              |
| WP-0.09 | Spike VG-09A, VG-10, VG-11, VG-13, VG-14 | Sẵn sàng     | —                                                                                                                              |
| WP-0.10 | Chuyển tài liệu vào repo                 | Đang làm     | **Còn: email liên hệ bảo mật** cho `SECURITY.md`                                                                               |

## Việc chờ chủ sản phẩm

| #   | Việc                                                                        | Chặn                            |
| --- | --------------------------------------------------------------------------- | ------------------------------- |
| 1   | Commit code Phase 0 theo mục "Trạng thái commit"                            | WP tiếp theo (CW-41)            |
| 2   | Duyệt Spec Phase 0 (CW-12; chủ sản phẩm chọn tiếp tục code trước khi duyệt) | `G0-05`                         |
| 3   | Email liên hệ bảo mật cho `SECURITY.md`                                     | WP-0.10 (trước khi repo public) |

## Vướng mắc và rủi ro đang mở

| #   | Vấn đề                                     | Hướng xử lý                                                                                              |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 3   | Code Phase 0 làm trước khi Spec được duyệt | Duyệt Spec trước `G0`; sai khác phát hiện khi duyệt thì sửa code theo                                    |
| 4   | Chỉ kiểm tra trên Windows, Node 22         | Ubuntu, macOS, Node 24: "Hoãn tới khi bật CI", bắt buộc đạt trước lần phát hành đầu (SPEC-07 mục 12.6.1) |
| 5   | `all-nodes.json` cần schema đầy đủ         | Làm ngay sau WP-1.01, trước WP-1.07                                                                      |

## Bước tiếp theo

1. WP-0.08: spike VG-01 (ghi file Windows), VG-07 (server local), báo cáo `docs/construction/vg/`.
2. WP-0.09: spike VG-10, VG-11, VG-13, VG-14, VG-09 giai đoạn A.
3. SPEC-06.0 (WP-0.06), rồi kiểm cổng `G0`.
