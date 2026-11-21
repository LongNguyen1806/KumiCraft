# Kiến trúc hiện trạng KumiCraft

Bước 2 của việc dựng lại kiến trúc (xem [01-muc-tieu.md](01-muc-tieu.md)). Tài liệu này mô tả **code đang thật sự làm gì**, đọc từ code ngày 2026-11-22 (bản 1.0.9, commit sau `7497ae1`), không đọc từ spec. Mọi con số đều đếm được bằng lệnh; không có đề xuất sửa ở đây (đề xuất ở bước 3 và 4).

## 1. Toàn cảnh

### 1.1. Năm package

| Package  | Việc                                                                                       | Code (không tính test) | File test | Thư viện ngoài chính                          |
| -------- | ------------------------------------------------------------------------------------------ | ---------------------- | --------- | --------------------------------------------- |
| `shared` | Kiểu dữ liệu và schema dùng chung (zod), bộ đọc class Tailwind, thư viện khối giao diện    | 78 file, 12.920 dòng   | 30        | zod                                           |
| `server` | Toàn bộ nghiệp vụ: mở dự án, chạy dự án, sửa code, style, Undo, AI, API                    | 259 file, 41.490 dòng  | 173       | fastify, @babel/parser, postcss, magic-string |
| `studio` | Giao diện người dùng (React)                                                               | 331 file, 46.817 dòng  | 144       | react, zustand, i18next                       |
| `bridge` | Chạy bên trong trang của dự án trên Canvas; plugin Vite và bộ đánh dấu JSX                 | 51 file, 7.495 dòng    | 36        | @babel/parser, magic-string                   |
| `cli`    | Lệnh `kumicraft`: khởi động server, mở trình duyệt; lệnh `kumicraft mcp` (chỉ để kiểm thử) | 16 file, 1.508 dòng    | 9         | @modelcontextprotocol/sdk                     |

Tổng khoảng **110.000 dòng code** và **392 file test**.

### 1.2. Các phần chạy thế nào

```
 Trình duyệt của người dùng
 ┌──────────────────────────────────────────────┐
 │ Studio (React)                               │
 │   ┌──────────────── Canvas (iframe) ───────┐ │
 │   │ Trang thật của dự án + Bridge client   │ │
 │   └────────────────────────────────────────┘ │
 └───────▲───────────────────────▲──────────────┘
         │ HTTP + WebSocket      │ postMessage (Studio ↔ Bridge)
         │ (token, 127.0.0.1)    │
 ┌───────┴────────────────┐      │ tải trang
 │ Server (Node, Fastify) │      │
 │  - API 81 endpoint     │  ┌───┴──────────────────────────────┐
 │  - sửa file, Undo      ├──► Runner (tiến trình con)          │
 │  - chạy AI agent CLI   │  │  vite-react: dev server Vite của │
 └───────┬────────────────┘  │   dự án + plugin Bridge           │
         │                   │  express-pug: proxy chèn Bridge   │
         ▼                   │   vào HTML của server dự án       │
  File của dự án ◄───────────┴──────────────────────────────────┘
  (code người dùng)
```

- **CLI** khởi động **Server** ở `127.0.0.1` với token, Server phục vụ trang Studio.
- Server chạy dự án trong **tiến trình con (runner)**. Runner gắn **Bridge** vào trang: với Vite thì qua plugin, với Express thì qua proxy.
- Bridge **đánh dấu** mỗi phần tử bằng thuộc tính `data-rc-loc` (file:dòng:cột trong code). Với JSX, việc này làm lúc biên dịch (`bridge/src/transform/transform-jsx.ts`). Với Pug, làm bằng hook trình biên dịch Pug (`server/src/runners/pug-loc-plugin.ts`).
- Studio nói chuyện với Bridge bằng `postMessage` (chọn phần tử, kéo thả, xem trước), và với Server bằng HTTP + WebSocket (sửa file, sự kiện).
- AI: Server chạy **agent CLI** của người dùng (Antigravity, Claude Code) trong thư mục dự án. Agent **tự sửa file**; Server chụp trạng thái file trước và sau mỗi lượt để hoàn tác.

## 2. Server bên trong

### 2.1. Các module

Server chia `core/` (nghiệp vụ), `adapters/` (nối với thế giới ngoài) và `runners/` (tiến trình con).

| Module                                                  | Dòng   | Việc                                                                                           |
| ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `core/project`                                          | 13.078 | Mở, tạo, nhận diện dự án; trang, route, component, bản nháp, theme, cài dependency, kiểm build |
| `core/source-editor`                                    | 11.555 | Đọc và sửa code JSX: class, chữ, thuộc tính, chèn, xóa, di chuyển, bọc, các kit tương tác      |
| `core/style`                                            | 4.737  | Lớp style cho CSS, CSS Modules, Sass, Less, Bootstrap; token theme                             |
| `core/agent`                                            | 2.931  | Chạy AI agent, dựng prompt, chụp trạng thái file theo lượt                                     |
| `core/shared`                                           | 623    | Result, phiên làm việc, cấu hình người dùng                                                    |
| `core/runner`                                           | 601    | Quản lý tiến trình runner                                                                      |
| `core/mirror`                                           | 498    | Sao chép backend để AI đọc                                                                     |
| `core/history`                                          | 447    | Undo / Redo đúng từng byte                                                                     |
| `core/workspace`                                        | 328    | Khóa dự án, cổng đã nhớ                                                                        |
| `core/jobs`                                             | 208    | Tác vụ chạy nền (cài, kiểm build, lượt AI)                                                     |
| `core/ports`                                            | 186    | 7 port: file, tiến trình, hệ thống, log, sự kiện, theo dõi file, CSS đã biên dịch              |
| `adapters/http`                                         | 2.328  | 19 file route, 81 endpoint (42 endpoint thuộc `/project`)                                      |
| `adapters/system`, `fs`, `log`, `watcher`, `dev-server` | 1.201  | Hiện thực các port                                                                             |
| `runners`                                               | 1.812  | Runner Vite, runner Express + proxy, định dạng code, đọc kiểu prop                             |

### 2.2. Ai phụ thuộc ai (số lần import giữa module)

| Module               | Import tới                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `core/project`       | source-editor (54), ports (55), shared (27), history (12), workspace (6), jobs (5), style (5), mirror (1)           |
| `core/source-editor` | ports (18), style (5), project (2), history (1)                                                                     |
| `core/style`         | ports (17), source-editor (10), project (8), history (1)                                                            |
| `core/agent`         | ports (22), shared (17), mirror (5), jobs (3), project (2), workspace (1), **adapters/fs (1), adapters/system (1)** |
| `core/workspace`     | ports (7), shared (6), project (1), **adapters/fs (1)**                                                             |
| `core/runner`        | ports (8), project (4), shared (1)                                                                                  |
| `core/history`       | ports (3), source-editor (1)                                                                                        |
| `adapters/http`      | gần như mọi module `core` (65 import)                                                                               |
| `adapters/log`       | **adapters/http (2)** (chỉ lấy kiểu `LogLevel`)                                                                     |

Nhận xét:

- **Có vòng phụ thuộc:** `project ↔ source-editor`, `project ↔ style`, `style ↔ source-editor`, `history ↔ source-editor`, `project ↔ workspace`, `shared ↔ workspace`.
- **`core` import thẳng `adapters` ở 3 chỗ** (`agent` và `workspace`), trái với quy tắc port/adapter. Lint chỉ chặn `core` import Fastify, chưa chặn các trường hợp này.
- `core/project` gánh quá nhiều việc khác nhau (13.078 dòng, 54 import vào source-editor): nhận diện, trang, route, component, bản nháp, theme, cài đặt, kiểm build.

### 2.3. Adapter framework (nhận diện + chạy + sửa)

- `FrameworkAdapter` (`core/project/frameworks/types.ts`) gói chung: nhận diện, đuôi file sửa được, chế độ sửa (`full` / `viewOnly`), cách kiểm build, gói bắt buộc, runner.
- Có 2 hiện thực: `vite-react` và `express-pug`. Dự án đang mở có một adapter, lấy qua `getAdapter()` (dùng ở 5 file).
- **Bộ sửa code không nằm trong adapter.** Việc sửa code là code JSX dùng chung cho mọi dự án: 31 file trong `core/project` và `core/source-editor` làm việc trực tiếp với node JSX. Với dự án `viewOnly`, các thao tác sửa bị chặn ở `editor-mutations.ts` (trả E023), không có bộ sửa thay thế.
- Chế độ `viewOnly` được kiểm rải rác ở 4 chỗ (`editor-mutations.ts`, `project-service.ts`, `project-theme-ops.ts`, `project-draft-ops.ts`).
- Mẫu dự án mới gắn cứng một loại: `vite-react-ts-tailwind4` (`server/src/index.ts`).

## 3. Studio bên trong

- 31 nhóm tính năng trong `studio/src/features/` (44.645 dòng). Lớn nhất: `inspector` 13.418, `editor` 4.879, `chat` 3.933, `library` 3.098, `files` 2.572, `project` 2.489.
- Trạng thái dùng zustand; gọi Server qua `studio/src/api/` (16 file client).
- **Ranh giới giữa các nhóm tính năng rất mỏng:**
  - `editor` import 23 nhóm khác, và được 20 nhóm import lại. `selection` được 20 nhóm import, `project` 17 nhóm.
  - Có **36 cặp nhóm phụ thuộc lẫn nhau hai chiều** (ví dụ `editor ↔ inspector`, `inspector ↔ structure`, `dnd ↔ library`).
- **Studio tự làm phần việc của lớp style Tailwind:** 45 file Studio đọc và ghép class Tailwind (bộ đọc `parseClasses` trong `shared/src/tailwind`, 2.374 dòng), rồi gửi chuỗi class mới lên Server bằng thao tác `setClassName`. Với CSS, Studio có một thành phần riêng (`css-style-editor.tsx`) gửi yêu cầu `applyStyle` để Server ghi vào file CSS.

## 4. Bridge, Shared, CLI

- **Bridge client** (6.702 dòng) làm việc với DOM qua `data-rc-loc`, gần như không phụ thuộc framework. Đây là chỗ nối tốt giữa "trang chạy bằng gì" và "Studio". Phần gắn với React/Vite: `transform/transform-jsx.ts` (đánh dấu JSX) và `integrations/vite.ts` (plugin Vite). Bridge có test kiến trúc riêng (`architecture.test.ts`) chặn client import nhầm.
- **Shared** chứa hợp đồng giữa các phần (schema zod của API, sự kiện, thông điệp Bridge, thao tác sửa) và thêm hai thứ không phải hợp đồng:
  - bộ đọc Tailwind (`shared/src/tailwind`, 2.374 dòng);
  - thư viện khối giao diện (`shared/src/library`, 6.027 dòng): mỗi khối là chuỗi JSX (có bản class Tailwind và bản "neutral").
- **Mẫu kit tương tác** (carousel, modal, dropdown…, khoảng 2.200 dòng) là component React viết sẵn, nằm trong `server/src/core/source-editor/structure/kit-templates`.
- **CLI** mỏng; `cli/src/mcp` bọc các thao tác sửa thành công cụ MCP (chỉ để kiểm thử).

## 5. Các luồng chính

| Luồng                     | Đi qua                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mở dự án                  | Studio → `POST /project/open` → `project-service.open()` → `detectFramework()` chọn adapter → tạo `workspace.json` → runner chạy dev server → Canvas tải trang có Bridge |
| Chọn phần tử              | Bridge (click trên trang) → `postMessage` có `data-rc-loc` → Studio → `GET /source/...` đọc code của phần tử                                                             |
| Đổi style, dự án Tailwind | Inspector tự tính chuỗi class mới (shared/tailwind) → `setClassName` → source-editor sửa JSX → ghi file → Vite tải lại → Canvas                                          |
| Đổi style, dự án CSS      | `css-style-editor` → `POST /style/apply` → `core/style` tìm rule đang thắng → ghi file CSS / Sass / Less                                                                 |
| Chèn khối từ thư viện     | Studio dựng JSX của khối (shared/library) → thao tác `insert` → `structure-ops` chèn vào file, thêm import                                                               |
| Undo / Redo               | Mỗi lần ghi lưu nội dung file trước và sau → `core/history` trả lại đúng từng byte                                                                                       |
| AI sửa                    | Studio chat → `core/agent` dựng prompt → chạy agent CLI → agent tự sửa file → chụp trạng thái để hoàn tác cả lượt                                                        |

## 6. Chỗ gắn cứng với một công nghệ

| Gắn với     | Ở đâu                                                                                                                                             | Quy mô                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| JSX / React | Bộ sửa code (`core/source-editor`, một phần `core/project`): đọc / sửa node JSX trực tiếp, không qua interface                                    | 31 file; phần lớn của 24.600 dòng hai module |
| JSX / React | Đánh dấu vị trí (`bridge/transform`), thư viện khối (chuỗi JSX), kit tương tác (component React), route (`react-router`), đọc kiểu prop component | khoảng 8.000 dòng                            |
| Vite        | Runner `vite-react`, plugin Bridge, kiểm build `tsc` + `vite build`, mẫu dự án                                                                    | khoảng 2.000 dòng                            |
| Tailwind    | 45 file Studio, bộ đọc trong `shared/tailwind`, 32 file Server (token theme, chèn khối, đánh dấu…)                                                | rải ở cả 3 package                           |

## 7. Những điểm tốt nên giữ

1. **`data-rc-loc` là chỗ nối độc lập với framework.** Bridge client, Canvas, chọn phần tử, kéo thả chỉ cần dấu này. Express + Pug đã chứng minh: một cách chạy khác, một cách đánh dấu khác, nhưng Bridge và Studio dùng nguyên.
2. **Port / adapter ở Server** (7 port), có lint chặn `core` dùng Fastify.
3. **Lớp style cho CSS** (`core/style`) đã đi đúng hướng "một lớp, nhiều hệ": CSS, CSS Modules, Sass, Less, Bootstrap cùng một đường.
4. **Undo đúng từng byte** (`core/history`) không phụ thuộc framework.
5. **Hợp đồng có schema** (zod trong `shared`) cho API, sự kiện và thông điệp Bridge, kiểm ở cả hai đầu.
6. **Test nhiều:** 392 file test, và có test kiến trúc cho Bridge.

## 8. Vấn đề (có bằng chứng)

1. **Không có lõi độc lập với công nghệ.** "Phần tử", "thao tác sửa", "trang", "component" được định nghĩa thẳng bằng JSX. Thêm Vue, Razor hay HTML là phải viết lại bộ sửa, vì không có interface để cắm vào (mục 2.3, 6).
2. **Adapter framework chỉ gói nửa việc.** Nhận diện và chạy nằm trong adapter, còn sửa code thì nằm ngoài và chỉ biết JSX. `viewOnly` là cách chặn, không phải một bộ sửa khác (mục 2.3).
3. **Lớp style bị chia hai đường:** Tailwind do Studio tự tính rồi gửi `setClassName`; CSS do Server tính qua `applyStyle`. Cùng một việc (đổi màu) có hai luồng, hai giao diện và hai bộ test (mục 3, 5). Điều này trái với nguyên tắc "mọi hệ style chạy như nhau" và với mục tiêu "AI làm được mọi việc của công cụ": AI không có một thao tác "đổi màu" chung để gọi.
4. **AI không đi qua các thao tác sửa.** Agent tự viết code tự do. Các thao tác sửa chỉ được bọc cho AI ở MCP, mà MCP chỉ để kiểm thử (mục 5). Vì vậy "mỗi thao tác là một thao tác dùng chung cho công cụ tay và AI" (mục tiêu ở bước 1) **chưa có**.
5. **Ranh giới module yếu:**
   - Server: 6 vòng phụ thuộc, 3 chỗ `core` import thẳng `adapters`.
   - Studio: 36 cặp phụ thuộc hai chiều; `editor` dính 23 nhóm.
   - Chỉ có 2 quy tắc phụ thuộc được lint kiểm (core không dùng Fastify; Bridge client không import nhầm).
6. **`core/project` quá rộng** (13.078 dòng, nhiều việc không liên quan nhau), nên sửa một chỗ dễ chạm chỗ khác.
7. **Nội dung giao diện nằm lẫn trong hợp đồng.** `shared` vừa là hợp đồng vừa chứa thư viện khối (6.027 dòng JSX) và bộ đọc Tailwind; Server chứa mẫu kit React. Nội dung này gắn với React + Tailwind nhưng nằm ở các package lẽ ra trung lập.
8. **Tài liệu không theo kịp code.** `spec.md` 3.516 dòng; cả 6 phần của spec vẫn ghi "Draft — chờ duyệt"; ADR-BE-36 (tách adapter) vẫn "Proposed"; `spec-log` có 160 dòng lệch.
9. **File và hàm dài (ít):** đo theo dòng code thực (bỏ dòng trống và chú thích), chỉ có 1 file Server và 1 file Bridge vượt 400 dòng. Theo số dòng thô, `index.ts` (412) và `project-service.ts` (435) vượt giới hạn.

## 9. Câu hỏi để bước 3 trả lời

1. Mô hình lõi gồm những khái niệm nào ("dự án", "trang", "phần tử", "vị trí trong code", "thao tác sửa", "style"…), định nghĩa sao cho JSX, Pug, Vue, Razor đều diễn đạt được?
2. Bộ sửa code theo ngôn ngữ giao diện có interface gì, và thao tác nào là bắt buộc / tùy chọn (thiếu thì báo lý do, như E023 hiện nay)?
3. Lớp style gộp lại thế nào để Tailwind và CSS đi **một đường** trên Server, Studio chỉ gửi ý định ("đổi màu chữ thành X")?
4. Thao tác sửa dùng chung cho công cụ tay và AI: AI gọi chúng bằng cách nào (MCP chỉ để kiểm thử theo nguyên tắc 6 của bước 1)?
5. Nội dung giao diện (thư viện khối, kit) tách khỏi hợp đồng ra sao, và mỗi ngôn ngữ giao diện có nội dung riêng thế nào?
6. Quy tắc phụ thuộc nào phải được lint kiểm tự động, cho cả Server và Studio?
