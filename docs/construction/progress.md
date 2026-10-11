# Tiến độ thi công

Cập nhật: 2026-10-11 · Spec: phiên bản 0.18 · Phase hiện tại: 0 — Nền móng · Chế độ: **local** (SPEC-07 mục 12.6)

Báo cáo này theo mẫu SPEC-07 mục 19.4. Tiến độ thi công chỉ ghi ở `docs/construction/`, không ghi vào Spec (SPEC-07 CW-35). Trạng thái theo module: [modules.md](modules.md).

## Cách làm việc hiện hành

- Repo Git chỉ nằm trên máy chủ sản phẩm. Chưa đưa lên GitHub. Các bước GitHub (tạo repo, bảo vệ `main`, CI) hoãn theo SPEC-07 mục 12.6.1.
- Claude giao việc theo **bộ thay đổi**, mỗi bộ thuộc đúng một module (SPEC-07 mục 3.5). Claude không commit, không tạo nhánh, không ghi vào `.git` (CW-43).
- Chủ sản phẩm xem xét bộ thay đổi, chạy `pnpm verify`, rồi tự commit bằng commit message gợi ý (không có dòng ghi công AI, CW-45).

## Tổng quan phase

| Phase                      | Trạng thái   | WP xong / tổng | Cổng           |
| -------------------------- | ------------ | -------------- | -------------- |
| 0 — Nền móng               | Đang làm     | 1 / 10         | `G0`: chưa đạt |
| 1 — Studio Core            | Chưa bắt đầu | 0 / 11         | `G1`           |
| 2 — Xuất code và tương tác | Chưa bắt đầu | 0 / 13         | `G2`           |
| 3 — AI                     | Chưa bắt đầu | 0 / 8          | `G3`           |
| 4 — Ngữ cảnh backend       | Chưa bắt đầu | 0 / 12         | `G4`           |
| 5 — Nâng cao và phát hành  | Chưa bắt đầu | 0 / 7          | `G5`           |

## Phase 0: gói công việc

| WP      | Tên                                      | Trạng thái    | Báo cáo                  | Ghi chú                                                                                                               |
| ------- | ---------------------------------------- | ------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| WP-0.01 | Khởi tạo repo                            | Xong (local)  | [wp-0.01](wp/wp-0.01.md) | Commit `c0b394b`, hook chạy đúng. Bước GitHub hoãn (CW-47)                                                            |
| WP-0.02 | CI                                       | Đang làm      | [wp-0.02](wp/wp-0.02.md) | `pnpm verify` đạt, `ci.yml` đã commit. Còn `nightly.yml` khung (làm cùng WP-0.06). GitHub Actions chạy khi lên GitHub |
| WP-0.03 | Khung 4 package                          | Chưa sẵn sàng | —                        | WP-0.01 đã xong. Chờ Spec được duyệt (DR-01)                                                                          |
| WP-0.04 | Nền bảo mật mạng                         | Chưa sẵn sàng | —                        | Chờ WP-0.03                                                                                                           |
| WP-0.05 | Hạ tầng i18n                             | Chưa sẵn sàng | —                        | Chờ WP-0.03                                                                                                           |
| WP-0.06 | Hạ tầng kiểm thử, SPEC-06.0              | Chưa sẵn sàng | —                        | Chờ WP-0.02                                                                                                           |
| WP-0.07 | Fixture ban đầu                          | Chưa sẵn sàng | —                        | Chờ WP-0.01                                                                                                           |
| WP-0.08 | Spike VG-01, VG-07                       | Chưa sẵn sàng | —                        | Chờ WP-0.03                                                                                                           |
| WP-0.09 | Spike VG-09A, VG-10, VG-11, VG-13, VG-14 | Chưa sẵn sàng | —                        | Chờ WP-0.03, WP-0.07                                                                                                  |
| WP-0.10 | Chuyển tài liệu vào repo                 | Đang làm      | [wp-0.10](wp/wp-0.10.md) | `CS-0.10-1` đã commit (`c0b394b`). Còn email liên hệ bảo mật                                                          |

## Bộ thay đổi

| Mã        | Module     | Nội dung                                                                                                                        | Trạng thái                                  | Báo cáo                  |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------ |
| CS-0.01-1 | M-RP       | Bộ khởi tạo repo: cấu hình gốc, script, khung 4 package, `.changeset/`, `.github/`, README, SECURITY, LICENSE, `pnpm-lock.yaml` | Đã commit `c0b394b`                         | [wp-0.01](wp/wp-0.01.md) |
| CS-0.10-1 | — (`docs`) | Spec 0.17, SRS v4.0, báo cáo thi công                                                                                           | Đã commit `c0b394b` (chung với `CS-0.01-1`) | [wp-0.10](wp/wp-0.10.md) |

### Bộ `docs` chờ commit: rà soát nhất quán Spec (Spec 0.18)

Không thuộc WP nào nên không có mã `CS` (Phần 0 mục 0.4). Đi riêng theo CW-42.

| Loại | File                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Sửa  | `docs/spec.md`: các sửa đổi làm rõ, chi tiết ở Lịch sử thay đổi mục 0.18                                                              |
| Sửa  | `docs/construction/progress.md`, `modules.md`, `wp/wp-0.01.md`, `wp/wp-0.02.md`, `wp/wp-0.10.md`: kết quả bước 1 và trạng thái commit |

Cách rà soát (2026-10-11):

| Kiểm tra                                      | Cách làm                                                                                       | Kết quả                                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mã trùng                                      | Script: mã định nghĩa ở tiêu đề (ADR, VG) hoặc dòng bảng có cột đầu "Mã"                       | Không có. Mã module M-xx lặp lại ở bảng liệt kê là đúng thiết kế                                                                                                     |
| Mã dùng nhưng chưa định nghĩa                 | Script: mọi mã trong Spec, mã FR, NFR, AC, SEC đối chiếu `docs/srs.md`                         | Không có                                                                                                                                                             |
| Số mã trống                                   | Script                                                                                         | V-xx, S-xx trống theo khối (V-58, V-59, V-69, V-72 đến V-79, V-82 đến V-89; S-18, S-19, S-37 đến S-39…). Là chỗ để dành theo nhóm, giữ nguyên                        |
| Tham chiếu "mục x.y" không tồn tại            | Script: theo phần chứa nó hoặc phần ghi ngay trước (Phần 0 mục 0.6 quy tắc 3), kể cả "SRS mục" | 4 chỗ, đã sửa                                                                                                                                                        |
| Tham chiếu ngầm trỏ sang phần khác            | Script liệt kê "mục" không ghi phần trên dòng có nhắc phần khác, đọc tay từng dòng             | 7 chỗ trong SPEC-07 trỏ sai phần (ví dụ WP-1.10 "Phím tắt mục 15" là SPEC-04.1, không phải SPEC-07 mục 15), 2 chỗ mơ hồ. Đã sửa                                      |
| Phạm vi mã ghi trong câu khớp mã thật         | Script liệt kê mọi "X đến Y", đọc tay                                                          | 2 chỗ sai (E013 đến E021 thiếu E022; quy tắc tài liệu thiếu V-56, V-57, V-99), 1 chỗ truy vết thiếu (FR-13). Bảng mối đe dọa SPEC-05 mục 4 thiếu 8 biện pháp. Đã sửa |
| Tên nhóm test SPEC-05 mục 17.1 dùng ở SPEC-07 | Đối chiếu                                                                                      | Khớp                                                                                                                                                                 |
| Phiên bản ghim so với `package.json`          | Đối chiếu SPEC-01.1 mục 13.3                                                                   | Khớp. Mâu thuẫn `engines` (22.12 với 22.13) giữa ADR-BE-01, SPEC-07 mục 4.3 và repo: đã làm rõ                                                                       |
| Trạng thái, phiên bản phần ở Phần 0 mục 0.2   | Đối chiếu dòng đầu mỗi phần                                                                    | SPEC-01.1 ghi v0.2 thay vì v0.3; SPEC-00 "Đã viết" không duyệt được theo G0-05; ngày cập nhật cũ. Đã sửa                                                             |
| Thuật ngữ                                     | Đếm biến thể viết của 17 thuật ngữ chính                                                       | Thống nhất. 1 chỗ viết thường "canvas", "inspector" đã sửa                                                                                                           |
| Tiền tố ngoài quy ước Phần 0 mục 0.4          | Script                                                                                         | `R-AS` (không có module AS): ghi ngoại lệ ở mục 0.4. `RA-`, `AIQ-` là giá trị trong code (đặt trong backtick), `UC-` là mã của SRS: giữ nguyên                       |

Giới hạn: rà soát bằng script và đọc tay các chỗ script đánh dấu. Chưa đọc toàn bộ nội dung để tìm mâu thuẫn về ý nghĩa giữa các quy tắc. Việc này thuộc lần duyệt từng phần của chủ sản phẩm.

Kiểm chứng sau khi sửa: chạy lại script (không còn mã chưa định nghĩa, không còn tham chiếu hỏng ngoài câu ví dụ ở Phần 0 mục 0.6); `docs/spec.md` giữ LF, không BOM.

Lệnh commit gợi ý:

```sh
git add docs
git commit -m "docs(docs): clarify spec cross references and record bootstrap results" -m "Refs: SPEC-07 section 13.2, WP-0.01, WP-0.02, WP-0.10"
```

## Điều kiện bắt đầu phase (SPEC-07 mục 10.2)

| Điều kiện                                                                                                                            | Trạng thái                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Cổng phase trước đạt                                                                                                                 | Không áp dụng (Phase 0)                                                                       |
| Spec thuộc phạm vi phase **Đã duyệt** (SPEC-01.1, SPEC-01.2, SPEC-02, SPEC-05, SPEC-07; `G0-05` còn cần SPEC-00, SPEC-03, SPEC-04.1) | **Chưa đạt.** Mọi phần đang ở trạng thái Draft. WP-0.01 đã làm trước khi duyệt (vướng mắc #3) |
| SPEC-06._n_ có bản nháp                                                                                                              | Không áp dụng cho Phase 0: SPEC-06.0 viết trong WP-0.06                                       |
| Sổ rủi ro đã rà lại                                                                                                                  | Đã rà ngày 2026-10-11                                                                         |

## Việc chờ chủ sản phẩm

| #   | Việc                                                                   | Chặn                            |
| --- | ---------------------------------------------------------------------- | ------------------------------- |
| 3   | Duyệt các phần Spec của Phase 0 (rà soát nhất quán đã xong, Spec 0.18) | WP-0.03 trở đi, `G0-05`         |
| 4   | Email liên hệ bảo mật cho `SECURITY.md`                                | WP-0.10 (trước khi repo public) |

Đã xong ngày 2026-10-11: #1 (`git init`, cài hook, `pnpm verify`), #2 (commit `c0b394b`, hook chặn commit sai định dạng). Xem [wp-0.01](wp/wp-0.01.md).

Đã hoãn theo chế độ local: Q-07 (repo public hay private), tạo repo GitHub, bảo vệ nhánh.

## Vướng mắc và rủi ro đang mở

| #   | Vấn đề                                                  | Ảnh hưởng                                       | Hướng xử lý                                                                                               |
| --- | ------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 3   | WP-0.01 bắt đầu khi Spec chưa được duyệt (CW-12, DR-01) | Spec đổi khi duyệt có thể kéo theo sửa cấu hình | Rà soát và duyệt Spec trước WP-0.03                                                                       |
| 4   | Chế độ local chỉ kiểm tra trên Windows                  | Lỗi riêng của Ubuntu, macOS, Node 24 chưa lộ ra | Tiêu chí đa nền tảng ghi "Hoãn tới khi bật CI", bắt buộc đạt trước lần phát hành đầu (SPEC-07 mục 12.6.1) |

Đã đóng ngày 2026-10-11: #1 (không truy cập được npm registry) và #2 (công cụ ghi từ xa chặn `.github/`). Claude nay chạy trong VS Code trên máy chủ sản phẩm, truy cập được `registry.npmjs.org` và ghi được `.github/`.

## Bước tiếp theo

Mỗi lượt làm việc chỉ giao một bộ thay đổi của một module. Bộ sau bắt đầu khi bộ trước đã commit.

1. **Chủ sản phẩm:** xem và commit bộ `docs` rà soát Spec (mục "Bộ thay đổi" ở trên).
2. **Chủ sản phẩm:** duyệt các phần Spec cần cho WP-0.03 (SPEC-01.1, SPEC-01.2, SPEC-02, SPEC-05, SPEC-07, SPEC-03 mục 10.1) (việc #3).
3. **WP-0.03**, mỗi lượt một module: `CS-0.03-1` M-SV (Fastify, `/api/v1/session`) → `CS-0.03-2` M-ST (Vite, màn hình "ReactCraft" và phiên bản) → `CS-0.03-3` M-CL (`parseArgs`, chọn cổng, mở trình duyệt với `#t=`, tsdown) → `CS-0.03-4` M-RP (`pnpm dev`, `pnpm build`, ESLint Studio, job `build`).
4. Tiếp theo: `CS-0.04-1` M-SV (bảo mật mạng) → `CS-0.05-1` M-ST (i18n) → `CS-0.06-1` M-QA (hạ tầng kiểm thử, SPEC-06.0) → `CS-0.07-1` M-QA (fixture) → `CS-0.06-2` M-RP (nối script `test`, `check:i18n`, `bench`, `trace`, job CI) → spike WP-0.08, WP-0.09 → cổng `G0`.
