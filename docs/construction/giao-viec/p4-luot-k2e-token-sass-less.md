# Phase 4 — Lượt K2e: Token/Brand cho mọi hệ CSS, đọc và sửa Sass/Less (R-ST-02, R-ST-04, R-ST-06, R-ST-11)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

## 0. Bối cảnh

Lớp style (ADR-BE-35, SPEC-04 mục 25.2) đã đọc và sửa thuộc tính cho CSS thường (K2a, K2b), CSS Modules (K2c), Bootstrap 5 và trạng thái hover/focus/disabled (K2d). Còn thiếu:

1. **Brand (token)** chỉ đọc khối `@theme` của **Tailwind 4** (`core/project/theme.ts`, `GET/PATCH /project/theme`). Dự án CSS, Sass, Less, Bootstrap mở Brand thấy trống.
2. **Sass (`.scss`) và Less (`.less`)**: Inspector đọc được nguồn nhưng chưa sửa được (không có trong `WRITABLE`); `postcss` mặc định không parse được lồng selector, comment `//`.

Lượt này làm cả hai, theo nguyên tắc style-parity (mọi hệ như nhau, không có "chế độ rút gọn"). Khối Thư viện theo hệ chính và Tailwind 3 để lượt **K2f**.

Không sửa: Inspector Tailwind, `e2e/`, `docs/spec.md` (Claude đã ghi quyết định ở spec-log #64), chat AI, MCP.

## 1. Mục tiêu (người dùng thấy gì)

1. **CSS thường:** `src/index.css` có `:root { --brand-blue: #1d4ed8; --radius-card: 12px; }` → panel Brand hiện màu `brand-blue` và bo góc `radius-card`; sửa giá trị → đổi đúng dòng đó; thêm màu `accent` → `--color-accent: …;` vào cuối khối `:root` (chưa có `:root` thì tạo ở đầu file).
2. **Sass:** `src/styles/main.scss` có `$brand: #e11d48;` → Brand hiện `brand`; sửa đổi đúng dòng. **Less:** `@brand: #e11d48;` tương tự.
3. **Bootstrap 5:**
   - Dự án dùng Sass của Bootstrap (`@import "bootstrap/scss/bootstrap"` trong file `.scss` của dự án): Brand hiện 8 màu theme (`primary` … `dark`), font, cỡ chữ gốc, bo góc, bóng. Màu chưa ghi đè hiện **giá trị mặc định của Bootstrap** kèm nhãn "Mặc định Bootstrap". Sửa `primary` → thêm `$primary: #…;` **trước** dòng import Bootstrap.
   - Dự án dùng CSS đã build (`import 'bootstrap/dist/css/bootstrap.min.css'`): ghi `--bs-primary` **và** `--bs-primary-rgb` trong `:root` của file CSS toàn cục.
4. **Tailwind 4:** giữ nguyên hành vi (test cũ xanh nguyên).
5. **Sửa thuộc tính trong `.scss`/`.less`:** chọn thẻ có rule trong `Card.scss` (kể cả rule lồng `.card { .title { … } }`) → Inspector hiện `src/components/Card.scss:<dòng>`, ô **sửa được**, "tất cả N" sửa đúng khai báo trong file nguồn, "chỉ phần tử này" thêm rule phẳng cuối file.
6. Mọi sửa token là **một mục lịch sử**, Undo trả đúng từng byte (R-ST-15, R-TH-11).

## 2. Đọc trước (CW-52)

| File                                                                                                    | Lý do                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `docs/spec.md` mục 25.2 (R-ST-02, R-ST-11), M-TH (R-TH-10 đến R-TH-14)                                  | Hợp đồng                                                                                                 |
| `docs/construction/spec-log.md` #62 đến #64                                                             | Quyết định K2b, K2d và lượt này                                                                          |
| `packages/server/src/core/project/theme.ts`, `theme-edit.ts` + test                                     | Đọc/sửa `@theme`, `withFileLocks`, `recordWrite`, `pushThemeHistory`, `countTokenUses`, kiểm sau khi ghi |
| `packages/server/src/core/project/project-service.ts` (`theme`, `editTheme`, `themeUsage`)              | Chỗ chọn adapter                                                                                         |
| `packages/shared/src/project.ts` (`ThemeTokenSchema`, `ThemeInfoSchema`, `ThemeEditSchema`), `style.ts` | Hợp đồng dùng chung                                                                                      |
| `packages/server/src/core/style/css-locate.ts`, `css-edit.ts`, `style-service.ts`, `style-apply.ts`     | Tìm và sửa rule; làm Sass/Less theo đúng khuôn này                                                       |
| `packages/server/src/core/project/frameworks/vite-react/styling.ts`                                     | `globalCss` đã gồm `.scss`, `.sass`, `.less`                                                             |
| `packages/studio/src/features/brand/*`, `features/inspector/use-project-theme.ts`                       | Panel Brand                                                                                              |
| `fixtures/projects/react-css/`, `react-bootstrap/`                                                      | Mẫu fixture                                                                                              |

## 3. Hợp đồng

### 3.1. Shared (`packages/shared/src/project.ts`)

- `ThemeTokenSchema` thêm:
  - `variable: z.string().max(100).optional()` — tên biến thật trong file (`--brand-blue`, `$primary`, `@brand`, `--bs-primary`); Tailwind 4 để trống như cũ.
  - `inherited: z.boolean().optional()` — `true` khi là giá trị mặc định của Bootstrap, dự án chưa ghi đè.
- `ThemeInfoSchema` thêm `system: StyleSystemIdSchema.optional()` (hệ của các token).
- Không đổi `ThemeEditSchema` (`set`/`add`/`remove`, `kind`, `name`, `value`).
- Endpoint **giữ nguyên** `GET/PATCH /project/theme`, `GET /project/theme/usage` (Brand và Inspector đang dùng); không tạo `/style/tokens` (spec-log #64).

### 3.2. Server: adapter token (`packages/server/src/core/style/tokens/`, thư mục mới)

```ts
export type TokenFiles = {
  readonly root: string;
  readonly styling: StylingReport | undefined;
  readonly tailwindCss: RelPath | undefined;
  readonly sourceDir: string;
};
export interface TokenAdapter {
  readonly system: StyleSystemId;
  read(fs: FileSystemPort, files: TokenFiles): Promise<Result<ThemeInfo>>;
  /** Chỉ tính văn bản mới; ghi file, khóa, lịch sử, kiểm lại do `token-service.ts` làm chung. */
  plan(
    fs: FileSystemPort,
    files: TokenFiles,
    edit: ThemeEdit,
  ): Promise<Result<{ readonly file: RelPath; readonly before: string; readonly after: string }>>;
  countUses(source: string, file: string, kind: ThemeTokenKind, token: ThemeToken): number;
}
```

| File                  | Nội dung                                                                                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classify.ts`         | `classifyVariable(name, value): ThemeTokenKind \| undefined` dùng chung cho CSS, Sass, Less (bảng dưới)                                                                                                                                                                 |
| `tokens-tailwind4.ts` | Bọc code cũ của `theme.ts` (`readThemeTokens`, `applyThemeEdit`, `countTokenUses`); **chuyển** code, không chép                                                                                                                                                         |
| `tokens-css.ts`       | Biến `--*` trong `:root` của mọi file `globalCss` đuôi `.css`                                                                                                                                                                                                           |
| `tokens-sass.ts`      | Biến `$*` **cấp cao nhất** (không nằm trong rule, mixin, function) của file `globalCss` đuôi `.scss`/`.sass`                                                                                                                                                            |
| `tokens-less.ts`      | Biến `@*:` cấp cao nhất của file `globalCss` đuôi `.less` (không nhầm với `@media`, `@import`)                                                                                                                                                                          |
| `tokens-bootstrap.ts` | Bảng biến Bootstrap (mục 3.3); chế độ Sass hoặc CSS                                                                                                                                                                                                                     |
| `token-service.ts`    | `adapterFor(primary)`, `readTokens`, `editTokens` (khóa file `withFileLocks`, `recordWrite`, ghi, đọc lại để kiểm, lỗi thì trả nội dung cũ + E024, `pushThemeHistory`), `countUsage` (duyệt `sourceDir` như `countProjectThemeUsage`, thêm file `.css`/`.scss`/`.less`) |

- `recordWrite`, `pushThemeHistory`, `withFileLocks`, vòng duyệt thư mục: **export và dùng lại** từ chỗ đang có (`theme.ts`, `page-common.ts`), không chép. `theme.ts` sau lượt này chỉ còn là lối vào gọi `token-service.ts` (hoặc xóa hẳn nếu `project-service.ts` gọi thẳng; chọn một, ghi báo cáo).
- `project-service.ts`: `theme()`, `editTheme()`, `themeUsage()` gọi `token-service.ts` theo `primarySystem(support.styling)`. Chặn hiện tại `styling.editable === false` → bỏ; thay bằng: không có adapter cho hệ chính → `ok` với các nhóm rỗng (đọc) / `E021 { missing: 'styleAdapter' }` (sửa).
- **`classifyVariable`** (tên không kèm tiền tố `--`, `$`, `@`; xét theo thứ tự):

| Điều kiện                                                                                                     | Kind       | `name` trả cho Brand                  |
| ------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------- |
| tên chứa `shadow`                                                                                             | `shadow`   | bỏ tiền tố `shadow-` nếu có           |
| tên chứa `radius` hoặc `rounded`                                                                              | `radius`   | bỏ tiền tố `radius-` nếu có           |
| tên chứa `font-size`, `text-size` hoặc bắt đầu `fs-`; giá trị là độ dài                                       | `fontSize` | bỏ tiền tố `font-size-`/`text-`/`fs-` |
| tên chứa `font` hoặc `family`                                                                                 | `font`     | bỏ tiền tố `font-`                    |
| giá trị là màu: `#hex` 3/4/6/8, `rgb(a)()`, `hsl(a)()`, `oklch()`, `oklab()`, `lab()`, `lch()`, `color-mix()` | `color`    | bỏ tiền tố `color-` nếu có            |
| còn lại                                                                                                       | bỏ qua     | —                                     |

`name` sau khi bỏ tiền tố phải khớp `THEME_TOKEN_NAME`; không khớp thì bỏ qua biến đó. Hai biến cho ra cùng `kind` + `name` → giữ biến đầu, bỏ biến sau.

- **Sửa (`plan`) cho CSS/Sass/Less:**
  - `set`, `remove`: tìm token theo `kind` + `name` qua `read` → sửa/xóa đúng dòng của `variable` (xóa cả dòng, giữ xuống dòng của file). Không có → `E016 { reason: 'tokenNotFound' }`.
  - `add`: tên biến mới = tiền tố theo kind (`color-`, `font-`, `font-size-`, `radius-`, `shadow-`) + `name`; CSS thêm `--<tên>: <value>;` cuối khối `:root` đầu tiên của file `globalCss` đầu tiên (chưa có → tạo `:root { … }` ở đầu file, sau các dòng `@import`/`@use`/`@charset`); Sass thêm `$<tên>: <value>;` sau biến cấp cao cuối cùng (chưa có → sau các dòng `@use`/`@import`/`@forward` đầu file); Less tương tự với `@<tên>: <value>;`. Đã có → `E016 { reason: 'tokenExists' }`.
  - Giữ thụt lề của dòng bên cạnh, CRLF và BOM (`keepBom: true` như `theme.ts`).
  - Giá trị kiểm bằng `isValidThemeValue(kind, value)` có sẵn; không hợp lệ → `E016 { reason: 'invalidValue' }`.
- **`countUses`:** CSS: `var(--<variable>)`; Sass: `$<variable>` theo sau không phải `[\w-]`, trừ chính dòng khai báo; Less: `@<variable>` tương tự; tính trong file nguồn và file style.

### 3.3. Bootstrap (`tokens-bootstrap.ts`)

Bảng biến (giá trị mặc định là của Bootstrap 5.3.3, dùng khi dự án chưa ghi đè, `inherited: true`):

| kind       | `name`                     | Sass                                                       | CSS                                                                    | Mặc định                                                                                                                                                 |
| ---------- | -------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color`    | `primary` … `dark` (8 tên) | `$primary` …                                               | `--bs-primary` + `--bs-primary-rgb`                                    | `#0d6efd`, `#6c757d`, `#198754`, `#0dcaf0`, `#ffc107`, `#dc3545`, `#f8f9fa`, `#212529` (primary, secondary, success, info, warning, danger, light, dark) |
| `font`     | `sans`                     | `$font-family-sans-serif`                                  | `--bs-font-sans-serif`                                                 | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif`                                      |
| `fontSize` | `base`                     | `$font-size-base`                                          | `--bs-body-font-size`                                                  | `1rem`                                                                                                                                                   |
| `radius`   | `sm`, `base`, `lg`         | `$border-radius-sm`, `$border-radius`, `$border-radius-lg` | `--bs-border-radius-sm`, `--bs-border-radius`, `--bs-border-radius-lg` | `0.25rem`, `0.375rem`, `0.5rem`                                                                                                                          |
| `shadow`   | `sm`, `base`, `lg`         | `$box-shadow-sm`, `$box-shadow`, `$box-shadow-lg`          | `--bs-box-shadow-sm`, `--bs-box-shadow`, `--bs-box-shadow-lg`          | `0 .125rem .25rem rgba(0, 0, 0, .075)`, `0 .5rem 1rem rgba(0, 0, 0, .15)`, `0 1rem 3rem rgba(0, 0, 0, .175)`                                             |

- **Chế độ Sass:** một file `.scss` trong `globalCss` (hoặc file nó `@import`/`@use` ở cấp đầu) có dòng `@import`/`@use` đường dẫn chứa `bootstrap/scss/bootstrap` hoặc `~bootstrap`. Token đọc từ các `$biến` khai báo **trước** dòng đó trong cùng file. Sửa/thêm: sửa dòng có sẵn, hoặc thêm `$<biến>: <value>;` ngay trước dòng import. `remove` = xóa dòng ghi đè (token về mặc định).
- **Chế độ CSS:** còn lại. Token đọc từ `:root` của file `globalCss` `.css` đầu tiên. Màu ghi **hai** biến: `--bs-<name>: <hex>;` và `--bs-<name>-rgb: <r>, <g>, <b>;` (màu không phải `#hex` 3 hoặc 6 ký tự → `E016 { reason: 'invalidValue' }`, vì Bootstrap cần dạng rgb). `remove` xóa cả hai dòng.
- `add` với tên ngoài bảng → `E016 { reason: 'unknownToken' }`. `remove` token đang `inherited` → `E016 { reason: 'tokenNotFound' }`.
- `countUses` màu: số class `(btn|btn-outline|text|bg|border|link|alert|badge|text-bg)-<name>` (ranh giới từ) trong file nguồn; kind khác: 0.
- Biết trước, ghi ở spec-log #64: chế độ CSS không đổi được màu của `.btn-primary` (Bootstrap build sẵn màu nút); muốn đổi hết phải dùng Sass.

### 3.4. Sass/Less trong lớp style (`packages/server/src/core/style/`)

- Thêm dependency **chỉ** `postcss-scss` (`4.0.9`) và `postcss-less` (`6.0.0`) cho `packages/server` (spec-log #64). Không thêm gì khác.
- `css-locate.ts`: hàm `parseStylesheet(text, file): Root` chọn syntax theo đuôi (`.scss` → `postcss-scss`, `.less` → `postcss-less`, còn lại `postcss`). Mọi chỗ đang `postcss.parse` trong `css-locate.ts`, `css-edit.ts` dùng hàm này (truyền `file` hoặc syntax xuống; không lặp code).
- **Selector đã giải lồng:** `resolvedSelector(rule)`: ghép selector với các rule cha (thay `&` bằng selector cha; không có `&` thì nối bằng dấu cách; selector list nhân chéo theo `splitSelectorList` của shared). Rule nằm trong `@mixin`, `@function`, `@each`, `@for`, `@while`, `@if`, `@else`, mixin Less (`.m() { }`), hoặc selector có nội suy `#{`/`@{` → coi như **không tìm được** (đọc: `reason: 'expression'`, `editable: false`).
- `@media` lồng trong rule (`.card { @media (…) { … } }`) tính như media của rule đó (dùng `normalizeMedia` có sẵn).
- `locateRule` cho `.scss`/`.less` so `resolvedSelector` với selector của probe (cùng `media`, `occurrence`), thay vì selector thô.
- **File con:** Vite báo rule của partial (`_card.scss` được `@use`/`@import` vào `main.scss`) dưới id của file chính. Không tìm thấy rule trong file chính thì tìm trong các file nó `@use`/`@import`/`@forward` (đường dẫn tương đối; thử `x.scss`, `_x.scss`, `x/_index.scss`; Less: `x.less`), sâu tối đa 2 cấp, tối đa 20 file. `StyleSource.file` và file ghi là **file thật chứa rule**. Viết một hàm `findRuleSource(fs, root, entryFile, rule)` dùng chung cho `style-service.ts` và `style-apply.ts`.
- **Ghi:** "tất cả N" sửa khai báo ngay trong rule tìm được (kể cả rule lồng) như `setRuleDeclaration`; "chỉ phần tử này" thêm rule **phẳng** (selector đã giải lồng + class riêng) cuối file, như CSS thường. Khung có `media` mà rule không có → `appendRule` khối `@media` phẳng cuối file. Không bao giờ sửa trong mixin/vòng lặp.
- Sau khi ghi, parse lại bằng đúng syntax; lỗi → `E024`, không ghi.
- `systemOfFile` giữ `sass`/`less`; `WRITABLE` (Studio) thêm `'sass'`, `'less'`.

### 3.5. Studio (`packages/studio/src/features/brand/`)

- Panel Brand hiện cho **mọi** hệ có adapter (`theme.system` có giá trị), không chỉ Tailwind.
- Mỗi dòng token: tên + `variable` (chữ nhỏ, `font-mono`, khi có) để người dùng biết biến nào trong file.
- `inherited: true`: nhãn `brand.inherited` ("Mặc định Bootstrap" / "Bootstrap default"), không có nút xóa; sửa giá trị như token thường (server tự thêm dòng ghi đè).
- Đầu panel: tên hệ (`brand.system.<id>`, vi/en cho `tailwind4`, `css`, `sass`, `less`, `bootstrap5`) và file token (`theme.file`).
- Không đổi `project-client.ts` (endpoint giữ nguyên), chỉ dùng thêm các trường mới.

### 3.6. Fixture

- `fixtures/projects/react-sass/` (chép `react-css`, `id` 10 ký tự ví dụ `e2esass001`, thêm `"sass": "1.83.0"` vào `devDependencies` của fixture): `src/main.tsx` import `./styles/main.scss`; `main.scss` có `$brand: #e11d48;`, `$radius-card: 12px;`, `@use './card';`; `src/styles/_card.scss` có `.card { padding: 16px; .title { font-size: 18px; } }`; `Home.tsx` ba `<article className="card"><h2 className="title">…</h2></article>`.
- `fixtures/projects/react-less/`: tương tự với `"less": "4.2.1"`, `@brand`, `@import './card.less';`, `card.less` có rule lồng.
- `fixtures/projects/react-bootstrap/`: giữ nguyên; chế độ CSS của Bootstrap dùng `src/index.css` có sẵn.

## 4. Tình huống test (bắt buộc, ≤ 20, gắn mã trong tên test)

| #   | File test                                  | Tình huống → kết quả                                                                                                                                                  | Mã               |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `tokens/classify.test.ts`                  | `brand-blue` + `#1d4ed8` → color `brand-blue`; `radius-card` + `12px` → radius `card`; `shadow-soft` → shadow `soft`; `gap` + `12px` → bỏ qua                         | R-ST-11          |
| 2   | như trên                                   | `font-size-lg` + `1.25rem` → fontSize `lg`; `font-body` + `"Inter", sans-serif` → font `body`; tên `Brand_X` → bỏ qua (sai `THEME_TOKEN_NAME`)                        | R-ST-11          |
| 3   | `tokens/tokens-css.test.ts`                | Đọc `:root` ở 2 file `globalCss` → token đủ, `variable` đúng, `system: 'css'`; biến trong rule khác `:root` không tính                                                | R-ST-11          |
| 4   | như trên                                   | `set` đổi đúng một dòng, file còn lại giữ từng byte (CRLF + BOM)                                                                                                      | R-ST-11, R-TH-11 |
| 5   | như trên                                   | `add` color `accent` khi file chưa có `:root` và có `@import` đầu file → `:root` tạo sau `@import`; `add` trùng → E016 `tokenExists`                                  | R-ST-11          |
| 6   | `tokens/tokens-sass.test.ts`               | `$brand` cấp cao đọc được; `$local` trong `.a { $local: red; }` và trong `@mixin` không đọc; `remove` xóa đúng dòng                                                   | R-ST-11          |
| 7   | `tokens/tokens-less.test.ts`               | `@brand: #e11d48;` đọc được; `@media`, `@import` không bị coi là biến; `set` đổi đúng dòng                                                                            | R-ST-11          |
| 8   | `tokens/tokens-bootstrap.test.ts`          | Chế độ CSS, chưa ghi đè → 8 màu `inherited: true` với giá trị mặc định; `set primary #ff0000` → `:root` có `--bs-primary: #ff0000;` và `--bs-primary-rgb: 255, 0, 0;` | R-ST-11          |
| 9   | như trên                                   | Chế độ CSS, `set primary rgb(1,2,3)` → E016 `invalidValue`, file không đổi                                                                                            | R-ST-11          |
| 10  | như trên                                   | Chế độ Sass (`main.scss` có `@import "bootstrap/scss/bootstrap";`) → `set primary` thêm `$primary: …;` ngay trước dòng import; `remove` trả về `inherited`            | R-ST-11          |
| 11  | `tokens/token-service.test.ts`             | `editTokens` một lần → một mục lịch sử, `before`/`after` đúng; Undo (ghi `before`) trả đúng từng byte                                                                 | R-ST-15, R-TH-11 |
| 12  | như trên                                   | Dự án hệ chính `tailwind4`: đọc/sửa giống hệt trước (chạy lại một tình huống của `theme.test.ts` qua `token-service`)                                                 | R-TH-10          |
| 13  | như trên                                   | `countUsage` CSS đếm `var(--brand-blue)` trong `.css` và `.tsx`; Bootstrap đếm `btn-primary`, `text-primary` nhưng không đếm `primary-nav`                            | R-TH-14          |
| 14  | `style/css-locate.test.ts` (mới hoặc thêm) | `.card { .title {…} &:hover {…} &-body {…} }` → `resolvedSelector` là `.card .title`, `.card:hover`, `.card-body`                                                     | R-ST-04          |
| 15  | như trên                                   | Rule trong `@mixin` và selector `#{$x}` → không tìm được; `@media` lồng trong rule tính là media của rule                                                             | R-ST-04          |
| 16  | `style/style-service.test.ts` (thêm)       | Probe rule `.card .title` sheet `main.scss` (rule nằm ở `_card.scss`) → `source.file` `src/styles/_card.scss`, `line` đúng, `system: 'sass'`                          | R-ST-04          |
| 17  | `style/style-apply.test.ts` (thêm)         | `.scss` "tất cả" sửa khai báo trong rule lồng; comment `//` và phần còn lại giữ từng byte                                                                             | R-ST-06          |
| 18  | như trên                                   | `.less` "chỉ phần tử này" → rule phẳng `.card .title.title-xxxx { … }` cuối `card.less`, JSX có class mới                                                             | R-ST-06          |
| 19  | `brand-panel.test.tsx` (thêm)              | `system: 'bootstrap5'`, token `primary` `inherited` → có nhãn mặc định, không có nút xóa, hiện `variable`                                                             | R-ST-11          |
| 20  | `style-sources-section.test.tsx` (thêm)    | `primary: 'sass'` → ô nhập bật, không có banner chưa hỗ trợ                                                                                                           | R-ST-02          |

## 5. Bẫy đã biết

- `postcss` mặc định coi `// comment` là lỗi và không hiểu lồng; mọi chỗ đọc `.scss`/`.less` phải qua `parseStylesheet`.
- Less: `@brand: x;` là khai báo biến nhưng postcss-less trả về `AtRule` có `variable: true`; `@media` là `AtRule` thường. Đọc biến theo cờ này, không theo tên.
- Sass `$x: 1 !default;` vẫn là biến; giữ nguyên `!default` khi sửa (chỉ thay phần giá trị trước nó).
- Bootstrap Sass: biến khai báo **sau** dòng import không có tác dụng với màu theme; chỉ đọc/ghi phía trước.
- `--bs-primary-rgb` cần dạng `255, 0, 0` (không có `rgb()`), đổi từ hex 3 ký tự phải nhân đôi (`#f00` → `255, 0, 0`).
- Thứ tự `occurrence` của rule lồng: đếm theo selector đã giải lồng, cùng thứ tự tài liệu với trình duyệt.
- Không tìm token bằng regex trên cả file khi đã có AST: biến trong comment hoặc chuỗi không được tính.
- Test Tailwind 4 cũ (`theme.test.ts`, `theme-edit-brief.test.ts`) phải xanh nguyên; nếu đổi chỗ import thì chỉ đổi đường dẫn import.

## 6. Không được làm

- Không sửa `e2e/`, `docs/spec.md`, Inspector Tailwind, chat, MCP.
- Không thêm dependency ngoài `postcss-scss` và `postcss-less` (chỉ cho `packages/server`); fixture được có `sass`, `less`.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null` (QC-40).
- Không nới test cũ cho xanh. Test cũ đỏ vì hợp đồng thêm trường thì **chỉ thêm trường đó** vào dữ liệu test, và ghi vào báo cáo.
- Không đổi đường dẫn endpoint `/project/theme`.
- File mới ≤ 400 dòng; không file nào trong `core/style/` vượt 400 dòng.

## 7. Kiểm tay

1. Chép `fixtures/projects/react-sass` ra thư mục tạm, `pnpm install` trong đó, `npm run dev` ở KumiCraft, mở dự án, tin cậy.
2. Mở Brand → thấy `brand` (màu) và `card` (bo góc), hệ "Sass", file `src/styles/main.scss`. Đổi `brand` thành `#2563eb` → `main.scss` đổi đúng dòng; Undo → về như cũ.
3. Chọn tiêu đề thẻ đầu → `font-size` nguồn `src/styles/_card.scss:<dòng>`, "Ảnh hưởng 3 phần tử". Đổi 20px "tất cả" → 3 tiêu đề đổi, `_card.scss` đổi trong rule lồng.
4. Mở `fixtures/projects/react-bootstrap` → Brand có 8 màu "Mặc định Bootstrap"; đổi `primary` → `index.css` có `--bs-primary` và `--bs-primary-rgb`; chữ `text-primary` (nếu có) đổi màu.
5. Lặp bước 2–3 với `react-less`.

## 8. Báo cáo

Theo mẫu của README:

- danh sách file tạo/sửa/xóa;
- bảng 20 tình huống, mỗi tình huống: **tên test thật như trong code**, đạt/không;
- kết quả `pnpm verify` (số test, cảnh báo lint);
- các bước kiểm tay **trong ứng dụng thật** đã thử (không thay bằng chạy hàm trực tiếp); bước nào không làm được thì ghi rõ.

Không tự commit; đề xuất commit message `feat(server): brand tokens for every style system, edit sass and less` (đã qua commitlint).
