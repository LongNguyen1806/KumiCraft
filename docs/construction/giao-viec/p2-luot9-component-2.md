# Phase 2 — Lượt 9: Component, phần 2 (WP-2.08b)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Đã có sẵn: tạo file kèm lịch sử một mục (`core/project/page-add.ts`, R-HI-11), kiểm thư mục (`page-common.ts` `validateDirectory`, `GET /project/dirs`), tên PascalCase không dấu (`shared/page-names.ts` `pageNames`), lấy câu import theo tên (`structure/element-text.ts` `collectMatchingImportStatements`), đổi đường dẫn import tương đối (`structure/imports.ts` `resolveRelativeImportSource`), danh sách component, `importStatement`, alias (`core/project/components-list.ts`, lượt 8), file đang thiết kế và `insertAnchor` (`studio/features/design/`, lượt 8).

## 1. Mục tiêu (người dùng thấy gì)

1. **Tạo component từ phần tử đang chọn:** Inspector có nút **Tạo component**. Hộp thoại hỏi:
   - **Tên** (ví dụ "Hộp khuyến mãi" → `HopKhuyenMai`);
   - **Thư mục** (mặc định `src/components`, chọn có sẵn hoặc gõ mới);
   - **Tên file** (tự gợi ý `HopKhuyenMai.tsx`).

   Xong thì:
   - file mới chứa JSX của phần tử, giữ nguyên class, và có các câu import cần thiết;
   - chỗ cũ thành `<HopKhuyenMai />` kèm câu import;
   - panel Component có mục mới;
   - **một** bước Undo xóa file mới và trả file cũ về đúng từng byte.

2. Phần tử dùng biến, props, hàm hoặc dữ liệu của file đang chứa nó (ví dụ `{product.name}`, `products.map(...)`): báo lỗi nêu tên biến đó, không ghi gì.
3. **Chế độ sửa component:** bấm đúp vào một phần tử thuộc component của dự án (ví dụ menu trong Header khi đang thiết kế Home):
   - thanh "Đang thiết kế" chuyển sang `Component · Header · src/components/Header.tsx`, có nút **Quay lại**; component dùng ở nhiều chỗ thì có dòng "Dùng ở N chỗ, sửa sẽ đổi mọi chỗ";
   - Canvas làm mờ mọi phần **ngoài** component; bấm vào vùng mờ không chọn gì;
   - mọi sửa (Inspector, chèn khối, dán) ghi vào `Header.tsx`;
   - **Esc** khi không còn gì để chọn cha, hoặc nút Quay lại, hoặc đổi trang: về chế độ trang;
   - bấm đúp vào chữ **bên trong** component đang sửa thì sửa chữ như bình thường.

## 2. Đọc trước (CW-52)

| File                                                                                                                                             | Lý do                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `docs/spec.md` mục 18A (R-CP-14, R-CP-15), R-HI-11, R-SE-21; `spec-log.md` #24                                                                   | Quy tắc, chỗ lệch đã chốt                                   |
| `packages/server/src/core/project/page-add.ts`, `page-common.ts`                                                                                 | Mẫu tạo file + sửa file trong một mục lịch sử, kiểm thư mục |
| `packages/server/src/core/source-editor/structure/element-text.ts`, `imports.ts`, `text-edits.ts`, `structure-ops.ts` (`normalizeSnippetIndent`) | Lấy JSX, import, sửa văn bản theo toạ độ gốc, thụt lề       |
| `packages/server/src/core/project/components-list.ts`                                                                                            | Dựng nguồn import (alias hoặc tương đối), `components.json` |
| `packages/studio/src/features/design/` (`design-store.ts`, `design-target.ts`, `design-bar.tsx`)                                                 | Thêm chế độ component                                       |
| `packages/studio/src/features/text-edit/use-canvas-text-edit.ts`                                                                                 | Bấm đúp: chọn sửa chữ hay vào chế độ component              |
| `packages/studio/src/features/shortcuts/shortcut-actions.ts` (`selectParent`)                                                                    | Esc thoát chế độ                                            |
| `packages/studio/src/features/inspector/components/structure-actions.tsx`, `features/pages/` (form thêm trang, ô chọn thư mục)                   | Nút và hộp thoại, dùng lại ô chọn thư mục                   |
| `packages/bridge/src/client/overlay.ts`, `overlay-foreign.ts`, `bridge-client-runtime.ts` (`handleClick`, `handlePointerMove`)                   | Làm mờ, chặn chọn ngoài component                           |

## 3. Hợp đồng

### 3.1. Shared

```ts
// project.ts — R-CP-14
export const ExtractComponentSchema = z.strictObject({
  loc: z.string().min(1),
  tag: z.string().min(1), // kiểm phần tử chưa đổi (như ElementGuard)
  name: z.string().trim().min(1).max(64),
  dir: RelPathSchema.optional(), // không có: designDirs.components
  fileName: z.string().max(100).optional(),
});

// bridge.ts — R-CP-15 (spec-log #24): thêm focus vào design-file
export const StudioDesignFilePayloadSchema = z.strictObject({
  file: RelPathSchema.optional(),
  focus: z.boolean().optional(), // true: chế độ sửa component, làm mờ phần ngoài file
});
```

### 3.2. Server — `core/project/component-extract.ts` (mới) + `POST /project/components/extract`

`extractComponent(deps, input): Promise<Result<StructureResult>>`, từng bước:

1. **Tên, đường dẫn:** `pageNames(input.name, language).component` → `Name`. `dir` mặc định `designDirs.components`; kiểm bằng `validateDirectory` (sai: E012). `fileName` mặc định `Name.tsx` (`.jsx` với dự án JS), phải có đuôi `.tsx`/`.jsx` (sai: E016 `fileName`). File đã có: E016 `fileExists`.
2. **Phần tử:** đọc file nguồn của `loc`, `findNodeAt`; không thấy hoặc tag khác: E017 `moved`. Phần tử là gốc của callback `.map` (dùng lại kiểm `loopRoot` của `structure-guard.ts`): E023 `loopRoot`. Tên `Name` đã được khai báo hoặc import trong file nguồn: E016 `nameExists`.
3. **Kiểm phạm vi (R-CP-14):** duyệt cây con của phần tử, lấy mọi `Identifier` **được tham chiếu** trong biểu thức (`JSXExpressionContainer`, `JSXSpreadAttribute`) và tên thẻ viết hoa (`JSXIdentifier` đầu `JSXMemberExpression` hoặc thẻ viết hoa). Bỏ qua:
   - thuộc tính của `MemberExpression` không computed (`a.b` chỉ xét `a`);
   - khóa object không computed;
   - tên tham số và biến khai báo **bên trong** phần tử (ví dụ `onClick={(e) => …}` thì `e` hợp lệ);
   - biến toàn cục trong danh sách cố định `Math, Date, JSON, Number, String, Array, Object, Boolean, Intl, window, document, console, encodeURIComponent, undefined`.

   Tên còn lại phải là **tên được import** trong file nguồn. Không phải: E023 `{ reason: 'usesLocalScope', name }` (tên đầu tiên gặp), **không ghi gì**.

4. **File mới:**
   - các câu import của những tên ở bước 3, lấy bằng `collectMatchingImportStatements`, với nguồn tương đối đổi theo vị trí file mới bằng `resolveRelativeImportSource` (export hàm này; alias `@/` và gói npm giữ nguyên);
   - một dòng trống;
   - `export function Name() {` / `  return (` / JSX của phần tử đã bỏ thụt lề chung và thụt 4 dấu cách / `  );` / `}`.

   Không có import thì bỏ cả dòng trống đầu. Xuống dòng theo file nguồn, kết thúc bằng một xuống dòng. JSX là đúng đoạn `code.slice(start, end)` của phần tử (giữ nguyên class, chữ, thuộc tính).

5. **File nguồn:** thay đoạn phần tử bằng `<Name />`. Thêm `import { Name } from '<nguồn>';` sau import cuối:
   - dự án có alias `@/` thì nguồn là `@/…` không đuôi;
   - ngược lại là đường dẫn tương đối **từ file nguồn** tới file mới, không đuôi, bắt đầu bằng `./` hoặc `../`.

   Tách phần dựng nguồn import của `components-list.ts` thành hàm dùng chung nhận thêm file gốc, không chép code. Dùng `applyTextEdits` trên code gốc; parse lại kết quả (hỏng: E024, không ghi).

6. **Ghi:** khóa cả hai file như `page-add.ts`; ghi file mới rồi file nguồn; lỗi ghi file nguồn thì xóa file mới. `recordInternalWrite` cả hai. **Một** mục lịch sử `{ key: 'history:extract', params: { name } }` gồm file mới (`after` only) và file nguồn (`before`/`after`). Khóa i18n `history:extract` = "Tạo component {{name}}" / "Create component {{name}}".
7. **`components.json`:** file mới **không** nằm trong `designDirs.components` hoặc `designDirs.layouts` → thêm đường dẫn vào `.reactcraft/components.json` (`{ "files": [...] }`, tạo nếu chưa có, không trùng). Không đưa vào lịch sử; danh sách đã bỏ qua file không còn tồn tại (lượt 8).
8. Trả `{ changed: true, files: [sourceRel, newRel], locs: [loc của <Name /> trong file nguồn sau khi ghi] }`.

Endpoint `POST /project/components/extract` trong `routes/project.ts`: parse `ExtractComponentSchema` (sai: E016 có `details`), chưa mở dự án: E021.

### 3.3. Studio — tạo component

- `api/project-client.ts`: `extractComponent(input): Promise<StructureResult>` (parse kết quả bằng schema, **không** ép kiểu `as`, xem lỗi Undo vừa sửa).
- `structure-actions.tsx`: nút `structure-extract` "Tạo component" / "Create component", bật khi chọn đúng một phần tử.
- `features/components-panel/extract-dialog.tsx`: `extract-name`, `extract-dir` (dùng lại ô chọn thư mục của form thêm trang), `extract-file` (gợi ý theo tên như form thêm trang, sửa tay thì giữ), `extract-submit`, `extract-error` (hiện lỗi qua `errorText`; `usesLocalScope` hiện "Phần tử dùng {{name}} của file hiện tại, không tách ra được" / "The element uses {{name}} from the current file and cannot be extracted"). Thành công: đóng, chọn `res.locs[0]`, tải lại panel Component.
- `use-project-components.ts`: thêm tải lại (gộp 500 ms) khi có `history.changed`, vì file do ReactCraft ghi không phát `project.filesChanged`. Đưa danh sách vào store dùng chung để chế độ component đọc được.

### 3.4. Studio — chế độ sửa component

- `design-store.ts`: thêm `componentMode?: { name: string; file: RelPath; kind: 'component' | 'layout'; usages: number }`, `enterComponentMode`, `exitComponentMode`. Đích đang thiết kế = `componentMode` nếu có, ngược lại trang (lượt 8). `currentRoute` đổi → tự `exitComponentMode`. Gửi `design-file { file, focus: componentMode !== undefined }` mỗi khi đích đổi (và khi Bridge `ready`, như lượt 8).
- **Vào chế độ** (trong `use-canvas-text-edit.ts`, trước khi bắt đầu sửa chữ): `ref` có file khác file đang thiết kế **và** danh sách component có mục cùng file đó → `enterComponentMode` với mục đó (nếu file có nhiều component, chọn mục trùng `ElementSource.component?.name`, không có thì mục đầu), giữ vùng chọn là `ref`, **không** sửa chữ. Ngược lại: sửa chữ như cũ.
- **Thoát:** nút `design-bar-back` "Quay lại trang" / "Back to page" trên thanh "Đang thiết kế" (chỉ hiện trong chế độ component); Esc: `selectParent` trả `false` và đang ở chế độ component → `exitComponentMode` (trả `true`).
- **Thanh "Đang thiết kế":** loại `design.kind.component`/`layout`, tên, file; `usages > 1` → `design-bar-usages` "Dùng ở {{count}} chỗ, sửa sẽ đổi mọi chỗ" / "Used in {{count}} places; edits change all of them".

### 3.5. Bridge — làm mờ và chặn chọn

- `focus` và `designFile` có giá trị → overlay vẽ lớp mờ `rgba(15, 23, 42, 0.35)` phủ cả trang, **khoét lỗ** đúng khung của các phần tử "gốc" của file đó: phần tử có file `data-rc-loc` = `designFile` mà tổ tiên `[data-rc-loc]` gần nhất có file khác (hoặc không có). Một `svg` phủ toàn màn hình, một `path` gồm hình chữ nhật ngoài và các hình chữ nhật lỗ, `fill-rule="evenodd"`. Vẽ lại theo `render()` hiện có (cuộn, đổi kích thước, DOM đổi).
- Hàm thuần trong `overlay-focus.ts`: `focusRoots(doc, designFile): Element[]` và `focusPath(viewport, rects): string` (chuỗi `d` của path) để test.
- `handleClick`, `handlePointerMove`: khi `focus`, phần tử đích có file khác `designFile` → đi lên tổ tiên gần nhất cùng file; không có → **không chọn** (bỏ qua click, không hover). Bấm đúp vào phần tử ngoài cũng bỏ qua.
- `overlay.ts` (≤ 400 dòng) và `bridge-client-runtime.ts` (≤ 400 dòng): phần mới để ở file riêng.

## 4. Tình huống test

Test server dùng dự án tạo từ template chép vào thư mục tạm; kiểm **byte trên đĩa**.

| #   | Đầu vào                                                                                                                                   | Kết quả                                                                                                                                                                                                                                   | Mã               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Tách `section` hero của `Home.tsx` (có `<Button>`) với tên "Promo Box"                                                                    | `src/components/PromoBox.tsx` = import `Button` với nguồn đã đổi theo thư mục mới, dòng trống, `export function PromoBox()` trả đúng JSX cũ; `Home.tsx` có `<PromoBox />` ở chỗ cũ và `import { PromoBox } from '@/components/PromoBox';` | R-CP-14          |
| 2   | Như #1 rồi Undo, rồi Redo                                                                                                                 | Undo: `PromoBox.tsx` không còn, `Home.tsx` đúng từng byte như trước; Redo: cả hai như sau khi tách                                                                                                                                        | R-CP-14, R-HI-11 |
| 3   | Tách `h3` có `{name}` (props của `ProductCard`) trong `ProductCard.tsx`                                                                   | E023 `usesLocalScope`, `name: 'name'`; không file nào đổi, không có file mới                                                                                                                                                              | R-CP-14          |
| 4   | Tách phần tử có `onClick={(e) => console.log(e)}` và `{Math.max(1, 2)}`                                                                   | Thành công (biến khai báo bên trong và biến toàn cục hợp lệ)                                                                                                                                                                              | R-CP-14          |
| 5   | Tách phần tử dùng hằng khai báo ở đầu file (`const title = 'x'` ngoài component)                                                          | E023 `usesLocalScope`, `name: 'title'`                                                                                                                                                                                                    | R-CP-14          |
| 6   | Tách gốc của callback `.map`                                                                                                              | E023 `loopRoot`                                                                                                                                                                                                                           | R-CP-14          |
| 7   | `fileName` trùng file có sẵn; `name` trùng tên đã import (`Button`); `dir` = `../outside`                                                 | E016 `fileExists`; E016 `nameExists`; E012                                                                                                                                                                                                | R-CP-14          |
| 8   | Tách vào `dir: 'src/features/promo'` (chưa có)                                                                                            | Thư mục được tạo; `.reactcraft/components.json` có `src/features/promo/PromoBox.tsx`; `GET /project/components` có `PromoBox`                                                                                                             | R-CP-14, R-CP-12 |
| 9   | Dự án không alias, tách từ `src/pages/Home.tsx` vào `src/components`                                                                      | Import trong Home là `'../components/PromoBox'`                                                                                                                                                                                           | R-CP-14          |
| 10  | File nguồn dùng CRLF                                                                                                                      | File mới và file nguồn đều CRLF                                                                                                                                                                                                           | R-CP-14          |
| 11  | Studio `ExtractDialog`: gõ "Hộp khuyến mãi" → `extract-file` = `HopKhuyenMai.tsx`; server trả E023 `usesLocalScope` `{ name: 'product' }` | Gợi ý đúng; `extract-error` có chữ `product`                                                                                                                                                                                              | R-CP-14          |
| 12  | `use-canvas-text-edit`: bấm đúp phần tử ở `Header.tsx` khi đang thiết kế Home, danh sách có `Header`; bấm đúp phần tử ở Home              | Lần 1: `componentMode.file = src/components/Header.tsx`, không gọi bắt đầu sửa chữ; lần 2: sửa chữ như cũ                                                                                                                                 | R-CP-15          |
| 13  | Đang ở chế độ component: Esc khi không chọn gì; đổi `currentRoute`                                                                        | Cả hai thoát chế độ; `design-file` gửi lại với `focus: false`                                                                                                                                                                             | R-CP-15          |
| 14  | `DesignBar` ở chế độ component có `usages: 3`                                                                                             | Loại Component, tên, file, `design-bar-usages`, `design-bar-back`                                                                                                                                                                         | R-CP-15          |
| 15  | Bridge `focusRoots`: DOM có 2 khối của `Header.tsx` (một khối lồng trong khối kia) và 1 khối của `Home.tsx`; `focusPath` với 2 lỗ         | Chỉ khối ngoài của Header; chuỗi `d` có 3 hình chữ nhật                                                                                                                                                                                   | R-CP-15          |
| 16  | Bridge khi `focus`: bấm vào phần tử của `Home.tsx` ngoài component; bấm vào chữ con của khối Header                                       | Lần 1 không gửi `select`; lần 2 gửi `select` (phần tử đó hoặc tổ tiên cùng file)                                                                                                                                                          | R-CP-15          |

## 5. Kiểm tay (chủ dự án)

Trên dự án mới (template):

1. Chọn section hero của Home → **Tạo component** → tên "Promo Box": Canvas vẫn hiện như cũ; `src/components/PromoBox.tsx` có nội dung hero; `Home.tsx` có `<PromoBox />`; panel Component có `PromoBox`.
2. **Ctrl+Z** một lần: `PromoBox.tsx` biến mất, `Home.tsx` như cũ (`git diff` sạch). **Ctrl+Shift+Z**: trở lại như bước 1.
3. Chọn một thẻ sản phẩm bên trong `ProductCard` → Tạo component: báo lỗi nêu tên biến, không file nào đổi.
4. Ở About, chèn `PromoBox` từ panel Component (lượt 8): hiện đúng, có import.
5. Bấm đúp vào menu trong Header: thanh ghi `Component · Header`, phần ngoài Header mờ đi; bấm vào vùng mờ không chọn gì.
6. Trong chế độ đó, chọn thẻ `header` và đổi màu nền trong Inspector: chuyển sang About thì Header cũng đổi màu (chuyển trang tự thoát chế độ).
7. Vào lại chế độ Header, bấm đúp vào chữ "Home" của menu: sửa chữ được; Esc vài lần cho tới khi về chế độ trang; nút **Quay lại trang** cũng về được.
8. `pnpm build` trong dự án: không lỗi.

Trên WorkTracker:

9. Tạo component từ một khối tĩnh của một trang: file mới đúng, trang vẫn chạy, Undo đúng; tạo từ khối dùng dữ liệu: báo lỗi nêu tên biến.

## 6. Bẫy đã biết

- **Toạ độ gốc:** thay phần tử và chèn import tính trên code gốc bằng `applyTextEdits`, không sửa chuỗi hai lần.
- **Nguồn import của file mới:** đổi đường dẫn tương đối theo **thư mục file mới**, không theo file nguồn.
- **Không xóa import thừa** trong file nguồn sau khi tách (spec-log #24); `pnpm build` của template vẫn chạy vì `tsconfig` không bật `noUnusedLocals`.
- **Panel Component không tự tải lại** sau khi ReactCraft ghi file (ghi nội bộ không phát `project.filesChanged`): dùng `history.changed`.
- **Bấm đúp hiện là sửa chữ:** chỉ đổi khi phần tử thuộc file khác **và** file đó là component trong danh sách; phần tử trong file đang thiết kế vẫn sửa chữ.
- **Esc** đang là chọn cha; chỉ thoát chế độ khi không còn cha để chọn hoặc không chọn gì.
- **Không ép kiểu `as`** dữ liệu từ server trong Studio; parse bằng schema.
- **Giới hạn:** file ≤ 400 dòng, hàm ≤ 50 dòng.
- Sửa `shared`/`bridge` thì chạy `pnpm --filter @reactcraft/bridge build` (commit cả file sinh ra).

## 7. Báo cáo và commit

Theo mẫu `README.md`. Lượt này đụng Bridge nên chạy **một lần** `pnpm test:e2e` (Chromium) ở cuối, sau `pnpm verify`; ghi **đúng** số test E2E in ra. Ghi rõ:

- nguyên văn `PromoBox.tsx` và đoạn đổi của `Home.tsx` sau test #1;
- kết quả kiểm tay bước 1, 2, 5 nếu tự thử được.

```text
feat(studio): extract components and edit them in place
```
