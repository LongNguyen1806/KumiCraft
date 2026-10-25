# Phase 4 — Lượt K3c: Bộ chọn thư mục, nhiều thư mục thiết kế, chỗ đặt file CSS và file token

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

## 0. Bối cảnh

Kế hoạch `p4-ke-hoach.md` mục K3, bảng 15 tính năng: lượt này làm các mục **1, 2, 3, 4, 5, 12, 13** (spec-log #65, #73). K3b đã có cây thư mục (`features/files/`, `GET /project/tree`, menu chuột phải `files-context-menu.tsx`). Bộ tìm route, mẫu trang, Cài router là K3d — **không làm ở đây**.

Đã có sẵn (dùng lại, không viết lại):

- Cây: `fetchFileTree(dir)` (`studio/src/api/files-client.ts`), `useFilesStore` (`features/files/files-store.ts`), dòng cây `files-tree-row.tsx`, menu `files-context-menu.tsx`.
- Thư mục thiết kế: `DesignDirsSchema`, `DEFAULT_DESIGN_DIRS` (`shared/src/workspace-file.ts`), `validateDesignDirs`, `listProjectDirs` (`server/src/core/project/page-common.ts`), `PATCH /project` (`patchProject`, `project-workspace-file.ts`), form `features/project/design-dirs-form.tsx`.
- Ô thư mục hiện tại: `PageDirAndFileFields` + `useDirSuggestions` (`features/pages/add-page-form.tsx`, có `datalist`), `extract-dialog.tsx` (có `useDirSuggestions` riêng, trùng lặp), `drafts/promote-draft-dialog.tsx` (**gán cứng** `'src/pages'`/`'src/components'`, không đọc `designDirs` — lỗi, sửa trong lượt này).
- Panel Component: `server/src/core/project/components-list.ts` (chỉ quét một thư mục `components` và một `layouts`).
- File CSS mới cho "chỉ phần tử này": `planCssFile` (`server/src/core/style/style-apply.ts`), luôn đặt `<Tên>.css` cạnh file JSX.
- Token Brand: các adapter `server/src/core/style/tokens/tokens-*.ts` lấy file từ `styling.globalCss` (lấy file đầu); `TokenFiles` trong `token-service.ts`.

Không sửa: Bridge, `docs/spec.md`, MCP, `e2e/`, luồng route/router.

## 1. Mục tiêu (người dùng thấy gì)

1. **Bộ chọn thư mục dùng chung** (`FolderPicker`): mọi ô thư mục (Thêm trang, Tách component, Đưa nháp, Cài đặt thư mục thiết kế) vẫn **gõ được**, thêm nút **"Chọn…"** mở hộp thoại cây **chỉ có thư mục** của dự án (nạp khi mở, như cây K3b, bỏ qua thư mục cây K3b bỏ qua); bấm một thư mục → **Chọn** → điền vào ô. Dùng lại `fetchFileTree`, không viết API mới.
2. **Đưa nháp** mặc định thư mục theo `designDirs` (trang → thư mục trang đầu tiên, component → thư mục component đầu tiên), không còn gán cứng.
3. **Nhiều thư mục mỗi loại**: trang, layout, component mỗi loại có **danh sách** (1–10 thư mục); thư mục đầu tiên là mặc định khi thêm/tách/đưa nháp. Bản nháp vẫn **một** thư mục.
4. **Cài đặt thư mục thiết kế**: mỗi loại là danh sách — thêm (gõ hoặc "Chọn…"), xóa, đưa lên đầu (làm mặc định).
5. **Chuột phải thư mục trên cây** thêm các mục:
   - **"Thêm trang ở đây"** → mở panel Trang với form Thêm trang đã điền thư mục đó;
   - **"Dùng làm thư mục trang / layout / component"** → thêm vào cuối danh sách loại đó (đã có thì mục bị tắt, kèm dấu ✓); **"Bỏ khỏi thư mục …"** khi thư mục đang thuộc một loại (không cho bỏ thư mục cuối cùng của loại);
   - **"Đặt file CSS mới vào đây"** (mục 6).
6. **Chỗ đặt file CSS mới** (tính năng 12): mặc định **như cũ** (cạnh file JSX). Cài đặt dự án có thêm "Thư mục file CSS mới": khi đặt (ví dụ `src/styles`), file CSS tạo mới cho "chỉ phần tử này" là `src/styles/<Tên>.css` và import đúng đường dẫn tương đối từ file JSX (`../styles/Card.css`). Bỏ đặt → về như cũ. File JSX đã import một file CSS thì vẫn dùng file đó như hiện nay.
7. **File token Brand** (tính năng 13): panel Brand hiện tên file token đang dùng, nút **"Đổi file…"** mở bộ chọn ở chế độ **file**, chỉ hiện file đúng đuôi của hệ chính (CSS: `.css`; Sass/Bootstrap Sass: `.scss`/`.sass`; Less: `.less`; Tailwind 4: `.css`). Chuột phải một file đúng đuôi trên cây → **"Dùng làm file token Brand"**. Có nút "Tự động" để về cách cũ. Tailwind 3 (token trong `tailwind.config`) không có lựa chọn này.
8. **Panel Component** thấy component ở **mọi** thư mục component và layout đã đặt; file nằm trong hai thư mục lồng nhau thuộc **thư mục sâu hơn** (ví dụ `src/components/layouts` là thư mục layout nằm trong `src/components` → file ở đó là layout, chỉ hiện một lần).

## 2. Đọc trước (CW-52)

| File                                                                                                                             | Lý do                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `docs/construction/giao-viec/p4-ke-hoach.md` mục K3, `spec-log.md` #65, #70, #73                                                 | Quyết định                                |
| `packages/shared/src/workspace-file.ts`, `project.ts`                                                                            | Định dạng `workspace.json`, `ProjectInfo` |
| `packages/server/src/core/project/page-common.ts`, `project-workspace-file.ts`, `project-info.ts`, `project-service.ts`          | Đọc/kiểm/ghi `designDirs`                 |
| `packages/server/src/core/project/page-add.ts`, `component-extract.ts`, `draft-promote.ts`, `drafts.ts`, `components-list.ts`    | Nơi dùng `designDirs`                     |
| `packages/server/src/core/style/style-apply.ts` (`planCssFile`, `addPlannedImport`), `tokens/token-service.ts`, `tokens-*.ts`    | File CSS mới, file token                  |
| `packages/studio/src/features/files/*`                                                                                           | Cây và menu chuột phải (K3b)              |
| `packages/studio/src/features/pages/add-page-form.tsx`, `components-panel/extract-dialog.tsx`, `drafts/promote-draft-dialog.tsx` | Ô thư mục cần thay                        |
| `packages/studio/src/features/project/design-dirs-form.tsx`, `features/brand/*`                                                  | Cài đặt và Brand                          |

## 3. Hợp đồng

### 3.1. `workspace.json` (shared, spec-log #73)

```ts
const DirListSchema = z.union([RelPathSchema, z.array(RelPathSchema).min(1).max(10)]);

export const DesignDirsSchema = z.strictObject({
  pages: DirListSchema,
  layouts: DirListSchema,
  components: DirListSchema,
  drafts: RelPathSchema.optional(),
});

export const StyleFilesSchema = z.strictObject({
  newCssDir: RelPathSchema.optional(), // không có = cạnh file JSX
  tokenFile: RelPathSchema.optional(), // không có = tự động như cũ
});
// WorkspaceFileSchema thêm: styleFiles: StyleFilesSchema.optional()
```

- **Không tăng `schemaVersion`**: file cũ (chuỗi) vẫn đọc được; khi KumiCraft ghi lại thì ghi **mảng**. Không có bước chuyển đổi riêng.
- Hàm `normalizeDesignDirs(d: DesignDirs | undefined): ResolvedDesignDirs` trong shared:

```ts
export type ResolvedDesignDirs = {
  readonly pages: readonly RelPath[];
  readonly layouts: readonly RelPath[];
  readonly components: readonly RelPath[];
  readonly drafts: RelPath;
};
```

- `ProjectInfo.designDirs` đổi sang `ResolvedDesignDirs` (luôn là mảng); `ProjectInfo` thêm `styleFiles: { newCssDir?: RelPath; tokenFile?: RelPath }`. Mọi chỗ đang dùng `designDirs.pages` như chuỗi đổi sang `[0]` (mặc định) hoặc cả danh sách (kiểm "nằm trong thư mục component").
- `PATCH /project` nhận `designDirs` (dạng mới) và `styleFiles`.

### 3.2. Kiểm hợp lệ (`validateDesignDirs`)

- Mọi thư mục nằm trong `sourceDir`; không trùng nhau (trong cùng loại hay khác loại).
- **Cho phép lồng nhau** giữa trang, layout, component (ví dụ `src/pages/shop/components` là thư mục component nằm trong `src/pages`). Thư mục **nháp** không được lồng với thư mục nào khác (nháp có route riêng của runner).
- `styleFiles.newCssDir` nằm trong `sourceDir`; `styleFiles.tokenFile` là file có thật, đúng đuôi của hệ chính → sai thì `E016` với lý do mới `styleFileInvalid` (thêm câu vi/en vào `errors.json`).
- Sai `designDirs` → `E016` `designDirs` như hiện nay.

### 3.3. File CSS mới (`planCssFile`)

- Thêm tham số `newCssDir: RelPath | undefined`. Có → `file = newCssDir/<Tên>.css`, `importAs` = đường dẫn **tương đối từ thư mục file JSX**, luôn bắt đầu bằng `./` hoặc `../`, dấu `/` (cả trên Windows). Không có → như cũ.
- Hai file JSX cùng tên ở hai thư mục (`pages/Home.tsx`, `pages/shop/Home.tsx`) với `newCssDir` → tên thứ hai thành `Home-2.css` (không ghi đè, không dùng chung).

### 3.4. File token

- `TokenFiles` thêm `tokenFile: RelPath | undefined`. Adapter `css`, `sass`, `less`, `bootstrap`, `tailwind4`: `tokenFile` có và đúng đuôi → **chỉ** đọc/ghi file đó; không có → như cũ. `tailwind3` bỏ qua.
- `ThemeInfo.file` trả đúng file đang dùng (Brand hiện tên này).

### 3.5. Studio

- `features/files/folder-picker.tsx`: `FolderPicker({ open, mode: 'folder' | 'file', extensions?, initial?, onPick, onClose })`, dùng `Dialog` sẵn có, cây ảo hóa hoặc danh sách thường (thư mục mở khi bấm mũi tên), phím mũi tên/Enter/Esc như cây K3b. Một nút `DirInputWithPicker` (ô gõ + "Chọn…") thay `datalist` ở **cả ba** form; gộp hai `useDirSuggestions` trùng lặp thành một.
- "Thêm trang ở đây": store nhỏ trong `features/pages` (ví dụ `useAddPageIntent`) giữ thư mục muốn thêm; menu gọi `activate('pages')` rồi đặt intent; panel Trang thấy intent → mở form với thư mục đó → xóa intent.
- Menu chuột phải chỉ hiện các mục thư mục cho thư mục, mục token cho file đúng đuôi.

## 4. Tình huống test (bắt buộc, ≤ 20, tên test có `WP-4.00`)

| #   | Nơi                                | Tình huống                                                                                                                                       |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `shared` test                      | `workspace.json` cũ (chuỗi) đọc được; `normalizeDesignDirs` trả mảng; không có `designDirs` → mặc định                                           |
| 2   | `shared` test                      | Mảng rỗng, > 10 thư mục, đường dẫn tuyệt đối → không hợp lệ                                                                                      |
| 3   | server `page-common` test          | Lồng trang/component hợp lệ; trùng thư mục → sai; nháp lồng trong trang → sai; ngoài `sourceDir` → sai                                           |
| 4   | server `patchProject` test         | Ghi `designDirs` → file ghi **mảng**; mở lại dự án → `ProjectInfo.designDirs` đúng thứ tự                                                        |
| 5   | server `patchProject` test         | `tokenFile` không có thật hoặc sai đuôi → `E016` `styleFileInvalid`, file không đổi                                                              |
| 6   | server `page-add` test             | Không gửi `dir` → tạo trong thư mục trang **đầu tiên**                                                                                           |
| 7   | server `component-extract` test    | File đích nằm trong thư mục component **thứ hai** → được coi là component (không báo lỗi vị trí)                                                 |
| 8   | server `draft-promote` test        | Không gửi `dir` → thư mục đầu tiên của loại đích                                                                                                 |
| 9   | server `components-list` test      | Hai thư mục component + thư mục layout lồng trong component → mỗi file một lần, file ở thư mục lồng là layout                                    |
| 10  | server `style-apply` test          | `newCssDir = src/styles`, JSX `src/pages/Home.tsx` → ghi `src/styles/Home.css`, import `'../styles/Home.css'`; không có `newCssDir` → như cũ     |
| 11  | server `style-apply` test          | Hai `Home.tsx` khác thư mục với `newCssDir` → file thứ hai `Home-2.css`, file thứ nhất không đổi                                                 |
| 12  | server token test                  | Dự án CSS có 2 file toàn cục, `tokenFile` = file thứ hai → đọc và thêm token vào file thứ hai, file đầu không đổi; Tailwind 3 bỏ qua `tokenFile` |
| 13  | studio `folder-picker` test        | Chế độ thư mục: chỉ hiện thư mục, mở thư mục con khi bấm, Chọn → `onPick('src/pages/shop')`; Esc → `onClose`                                     |
| 14  | studio `folder-picker` test        | Chế độ file với `['.scss']` → chỉ hiện thư mục và file `.scss`                                                                                   |
| 15  | studio form test                   | Thêm trang, Tách component, Đưa nháp: "Chọn…" điền ô thư mục; vẫn gõ tay được                                                                    |
| 16  | studio `promote-draft-dialog` test | Mặc định theo `designDirs` của dự án (không phải `src/pages` cứng); đổi loại đích → đổi thư mục mặc định theo loại                               |
| 17  | studio `design-dirs-form` test     | Thêm thư mục thứ hai cho component, đưa lên đầu, xóa; không xóa được thư mục cuối cùng; lưu gửi đúng mảng                                        |
| 18  | studio `files-panel` test          | Chuột phải thư mục → "Thêm trang ở đây" → panel Trang mở form với thư mục đó                                                                     |
| 19  | studio `files-panel` test          | Chuột phải thư mục → "Dùng làm thư mục component" → `PATCH /project` thêm vào cuối; thư mục đã có → mục tắt                                      |
| 20  | studio Brand test                  | Brand hiện tên file token; "Đổi file…" chọn file → `PATCH /project` `styleFiles.tokenFile`; "Tự động" → bỏ `tokenFile`                           |

## 5. Bẫy đã biết

- Mọi chỗ đang đọc `designDirs.pages` như **chuỗi**: tìm hết bằng `grep -rn "designDirs\." packages` trước khi đổi kiểu; TypeScript sẽ báo, sửa đúng nghĩa (mặc định = `[0]`, kiểm "nằm trong" = cả danh sách), **không** ép kiểu.
- `import` tương đối: `posix.relative` có thể trả `styles/Home.css` (không có `./`) → phải thêm `./`; trên Windows không dùng `path.relative` (ra `\`).
- Thư mục lồng nhau: sắp xếp theo độ sâu (dài nhất trước) khi xếp loại file.
- File cũ có `designDirs` dạng chuỗi: test 1 phải dùng **đúng** nội dung một `workspace.json` cũ.
- `FolderPicker` không đọc cả cây một lần (dự án lớn): nạp từng thư mục khi mở.
- Ref DOM theo QC-40: `ref={(el) => { r.current = el ?? undefined; }}`.

## 6. Không được làm

- Không sửa Bridge, `docs/spec.md`, MCP, `e2e/` (Claude viết E2E ở lượt QA); không làm bộ tìm route/mẫu trang (K3d).
- Không thêm dependency; không thêm phím tắt.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ cho xanh; không lọc dữ liệu theo đúng giá trị của test.
- File ≤ 400 dòng, hàm ≤ 50 dòng **sau khi chạy Prettier** (chạy `pnpm format` rồi `pnpm lint` trước khi báo cáo).

## 7. Tự kiểm trước khi báo cáo (bắt buộc, theo thứ tự)

1. `pnpm format` → `pnpm verify` (toàn bộ, không chỉ test mới). Test cũ đỏ vì đổi kiểu `designDirs` → sửa test đó cho đúng nghĩa mới, ghi vào báo cáo.
2. `pnpm test:e2e` toàn bộ.
3. Chỉ báo cáo khi **cả hai xanh**. Không dừng giữa chừng để hỏi về lỗi lint/test nhỏ — tự sửa đúng gốc rồi chạy lại.

## 8. Kiểm tay (trong ứng dụng thật)

1. `npm run dev`, mở bản sao `fixtures/projects/react-css`.
2. Panel Trang → Thêm trang → "Chọn…" → chọn `src/pages` → tạo trang `About` → có `src/pages/About.tsx`.
3. Cây: chuột phải `src/pages` → "Thêm trang ở đây" → form mở đúng thư mục.
4. Tạo thư mục `src/widgets`, chuột phải → "Dùng làm thư mục component"; tạo `src/widgets/Badge.tsx` có một component → panel Component thấy `Badge`.
5. Chuột phải `src` → tạo `styles`; chuột phải `src/styles` → "Đặt file CSS mới vào đây"; sửa kiểu "chỉ phần tử này" trên một phần tử của file chưa có CSS → file mới nằm trong `src/styles`, Canvas cập nhật.
6. Brand → "Đổi file…" → chọn một file `.css` khác → danh sách token đổi theo file đó.
7. Mở `.kumicraft/workspace.json` → `designDirs` là mảng, có `styleFiles`.

## 9. Báo cáo

Theo mẫu của README: file tạo/sửa; bảng 20 tình huống (**tên test đúng như trong code**, đạt/không); kết quả `pnpm verify` và `pnpm test:e2e` (số test); test cũ đã sửa và lý do; các bước kiểm tay; chỗ làm khác bản giao việc và lý do.

Không tự commit; đề xuất commit message `feat(studio): folder picker and multiple design folders` (đã qua commitlint).
