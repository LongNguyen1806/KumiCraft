# Phase 3 — Lượt 7a: Máy chủ MCP cho agent bên ngoài: công cụ đọc và ghi "công cụ còn thiếu" (R-AG-19, R-AG-20)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

> **Đã làm (Claude, 2026-10-23), khác bản này một điểm:** file khóa `.reactcraft/lock` nằm trong **thư mục dự án đang mở**, không nằm trong workspace. Vì vậy lệnh là `reactcraft mcp [thư mục dự án]` (mặc định thư mục hiện tại), và lệnh nối là `claude mcp add reactcraft -- npx reactcraft mcp "<thư mục dự án>"`. Thử thật qua stdio với server chạy và dự án mẫu đã đúng toàn bộ 9 công cụ.

## 0. Bối cảnh (quyết định của chủ dự án, 2026-10-23)

MCP của ReactCraft dành cho **agent bên ngoài** mà người dùng tự nối (Claude Code, Antigravity Desktop/CLI…), **không** cho ô chat trong ReactCraft. Người dùng tự thêm một lần, ví dụ:

```
claude mcp add reactcraft -- npx reactcraft mcp "D:\work\my-workspace"
```

ReactCraft **không** sửa cấu hình của agent nào (S-112 giữ nguyên).

Mục tiêu cuối (sau lượt 7b): agent bên ngoài dựng lại một trang (ví dụ homepage có sẵn) **chỉ bằng công cụ của ReactCraft**. Thiếu công cụ nào thì gọi `report_tool_gap` để chủ dự án biết cần bổ sung gì.

- **Lượt 7a (này):** máy chủ MCP, lệnh `reactcraft mcp`, **công cụ đọc**, cây phần tử của trang (mới), `report_tool_gap`, danh sách "Công cụ còn thiếu" trong Cài đặt.
- **Lượt 7b (sau):** công cụ sửa (class, chữ, thuộc tính, chèn, di chuyển, nhân bản, xóa, bọc, bỏ bọc, thêm trang, token), mỗi lần gọi là một mục lịch sử, Undo trong Studio.

Không sửa Bridge, `e2e/`, `docs/spec.md`, ô chat AI.

## 1. Mục tiêu (người dùng thấy gì)

1. Chạy ReactCraft như thường (`npx reactcraft` hoặc `npm run dev`), mở một dự án đã tin cậy.
2. Trong terminal khác, `npx reactcraft mcp [thư mục workspace]` (dev: `node packages/cli/src/index.ts mcp <thư mục>`) chạy một **máy chủ MCP qua stdio**:
   - tự tìm server ReactCraft đang chạy của workspace đó;
   - mọi thao tác đi qua REST API của server đó, cùng token và cùng kiểm tra như Studio.
3. Claude Code (đã `claude mcp add …`) thấy các công cụ `reactcraft_*` và gọi được. Ví dụ hỏi "liệt kê các trang và cây phần tử của trang Home" thì nhận đúng dữ liệu.
4. Agent gọi `reactcraft_report_tool_gap` → mục mới xuất hiện trong **Cài đặt → Công cụ còn thiếu** (Studio). Có nút **Xuất Markdown** để tải về.
5. Chưa chạy ReactCraft, hoặc chưa mở dự án, hoặc dự án chưa tin cậy → công cụ trả lỗi **dễ hiểu** (`isError: true` kèm câu tiếng Anh giải thích việc cần làm), không treo.

## 2. Đọc trước (CW-52)

| File                                                                                                      | Lý do                                                                                                                            |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `docs/spec.md` R-AG-19, R-AG-20; spec-log                                                                 | Quy tắc gốc (đã đổi: MCP cho agent bên ngoài)                                                                                    |
| `packages/cli/src/index.ts`, `args.ts`, `messages.ts`                                                     | Thêm lệnh con `mcp`                                                                                                              |
| `packages/server/src/core/workspace/lock.ts`                                                              | `.reactcraft/lock` của workspace có `port`, `pid`                                                                                |
| `packages/server/src/core/shared/session-token-store.ts`, `packages/server/src/index.ts` (`configDir`)    | Token phiên lưu ở `session.json` trong thư mục cấu hình người dùng (mode 0600)                                                   |
| `packages/server/src/adapters/http/security.ts`                                                           | Kiểm token (`Authorization: Bearer`), Host, Origin                                                                               |
| `packages/server/src/adapters/http/routes/source.ts`, `project.ts`                                        | Endpoint đọc sẵn có: `/project`, `/project/pages`, `/project/components`, `/project/assets`, `/project/theme`, `/source/element` |
| `packages/server/src/core/source-editor/ast-helpers.ts`, `packages/bridge/src/transform/transform-jsx.ts` | Cách parse JSX và **định dạng `loc`** mà Bridge gắn lên phần tử                                                                  |
| `packages/shared/src/agent.ts` (`ToolGapSchema`), `source.ts` (`parseLocString`)                          | Hợp đồng có sẵn                                                                                                                  |
| `packages/studio/src/features/agents/agent-section.tsx`, `features/settings/settings-dialog.tsx`          | Mẫu mục Cài đặt                                                                                                                  |

## 3. Hợp đồng

### 3.1. Lệnh `reactcraft mcp [dir] [--port <n>]` (`packages/cli`)

- `args.ts`: nhận lệnh con `mcp` (tham số đầu là `mcp`). `--help` liệt kê thêm dòng `reactcraft mcp [dir]   MCP server (stdio) for external AI agents`.
- **Tìm server:**
  1. `dir` mặc định là thư mục hiện tại;
  2. đọc `<dir>/.reactcraft/lock` lấy `port` (dùng lại hàm đọc khóa của server, không viết parser mới);
  3. có `--port` thì dùng `--port`;
  4. token đọc từ `session.json` trong thư mục cấu hình (cùng cách `loadSessionToken` tìm thư mục: `REACTCRAFT_CONFIG_DIR` hoặc env-paths). **Chỉ đọc, không bao giờ tạo hay ghi.**
- Không tìm được port hoặc token → **vẫn khởi động** máy chủ MCP; mỗi lần gọi công cụ thử tìm lại, và trả lỗi `ReactCraft is not running for <dir>. Start it with "npx reactcraft <dir>" and open a trusted project.`
- **Giao thức:** dùng `@modelcontextprotocol/sdk`.
  - Chọn bản **1.x mới nhất đã phát hành ít nhất 14 ngày** (`pnpm view @modelcontextprotocol/sdk time --json`), ghi **đúng số phiên bản** (không `^`) vào `packages/cli/package.json`.
  - Dùng API mức thấp `Server` + `StdioServerTransport` + `setRequestHandler(ListToolsRequestSchema | CallToolRequestSchema)`. Mỗi công cụ có `inputSchema` là **JSON Schema viết tay** (hoặc sinh bằng `z.toJSONSchema` từ zod v4 của dự án). Không dùng `server.tool(...)` dựa trên zod của SDK, để tránh lệch phiên bản zod.
  - `serverInfo`: `{ name: 'reactcraft', version: <phiên bản CLI> }`.
  - `instructions`: "Build and change the open ReactCraft project with these tools. Read before you write. When you need an operation no tool offers, call reactcraft_report_tool_gap, then continue as best you can."
- **stdout chỉ dành cho giao thức MCP.** Mọi log ghi **stderr**, không `console.log`.
- **Gọi server:** `fetch('http://127.0.0.1:<port>/api/v1/…')` với `Authorization: Bearer <token>`, timeout 15 s.
  - Lỗi API (envelope `{ error: { code, params } }`) → kết quả công cụ `isError: true`, nội dung `E0xx: <câu tiếng Anh ngắn>` (lấy từ `messages` có sẵn của CLI hoặc bảng nhỏ trong lượt này; tối thiểu E011, E015, E016, E021).
  - Nếu kiểm tra Host/Origin của server chặn yêu cầu không có `Origin` từ Node: **dừng và báo**, không nới bảo mật.
- **Code đặt ở** `packages/cli/src/mcp/` (`mcp-command.ts`, `mcp-tools.ts`, `server-locator.ts`, `api-client.ts`…). Core của server không biết gì về MCP.

### 3.2. Công cụ (lượt 7a)

Mọi kết quả trả `content: [{ type: 'text', text: <JSON gọn, 2 dấu cách thụt lề> }]`. Tên công cụ có tiền tố `reactcraft_`.

| Công cụ                      | Tham số                                                                      | Gọi                                         | Trả                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `reactcraft_get_project`     | —                                                                            | `GET /project`                              | `name`, `root`, `trusted`, `frames`, `designDirs`, `support.language`, `support.styling` (lượt S1), `backends` (chỉ `label`) |
| `reactcraft_list_pages`      | —                                                                            | `GET /project/pages`                        | Như API                                                                                                                      |
| `reactcraft_get_page_tree`   | `file` (đường dẫn tương đối, `.jsx`/`.tsx`), `maxDepth?` (1–40, mặc định 40) | `GET /source/tree?file=` (**mới**, mục 3.3) | Cây phần tử                                                                                                                  |
| `reactcraft_get_element`     | `loc` (`file:line:col`)                                                      | `GET /source/element?loc=`                  | Như API                                                                                                                      |
| `reactcraft_list_components` | —                                                                            | `GET /project/components`                   | Như API                                                                                                                      |
| `reactcraft_list_assets`     | —                                                                            | `GET /project/assets`                       | Như API                                                                                                                      |
| `reactcraft_get_theme`       | —                                                                            | `GET /project/theme`                        | Như API                                                                                                                      |
| `reactcraft_report_tool_gap` | `need` (1–200), `why` (≤2000), `example` (≤4000)                             | `POST /tool-gaps` (**mới**, mục 3.4)        | `{ need, count }`                                                                                                            |
| `reactcraft_list_tool_gaps`  | —                                                                            | `GET /tool-gaps`                            | Danh sách                                                                                                                    |

Mỗi công cụ có `description` tiếng Anh một hai câu, nói rõ khi nào dùng. Ví dụ `get_page_tree`: "Element tree of one page or component file with each element's loc. Use the loc with the other tools."

### 3.3. Cây phần tử: `GET /source/tree?file=<rel>&maxDepth=<n>` (server, mới)

- `core/source-editor/page-tree.ts`: parse file bằng **cùng cách** `ast-helpers` đang parse (babel, `jsx` + `typescript`). Trả về:

```ts
type PageTreeNode = {
  readonly loc: string; // ĐÚNG định dạng loc Bridge gắn (file:line:col, cùng gốc dòng/cột)
  readonly tag: string; // 'div', 'Card', 'Fragment'…
  readonly kind: 'element' | 'component' | 'fragment';
  readonly className?: string; // chỉ khi là chuỗi tĩnh
  readonly text?: string; // chữ tĩnh con trực tiếp, cắt 80 ký tự
  readonly children: readonly PageTreeNode[];
};
type PageTree = {
  readonly file: string;
  readonly roots: readonly PageTreeNode[];
  readonly truncated: boolean;
};
```

- `roots` là các phần tử JSX gốc (JSX không nằm trong JSX khác) theo thứ tự trong file. Thường là phần `return` của component; mọi JSX gốc trong file đều tính.
- Giới hạn tổng **2000 nút** và `maxDepth`; vượt thì `truncated: true`.
- Schema đặt ở `packages/shared` (`PageTreeSchema`).
- Lỗi:
  - file không tồn tại → E015;
  - đường dẫn thoát khỏi dự án hoặc đuôi khác `.jsx`/`.tsx` → E016;
  - chưa mở dự án → E021 như các route source khác.
- **Bắt buộc:** `loc` của nút dùng được ngay với `GET /source/element`. Có test chứng minh (#6).

### 3.4. Danh sách "công cụ còn thiếu" (server, mới)

- `core/agent/tool-gaps.ts`: lưu ở `<gốc dự án>/.reactcraft/tool-gaps.json`, dạng `{ version: 1, gaps: ToolGap[] }`. Ghi bằng `writeTextAtomic`.
- **Gộp:**
  - mục trùng `need` (so sau `trim` + chữ thường) → `count + 1`, cập nhật `lastAt`, `why`, `example` theo lần mới;
  - tối đa **500 mục**, quá thì bỏ mục `lastAt` cũ nhất.
  - File hỏng thì coi như rỗng và ghi đè ở lần ghi sau (ghi log `warn`).
- **REST:**
  - `GET /tool-gaps` → `ToolGap[]` sắp `count` giảm dần, rồi `lastAt` mới trước;
  - `POST /tool-gaps` body `{ need, why, example }` (`ToolGapReportSchema` mới trong shared) → 201 `ToolGap` đã gộp;
  - cả hai cần dự án mở (E021) và **tin cậy** (E011).

### 3.5. Studio: Cài đặt → "Công cụ còn thiếu"

- `features/agents/tool-gaps-section.tsx` (mới), đặt trong hộp Cài đặt **dưới** mục "Trợ lý AI".
- **`data-testid`:** `tool-gaps`, mỗi dòng `tool-gap-<index>`, `tool-gaps-empty`, `tool-gaps-export`, `tool-gaps-refresh`.
- **Mỗi dòng:** `need` (đậm), số lần ×N, `why`, `example` (monospace, thu gọn tới 3 dòng, bấm để mở), thời gian `lastAt` theo ngôn ngữ giao diện.
- **Chưa có mục:** "Chưa có. Khi agent bên ngoài (Claude Code…) cần thao tác mà ReactCraft chưa có, nó sẽ ghi vào đây."
- Kèm một dòng hướng dẫn nối và lệnh có nút copy: `claude mcp add reactcraft -- npx reactcraft mcp "<thư mục workspace>"`. Thư mục workspace lấy từ `GET /session` nếu có, không thì để `<thư mục workspace>`.
- **Xuất Markdown:** tải file `tool-gaps.md` (Blob + thẻ `a` có `download`). Nội dung:
  - tiêu đề, ngày;
  - mỗi mục là `## need (×count)` rồi `why`, rồi `example` trong khối code.
- Nạp khi mở hộp Cài đặt và khi bấm làm mới. Chưa mở dự án thì ẩn mục.
- i18n vi và en.

### 3.6. Spec-log (số tiếp theo sau #55)

- `#56` R-AG-19, R-AG-20: MCP dành cho agent bên ngoài, người dùng tự nối bằng `reactcraft mcp` (stdio) đi qua REST API của server đang chạy (token đọc từ `session.json`, cổng từ `.reactcraft/lock`). Ô chat trong ReactCraft không dùng MCP ở Phase 3. Lượt 7a: công cụ đọc, cây phần tử `GET /source/tree`, `tool-gaps` lưu ở `.reactcraft/tool-gaps.json` của dự án. Theo chủ dự án 2026-10-23.

## 4. Tình huống test

CLI: unit test `server-locator`, `api-client` (fetch giả). Máy chủ MCP test **thật** bằng `Client` của SDK nối qua `InMemoryTransport` (SDK có sẵn) với server MCP; các test công cụ dùng API client giả. Server: route test qua `app.inject`. Studio: component test.

| #   | Tình huống                                                                                              | Kỳ vọng                                                                                                                                                                 | Mã        |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | `parseCliArgs(['mcp', 'D:\\ws'])`, `['mcp']`, `['mcp', '--port', '4310']`, `['mcp', '--port', 'x']`     | lệnh `mcp` với dir đúng; dir = cwd; port 4310; lỗi dùng sai (mã 2)                                                                                                      | [R-AG-19] |
| 2   | `locateServer`: có lock (port 4310) + `session.json`; thiếu lock; thiếu token; `--port` ghi đè          | `{ port: 4310, token }`; lỗi "not running"; lỗi "not running"; port của `--port`                                                                                        | [R-AG-19] |
| 3   | Client MCP `listTools`                                                                                  | Đủ 9 công cụ đúng tên, mỗi cái có `description` và `inputSchema` kiểu `object`                                                                                          | [R-AG-19] |
| 4   | `reactcraft_get_page_tree` qua client MCP, API giả trả cây                                              | `fetch` tới `/api/v1/source/tree?file=src%2Fpages%2FHome.tsx` với `Authorization: Bearer <token>`; kết quả là JSON của cây                                              | [R-AG-19] |
| 5   | API trả 409 `{ error: { code: 'E011' } }`; server không chạy (fetch lỗi kết nối)                        | `isError: true`, chữ có `E011` và câu tiếng Anh; câu "ReactCraft is not running…"                                                                                       | [R-AG-19] |
| 6   | `GET /source/tree` trên trang mẫu có `<main className="p-4"><Card title="x" /><h1>Xin chào</h1></main>` | Gốc `main` (`kind: element`, `className: 'p-4'`), con `Card` (`component`) và `h1` (`text: 'Xin chào'`); **`GET /source/element?loc=<loc của h1>` trả đúng phần tử h1** | [R-AG-19] |
| 7   | `GET /source/tree` với `../x.tsx`, `src/a.ts`, file không có, chưa mở dự án                             | E016; E016; E015; E021                                                                                                                                                  | [R-AG-19] |
| 8   | File 3000 phần tử; `maxDepth=2`                                                                         | `truncated: true`, tổng nút ≤ 2000; chiều sâu ≤ 2                                                                                                                       | [R-AG-19] |
| 9   | Fragment `<>…</>` và `className={cn('a', b)}`                                                           | `kind: fragment`; nút không có `className` (biểu thức động)                                                                                                             | [R-AG-19] |
| 10  | `POST /tool-gaps` hai lần cùng `need` khác hoa thường/khoảng trắng                                      | Một mục, `count: 2`, `why` theo lần sau                                                                                                                                 | [R-AG-20] |
| 11  | Đã có 500 mục, thêm mục mới                                                                             | Vẫn 500, mục `lastAt` cũ nhất bị bỏ                                                                                                                                     | [R-AG-20] |
| 12  | `tool-gaps.json` hỏng; dự án chưa tin cậy                                                               | GET trả `[]`; E011 cho cả GET và POST                                                                                                                                   | [R-AG-20] |
| 13  | Client MCP gọi `reactcraft_report_tool_gap` rồi `reactcraft_list_tool_gaps` (API giả có trạng thái)     | Mục vừa ghi có trong danh sách                                                                                                                                          | [R-AG-20] |
| 14  | Studio: mở Cài đặt khi có 2 mục                                                                         | `tool-gap-0` là mục `count` lớn hơn; có `×N`; `example` hiện monospace                                                                                                  | [R-AG-20] |
| 15  | Studio: không có mục                                                                                    | `tool-gaps-empty` và lệnh `claude mcp add …`                                                                                                                            | [R-AG-20] |
| 16  | Studio: bấm `tool-gaps-export`                                                                          | Tạo Blob `text/markdown` có `## <need> (×2)` và khối code của `example`; tên tải `tool-gaps.md`                                                                         | [R-AG-20] |
| 17  | Không ghi stdout ngoài MCP: chạy `mcp-command` với transport giả, gọi một công cụ lỗi                   | `process.stdout.write` **không** được gọi; log ra stderr                                                                                                                | [R-AG-19] |

## 5. Kiểm tay (chủ dự án, khoảng 10 phút)

1. `npm run dev`, mở một dự án đã tin cậy (Tailwind hoặc MarketLink).
2. Trong cmd khác, ở thư mục `reactcraft`:
   ```
   claude mcp add reactcraft -- node D:\Study\HK3\PRJ\reactcraft\packages\cli\src\index.ts mcp D:\Study\HK3\PRJ\reactcraft
   ```
   (thư mục cuối là thư mục `npm run dev` đang dùng làm workspace; nếu khác thì đổi theo).
3. Mở Claude Code, gõ `/mcp`: thấy `reactcraft` đã nối, có 9 công cụ.
4. Hỏi Claude Code: "Dùng công cụ reactcraft: liệt kê các trang, rồi cho xem cây phần tử của trang chủ." → kết quả đúng với dự án đang mở.
5. Hỏi: "Đổi màu nút đầu tiên trên trang chủ sang đỏ, chỉ dùng công cụ reactcraft." → Claude Code không có công cụ sửa (để 7b), nên gọi `reactcraft_report_tool_gap`. Mở Studio → Cài đặt → **Công cụ còn thiếu**: thấy mục đó. Bấm **Xuất Markdown**.
6. Tắt `npm run dev`, hỏi lại Claude Code: công cụ trả "ReactCraft is not running…", không treo.

## 6. Bẫy đã biết

1. **stdout của lệnh `mcp` chỉ cho giao thức.** Một dòng `console.log` là hỏng kết nối với Claude Code.
2. Token chỉ **đọc** từ `session.json`; không in token ra log hay lỗi; không ghi file bí mật mới.
3. `loc` của cây phải khớp **đúng từng ký tự** với `loc` Bridge gắn (cùng gốc cột). Lấy từ cùng hàm hoặc cùng quy ước, có test #6.
4. Core server không import gì từ `packages/cli` hay SDK MCP. Route `tool-gaps` và `source/tree` là REST thường.
5. Không `null`, `as`, `any`, `!`, eslint-disable. Hàm ≤ 50 dòng, file ≤ 400 dòng.
6. Phiên bản SDK ghi chính xác, đã phát hành ≥ 14 ngày; `pnpm install` cập nhật lockfile; `scripts/check-package.mjs` (nếu kiểm phụ thuộc của gói CLI) phải xanh.
7. Không lách luật lint bằng mẹo. Gặp luật cản thì đổi thiết kế hoặc dừng và báo.

## 7. Báo cáo và commit

Báo cáo:

- file tạo và sửa, kèm số dòng;
- phiên bản `@modelcontextprotocol/sdk` đã chọn và ngày phát hành;
- bảng 17 tình huống → tên test;
- kết quả `pnpm verify` (số test);
- chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(cli): serve read tools to external ai agents over mcp
```
