# Quy Tắc Riêng Cho `packages/server`

1. **Cô lập Stack (`stacks-apart`)**:
   - Không import chéo giữa các thư mục con trong `src/stacks/*/*` (ví dụ `meta/mvc` không được import từ `meta/razor-pages`).
   - Mọi helper dùng chung giữa các stack phải đặt trong `src/lib/` và chỉ phụ thuộc `@kumicraft/shared`, `src/ports/`, hoặc thư viện Node/npm thuần.

2. **Bất biến của `src/runners/bridge-proxy.ts`**:
   - **Cookie cross-site cho iframe Canvas:** Giữ nguyên cơ chế viết lại `Set-Cookie` sang `SameSite=None; Secure` cho host `localhost` / `*.localhost` (không viết lại cho `127.0.0.1`).
   - **Chống cache 304 làm hỏng nonce HTML:** Luôn xóa `if-none-match` / `if-modified-since` trên request điều hướng HTML của iframe và xóa `etag` / `last-modified` trong phản hồi HTML đã bơm Bridge; giữ nguyên `304 Not Modified` cho static assets (`.css`, `.js`, ảnh).
   - **Bọc trang lỗi `>= 400`:** Phản hồi lỗi không phải HTML (body rỗng hoặc `text/plain`) trên điều hướng iframe phải được bọc thành HTML kèm `bridge-client.js` để `PageSelect` không mất kết nối.

3. **Giới hạn độ dài hàm & Chất lượng mã**:
   - ESLint bật `max-lines-per-function` (tối đa 50 dòng). Tách helper nhỏ rõ trách nhiệm thay vì dồn nhiều bước vào 1 hàm.
   - Khi kiểm thử trên fixture trong `fixtures/projects/`, đảm bảo không để sót file tạm `.kumicraft/lock` trong working tree.

4. **Bắt buộc build & E2E khi sửa Runtime/Stack/Proxy**:
   - CLI chạy từ bản build trong `packages/cli/dist`. Sau khi sửa `src/runners/` hoặc `src/stacks/`, bắt buộc chạy `pnpm build` và chạy Playwright E2E liên quan (`e2e/express-pug.e2e.ts`, `e2e/razor.e2e.ts`, `e2e/next.e2e.ts`, …) với `--workers=1`.
