# Quy Tắc Kỹ Thuật Dự Án kumicraft

1. **SỬA LỖI ĐÚNG BẢN CHẤT, TUYỆT ĐỐI KHÔNG DÙNG THỦ THUẬT LÁCH KIỂM THỬ**:
   - Khi gặp lỗi biên dịch (TypeScript), lỗi kiểm thử (Unit test), hoặc cảnh báo linter: AI phải phân tích đúng nguyên nhân gốc rễ kỹ thuật và giải quyết triệt để theo đúng kiến trúc, cơ chế chính quy của framework/thư viện và quy chuẩn dự án.
   - Tuyệt đối KHÔNG được dùng các thủ thuật "lách" chỉ để pass test hoặc qua mặt compiler/linter, bao gồm:
     - Ép kiểu gian lận (`as unknown as ...`, `any`, `!` non-null assertion) để che giấu sai lệch kiểu thay vì thiết kế lại type đúng.
     - Sửa đổi test case hoặc nới lỏng assertion một cách tùy tiện chỉ để test xanh mà làm mất đi ý nghĩa kiểm thử ban đầu.
     - Thêm comment tắt cảnh báo (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`) hoặc thêm entry mới vào `.dependency-cruiser-known-violations.json` khi chưa được người dùng xác nhận và không có lý do kiến trúc chính đáng.
     - Tạo mock giả tạo làm sai lệch luồng thực thi thực tế của hệ thống.

2. **TUÂN THỦ QC-40 VÀ REACT REF**:
   - Tuân thủ nghiêm ngặt QC-40 (không dùng `null`). Khi tương tác với DOM Element ref trong React (vốn trả về `null` khi unmount), sử dụng Ref Callback chính thống:
     ```tsx
     ref={(el) => {
       myRef.current = el ?? undefined;
     }}
     ```
     Tuyệt đối không ép kiểu thô bạo (`as unknown as ...`) đối với `useRef`.

3. **PHÂN TÁCH QUYỀN QUYẾT ĐỊNH**:
   - **Quyết định kỹ thuật & kiến trúc nội bộ:** AI tự khảo sát codebase, chọn phương án đúng chuẩn repo và trình bày ngắn gọn phương án cùng rủi ro — không hỏi ngược người dùng các câu hỏi thuần kỹ thuật.
   - **Quyết định nghiệp vụ & UX:** Chỉ hỏi người dùng khi có lựa chọn ảnh hưởng đến hành vi sản phẩm hoặc trải nghiệm hiển thị.

4. **RÀNG BUỘC KIẾN TRÚC (`dependency-cruiser`)**:
   - `packages/server/src/stacks/*/*` tuyệt đối không import chéo lẫn nhau (ngoại lệ duy nhất: `stacks/style/`). Logic dùng chung giữa nhiều stack phải tách vào `packages/server/src/lib/`.
   - `packages/server/src/lib/` chỉ chứa helper trung lập (không import `services/`, `stacks/`, `adapters/`).
   - `packages/server/src/services/` và `packages/server/src/adapters/` không import trực tiếp `stacks/`.
   - `packages/server/src/kernel/` và `ports/` chỉ dùng contract chung (`@kumicraft/shared`, `kernel/`, `ports/`).
   - `packages/studio/src/core/` không import `features/`, `routes/` (trừ `routes/error-text.ts`), hoặc `app/`.

5. **QUY CHUẨN COMMIT (`commitlint`)**:
   - Định dạng bắt buộc: `<type>(<scope>): <subject>`
   - `type`: `feat | fix | refactor | test | docs | spec | chore | perf | build | ci | spike`
   - `scope` (bắt buộc): `shared | server | bridge | studio | cli | e2e | fixtures | templates | repo | docs`
   - `subject`: chữ thường toàn bộ, tối đa 72 ký tự, không kết thúc bằng dấu `.`.

6. **KIỂM CHỨNG TRƯỚC KHI BÁO HOÀN THÀNH**:
   - Trước khi kết thúc mọi tác vụ sửa code, bắt buộc kích hoạt và tuân thủ quy trình trong skill `kumicraft-verify` (`.agents/skills/kumicraft-verify/SKILL.md`): chạy đủ unit test, typecheck, eslint, `pnpm lint:deps`, `pnpm check:i18n` (nếu sửa i18n), và `pnpm build` + Playwright E2E tương ứng khi sửa runtime/bridge/UI.
