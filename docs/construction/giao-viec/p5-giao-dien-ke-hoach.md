# Kế hoạch tối ưu giao diện Studio (P5)

Nguồn: báo cáo `Mockup/bao-cao-toi-uu-giao-dien.html` và mockup `Mockup/v2/`. Ngày lập: 2026-11-11.

## Nguyên tắc

1. **Mỗi lần chỉ làm một cụm.** Xong cụm thì bạn xem thử và commit, rồi mới sang cụm sau. Không gộp cụm.
2. **Chỉ đổi bề ngoài.** Không đổi cách ghi vào code, phím tắt, API, cấu trúc dữ liệu. Cụm nào buộc phải sửa logic (G3, G4) thì phần logic tách riêng và có test riêng.
3. **Giữ 100% tính năng:**
   - không xóa hay đổi `data-testid`;
   - không xóa khóa dịch; chữ mới phải có đủ `vi` và `en`;
   - mọi nút hiện có vẫn còn, chỉ được dời chỗ theo bảng "Giữ 100% tính năng" trong báo cáo.
4. **Kiểm tra theo từng cụm:**
   - typecheck, lint, `check:i18n`;
   - unit test của các thư mục bị sửa;
   - các file E2E liên quan;
   - chụp ảnh trước và sau.
5. **Kiểm tra đầy đủ chỉ hai lần:** `pnpm verify` + E2E đầy đủ (khoảng 2,5 phút) cuối đợt 1 (sau G4) và cuối đợt 2 (sau G9).
6. **Quy tắc code:** file dưới 400 dòng, hàm dưới 50 dòng, không `any` / `null` / ép kiểu, không tắt cảnh báo lint.
7. **Mockup là hướng dẫn, không phải luật.** Chỗ nào làm khác mockup thì ghi vào `spec-log.md`.

## Các cụm

| Cụm     | Nội dung                                                                                                                                                                                        | Bạn sẽ thấy                                  | File chính                                                                                        | Chi phí | Rủi ro                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- | ---------------------------- |
| **G0**  | Lưới an toàn: script chụp ảnh 12 trạng thái của Studio vào `artifacts/ui-shots/<nhãn>/`, cùng danh sách kiểm tính năng (checklist)                                                              | Chưa có gì đổi                               | `scripts/ui-shots.mjs`, `e2e/visual/`                                                             | thấp    | không                        |
| **G1**  | Màu và chữ: bộ biến màu mới (giữ tên cũ), nền phẳng, chữ mờ đạt chuẩn tương phản, một chiều cao nút và một bo góc, đóng gói phông mono                                                          | Cả app sáng sủa, dễ đọc hơn; bố cục chưa đổi | `app/styles.css`, phông                                                                           | thấp    | thấp                         |
| **G2**  | Khung Editor: bỏ thẻ nổi và khe hở, bảng dính sát mép; bảng phải bỏ tiêu đề trùng, nút của từng tab nằm trên thanh tab; thanh trên và cột biểu tượng theo mockup (có tên khi rê chuột)          | Canvas rộng thêm khoảng 150 px               | `editor-shell`, `side-panels`, `activity-bar`, `editor-toolbar`, `runner-status-badge`, `resizer` | vừa     | thấp                         |
| **G3**  | Thanh Canvas một hàng: chọn trang · ⚠ chưa rõ file · loại · tên · file · Thiết kế/Xem thử; đầu khung gọn; sửa lỗi khung bị cắt khi mở lần đầu                                                   | Mất một hàng thừa; khung tự vừa              | `canvas-area`, `page-select`, `design-bar`, `canvas-frame-tile`, `canvas-zoom`                    | vừa     | vừa (có sửa logic Vừa khung) |
| **G4**  | Thanh dưới tự co: dưới 1440 px công cụ chỉ còn biểu tượng; dưới 1280 px khung và lưới vào menu ⋯; sửa lỗi tràn                                                                                  | Màn 1280 không còn mất % thu phóng           | `status-bar`, `canvas-grid-select`, `canvas-frame-select`, `draw-toolbar`                         | thấp    | thấp                         |
| —       | **Hết đợt 1:** `pnpm verify` + E2E đầy đủ + bạn dùng thử                                                                                                                                        |                                              |                                                                                                   |         |                              |
| **G5**  | Bảng trái: Files, Layers, Thư viện (lưới 3 cột), Component, Trang, Bản nháp, Brand theo mockup                                                                                                  | Bảng trái gọn, đồng bộ                       | `features/files`, `layers`, `library`, `components-panel`, `pages`, `drafts`, `brand`             | vừa     | thấp                         |
| **G6**  | Inspector phần đầu: tên thẻ và dòng code hiện đủ; Hỏi AI và Mở editor thành biểu tượng; hàng Cơ sở/sm/md… và trạng thái; hàng thao tác biểu tượng, menu Bọc, nút Xóa đứng riêng                 | Đỡ 2–3 hàng nút chữ                          | `inspector-header`, `element-path`, `structure-actions`                                           | vừa     | vừa                          |
| **G7a** | Inspector nhóm thuộc tính: gập/mở; nhóm chưa đặt ghi "chưa đặt" và gập sẵn; số thuộc tính đã đặt hiện ở đầu nhóm; ô gọn hơn                                                                     | Thấy ngay cái đã đặt, ít cuộn                | `inspector-property-groups`, `property-field`                                                     | vừa     | vừa                          |
| **G7b** | Inspector nút bấm liền: Hiển thị, Hướng, Căn chính/phụ, Căn lề chữ; hộp margin/padding. Giá trị nằm ngoài danh sách nút vẫn chọn được qua "Khác ▾"                                              | Sửa nhanh bằng một lần bấm                   | `property-field` + file mới cho hộp margin/padding                                                | cao     | vừa–cao                      |
| **G8**  | Bảng AI: chip trạng thái trợ lý, thanh nhập (model, AI sửa code, đính kèm, gửi/hủy), tóm tắt thay đổi                                                                                           | Gọn, rõ trạng thái                           | `features/chat`, `features/agents`                                                                | vừa     | thấp                         |
| **G9**  | Màn hình ngoài Editor: trang chủ, hộp Dự án, Cài đặt chia 4 mục, khuôn chung cho mọi hộp thoại (Tin cậy, Cài đặt, Phím tắt, Build, Tạo component, Bản nháp, Router, Xóa, Chọn ảnh, Mất kết nối) | Mọi hộp thoại cùng một kiểu                  | `components/ui/dialog`, `routes/no-project-screen`, `features/project`, `settings`, `trust`, …    | vừa     | thấp                         |
| —       | **Hết đợt 2:** `pnpm verify` + E2E đầy đủ + bạn dùng thử + phát hành                                                                                                                            |                                              |                                                                                                   |         |                              |
| **G10** | (tùy chọn, đợt 3) Sáng / Tối / Theo hệ thống: đổi khoảng 109 chỗ màu đặt thẳng sang biến màu chung                                                                                              | Có chế độ tối                                | khoảng 40–60 file                                                                                 | cao     | thấp                         |

## Mỗi cụm làm theo các bước

1. Chụp ảnh "trước" bằng script G0.
2. Sửa đúng các file của cụm. Gặp chỗ ngoài cụm thì ghi lại, không sửa.
3. Chạy typecheck, lint, `check:i18n`, unit test các thư mục bị sửa, các file E2E liên quan.
4. Chụp ảnh "sau" và đặt cạnh ảnh "trước".
5. Đánh dấu danh sách kiểm tính năng của các vùng bị đụng.
6. Báo bạn kèm ảnh và lệnh commit. Bạn dùng thử, commit, rồi mới sang cụm sau.

## Ngoài phạm vi

- Logic sửa code, Bridge, server.
- Đổi bố cục Canvas khi đang ở chế độ xem riêng từng khung (đã làm ở K9.6-0).
- Chế độ tối trước đợt 3.
