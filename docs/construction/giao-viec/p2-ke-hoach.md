# Kế hoạch giao việc Phase 2 — Cấu trúc, trang và thiết kế dự án mới

**Ngày:** 2026-10-17 · **WP:** 2.01 (SPEC-07 mục 4) · **Người đọc:** chủ dự án, Gemini, Claude

## 1. Mục tiêu

Cuối Phase 2, người dùng **tạo một dự án mới rồi thiết kế được trọn vẹn** trong ReactCraft, không cần mở editor:

- chèn khối từ Library, vẽ khung, chữ, ảnh;
- kéo thả, di chuyển, xóa, nhân bản, bọc, sao chép và dán;
- thêm, đổi tên, xóa trang;
- gom phần đã thiết kế thành component, dùng lại và sửa component;
- đổi màu thương hiệu và font trong panel Brand.

Dự án có sẵn (như WorkTracker) cũng dùng được các công cụ trên ở mức an toàn: chỉ sửa khi chắc chắn đúng, không thì báo lý do.

**Cổng G2:** `pnpm verify` xanh với trace Phase 2; AC-05, AC-07 và kịch bản kiểm tay G2 (mục 5) đạt trên dự án mới và dự án có sẵn; bộ E2E hồi quy của Phase 1 vẫn xanh trên Chromium.

## 2. Cách làm (đã đổi so với Phase 1)

| Việc               | Phase 2                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hợp đồng từng lượt | Claude viết `p2-luot<N>-<tên>.md` ngay trước khi giao: file tạo và sửa, kiểu, API, `data-testid`, khóa i18n, thuật toán, bẫy đã biết, **danh sách tình huống test**, **mục Kiểm tay** |
| Test               | Gemini viết unit, component, integration test đúng các tình huống đã ghi. **Không viết E2E Playwright mới** (SPEC-06 mục 1, 7)                                                        |
| QA                 | Claude chạy `pnpm verify`, đọc từng file, đối chiếu test với tình huống                                                                                                               |
| Kiểm tay           | Chủ dự án chạy mục Kiểm tay trên **dự án mới tạo** và **WorkTracker**. Đạt thì commit; lỗi thì sửa trước lượt sau                                                                     |
| E2E hồi quy        | Chỉ Chromium; chạy ở cổng G2 và ở lượt đụng Bridge, runner, phiên                                                                                                                     |
| Kích thước lượt    | ≤ 600 dòng code, ≤ 15 tình huống test, một mục tiêu người dùng thấy được                                                                                                              |
| Trace              | `currentPhase` giữ 1 trong lúc làm; mỗi lượt gắn mã `[R-xx]` vào test; chuyển sang 2 ở cổng G2                                                                                        |

## 3. Thứ tự các lượt

Ưu tiên theo **luồng thiết kế dự án mới**: sau lượt 5 người dùng đã tạo dự án, thêm trang, chèn khối, xóa và nhân bản được. Các lượt sau làm cho luồng đó đầy đủ hơn.

| Lượt | WP          | Nội dung                                                                                                                                                                                                                                                      | Mã quy tắc                           | Phụ thuộc | Ai code                                                       |
| ---- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------- | ------------------------------------------------------------- |
| 0    | —           | Dọn tồn đọng giao diện: panel Lớp thu gọn phần ruột của `svg`; Canvas vừa khung theo mức thu phóng (không cuộn ngang ở 75%)                                                                                                                                   | R-SL, R-RN-21                        | —         | Claude                                                        |
| 1    | 2.00        | **Template dự án mới đầy đủ** theo ADR-BE-32: `routes.tsx` có `MainLayout` + 3 trang, `Header`, `Footer`, `ProductCard`, `components/ui/*`, `@theme` có màu thương hiệu, ảnh SVG mẫu, README, eslint; build và lint được; ReactCraft mở với `supported: true` | ADR-BE-32, R-PJ (tạo dự án)          | —         | Gemini                                                        |
| 2    | 2.02a       | **M-SE cấu trúc, phần 1:** con JSX, đích hợp lệ, `insert`, `remove`, `duplicate`; `POST /source/edits/batch` (tất cả hoặc không); mục lịch sử một lần                                                                                                         | R-SE-20, 21, 22, 25, 26, 29          | 1         | Gemini (Claude viết sẵn test khóa cho thuật toán chèn và xóa) |
| 3    | 2.02b       | **M-SE cấu trúc, phần 2:** `move` (cùng file, khác file), `wrap`, `unwrap`, import còn thiếu, `GET /source/element-text`; VG-16 mở rộng trên bộ 40 file                                                                                                       | R-SE-23, 24, 27, 28, 30              | 2         | Gemini                                                        |
| 4    | 2.03 + 2.06 | **Library + phím tắt:** panel Library (16 khối, tìm `vi`/`en` không dấu), bấm để chèn sau phần tử đang chọn; phím Xóa, Nhân bản, Bọc, Bỏ bọc, Undo/Redo theo bảng M-KB, Bridge chuyển phím từ iframe                                                          | R-LB-10 đến 15, R-KB-10 đến 13       | 2, 3      | Gemini                                                        |
| 5    | 2.05        | **Trang:** thêm, đổi tên, xóa trang theo `routes.tsx`; hộp thoại chọn hoặc tạo thư mục và tên file; tạo và xóa file nằm trong lịch sử (Undo tạo lại file); mục Thư mục mặc định trong hộp thoại Project                                                       | R-PG-10 đến 14, R-HI-11, R-CP-10, 16 | 2         | Gemini                                                        |
| 6    | 2.04a       | **Kéo thả:** tay cầm trên khung chọn, kéo trong Canvas, kéo từ Layer Tree và Library vào Canvas; chỉ báo vị trí thả; tự cuộn; Esc hủy                                                                                                                         | R-DD-10 đến 17                       | 3, 4      | Gemini + Claude (Bridge)                                      |
| 7    | 2.04b       | **Sao chép, cắt, dán, chọn nhiều:** clipboard hệ thống, dán giữ import, Inspector khi chọn nhiều (giá trị chung hoặc "Hỗn hợp", sửa hàng loạt một mục lịch sử)                                                                                                | R-CB-10 đến 15                       | 3         | Gemini                                                        |
| 8    | 2.08a       | **Component, phần 1:** thanh "Đang thiết kế", panel Component (liệt kê, số chỗ dùng), chèn component có import (alias `@/` khi dự án có)                                                                                                                      | R-CP-11, 12, 13                      | 4, 5      | Gemini                                                        |
| 9    | 2.08b       | **Component, phần 2:** tạo component từ phần tử đang chọn (chặn khi dùng biến cục bộ), chế độ sửa component bằng bấm đúp                                                                                                                                      | R-CP-14, 15                          | 8         | Gemini                                                        |
| 10   | 2.11        | **Bản nháp:** thư mục `src/drafts/`; tạo (trắng hoặc khung tự do), đổi tên, nhân bản, xóa; Canvas xem bản nháp qua trang riêng của plugin Vite (ngoài router, có CSS của dự án); thanh "Đang thiết kế" loại Bản nháp; chuyển thành trang hoặc component       | R-DR-10 đến 16                       | 5, 9      | Gemini + Claude (plugin Vite)                                 |
| 11   | 2.12a       | **Khung tự do, phần 1:** bật/tắt khung tự do (đo vị trí thật), `placement` cho `insert`/`move` (thả đúng chỗ chuột), kéo di chuyển trong khung, chấm kéo giãn (khung tự do và chỗ thường), lưới hít, đổi px sang class Tailwind                               | R-FF-10 đến 14, 19, 20               | 6, 10     | Gemini + Claude (Bridge)                                      |
| 11b  | 2.12c       | **Dễ chọn phần tử:** chuột phải trên Canvas → danh sách "Chọn lớp" (mọi phần tử dưới điểm bấm, từ ngoài vào trong); đường dẫn phần tử ở đầu Inspector, bấm để chọn bậc cha; gợi ý "Esc: chọn cha"                                                             | R-SL-13, R-SL-14                     | 11        | Gemini + Claude (Bridge)                                      |
| 12   | 2.12b       | **Khung tự do, phần 2:** phím mũi tên, thứ tự lớp, căn và phân bố, đường gióng thông minh, nhóm Vị trí X Y W H trong Inspector                                                                                                                                | R-FF-15 đến 18                       | 11        | Gemini                                                        |
| 13   | 2.09        | **Công cụ vẽ:** Khung, Chữ, Ảnh trên Canvas; tải ảnh vào `public/images/` (kiểm byte đầu, 5 MB, chặn SVG nguy hiểm); Undo xóa cả ảnh                                                                                                                          | R-DT-10 đến 15                       | 2, 4      | Gemini + Claude (Bridge)                                      |
| 14   | 2.10        | **Panel Brand:** xem, sửa, thêm, xóa token `@theme` (màu, font, cỡ chữ, bo góc, bóng); đếm chỗ dùng trước khi xóa                                                                                                                                             | R-TH-10 đến 14                       | 1         | Gemini                                                        |
| 15   | 2.07 + G2   | **CLI hoàn chỉnh và gói cài:** tham số, tắt an toàn, `pnpm package`, kiểm máy sạch; **cổng G2**: trace Phase 2, E2E hồi quy, kiểm tay G2                                                                                                                      | R-CL-01 đến 04                       | tất cả    | Gemini + Claude (cổng)                                        |

Lượt 13 (công cụ vẽ) và 14 (Brand) không phụ thuộc lượt 10 đến 12; đổi thứ tự được nếu chủ dự án cần sớm. Lượt 10 đến 12 (bổ sung 2026-10-19 theo chủ dự án) làm tỉ mỉ: mỗi lượt có danh sách kiểm tay dài hơn và Claude soi kỹ phần Bridge.

**Việc để sau (chủ dự án, 2026-10-18):** Library mới có 16 khối, còn ít. Bổ sung khối sau các lượt chính (trước cổng G2 hoặc ở Phase 4); chỉ thêm dữ liệu vào `packages/shared/src/library/`, không đổi hợp đồng.

**Việc để sau (Claude, 2026-10-19):** các API client của Studio còn khoảng 16 chỗ ép kiểu `as` dữ liệu từ server (`project-client`, `runner-client`, `settings-client`, `source-client`); lỗi Undo một bước có cùng gốc. Đổi sang parse bằng schema ở lượt 15 (cổng G2), có test cho từng client.

## 4. Kiểm tay từng lượt (bản rút gọn)

Bản giao việc của mỗi lượt có danh sách đầy đủ (5–10 bước). Ở đây là ý chính để chủ dự án biết sẽ thử gì. "Mới" là dự án mới tạo, "WT" là WorkTracker.

| Lượt | Thử trên | Ý chính                                                                                                                                                                                                                         |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Mới, WT  | Panel Lớp không còn `defs`, `stop`, `path` trải dài; 75% không có thanh cuộn ngang                                                                                                                                              |
| 1    | Mới      | Tạo dự án, cài, Canvas hiện Home có Header, hero, 3 thẻ sản phẩm, Footer; ô Trang có Home, About; `pnpm build` trong dự án chạy được                                                                                            |
| 2    | Mới, WT  | Chọn một thẻ → Xóa → file mất đúng thẻ đó, không dòng trống thừa; Nhân bản; Undo trả lại nguyên file; xóa phần tử gốc của trang bị chặn và báo lý do                                                                            |
| 3    | Mới, WT  | Bọc 2 nút thành hàng; Bỏ bọc; di chuyển phần tử sang section khác; file đúng, Undo đúng                                                                                                                                         |
| 4    | Mới, WT  | Tìm "nút" và "button" đều ra khối Nút; bấm khối chèn sau phần tử đang chọn; phím Delete, Ctrl+D hoạt động cả khi đang bấm trong Canvas                                                                                          |
| 5    | Mới, WT  | Thêm trang "Giới thiệu" vào thư mục tự gõ mới; trang hiện trong ô Trang và chuyển tới được; đổi tên; xóa; Undo tạo lại file đã xóa. WT: xem ReactCraft xử lý router không theo quy ước ra sao (được phép chỉ báo "chưa hỗ trợ") |
| 6    | Mới, WT  | Kéo một section lên trên section khác; kéo Card từ Library vào giữa hai section; Esc giữa chừng không đổi gì; không thả được vào bên trong component khác file                                                                  |
| 7    | Mới, WT  | Ctrl+C, Ctrl+V một Card sang trang khác (import được thêm); chọn 3 nút, đổi màu một lần, Undo một lần                                                                                                                           |
| 8    | Mới      | Thanh "Đang thiết kế" ghi đúng file; panel Component có Header, ProductCard…; chèn ProductCard vào About có import                                                                                                              |
| 9    | Mới      | Tạo component PromoBox từ một khối Home; bấm đúp Header, đổi màu nền, mọi trang đổi theo                                                                                                                                        |
| 10   | Mới      | Tạo bản nháp trắng và bản nháp khung tự do; chèn Button có đúng màu brand; đổi tên, nhân bản, xóa, Undo; chuyển bản nháp thành trang `/khuyen-mai` rồi mở trang đó; `pnpm build` chạy                                           |
| 11   | Mới      | Bật khung tự do cho một khung có sẵn: các ô không xê dịch; thả Card đúng chỗ chuột; kéo ô, kéo giãn 8 chấm, Shift giữ tỉ lệ, Esc hủy; thu phóng 50% vẫn đúng; mỗi lần thả một Undo                                              |
| 11b  | Mới, WT  | Chuột phải lên ảnh trong thẻ sản phẩm → danh sách có `section`, `div grid`, `article`, `img`; bấm `div grid` chọn đúng lưới; đường dẫn trong Inspector bấm `section` lùi đúng một bậc; không còn phải bấm lặp                   |
| 12   | Mới      | Mũi tên dịch 8 px, Shift 1 px; đưa ô lên trên cùng; chọn 3 ô căn trái và phân bố đều; đường gióng hồng hiện khi gần thẳng hàng; sửa số X Y W H trong Inspector                                                                  |
| 13   | Mới, WT  | Vẽ khung giữa hai section; công cụ Chữ vào sửa chữ ngay; tải ảnh có dấu trong tên, Undo xóa cả file ảnh                                                                                                                         |
| 14   | Mới, WT  | Đổi màu `brand`, nút trên Canvas đổi theo; thêm màu; xóa màu đang dùng thì hỏi xác nhận kèm số chỗ dùng                                                                                                                         |
| 15   | Máy sạch | Cài từ tarball vào thư mục trống, `npx reactcraft`, tạo dự án tới Canvas; Ctrl+C tắt hết tiến trình con                                                                                                                         |

## 5. Kịch bản kiểm tay cổng G2

Chạy trên Windows, giao diện `vi`, sau đó lặp lại bước 1 và 7 ở `en`:

1. Thư mục trống → Project → tạo dự án mới → cài → Canvas hiện Home của template.
2. Thêm trang "Bảng giá" ở `src/pages/pricing`; chuyển sang trang đó bằng ô Trang.
3. Kéo Hero và Card từ Library vào trang; vẽ một khung; tải một ảnh.
   3a. Tạo bản nháp khung tự do "Mockup"; thả 3 ô, kéo giãn, căn trái; chuyển thành component `MockupBox` và chèn vào trang "Bảng giá".
4. Bọc 3 Card thành lưới; nhân bản một Card; xóa một Card.
5. Tạo component `PricingCard` từ một Card; chèn `PricingCard` vào Home.
6. Đổi màu `brand` trong panel Brand; Header và các nút đổi màu.
7. Undo từng bước về đầu: mọi file về đúng như sau bước 1 (`git diff` rỗng).
8. Mở WorkTracker: chọn, sửa class, xóa, nhân bản, chèn khối từ Library hoạt động; thao tác không hỗ trợ báo lý do rõ ràng, không làm hỏng file.
9. `pnpm build` trong dự án ở bước 1 chạy được sau tất cả thay đổi.

## 6. Rủi ro đã biết

| Rủi ro                                                                                              | Cách giữ                                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Thao tác cấu trúc làm hỏng file của dự án có sẵn (biểu thức, `.map`, Fragment, component khác file) | Lượt 2–3 có test khóa trên bộ 40 file (VG-16); mọi sửa phân tích lại sau khi ghi (R-SE-29); không chắc thì E023 và không ghi                    |
| Router của dự án có sẵn không theo `routes.tsx`                                                     | Lượt 5: thêm, đổi, xóa trang chỉ làm khi đúng quy ước R-PG-10; còn lại vẫn **đọc và chuyển trang** được (đã có), thao tác ghi báo "chưa hỗ trợ" |
| Bridge chạy trong dự án người dùng (kéo thả, vẽ) dễ lệch tọa độ khi thu phóng                       | Lượt 0 sửa thu phóng trước; lượt 6 và 10 Claude làm phần Bridge                                                                                 |
| Gemini viết test cho qua                                                                            | Bản giao việc ghi tình huống cụ thể; Claude đối chiếu từng tình huống; kiểm tay bắt phần còn lại                                                |
| Thiếu kiểm tra trên trình duyệt khác Chromium                                                       | Chấp nhận ở Phase 2 (quyết định 2026-10-17); xem lại ở Phase 4 trước phát hành                                                                  |
