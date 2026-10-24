# Phase 4 — Lượt K2f: Khối Thư viện theo hệ CSS chính, Tailwind 3 (R-ST-02, R-ST-11, R-ST-12)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

## 0. Bối cảnh

Lớp style đã đọc/sửa thuộc tính và token cho CSS thường, CSS Modules, Bootstrap 5, Sass, Less (K2a–K2e), tìm nguồn bằng source map (spec-log #67). Còn hai chỗ chưa theo nguyên tắc style-parity:

1. **Thư viện** (`packages/shared/src/library/blocks-basic.ts`, `blocks-advanced.ts`, 16 khối): mỗi khối là JSX viết sẵn **class Tailwind**. Dự án không dùng Tailwind chèn khối thì class không có tác dụng: khối hiện ra trần, không màu, không khoảng cách.
2. **Tailwind 3**: `styling.editable` chỉ đúng với Tailwind 4 (`frameworks/vite-react/styling.ts` dòng `const editable = primary === 'tailwind' && primaryMajor === 4 …`), nên dự án Tailwind 3 bị Inspector coi là "chưa hỗ trợ", Brand trống.

Claude làm ở lượt QA (không phải việc của bạn): đưa Tailwind 4 vào giao diện lớp style chung, E2E cho Bootstrap/Sass/Less.

Không sửa: `e2e/`, `docs/spec.md`, chat AI, MCP, `core/style/source-map.ts`, `mapped-source.ts`.

## 1. Mục tiêu (người dùng thấy gì)

1. Dự án **Bootstrap 5** kéo khối "Thẻ" vào Canvas → JSX dùng class Bootstrap thật (`card`, `card-body`, `card-title`, `btn btn-primary`); khối hiện đúng kiểu Bootstrap, không thêm CSS.
2. Dự án **CSS thường / Sass / Less** kéo khối "Hàng" → JSX dùng class có nghĩa (`kc-row`, `kc-row-cell`…) và các rule tương ứng được **thêm vào file CSS** mà file trang đang import (hoặc CSS toàn cục; chưa có thì tạo `<File>.css` + import). Kéo khối đó lần hai: rule không bị thêm trùng. Một lần chèn = **một mục lịch sử** cho cả JSX lẫn CSS; Undo trả đúng từng byte.
3. Dự án **CSS Modules**: như CSS thường, rule đi vào file CSS **toàn cục** (class thường, không băm) — spec-log #68.
4. Dự án **Tailwind 4**: khối chèn **giống hệt** hôm nay (test cũ xanh nguyên).
5. Dự án **Tailwind 3**: Inspector Tailwind sửa được class (như Tailwind 4) nhưng ghi đúng tên class của v3 (`shadow` thay vì `shadow-sm` của v4…); khối Thư viện cũng đổi tên class theo v3; Brand đọc/sửa token trong `tailwind.config.*` (`theme.extend`).

## 2. Đọc trước (CW-52)

| File                                                                                               | Lý do                                                                 |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `docs/spec.md` mục 25.2 (R-ST-02, R-ST-11, R-ST-12), M-LB (R-LB-10 đến R-LB-15)                    | Hợp đồng                                                              |
| `docs/construction/spec-log.md` #63, #64, #67, #68                                                 | Quyết định Bootstrap, token, source map và lượt này                   |
| `packages/shared/src/library/*`, `packages/studio/src/features/library/*`                          | Khối, tìm kiếm, `insertBlockAt` (đang gửi `tailwindMajor`)            |
| `packages/server/src/core/source-editor/structure/insert-image.ts`, `structure-plan.ts`            | **Mẫu**: một lần chèn vừa sửa JSX vừa ghi file khác, một mục lịch sử  |
| `packages/server/src/adapters/http/routes/source.ts` (nhãn lịch sử `insertImage`)                  | Chỗ ghi lịch sử của structure edit                                    |
| `packages/server/src/core/style/style-apply.ts` (`cssFileFor`, `importedCss`, `addCssImport`)      | Chọn/tạo file CSS cho JSX — **dùng lại**, không chép                  |
| `packages/server/src/core/style/bootstrap-utilities.ts`                                            | Không cần cho khối (class Bootstrap viết tay), chỉ để tham khảo thang |
| `packages/shared/src/tailwind/*` (`ClassContext`, `writer.ts`, `properties.ts` `formatClassValue`) | Bộ ghi class Tailwind                                                 |
| `packages/server/src/core/project/frameworks/vite-react/styling.ts`                                | Nhận diện Tailwind, `editable`, `tailwindCss`                         |
| `packages/server/src/core/style/tokens/*` (`token-service.ts`, `tokens-tailwind4.ts`)              | Adapter token; thêm `tailwind3`                                       |
| `packages/server/src/core/source-editor/ast-helpers.ts` (`parseJsxAst`)                            | Parse `tailwind.config.*` bằng Babel                                  |

## 3. Hợp đồng

### 3.1. Khối trung tính (`packages/shared/src/library/`)

`LibraryBlock` thêm trường **bắt buộc** `neutral`:

```ts
export type NeutralBlock = {
  /** JSX như `jsx`, nhưng mỗi phần tử có kiểu dáng ghi `className="@<key>"` thay cho class Tailwind. */
  readonly jsx: { readonly vi: string; readonly en: string };
  /** Thuộc tính CSS (longhand hoặc shorthand thường dùng) của từng key, giá trị CSS nguyên văn. */
  readonly styles: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Class Bootstrap 5 viết tay cho từng key (component + utility); key không có thì dùng CSS. */
  readonly bootstrap: Readonly<Record<string, string>>;
};
```

- Viết `neutral` cho **cả 16 khối**, cùng nội dung chữ (vi/en) và cùng cấu trúc thẻ như `jsx` hiện có; giá trị `styles` tương đương class Tailwind của khối (ví dụ `p-4` → `padding: 16px`, `bg-gray-100` → `background-color: #f3f4f6`, `rounded` → `border-radius: 4px`, `text-sm` → `font-size: 14px; line-height: 20px`).
- Class Bootstrap theo cách viết chuẩn của Bootstrap 5.3: `container`, `row`, `col`, `d-flex`, `gap-3`, `p-3`, `bg-light`, `rounded`, `btn btn-primary`, `form-control`, `form-label`, `table`, `card`/`card-body`/`card-title`/`card-text`, `navbar navbar-expand`, `nav-link`, `display-5`, `lead`, `text-secondary`, `img-fluid`.
- Mọi key dùng trong `neutral.jsx` phải có trong `styles`; key có trong `bootstrap` phải có trong `neutral.jsx` (test kiểm cho cả 16 khối).
- Tách dữ liệu `neutral` ra `blocks-neutral.ts` nếu file khối vượt 400 dòng.

`packages/shared/src/library/render-block.ts` (hàm thuần):

```ts
export type RenderedBlock = {
  readonly jsx: string;
  /** Rule CSS cần thêm (chỉ hệ CSS thường, CSS Modules, Sass, Less), mỗi rule `.kc-…{…}`. */
  readonly rules: readonly {
    readonly selector: string;
    readonly declarations: Readonly<Record<string, string>>;
  }[];
};
export function renderBlock(
  block: LibraryBlock,
  system: StyleSystemId | undefined,
  lang: 'vi' | 'en',
): RenderedBlock;
```

| `system`                            | `jsx`                                                                                                                                      | `rules`                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `tailwind4`, `undefined`            | `block.jsx[lang]` **nguyên văn** (R-LB-11 cũ)                                                                                              | rỗng                                                                    |
| `tailwind3`                         | `block.jsx[lang]` qua bảng đổi tên v4 → v3 (mục 3.3)                                                                                       | rỗng                                                                    |
| `bootstrap5`                        | `neutral.jsx` với `className="@k"` → `className="<bootstrap[k]>"`; key không có trong `bootstrap` → class CSS như dòng dưới                | rule cho các key không có class Bootstrap                               |
| `css`, `cssModules`, `sass`, `less` | `className="@k"` → `className="kc-<id>-<k>"` (id khối bỏ tiền tố nhóm, ví dụ `layout.row` + `cell` → `kc-row-cell`; key `root` → `kc-row`) | một rule mỗi key: `.kc-row-cell { … }`, thuộc tính theo thứ tự khai báo |

### 3.2. Chèn khối kèm CSS (server)

- `StructureEdit` kiểu `insert` thêm `css?: { readonly rules: RenderedBlock['rules'] }` (shared schema; selector khớp `/^\.kc-[a-z0-9-]+$/`, giá trị qua `CssValueSchema` có sẵn).
- Khi có `css`: chọn file CSS cho file JSX đích **bằng đúng logic `cssFileFor`/`importedCss`/`addCssImport` của `style-apply.ts`** (export ra và dùng lại; không chép), trừ khi hệ chính là `cssModules` thì dùng file đầu tiên của `styling.globalCss` (không phải `.module.`).
- Thêm vào cuối file đó các rule **chưa có** (so selector bằng AST `parseStylesheet`, không bằng chuỗi); rule đã có thì giữ nguyên, không ghi đè.
- JSX + CSS (+ dòng import nếu phải tạo file CSS) là **một** kết quả, route gộp thành **một** mục lịch sử (như `insertImage`); nhãn lịch sử giữ nhãn chèn hiện có.
- Studio (`insert-block.ts`): lấy hệ chính từ `project.support.styling` (`primarySystem` — chuyển hàm này sang `shared` nếu cần dùng ở Studio, không chép), gọi `renderBlock`, gửi `jsx` + `css`. Kéo thả (`features/dnd/drop-actions.ts`) dùng cùng đường.

### 3.3. Tailwind 3

- `styling.ts`: `editable` đúng cho Tailwind **3 hoặc 4** khi có file CSS chính (`tailwindCss`, với v3 là file có `@tailwind base|components|utilities`); kiểm lại nhận diện `tailwindCss` cho v3 và sửa nếu thiếu.
- `ClassContext` thêm `major: 3 | 4` (mặc định 4 ở mọi chỗ tạo context hiện có). Bộ **ghi** class (`writer.ts`/`formatClassValue`) với `major: 3` đổi tên theo bảng; bộ **đọc** nhận cả tên v3 lẫn v4.

  | Ý nghĩa (v4)    | Tên v4           | Tên v3                                                                                |
  | --------------- | ---------------- | ------------------------------------------------------------------------------------- |
  | bóng nhỏ nhất   | `shadow-xs`      | `shadow-sm`                                                                           |
  | bóng nhỏ        | `shadow-sm`      | `shadow`                                                                              |
  | bo góc nhỏ nhất | `rounded-xs`     | `rounded-sm`                                                                          |
  | bo góc nhỏ      | `rounded-sm`     | `rounded`                                                                             |
  | blur nhỏ nhất   | `blur-xs`        | `blur-sm`                                                                             |
  | blur nhỏ        | `blur-sm`        | `blur`                                                                                |
  | ẩn outline      | `outline-hidden` | `outline-none`                                                                        |
  | vòng 3px        | `ring-3`         | `ring`                                                                                |
  | co giãn         | `grow`, `shrink` | `flex-grow`, `flex-shrink` (v3.4 nhận cả hai; ghi tên v3 cũ để chạy được mọi bản 3.x) |

  Biến thể (`md:`, `hover:`) và giá trị tùy ý giữ nguyên. Bảng đặt ở `packages/shared/src/tailwind/v3-names.ts`, dùng chung cho Inspector và `renderBlock`.

- Studio: mọi chỗ tạo `ClassContext` lấy `major` từ `project.support.styling` (phiên bản Tailwind đã có trong `systems`).
- **Token Tailwind 3** (`packages/server/src/core/style/tokens/tokens-tailwind3.ts`, đăng ký `tailwind3` trong `token-service.ts`):
  - Tìm `tailwind.config.{ts,js,mjs,cjs}` ở gốc dự án; parse bằng Babel (`parseJsxAst` hoặc parser cùng gói); nhận `export default {…}`, `export default defineConfig({…})`, `module.exports = {…}`, `{…} satisfies Config`.
  - Đọc `theme.extend.{colors,fontSize,borderRadius,fontFamily,boxShadow}` và `theme.{…}` (cấp `theme` chỉ đọc); màu lồng `brand: { 500: '#…' }` → token `brand-500`; `DEFAULT` → `brand`. Chỉ nhận giá trị là chuỗi (hoặc mảng chuỗi cho font); biểu thức khác bỏ qua.
  - Sửa: `set`/`remove` token của `theme.extend` bằng thay đúng đoạn văn bản của node (offset từ AST); `add` thêm thuộc tính vào `theme.extend.<nhóm>` (tạo `extend`/nhóm nếu chưa có, theo thụt lề của file). Token ở cấp `theme` (không trong `extend`) → `E016 { reason: 'tokenNotEditable' }`.
  - Không phải object viết sẵn (hàm, biến import) → đọc được gì thì đọc, sửa trả `E021 { missing: 'styleAdapter' }`.
  - `countUses` như Tailwind 4 (`countTokenUses`).

### 3.4. Fixture

- `fixtures/projects/react-tailwind3/` (chép `vite8-react19-ts` hoặc `react-css`, `id` 10 ký tự ví dụ `e2etw3x001`, `tailwindcss: "3.4.17"`, `postcss`, `autoprefixer` trong `devDependencies` của fixture): `tailwind.config.js` có `theme.extend.colors.brand = { DEFAULT: '#e11d48', 500: '#f43f5e' }` và `borderRadius.card = '12px'`; `src/index.css` có 3 dòng `@tailwind`; `Home.tsx` dùng `shadow`, `rounded`, `bg-brand`.

## 4. Tình huống test (bắt buộc, ≤ 20, gắn mã trong tên test)

| #   | File test                                                 | Tình huống → kết quả                                                                                                                                  | Mã               |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `shared/src/library/render-block.test.ts`                 | Cả 16 khối: mọi `@key` trong `neutral.jsx` có trong `styles`; key của `bootstrap` có trong `neutral.jsx`; không còn `@` trong JSX sau render ở mọi hệ | R-ST-12          |
| 2   | như trên                                                  | `tailwind4` và `undefined` → `jsx` đúng từng byte bằng `block.jsx[lang]`, `rules` rỗng (cả 16 khối)                                                   | R-LB-11          |
| 3   | như trên                                                  | `layout.row` + `css` → JSX có `kc-row`, `kc-row-cell`; `rules` có `.kc-row-cell` với `padding: 16px`; vi/en khác chữ, giống class                     | R-ST-12          |
| 4   | như trên                                                  | `composite.card` + `bootstrap5` → JSX có `card`, `card-body`, `btn btn-primary`; key không có class Bootstrap thành rule `.kc-card-…`                 | R-ST-12          |
| 5   | như trên                                                  | `tailwind3` → `shadow-sm` của khối thành `shadow`, `rounded-sm` thành `rounded`; class không có trong bảng giữ nguyên                                 | R-ST-12          |
| 6   | `shared/src/tailwind/v3-names.test.ts`                    | Đổi tên hai chiều theo bảng, giữ biến thể (`md:hover:shadow-sm` → `md:hover:shadow`) và giá trị tùy ý                                                 | R-ST-02          |
| 7   | test của `writer`/`formatClassValue` (thêm)               | `major: 3`: đặt bóng nhỏ → `shadow`; `major: 4` → `shadow-sm` (không đổi hành vi cũ)                                                                  | R-ST-02          |
| 8   | test của bộ đọc (thêm)                                    | `major: 3` đọc `shadow` là bóng nhỏ, `outline-none` là ẩn outline                                                                                     | R-ST-02          |
| 9   | `structure` insert (thêm, thư mục tạm, file thật)         | Chèn khối CSS: JSX đổi, rule thêm cuối CSS file trang đang import; `files` có 2 file; một mục lịch sử; Undo trả đúng từng byte                        | R-ST-12, R-ST-15 |
| 10  | như trên                                                  | Chèn lần hai cùng khối → JSX thêm, CSS **không** đổi (rule đã có)                                                                                     | R-ST-12          |
| 11  | như trên                                                  | File trang chưa import CSS nào → tạo `<File>.css` + dòng import; 2 file ghi + file mới trong cùng mục lịch sử                                         | R-ST-12          |
| 12  | như trên                                                  | Hệ chính `cssModules` → rule vào file `globalCss` đầu (không phải `.module.css`)                                                                      | R-ST-12          |
| 13  | như trên                                                  | `css.rules` có selector không khớp `/^\.kc-/` hoặc giá trị có `;` → E016, không file nào đổi                                                          | R-ST-12          |
| 14  | `tokens/tokens-tailwind3.test.ts`                         | Đọc `module.exports`, `export default defineConfig`, `satisfies Config`: màu lồng `brand-500`, `DEFAULT` → `brand`, `card` bo góc                     | R-ST-11          |
| 15  | như trên                                                  | `set brand-500` đổi đúng chuỗi trong file (giữ dấu nháy và phần còn lại từng byte); `remove` xóa đúng thuộc tính và dấu phẩy                          | R-ST-11          |
| 16  | như trên                                                  | `add color accent` khi chưa có `extend` → tạo `extend: { colors: { accent: '…' } }` đúng thụt lề; token ở cấp `theme` → E016 `tokenNotEditable`       | R-ST-11          |
| 17  | `frameworks/vite-react` styling test (thêm)               | Dự án Tailwind 3.4 có `@tailwind` → `editable: true`, `tailwindCss` đúng file; Tailwind 3 không có file CSS → `editable: false`                       | R-ST-02          |
| 18  | `studio/src/features/library/insert-block.test.ts` (thêm) | Dự án `bootstrap5` → gửi JSX Bootstrap, không có `css`; dự án `sass` → gửi `css.rules`                                                                | R-ST-12          |

## 5. Bẫy đã biết

- Test cũ của Thư viện và Inspector Tailwind 4 phải xanh nguyên: `renderBlock` với `tailwind4` trả **đúng** `block.jsx[lang]`.
- Đổi tên v3 phải theo **đúng thứ tự** để không đổi hai lần (`shadow-sm` → `shadow` chứ không thành `shadow-xs` rồi về `shadow-sm`): dùng bảng tra một bước, không thay chuỗi nối tiếp.
- Chỉ đổi tên đúng các class có trong bảng; class khác giữ nguyên, không suy diễn thêm.
- Rule CSS mới là rule **phẳng**, thêm cuối file, kể cả file `.scss`/`.less` (cú pháp CSS hợp lệ trong cả hai).
- `tailwind.config` có comment và dấu phẩy cuối: sửa bằng thay đúng đoạn văn bản theo offset của node, không in lại cả object.
- Rule đã có: so selector đã chuẩn hóa khoảng trắng, chỉ ở cấp cao nhất của file.
- `pnpm --filter @kumicraft/bridge build` sau khi đổi `shared`, nếu không test `bridge-client-generated` đỏ.

## 6. Không được làm

- Không sửa `e2e/`, `docs/spec.md`, chat, MCP, `source-map.ts`, `mapped-source.ts`.
- Không thêm dependency cho package của KumiCraft (fixture được có `tailwindcss@3`, `postcss`, `autoprefixer`).
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null` (QC-40).
- Không nới test cũ cho xanh; không lọc dữ liệu theo đúng giá trị của test.
- File ≤ 400 dòng.

## 7. Kiểm tay (trong ứng dụng thật, không thay bằng gọi hàm)

1. Chép `fixtures/projects/react-bootstrap` ra thư mục tạm, `pnpm install`, `npm run dev`, mở dự án; kéo khối "Thẻ" và "Nút" vào Canvas → hiện đúng kiểu Bootstrap.
2. Chép `fixtures/projects/react-css` → kéo khối "Hàng" → khối có màu nền, khoảng cách; file CSS của trang có rule `.kc-row…`; Undo trả cả hai file.
3. Chép `fixtures/projects/react-tailwind3` → chọn thẻ có `shadow`, đổi bóng trong Inspector → class v3 đúng; Brand có `brand`, `brand-500`, `card`; đổi `brand-500` → `tailwind.config.js` đổi đúng chỗ.

## 8. Báo cáo

Theo mẫu của README:

- danh sách file tạo/sửa;
- bảng 18 tình huống: **tên test đúng như trong code**, đạt/không;
- kết quả `pnpm verify` (số test, lỗi/cảnh báo lint, typecheck);
- các bước kiểm tay trong ứng dụng thật; bước nào không làm được thì ghi lý do.

Không tự commit; đề xuất commit message `feat(studio): library blocks for every style system and tailwind 3` (đã qua commitlint).
