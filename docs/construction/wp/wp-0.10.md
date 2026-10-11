# WP-0.10 — Chuyển tài liệu vào repo

- Trạng thái: Đang làm
- Bắt đầu: 2026-10-11 · Xong: —
- Module: M-RP (README, SECURITY, LICENSE); tài liệu `docs/` đi thành bộ thay đổi riêng (CW-42)
- Spec dẫn chiếu: SPEC-07 mục 4.2, 12.5; SPEC-02 mục 2.1, Q-08, Q-17; SPEC-05 mục 17.2 (Spec phiên bản 0.17)

## Đầu ra kiểm chứng được (từ bảng WP)

Bản trong repo là bản chính. Lịch sử thay đổi ghi lần chuyển.

## Việc đã làm

| Ngày       | Việc                                                                                          | Kết quả                                                |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 2026-10-11 | `docs/spec.md` (bản chính, hiện là Spec 0.17), `docs/srs.md` (SRS v4.0), xuống dòng LF        | Xong                                                   |
| 2026-10-11 | `PRJ/SPEC/Spec - ReactCraft Local.md` thành bản lưu (dừng ở Spec 0.15, có ghi chú đầu file)   | Xong                                                   |
| 2026-10-11 | `README.md`, `LICENSE` (MIT, Q-17), `SECURITY.md`                                             | Xong, trừ email liên hệ bảo mật. Nằm trong `CS-0.01-1` |
| 2026-10-11 | `docs/construction/`: `progress.md`, `modules.md`, `wp/`, `vg/`, `phases/` (SPEC-07 mục 12.5) | Xong                                                   |

## Bộ thay đổi

### CS-0.10-1 — Tài liệu và báo cáo thi công

- Module: không thuộc module code (scope `docs`, CW-42)
- Trạng thái: **Chờ commit** (sau `CS-0.01-1`)

| Loại | File                                                                 |
| ---- | -------------------------------------------------------------------- |
| Tạo  | `docs/spec.md`, `docs/srs.md`                                        |
| Tạo  | `docs/construction/progress.md`, `docs/construction/modules.md`      |
| Tạo  | `docs/construction/wp/wp-0.01.md`, `wp-0.02.md`, `wp-0.10.md`        |
| Tạo  | `docs/construction/vg/.gitkeep`, `docs/construction/phases/.gitkeep` |

Kiểm chứng: `docs/spec.md` trùng bản làm việc của Claude (md5); `prettier --check` đạt cho `docs/construction/` (`docs/spec.md`, `docs/srs.md` nằm trong `.prettierignore`).

Lệnh commit:

```sh
git add docs
git commit -m "docs(docs): add srs, specification and construction reports" -m "Refs: SPEC-07 WP-0.10, SPEC-07 section 12.5"
```

## Sai khác so với spec

| Nội dung                                          | Xử lý                                             |
| ------------------------------------------------- | ------------------------------------------------- |
| Báo cáo VG, phase chuyển vào `docs/construction/` | Spec 0.16                                         |
| SRS PDF vẫn ở thư mục `PRJ`                       | Không đổi: PDF là bản xem, nguồn là `docs/srs.md` |

## Definition of Done (SPEC-07 mục 11.2)

- [ ] DW-01 Bộ thay đổi đã được commit
- [x] DW-02 Bản trong repo là bản chính; Q-08 ghi trong Spec
- [x] DW-03, DW-04, DW-07 Không áp dụng
- [x] DW-05 Không có lỗi SEV-1, SEV-2
- [x] DW-06 Sai khác đã đưa vào Spec
- [x] DW-08 Đã cập nhật progress.md

## Việc còn lại

1. Chủ sản phẩm commit `CS-0.10-1`.
2. Email liên hệ bảo mật cho `SECURITY.md` (trước khi repo public).
