# Mục tiêu kiến trúc KumiCraft

Chủ dự án duyệt ngày 2026-11-22. Đây là bước 1 của việc dựng lại kiến trúc: mọi quyết định kiến trúc sau này phải chỉ ra nó phục vụ mục tiêu nào ở đây.

## 1. KumiCraft là gì

Công cụ **thiết kế giao diện web trên code thật**. Người dùng thấy trang chạy thật trên Canvas, chỉnh bằng chuột và bảng thuộc tính (hoặc nhờ AI), và KumiCraft ghi thẳng vào file code của dự án.

- **Người dùng chính:** dev fullstack mạnh backend, yếu giao diện. Họ ghét chuyển qua lại giữa code và trình duyệt, và không tự làm ra được giao diện đẹp.
- **Vấn đề giải quyết:** giúp họ làm ra giao diện **đẹp, chỉn chu**, mà code vẫn là code của họ, sửa tay được, nối được với backend của họ.
- **Tính năng chính:** tạo dự án mới và thiết kế nó. Mở dự án có sẵn để chỉnh là tính năng thứ hai.
- **Thế mạnh là AI** (chủ dự án, 2026-11-22): AI làm được mọi việc mà các công cụ thiết kế làm được. Người dùng chủ yếu nhờ AI; các công cụ chỉnh tay (Inspector, thư viện khối…) không phải thứ họ dùng thường xuyên. Hệ quả cho kiến trúc: mỗi thao tác sửa là **một thao tác dùng chung**, công cụ chỉnh tay và AI gọi cùng một thao tác đó; không có thao tác nào chỉ công cụ tay làm được mà AI không làm được.
- **Thước đo:** mỗi tiêu chí phải đạt 9/10 trở lên. Kết quả không đẹp thì không có lý do gì để dùng KumiCraft thay vì nhờ AI viết thẳng.

## 2. Nguyên tắc đã chốt (không bàn lại khi làm kiến trúc)

1. **Code là nguồn sự thật duy nhất.** Không có file thiết kế riêng, không có bước "xuất code". Canvas chạy chính dự án bằng dev server của nó.
2. **Ghi thẳng vào file, an toàn nhờ Undo.** Undo trả lại đúng từng byte, kèm kiểm hash và git. Không có chế độ "sửa bản sao rồi bấm Lưu".
3. **Không xung đột với code của người dùng.** Người dùng có thể sửa tay song song. KumiCraft dùng lại thư viện sẵn có của dự án, không tạo bản thứ hai, không tự cài gói, và từ chối ghi khi file vừa bị đổi trên đĩa.
4. **Mọi hệ style chạy như nhau.** Tailwind, CSS, CSS Modules, Sass, Bootstrap… đi qua cùng một lớp style; không có "chế độ rút gọn" cho hệ nào.
5. **Chạy hoàn toàn trên máy người dùng.** Server chỉ nghe ở `127.0.0.1`, có token; KumiCraft không giữ API key nào. AI là CLI do người dùng tự cài và đăng nhập (Antigravity, Claude Code).
6. **MCP chỉ để phát triển và kiểm thử**, không xuất hiện trong app hay tài liệu cho người dùng.
7. **Giấy phép độc quyền:** cài và dùng miễn phí, không được sao chép hay sửa.

## 3. KumiCraft sẽ lớn lên theo hướng nào (các điểm mở rộng)

Đây là những chỗ chắc chắn sẽ có nhiều biến thể. Kiến trúc phải cho thêm biến thể mới mà **không sửa phần lõi**.

| Điểm mở rộng       | Hiện có                                               | Sẽ thêm                                                                                                                            |
| ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Công cụ chạy dự án | Vite; Express (proxy)                                 | Next.js, webpack, Angular CLI, ASP.NET, Django, Laravel… (theo [nhan-dien-du-an.md](../construction/giao-viec/nhan-dien-du-an.md)) |
| Ngôn ngữ giao diện | JSX (React); Pug (chỉ xem)                            | Vue, Angular, Svelte, HTML, Razor, Blade, Django template…                                                                         |
| Hệ style           | Tailwind 3/4, CSS, CSS Modules, Sass, Less, Bootstrap | Chỉnh riêng cho styled-components, Emotion, MUI…                                                                                   |
| AI agent           | Antigravity, Claude Code                              | Agent CLI khác                                                                                                                     |
| Nơi chạy Studio    | Trình duyệt                                           | Bên trong VS Code hoặc IDE khác (webview)                                                                                          |
| Công cụ thiết kế   | Inspector, thư viện khối, hiệu ứng, chuyển động…      | Thêm công cụ theo danh sách "công cụ còn thiếu"                                                                                    |

**Không mở rộng theo các hướng sau** (chủ dự án, 2026-11-22), nên kiến trúc không chừa chỗ cho chúng:

- **Nhiều người cùng sửa:** app chạy trên máy, một người làm một dự án tại một lúc.
- **Thiết kế trên điện thoại hoặc máy tính bảng:** thiết kế chỉ làm trên máy tính. (Xem giao diện ở khổ màn hình điện thoại bằng khung responsive thì vẫn có, như hiện nay.)
- **Ứng dụng mobile native** (React Native, Flutter…): chỉ làm giao diện web.
- **Plugin do người ngoài viết:** chưa cần.
- **Đồng bộ đám mây:** không có (dữ liệu nằm trong dự án và máy người dùng).

## 4. Chất lượng nào quan trọng nhất (xếp theo thứ tự)

Khi hai mục xung đột, mục đứng trên thắng.

1. **Không làm hỏng code của người dùng.** Mọi thao tác ghi đúng, giữ định dạng, Undo được, không mất dữ liệu.
2. **Kết quả đẹp và đúng ý.** Cái thấy trên Canvas là cái được ghi vào code.
3. **Dùng được thật** (UX first): không có nút làm cho có; lỗi phải báo rõ, kèm cách xử lý.
4. **Dễ mở rộng:** thêm một loại dự án, một hệ style hay một agent mà không phải sửa lõi.
5. **Chạy như nhau trên Windows, macOS, Linux.**
6. **An toàn:** chỉ chạy trên máy, không lộ token, chỉ chạy lệnh của dự án khi dự án đã được tin cậy.
7. **Nhanh:** chỉnh một thuộc tính phải thấy trên Canvas gần như tức thì; mở dự án không chờ lâu.
8. **Dễ chẩn đoán:** có file log để người dùng gửi về khi gặp lỗi.

## 5. Những gì KumiCraft không làm

- Không phải trình soạn thảo code thay VS Code. Chỉnh code tay thì mở editor của người dùng.
- Không phải công cụ vẽ mockup tách khỏi code (kiểu Figma).
- Không tự viết backend, không tự đổi logic nghiệp vụ. AI chỉ đọc backend để nối giao diện cho đúng.
- Không host dự án, không deploy.
- Không quản lý tài khoản hay thanh toán AI của người dùng.
- Không hỗ trợ nhiều người cùng sửa, không thiết kế trên thiết bị di động, không làm ứng dụng mobile native, không có plugin của bên ngoài, không đồng bộ đám mây (xem mục 3).

## 6. Ràng buộc

- Người dùng phải có Node.js trên máy (KumiCraft cài bằng npm).
- Studio là ứng dụng web; sau này phải nhúng được vào IDE, nên Server và Bridge không được phụ thuộc vào phần vỏ của Studio.
- Một người phát triển chính (chủ dự án), có AI hỗ trợ. Kiến trúc phải đủ rõ để AI làm đúng mà không cần đoán.

## 7. Dùng tài liệu này thế nào

- Bước 2 (kiến trúc hiện trạng) và bước 3 (kiến trúc đích) phải dựa vào các mục ở đây.
- Mỗi tính năng mới, trước khi viết code, phải nói nó phục vụ mục tiêu nào, và chạm vào điểm mở rộng nào.
- Khi mục tiêu đổi, sửa tài liệu này trước, rồi mới sửa kiến trúc.
