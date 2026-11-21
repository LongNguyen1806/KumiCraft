# Sửa lỗi cài dự án trên Mac (E021) và ghi log lỗi ra file

Ghi ngày 2026-11-20, cập nhật 2026-11-21. **Đã làm 2026-11-21** (spec-log #159), trừ ý 8: lỗi giao diện phía Studio chưa ghi, vì lỗi gọi API đã được ghi ở phía server. Chủ dự án chọn hướng: không nhờ người dùng chạy thử. Sửa theo các nguyên nhân có khả năng, ghi log đầy đủ, phát hành bản mới. Nếu người dùng còn lỗi thì họ gửi file log về.

## Những gì đã biết

- Tái hiện trên GitHub (macos-26, chip ARM, Node 24, pnpm 12.21.0, nhánh `mac-check`):
  - Khi script cài đặt của pnpm không chạy, file `pnpm` chỉ là một script không có shebang ("ASCII text").
  - Gõ trong Terminal vẫn chạy (`pnpm -v` ra 12.21.0). Node gọi không qua shell thì bị `ENOEXEC`.
  - Trên Node 24, lỗi bị ném ra ngay lúc gọi. `node-process.ts` không bắt, nên app báo E013 (lỗi nội bộ).
- Người dùng thấy E021 thiếu package manager. Có hai đường code dẫn tới E021:
  1. `project-install.ts:80`: lệnh trả mã 127 (lỗi khởi chạy đến qua sự kiện `error`).
  2. `project-install.ts:128`: server không biết dự án dùng package manager nào. `createdPackageManagers` chỉ nằm trong bộ nhớ, nên mất khi khởi động lại app. Dự án mới chưa có file lock nên cũng không đoán ra được.
- Chưa biết người dùng rơi vào đường nào. Kế hoạch sửa cả hai, và log sẽ cho biết đường nào.

## Đợt A: chạy được lệnh và ghi log (làm trước)

1. `node-process.ts`: bắt cả lỗi ném ra ngay lúc gọi. Trả về một handle bình thường, có mã thoát và tên lỗi, để app không bao giờ báo E013 vì chuyện này.
2. Trên Mac và Linux, nếu gặp `ENOEXEC`, chạy lại một lần qua `/bin/sh` (giống Terminal). Tham số được truyền riêng, không ghép thành chuỗi, để không bị lỗi với dấu cách hay ký tự lạ.
3. Giữ tên lỗi gốc (`ENOENT`, `ENOEXEC`, `EACCES`) trong kết quả của lệnh, thay vì chỉ có mã 127.
4. Bật file log `kumicraft.log` (code xoay vòng đã có ở `adapters/log/rotating-file.ts`):
   - macOS: `~/Library/Logs/KumiCraft`
   - Windows: `%LOCALAPPDATA%\KumiCraft\Logs`
   - Linux: `$XDG_STATE_HOME/kumicraft` (mặc định `~/.local/state/kumicraft`)
5. Mỗi lần mở app, ghi một dòng thông tin máy:
   - hệ điều hành, chip, bản Node, bản KumiCraft;
   - pnpm, npm, yarn, bun: có hay không, bản nào, đường dẫn, và loại file (chương trình hay script).
   - Không ghi tên người dùng, token, hay đường dẫn riêng ngoài dự án.
6. Ghi log mọi tác vụ thất bại (cài dependency, cài router, kiểm build…): mã lỗi, lý do, lệnh đã chạy, tên lỗi gốc, 20 dòng output cuối.

## Đợt B: nhớ package manager (chỉ sửa ngầm)

Chủ dự án (2026-11-21): đây là lỗi ngầm, **không thay đổi giao diện**. Không thêm nút, chữ hay mục mới nào. Thông tin máy và lỗi chỉ ghi vào file log.

7. Nhớ package manager của dự án, kể cả sau khi khởi động lại app. Nếu không biết thì dùng cái có sẵn trên máy (dò ngầm bằng `--version` như `agent-detect.ts`), thay vì báo E021 (sửa đường số 2 ở trên).
8. Lỗi phía Studio (gọi API thất bại) gửi về server để ghi chung vào file log.

## Kiểm

- Unit test cho từng ý ở trên.
- Workflow Mac trên GitHub: cài pnpm "nửa cài" (`--ignore-scripts`), rồi chạy cài dự án bằng chính code KumiCraft. Kết quả phải là cài xong, và file log có dòng thông tin máy cùng `ENOEXEC → chạy lại qua sh`.
- Unit test: khởi động lại app rồi cài dự án mới tạo, vẫn đúng package manager. Kiểm thêm file log có đủ thông tin.

## Phát hành

Bản 1.0.9 gồm cả hai đợt. Nếu người dùng còn lỗi, họ gửi file `kumicraft.log` theo đường dẫn ở trên.
