# Bước 0 — Dọn nền

Module: M-QA, tài liệu theo dõi. Kích thước: nhỏ. Làm trước Bước 1A.

## Mục tiêu

Bộ test xanh ổn định và hai file theo dõi phản ánh đúng thực tế.

## Phạm vi (chỉ được sửa các file này)

- `packages/model/src/operations/engine.property.test.ts`
- `docs/construction/progress.md`
- `docs/construction/modules.md`

## Việc cần làm

1. **Test hết giờ.** Test `undoing a whole batch restores the document` (dòng ~152) hết 5 giây khi cả bộ chạy song song (chạy riêng thì qua). Thêm tham số timeout thứ ba cho `it(...)` (đặt `30_000`). Giữ nguyên `numRuns` và các loại operation. Làm tương tự cho mọi `it` property khác trong cùng file nếu chúng chạy quá 2 giây khi đo riêng (đo bằng `pnpm --filter @reactcraft/model exec vitest run src/operations/engine.property.test.ts`).
2. **`progress.md`**: cập nhật ngày; phần "Kiểm tra gần nhất" ghi số liệu thật sau khi chạy `pnpm verify` và `pnpm test:e2e` (số test, số e2e, ngày, Windows 11, Node bản đang dùng); phần "Tổng quan phase" đếm lại WP xong (Phase 0: 10/10 trừ phần chờ chủ sản phẩm; Phase 1: 6/11, WP-1.07 đang làm); xoá "Bước tiếp theo" cũ, thay bằng: WP-1.07 (Canvas) rồi các bước trong `ke-hoach-hoan-thanh.md`.
3. **`modules.md`**: cột "Trạng thái" đúng thực tế. Xong: M-RP, M-QA (Phase 0), M-SV, M-CL, M-ST, M-MC, M-TK, M-SM, M-WS, M-DS, M-SH, M-HS. Đang làm: M-CV. Còn lại giữ "Chưa bắt đầu". Cột "Bộ thay đổi đã commit" để trống nếu không biết hash; **không bịa hash**. Dùng `git --no-optional-locks log --oneline` để tra hash thật nếu muốn điền.

## Kiểm tra (dán kết quả thật)

- `pnpm verify` chạy **3 lần liên tiếp**, cả ba lần mã thoát 0, test 100% xanh.
- `pnpm exec prettier --check docs` sạch.

## Không được làm

- Không giảm `numRuns`, không `it.skip`, không sửa code ngoài test trong `packages/model`.
