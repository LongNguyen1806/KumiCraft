# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

## Local-First AI Design Studio & React Code Generator

**Tên mã:** ReactCraft Local  
**Phiên bản:** 4.0  
**Trạng thái:** Draft — chờ duyệt  
**Ngày:** 2026-10-07  
**Loại sản phẩm:** Local Design Studio + Code Generator  
**Đầu ra mục tiêu:** React + Vite + TypeScript + Tailwind CSS; HTML/CSS thuần  
**Mô hình triển khai:** Local-first  
**Cloud/SaaS Backend:** Không yêu cầu

---

# 0. THAY ĐỔI SO VỚI v3.0

## 0.1. Thay đổi định hướng

SRS v3.0 mô tả một **overlay chèn vào app thật đang chạy**, sửa trực tiếp source code trên disk.

SRS v4.0 đổi sang một **môi trường thiết kế riêng (Studio)**:

| | v3.0 | v4.0 |
|---|---|---|
| Làm việc trên | App thật đang chạy | Canvas thiết kế riêng |
| Nguồn sự thật của giao diện | Source code trên disk | **Design Model** (bản thiết kế dạng dữ liệu) |
| Cách tạo giao diện | Sửa giao diện có sẵn | Kéo thả component để dựng trang |
| AI sửa gì | File source code | **Design Model**, qua thao tác có cấu trúc |
| Đọc backend | Không có | Đọc thư mục backend để hiểu API và dữ liệu |
| Đầu ra | Code đã sửa tại chỗ | **Xuất code** React hoặc HTML vào project đích |

---

## 0.2. Phần được giữ lại từ v3.0

- Local-first, không cần cloud backend.
- Local Backend là lớp hiểu ngữ cảnh (Context Engine).
- AI chỉ đề xuất, người dùng duyệt trước khi áp dụng.
- AI Provider Gateway nhiều provider, hỗ trợ Ollama.
- Bảo mật: path boundary, loại secrets khỏi context AI, AI không chạy shell.
- Transaction, rollback, phát hiện xung đột khi ghi file.
- Nhận biết kiến trúc và quy ước của project đích.
- Quy tắc component dùng chung chỉ chứa layout, business logic ở từng trang (FR-32 cũ).

---

## 0.3. Phần bị loại bỏ khỏi v3.0

- Overlay chèn vào app đang chạy.
- Source Mapping từ DOM về JSX.
- Sửa source code tại chỗ bằng AST trên code bất kỳ.
- Đồng bộ với Vite HMR của app thật.

---

# 1. TỔNG QUAN

## 1.1. Tên dự án

**ReactCraft Local**

Mô tả:

> Local-first design studio cho phép dựng giao diện web bằng kéo thả trên layout có cấu trúc, hiểu dữ liệu thật từ thư mục backend của người dùng, dùng AI để tạo và chỉnh sửa giao diện, rồi xuất ra code React hoặc HTML sạch vào project của người dùng.

---

## 1.2. Định vị

ReactCraft Local là:

> **A Local, Context-Aware AI Design Studio that exports production-quality React code.**

Ba điểm khác biệt so với công cụ thiết kế và AI sinh code hiện có:

1. **Hiểu backend thật.** Đọc API và model dữ liệu từ thư mục backend, gắn trực tiếp vào giao diện.
2. **AI sửa bản thiết kế, không sửa code.** Mọi thay đổi của AI là thao tác có cấu trúc, được kiểm tra trước khi áp dụng.
3. **Code xuất ra như người viết.** Đúng quy ước của project đích, responsive, không phụ thuộc runtime của ReactCraft.

---

# 2. VẤN ĐỀ CẦN GIẢI QUYẾT

Quy trình làm giao diện hiện nay thường là:

```text
Thiết kế trên công cụ thiết kế
   ↓
Bàn giao cho developer
   ↓
Viết lại toàn bộ giao diện bằng tay
   ↓
Đọc code backend để biết API, field
   ↓
Gắn API vào giao diện bằng tay
   ↓
Sửa lệch giữa thiết kế và code
```

Các công cụ AI sinh giao diện giúp nhanh hơn nhưng có ba hạn chế:

- không biết backend thật của project, nên bịa field và API;
- không theo quy ước thư mục và đặt tên của project;
- khó kiểm soát: mỗi lần nhờ sửa có thể sinh lại cả đoạn code.

ReactCraft Local rút ngắn quy trình:

```text
Mở Studio
   ↓
Liên kết backend + project đích
   ↓
Kéo thả / nhờ AI dựng trang (có dữ liệu thật)
   ↓
Chọn phần tử, chỉnh tay hoặc nhờ AI sửa
   ↓
Xem trước code, duyệt
   ↓
Xuất code vào project
```

---

# 3. MỤC TIÊU SẢN PHẨM

ReactCraft Local phải cho phép người dùng:

1. Tạo và mở workspace thiết kế trên máy.
2. Dựng trang bằng kéo thả component từ thư viện.
3. Sắp xếp bố cục trên layout có cấu trúc (flex, grid).
4. Chọn phần tử và chỉnh thuộc tính trực quan.
5. Thiết kế responsive theo breakpoint.
6. Quản lý design token (màu, chữ, khoảng cách, bo góc).
7. Liên kết thư mục backend để đọc API và model dữ liệu.
8. Gắn dữ liệu backend vào component (bảng, danh sách, form).
9. Xem trước giao diện với dữ liệu mẫu sinh từ schema.
10. Chọn phần tử và nhờ AI chỉnh sửa.
11. Nhờ AI dựng trang mới dựa trên dữ liệu backend.
12. Xem trước và duyệt mọi thay đổi của AI.
13. Xuất code React + TypeScript + Tailwind vào project đích.
14. Xuất code HTML/CSS thuần.
15. Xem diff trước khi ghi, không bị ghi đè âm thầm.
16. Dùng nhiều AI provider, kể cả Local LLM qua Ollama.
17. Không phải upload thiết kế hay source code lên ReactCraft Cloud.

---

# 4. NGƯỜI DÙNG VÀ TÌNH HUỐNG SỬ DỤNG

## 4.1. Nhóm người dùng

| Nhóm | Mô tả | Nhu cầu chính |
|---|---|---|
| Fullstack developer, sinh viên | Đã có backend, cần làm giao diện nhanh | Dựng trang có dữ liệu thật, xuất code dùng được ngay |
| Frontend developer | Làm giao diện cho backend của người khác | Hiểu API nhanh, code đúng quy ước project |
| Designer biết code cơ bản | Muốn thiết kế ra code thật | Kéo thả trực quan, code xuất ra sạch |

---

## 4.2. Tình huống sử dụng

| Mã | Tình huống |
|---|---|
| UC-01 | Người dùng tạo workspace, liên kết project React đích và thư mục backend |
| UC-02 | Người dùng kéo Navbar, Section, Card vào trang và chỉnh khoảng cách, màu sắc |
| UC-03 | Người dùng kéo bảng vào trang, gắn với nguồn dữ liệu `Product`, bảng tự có cột theo field |
| UC-04 | Người dùng chọn một card, nhờ AI "làm hiện đại hơn", xem trước rồi chấp nhận |
| UC-05 | Người dùng nhờ AI "tạo trang quản lý sản phẩm", AI dựng trang có bảng, form thêm/sửa gắn API thật |
| UC-06 | Người dùng xuất trang ra project đích, xem diff, duyệt, rồi chạy `npm run dev` thấy trang hoạt động |
| UC-07 | Người dùng sửa thiết kế và xuất lại. ReactCraft phát hiện file đã bị sửa tay và yêu cầu xác nhận |

---

# 5. KIẾN TRÚC KHÁI NIỆM

```text
┌──────────────────── ReactCraft Studio (Web UI) ────────────────────┐
│ Library     │            Canvas            │ Inspector             │
│ Layer Tree  │  (preview cô lập, kéo thả,   │ Data Sources          │
│             │   chọn phần tử)              │ AI Panel · Export     │
└─────────────────────────────────┬──────────────────────────────────┘
                                  │ HTTP / WebSocket (localhost)
┌─────────────────────────────────▼──────────────────────────────────┐
│                     ReactCraft Local Backend                       │
│                                                                    │
│  Workspace Manager          Design Store                           │
│  Design Operation Engine    Validation Engine                      │
│  Backend Context Engine     Target Project Analyzer                │
│  AI Context Builder         AI Provider Gateway                    │
│  Code Generator             Export Manager                         │
│                             (Diff · Transaction · Conflict)        │
└───────┬──────────────────┬──────────────────┬──────────────┬───────┘
        │ đọc/ghi          │ chỉ đọc          │ ghi khi xuất │
        ▼                  ▼                  ▼              ▼
   Workspace          Thư mục backend    Project đích    AI Providers
   .reactcraft/       Django, Express,   React + Vite    OpenAI, Claude,
   (bản thiết kế)     Spring, OpenAPI…                   DeepSeek, Ollama
```

---

# 6. NGUYÊN TẮC THIẾT KẾ

## 6.1. Local-first

Bản thiết kế, source backend và project đích được xử lý trên máy người dùng. Không cần cloud để hoạt động.

---

## 6.2. Design Model là nguồn sự thật của thiết kế

Giao diện trong Studio được lưu dưới dạng **Design Model**: cây phần tử có schema chặt, có phiên bản.

- Canvas hiển thị từ Design Model.
- Inspector, kéo thả, AI đều thay đổi Design Model qua **Design Operation**.
- Code được **sinh ra** từ Design Model khi export.

---

## 6.3. Layout có cấu trúc

Mọi phần tử nằm trong container có layout **flex** hoặc **grid**.

**Không** hỗ trợ đặt phần tử ở tọa độ tự do (absolute positioning tùy ý).

Lý do:

> Layout có cấu trúc cho ra code giống code developer tự viết, responsive được, và AI hiểu được.

---

## 6.4. Backend chỉ đọc

ReactCraft **không bao giờ** ghi vào thư mục backend.

---

## 6.5. Code xuất ra thuộc về developer

- Code xuất ra không phụ thuộc thư viện runtime của ReactCraft.
- Developer có toàn quyền sửa code sau khi xuất.
- Xuất code là **một chiều**: sửa code không cập nhật ngược lại Design Model.

---

## 6.6. Nguyên tắc AI

```text
AI proposes.
Studio validates.
User approves.
Generator writes clean code.
Developer owns the code.
```

---

# 7. THUẬT NGỮ

| Thuật ngữ | Định nghĩa |
|---|---|
| **Workspace** | Một thư mục thiết kế, chứa Design Model và cấu hình liên kết |
| **Design Document** | Toàn bộ thiết kế của workspace: trang, component, token |
| **Page** | Một trang, tương ứng một route khi xuất code |
| **Node** | Một phần tử trong cây thiết kế, có ID ổn định |
| **Library Component** | Component có sẵn trong thư viện của Studio (Button, Card, Table…) |
| **User Component** | Component do người dùng tạo từ một nhóm node, dùng lại nhiều nơi |
| **Design Token** | Giá trị thiết kế dùng chung: màu, cỡ chữ, khoảng cách, bo góc, bóng |
| **Data Source** | Nguồn dữ liệu phát hiện từ backend: endpoint và entity kèm field |
| **Binding** | Liên kết giữa thuộc tính của node và field của Data Source |
| **Target Project** | Project React + Vite nơi code được xuất vào |
| **Design Operation** | Một thao tác có cấu trúc trên Design Model (thêm, sửa, xóa, di chuyển node…) |
| **Export** | Quá trình sinh code từ Design Model và ghi vào Target Project |
| **Interaction** | Quy tắc "khi [sự kiện] trên [phần tử] → chạy [hành động]" (FR-39) |
| **Content Locale** | Ngôn ngữ của trang web đang thiết kế, khác ngôn ngữ giao diện Studio |

---

# 8. DESIGN MODEL

## 8.1. Cấu trúc

```text
Design Document
├── Tokens        (màu, typography, spacing, radius, shadow)
├── Pages
│   └── Page
│       └── Node tree
├── User Components
│   └── Component
│       └── Node tree
└── Data Bindings (tham chiếu Data Source)
```

---

## 8.2. Loại node

| Nhóm | Node |
|---|---|
| Layout | Stack (hàng / cột), Grid, Section, Container |
| Nội dung | Text, Heading, Image, Icon, Link, Divider |
| Form | Form, Input, Textarea, Select, Checkbox, Radio, Switch, Button |
| Dữ liệu | Table, List (lặp theo dữ liệu), Detail View |
| Tổng hợp | Card, Navbar, Sidebar, Footer, Modal, Tabs |
| Tái sử dụng | User Component Instance |

---

## 8.3. Thuộc tính của node

| Nhóm | Thuộc tính |
|---|---|
| Layout | direction, gap, align, justify, wrap, grid columns/rows |
| Kích thước | width, height, min/max (fill, hug, fixed) |
| Khoảng cách | padding, margin |
| Typography | font size, weight, line height, align, màu chữ |
| Màu sắc | nền, viền |
| Viền & hiệu ứng | border, radius, shadow, opacity |
| Nền nâng cao | gradient tuyến tính, ảnh nền |
| Vị trí, tràn | dính khi cuộn (sticky), lớp (z-index), tràn ngang/dọc |
| Chuyển động | transition cho trạng thái hover/focus |
| Trạng thái | hover, focus, disabled |
| Tương tác | khi [sự kiện] → [hành động] (FR-39) |
| Responsive | Giá trị ghi đè theo breakpoint |
| Dữ liệu | Binding tới Data Source |

Giá trị thuộc tính **NÊN** tham chiếu Design Token thay vì giá trị cứng.

---

## 8.4. Ví dụ

```json
{
  "id": "n_01J9X2",
  "type": "Card",
  "props": {
    "padding": "token:spacing.6",
    "radius": "token:radius.lg",
    "background": "token:color.surface"
  },
  "responsive": {
    "md": { "padding": "token:spacing.8" }
  },
  "children": [
    { "id": "n_01J9X3", "type": "Heading", "props": { "level": 3 },
      "binding": { "text": "ds:products.name" } },
    { "id": "n_01J9X4", "type": "Text",
      "binding": { "text": "ds:products.price", "format": "currency" } }
  ]
}
```

---

## 8.5. Yêu cầu đối với Design Model

1. Mỗi node có **ID ổn định**, không đổi khi di chuyển hoặc sửa.
2. Design Model có **schema phiên bản hóa**. Mở workspace phiên bản cũ phải được nâng cấp tự động.
3. Mọi thay đổi đi qua **Design Operation**, không sửa trực tiếp.
4. Design Model được lưu dạng file văn bản (JSON) trong workspace, có thể đưa vào Git.

---

# 9. FUNCTIONAL REQUIREMENTS

## A. WORKSPACE VÀ LIÊN KẾT

### FR-01 — Workspace

Người dùng có thể tạo mới, mở, đóng workspace.

Workspace lưu trong thư mục `.reactcraft/` gồm Design Document và cấu hình liên kết.

Mỗi workspace có **ngôn ngữ nội dung** (ngôn ngữ của trang web đang thiết kế, ví dụ `vi-VN`), dùng cho chữ mẫu, dữ liệu mẫu, định dạng số/tiền/ngày và thuộc tính `lang` khi xuất. Ngôn ngữ nội dung độc lập với ngôn ngữ giao diện Studio.

---

### FR-02 — Lưu tự động và khôi phục

- Tự động lưu sau mỗi thay đổi (debounce).
- Ghi file nguyên tử, không để file ghi dở.
- Giữ một số bản lưu trước để khôi phục khi file hỏng.

---

### FR-03 — Liên kết Target Project

Người dùng chọn thư mục project đích. Hệ thống phải phát hiện:

- React và phiên bản;
- Vite;
- TypeScript;
- Tailwind và phiên bản (v3/v4);
- path alias;
- package manager;
- thư mục source, components, pages.

Nếu project không được hỗ trợ, hệ thống phải thông báo lý do.

Người dùng có thể chọn **tạo project mới** từ template React + Vite + TypeScript + Tailwind.

---

### FR-04 — Liên kết Backend

Người dùng chọn một hoặc nhiều thư mục backend.

Backend được truy cập ở chế độ **chỉ đọc**.

---

## B. CANVAS VÀ CHỈNH SỬA

### FR-05 — Canvas

- Hiển thị trang đang thiết kế từ Design Model.
- Vùng xem trước được **cô lập** khỏi giao diện Studio (CSS của Studio và của thiết kế không ảnh hưởng nhau).
- Chọn khung thiết kế: Desktop, Tablet, Mobile và khung tùy chỉnh (rộng × cao, ví dụ 1920 × 1200).
- Mỗi workspace có một **khung chuẩn** để thiết kế chính. Mặc định Desktop 1440 × 900.
- Phóng to, thu nhỏ, cuộn.

---

### FR-06 — Component Library

- Hiển thị các Library Component theo nhóm ở mục 8.2.
- Tìm kiếm component theo tên.
- Hiển thị User Component của workspace.

---

### FR-07 — Kéo thả

- Kéo component từ Library vào Canvas hoặc Layer Tree.
- Di chuyển, sắp xếp lại node đã có.
- Chỉ cho thả vào **vị trí hợp lệ** (bên trong container layout).
- Hiển thị chỉ báo vị trí thả trước khi thả.

---

### FR-08 — Chọn và điều hướng

- Click chọn node trên Canvas.
- Chọn nhiều node (Shift + click).
- Breadcrumb hiển thị đường dẫn node từ gốc.
- Layer Tree hiển thị cây node, đồng bộ lựa chọn với Canvas.
- Phím tắt di chuyển giữa node cha, con, anh em.

---

### FR-09 — Inspector

Chỉnh thuộc tính của node đang chọn theo mục 8.3.

Thay đổi hiển thị ngay trên Canvas.

---

### FR-10 — Responsive

- Workspace chọn chế độ **desktop-first** (mặc định) hoặc **mobile-first**.
- Thiết kế ở khung chuẩn tạo giá trị gốc. Các khung khác **tự dàn lại** theo layout có cấu trúc.
- Chỉnh thuộc tính ở khung khác tạo giá trị ghi đè cho dải màn hình của khung đó. Mốc dải: 640, 768, 1024, 1280, 1536 px (khớp Tailwind).
- Grid có chế độ **auto-fit**: số cột tự giảm theo độ rộng màn hình dựa trên độ rộng tối thiểu của mỗi ô.
- Inspector hiển thị rõ giá trị đang được ghi đè và cho xóa ghi đè.

---

### FR-11 — Design Token

- Quản lý token: màu, typography, spacing, radius, shadow.
- Token màu có thể có giá trị cho **chế độ tối**. Workspace chọn: không có chế độ tối, tự theo hệ điều hành, hoặc bật/tắt bằng class. Canvas có nút xem sáng/tối.
- Đổi token cập nhật mọi node dùng token đó.
- Có thể **nhập token** từ cấu hình Tailwind của Target Project.

---

### FR-12 — Pages

- Tạo, đổi tên, xóa, sắp xếp trang.
- Mỗi trang có route (ví dụ `/products`), tiêu đề và mô tả (`<title>`, `<meta name="description">`).

---

### FR-13 — User Component

- Chọn một nhóm node và lưu thành User Component.
- Sửa User Component cập nhật mọi instance.
- User Component **chỉ chứa layout và UI logic**. Phần khác nhau giữa các nơi dùng truyền qua props hoặc slot.

---

### FR-41 — Gợi ý tách layout dùng chung

- Studio phát hiện các cụm phần tử có cùng cấu trúc layout lặp lại từ 2 lần trở lên trong workspace và đề xuất tách thành User Component.
- Phần khác nhau giữa các nơi (chữ, ảnh, liên kết) thành props. Phần có tương tác thành slot, để logic vẫn nằm ở từng trang (FR-33).
- Người dùng xem vị trí, duyệt, chỉnh tên rồi mới áp dụng. Áp dụng thay mọi vị trí bằng instance trong một bước Undo, giao diện không đổi.
- Phát hiện chạy cục bộ bằng thuật toán, không cần AI, không gửi dữ liệu ra ngoài.

---

### FR-14 — Undo / Redo

Mọi Design Operation có Undo/Redo, kể cả thao tác của AI.

---

### FR-15 — Thao tác cơ bản

Copy, paste, duplicate, xóa, nhóm (wrap vào container), bỏ nhóm.

---

### FR-16 — Sửa chữ trực tiếp

Double-click vào Text, Heading, Button, Link để sửa nội dung trên Canvas.

Text và Heading hỗ trợ **định dạng trong đoạn**: đậm, nghiêng, gạch chân, gạch ngang, code, liên kết, màu chữ. Gõ tiếng Việt bằng bộ gõ không bị lỗi.

---

## C. NGỮ CẢNH BACKEND VÀ DỮ LIỆU

### FR-17 — Backend Scan

Hệ thống quét thư mục backend để xác định:

- framework (ví dụ Django, Express, NestJS, Spring, Laravel) và cách xác thực API;
- model dữ liệu từ ORM (Prisma, Mongoose, TypeORM, Sequelize, Django ORM);
- file OpenAPI/Swagger nếu có;
- danh sách endpoint (method, path, tham số, kiểu request/response);
- entity/model và field (tên, kiểu, bắt buộc, quan hệ).

Thứ tự ưu tiên nguồn:

```text
1. OpenAPI / Swagger
2. Phân tích code có quy tắc (route, model) của framework được hỗ trợ
3. AI đọc code (khi người dùng cho phép)
```

Mỗi kết quả phải có **mức độ tin cậy** (cao / trung bình / thấp) và nguồn gốc (file, dòng).

---

### FR-18 — Data Source Catalog

Hiển thị danh sách Data Source: entity, field, endpoint liên quan.

Người dùng có thể sửa hoặc bổ sung thông tin khi kết quả quét sai.

---

### FR-19 — Data Binding

Người dùng có thể gắn:

- Table, List với endpoint trả về danh sách;
- Detail View, Text với field của một entity;
- Form với endpoint tạo/sửa, các Input tự sinh theo field.

Table và List có **tìm kiếm, sắp xếp, phân trang** (phía server khi API hỗ trợ, ngược lại phía trình duyệt). Select có thể lấy lựa chọn từ dữ liệu của entity liên quan.

Kéo một entity vào Canvas để tạo nhanh: bảng danh sách, lưới thẻ, chi tiết, form tạo/sửa, hoặc trang CRUD đầy đủ.

Ô nhập có **ràng buộc nhập liệu**: bắt buộc, độ dài, khoảng giá trị, khoảng ngày, định dạng (email, điện thoại, URL, chữ số), thông báo lỗi tùy chỉnh. Ràng buộc được kiểm tra ở chế độ Xem thử và trong code xuất ra.

---

### FR-20 — Dữ liệu mẫu

Canvas hiển thị component đã gắn dữ liệu bằng **dữ liệu mẫu** sinh theo kiểu field.

Dữ liệu mẫu theo **ngôn ngữ nội dung** (tên, số tiền, ngày theo `vi-VN` hoặc ngôn ngữ đã chọn).

Studio **không gọi backend thật** trong lúc thiết kế. Riêng chế độ Xem thử có tùy chọn **"Dùng API thật (chỉ đọc)"**: Local Backend làm proxy, chỉ gọi `GET` các endpoint danh sách/chi tiết tới đúng `baseUrl` đã cấu hình. Thao tác tạo, sửa, xóa trong Xem thử luôn được giả lập.

Mọi component dữ liệu có 4 trạng thái thiết kế được và xem được trên Canvas: có dữ liệu, đang tải, rỗng, lỗi (chi tiết có thêm "không tìm thấy").

---

### FR-21 — Loại trừ secrets

Backend Scan **phải bỏ qua** `.env`, file khóa, credentials, và không đưa vào AI context.

---

## D. AI

### FR-22 — AI trên phần tử được chọn

Người dùng chọn một hoặc nhiều node, nhập yêu cầu tự nhiên.

Ví dụ:

```text
Làm card này hiện đại hơn.
Thêm nút "Mua ngay" bên dưới giá.
Chuyển danh sách này thành dạng lưới 3 cột.
```

Có **tác vụ nhanh**: làm hiện đại hơn, tối ưu cho điện thoại, thêm hover, tạo nội dung mẫu, sửa lỗi khả năng tiếp cận.

**Tối ưu responsive:** Studio đo layout thật ở các khung nhỏ (tràn ngang, chữ quá to, lưới quá hẹp, vùng bấm quá nhỏ, thiếu menu điện thoại) rồi nhờ AI đề xuất giá trị ghi đè cho các khung đó.

Người dùng có thể **yêu cầu sửa tiếp** một đề xuất trước khi chấp nhận.

---

### FR-23 — AI dựng trang

Người dùng mô tả trang cần làm. AI dựng trang dựa trên:

- Data Source liên quan;
- Design Token;
- Library Component và User Component có sẵn.

Ví dụ:

```text
Tạo trang quản lý sản phẩm: bảng danh sách, ô tìm kiếm, nút thêm mới mở form.
```

---

### FR-24 — Mức ngữ cảnh AI

| Mức | Nội dung gửi cho AI |
|---|---|
| 0 — Node | Node đang chọn |
| 1 — Page | Trang hiện tại, token |
| 2 — Workspace | Các trang, User Component, token |
| 3 — Backend | Data Source liên quan |

Hệ thống phải dùng **mức thấp nhất** đủ để giải quyết yêu cầu.

---

### FR-25 — Output có cấu trúc

AI **phải** trả về danh sách Design Operation theo schema.

```json
{
  "summary": "Thêm nút Mua ngay dưới giá",
  "operations": [
    {
      "op": "insert",
      "parentId": "n_01J9X2",
      "index": 2,
      "node": { "type": "Button", "props": { "variant": "primary" },
                "children": [{ "type": "Text", "props": { "text": "Mua ngay" } }] }
    }
  ]
}
```

Hệ thống phải validate schema và tính hợp lệ (ID tồn tại, vị trí thả hợp lệ) trước khi áp dụng.

---

### FR-26 — Xem trước và duyệt

```text
AI trả về operations
   ↓
Validate
   ↓
Xem trước trên Canvas (đánh dấu phần thay đổi)
   ↓
Người dùng: Chấp nhận / Từ chối / Yêu cầu sửa tiếp
   ↓
Áp dụng (có Undo)
```

AI **không được** tự áp dụng thay đổi.

---

### FR-27 — AI Provider Gateway

```text
AIProvider
 ├── OpenAI
 ├── Anthropic
 ├── DeepSeek
 └── Ollama
```

UI không phụ thuộc trực tiếp vào provider.

---

### FR-28 — Ollama

Hỗ trợ Ollama như Local AI Provider. Kiểm tra availability, model, timeout, hủy request.

---

### FR-29 — Minh bạch dữ liệu gửi AI

Trước hoặc trong khi gửi request tới provider bên ngoài, hiển thị:

```text
Provider
Mức ngữ cảnh
Các node / Data Source / file được gửi
Kích thước context
Có gửi ảnh chụp Canvas hay không (tùy chọn, mặc định tắt)
```

Lần đầu gửi tới provider bên ngoài máy trong một phiên phải được người dùng xác nhận.

---

### FR-30 — Ranh giới bảo mật AI

AI **không được**:

- thực thi lệnh shell;
- ghi file;
- đọc file ngoài context do backend cung cấp;
- đọc secrets.

---

## E. XUẤT CODE

### FR-31 — Xuất React

Sinh code:

- React function component, TypeScript;
- styling bằng Tailwind CSS (khớp phiên bản của Target Project);
- mỗi Page thành một file page;
- User Component thành file component riêng;
- import theo path alias của project nếu có.

---

### FR-32 — Xuất HTML/CSS

Sinh file HTML và CSS thuần cho từng trang, không phụ thuộc framework.

---

### FR-33 — Tách component khi xuất

- User Component xuất thành component dùng chung, **chỉ chứa layout và UI logic**.
- Business logic (gọi API, xử lý submit) nằm ở page hoặc hook của page.
- Phần khác nhau giữa các nơi dùng truyền qua props hoặc slot (`children`, `actions`), không dùng cờ chế độ kiểu `mode="admin"`.

---

### FR-34 — Sinh lớp dữ liệu

Từ các Binding, sinh:

- kiểu TypeScript cho entity (bỏ qua khi project dùng JavaScript);
- API client gọi đúng endpoint, đọc URL gốc từ biến môi trường `VITE_API_BASE_URL`, xử lý vỏ bọc phân trang;
- điểm gắn xác thực (bearer, header, cookie) khi backend yêu cầu;
- hook lấy và gửi dữ liệu cho page (dùng TanStack Query nếu project đã có, ngược lại hook tự viết không cần thư viện);
- xử lý form tạo/sửa, xóa có xác nhận, hiển thị lỗi theo field từ backend.

Lớp dữ liệu **không được** dùng thư viện ngoài nếu project đích chưa có (trừ khi người dùng đồng ý thêm).

---

### FR-35 — Xem trước và diff

Trước khi ghi, hiển thị:

- danh sách file sẽ tạo / sửa;
- diff từng file;
- cảnh báo nếu file sẽ bị ghi đè.

Người dùng có thể chọn bỏ qua từng file.

---

### FR-36 — Ghi an toàn

- Ghi qua transaction: lỗi một file thì rollback toàn bộ.
- Chỉ ghi trong Target Project.
- Lưu dấu vết lần xuất (hash nội dung đã ghi).
- Khi xuất lại, nếu file trên disk khác với lần xuất trước (đã bị sửa tay), **không ghi đè âm thầm**: yêu cầu người dùng chọn ghi đè, bỏ qua, hoặc xuất sang file mới.

---

### FR-37 — Kiểm tra code xuất ra

Sau khi sinh code, hệ thống phải kiểm tra:

- cú pháp;
- TypeScript type check;
- build thử bằng Vite (khi người dùng bật).

Lỗi phải hiển thị kèm file và dòng. Code lỗi cú pháp **không được** ghi vào project.

---

### FR-38 — Quy ước của Target Project

Code xuất ra phải theo quy ước phát hiện được từ project đích:

- cấu trúc thư mục (`components/`, `features/`, `pages/`…);
- kiểu đặt tên file và component;
- cấu hình Prettier/ESLint nếu có (format code theo cấu hình đó);
- phiên bản Tailwind.

Hệ thống **không được** tự áp kiến trúc khác với kiến trúc hiện có của project.

Project đích có thể viết bằng **TypeScript hoặc JavaScript**, và có thể là một app trong **monorepo**.

---

## F. TƯƠNG TÁC

### FR-39 — Tương tác

Người dùng gắn tương tác dạng **"khi [sự kiện] trên [phần tử] → chạy [hành động]"**, chọn từ một tập hành động cố định:

| Sự kiện | Hành động |
|---|---|
| Bấm (nút, liên kết, icon, ảnh, card, khối, dòng bảng) | Chuyển trang (kèm tham số từ dữ liệu, ví dụ `id`) |
| Gửi form thành công / thất bại | Mở liên kết ngoài |
| | Mở / đóng Modal |
| | Hiện / ẩn / bật tắt một phần tử |
| | Cuộn tới phần tử |
| | Chuyển tab |
| | Hiện thông báo (toast) |
| | Tải lại dữ liệu, xóa bản ghi có xác nhận |

- Không có biến, điều kiện, vòng lặp hay code tùy ý.
- Tương tác chỉ đặt trên phần tử của **trang** (kể cả nội dung đặt vào slot), không đặt bên trong định nghĩa User Component.
- Phần tử có thể đặt **"ẩn khi tải trang"** để hiện qua tương tác (ví dụ menu điện thoại mở bằng nút ☰).

---

### FR-40 — Chế độ Xem thử

Canvas có chế độ **Xem thử**: click chạy tương tác thật (mở Modal, bật tắt menu, chuyển trang, kiểm tra form, toast) với dữ liệu mẫu, không gọi API thật. Thoát Xem thử thì mọi trạng thái được xóa.

---

# 10. GIỚI HẠN VÀ TRƯỜNG HỢP ĐẶC BIỆT

| Trường hợp | Xử lý |
|---|---|
| Đặt phần tử tự do (absolute) | Không hỗ trợ (mục 6.3) |
| Animation phức tạp | Chỉ hỗ trợ transition cho trạng thái hover/focus (quyết định thiết kế) |
| Logic tùy biến (biến, điều kiện, code) | Không hỗ trợ. Tương tác chỉ từ tập hành động cố định (FR-39). Code xuất ra thuộc về developer để mở rộng |
| Video nền | Không hỗ trợ |
| Thư viện UI bên thứ ba (MUI, Ant Design…) khi xuất | Không hỗ trợ trong phiên bản này |
| Component có sẵn trong Target Project | Không đưa lên Canvas trong phiên bản này |
| Code sửa tay sau khi xuất | Không đồng bộ ngược. Phát hiện khi xuất lại (FR-36) |
| Backend không có OpenAPI và framework không được hỗ trợ | Dùng AI đọc code (nếu được phép) hoặc nhập Data Source thủ công |

---

# 11. NON-FUNCTIONAL REQUIREMENTS

## 11.1. Hiệu năng

| Mã | Yêu cầu |
|---|---|
| NFR-01 | Thao tác kéo thả và chọn trên Canvas mượt ở 60 fps với trang ≤ 500 node |
| NFR-02 | Thay đổi thuộc tính hiển thị trên Canvas ≤ 100 ms (P95) |
| NFR-03 | Mở workspace ≤ 3 s với Design Document ≤ 50 trang |
| NFR-04 | Backend Scan ≤ 10 s với backend ≤ 2.000 file (không tính AI) |
| NFR-05 | Sinh code một trang ≤ 1 s, toàn workspace 50 trang ≤ 10 s (không tính type check, build) |

---

## 11.2. Độ tin cậy

| Mã | Yêu cầu |
|---|---|
| NFR-06 | Đóng Studio đột ngột không mất quá 2 s thao tác gần nhất |
| NFR-07 | File Design Document hỏng phải khôi phục được từ bản lưu trước |
| NFR-08 | Lỗi AI provider không ảnh hưởng chức năng thiết kế và xuất code |
| NFR-09 | Export thất bại không để Target Project ở trạng thái ghi dở |

---

## 11.3. Chất lượng code xuất ra

| Mã | Yêu cầu |
|---|---|
| NFR-10 | Code React xuất ra qua `tsc --noEmit` và `vite build` không lỗi |
| NFR-11 | Giao diện code xuất ra khớp Canvas (so sánh ảnh chụp, sai khác ≤ ngưỡng quy định ở SPEC) |
| NFR-12 | Code không chứa phụ thuộc runtime của ReactCraft |
| NFR-13 | Không dùng `position: absolute` trừ khi node được thiết kế là overlay (Modal, Badge…) |

---

## 11.4. Tương thích

| Thành phần | Hỗ trợ |
|---|---|
| Hệ điều hành | Windows 10/11, macOS, Linux |
| Trình duyệt chạy Studio | Chrome, Edge, Firefox bản ổn định |
| Target Project | React 18/19, Vite 7/8, TypeScript hoặc JavaScript, Tailwind v3.4+/v4, có thể nằm trong monorepo |


---

## 11.5. Đa ngôn ngữ

| Mã | Yêu cầu |
|---|---|
| NFR-14 | Giao diện Studio hỗ trợ **tiếng Việt** và **tiếng Anh** ngay từ phiên bản đầu |
| NFR-15 | Đổi ngôn ngữ trong Studio không cần tải lại trang |
| NFR-16 | Thông báo lỗi, tên component trong thư viện và phản hồi của AI hiển thị theo ngôn ngữ đang chọn |
| NFR-17 | Nội dung thiết kế của người dùng và code xuất ra không bị dịch |

---

# 12. SECURITY REQUIREMENTS

| Mã | Yêu cầu |
|---|---|
| SEC-01 | Local Backend chỉ lắng nghe trên `127.0.0.1`, có token phiên, kiểm tra Origin |
| SEC-02 | Thư mục backend chỉ đọc |
| SEC-03 | Chỉ ghi trong Workspace và Target Project. Chặn path traversal |
| SEC-04 | AI không có quyền truy cập file system hay shell |
| SEC-05 | Secrets bị loại khỏi Backend Scan và AI context |
| SEC-06 | Provider bên ngoài phải được xác định rõ và người dùng chủ động cấu hình |
| SEC-07 | API key lưu ngoài workspace và không bao giờ gửi xuống trình duyệt |
| SEC-08 | Cài đặt dependency mới vào Target Project cần người dùng đồng ý |
| SEC-09 | Workspace mở lần đầu ở chế độ hạn chế cho tới khi người dùng xác nhận tin cậy. Chế độ hạn chế không quét backend, không xuất code, không chạy build, không dùng proxy dữ liệu |
| SEC-10 | Không telemetry, không tự kiểm tra cập nhật. Chỉ kết nối mạng khi người dùng chủ động dùng AI provider, proxy dữ liệu hoặc cài dependency |

---

# 13. ERROR MODEL

| Code | Meaning |
|---|---|
| E001 | Unsupported Target Project |
| E002 | Backend Initialization Failed |
| E003 | Workspace Load Failed |
| E004 | Design Model Schema Error |
| E005 | Invalid Design Operation |
| E006 | Backend Scan Failed |
| E007 | AI Schema Error |
| E008 | AI Provider Error |
| E009 | Export Validation Failed |
| E010 | Export Conflict |
| E011 | Permission Error |
| E012 | Path Security Violation |

---

# 14. ACCEPTANCE CRITERIA

## AC-01 — Workspace

Tạo workspace, liên kết Target Project và backend mẫu. Đóng, mở lại: thiết kế còn nguyên.

---

## AC-02 — Kéo thả

Kéo Section, Card, Button vào trang. Sắp xếp lại thứ tự. Thả vào vị trí không hợp lệ bị từ chối.

---

## AC-03 — Inspector và Responsive

Workspace desktop-first, khung chuẩn 1440. Đổi padding của Card ở khung chuẩn, rồi đổi lại ở khung Mobile 375. Khung Desktop và Tablet giữ giá trị gốc, khung Mobile hiển thị giá trị ghi đè. Grid auto-fit hiển thị 4 cột ở Desktop và 1 cột ở Mobile.

---

## AC-04 — Backend Scan

Với backend mẫu (một bản Express, một bản Django) có model `Product(id, name, price, stock)` và API CRUD `/api/products`, hệ thống phát hiện đúng entity, field, kiểu và endpoint.

---

## AC-05 — Data Binding

Kéo Table vào trang, gắn với `/api/products`. Bảng tự có 4 cột, hiển thị dữ liệu mẫu đúng kiểu.

---

## AC-06 — AI trên phần tử

Chọn Card, yêu cầu "thêm nút Mua ngay dưới giá". AI trả operations hợp lệ, Canvas xem trước, chấp nhận, Undo khôi phục được.

---

## AC-07 — AI dựng trang

Yêu cầu "tạo trang quản lý sản phẩm". Trang có bảng gắn `/api/products` và form thêm mới có đủ field. Không có field nào không tồn tại trong backend.

---

## AC-08 — Xuất React

Xuất workspace vào Target Project. `tsc --noEmit` và `vite build` không lỗi. Trang chạy được và gọi đúng API.

---

## AC-09 — Khớp giao diện

Ảnh chụp trang xuất ra và Canvas ở 3 kích thước khung nhìn khớp trong ngưỡng quy định.

---

## AC-10 — Xuất HTML/CSS

Xuất HTML/CSS. Mở file trên trình duyệt hiển thị đúng bố cục.

---

## AC-11 — Xung đột khi xuất lại

Sửa tay một file đã xuất, rồi xuất lại. Hệ thống phát hiện, không ghi đè, yêu cầu người dùng chọn cách xử lý.

---

## AC-12 — Component dùng chung

Tạo User Component `ProductCard` dùng ở trang bán hàng (nút Thêm vào giỏ) và trang quản lý (nút Sửa, Xóa). Code xuất ra: `ProductCard` chỉ chứa layout và slot `actions`. Logic của từng nút nằm ở trang tương ứng.

---

## AC-13 — Bảo mật

Backend mẫu có `.env` chứa khóa giả. Khóa không xuất hiện trong Data Source, AI context, log.

---

## AC-14 — Tương tác

Trang có: thanh điều hướng với nút ☰ bật tắt menu điện thoại, nút "Thêm mới" mở Modal chứa form (gửi thành công thì đóng Modal và hiện toast), bảng bấm dòng chuyển sang trang chi tiết với `id`. Mọi tương tác chạy đúng trong chế độ Xem thử và trong code React xuất ra ở khung 375 và 1440.

---

## AC-15 — Rich text và chế độ tối

Đoạn văn có chữ đậm, nghiêng và liên kết, gõ bằng Telex, hiển thị đúng trên Canvas và trong code xuất ra. Workspace bật chế độ tối theo hệ điều hành: token màu có giá trị tối, Canvas xem được cả hai chế độ, trang xuất ra đổi màu theo cài đặt hệ điều hành.

---

## AC-16 — Gợi ý tách layout dùng chung

Workspace có 3 card sản phẩm cùng cấu trúc ở 2 trang, khác chữ và ảnh, một card có nút có tương tác. Studio gợi ý tách thành component. Chấp nhận: có một User Component, 3 instance, chữ và ảnh là props, nút nằm trong slot. Giao diện ở khung 375 và 1440 không đổi. Undo một bước khôi phục như cũ.

---

# 15. DATA FLOW

## 15.1. Chỉnh sửa thiết kế

```text
Thao tác người dùng (kéo thả / Inspector)
   ↓
Design Operation
   ↓
Validate
   ↓
Cập nhật Design Model + Undo history
   ↓
Canvas render lại phần thay đổi
   ↓
Tự động lưu
```

---

## 15.2. AI

```text
Chọn node + nhập yêu cầu
   ↓
AI Context Builder (mức thấp nhất đủ dùng)
   ↓
Hiển thị dữ liệu sẽ gửi
   ↓
AI Provider
   ↓
Operations có cấu trúc
   ↓
Schema + tính hợp lệ
   ↓
Xem trước trên Canvas
   ↓
Người dùng duyệt
   ↓
Áp dụng (có Undo)
```

---

## 15.3. Backend Scan

```text
Thư mục backend (chỉ đọc)
   ↓
Loại trừ secrets
   ↓
Tìm OpenAPI → phân tích framework → AI (nếu được phép)
   ↓
Entity + Field + Endpoint (kèm độ tin cậy, nguồn gốc)
   ↓
Data Source Catalog
```

---

## 15.4. Xuất code

```text
Design Model + Data Sources + quy ước Target Project
   ↓
Code Generator
   ↓
Kiểm tra cú pháp + type check (+ build thử)
   ↓
Diff
   ↓
Người dùng duyệt từng file
   ↓
Kiểm tra xung đột (file sửa tay)
   ↓
Transaction ghi file
   ↓
Lưu dấu vết lần xuất
```

---

# 16. MVP VÀ PHASE

## Phase 1 — Studio Core

- Workspace, lưu tự động;
- Design Model và Design Operation;
- Canvas cô lập, kích thước khung nhìn;
- Library Component cơ bản (layout, nội dung, Button, Card);
- kéo thả, chọn, Layer Tree;
- Inspector, responsive;
- Undo/Redo.

Mục tiêu:

> Dựng được một trang tĩnh hoàn chỉnh bằng kéo thả.

---

## Phase 2 — Export

- liên kết Target Project, phát hiện quy ước;
- xuất React + Tailwind và HTML/CSS;
- kiểm tra code, diff, transaction, phát hiện xung đột;
- tương tác (FR-39) và chế độ Xem thử (FR-40);
- rich text, chế độ tối, ràng buộc nhập liệu;
- project JavaScript, monorepo.

Mục tiêu:

> Trang thiết kế trong Studio chạy được trong project thật.

---

## Phase 3 — AI

- AI Provider Gateway (OpenAI, Claude, DeepSeek, Ollama);
- AI trên phần tử được chọn;
- AI dựng trang (chưa có dữ liệu backend);
- AI tối ưu responsive: đề xuất giá trị ghi đè cho khung nhỏ;
- operations có cấu trúc, xem trước, duyệt.

---

## Phase 4 — Backend Context

- Backend Scan: OpenAPI, Express, NestJS, Prisma, Mongoose, TypeORM, Sequelize, Django/DRF, AI cho framework khác;
- tìm kiếm, sắp xếp, phân trang, trạng thái dữ liệu; dữ liệu thật chỉ đọc trong Xem thử;
- Data Source Catalog;
- Data Binding, dữ liệu mẫu;
- hành động dữ liệu của tương tác: tải lại, xóa bản ghi, sau khi gửi form;
- sinh lớp dữ liệu khi xuất;
- AI dùng ngữ cảnh backend.

Mục tiêu:

> AI và người dùng dựng trang có dữ liệu thật của backend.

---

## Phase 5 — Nâng cao

- User Component, Design Token đầy đủ, nhập token từ Tailwind config (FR-11, FR-13);
- xem song song nhiều khung thiết kế (FR-10);
- gợi ý tách layout dùng chung (FR-41).

Mục tiêu:

> Thiết kế nhiều trang nhất quán, tái sử dụng được. Sẵn sàng phát hành 1.0.

Ghi chú phạm vi: form và component dữ liệu (ràng buộc nhập liệu, tìm kiếm, sắp xếp, phân trang, trạng thái dữ liệu) đã thuộc Phase 2 và Phase 4. Framework backend ngoài OpenAPI, Express, NestJS, Prisma, Mongoose, TypeORM, Sequelize, Django/DRF được hỗ trợ qua trích xuất bằng AI (FR-17). Bộ trích xuất riêng cho framework khác (Spring, Laravel…) thuộc phiên bản sau 1.0 và cần spec bổ sung.

---

# 17. NON-GOALS

Không yêu cầu:

- cloud backend, SaaS, tài khoản, thanh toán;
- cộng tác thời gian thực nhiều người;
- đồng bộ hai chiều từ code về Design Model;
- chỉnh sửa app đang chạy (hướng của v3.0);
- layout tự do kiểu absolute;
- xuất Vue, Angular, Svelte, mobile native;
- sinh code backend;
- deploy, hosting;
- nhập thiết kế từ Figma;
- Electron hoặc ứng dụng desktop đóng gói.

---

# 18. SUCCESS CRITERIA

ReactCraft Local đạt mục tiêu khi người dùng có thể:

```text
Mở Studio
   ↓
Liên kết project React + thư mục backend
   ↓
Studio hiểu API và model dữ liệu
   ↓
Kéo thả hoặc nhờ AI dựng trang có dữ liệu thật
   ↓
Chọn phần tử, chỉnh tay hoặc nhờ AI sửa
   ↓
Xem trước, duyệt
   ↓
Xuất code React sạch vào project
   ↓
npm run dev — trang chạy và gọi đúng API
```

---

# 19. CÂU HỎI MỞ

Các mục dưới đây đang dùng **giả định mặc định**, cần xác nhận khi duyệt SRS.

| # | Câu hỏi | Giả định mặc định |
|---|---|---|
| Q-01 | Studio làm việc với project nào? | Thiết kế trang mới, xuất vào project React + Vite có sẵn hoặc tạo mới. Chưa đưa component có sẵn của project lên Canvas |
| Q-02 | Đọc backend để làm gì? | Phát hiện API và model, dùng cho Data Binding và AI context |
| Q-03 | Styling của code React | Tailwind CSS. Có thêm xuất HTML/CSS thuần |
| Q-04 | Đồng bộ hai chiều? | Không. Xuất một chiều, phát hiện file sửa tay khi xuất lại |
| Q-05 | Ngôn ngữ giao diện Studio | **Đã chốt:** tiếng Việt và tiếng Anh ngay từ đầu (mục 11.5) |
| Q-06 | Framework backend hỗ trợ ngoài OpenAPI | Express và Django trước |
| Q-07 | Có cho phép nhúng code tùy biến (custom code block) trong thiết kế? | **Quyết định:** không. Developer mở rộng trên code xuất ra |

---

# 20. NGUYÊN TẮC CỐT LÕI

```text
Design Model is the source of truth for design.
Backend is read-only context.
AI proposes. Studio validates. User approves.
Generator writes clean code.
Developer owns the code.
```
