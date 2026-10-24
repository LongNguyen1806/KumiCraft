# Phase 2 — Lượt 1: Template dự án mới đầy đủ (WP-2.00)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Kế hoạch chung ở `p2-ke-hoach.md`.

## 1. Mục tiêu (người dùng thấy gì)

Người dùng bấm **Project → Tạo dự án**, cài xong thì Canvas hiện một **website mẫu đầy đủ**:

- Header có logo và menu; hero có tiêu đề, mô tả và hai nút; lưới 3 thẻ sản phẩm; khối giới thiệu; Footer.
- Ô **Trang** trên thanh Canvas có `Home — /` và `About — /about`.
- Mọi phần tử trên trang mẫu chọn được và sửa được bằng Inspector, vì class là chuỗi tĩnh.

Hiện tại template chỉ có một trang "Welcome" nên không có gì để thiết kế. Đây là tính năng chính của sản phẩm.

## 2. Đọc trước (CW-52)

| File                                                                | Lý do                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `docs/spec.md` ADR-BE-32 (tìm `### ADR-BE-32`)                      | Cấu trúc bắt buộc của template                                |
| `docs/spec.md` R-PJ-10, R-PJ-11, R-PG-10, R-CP-10, kịch bản M-CP #1 | Quy ước `routes.tsx`, ba vùng thiết kế, tên component phải có |
| `templates/vite-react-ts-tailwind4/**`                              | Template hiện tại (giữ cách viết import có đuôi `.tsx`)       |
| `packages/server/src/core/project/create.ts`, `create.test.ts`      | Chép template; danh sách file đang **viết cứng**              |
| `packages/server/src/core/project/pages.ts`, `theme.ts`             | Cách KumiCraft đọc trang và token `@theme` (test dùng lại)    |
| `packages/server/src/core/ports/file-system-port.ts`                | `readDir`, `readText`, `writeTextAtomic`                      |

## 3. Phạm vi file

**Tạo hoặc sửa trong `templates/vite-react-ts-tailwind4/`:**

```text
index.html                    thêm <link rel="icon" href="/favicon.svg" />; giữ {{title}}
package.json                  thêm script "lint": "eslint ."; devDependencies ESLint (mục 4.7)
eslint.config.js              mới
README.md                     mới, tiếng Anh
.env.example                  mới: VITE_API_BASE_URL=http://localhost:8000 (kèm 1 dòng chú thích)
public/favicon.svg            mới
public/images/hero.svg        mới; product-1.svg, product-2.svg, product-3.svg (SVG minh họa đơn giản)
src/index.css                 @theme đầy đủ (mục 4.4)
src/routes.tsx                MainLayout + children (mục 4.3)
src/layouts/MainLayout.tsx    mới
src/components/Header.tsx     mới; Footer.tsx, ProductCard.tsx
src/components/ui/Button.tsx  mới; Card.tsx, Input.tsx, Badge.tsx
src/pages/Home.tsx            viết lại; About.tsx, NotFound.tsx mới
src/lib/utils.ts              mới: cn()
.kumicraft/agent-guide.md    cập nhật theo cấu trúc mới
```

Giữ `src/main.tsx`, `src/api/.gitkeep`, `_gitignore`, `vite.config.ts`, `tsconfig.json` (chỉ sửa nếu `build` hoặc `lint` bắt buộc, ghi lý do vào báo cáo).

**Server:**

- `packages/server/src/core/project/create.ts`: bỏ mảng `TEMPLATE_FILES` viết cứng.
  - Thay bằng hàm **duyệt đệ quy** thư mục template qua `deps.fs.readDir`, sắp xếp theo đường dẫn để thứ tự cố định.
  - Đổi tên `_gitignore` → `.gitignore` (bảng đổi tên giữ dạng hằng).
  - Giữ nguyên `fillPlaceholders`, R-PJ-02 (không ghi đè file đã có) và cách dọn khi lỗi.
- `packages/server/src/core/project/create.test.ts`: thêm test mục 5.

**Không sửa:** Studio, Bridge, `docs/spec.md`, test E2E.

- E2E `@network` trong `e2e/project-flow.e2e.ts` tìm heading có chữ `Welcome`, nên tiêu đề hero **phải bắt đầu bằng "Welcome"** (mục 4.5).

## 4. Quy tắc nội dung template (bắt buộc)

### 4.1. Thiết kế được bằng KumiCraft

KumiCraft chỉ sửa được class là **chuỗi tĩnh** và chữ viết thẳng trong JSX. Vì vậy:

1. Mọi `className` là chuỗi tĩnh `className="..."`. **Cấm** `className={...}`, template literal, `cn(...)` trong JSX, class có điều kiện. `cn()` có trong `lib/utils.ts` cho lập trình viên dùng sau, template không dùng.
2. **Cấm `.map(`** trong `src/pages`, `src/components`, `src/layouts`. Ba `ProductCard` viết ra ba lần, và menu Header viết từng `Link`, để mỗi phần tử sửa riêng được.
3. Chữ hiển thị viết thẳng trong JSX. Riêng `ProductCard` nhận props chuỗi (`name`, `price`, `image`, `description`), truyền bằng chuỗi literal ở nơi dùng: `<ProductCard name="Oak chair" price="$120" image="/images/product-1.svg" description="…" />`.
4. Component trong `components/ui/` chỉ có props đơn giản: `children`, và `type` cho `Button`, `Input`. **Không** nhận prop `className` để gộp class, **không** có biến thể (variant).
5. Menu dùng `Link` từ `react-router` với `className` tĩnh. **Không** dùng `NavLink` có `className` dạng hàm.

### 4.2. Không mạng, tiếng Anh, Tailwind chuẩn

- Không có `http://` hoặc `https://` trong `src/` và `index.html`: không font Google, không ảnh mạng. Ảnh dùng `/images/*.svg` trong `public/`.
- SVG minh họa: chỉ hình khối và màu, **không** `<script>`, không thuộc tính `on*`, không `href` ngoài.
- Chữ tiếng Anh trung tính, chủ đề cửa hàng nội thất mẫu tên **"Oakline"**.
- Class chỉ dùng Tailwind v4 chuẩn và token trong `@theme` của template (`bg-brand`, `text-brand-ink`, `rounded-card`, `shadow-card`, `font-display`…).

### 4.3. `src/routes.tsx` (đúng R-PG-10)

```tsx
export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
```

Import tương đối có đuôi `.tsx` như file hiện tại. `MainLayout`: `div.min-h-screen.flex.flex-col` gồm `<Header />`, `<main className="flex-1"><Outlet /></main>`, `<Footer />`.

### 4.4. `src/index.css`

```css
@import 'tailwindcss';

@theme {
  --color-brand: #2563eb;
  --color-brand-soft: #dbeafe;
  --color-brand-ink: #1e3a8a;
  --color-accent: #f59e0b;
  --font-display: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-body: ui-sans-serif, system-ui, sans-serif;
  --radius-card: 1rem;
  --shadow-card: 0 10px 30px -12px rgb(15 23 42 / 0.25);
}
```

Có thể thêm khối `@layer base` đặt `font-family: var(--font-body)` cho `body`. Không thêm token khác ngoài danh sách trên.

### 4.5. Trang

- **Home**:
  - Hero: `h1` bắt đầu bằng **"Welcome"**, ví dụ "Welcome to Oakline". Có đoạn mô tả, hai `Button` ("Shop now", "Learn more") và ảnh `hero.svg`.
  - Section "Featured products": tiêu đề, lưới `grid grid-cols-1 md:grid-cols-3 gap-6`, ba `ProductCard`.
  - Section giới thiệu ngắn: tiêu đề, đoạn văn, một `Badge`.
- **About**: tiêu đề, 2 đoạn văn, một `Card` có `Input` email và `Button` "Subscribe" (form không gửi đi đâu, `onSubmit` chặn mặc định).
- **NotFound**: tiêu đề "Page not found", `Link` về `/`.

### 4.6. `README.md` và `agent-guide.md`

- **README** (tiếng Anh):
  - lệnh `dev`, `build`, `lint`;
  - cây thư mục;
  - ba vùng thiết kế `pages/`, `layouts/`, `components/`;
  - `api/` dành cho code gọi backend;
  - quy ước class tĩnh.
- **agent-guide.md**: thêm `layouts/`, `components/ui/`, quy tắc 4.1 (class tĩnh, không `.map` cho phần hiển thị cần thiết kế).

### 4.7. ESLint

- `eslint.config.js` dạng flat config: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended. Bỏ qua `dist`.
- Phiên bản **chính xác**, lấy theo `package.json` gốc của repo: `eslint` 10.12.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.71.1, `eslint-plugin-react-hooks` 7.1.1.
- Gói nào cần thêm mà repo chưa có: dừng và báo, không tự chọn phiên bản.

## 5. Tình huống test (Vitest, `create.test.ts`, tạo dự án thật vào thư mục tạm)

| #   | Tình huống                                 | Kết quả mong đợi                                                                                                                      | Mã               |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Tạo dự án                                  | Mọi file trong `templates/vite-react-ts-tailwind4/` (duyệt đệ quy, `_gitignore` → `.gitignore`) có trong dự án mới với cùng đường dẫn | R-PJ-10          |
| 2   | Tạo dự án                                  | Có đủ file bắt buộc của mục 3 (liệt kê tên trong test)                                                                                | R-PJ-10          |
| 3   | `readPages` trên dự án mới                 | `convention: true`, `routesFile: 'src/routes.tsx'`, trang `['/', 'Home']`, `['/about', 'About']`; không có `*`                        | R-PG-10          |
| 4   | `readThemeTokens` trên dự án mới           | Màu `brand`, `brand-soft`, `brand-ink`, `accent`; font `display`, `body`; radius `card`; shadow `card`                                | R-CP-10          |
| 5   | Quét mọi `.tsx` trong `src/` của dự án mới | Không có `className={`, không có `` className=` ``; không có `.map(` trong `pages/`, `components/`, `layouts/`                        | R-CP-10          |
| 6   | Quét `src/` và `index.html`                | Không có `http://` hoặc `https://`                                                                                                    | R-PJ-10          |
| 7   | Mọi import tương đối trong `src/`          | Trỏ tới file có thật trong dự án                                                                                                      | R-PJ-10          |
| 8   | Quét `public/**/*.svg`                     | Không có `<script`, ` on` + chữ + `=`, `href="http`                                                                                   | R-PJ-10          |
| 9   | Thư mục rỗng có sẵn `README.md` riêng      | `README.md` của người dùng giữ nguyên (R-PJ-02 với danh sách mới)                                                                     | R-PJ-10          |
| 10  | Các test cũ của `create.test.ts`           | Vẫn xanh, không sửa ý nghĩa                                                                                                           | R-PJ-10, R-PJ-11 |

Test 5–8 đọc file thật trên đĩa. Viết một helper nhỏ trong file test để liệt kê file đệ quy. Không mock.

## 6. Tự kiểm bắt buộc trước khi báo xong

1. `pnpm verify` xanh.
2. Tạo dự án thật **ngoài repo** (ví dụ `D:\tmp\oakline-test`) bằng KumiCraft: `pnpm build`, rồi `node packages\cli\dist\index.js D:\tmp\oakline-test`, Project → Tạo dự án → cài bằng pnpm.
3. Trong `D:\tmp\oakline-test` chạy `pnpm build` và `pnpm lint`. Cả hai phải **không lỗi**. Dán phần cuối output vào báo cáo.
   - Nếu `tsc` báo thiếu kiểu `node:url` trong `vite.config.ts` thì sửa đúng gốc: thêm `@types/node` vào template với phiên bản giống repo nếu repo có, không thì dừng và báo. Không tắt kiểm tra.
4. Không chạy `pnpm test:e2e` ở lượt này.

## 7. Kiểm tay (chủ dự án)

1. Thư mục trống → `node packages\cli\dist\index.js <thư mục>` → Project → Tạo dự án → cài.
2. Canvas hiện Home: Header (logo Oakline, menu Home, About), hero "Welcome…", 3 thẻ sản phẩm có ảnh, khối giới thiệu, Footer.
3. Ô **Trang** có `Home — /` và `About — /about`; chọn About thì Canvas chuyển trang, menu Header cũng chuyển được.
4. Chọn tiêu đề hero → Inspector sửa được màu và cỡ chữ; chọn một nút trong `Button` → Inspector sửa được (không bị khóa vì "class là biểu thức").
5. Chọn một thẻ sản phẩm: panel Lớp hiện nhãn component `ProductCard`.
6. Khung Mobile: lưới sản phẩm thành 1 cột, không tràn ngang.
7. Trong thư mục dự án: `pnpm build` và `pnpm lint` chạy không lỗi.
8. Mở `README.md` của dự án: đọc hiểu được cấu trúc và ba vùng thiết kế.

## 8. Bẫy đã biết

- **Bridge gắn `data-rc-loc`** vào JSX của dự án. Phần tử render bên trong component (ví dụ thẻ `button` trong `Button.tsx`) có vị trí ở file component. Class ở đó phải tĩnh thì Inspector mới sửa được (quy tắc 4.1).
- **`Link` của react-router** chuyển prop lạ xuống thẻ `a`, nên `data-rc-loc` vẫn tới DOM. `NavLink` với `className` dạng hàm làm class thành biểu thức (bị khóa).
- **`allowImportingTsExtensions`** đang bật: giữ import có đuôi `.tsx`/`.ts` như file hiện tại để `tsc --noEmit` không báo lỗi.
- **Template không qua Prettier/ESLint của repo** (`templates/` bị bỏ qua). Tự giữ định dạng gọn, 2 dấu cách, nháy đơn, có dấu chấm phẩy.
- **Không thêm thư viện runtime** (`clsx`, `tailwind-merge`, icon…). `cn()` tự viết: nhận `(string | false | undefined)[]`, lọc rồi nối bằng dấu cách.

## 9. Báo cáo

Theo mẫu trong `README.md`. Thêm:

- cây file template mới;
- output cuối của `pnpm build` và `pnpm lint` trong dự án thử.

Commit gợi ý:

```text
feat(server): ship a full starter site template for new projects
```
