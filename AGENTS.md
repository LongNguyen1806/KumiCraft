# Quy Tắc Kỹ Thuật Dự Án reactcraft

1. **SỬA LỖI ĐÚNG BẢN CHẤT, TUYỆT ĐỐI KHÔNG DÙNG THỦ THUẬT LÁCH KIỂM THỬ**:
   - Khi gặp lỗi biên dịch (TypeScript), lỗi kiểm thử (Unit test), hoặc cảnh báo linter: AI phải phân tích đúng nguyên nhân gốc rễ kỹ thuật và giải quyết triệt để theo đúng kiến trúc, cơ chế chính quy của framework/thư viện và quy chuẩn dự án.
   - Tuyệt đối KHÔNG được dùng các thủ thuật "lách" chỉ để pass test hoặc qua mặt compiler/linter, bao gồm:
     - Ép kiểu gian lận (`as unknown as ...`, `any`, `!` non-null assertion) để che giấu sai lệch kiểu thay vì thiết kế lại type đúng.
     - Sửa đổi test case hoặc nới lỏng assertion một cách tùy tiện chỉ để test xanh mà làm mất đi ý nghĩa kiểm thử ban đầu.
     - Thêm comment tắt cảnh báo (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`) khi chưa được người dùng xác nhận và không có lý do kiến trúc chính đáng.
     - Tạo mock giả tạo làm sai lệch luồng thực thi thực tế của hệ thống.

2. **TUÂN THỦ QC-40 VÀ REACT REF**:
   - Tuân thủ nghiêm ngặt QC-40 (không dùng `null`). Khi tương tác với DOM Element ref trong React (vốn trả về `null` khi unmount), sử dụng Ref Callback chính thống:
     ```tsx
     ref={(el) => {
       myRef.current = el ?? undefined;
     }}
     ```
     Tuyệt đối không ép kiểu thô bạo (`as unknown as ...`) đối với `useRef`.
