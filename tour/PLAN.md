# Kịch bản test thật (tour)

Kịch bản dùng chuột và bàn phím trên app thật, giống người dùng. Nó chạy trên **bản sao** của dự án mẫu, nên không đụng tới code thật.

- **Chạy một đợt:** `pnpm build` rồi `pnpm tour tour/01a-library-blocks.tour.ts`. Mỗi đợt chạy dưới 5 phút.
- **Kết quả:** nằm trong `tour/out/<đợt>/report.md`, kèm ảnh chụp từng bước. Thư mục này không đưa lên git.
- **Bộ E2E thường ngày** (`pnpm test:e2e`) không chạy tour.
- **Lỗi đã xác nhận** thì tách bước đó thành một test E2E thật trong `e2e/`, để giữ lại về sau.

## Sau mỗi bước, tour tự kiểm

1. **Lỗi hiện ra:** có thông báo mã lỗi `(E0xx)`, ô lỗi, hoặc Canvas báo lỗi hay lỗi build của Vite.
2. **Lỗi trong console:** có lỗi JavaScript trong Studio hoặc trong Canvas.
3. **Code ghi ra:** file có đổi đúng như mong đợi. Báo cáo ghi lại các dòng code thêm và bớt.
4. **Hoàn tác:** Undo trả file về **đúng từng ký tự** như trước.

Ký hiệu trong báo cáo:

- ✅ đạt
- ⚠️ có ghi chú, cần xem lại
- ❌ lỗi

## Đợt 1: Thêm vào Canvas (dự án Tailwind)

**01a: mọi khối Library** (`01a-library-blocks.tour.ts`)

- Đếm số khối có nút +. Phải có khoảng 70 khối.
- Với từng khối:
  1. Chọn `main` rồi bấm +.
  2. Code được ghi vào file.
  3. Inspector chọn đúng khối mới.
  4. Không có lỗi.
  5. Undo xóa sạch khối đó.
- Khối nào hỏi nguồn dữ liệu thì đóng hộp thoại. Lúc đó file không được bị sửa.

**01b: các cách thêm khác** (`01b-add-other-ways.tour.ts`)

1. **Phong cách:** thêm cùng một thẻ với 5 phong cách: mặc định, tối giản, mềm, kính mờ, đậm. Riêng kính mờ phải có `backdrop-blur`.
2. **Biến thể nút:** thêm lần lượt từng biến thể.
3. **Icon:** tìm "tim", rồi chèn trái tim.
4. **Ảnh:** bấm nút Chèn ảnh, chọn ảnh đầu tiên.
5. **Công cụ vẽ:**
   - Khung (F): kéo vẽ một khung.
   - Chữ (T): bấm lên Canvas rồi gõ.
   - Ảnh (I): kéo vẽ khung rồi chọn ảnh.
6. **Kéo chuột:** kéo khối Tiêu đề từ Library thả lên Canvas.
7. **Components:**
   - Bấm + để chèn Card.
   - Kéo Card thả lên Canvas.
8. **Tạo component:** tạo từ danh sách `ul`. Phải sinh file mới. Undo thì file mới phải biến mất.
9. **Bản nháp tự do:**
   - Tạo mới.
   - Thêm 4 khối. Mỗi khối phải có vị trí tự do (`absolute left top`).
   - Vẽ một khung.
10. **Bản nháp trống:** tạo mới rồi thêm một thẻ.

## Đợt 2: Thao tác trên Canvas (sẽ viết sau đợt 1)

1. **Kéo dời** một phần tử:
   - Trên trang thường, nó phải đổi chỗ trong danh sách.
   - Trong khung tự do, nó phải đổi left/top.
   - Undo phải trả về như cũ.
2. **Kéo co giãn bằng tay nắm 4 góc:** kích thước mới được ghi đúng thang Tailwind.
3. **Phím mũi tên:** ở khung tự do, dời 1px. Giữ Shift thì dời 10px.
4. **Căn lề:** chọn nhiều phần tử, căn trái, giữa, phải.
5. **Hút lưới:** bật và tắt, rồi kéo.
6. **Sửa chữ:**
   - Nhấp đúp, gõ, bấm ra ngoài. Chữ được lưu.
   - In đậm một đoạn bằng thanh chữ.
7. **Nhân bản, xóa (phím Delete), lên/xuống, bọc vào khối, gỡ khối bọc.**
8. **Copy/paste:** Ctrl+C và Ctrl+V giữa trang và bản nháp.
9. **Undo/Redo nhiều bước liên tiếp:** phải trả đúng từng bước.
10. **Chọn bằng cây Layers và đường dẫn phần tử:** chọn cha, chọn con.

## Đợt 3: Inspector, từng nhóm (sẽ viết sau)

Với mỗi ô: đổi giá trị → Canvas đổi → code đúng kiểu người code tay → Undo.

1. **Loại thẻ HTML:** đổi `div` thành `section`. Thẻ `a` phải giữ được `href`.
2. **Bố cục:**
   - flex: hướng, căn, khoảng cách.
   - grid: số cột.
   - Cho ẩn hoặc hiện.
3. **Khoảng cách:** ô margin/padding bốn phía, giá trị lẻ, giá trị âm.
4. **Kích thước:** W/H, min/max, giá trị tự nhập.
5. **Chữ:** cỡ, độ đậm, màu, căn, chiều cao dòng.
6. **Màu và nền:**
   - Chọn màu theme, màu bảng màu, mã màu tự nhập.
   - Nền kính mờ phải giữ được độ trong suốt.
7. **Viền và bo góc:** từng cạnh, từng góc.
8. **Hiệu ứng:** đổ bóng, làm mờ nền, gradient, chữ gradient, phát sáng.
9. **Chuyển động:** các mẫu có sẵn, thời gian, độ trễ, hiện khi cuộn.
10. **Icon:** đổi icon, cỡ, nét, màu.
11. **Ảnh:** tỉ lệ khung, cách lấp đầy, bo góc.
12. **Thuộc tính thẻ:**
    - Thêm `aria-label`.
    - `onClick` phải bị chặn.
    - `target=_blank` phải kèm `rel`.
13. **Gợi ý trợ năng:** sửa alt bị trống.
14. **Bảng dữ liệu:** thêm hàng, thêm cột, lưu.
15. **Props của component:** sửa prop của Card.
16. **Danh sách:** thêm và xóa mục.
17. **Class khác:** thêm class lạ. Class đó phải được giữ nguyên khi sửa ô khác.
18. **Trạng thái hover/dark:** sửa màu khi hover. Màu thường không được đổi theo.
19. **Liên kết:** nội bộ, bên ngoài, mở tab mới.

## Đợt 4: Responsive (sẽ viết sau)

1. **Ở Mobile, sửa thường:** Desktop và Tablet cũng phải đổi theo.
2. **Ở Mobile, bấm "Sửa riêng cho Mobile":**
   - Sửa padding, số cột, hướng flex, kéo co giãn, ô X/Y/W/H.
   - Bấm Xong.
   - Desktop phải giữ nguyên.
   - Code ra dạng `max-md:`.
3. **Bấm Hủy:** mọi thay đổi trong lần sửa riêng đều mất.
4. **Đổi khung hoặc chọn phần tử khác** giữa chừng: lần sửa riêng phải tự kết thúc.
5. **Sửa một ô đang khác nhau giữa các màn hình:** app phải hỏi áp cho tất cả hay chỉ màn hình này.
6. **Khung Mobile không bị tràn ngang** sau khi thêm các khối Library.

## Đợt 5: Dự án CSS thường (sẽ viết sau)

Chạy lại phần chính của đợt 1–3 trên `projects/react-css`. Hai kiểu dự án phải chạy như nhau: code ghi vào file `.css` đúng chỗ và không sinh class Tailwind.
