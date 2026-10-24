# Thông báo cho Gemini: kế hoạch đã đổi sang Hướng 3

Kế hoạch KumiCraft đã đổi hẳn. Mọi bản giao việc trước đây (bước 9C, Inspector theo Design Model, `buoc-*.md`) đều **hủy**. Đừng làm tiếp việc cũ nào.

## Hướng mới (Hướng 3, chốt 2026-10-13)

1. **Mã nguồn của dự án là nguồn sự thật duy nhất.** Không còn Design Model, Design Operation, file thiết kế JSON, sinh code hay xuất code.
2. **Canvas chạy chính dự án React thật:** Vite của dự án chạy trong tiến trình con, hiện trong iframe. Một plugin "Bridge" gắn `data-rc-loc="file:dòng:cột"` vào thẻ JSX để chọn phần tử là ra đúng dòng code.
3. **Sửa trên Studio là sửa thẳng file nguồn**, thay đổi tối thiểu (`@babel/parser` + `magic-string`). Sửa xong phân tích lại được thì mới ghi. Có Undo theo từng file.
4. **AI chạy qua agent dòng lệnh đã cài trên máy** (Antigravity `agy`; Claude Code CLI tùy chọn). **Không có API key** trong KumiCraft. Agent đọc backend qua một bản sao chỉ đọc, không có file bí mật.
5. Phạm vi bản 1: Vite 7/8, React 18/19, Tailwind v4. Next.js thêm sau bằng một bộ chuyển đổi framework (M-FW).

## Tài liệu phải đọc trước khi làm bất cứ việc gì

| Tài liệu                                | Nội dung                                                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/srs.md`                           | SRS v5.0: yêu cầu của hướng mới                                                                                                                                                  |
| `docs/spec.md`                          | Spec 1.0 (thay hẳn bản 0.18): SPEC-01 kiến trúc, SPEC-02 quy chuẩn code, SPEC-03 API/sự kiện/Bridge/mã lỗi, SPEC-04 module, SPEC-05 bảo mật, SPEC-06 kiểm thử, SPEC-07 quy trình |
| `docs/construction/giao-viec/README.md` | Quy trình giao việc mới, quy tắc gỡ lỗi, mẫu báo cáo, lộ trình Phase 1                                                                                                           |
| `docs/construction/progress.md`         | Tiến độ hiện tại                                                                                                                                                                 |
| `docs/construction/spec-log.md`         | Các chỗ code đang lệch spec, có lý do                                                                                                                                            |

Tài liệu cũ ở `docs/construction/archive-0.18/` **chỉ để tra bài học**, không làm theo.

## Hiện trạng code (sau WP-1.01)

- Đã **xóa**: `packages/model`, Design Store, Canvas dựng từ model, Overlay, kéo thả, Inspector, Layer Tree, Library cũ, cùng test và fixture của chúng.
- Package hiện có: `packages/shared` (mới: mã lỗi, `workspace.json` v2, quy tắc responsive, cờ tính năng), `packages/server`, `packages/studio`, `packages/cli`. `packages/bridge` sẽ có ở WP-1.05.
- Server đọc `.kumicraft/workspace.json` **phiên bản 2** (SPEC-03 mục 3). Có các endpoint `GET /session`, `GET`/`PATCH /settings`, `POST /project/trust`.
- Studio có: màn hình "Chưa mở dự án", màn hình lỗi dự án, khung Editor (Canvas chờ), hộp thoại tin cậy, Cài đặt (ngôn ngữ, editor, package manager).
- `pnpm verify` và E2E trên 3 trình duyệt đang xanh.

## Quy tắc làm việc (bắt buộc)

1. **Chỉ làm khi có bản giao việc** dạng `docs/construction/giao-viec/<WP>-<phần>.md`. Chưa có thì không tự làm.
2. **Đọc trước khi sửa:** đọc file cần sửa và các file liên quan (nơi gọi, nơi được gọi, test). Không đoán (CW-52).
3. Claude viết test trước; bạn làm cho test xanh, **không sửa file test khóa**. Sửa 3 lần không được thì dừng và báo (giao-viec/README.md).
4. Không thêm thư viện, không sửa `docs/spec.md`. Chỗ lệch spec ghi vào `docs/construction/spec-log.md`.
5. Cấm `null` (QC-40), chuỗi `.then()` (QC-42), `any`, `@ts-ignore`, `eslint-disable`, `skip`, nới ngưỡng. Mọi chữ hiển thị qua i18n `vi` và `en`.
6. Test gắn mã quy tắc trong ngoặc vuông, ví dụ `[R-SE-05]`; `pnpm trace` phải xanh.
7. Không commit, không tạo nhánh. Báo cáo theo mẫu, kèm commit message đã qua `commitlint`, **không** có dòng ghi công AI.

## Việc tiếp theo

- WP-1.02 (bộ test nghiệm thu Phase 1, spike VG-15, VG-16): **Claude làm**.
- WP-1.03 (M-FW + M-PJ: mở, tạo khung, cài dependency, nút Project) sẽ giao cho bạn qua bản giao việc riêng sau WP-1.02.

Bây giờ không cần code gì. Hãy đọc các tài liệu ở bảng trên rồi trả lời ngắn: đã đọc những gì, và có chỗ nào trong spec chưa rõ cần hỏi trước khi nhận WP-1.03.
