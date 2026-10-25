# Phase 4 — Lượt K3d: Bộ tìm route, sửa route kiểu JSX, mẫu trang, Cài router

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

Lượt này làm theo **2 chặng**. Mỗi lần chạy chỉ làm **một chặng** mà prompt yêu cầu. Xong chặng đó thì `pnpm format`, `pnpm verify` toàn bộ, `pnpm test:e2e` toàn bộ, tất cả xanh rồi mới báo cáo.

## 0. Bối cảnh

Kế hoạch `p4-ke-hoach.md` mục K3 (tính năng 10, 11, "Bộ tìm route", "Mẫu trang"); spec-log #74.

Hiện nay:

- **Danh sách trang** (`server/src/core/project/pages.ts`, `readPages`) đọc route ở **mọi** file: mảng route trong object (`fromRouteArray`) và JSX `<Route>` (`fromRouteJsx`).
- **Thêm, đổi tên, xóa trang, Đưa nháp thành trang** (`page-add.ts`, `page-rename.ts`, `page-delete.ts`, `draft-promote.ts`) chỉ chạy khi có file quy ước `src/routes.tsx`/`.jsx` chứa `createBrowserRouter` (`isConventionFile`). Thiếu là lỗi `E016 notConvention`. Phần sửa nằm ở `routes-ast.ts` (`findRouterArray`, `planAddRouteEdits`, `planDeleteRouteEdits`; route mới chèn trước `path: '*'`).
- **Trang mới** (`buildNewPageSource` trong `page-add.ts`) luôn dùng class Tailwind (`mx-auto max-w-5xl p-8`). Dự án CSS, Sass, Bootstrap cũng bị gán class này: **lỗi**, sửa trong lượt này.
- Template dự án mới (`templates/vite-react-ts-tailwind4`): `src/routes.tsx` dùng `createBrowserRouter`, `src/main.tsx` dùng `<RouterProvider router={router} />`, `react-router` bản `7.18.4`.
- Đã có sẵn: tìm file import theo đường dẫn tương đối và `@/` (`core/project/file-importers.ts`, K3b); job `project.install` (`core/project/project-install.ts`, `startInstallJob`); bộ chọn file `FolderPicker` chế độ `file` (K3c); menu chuột phải cây (`features/files/files-design-menu.tsx`); `PATCH /project`.

Không sửa: Bridge, `docs/spec.md`, `e2e/`, `fixtures/`; MCP (`kumicraft_create_page` gọi `POST /project/pages` nên tự hưởng lợi, không đổi code MCP).

## 1. Mục tiêu (người dùng thấy gì)

1. Dự án có router ở **bất kỳ file nào** đi tới được từ file khởi động (ví dụ `src/router/AppRouter.jsx` như WorkTracker), viết kiểu `createBrowserRouter([...])` hoặc kiểu JSX `<Routes><Route …/></Routes>` → Thêm, đổi tên, xóa trang và Đưa nháp đều **chạy được**, sửa đúng file router đó.
2. Trang khai báo bằng `lazy(() => import('./pages/About'))` (biến hoặc thuộc tính `lazy` của route) vẫn hiện trong danh sách trang, kèm đúng file.
3. **Không chắc** (nhiều router, route sinh bằng code) → KumiCraft **không đoán**. Panel Trang báo lý do và cho người dùng **chọn file router**: bấm một ứng viên, hoặc chọn trên cây. Lựa chọn lưu vào `workspace.json`.
4. Dự án **chưa có router** → panel Trang có nút **"Cài router"**. Hộp xác nhận liệt kê các thay đổi; đồng ý thì sửa file thành **một bước Undo** rồi chạy cài gói.
5. **Trang mới viết theo mẫu các file cùng thư mục**: đuôi file, kiểu export, layout bọc ngoài, thẻ gốc và class của thẻ gốc. Thư mục trống thì học theo thư mục trang đầu tiên; không có mẫu thì dùng mẫu trung tính, **không** gán class Tailwind cho dự án không dùng Tailwind.

## 2. Đọc trước (CW-52)

| File                                                                                                                     | Lý do                              |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `docs/construction/giao-viec/p4-ke-hoach.md` mục K3; `spec-log.md` #65, #73, #74                                         | Quyết định                         |
| `packages/server/src/core/project/pages.ts`, `routes-ast.ts`                                                             | Đọc và sửa route hiện tại          |
| `packages/server/src/core/project/page-add.ts`, `page-rename.ts`, `page-delete.ts`, `draft-promote.ts`, `page-common.ts` | Bốn luồng dùng `routesFile`        |
| `packages/server/src/core/project/file-importers.ts`                                                                     | Cách giải import tương đối và `@/` |
| `packages/server/src/core/project/project-install.ts`, `project-workspace-file.ts`                                       | Job cài gói, `PATCH /project`      |
| `packages/shared/src/project.ts` (`PagesInfo`), `workspace-file.ts`                                                      | Hợp đồng                           |
| `templates/vite-react-ts-tailwind4/src/routes.tsx`, `main.tsx`, `package.json`                                           | Mẫu router chuẩn của KumiCraft     |
| `packages/studio/src/features/pages/*`, `features/files/files-design-menu.tsx`, `features/files/folder-picker.tsx`       | Chặng B                            |

## 3. Hợp đồng

### 3.1. Shared

```ts
// workspace-file.ts: WorkspaceFileSchema thêm
routing: z.strictObject({ file: RelPathSchema.optional() }).optional(),
// Không có `routing.file` = tự tìm. PATCH /project nhận `routing`; gửi `routing: {}` = về tự tìm.

// project.ts
export const RouterKindSchema = z.enum(['dataRouter', 'jsxRoutes']);
export const RouterStatusSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('found'), file: RelPathSchema, line: z.number().int().min(1), kind: RouterKindSchema, chosen: z.boolean() }),
  z.strictObject({ status: z.literal('ambiguous'), candidates: z.array(RelPathSchema).min(2).max(10) }),
  z.strictObject({ status: z.literal('unsupported'), file: RelPathSchema, reason: z.enum(['generated', 'noRoutes', 'parseError']) }),
  z.strictObject({ status: z.literal('none'), hasRouterPackage: z.boolean() }),
]);
// PagesInfo thêm `router: RouterStatus`. Giữ `convention` và `routesFile` cho tương thích:
// convention = router.status === 'found'; routesFile = router.file khi found.
```

### 3.2. Server: bộ tìm route (`core/project/route-finder.ts`, chặng A)

1. **File khởi động:** `<script type="module" src="…">` trong `index.html` ở gốc dự án; không có thì `sourceDir/main.{tsx,jsx,ts,js}`, rồi `sourceDir/index.*`.
2. **Đi theo import** tương đối và `@/` (dùng lại cách giải của `file-importers.ts`, không viết lại), tối đa 200 file và độ sâu 20. Không đi vào `node_modules`.
3. **Nhận diện trong mỗi file:**
   - `createBrowserRouter` / `createHashRouter` / `createMemoryRouter` / `useRoutes` với đối số là mảng literal, **hoặc** biến trỏ tới mảng literal khai báo trong cùng file, **hoặc** mảng `import` từ file khác (khi đó file router là **file chứa mảng**) → `dataRouter`.
   - `<Routes>` có con `<Route>` → `jsxRoutes`.
   - Đối số không phải mảng literal (gọi hàm, `.map`, spread từ biến không phải literal) → `unsupported` `generated`.
4. **Kết luận:**
   - `routing.file` có trong `workspace.json` → chỉ đọc file đó: router đọc được → `found` (`chosen: true`); không phải → `unsupported` kèm lý do.
   - Đúng một router đọc được → `found` (`chosen: false`).
   - Hai router trở lên → `ambiguous` (danh sách file).
   - Không có router, `package.json` có `react-router` hoặc `react-router-dom` → `none` `hasRouterPackage: true`; không có → `hasRouterPackage: false`.
5. `readPages` dùng kết quả này cho `convention`, `routesFile`, `router`. **Danh sách trang vẫn đọc như hiện nay**, chỉ thêm `lazy()`:
   - `const About = lazy(() => import('./pages/About'))` → `<About />` trong route trỏ tới `src/pages/About.*`;
   - thuộc tính `lazy: () => import('./pages/About')` của object route.
6. Thay mọi chỗ kiểm `isConventionFile`/`notConvention` bằng `router.status === 'found'`. Lỗi khi không `found`: `E016` với lý do `routerAmbiguous`, `routerUnsupported` hoặc `routerMissing` (bỏ `notConvention`; thêm câu vi/en vào `errors.json`).

### 3.3. Server: sửa route kiểu JSX (`routes-jsx.ts`, chặng A)

`planAddRouteEdits`, `planDeleteRouteEdits` và phần sửa route trong `page-rename.ts` làm được với **cả hai** kiểu:

- **Thêm:** `<Route path="about" element={<About />} />`. Có `<Route>` cha bọc layout (một `<Route element={<Layout/>}>` duy nhất ngay dưới `<Routes>`) thì chèn vào trong nó, giống cách kiểu mảng chèn vào `children`. Chèn **trước** `<Route path="*" …/>`. Thụt lề theo dòng anh em; dùng đúng kiểu nháy của file. Thêm `import` của trang theo kiểu import sẵn có của file router (có hay không có đuôi file, như `computeRouteImport`).
- **Xóa:** bỏ đúng phần tử `<Route>` của trang (cả dòng); bỏ `import` nếu không còn dùng.
- **Đổi tên:** đổi thuộc tính `path` và tên component, như kiểu mảng.
- Route **tuyệt đối** lồng trong cha (`path="/about"` dưới cha `path="/"`) hay route **tương đối** (`path="about"`): trang mới theo đúng kiểu của các route anh em.
- Giữ nguyên mọi byte không liên quan, như kiểu mảng (test byte-exact).

### 3.4. Server: mẫu trang (`page-template.ts`, chặng A)

`buildPageSource({ fs, root, dir, component, name, language, styling })`, đọc tối đa 10 file `.jsx`/`.tsx` **trực tiếp** trong `dir` (không đệ quy):

| Học gì            | Quy tắc                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đuôi file         | Đa số file mẫu là `.jsx` → `.jsx`; ngược lại theo `language` như hiện nay                                                                                                    |
| Kiểu export       | Đa số `export default function X` → dùng kiểu đó; đa số `const X = () =>` + `export default X` → dùng kiểu đó; còn lại `export function X`                                   |
| Layout bọc ngoài  | Từ một nửa số file mẫu trở lên bọc thẻ gốc bằng **cùng** một component import từ file khác (ví dụ `<MainLayout>`) → bọc như vậy, import đúng đường dẫn tương đối từ file mới |
| Thẻ gốc và class  | Thẻ gốc chung (trong layout nếu có) và `className` **chuỗi tĩnh** giống nhau ở đa số file → dùng lại; class động bỏ qua                                                      |
| Không có file mẫu | Học theo thư mục trang đầu tiên (`designDirs.pages[0]`); vẫn không có → `<main><h1>{tên}</h1></main>`; chỉ dự án Tailwind mới giữ class hiện nay                             |

Bên trong luôn là `<h1>` với tên trang (`escapeJsxText`). Trang mới **không** chép nội dung khác của file mẫu.

### 3.5. Server: Cài router (`router-install.ts`, chặng B)

`POST /project/router/install`, chỉ khi `router.status === 'none'`; trạng thái khác → `E016` `routerExists`.

1. File khởi động phải có dạng `createRoot(…).render(<StrictMode><X /></StrictMode>)` (có hoặc không `StrictMode`), với `X` import từ một file. Khác dạng này → `E016` `routerEntryUnknown`, không đổi gì (người dùng tự làm).
2. Trong **một mục lịch sử** (`history:routerInstall`):
   - tạo `sourceDir/routes.tsx` (`.jsx` khi file khởi động là `.jsx`/`.js`) theo mẫu của template, route index trỏ tới `X`;
   - file khởi động: `<X />` → `<RouterProvider router={router} />`, thêm import `RouterProvider` từ `react-router` và `router`, bỏ import `X` nếu không còn dùng;
   - `package.json`: thêm `"react-router": "7.18.4"` vào `dependencies` (giữ thứ tự khóa và định dạng, chỉ thêm một dòng); bỏ qua bước này nếu `hasRouterPackage`.
3. Rồi gọi `startInstallJob` như luồng cài hiện có; trả `{ jobId }`. Undo trả lại các file; gói đã cài trong `node_modules` vẫn để nguyên (ghi rõ trong hộp xác nhận).

### 3.6. Studio (chặng B)

- **Panel Trang** theo `router.status`:
  - `found`: dòng nhỏ "Router: `<file>`" và nút "Đổi…" (`FolderPicker` chế độ file, đuôi `.jsx .tsx .js .ts`) → `PATCH /project { routing: { file } }`; khi `chosen` thêm nút "Tự tìm" → `routing: {}`.
  - `ambiguous`: thông báo, mỗi ứng viên một nút, cùng "Chọn trên cây…".
  - `unsupported`: lý do (vi/en) cùng "Chọn file khác…".
  - `none`: thông báo và nút **"Cài router"** → hộp xác nhận liệt kê 3 thay đổi (hoặc 2 khi đã có gói) → gọi API → theo dõi job như luồng cài hiện có.
  - Nút Thêm trang chỉ bật khi `found`.
- **Cây:** chuột phải file `.jsx/.tsx/.js/.ts` → "Dùng làm file router" (thêm vào `files-design-menu.tsx`).
- Lỗi của các thao tác này hiện ngay tại chỗ, không nuốt.

## 4. Tình huống test (bắt buộc, tên test có `WP-4.00`)

**Chặng A (server):**

| #   | Tình huống                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `index.html` → `src/main.jsx` → `src/App.jsx` → `src/router/AppRouter.jsx` có `<Routes>` → `found`, đúng file, dòng, `jsxRoutes`                                       |
| A2  | `createBrowserRouter(routes)` với `routes` là mảng import từ `src/routes/index.ts` → file router là `src/routes/index.ts`, `dataRouter`                                |
| A3  | Hai file đều có `<Routes>` đi tới được → `ambiguous` với cả hai; `routing.file` trỏ một trong hai → `found` `chosen: true`                                             |
| A4  | `createBrowserRouter(buildRoutes())` → `unsupported` `generated`; không có router, có `react-router` trong `package.json` → `none` `hasRouterPackage: true`            |
| A5  | File router không đi tới được từ khởi động (file rời) → không tính                                                                                                     |
| A6  | `lazy(() => import('./pages/About'))` và thuộc tính `lazy` → trang có `file` đúng                                                                                      |
| A7  | Thêm trang vào `<Routes>` có `<Route element={<Layout/>}>` cha và `path="*"` → chèn trong cha, trước `*`, import đúng; mọi byte khác giữ nguyên                        |
| A8  | Xóa và đổi tên trang kiểu JSX → đúng phần tử, import thừa bị bỏ; Undo trả byte-exact                                                                                   |
| A9  | `ambiguous` → Thêm trang trả `E016 routerAmbiguous`, không file nào đổi                                                                                                |
| A10 | Mẫu: thư mục có 3 file `.jsx` `export default function`, bọc `<MainLayout>`, gốc `<section className="page">` → trang mới đúng cả 4 điều, import layout đúng đường dẫn |
| A11 | Mẫu: thư mục trống → học theo thư mục trang đầu tiên; dự án CSS không có mẫu → không có class Tailwind                                                                 |
| A12 | Đưa nháp thành trang vào router kiểu JSX chạy được                                                                                                                     |

**Chặng B (cài router + Studio):**

| #   | Tình huống                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Cài router: file khởi động `<StrictMode><App /></StrictMode>` → tạo `routes.tsx`, sửa khởi động, thêm `react-router` vào `package.json`; một mục lịch sử; Undo trả byte-exact cả 3 file |
| B2  | Cài router: khởi động khác dạng → `E016 routerEntryUnknown`, không đổi; đã có router → `routerExists`                                                                                   |
| B3  | Cài router khi đã có gói → không sửa `package.json`; job cài được gọi                                                                                                                   |
| B4  | `PATCH /project { routing: { file } }` lưu vào `workspace.json`; `routing: {}` → bỏ                                                                                                     |
| B5  | Panel Trang `ambiguous` → hiện 2 ứng viên; bấm một → PATCH đúng file; nút Thêm trang tắt                                                                                                |
| B6  | Panel Trang `none` → "Cài router" → hộp xác nhận liệt kê thay đổi → gọi API                                                                                                             |
| B7  | Panel Trang `found` + `chosen` → hiện file và "Tự tìm"; bấm → `routing: {}`                                                                                                             |
| B8  | Cây: chuột phải `.jsx` → "Dùng làm file router" → PATCH; lỗi của PATCH hiện ra                                                                                                          |

## 5. Bẫy đã biết

- **Test cũ:** nhiều test hiện đang dùng `notConvention` hoặc giả định chỉ `src/routes.tsx`. Sửa cho đúng nghĩa mới, ghi trong báo cáo, **không** nới assertion.
- Babel AST: `JSXElement` con có cả `JSXText` khoảng trắng; tính vị trí chèn theo `start`/`end` của node, không theo chỉ số con.
- Chuỗi trong JSX có thể là `path="about"` hoặc `path={'about'}`: đọc được cả hai, viết mới theo kiểu đa số của file.
- `package.json`: sửa bằng chèn chuỗi, giữ nguyên thụt lề và xuống dòng của file (CRLF trên Windows); **không** `JSON.stringify` cả file.
- Đi import có vòng (`A` import `B`, `B` import `A`): nhớ file đã đi.
- Ref DOM theo QC-40: `ref={(el) => { r.current = el ?? undefined; }}`.

## 6. Không được làm

- Không sửa Bridge, `docs/spec.md`, MCP, `e2e/`, `fixtures/` (Claude viết E2E và fixture ở lượt QA).
- Không thêm dependency vào repo.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ cho xanh; không lọc dữ liệu theo đúng giá trị của test.
- File ≤ 400 dòng, hàm ≤ 50 dòng **sau khi chạy Prettier**.
- Không tự commit.

## 7. Tự kiểm trước khi báo cáo (bắt buộc)

1. `pnpm format` → `pnpm verify` **toàn bộ**.
2. `pnpm test:e2e` **toàn bộ**.
3. Chỉ báo cáo khi cả hai xanh. Lỗi lint, typecheck, test thì tự sửa đúng gốc rồi chạy lại, **không dừng để hỏi**.

## 8. Báo cáo (ngắn, tiếng Việt, đặt ở cuối câu trả lời)

```
## BÁO CÁO K3d chặng <A|B>
- verify: <số test> xanh | e2e: <số> xanh
- File tạo: …
- File sửa: …
- Test cũ đã sửa và lý do: …
- Tình huống: A1 <tên test đúng như trong code> — đạt; …
- Khác bản giao việc và lý do: …
```

Đề xuất commit message khi xong cả hai chặng: `feat(server): find routes anywhere and learn new pages from siblings` (đã qua commitlint).
