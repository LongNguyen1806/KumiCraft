# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

## Local-First Visual Studio for React Code, with a Local AI Agent

**Tên mã:** ReactCraft Local  
**Phiên bản:** 5.0  
**Trạng thái:** Draft — chờ duyệt  
**Ngày:** 2026-10-13  
**Loại sản phẩm:** Studio chỉnh sửa trực quan chạy trên mã nguồn React thật, có ô chat điều khiển AI agent cài sẵn trên máy  
**Dự án được hỗ trợ:** Vite + React + Tailwind CSS (TypeScript hoặc JavaScript)  
**Mô hình triển khai:** Local-first, không có cloud backend riêng  
**API key AI:** Không dùng. AI chạy qua agent người dùng đã cài và đăng nhập

---

# 0. THAY ĐỔI SO VỚI v4.0

## 0.1. Thay đổi định hướng

| | v4.0 | v5.0 |
|---|---|---|
| Nguồn sự thật của giao diện | Design Model (file JSON riêng) | **Mã nguồn của dự án frontend** |
| Canvas hiển thị | Bản vẽ dựng từ Design Model | **Chính dự án đang chạy** (dev server của dự án) |
| Sửa trực quan | Sửa Design Model | **Sửa trực tiếp file `.tsx`/`.jsx`/`.css`**, thay đổi nhỏ nhất, giữ nguyên định dạng |
| Ra code | Bước "Xuất code" sinh file | Không có bước xuất: code luôn nằm sẵn trong dự án |
| AI | ReactCraft tự gọi API của nhà cung cấp bằng API key | **Ô chat trong Studio điều khiển AI agent cài sẵn** (Antigravity CLI; Claude Code CLI là tùy chọn). AI ghi code thẳng vào dự án |
| Đọc backend | ReactCraft tự quét bằng bộ trích xuất riêng | **AI agent tự đọc** bản sao chỉ đọc của thư mục backend |

Lý do: quy trình của người dùng mục tiêu là **backend trước, frontend sau** (tài liệu tính năng → backend → giao diện). Giao diện phải nối liền với backend thật và sửa được tự do bằng tay, bằng AI và bằng Studio, không bị giới hạn bởi một bộ thiết kế cố định.

---

## 0.2. Phần được giữ lại từ v4.0

- Local-first, một lệnh `reactcraft` khởi động server local và mở Studio trong trình duyệt.
- Bảo mật cổng local: chỉ `127.0.0.1`, token phiên, kiểm tra Host và Origin.
- Workspace trust: mở dự án lạ phải xác nhận tin cậy.
- Khung thiết kế (Desktop, Tablet, Mobile), thu phóng, chế độ `desktop-first` hoặc `mobile-first`.
- Hover, chọn phần tử, Layer Tree, Inspector, kéo thả từ Library, sửa chữ trực tiếp, Undo/Redo, phím tắt.
- Giao diện Studio hai ngôn ngữ `vi`, `en`.

## 0.3. Phần bị loại bỏ khỏi v4.0

- Design Model, Design Operation, file thiết kế `.reactcraft/pages/*.json`.
- Code Generator, Export Manager, xuất HTML/CSS.
- AI Provider Gateway, lưu API key, ngữ cảnh AI tự dựng, prompt tự viết.
- Backend Scanner và các bộ trích xuất (OpenAPI, JS/TS, Django), Data Source Catalog, dữ liệu mẫu, proxy dữ liệu.
- User Component dạng model, Design Token dạng model (thay bằng thao tác trên code và `@theme` của Tailwind).

---

# 1. TỔNG QUAN

## 1.1. Định vị

ReactCraft Local là **studio thiết kế trực quan chạy trên chính mã nguồn React của dự án**. Người dùng mở thư mục frontend (trống hoặc đã có code) và các thư mục backend. Canvas chạy dự án thật; mọi chỉnh sửa trên Studio đều thành thay đổi trong file. Ô chat trong Studio giao việc cho AI agent trên máy, agent đọc backend và viết code frontend khớp với backend. Canvas cập nhật ngay theo code mới.

## 1.2. Không làm (non-goals)

| Mã | Không làm |
|---|---|
| NG-01 | Không có cloud, tài khoản, cộng tác thời gian thực |
| NG-02 | Không tự gọi API của nhà cung cấp AI, không lưu API key |
| NG-03 | Không sửa thư mục backend (chỉ đọc qua bản sao) |
| NG-04 | Không hỗ trợ framework khác Vite + React ở phiên bản 1 (Next.js, Remix, Vue… nằm ngoài phạm vi) |
| NG-05 | Không phải trình soạn thảo code: sửa logic phức tạp dùng editor của người dùng hoặc AI |

---

# 2. VẤN ĐỀ CẦN GIẢI QUYẾT

| # | Vấn đề | Hệ quả hiện nay |
|---|---|---|
| P-01 | Công cụ thiết kế xuất code tách rời dự án | Phải nối giao diện với backend bằng tay hoặc nhờ AI thêm một lần nữa |
| P-02 | Code xuất từ bản thiết kế khó sửa tiếp | Sửa tay xong thì không quay lại công cụ thiết kế được |
| P-03 | AI viết code giao diện nhưng không thấy kết quả trực quan ngay | Phải chạy, xem, mô tả lại cho AI nhiều vòng |
| P-04 | Chỉnh khoảng cách, màu, responsive bằng class Tailwind tốn thời gian | Sửa thử, xem, sửa lại liên tục |

---

# 3. MỤC TIÊU SẢN PHẨM

| Mã | Mục tiêu | Đo bằng |
|---|---|---|
| G-01 | Mọi chỉnh sửa trên Studio là thay đổi tối thiểu trong mã nguồn, xem lại được bằng `git diff` | AC-03, AC-05, AC-06 |
| G-02 | AI viết code khớp backend có sẵn, Canvas hiện kết quả ngay | AC-08, AC-09 |
| G-03 | Người dùng, AI và editor bên ngoài cùng sửa một dự án mà Canvas luôn đúng | AC-10 |
| G-04 | Không làm hỏng mã nguồn: không ghi file lỗi cú pháp, hoàn tác được | NFR-06 đến NFR-09 |

---

# 4. NGƯỜI DÙNG VÀ TÌNH HUỐNG

## 4.1. Người dùng

Developer full-stack hoặc frontend làm việc **backend trước**: đã có tài liệu tính năng, backend có API; cần dựng frontend React + Tailwind nối liền với backend.

## 4.2. Tình huống chính

| # | Tình huống |
|---|---|
| U-01 | Mở thư mục frontend **trống**: ReactCraft tạo khung dự án Vite + React + Tailwind, rồi người dùng nhờ AI dựng các trang theo tài liệu tính năng và API của backend |
| U-02 | Mở dự án frontend **đã có**: chỉnh giao diện trực quan, nhờ AI thêm tính năng |
| U-03 | Chọn một phần tử trên Canvas, nhờ AI sửa đúng phần đó |
| U-04 | Tinh chỉnh khoảng cách, màu, chữ, responsive bằng Inspector; kéo thả thêm khối giao diện |
| U-05 | Vừa sửa trong editor (VS Code…), vừa sửa trên Studio: Canvas luôn hiện đúng code mới nhất |

---

# 5. KIẾN TRÚC KHÁI NIỆM

```text
Trình duyệt ── Studio (Canvas, Overlay, Inspector, Layer Tree, Library, Chat)
                  │ REST + WebSocket (127.0.0.1, token phiên)
Local Server ─────┤
  ├── Project Service    mở, tạo khung, cài dependency, tin cậy
  ├── Project Runner     chạy dev server Vite của dự án + plugin cầu nối
  ├── Source Editor      sửa mã nguồn qua cây cú pháp, ghi nguyên tử
  ├── History            Undo/Redo theo thay đổi file
  ├── Agent Connector    chạy AI agent trên máy, truyền tiến trình về chat
  └── Backend Mirror     bản sao chỉ đọc của backend cho agent
Dự án frontend (người dùng) ── dev server ── iframe Canvas (cầu nối ⇄ Studio)
Thư mục backend (người dùng) ── chỉ đọc, sao ra bản sao
```

---

# 6. NGUYÊN TẮC THIẾT KẾ

| Mã | Nguyên tắc |
|---|---|
| PR-01 | **Mã nguồn là nguồn sự thật duy nhất.** ReactCraft không giữ bản sao giao diện ở dạng khác |
| PR-02 | **Thay đổi tối thiểu:** chỉ đổi đúng phần cần đổi (một chuỗi class, một đoạn chữ, một thẻ JSX); không định dạng lại file |
| PR-03 | **Không ghi file hỏng:** mỗi lần sửa phải phân tích lại được trước khi ghi |
| PR-04 | **Mọi thay đổi hoàn tác được:** chỉnh trên Studio có Undo; mỗi lượt AI có "Hoàn tác lượt này" |
| PR-05 | **Backend chỉ đọc:** agent chỉ thấy bản sao; file bí mật không bao giờ được sao |
| PR-06 | **Không API key:** AI chạy bằng agent người dùng đã cài và đăng nhập |
| PR-07 | **Không chạy code của dự án lạ khi chưa tin cậy:** dev server và agent chỉ chạy khi dự án đã được tin cậy |
| PR-08 | **Studio tôn trọng quy ước Tailwind:** sửa bằng class Tailwind chuẩn; giá trị ngoài thang dùng giá trị tùy ý (`p-[13px]`) |

---

# 7. THUẬT NGỮ

| Thuật ngữ | Nghĩa |
|---|---|
| Dự án (Project) | Thư mục frontend Vite + React + Tailwind người dùng mở trong ReactCraft. Cũng là workspace: cấu hình nằm ở `<dự án>/.reactcraft/workspace.json` |
| Backend liên kết | Thư mục backend người dùng thêm vào để AI đọc |
| Dev server | Máy chủ phát triển Vite **của chính dự án**, do ReactCraft khởi chạy |
| Cầu nối (Bridge) | Plugin Vite và script nhỏ ReactCraft chèn vào dev server (không ghi vào dự án) để Studio biết phần tử nào ứng với dòng code nào |
| Vị trí nguồn | `file:dòng:cột` của thẻ JSX tạo ra một phần tử trên Canvas |
| Thao tác sửa nguồn | Một thay đổi có cấu trúc lên mã nguồn: đổi class, đổi chữ, đổi thuộc tính, chèn, di chuyển, xóa, bọc thẻ JSX |
| Lượt AI | Một lần người dùng gửi yêu cầu trong chat và agent làm việc cho tới khi xong |
| Agent | Công cụ AI dòng lệnh cài trên máy: Antigravity CLI (`agy`), Claude Code CLI (`claude`) |

---

# 8. PHẠM VI DỰ ÁN ĐƯỢC HỖ TRỢ

| Thành phần | Phiên bản 1 | Sau phiên bản 1 |
|---|---|---|
| Bộ dựng | Vite 7, 8 | |
| React | 18, 19 | |
| Ngôn ngữ | TypeScript, JavaScript (JSX) | |
| Tailwind CSS | v4 | v3 |
| Điều hướng trang | `react-router` 6, 7 theo quy ước của ReactCraft (mục FR-50) | Quy ước khác: chỉ xem, điều hướng bằng thanh địa chỉ |
| Package manager | pnpm, npm, yarn | bun |
| Cấu trúc | Một dự án một thư mục | Monorepo |

Dự án ngoài phạm vi: ReactCraft báo E001 kèm lý do cụ thể và không chạy gì.

---

# 9. FUNCTIONAL REQUIREMENTS

## A. DỰ ÁN

| Mã | Yêu cầu |
|---|---|
| FR-01 | Nút **Project** chọn thư mục frontend. Thư mục trống: đề xuất tạo khung dự án từ template của ReactCraft (Vite + React + TypeScript + Tailwind v4 + react-router) |
| FR-02 | Thêm, gỡ một hoặc nhiều **thư mục backend** liên kết; lưu đường dẫn trong `workspace.json` |
| FR-03 | Kiểm tra dự án có thuộc phạm vi mục 8 không; không thuộc thì báo lý do (E001) |
| FR-04 | Cài dependency bằng package manager của dự án, chỉ sau khi người dùng xem đúng lệnh sẽ chạy và đồng ý |
| FR-05 | Hỏi tin cậy trước khi chạy bất cứ thứ gì của dự án (dev server, cài đặt, agent) |
| FR-06 | Chạy dev server của dự án qua ReactCraft, hiển thị trạng thái (đang khởi động, chạy, lỗi build kèm thông báo của Vite), khởi động lại được |

## B. CANVAS

| Mã | Yêu cầu |
|---|---|
| FR-10 | Canvas hiển thị dự án đang chạy trong khung có độ rộng của khung thiết kế đang chọn; thu phóng |
| FR-11 | Rê chuột hiện khung bao phần tử; bấm chọn phần tử; chọn cha trước, đi sâu khi bấm tiếp; Ctrl/Cmd+bấm chọn phần tử sâu nhất; Shift+bấm chọn nhiều |
| FR-12 | Mỗi phần tử được chọn hiện **vị trí nguồn** (file, dòng) và mở được trong editor của người dùng |
| FR-13 | Phần tử lặp từ danh sách (`.map`) hiện nhãn "lặp"; sửa là sửa mẫu chung |
| FR-14 | Phần tử thuộc một component dùng ở nhiều nơi: Inspector báo "thay đổi áp dụng cho mọi nơi dùng <Component>" |
| FR-15 | Layer Tree theo cấu trúc JSX của trang đang xem, đồng bộ chọn hai chiều với Canvas |
| FR-16 | Điều hướng giữa các trang của dự án ngay trên Canvas (danh sách trang, thanh địa chỉ) |
| FR-17 | Lỗi build hoặc lỗi chạy của dự án hiện thành lớp phủ rõ ràng, có file và dòng; Studio không bị treo |

## C. CHỈNH SỬA TRỰC QUAN

| Mã | Yêu cầu |
|---|---|
| FR-20 | Inspector đọc class Tailwind của phần tử thành các nhóm: Bố cục, Vị trí trong cha, Kích thước, Khoảng cách, Chữ, Màu, Viền, Hiệu ứng, Hiển thị. Sửa một ô là đổi đúng class tương ứng trong file |
| FR-21 | Sửa theo khung: ở khung khác khung chuẩn thì ghi class có tiền tố breakpoint (`max-sm:`… với `desktop-first`, `md:`… với `mobile-first`) |
| FR-22 | Sửa theo trạng thái `hover:`, `focus:`, `disabled:` |
| FR-23 | Giá trị theo thang Tailwind (ví dụ `p-4`) hoặc tùy ý (`p-[13px]`); token màu của `@theme` hiện theo tên |
| FR-24 | Sửa chữ trực tiếp trên Canvas (nhấp đúp) khi đoạn chữ là chữ tĩnh trong JSX |
| FR-25 | Sửa thuộc tính: `href`, `src`, `alt`, `placeholder`, `type` của nút |
| FR-26 | Kéo khối từ Library thả vào Canvas: chèn đoạn JSX vào đúng chỗ trong file |
| FR-27 | Di chuyển, nhân bản, xóa, bọc trong Hàng/Cột/Lưới, bỏ bọc phần tử |
| FR-28 | Sao chép, dán phần tử (giữa các trang, các file) |
| FR-29 | Undo/Redo mọi chỉnh sửa trên Studio; không hoàn tác được khi file đã bị sửa từ nơi khác (báo rõ) |
| FR-30 | Phần tử không sửa trực quan được (class là biểu thức, nằm ngoài thư mục nguồn của dự án) hiện chỉ đọc, kèm lý do và nút mở trong editor |
| FR-31 | Phím tắt trên Windows và macOS |

## D. TRANG

| Mã | Yêu cầu |
|---|---|
| FR-50 | Danh sách trang lấy từ file định tuyến theo quy ước của ReactCraft (`src/routes.tsx`, `createBrowserRouter`) |
| FR-51 | Thêm trang: tạo file trang và mục định tuyến; đường dẫn tự sinh từ tên (bỏ dấu tiếng Việt) |
| FR-52 | Đổi tên, xóa trang (xóa có xác nhận, Undo được) |

## E. AI (CHAT)

| Mã | Yêu cầu |
|---|---|
| FR-60 | Ô chat trong Studio. Gửi yêu cầu thì ReactCraft chạy agent đã cài trên máy (ưu tiên Antigravity CLI; Claude Code CLI nếu có), không cần API key |
| FR-61 | Dò agent đã cài; không có thì hướng dẫn cài và đăng nhập. Người dùng chọn agent trong Cài đặt |
| FR-62 | Ngữ cảnh gửi kèm: phần tử đang chọn (vị trí nguồn), trang đang xem, khung đang xem, tài liệu dự án người dùng chỉ định, và quy ước của dự án (file hướng dẫn agent ReactCraft tạo) |
| FR-63 | Agent **ghi code thẳng vào dự án frontend**. Canvas tự cập nhật theo code mới |
| FR-64 | Agent đọc backend qua **bản sao chỉ đọc** (không có file bí mật, không có `node_modules`, `.git`, thư mục build) |
| FR-65 | Chat hiện tiến trình từng bước của agent, hủy được giữa chừng |
| FR-66 | Hết lượt: danh sách file đã đổi, xem diff từng file, nút **"Hoàn tác lượt này"** đưa các file về như trước lượt |
| FR-67 | Hội thoại nhiều lượt; mỗi dự án có lịch sử hội thoại |
| FR-68 | Agent chỉ chạy khi dự án đã được tin cậy |

## F. LIBRARY VÀ THEME

| Mã | Yêu cầu |
|---|---|
| FR-70 | Library gồm các khối JSX + Tailwind dựng sẵn (Hàng, Cột, Lưới, Section, Tiêu đề, Đoạn văn, Ảnh, Nút, Liên kết, Form, Ô nhập, Bảng, Card, Thanh điều hướng, Chân trang, Hero…), có tìm kiếm `vi` và `en` |
| FR-71 | Quản lý token màu, cỡ chữ, bo góc trong `@theme` của file CSS chính (sau phiên bản 1 phần cơ bản) |
| FR-72 | Tách vùng chọn thành component mới (file mới, chỗ cũ thay bằng thẻ component) |

---

# 10. GIỚI HẠN VÀ TRƯỜNG HỢP ĐẶC BIỆT

| # | Trường hợp | Xử lý |
|---|---|---|
| L-01 | `className` là biểu thức (`cn(...)`, điều kiện, biến) | Ô Inspector chỉ đọc cho phần không phải chuỗi tĩnh, có nút mở trong editor |
| L-02 | Chữ là biểu thức `{...}` | Không sửa trực tiếp, mở trong editor |
| L-03 | Phần tử đến từ thư viện ngoài (`node_modules`) | Chọn được để xem; sửa áp dụng cho thẻ dùng component đó trong code dự án |
| L-04 | Phần tử lặp trong `.map` | Sửa mẫu chung, nhãn "lặp N lần" |
| L-05 | Dự án đang lỗi build | Canvas hiện lớp phủ lỗi; Inspector, Layer Tree vẫn đọc theo lần chạy được gần nhất; sửa nguồn vẫn được |
| L-06 | File bị sửa từ bên ngoài | Canvas cập nhật; các bước Undo của file đó không còn dùng được |
| L-07 | Dự án dùng định tuyến khác quy ước | Danh sách trang chỉ đọc; điều hướng bằng thanh địa chỉ |

---

# 11. NON-FUNCTIONAL REQUIREMENTS

## 11.1. Hiệu năng

| Mã | Yêu cầu |
|---|---|
| NFR-01 | Khung hover, khung chọn cập nhật ≤ 16 ms mỗi khung hình |
| NFR-02 | Từ lúc xác nhận một ô Inspector tới khi Canvas hiện thay đổi ≤ 500 ms (P95) trên dự án mẫu |
| NFR-03 | Thao tác sửa nguồn (phân tích, sửa, kiểm tra, ghi) ≤ 100 ms cho file ≤ 2.000 dòng |
| NFR-04 | Dev server sẵn sàng ≤ 15 s với dự án mẫu đã cài dependency |
| NFR-05 | Tạo bản sao backend ≤ 10 s cho backend ≤ 50 MB (không tính thư mục bị loại) |

## 11.2. Độ tin cậy

| Mã | Yêu cầu |
|---|---|
| NFR-06 | Không bao giờ ghi file mà sau khi sửa không phân tích được |
| NFR-07 | Ghi file nguyên tử; mất điện hay tắt đột ngột không để lại file dở |
| NFR-08 | Undo đưa file về **đúng từng byte** như trước thao tác |
| NFR-09 | "Hoàn tác lượt AI" đưa mọi file agent đã đổi về đúng như trước lượt |
| NFR-10 | Agent lỗi, treo, hết hạn mức: mọi chức năng khác vẫn dùng được |

## 11.3. Tương thích

| Mã | Yêu cầu |
|---|---|
| NFR-11 | Windows 10/11, macOS 13+, Ubuntu 22.04+; Studio chạy trên Chrome, Edge, Firefox, Safari bản ổn định |

## 11.4. Đa ngôn ngữ

| Mã | Yêu cầu |
|---|---|
| NFR-12 | Giao diện Studio `vi` và `en`, đổi không cần tải lại. Nội dung dự án không bị dịch |

---

# 12. SECURITY REQUIREMENTS

| Mã | Yêu cầu |
|---|---|
| SEC-01 | Server chỉ lắng nghe `127.0.0.1`, có token phiên, kiểm tra Host và Origin |
| SEC-02 | Thư mục backend không bao giờ bị ghi: agent chỉ nhận bản sao |
| SEC-03 | ReactCraft chỉ ghi trong thư mục dự án frontend và thư mục dữ liệu của chính nó; chặn đường dẫn vượt phạm vi |
| SEC-04 | File bí mật (`.env`, khóa, chứng chỉ…) không bao giờ được sao cho agent, không vào log |
| SEC-05 | Không chạy dev server, cài đặt hay agent trên dự án chưa được tin cậy |
| SEC-06 | Lệnh chạy tiến trình con là cố định, không qua shell, hiển thị cho người dùng trước khi cài dependency |
| SEC-07 | Không lưu, không đọc API key của nhà cung cấp AI |
| SEC-08 | Canvas (iframe khác cổng) chỉ trao đổi với Studio qua kênh có kiểm tra nguồn gửi và mã phiên |
| SEC-09 | Không telemetry, không tự kiểm tra cập nhật |

---

# 13. ERROR MODEL

Mã lỗi đã công bố không đổi nghĩa. Mã của v4.0 không còn dùng được giữ nguyên số, không cấp lại cho nghĩa khác.

| Code | Meaning |
|---|---|
| E001 | Unsupported Project |
| E002 | Server Initialization Failed |
| E003 | Workspace Load Failed |
| E011 | Permission Error |
| E012 | Path Security Violation |
| E013 | Internal Error |
| E014 | Unauthorized |
| E015 | Not Found |
| E016 | Invalid Request |
| E017 | Source Changed (file đã bị sửa từ nơi khác so với lúc đọc) |
| E018 | Busy (dự án đang mở ở phiên khác, hoặc tác vụ cùng loại đang chạy) |
| E019 | Cancelled |
| E020 | Timeout |
| E021 | Not Configured (chưa chọn dự án, chưa có agent) |
| E023 | Source Not Editable (phần tử không sửa trực quan được, kèm lý do) |
| E024 | Edit Breaks Source (sửa xong không phân tích được, không ghi) |
| E025 | Dev Server Error (không khởi động được, dừng đột ngột) |
| E026 | Agent Not Available (chưa cài, chưa đăng nhập) |
| E027 | Agent Run Failed |
| E028 | Install Failed |

Mã ngừng dùng từ v4.0: E004 đến E010, E022.

---

# 14. ACCEPTANCE CRITERIA

## AC-01 — Dự án mới từ thư mục trống

Mở thư mục trống, đồng ý tạo khung và cài dependency. Canvas hiện trang khởi đầu; trang nằm trong `src/pages/`, định tuyến trong `src/routes.tsx`.

## AC-02 — Mở dự án có sẵn

Mở dự án mẫu. Canvas chạy dự án; rê và chọn phần tử hiện đúng file và dòng của thẻ JSX.

## AC-03 — Inspector

Chọn một Card, đổi padding trên cùng thành 40 px. File chỉ đổi đúng chuỗi class (`git diff` một dòng), Canvas cập nhật ≤ 500 ms. Undo: file về đúng từng byte.

## AC-04 — Responsive

Dự án `desktop-first`, khung chuẩn 1440. Ở khung Mobile 375 đổi padding: file thêm class có tiền tố `max-sm:`; khung Desktop giữ giá trị cũ.

## AC-05 — Kéo thả và cấu trúc

Kéo khối Card từ Library vào trang: thẻ JSX được chèn đúng vị trí. Di chuyển, nhân bản, xóa một phần tử; mỗi thao tác một bước Undo.

## AC-06 — Sửa chữ

Nhấp đúp một tiêu đề, gõ chữ tiếng Việt có dấu, Enter: đúng đoạn chữ trong JSX đổi.

## AC-07 — Trang

Thêm trang "Giới thiệu": có `src/pages/GioiThieu.tsx` và đường dẫn `/gioi-thieu` trong `src/routes.tsx`; Canvas mở được trang mới.

## AC-08 — AI dựng trang từ backend

Dự án mới, liên kết backend mẫu Express có API sản phẩm. Trong chat: "Tạo trang quản lý sản phẩm theo API của backend". Agent viết lớp gọi API và trang; Canvas hiện trang có bảng và form đúng các trường của backend. Thư mục backend không đổi byte nào. "Hoàn tác lượt này" đưa dự án về như trước.

## AC-09 — AI trên phần tử

Chọn một Card, chat "thêm nút Mua ngay dưới giá". Chỉ file chứa Card đổi; Canvas hiện nút mới.

## AC-10 — Sửa từ bên ngoài

Sửa một file trang bằng editor khác khi Studio đang mở: Canvas cập nhật; Undo của file đó báo E017 thay vì ghi đè.

## AC-11 — Bảo mật

Token sai hoặc Origin lạ bị từ chối. Dự án chưa tin cậy không chạy dev server, không cài đặt, không chạy agent. Chuỗi đánh dấu trong `.env` của backend mẫu không xuất hiện trong bản sao, log, chat.

## AC-12 — Phần tử không sửa được

Phần tử có `className={cn(...)}`: Inspector chỉ đọc, nêu lý do, nút mở đúng file và dòng trong editor.
