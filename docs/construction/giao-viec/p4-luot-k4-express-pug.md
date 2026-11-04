# Phase 4 — Lượt K4: Tách adapter framework, xem dự án Express + Pug

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

Lượt này làm theo **2 chặng**. Mỗi lần chạy chỉ làm **một chặng** mà prompt yêu cầu. Xong chặng đó thì `pnpm format`, `pnpm verify` toàn bộ, `pnpm test:e2e` toàn bộ, tất cả xanh rồi mới báo cáo.

- **Chặng A**: mỗi dự án tự chọn adapter khi mở; adapter có "chỉ xem"; nhận diện Express + Pug; bộ tìm route Express; Bridge điều hướng kiểu tải trang; Studio chế độ chỉ xem.
- **Chặng B**: runner Express + Pug: chạy app của dự án, proxy chèn Bridge, đóng dấu `data-rc-loc` cho Pug, tự tải lại.

## 0. Bối cảnh

Kế hoạch `p4-ke-hoach.md` mục K4 và K6 (phần xem); spec-log #72: bản 1.0 **xem** được Express + Pug (chạy server, Canvas, bấm phần tử → mở đúng dòng `.pug`), **chưa sửa** Pug.

Hiện nay:

- `FrameworkAdapter` (`server/src/core/project/frameworks/types.ts`) chỉ có một bản `viteReactAdapter`. **Adapter gắn cứng lúc server khởi động** (`server/src/index.ts` dòng ~245 truyền `viteReactAdapter` vào `server-services.ts`). `detectFramework` (`frameworks/index.ts`) chỉ dùng trong `probe.ts`.
- Runner: `core/runner/runner-service.ts` fork một script con (`runners/vite-react.ts`, đường dẫn từ `resolveRunnerScript` trong `index.ts`), gửi IPC `start` với `RunnerOptions` (`shared/src/runner.ts`), chờ `ready`/`error`.
- Bridge chèn vào trang bằng plugin Vite (`bridge/src/integrations/vite.ts`, `createIndexHtmlTags`: một thẻ JSON `#__rc_bridge` + script module `BRIDGE_CLIENT_URL`). Mã client có sẵn ở dạng chuỗi `BRIDGE_CLIENT_CODE` (`bridge/src/index.ts`).
- Bridge điều hướng bằng `history.pushState` + `popstate` (`bridge-client-runtime.ts`, `handleNavigateMessage`): đúng cho SPA, **không** đổi trang của app render ở server.
- Sửa code đi qua `validateLocAndExt` (`core/source-editor/source-editor-lookup.ts`): đuôi file ngoài `sourceExtensions` → `E023 notJsxFile`.
- Inspector có nút "Mở trong editor" dùng chuỗi `data-rc-loc` (`features/inspector/components/inspector-header.tsx`, `use-open-in-editor.ts`).
- Thư viện đã cài ở gốc repo (Claude cài): `express 5.3.0`, `pug 3.0.4`, `compression 1.8.2`, `helmet 8.3.0`.
- Dự án mẫu (Claude tạo): `fixtures/projects/express-pug`.
  - `app.js` dùng `helmet()` (gửi CSP `frame-ancestors 'self'` và `X-Frame-Options`), `compression()` (gzip), `express.static('public')`, route `/`, `/about`, router `routes/products.js` gắn ở `/products` (`/:id`).
  - Views: `layout.pug` (extends), `partials/nav.pug` (include), `mixins.pug` (mixin), `index.pug`, `about.pug`, `product.pug`.
  - Chạy thẳng được từ repo: `node fixtures/projects/express-pug/app.js` (thư viện lấy từ `node_modules` ở gốc).

**VG-20 đã thử (Claude, đạt):** plugin Pug hook `postLink` duyệt AST, thêm vào mỗi node `Tag` thuộc tính `{ name: 'data-rc-loc', val: JSON.stringify('<file>:<line>:<column>'), mustEscape: false }`, với `file` = `node.filename` tương đối gốc dự án, dùng `/`. Kết quả đúng file và dòng cho cả phần tử trong `extends`, `include` và `mixin`. Duyệt các khóa `nodes`, `block`, `consequent`, `alternate`. Mã thử ở mục 3.6.

Không sửa: `docs/spec.md`, MCP, `e2e/`, `fixtures/` (Claude viết E2E ở lượt QA).

## 1. Mục tiêu (người dùng thấy gì)

1. Mở thư mục dự án Express + Pug → KumiCraft nhận ra "Express + Pug", tin cậy, bấm chạy → Canvas hiện đúng trang app render, có CSS của app.
2. Bấm một phần tử trong Canvas → chọn được, Inspector hiện thẻ và vị trí `views/index.pug:5`; nút "Mở trong editor" mở đúng dòng đó. Phần tử trong layout, partial, mixin mở đúng file của nó.
3. Danh sách trang có `/`, `/about`, `/products/:id`; chọn trang → Canvas tải trang đó.
4. Dự án ở chế độ **chỉ xem**: Studio hiện chip nhỏ "Chỉ xem" trên thanh Canvas; mọi chỗ sửa (class, chữ, kéo thả, chèn từ thư viện, thêm/đổi/xóa trang, nháp, vẽ) bị tắt và nói lý do. Chat AI vẫn dùng được (AI tự sửa file `.pug` được).
5. Sửa file `.pug` hay `.css` trong editor → Canvas tự tải lại. Sửa file `.js` của server → runner tự khởi động lại rồi Canvas tải lại.
6. Dự án React + Vite chạy y như cũ.

## 2. Đọc trước (CW-52)

| File                                                                                                                            | Lý do                          |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `p4-ke-hoach.md` mục K4, K6; `spec-log.md` #72                                                                                  | Phạm vi                        |
| `server/src/core/project/frameworks/*`, `probe.ts`, `project-service.ts`                                                        | Adapter, nhận diện, mở dự án   |
| `server/src/index.ts`, `server-services.ts`                                                                                     | Chỗ đang gắn cứng adapter      |
| `server/src/core/runner/runner-service.ts`, `server/src/runners/vite-react.ts`, `dev-script-port.ts`                            | Runner con, IPC                |
| `shared/src/runner.ts`, `project.ts` (`SupportReport`, `UNSUPPORTED_REASONS`), `workspace-file.ts` (`FRAMEWORK_IDS`)            | Hợp đồng                       |
| `bridge/src/integrations/vite.ts`, `bridge/src/client/bridge-client-runtime.ts`, `bridge/src/client/entry.ts`                   | Chèn Bridge, điều hướng        |
| `server/src/core/source-editor/source-editor-lookup.ts`, `edit-batch.ts`                                                        | Chặn sửa                       |
| `server/src/core/project/pages.ts`, `route-finder.ts`; `shared/src/router-status.ts`, `pages-info.ts`                           | Danh sách trang                |
| `studio/src/features/editor/canvas-area.tsx`, `features/inspector/*`, `features/pages/*`, `features/drafts/*`, `features/dnd/*` | Chỗ sửa trong Studio (chặng A) |

## 3. Hợp đồng

### 3.1. Shared

```ts
// workspace-file.ts
export const FRAMEWORK_IDS = ['vite-react', 'express-pug'] as const;

// project.ts
UNSUPPORTED_REASONS thêm: 'noExpress', 'noPug', 'noServerEntry'
export const EDIT_MODES = ['full', 'viewOnly'] as const;
SupportReportSchema thêm:
  editMode: z.enum(EDIT_MODES).optional(),        // không có = 'full' (dữ liệu cũ)
  serverEntry: RelPathSchema.optional(),          // Express: file khởi động, ví dụ 'app.js'
  viewsDir: RelPathSchema.optional(),             // Express: thư mục views, mặc định 'views'
  versions thêm express?: string, pug?: string

// runner.ts
RUNNER_ERROR_REASONS thêm: 'entryNotFound', 'noListen'
RunnerOptionsSchema thêm (tùy chọn): serverEntry: z.string().min(1), viewsDir: z.string().min(1)

// router-status.ts
RouterKind thêm 'express'
```

### 3.2. Adapter (server)

```ts
export interface FrameworkAdapter {
  readonly id: FrameworkId;
  readonly primaryDependency: string;
  detect(input: DetectInput): Promise<SupportReport>;
  /** Đuôi file sửa được; [] = chỉ xem. */
  readonly sourceExtensions: readonly string[];
  /** Đuôi file chứa phần tử có data-rc-loc (để mở editor, tìm cây trang). */
  readonly markupExtensions: readonly string[];
  readonly editMode: EditMode;
  readonly runner: { readonly entry: string; options(ctx: RunnerContext): RunnerOptions };
  /** Thư mục mẫu khi tạo dự án mới; không có = adapter không tạo dự án. */
  readonly template?: string;
  /** File đổi thì runner tự khởi động lại (Express: .js/.cjs/.mjs ngoài views và public). */
  restartOn?(relPath: string): boolean;
}
```

- `FRAMEWORK_ADAPTERS = [viteReactAdapter, expressPugAdapter]`. Thứ tự nhận diện: adapter nào `supported` trước thì thắng; dự án có cả `vite` và `express` (fullstack một thư mục) → Vite + React thắng.
- **Bỏ gắn cứng**: `server-services.ts` nhận `getAdapter(): FrameworkAdapter` (adapter của dự án đang mở, chọn trong `project-service.open()` bằng `detectFramework`; chưa mở dự án = `viteReactAdapter`). Runner, source editor, page tree, danh sách trang, styling đều đọc qua `getAdapter()`, không giữ bản cũ.
- `resolveRunnerScript(name)` trả script theo `adapter.runner.entry` (`runners/vite-react`, `runners/express-pug`), cả bản build (`dist/runners/*.js`) lẫn bản nguồn. Kiểm tra bước build của CLI có đóng gói script runner mới.
- Chặn sửa: `editMode === 'viewOnly'` → mọi thao tác sửa nguồn (edit batch, chèn, xóa, di chuyển, bọc, text, style apply, thêm/đổi/xóa trang, nháp) trả `E023` với `reason: 'viewOnly'`. Thêm chuỗi lỗi `vi`/`en`: "Dự án này KumiCraft chỉ xem được (Express + Pug); sửa trong editor hoặc nhờ AI."
- `open-in-editor` và việc tìm phần tử theo `data-rc-loc` nhận đuôi trong `markupExtensions`.

### 3.3. Nhận diện Express + Pug (`frameworks/express-pug/detect.ts`)

- `package.json` có `express` (dependencies hoặc devDependencies) và `pug` → `supported` nếu tìm được file khởi động; thiếu → `noExpress`/`noPug`.
- File khởi động, theo thứ tự:
  1. `scripts.dev`, rồi `scripts.start`: lệnh dạng `node [cờ…] <file>` hoặc `nodemon [cờ…] <file>`;
  2. trường `main`;
  3. file có sẵn đầu tiên trong: `app.js`, `server.js`, `index.js`, `bin/www`, `src/app.js`, `src/server.js`, `src/index.js` (cả `.cjs`, `.mjs`).

  Không thấy → `supported: false`, `noServerEntry`.

- `viewsDir`: đọc literal trong `app.set('views', path.join(__dirname, '<dir>'))` hoặc `app.set('views', '<dir>')` ở file khởi động; không đọc được → `views`.
- `sourceDir` của dự án = `viewsDir`. `language: 'js'`, `editMode: 'viewOnly'`, `styling.editable: false`.
- Không chạy code của dự án lúc nhận diện.

### 3.4. Bộ tìm route Express (`frameworks/express-pug/routes.ts`)

- Đọc tĩnh (Babel parser, như `pages.ts`) file khởi động và file nó `require`/`import` (tương đối).
- `app.get('<literal>', …)` và `router.get('<literal>', …)` → trang. `app.use('<prefix>', require('./routes/x'))` hoặc biến đã `require` → ghép prefix với route của router trong file đó.
- `res.render('<literal>')` trong handler → `file` của trang = `<viewsDir>/<tên>.pug`.
- Đường dẫn có `:param` → `dynamic: true`. Đường dẫn không phải literal → bỏ, không đoán.
- `RouterStatus`: có route → `found`, `kind: 'express'`, `file` = file khởi động; không có → `none`.

### 3.5. Bridge

- Thẻ JSON `#__rc_bridge` thêm `navigation: 'history' | 'document'` (không có = `history`). `document` → `handleNavigateMessage` dùng `window.location.assign(route)`.
- Xuất hàm dùng chung `bridgeHeadHtml(options): string`: chuỗi HTML của 2 thẻ trong `createIndexHtmlTags` (JSON thoát `<` thành `<`), thêm thuộc tính `nonce` vào script khi có `cspNonce`. Plugin Vite giữ nguyên hành vi.
- Chạy lại `pnpm --filter @kumicraft/bridge build` để cập nhật `bridge-client.generated.ts` (có test so khớp).

### 3.6. Runner Express + Pug (chặng B, `server/src/runners/express-pug.ts`)

Một tiến trình con, nhận `start` như runner Vite:

1. **Đóng dấu Pug.** `createRequire(<root>/package.json)('pug')` lấy đúng bản Pug app sẽ dùng. Bọc `compile`, `compileFile`, `render`, `renderFile` và `__express` để thêm plugin `postLink` vào `options.plugins` (giữ plugin sẵn có), như mã thử VG-20:

   ```js
   function walk(node) {
     if (!node || typeof node !== 'object') return;
     if (Array.isArray(node)) return node.forEach(walk);
     if (node.type === 'Tag' && typeof node.line === 'number') {
       const file = path.relative(root, node.filename).split(path.sep).join('/');
       node.attrs.push({
         name: 'data-rc-loc',
         val: JSON.stringify(`${file}:${node.line}:${node.column ?? 1}`),
         mustEscape: false,
       });
     }
     for (const key of ['nodes', 'block', 'consequent', 'alternate'])
       if (node[key]) walk(node[key]);
   }
   ```

   - Không gắn cho `html`, `head`, `body` và mọi thẻ trong `head`.
   - Bỏ qua thẻ đã có `data-rc-loc`.
   - Tắt cache view (`app.set('view cache', false)` không với tới được; thay vào đó đặt `NODE_ENV=development`) để sửa `.pug` là thấy ngay.

2. **Bắt cổng của app.** Bọc `net.Server.prototype.listen` **trước** khi nạp app: lần `listen` đầu tiên của app đổi thành cổng `0`, host `127.0.0.1` (S-01: không mở ra mạng), ghi lại cổng thật khi `listening`. Đặt `process.env.PORT` = cổng nội bộ đó cho app đọc `PORT`. App không `listen` sau 20 giây → `error` `noListen`.
3. **Nạp app.** `require` file khởi động (CommonJS); `"type": "module"` hoặc `.mjs` → `import(pathToFileURL(entry))`. Thư mục làm việc = gốc dự án. Lỗi khi nạp → `error` kèm thông điệp, log như runner Vite.
4. **Proxy** (`node:http`), lắng nghe `127.0.0.1:<options.port>` (cổng KumiCraft cấp), chuyển mọi request tới cổng của app, giữ method, header, body; hỗ trợ `upgrade` (WebSocket) bằng cách nối socket.
   - Gửi lên app `accept-encoding: identity`.
   - Phục vụ `BRIDGE_CLIENT_URL` bằng `BRIDGE_CLIENT_CODE` (`text/javascript`).
   - Response `text/html`: đọc hết body (tối đa 10 MB, quá thì trả nguyên văn), chèn `bridgeHeadHtml({ nonce, studioOrigin, rootDir, navigation: 'document', cspNonce })` ngay sau `<head…>` (không có `<head>` thì đầu `<html…>`, không có cả hai thì đầu body), sửa `content-length`.
   - Header: bỏ `x-frame-options`. `content-security-policy` có `frame-ancestors` thì thay bằng `frame-ancestors <studioOrigin>`. Có `script-src` (hoặc `default-src` khi không có `script-src`) thì thêm `'nonce-<cspNonce>'`. `cspNonce` sinh mới mỗi response.
   - `Location` trỏ về cổng nội bộ của app → đổi về origin của request (giữ được phiên `s<n>.localhost`).
   - Response khác `text/html`: chuyển thẳng (stream).
5. Proxy và app đều sẵn sàng → gửi `ready` với cổng proxy. `stop` → đóng proxy rồi thoát.
6. **Tự tải lại.**
   - Server: file đổi mà `adapter.restartOn(rel)` đúng → `runnerService.restart()` (gom 500 ms).
   - Studio: dự án `express-pug`, có sự kiện file đổi trong `viewsDir` hoặc `public` (hay file `.css`) → tải lại iframe Canvas (gom 300 ms).

### 3.7. Studio chế độ chỉ xem (chặng A)

- Một hook `useEditMode()` đọc `project.support.editMode` (không có = `full`). Mọi chỗ sửa dùng hook này, không rải điều kiện theo framework.
- `viewOnly`:
  - thanh Canvas có chip nhỏ "Chỉ xem", tooltip nói lý do và cách sửa (editor hoặc AI);
  - Inspector ẩn các ô sửa, hiện một dòng lý do cùng nút "Mở trong editor";
  - tắt nhấp đúp sửa chữ, kéo thả, chèn từ thư viện, công cụ vẽ;
  - panel Trang: ẩn thêm/đổi tên/xóa, Đưa nháp;
  - chọn trang vẫn chạy.
- Màn hình tạo dự án mới chỉ liệt kê adapter có `template`.

## 4. Tình huống test (bắt buộc, tên test có `WP-4.00`)

| #   | Tình huống                                                                                                                                                                                              | Chặng |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A1  | `detectFramework` với `fixtures/projects/express-pug` → `express-pug`, `supported`, `serverEntry: 'app.js'`, `viewsDir: 'views'`, `editMode: 'viewOnly'`; dự án Vite + React mẫu → `vite-react` như cũ  | A     |
| A2  | File khởi động: `scripts.start = "nodemon --watch src src/server.js"` → `src/server.js`; chỉ có `bin/www` → `bin/www`; không có gì → `noServerEntry`; có `express` không có `pug` → `noPug`             | A     |
| A3  | Có cả `vite`, `react` và `express`, `pug` → `vite-react`                                                                                                                                                | A     |
| A4  | Mở dự án Express rồi mở dự án Vite trong cùng server → runner và source editor dùng đúng adapter của dự án đang mở (không giữ bản cũ)                                                                   | A     |
| A5  | Dự án `viewOnly`: edit batch, chèn, xóa trang, style apply → `E023 viewOnly`; file không đổi                                                                                                            | A     |
| A6  | Route Express của fixture → `/`, `/about`, `/products/:id` (dynamic), file view đúng; `app.get(pathVar, …)` bị bỏ                                                                                       | A     |
| A7  | Bridge `navigation: 'document'` → navigate gọi `location.assign`; không có trường → `pushState` như cũ                                                                                                  | A     |
| A8  | `bridgeHeadHtml` thoát `</script>` trong JSON; có `cspNonce` thì script có `nonce`                                                                                                                      | A     |
| A9  | Studio `viewOnly`: có chip "Chỉ xem"; Inspector không có ô sửa class; nhấp đúp không bắt đầu sửa chữ; panel Trang không có nút thêm                                                                     | A     |
| B1  | Plugin Pug với fixture: `h1.hero-title` có `views/index.pug:5:3`, `nav` có `views/partials/nav.pug:1:1`, `.card` có `views/mixins.pug:2:3`; `html`/`head`/`body`/`meta` không có                        | B     |
| B2  | Proxy (test với app Express tạo trong test, có `helmet()` và `compression()`): HTML trả về có thẻ Bridge, không có `x-frame-options`, CSP có `frame-ancestors <studioOrigin>` và `'nonce-…'`, không nén | B     |
| B3  | Proxy: `/style.css` chuyển nguyên văn đúng `content-type`; redirect `Location: http://127.0.0.1:<cổng app>/x` đổi về origin của request; `BRIDGE_CLIENT_URL` trả mã Bridge                              | B     |
| B4  | Runner con chạy fixture thật (fork như runner-service): `ready`, GET `/` qua proxy có `data-rc-loc`, `stop` đóng hết; app `listen(3000)` cứng vẫn không chiếm cổng 3000                                 | B     |
| B5  | App không `listen` → `noListen`; file khởi động ném lỗi → `error` có thông điệp                                                                                                                         | B     |
| B6  | `restartOn`: `app.js`, `routes/products.js` → đúng; `views/index.pug`, `public/style.css` → sai                                                                                                         | B     |

## 5. Bẫy đã biết

- Pug của app phải là **cùng một bản** với bản bị bọc: lấy bằng `createRequire` từ gốc dự án, rồi mới nạp app. Express gọi `require(engine).__express`: phải bọc cả `__express`.
- Duyệt AST: `postLink` chạy sau khi gộp `extends`/`include`, `node.filename` là file thật của từng thẻ. Đừng dùng `postParse` (chưa gộp, filename sai với partial).
- Bọc `listen` chỉ lần đầu; server khác app tạo sau (WebSocket gắn vào cùng server) không bị đổi cổng.
- Header `content-length` phải tính bằng byte (`Buffer.byteLength`), không bằng độ dài chuỗi (tiếng Việt).
- CSP có thể nằm trong nhiều header hoặc nhiều chỉ thị; chỉ sửa `frame-ancestors`, `script-src`/`default-src`, giữ nguyên phần còn lại.
- Proxy, app: chỉ `127.0.0.1`; runner chỉ chạy khi dự án đã tin cậy (đã có kiểm ở `runner-service`).
- Windows: so đường dẫn bằng `/`; `bin/www` không có đuôi.
- Test chạy app thật phải đóng server và tiến trình con trong `afterEach`, cổng lấy động (không cố định 3000).
- Ref DOM theo QC-40: `ref={(el) => { r.current = el ?? undefined; }}`.

## 6. Không được làm

- Không sửa `docs/spec.md`, MCP, `e2e/`, `fixtures/` (Claude viết E2E ở lượt QA).
- Không thêm dependency vào `packages/*` (proxy dùng `node:http`; Pug và Express là của dự án người dùng).
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ cho xanh; không lọc theo đúng giá trị của test.
- File ≤ 400 dòng, hàm ≤ 50 dòng sau khi chạy Prettier.
- Không commit; không chạy git checkout/restore/reset/stash/clean; không cài gói.

## 7. Tự kiểm trước khi báo cáo (bắt buộc)

1. `pnpm format` → `pnpm verify` toàn bộ → `pnpm test:e2e` toàn bộ.
2. Chỉ báo cáo khi cả hai xanh; lỗi thì tự sửa đúng gốc rồi chạy lại, không dừng để hỏi.
3. Chặng B: tự chạy thử bằng tay `node` với fixture (proxy + `curl`/`fetch` GET `/`) và chép 3 dòng HTML có `data-rc-loc` vào báo cáo.

## 8. Báo cáo (ngắn, tiếng Việt, ở cuối câu trả lời)

```
## BÁO CÁO K4 chặng <A|B>
- verify: <số test> xanh | e2e: <số> xanh
- File tạo: …
- File sửa: …
- Test cũ đã sửa và lý do: …
- Tình huống: A1 <tên test đúng như trong code> — đạt; …
- Khác bản giao việc và lý do: …
```

Đề xuất commit message: chặng A `feat(server): pick framework adapter per project, express view only`; chặng B `feat(server): run express pug projects behind a bridge proxy`.
