# Ghi log lỗi ra file cho người dùng (kế hoạch, chưa làm)

Ghi ngày 2026-11-20 theo yêu cầu của chủ dự án. Khi người dùng gặp lỗi, họ gửi file log về để biết mà sửa, không phải hỏi từng bước như lần lỗi E021 trên Mac.

## Hiện trạng (đã đọc trong code)

- Server đã log ra Terminal bằng pino. Lỗi máy chủ (HTTP 500 trở lên) và tác vụ bị sập (`job crashed`) có ghi.
- Code ghi file đã có sẵn: `packages/server/src/adapters/log/rotating-file.ts` (file `kumicraft.log`, xoay vòng 10 MB, giữ 5 file, che token và mật khẩu).
- Nhưng **chưa bật**: `packages/server/src/index.ts` gọi `createServerLogger` mà không truyền `logDir`, nên người dùng không có file log nào.
- Tác vụ trả về lỗi (ví dụ cài dependency báo E021 hoặc E028) **không được ghi log**. Chỉ tác vụ ném ngoại lệ mới được ghi.
- Lỗi khởi chạy lệnh (ENOENT, ENOEXEC, EACCES) bị gộp thành mã 127 trong `node-process.ts`, mất tên lỗi gốc.

## Việc cần làm

1. Bật ghi file log vào thư mục log chuẩn của hệ điều hành:
   - macOS: `~/Library/Logs/KumiCraft`
   - Windows: `%LOCALAPPDATA%\KumiCraft\Logs`
   - Linux: `$XDG_STATE_HOME/kumicraft` (mặc định `~/.local/state/kumicraft`)
2. Ghi log mọi tác vụ thất bại (cài dependency, cài router, kiểm build…): mã lỗi, lý do, lệnh đã chạy, thư mục chạy, 20 dòng output cuối.
3. Giữ tên lỗi gốc khi không khởi chạy được lệnh (ENOENT, ENOEXEC, EACCES) và ghi nó vào log. Báo cho người dùng câu khác nhau: "không tìm thấy pnpm" khác "pnpm có nhưng không chạy được".
4. Đầu mỗi lần chạy, ghi một dòng thông tin máy: hệ điều hành, chip, bản Node, bản KumiCraft, package manager có trên máy kèm phiên bản. Không ghi tên người dùng, đường dẫn riêng ngoài dự án, token.
5. Lỗi phía Studio (lỗi giao diện, gọi API thất bại) gửi về server để ghi chung vào file log.
6. Trong hộp báo lỗi thêm nút "Mở thư mục log", và trong Cài đặt có mục chỉ chỗ để file log.
7. Kiểm: test cho từng ý ở trên; một tour gây lỗi cài (giả máy không có pnpm), rồi kiểm file log có đủ thông tin.

## Liên quan

- Lỗi E021 trên Mac (pnpm 12, nghi file `pnpm` không có shebang gây ENOEXEC): đang chờ kết quả `file "$(which pnpm)"` từ người dùng.
- Phần sửa chọn package manager có sẵn trên máy làm cùng hoặc ngay sau.
