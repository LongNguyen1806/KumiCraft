# Tiến độ thi công

Cập nhật: 2026-10-11 · Spec: phiên bản 0.17 · Phase hiện tại: 0 — Nền móng · Chế độ: **local** (SPEC-07 mục 12.6)

Báo cáo này theo mẫu SPEC-07 mục 19.4. Tiến độ thi công chỉ ghi ở `docs/construction/`, không ghi vào Spec (SPEC-07 CW-35). Trạng thái theo module: [modules.md](modules.md).

## Cách làm việc hiện hành

- Repo Git chỉ nằm trên máy chủ sản phẩm. Chưa đưa lên GitHub. Các bước GitHub (tạo repo, bảo vệ `main`, CI) hoãn theo SPEC-07 mục 12.6.1.
- Claude giao việc theo **bộ thay đổi**, mỗi bộ thuộc đúng một module (SPEC-07 mục 3.5). Claude không commit, không tạo nhánh, không ghi vào `.git` (CW-43).
- Chủ sản phẩm xem xét bộ thay đổi, chạy `pnpm verify`, rồi tự commit bằng commit message gợi ý (không có dòng ghi công AI, CW-45).

## Tổng quan phase

| Phase                      | Trạng thái   | WP xong / tổng | Cổng           |
| -------------------------- | ------------ | -------------- | -------------- |
| 0 — Nền móng               | Đang làm     | 0 / 10         | `G0`: chưa đạt |
| 1 — Studio Core            | Chưa bắt đầu | 0 / 11         | `G1`           |
| 2 — Xuất code và tương tác | Chưa bắt đầu | 0 / 13         | `G2`           |
| 3 — AI                     | Chưa bắt đầu | 0 / 8          | `G3`           |
| 4 — Ngữ cảnh backend       | Chưa bắt đầu | 0 / 12         | `G4`           |
| 5 — Nâng cao và phát hành  | Chưa bắt đầu | 0 / 7          | `G5`           |

## Phase 0: gói công việc

| WP      | Tên                                      | Trạng thái    | Báo cáo                  | Ghi chú                                                                                          |
| ------- | ---------------------------------------- | ------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| WP-0.01 | Khởi tạo repo                            | Đang làm      | [wp-0.01](wp/wp-0.01.md) | `CS-0.01-1` đã cài và kiểm chứng (`pnpm verify` đạt), chờ `git init` và commit. Bước GitHub hoãn |
| WP-0.02 | CI                                       | Đang làm      | [wp-0.02](wp/wp-0.02.md) | Phần local: `pnpm verify` đạt. Phần GitHub Actions: file đã nằm trong repo, chạy khi lên GitHub  |
| WP-0.03 | Khung 4 package                          | Chưa sẵn sàng | —                        | Chờ WP-0.01 xong và Spec Phase 0 được duyệt (DR-01)                                              |
| WP-0.04 | Nền bảo mật mạng                         | Chưa sẵn sàng | —                        | Chờ WP-0.03                                                                                      |
| WP-0.05 | Hạ tầng i18n                             | Chưa sẵn sàng | —                        | Chờ WP-0.03                                                                                      |
| WP-0.06 | Hạ tầng kiểm thử, SPEC-06.0              | Chưa sẵn sàng | —                        | Chờ WP-0.02                                                                                      |
| WP-0.07 | Fixture ban đầu                          | Chưa sẵn sàng | —                        | Chờ WP-0.01                                                                                      |
| WP-0.08 | Spike VG-01, VG-07                       | Chưa sẵn sàng | —                        | Chờ WP-0.03                                                                                      |
| WP-0.09 | Spike VG-09A, VG-10, VG-11, VG-13, VG-14 | Chưa sẵn sàng | —                        | Chờ WP-0.03, WP-0.07                                                                             |
| WP-0.10 | Chuyển tài liệu vào repo                 | Đang làm      | [wp-0.10](wp/wp-0.10.md) | Bộ thay đổi `CS-0.10-1` chờ commit. Còn email liên hệ bảo mật                                    |

## Bộ thay đổi chờ commit

Thứ tự commit: `CS-0.01-1` trước, `CS-0.10-1` sau. Lệnh commit đầy đủ nằm trong báo cáo WP tương ứng.

| Mã        | Module     | Nội dung                                                                                                                        | Báo cáo                  |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| CS-0.01-1 | M-RP       | Bộ khởi tạo repo: cấu hình gốc, script, khung 4 package, `.changeset/`, `.github/`, README, SECURITY, LICENSE, `pnpm-lock.yaml` | [wp-0.01](wp/wp-0.01.md) |
| CS-0.10-1 | — (`docs`) | Spec 0.17, SRS v4.0, báo cáo thi công                                                                                           | [wp-0.10](wp/wp-0.10.md) |

## Điều kiện bắt đầu phase (SPEC-07 mục 10.2)

| Điều kiện                                                                                                                            | Trạng thái                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Cổng phase trước đạt                                                                                                                 | Không áp dụng (Phase 0)                                                                       |
| Spec thuộc phạm vi phase **Đã duyệt** (SPEC-01.1, SPEC-01.2, SPEC-02, SPEC-05, SPEC-07; `G0-05` còn cần SPEC-00, SPEC-03, SPEC-04.1) | **Chưa đạt.** Mọi phần đang ở trạng thái Draft. WP-0.01 đã làm trước khi duyệt (vướng mắc #3) |
| SPEC-06._n_ có bản nháp                                                                                                              | Không áp dụng cho Phase 0: SPEC-06.0 viết trong WP-0.06                                       |
| Sổ rủi ro đã rà lại                                                                                                                  | Đã rà ngày 2026-10-11                                                                         |

## Việc chờ chủ sản phẩm

| #   | Việc                                                                                                            | Chặn                            |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | Trong `reactcraft/`: `git init -b main`, `pnpm install` (cài hook), `pnpm verify`. Gửi lại kết quả nếu có lỗi   | WP-0.01                         |
| 2   | Commit `CS-0.01-1` rồi `CS-0.10-1` theo lệnh trong báo cáo WP; thử một commit message sai để xác nhận hook chặn | WP-0.01, WP-0.10                |
| 3   | Duyệt các phần Spec của Phase 0 sau khi Claude rà soát nhất quán                                                | WP-0.03 trở đi, `G0-05`         |
| 4   | Email liên hệ bảo mật cho `SECURITY.md`                                                                         | WP-0.10 (trước khi repo public) |

Đã xong ngày 2026-10-11: đặt 3 file `.github` và xóa `_probe.txt` (Claude làm trực tiếp), bật pnpm, `pnpm install`, `pnpm verify` (xem [wp-0.01](wp/wp-0.01.md)).

Đã hoãn theo chế độ local: Q-07 (repo public hay private), tạo repo GitHub, bảo vệ nhánh.

## Vướng mắc và rủi ro đang mở

| #   | Vấn đề                                                  | Ảnh hưởng                                       | Hướng xử lý                                                                                               |
| --- | ------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 3   | WP-0.01 bắt đầu khi Spec chưa được duyệt (CW-12, DR-01) | Spec đổi khi duyệt có thể kéo theo sửa cấu hình | Rà soát và duyệt Spec trước WP-0.03                                                                       |
| 4   | Chế độ local chỉ kiểm tra trên Windows                  | Lỗi riêng của Ubuntu, macOS, Node 24 chưa lộ ra | Tiêu chí đa nền tảng ghi "Hoãn tới khi bật CI", bắt buộc đạt trước lần phát hành đầu (SPEC-07 mục 12.6.1) |

Đã đóng ngày 2026-10-11: #1 (không truy cập được npm registry) và #2 (công cụ ghi từ xa chặn `.github/`). Claude nay chạy trong VS Code trên máy chủ sản phẩm, truy cập được `registry.npmjs.org` và ghi được `.github/`.

## Bước tiếp theo

Mỗi lượt làm việc chỉ giao một bộ thay đổi của một module. Bộ sau bắt đầu khi bộ trước đã commit.

1. **Chủ sản phẩm:** việc chờ #1, #2 để đóng phần local của WP-0.01, WP-0.02, WP-0.10.
2. **Claude:** rà soát nhất quán toàn bộ Spec (mã định danh, tham chiếu chéo, thuật ngữ), sau khi `CS-0.10-1` đã commit để có diff riêng. Kết quả là một bộ thay đổi `docs`.
3. **Chủ sản phẩm:** duyệt các phần Spec cần cho WP-0.03 (SPEC-01.1, SPEC-01.2, SPEC-02, SPEC-05, SPEC-07, SPEC-03 mục 10.1) (việc #3).
4. **WP-0.03**, mỗi lượt một module: `CS-0.03-1` M-SV (Fastify, `/api/v1/session`) → `CS-0.03-2` M-ST (Vite, màn hình "ReactCraft" và phiên bản) → `CS-0.03-3` M-CL (`parseArgs`, chọn cổng, mở trình duyệt với `#t=`, tsdown) → `CS-0.03-4` M-RP (`pnpm dev`, `pnpm build`, ESLint Studio, job `build`).
5. Tiếp theo: `CS-0.04-1` M-SV (bảo mật mạng) → `CS-0.05-1` M-ST (i18n) → `CS-0.06-1` M-QA (hạ tầng kiểm thử, SPEC-06.0) → `CS-0.07-1` M-QA (fixture) → `CS-0.06-2` M-RP (nối script `test`, `check:i18n`, `bench`, `trace`, job CI) → spike WP-0.08, WP-0.09 → cổng `G0`.
