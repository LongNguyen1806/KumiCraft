# Quy Tắc Riêng Cho `packages/studio`

1. **Kiến trúc `core/` vs `features/`**:
   - `src/core/` tuyệt đối không import từ `src/features/`, `src/routes/` (ngoại lệ duy nhất: `src/routes/error-text.ts`), hoặc `src/app/`.

2. **Đồng bộ i18n (`en` & `vi`)**:
   - Không hardcode chuỗi hiển thị người dùng trong JSX/TSX.
   - Khi thêm, đổi tên hoặc xóa key trong `src/i18n/locales/en/*.json`, bắt buộc cập nhật đồng bộ ở `src/i18n/locales/vi/*.json` và chạy `pnpm check:i18n` để xác nhận khớp 100%.

3. **QC-40 & React Ref**:
   - Không dùng `null` trong code TypeScript/TSX; với DOM Ref trong React luôn dùng Ref Callback `ref={(el) => { myRef.current = el ?? undefined; }}`.

4. **Kiểm chứng UI/Bridge**:
   - Khi sửa `features/editor/`, `features/design/`, hoặc luồng điều hướng iframe/Bridge, bắt buộc chạy unit test liên quan, `pnpm build`, và Playwright E2E tương ứng (`e2e/*.e2e.ts --workers=1`).
