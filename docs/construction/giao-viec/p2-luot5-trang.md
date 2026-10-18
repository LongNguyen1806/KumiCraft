# Phase 2 — Lượt 5: Thêm, đổi tên, xóa trang (WP-2.05)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Phần **đọc** trang (`GET /project/pages`, ô Trang trên thanh Canvas) đã có từ Phase 1 (spec-log #17). Lượt này làm phần **ghi**.

## 1. Mục tiêu (người dùng thấy gì)

1. Cạnh ô **Trang** trên thanh Canvas có nút **Quản lý trang** (`data-testid="pages-manage"`), mở hộp thoại Trang:
   - danh sách trang, mỗi trang có **Đổi tên** và **Xóa**;
   - form **Thêm trang**:
     - **Tên trang** (ví dụ "Giới thiệu");
     - **Đường dẫn URL**, tự gợi ý `/gioi-thieu`;
     - **Thư mục**: chọn thư mục có sẵn hoặc gõ thư mục mới, mặc định `src/pages`;
     - **Tên file**, tự gợi ý `GioiThieu.tsx`.
2. Thêm xong:
   - file trang mới được tạo, `src/routes.tsx` có import và route mới;
   - Canvas chuyển sang trang mới;
   - ô Trang có trang đó.
3. Đổi tên URL, hoặc đổi tên component (đổi cả tên file); xóa trang có hỏi xác nhận. Mỗi thao tác là **một** bước Undo. Undo phải tạo lại file đã xóa và xóa file đã tạo, đúng từng byte.
4. Dự án không theo quy ước `routes.tsx` (như WorkTracker):
   - vẫn đọc và chuyển trang như hiện tại;
   - các nút thêm, đổi tên, xóa bị khóa kèm dòng giải thích (L-07).
5. Hộp thoại **Project** có mục **Thư mục mặc định** (trang, bố cục, component), ghi vào `workspace.json` (R-CP-16).

## 2. Đọc trước (CW-52)

| File                                                                                                              | Lý do                                                          |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `docs/spec.md` mục 18 (M-PG: R-PG-10 đến R-PG-14), R-HI-11, R-CP-10, R-CP-16, R-PJ-11, S-20 đến S-23              | Quy tắc                                                        |
| `packages/server/src/core/project/pages.ts` + test                                                                | Đọc route (cả `children`, `index`), `convention`, `routesFile` |
| `packages/server/src/core/history/history-service.ts` + test                                                      | Mục lịch sử, Undo/Redo, kiểm hash, rollback                    |
| `packages/server/src/core/source-editor/structure/` (`text-edits.ts`, `imports.ts`, `structure-runner.ts`)        | Dùng lại `applyTextEdits`, cách chèn import, cách khóa file    |
| `packages/server/src/core/project/project-service.ts`, `routes/project.ts`                                        | Thêm endpoint, `PATCH /project`                                |
| `packages/server/src/core/project/create.ts` (`toPackageName`)                                                    | Bỏ dấu tiếng Việt cho URL (R-PJ-11)                            |
| `packages/shared/src/workspace-file.ts`, `project.ts`                                                             | Thêm `designDirs`                                              |
| `packages/studio/src/features/editor/page-select.tsx`, `features/project/dev-port-form.tsx`, `project-dialog.tsx` | Nơi gắn giao diện; mẫu form của hộp thoại Project              |

## 3. Hợp đồng

### 3.1. Shared

```ts
// workspace-file.ts — R-CP-10, R-CP-16
export const DesignDirsSchema = z.strictObject({
  pages: RelPathSchema,
  layouts: RelPathSchema,
  components: RelPathSchema,
});
export const DEFAULT_DESIGN_DIRS = {
  pages: 'src/pages',
  layouts: 'src/layouts',
  components: 'src/components',
} as const;
// WorkspaceFileSchema: designDirs: DesignDirsSchema.optional()
// ProjectInfoSchema: designDirs: DesignDirsSchema (luôn có; không có trong file thì là mặc định)

// project.ts — R-PG-11 đến R-PG-14
export const AddPageSchema = z.strictObject({
  name: z.string().trim().min(1).max(64),
  path: z.string().max(200).optional(), // không có: theo R-PJ-11 từ name
  dir: RelPathSchema.optional(), // không có: designDirs.pages
  fileName: z.string().max(100).optional(), // không có: <Tên>.tsx hoặc .jsx
});
export const RenamePageSchema = z.strictObject({
  path: z.string().min(1),
  newPath: z.string().max(200).optional(),
  newName: z.string().trim().min(1).max(64).optional(),
});
export const DeletePageSchema = z.strictObject({ path: z.string().min(1) });
// PageInfo.file: nay được điền (file trang, RelPath) khi đọc được câu import của component.
// GET /project/dirs → { dirs: RelPath[] }: thư mục trong sourceDir (bỏ node_modules, thư mục bắt đầu bằng '.'), tối đa 500, sắp xếp.
```

Thứ tự kiểm `path`:

1. Thêm `/` đầu nếu thiếu.
2. Chỉ cho phép `[a-z0-9-/:]`, không có `//` (sai: E016 `invalidPath`).
3. Trùng một trang đang có: E016 `pathExists`.

### 3.2. Lịch sử: file được tạo hoặc bị xóa (R-HI-11)

Trong `history-service.ts`:

- `HistoryFileChange` có `before?`, `beforeHash?`, `after?`, `afterHash?`.
  - Thiếu `before`: file được tạo bởi thao tác này.
  - Thiếu `after`: file bị xóa.
- **Undo** (đưa về `before`):
  1. Kiểm trạng thái hiện tại khớp `after`:
     - có `after`: file phải tồn tại và đúng `afterHash`;
     - không có `after`: file phải **không** tồn tại.
  2. Ghi `before`: có thì `writeTextAtomic`, không có thì `fs.remove`.
- **Redo** đối xứng.
- Rollback khi lỗi giữa chừng: áp dụng ngược lại cho các file đã xử lý (ghi lại hoặc xóa).
- Các mục lịch sử cũ (chỉ sửa file) chạy y như trước. Test cũ của history phải xanh nguyên văn.

### 3.3. Server: `packages/server/src/core/project/page-edits.ts` (mới, có thể tách `page-names.ts`)

```ts
export function pageNames(name: string, language: 'ts' | 'js'): { component: string; path: string; fileName: string };
// 'Giới thiệu' → { component: 'GioiThieu', path: '/gioi-thieu', fileName: 'GioiThieu.tsx' }
// component: bỏ dấu như R-PJ-11, tách theo ký tự ngoài [A-Za-z0-9], viết hoa chữ đầu mỗi phần; bắt đầu bằng số thì thêm 'Page'; rỗng thì 'Page'.
export async function addPage(…): Promise<Result<StructureResult>>;
export async function renamePage(…): Promise<Result<StructureResult>>;
export async function deletePage(…): Promise<Result<StructureResult>>;
```

**Điều kiện chung:**

- Đọc `readPages`.
- `convention: false` thì E016 `notConvention`, không ghi gì (L-07).
- Khóa file theo thứ tự đường dẫn như `structure-runner.ts`.
- Kiểm xong mọi thứ rồi mới ghi; ghi lỗi giữa chừng thì hoàn lại.
- Sau khi sửa, `routes.tsx` phải phân tích lại được (E024).
- Mỗi thao tác đẩy **một** mục lịch sử: `history:pageAdd`, `history:pageRename`, `history:pageDelete`, params `{ name }`.

**Thêm (R-PG-11, R-PG-12, R-PG-13):**

1. **Thư mục** = `dir` hoặc `designDirs.pages`.
   - Phải nằm trong `sourceDir`, không chứa `node_modules`, không có đoạn `..`, và qua kiểm đường dẫn của `FileSystemPort` (S-20 đến S-23). Sai: E012.
   - Thư mục chưa có thì `writeTextAtomic` tự tạo.
2. **File:**
   - `<thư mục>/<fileName>`; `fileName` phải khớp `^[A-Za-z0-9_-]+\.(tsx|jsx)$` (E016 `invalidFileName`).
   - Đã tồn tại: E016 `fileExists`.
   - Tên component trùng một tên đã import trong `routes`: E016 `nameExists`.
3. **Nội dung file mới** (thụt 2 dấu cách, `\n`, dòng cuối có `\n`):

   ```tsx
   export function GioiThieu() {
     return (
       <main className="mx-auto max-w-5xl p-8">
         <h1 className="text-3xl font-bold">Giới thiệu</h1>
       </main>
     );
   }
   ```

   Tên trang chèn vào `h1` phải được escape cho JSX: `{`, `}`, `<`, `>`, `&`.

4. **`routes.tsx`:**
   - Import mới đặt sau import cuối (dùng hàm chèn import của `imports.ts`, hoặc cùng quy tắc). Đường dẫn tương đối từ thư mục của `routes.tsx`, có tiền tố `./`, **giữ đuôi `.tsx`** nếu các import trang hiện có dùng đuôi, bỏ nếu chúng không dùng.
   - **Mục route:**
     - Mảng gốc chỉ có **một** mục `path: '/'` có `children`: thêm vào `children` với đường dẫn tương đối (bỏ `/` đầu), đặt **trước** mục `path: '*'` nếu có, không thì cuối mảng.
     - Ngược lại: thêm vào cuối mảng gốc với đường dẫn tuyệt đối.
   - Mục mới viết `{ path: 'gioi-thieu', element: <GioiThieu /> },`, thụt lề và kiểu xuống dòng như mục anh em, giữ dấu phẩy hợp lệ.
5. **Kết quả:** `StructureResult` với `files` = [`routes`, file mới] và `locs` rỗng. Thêm trường `pagePath` vào kết quả của thêm trang để Studio điều hướng: `StructureResult & { pagePath?: string }`. Cách gọn nhất là thêm `pagePath` tùy chọn vào `StructureResultSchema`.

**Đổi tên (R-PG-14):**

- `newPath`: thay giá trị chuỗi `path` của mục route (dạng tương đối hoặc tuyệt đối như đang có). Mục `index: true` không đổi `path`: E016 `indexPage`.
- `newName`:
  - Tính tên mới bằng `pageNames`.
  - File mới = cùng thư mục, `<Tên mới>.<đuôi cũ>`. Nội dung = file cũ, chỉ đổi **tên khai báo** của component được export (`export function X`, `export const X`, `export default function X`). Không tìm được khai báo thì E023 `componentNotFound`.
  - Xóa file cũ.
  - Trong `routes`: đổi câu import (tên và đường dẫn) và thẻ `<X />` thành `<Y />`.
  - **Không** sửa file khác (ghi rõ trong báo cáo nếu một file khác import trang cũ).
- Cả hai cùng lúc: một mục lịch sử.

**Xóa (R-PG-14):**

- Còn đúng một trang (không tính `*` và mục bố cục có `children`): E016 `lastPage`.
- Xóa:
  - mục route (cả dấu phẩy và dòng của nó, không để dòng trống thừa);
  - câu import của component nếu `routes` không còn dùng tên đó;
  - file trang.
- `PageInfo.file` không có (không đọc được import): E023 `componentNotFound`.

### 3.4. Endpoint

- `POST /project/pages`, `PATCH /project/pages`, `DELETE /project/pages` (body JSON):
  - trả `{ data: StructureResult }` và ghi lịch sử;
  - lỗi theo mục 3.3.
- `GET /project/dirs`.
- `PATCH /project` nhận thêm `designDirs`:
  - mỗi đường dẫn trong `sourceDir`;
  - ba đường dẫn khác nhau, không lồng nhau;
  - sai thì E016 `designDirs`.

Nhớ thêm route vào `project.test.ts` stub (`ProjectService` có thêm phương thức).

### 3.5. Studio

- `features/pages/` (mới):
  - `pages-dialog.tsx` (`data-testid="pages-dialog"`): danh sách trang, mỗi dòng có `page-rename-<path>` và `page-delete-<path>`. Xóa dùng `window.confirm`.
  - `add-page-form.tsx`:
    - ô `page-name`, `page-path`, `page-dir`, `page-file`, nút `page-add`;
    - `page-dir` là `input` có `list` (datalist) từ `GET /project/dirs`, nên vừa chọn vừa gõ mới được;
    - gõ tên thì `path` và `fileName` tự gợi ý bằng **cùng thuật toán** `pageNames` (đặt bản dùng chung trong `shared/src/page-names.ts`, server và Studio cùng import) cho tới khi người dùng tự sửa ô đó.
  - `rename-page-form.tsx`: sửa URL, tên.
  - Lỗi hiện qua `errorText` (`role="alert"`).
- `page-select.tsx`:
  - thêm nút `pages-manage` mở hộp thoại;
  - `convention: false`: hộp thoại vẫn mở, liệt kê trang, khóa thêm/đổi/xóa, hiện `pages-not-convention`.
- Thêm trang xong: `studioBridgeChannel.navigate(pagePath)`. Danh sách trang tự tải lại (đã nghe `project.filesChanged`).
- `features/project/design-dirs-form.tsx` trong hộp thoại Project, thẻ Backend, cạnh `DevPortForm`: 3 ô và nút lưu (`design-dirs-save`).
- i18n `vi`/`en`:
  - nhãn hộp thoại, form, xác nhận xóa, `pages-not-convention`;
  - `history.pageAdd`, `history.pageRename`, `history.pageDelete`;
  - `errors.E016.reasons`: `invalidPath`, `pathExists`, `fileExists`, `invalidFileName`, `nameExists`, `lastPage`, `indexPage`, `notConvention`, `designDirs`;
  - `errors.E023.reasons`: `componentNotFound`.

## 4. Tình huống test

Test server dùng dự án tạo từ template (như `create.test.ts`) chép vào thư mục tạm. Test cần ghi nhiều lần thì dùng `directWriteFs`.

| #   | Đầu vào                                                                                                                                                                   | Kết quả                                                                                                                                                                                                      | Mã               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | `pageNames('Giới thiệu')`, `('Đặt hàng 2')`, `('123')`, `('!!!')`                                                                                                         | `GioiThieu` `/gioi-thieu`; `DatHang2` `/dat-hang-2`; `Page123`; `Page` `/page`                                                                                                                               | R-PG-11, R-PJ-11 |
| 2   | Thêm "Giới thiệu" vào template                                                                                                                                            | `src/pages/GioiThieu.tsx` đúng nội dung mục 3.3; `routes.tsx` có import sau import cuối và `{ path: 'gioi-thieu', element: <GioiThieu /> },` **trước** mục `*`; `readPages` có `/gioi-thieu` với `file` đúng | R-PG-11, R-PG-12 |
| 3   | Thêm với `dir: 'src/pages/product'` (chưa có) và `fileName: 'ProductPage.tsx'`                                                                                            | Thư mục được tạo; import `./pages/product/ProductPage.tsx`                                                                                                                                                   | R-PG-11          |
| 4   | Thêm với `dir` `../outside`, `src/node_modules/x`, ngoài `sourceDir`                                                                                                      | E012, không file nào đổi                                                                                                                                                                                     | R-PG-11          |
| 5   | Thêm path `/about`; file đã có; tên `About`                                                                                                                               | E016 `pathExists`; `fileExists`; `nameExists`                                                                                                                                                                | R-PG-13          |
| 6   | Thêm rồi Undo rồi Redo                                                                                                                                                    | Undo: file trang **không còn**, `routes.tsx` đúng từng byte như trước; Redo: file và `routes` như sau khi thêm                                                                                               | R-HI-11, R-PG-13 |
| 7   | Xóa About rồi Undo                                                                                                                                                        | Xóa: mục route, import, file `About.tsx` biến mất, không dòng trống thừa; Undo: `About.tsx` và `routes.tsx` đúng từng byte                                                                                   | R-PG-14, R-HI-11 |
| 8   | Undo bước tạo file khi file đó đã bị sửa từ ngoài                                                                                                                         | Từ chối như R-HI-04, không xóa file                                                                                                                                                                          | R-HI-11          |
| 9   | Xóa khi chỉ còn một trang                                                                                                                                                 | E016 `lastPage`                                                                                                                                                                                              | R-PG-14          |
| 10  | Đổi URL About thành `/gioi-thieu-cong-ty`; đổi tên About thành "Company"                                                                                                  | Route đổi; file `Company.tsx` có `export function Company`, `About.tsx` mất, import và thẻ trong `routes` đổi; một mục lịch sử; Undo đúng từng byte cả 3 file                                                | R-PG-14          |
| 11  | Đổi path của mục `index: true`                                                                                                                                            | E016 `indexPage`                                                                                                                                                                                             | R-PG-14          |
| 12  | Dự án dùng `<Routes><Route …>` (không quy ước): thêm, đổi tên, xóa                                                                                                        | E016 `notConvention`, không ghi                                                                                                                                                                              | R-PG-10          |
| 13  | `routes.tsx` không có `children` (mảng phẳng `[{ path: '/', element: <Home /> }]`), thêm trang                                                                            | Mục mới cuối mảng gốc với `path: '/gioi-thieu'`                                                                                                                                                              | R-PG-12          |
| 14  | Lịch sử: mục cũ chỉ sửa file vẫn Undo/Redo như trước (test cũ xanh)                                                                                                       | Đúng                                                                                                                                                                                                         | R-HI-11          |
| 15  | `PATCH /project { designDirs }` hợp lệ; lồng nhau (`src/pages`, `src/pages/x`); ngoài `sourceDir`                                                                         | Ghi `workspace.json`, `ProjectInfo.designDirs` đổi; E016 `designDirs` hai lần                                                                                                                                | R-CP-16          |
| 16  | `GET /project/dirs` trên template                                                                                                                                         | Có `src/pages`, `src/components/ui`; không có `node_modules`, `.reactcraft`                                                                                                                                  | R-PG-11          |
| 17  | Studio `AddPageForm`: gõ "Giới thiệu" thì `page-path` = `/gioi-thieu`, `page-file` = `GioiThieu.tsx`; sửa tay `page-path` rồi gõ tiếp tên thì `page-path` giữ bản sửa tay | Đúng                                                                                                                                                                                                         | R-PG-11          |
| 18  | Studio `PagesDialog` với `convention: false`                                                                                                                              | Nút thêm/đổi/xóa khóa, có `pages-not-convention`                                                                                                                                                             | R-PG-10          |

## 5. Kiểm tay (chủ dự án)

Trên dự án mới (Oakline):

1. Bấm **Quản lý trang** → thêm "Giới thiệu": Canvas chuyển sang `/gioi-thieu` có tiêu đề "Giới thiệu"; Header không đổi.
2. Thêm "Sản phẩm" vào thư mục gõ mới `src/pages/product`: thư mục được tạo, trang mở được.
3. Đổi tên trang "Giới thiệu" thành "Công ty": file `CongTy.tsx` thay `GioiThieu.tsx`, Canvas vẫn mở được trang.
4. Xóa trang "Sản phẩm" (xác nhận) rồi **Ctrl+Z**: file và route trở lại đúng như cũ (`git diff` không thấy khác với trước khi xóa).
5. Hộp thoại Project → Thư mục mặc định → đổi trang thành `src/views`, lưu; thêm trang mới: gợi ý thư mục là `src/views`.
6. Chạy `pnpm build` trong dự án: không lỗi.

Trên WorkTracker:

7. Mở **Quản lý trang**: thấy danh sách trang, các nút thêm, đổi, xóa bị khóa và có dòng giải thích; chuyển trang vẫn chạy.

## 6. Bẫy đã biết

- **Không nâng thời gian chờ test.** Test chậm thì tìm nguyên nhân (lượt 3).
- **Toạ độ gốc:** mọi `TextEdit` trên `routes.tsx` tính trên code gốc, dùng `applyTextEdits`.
- **Hash của file mới:** mục lịch sử với file được tạo phải có `afterHash` đúng nội dung **đã ghi** (kể cả `\n` cuối), để Undo kiểm được.
- **`fs.remove`** chỉ được gọi với đường dẫn trong dự án (S-20 đến S-23). Không tự `rm` bằng `node:fs`.
- **Watcher:** tạo và xóa file làm `project.filesChanged` bắn ra. Server phải ghi nhận đây là ghi nội bộ (`recordInternalWrite`, như đường sửa hiện có) để lịch sử không tưởng là sửa từ ngoài. Kiểm bằng test #6.
- **Đuôi import:** template dùng `./pages/Home.tsx`. Dự án khác có thể viết `./pages/Home`. Theo kiểu đang có trong file.
- **Không đổi hành vi đọc trang** của Phase 1 (`page-select.test.tsx`, `pages.test.ts` xanh), chỉ bổ sung `file`.
- **Giới hạn:** file ≤ 400 dòng, hàm ≤ 50 dòng. Tách `page-edits.ts` thành `page-add.ts`, `page-rename.ts`, `page-delete.ts` nếu cần.

## 7. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ:

- kết quả kiểm tay bước 1, 3, 4;
- đoạn `routes.tsx` sau khi thêm "Giới thiệu" (dán nguyên văn).

Không chạy `pnpm test:e2e`.

```text
feat(server): add, rename and delete pages through routes.tsx
```
