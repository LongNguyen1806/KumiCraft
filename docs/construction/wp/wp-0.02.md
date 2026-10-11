# WP-0.02 — CI

- Trạng thái: Đang làm
- Bắt đầu: 2026-10-11 · Xong: —
- Module: M-RP
- Spec dẫn chiếu: SPEC-07 mục 4.2, 12.6; SPEC-02 mục 13; SPEC-05 S-90, S-92 (Spec phiên bản 0.17)

## Đầu ra kiểm chứng được (từ bảng WP)

PR mẫu chạy đủ job, tất cả xanh. Ở chế độ local: `pnpm verify` đạt trên máy chủ sản phẩm; phần GitHub Actions chạy khi lên GitHub (CW-47).

## Việc đã làm

| Ngày       | Việc                                                                                                                                                                                                                              | Kết quả                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 2026-10-11 | `.github/workflows/ci.yml`: job `install` (Windows, Ubuntu × Node 22, 24, `--frozen-lockfile`), `lint` (kèm `format:check`), `typecheck`, `audit`. Action: `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7` | Đã gửi file cho chủ sản phẩm đặt vào repo |
| 2026-10-11 | `.github/dependabot.yml` (npm, GitHub Actions, hằng tuần, tiền tố commit `build(repo)`, `ci(repo)`)                                                                                                                               | Đã gửi file                               |
| 2026-10-11 | Script `pnpm verify` thay CI ở chế độ local                                                                                                                                                                                       | Nằm trong `CS-0.01-1`                     |
| 2026-10-11 | Bản gửi trước không có trên máy: viết lại `ci.yml`, `dependabot.yml`, `pull_request_template.md` trực tiếp vào repo theo SPEC-02 mục 12.1, 13.2; thêm `permissions: contents: read` và `concurrency` cho `ci.yml`                 | Xong, nằm trong `CS-0.01-1`               |

Job `test`, `i18n`, `build`, `e2e`, `export-compat` thêm khi có nội dung đầu tiên (WP-0.03, WP-0.05, WP-0.06, WP-2.12). Mỗi job mới đồng thời thêm vào `pnpm verify` nếu chạy được ở máy local.

## Bộ thay đổi

Các file của WP này nằm trong bộ khởi tạo `CS-0.01-1` (xem [wp-0.01](wp-0.01.md)).

## Kiểm chứng

| Kiểm tra                            | Lệnh hoặc cách làm                                                                      | Kết quả                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| YAML hợp lệ                         | `yaml.safe_load`                                                                        | Đạt                                                          |
| Phiên bản action mới nhất           | Trang Releases trên GitHub, ngày 2026-10-11                                             | checkout v7.0.1, setup-node v7.0.0, pnpm/action-setup v6.1.0 |
| `pnpm verify` trên máy chủ sản phẩm | `pnpm verify` (2026-10-11, Claude chạy trên máy chủ sản phẩm, Windows 11, Node 22.19.0) | Đạt. Chủ sản phẩm chạy lại sau `git init` (CW-27)            |
| Lệnh của các job CI chạy được local | `pnpm install --frozen-lockfile`, `pnpm audit --audit-level=high`                       | Đạt; audit không có lỗ hổng                                  |
| Message Dependabot qua commitlint   | `build(repo): bump …`, `ci(repo): bump …` qua `pnpm exec commitlint`                    | Đạt                                                          |
| CI trên GitHub                      | —                                                                                       | Hoãn: chế độ local                                           |

## Sai khác so với spec

| Nội dung                                     | Xử lý                                      |
| -------------------------------------------- | ------------------------------------------ |
| Thêm bước `pnpm format:check` vào job `lint` | Bổ sung nhỏ, khớp QC-72                    |
| `nightly.yml` khung chưa có                  | Thêm cùng `pnpm bench` ở WP-0.06           |
| Chạy CI trên GitHub hoãn                     | Chế độ local, Spec 0.17 (SPEC-07 mục 12.6) |

## Definition of Done (SPEC-07 mục 11.2)

- [ ] DW-01 Bộ thay đổi đã được commit
- [ ] DW-02 `pnpm verify` đạt trên máy chủ sản phẩm (phần GitHub hoãn)
- [x] DW-03, DW-04, DW-07 Không áp dụng
- [x] DW-05 Không có lỗi SEV-1, SEV-2
- [x] DW-06 Sai khác đã đưa vào Spec
- [x] DW-08 Đã cập nhật progress.md

## Việc còn lại

1. Chủ sản phẩm commit cùng `CS-0.01-1` (3 file `.github` đã nằm trong repo).
2. Khi lên GitHub: chạy CI trên một commit mẫu, xác nhận mọi job xanh trên Windows và Ubuntu (CW-47).
