# Kế hoạch tối ưu giao diện Studio (P5)

Nguồn: báo cáo `Mockup/bao-cao-toi-uu-giao-dien.html` và mockup `Mockup/v2/`. Lập ngày 2026-11-11, sửa cùng ngày: còn 3 lượt bắt buộc + 1 lượt tùy chọn, không chụp ảnh.

## Nguyên tắc

1. **Mỗi lần một lượt.** Xong lượt thì bạn dùng thử và commit, rồi mới sang lượt sau.
2. **Chỉ đổi bề ngoài.** Không đổi cách ghi vào code, phím tắt, API, cấu trúc dữ liệu. Có hai lỗi phải sửa logic (Vừa khung, thanh dưới tràn): phần đó có test riêng.
3. **Giữ 100% tính năng:**
   - không xóa hay đổi `data-testid`;
   - không xóa khóa dịch; chữ mới có đủ `vi` và `en`;
   - mọi nút hiện có vẫn còn, chỉ dời chỗ theo bảng "Giữ 100% tính năng" trong báo cáo.
4. **Kiểm tra mỗi lượt:** typecheck, lint, `check:i18n`, unit test các thư mục bị sửa, các file E2E liên quan. Không chụp ảnh; bạn tự xem trên app.
5. **Kiểm tra đầy đủ một lần:** cuối lượt 3 chạy `pnpm verify` + E2E đầy đủ (khoảng 2,5 phút), rồi phát hành.
6. **Quy tắc code:** file dưới 400 dòng, hàm dưới 50 dòng, không `any` / `null` / ép kiểu, không tắt cảnh báo lint.
7. **Mockup là hướng dẫn, không phải luật.** Chỗ làm khác mockup ghi vào `spec-log.md`.

## Các lượt

| Lượt                          | Nội dung                                                                                                                                                                                                                                                                                                                                                                          | Bạn sẽ thấy                                       | Chi phí |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------- |
| **1 · Khung**                 | Màu và chữ: nền phẳng, chữ mờ đạt chuẩn tương phản, một chiều cao nút, một bo góc, phông mono đóng gói. Bảng dính sát mép; bảng phải chỉ còn tab Thuộc tính / AI kèm nút của từng tab. Thanh trên và cột biểu tượng theo mockup. Thanh Canvas một hàng. Thanh dưới tự co. Sửa lỗi khung bị cắt khi mở lần đầu và lỗi thanh dưới tràn ở 1280 px.                                   | Toàn bộ khung mới, Canvas rộng thêm khoảng 150 px | vừa–cao |
| **2 · Bảng trái + Inspector** | Files, Layers, Thư viện (lưới 3 cột), Component, Trang, Bản nháp, Brand. Inspector: tên thẻ và dòng code hiện đủ; Hỏi AI / Mở editor thành biểu tượng; hàng Cơ sở/sm/md… và trạng thái; hàng thao tác biểu tượng, menu Bọc, nút Xóa riêng; nhóm gập/mở, nhóm chưa đặt gập sẵn; nút bấm liền cho Hiển thị, Hướng, Căn, Căn lề chữ (giá trị khác qua "Khác ▾"); hộp margin/padding. | Bảng trái và Inspector gọn, ít cuộn               | cao     |
| **3 · AI + ngoài Editor**     | Bảng AI: chip trạng thái trợ lý, thanh nhập, tóm tắt thay đổi. Trang chủ, hộp Dự án, Cài đặt chia 4 mục, khuôn chung cho mọi hộp thoại (Tin cậy, Cài dependency, Phím tắt, Build, Tạo component, Bản nháp, Router, Xóa, Chọn ảnh, Mất kết nối). Cuối lượt: `pnpm verify` + E2E đầy đủ, phát hành.                                                                                 | Mọi màn hình cùng một kiểu                        | vừa–cao |
| **4 · Tối** (tùy chọn)        | Sáng / Tối / Theo hệ thống: đổi khoảng 109 chỗ màu đặt thẳng sang biến màu chung.                                                                                                                                                                                                                                                                                                 | Có chế độ tối                                     | cao     |

## Ngoài phạm vi

- Logic sửa code, Bridge, server.
- Chế độ tối trước lượt 4.
