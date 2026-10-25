# Phase 4 — Lượt K3b: Cây thư mục dự án (xem, mở, tạo, đổi tên, xóa, đánh dấu)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

## 0. Bối cảnh

Quyết định của chủ dự án (spec-log #65, #66; kế hoạch `p4-ke-hoach.md` mục K3, bảng 15 tính năng): thêm **cây thư mục thật của dự án** vào Studio. Cây cho **xem, mở, tạo, đổi tên, xóa** (người dùng biết code, lỗi import thì họ tự sửa; KumiCraft cảnh báo cụ thể trước và cho Undo). Không kéo thả để di chuyển (đổi tên đường dẫn thay cho di chuyển).

K3a đã có thanh hoạt động (`features/shell/activity-bar.tsx`, `ACTIVITY_ITEMS`, `activity-store.ts`). Lượt này thêm icon **Thư mục** đứng đầu và làm các tính năng số **6, 7, 8, 9** trong bảng của kế hoạch. Bộ chọn thư mục cho Thêm trang/Tách component/Đưa nháp và `designDirs` là K3c; bộ tìm route là K3d — **không làm ở đây**.

Đã có sẵn (dùng lại, không viết lại):

- `FileSystemPort` (`readDir`, `readText`, `readBytes`, `writeTextAtomic`, `writeBytesAtomic`, `remove`, `rename`, `stat`, `exists`), kiểm đường dẫn trong root (S-20 đến S-24).
- Lịch sử: `HistoryFileChange` có `before`/`after` để trống khi file chưa có/bị xóa, `encoding: 'base64'` cho file nhị phân; `history.push`, `recordInternalWrite` (để watcher không coi thao tác của Studio là sửa từ ngoài).
- Watcher phát `project.filesChanged` cho thay đổi từ ngoài (`core/project/project-watch.ts`); `history.changed` sau mỗi thao tác của Studio.
- Trang: `deletePage` (`core/project/page-delete.ts`), form đổi tên trang (`features/pages/rename-page-form.tsx`), danh sách trang có `file` (`PageInfo`).
- Mở editor: `openInEditor(loc)` (`studio/src/api/editor-client.ts`, route `POST /open-in-editor`).
- Chế độ sửa component: `useDesignStore.getState().enterComponentMode({ componentName, filePath })` (xem `features/design/select-in-file-hint.tsx`).
- Lỗi build: `useCanvasErrorStore` (`buildError` có file).
- File AI vừa sửa: danh sách file của lượt chat (`features/chat/chat-files.tsx`, `chat-store.ts`).

Không sửa: Bridge, `docs/spec.md`, MCP, lớp style, nội dung các panel khác.

## 1. Mục tiêu (người dùng thấy gì)

1. Icon **Thư mục** đứng đầu dãy icon → panel trái là **cây thật của dự án** (gốc dự án, không chỉ `src`): thư mục trước, file sau, theo tên; bỏ qua `node_modules`, `.git`, `dist`, `.kumicraft`, `.vite`; file bắt đầu bằng `.` hiện mờ. Mở rộng/thu gọn từng thư mục (nạp khi mở), nhớ thư mục đang mở theo dự án.
2. **Bấm file giao diện** (`.jsx`, `.tsx`): là trang có trong router → Canvas chuyển tới trang đó; file khác trong `src` → vào **chế độ sửa component** của file đó. **Bấm file khác** (CSS, JSON…) → mở trong editor.
3. **Chuột phải** (và nút "⋯" khi rê chuột, để dùng được không cần chuột phải): **Mở trong editor**, **File mới…**, **Thư mục mới…**, **Đổi tên…**, **Xóa…**, **Sao chép đường dẫn**.
4. **Tạo file/thư mục**: ô nhập tên ngay trong cây (như VS Code); tên có `/` thì tạo luôn thư mục con. File mới rỗng; là một bước Undo.
5. **Đổi tên** (ô nhập ngay trong cây; được đổi cả đường dẫn để chuyển sang thư mục khác): trước khi làm, nếu có file đang `import` file này → hộp xác nhận liệt kê **từng file** sẽ lỗi (ví dụ `src/App.jsx`, `src/layouts/MainLayout.jsx`); file là **trang có trong router** → mở form Đổi tên trang sẵn có (sửa cả route) thay vì đổi tên thô.
6. **Xóa**: hộp xác nhận luôn hiện; liệt kê file đang import (file) hoặc số file bên trong (thư mục); file là trang có trong router → dùng luồng Xóa trang sẵn có (xóa cả route).
7. Mọi tạo/đổi tên/xóa là **một mục lịch sử**; Undo/Redo trả đúng từng byte (kể cả ảnh).
8. **Đánh dấu trên cây**:
   - phần tử đang chọn trên Canvas → cây tự mở tới file của nó và tô đậm dòng đó;
   - file đang lỗi build → chấm đỏ, thư mục cha có chấm đỏ nhỏ;
   - file AI vừa sửa trong lượt chat gần nhất → chấm màu nhấn;
   - icon Thư mục trên dãy icon có huy hiệu đỏ khi có lỗi build.
9. **Kéo file/thư mục từ cây vào ô chat** → thêm vào ngữ cảnh của tin nhắn (như đính kèm file hiện có của chat).
10. File/thư mục thêm, xóa từ ngoài (editor, git) → cây tự cập nhật.

## 2. Đọc trước (CW-52)

| File                                                                                                                    | Lý do                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `docs/construction/giao-viec/p4-ke-hoach.md` mục K3, `spec-log.md` #65, #66, #70                                        | Quyết định                                                       |
| `packages/server/src/core/ports/file-system-port.ts`, `adapters/fs/node-file-system.ts`                                 | Thao tác file, kiểm đường dẫn                                    |
| `packages/server/src/core/history/history-service.ts`, `history-file-io.ts`                                             | Một mục lịch sử nhiều file, file nhị phân, `recordInternalWrite` |
| `packages/server/src/core/project/project-watch.ts`, `page-common.ts` (`listProjectDirs`), `page-delete.ts`, `pages.ts` | Watcher, duyệt thư mục, xóa trang, danh sách trang               |
| `packages/server/src/adapters/http/routes/project.ts`, `source.ts`                                                      | Mẫu route + ghi lịch sử                                          |
| `packages/studio/src/features/shell/*`, `features/editor/side-panels.tsx`                                               | Thanh hoạt động, panel trái                                      |
| `packages/studio/src/features/design/design-store.ts`, `select-in-file-hint.tsx`                                        | Vào chế độ sửa component                                         |
| `packages/studio/src/features/layers/*`                                                                                 | Mẫu cây ảo hóa, mở rộng/thu gọn, phím mũi tên (R-SL-07)          |
| `packages/studio/src/features/canvas-errors/canvas-error-store.ts`, `features/chat/*`                                   | Lỗi build, file AI sửa, đính kèm chat                            |

## 3. Hợp đồng

### 3.1. Shared (`packages/shared/src/files.ts`, export ở `index.ts`)

```ts
export const FileTreeEntrySchema = z.strictObject({
  name: z.string().min(1).max(255),
  path: RelPathSchema, // từ gốc dự án, dấu `/`
  kind: z.enum(['file', 'directory']),
  hidden: z.boolean(), // tên bắt đầu bằng `.`
});
export const FileTreeListingSchema = z.strictObject({
  dir: z.string().max(1024),
  entries: z.array(FileTreeEntrySchema).max(2000),
  truncated: z.boolean(),
});
export const FileCreateSchema = z.strictObject({
  path: RelPathSchema,
  kind: z.enum(['file', 'directory']),
});
export const FileRenameSchema = z.strictObject({ from: RelPathSchema, to: RelPathSchema });
export const FileDeleteSchema = z.strictObject({ path: RelPathSchema });
export const FileImportersSchema = z.strictObject({
  importers: z.array(RelPathSchema).max(200),
  truncated: z.boolean(),
});
```

### 3.2. Server (`packages/server/src/core/project/file-tree.ts`, `file-ops.ts`, `file-importers.ts`)

- **Bỏ qua** (không liệt kê, không cho tạo/đổi tên/xóa vào trong): `node_modules`, `.git`, `dist`, `.kumicraft`, `.vite`. Đường dẫn ngoài gốc → `E012` như `FileSystemPort`.
- `GET /project/tree?dir=<rel>` (rỗng = gốc): một cấp, thư mục trước, theo tên (không phân biệt hoa thường), tối đa 2000 mục (`truncated`).
- `POST /project/files` (`FileCreateSchema`): đã có → `E016 { reason: 'exists' }`; file → tạo rỗng, **một mục lịch sử** (`before` trống, `after` `''`); thư mục rỗng → tạo, **không** vào lịch sử (lịch sử chỉ chứa file; ghi spec-log).
- `POST /project/files/rename` (`FileRenameSchema`): đích đã có → `E016 exists`; tạo thư mục cha của đích nếu thiếu. File: một mục lịch sử gồm 2 thay đổi (`from`: `before` = nội dung, `after` trống; `to`: `before` trống, `after` = nội dung). Thư mục: như vậy cho **mọi file bên trong**.
- `DELETE /project/files` (`FileDeleteSchema`): file → một mục (`after` trống); thư mục → mọi file bên trong trong **một** mục, rồi xóa thư mục.
- **Giới hạn** thư mục: > 500 file hoặc > 20 MB → `E016 { reason: 'tooLarge', params: { files, bytes } }` (Studio báo "Thư mục quá lớn để hoàn tác — hãy dùng editor"); không làm gì.
- File nhị phân (không đọc được UTF-8 hợp lệ, hoặc đuôi ảnh/phông): dùng `readBytes`/`writeBytesAtomic`, lịch sử `encoding: 'base64'` như `insertImage`.
- Ghi theo thứ tự an toàn và **gọi `recordInternalWrite` trước khi ghi** (như `theme.ts`); lỗi giữa chừng → trả các file đã đổi về như cũ (dùng `writeFilesAtomicWithRollback` nếu hợp), rồi báo lỗi.
- Nhãn lịch sử: `history:fileCreate`, `history:fileRename`, `history:fileDelete` (`params.name`), i18n vi/en.
- `GET /project/files/importers?path=<rel>`: các file nguồn (`.js .jsx .ts .tsx .mjs .cjs .css .scss .sass .less`) trong `sourceDir` có import trỏ tới `path` (hoặc tới file trong thư mục `path`): `import … from '…'`, `import '…'`, `export … from '…'`, `import('…')`, `require('…')`, `@import`/`@use`/`@forward` CSS. Chỉ đường dẫn **tương đối** và alias `@/` → `src/` (ghi spec-log); thử đuôi `.ts .tsx .js .jsx` và `index.*`; bỏ comment bằng cách parse (Babel cho JS/TS, `parseStylesheet` cho CSS), không regex trên cả file. Tối đa 200 (`truncated`).
- Thao tác lên file là trang trong router: server **không** tự đổi luồng; Studio quyết định (mục 3.4).

### 3.3. Studio: panel Thư mục (`packages/studio/src/features/files/`)

- `ACTIVITY_IDS` thêm `'files'` **đầu tiên**; `ACTIVITY_ITEMS` thêm mục `files` (icon `FolderTree` của `lucide-react`), `badge` = 1 khi có lỗi build (`useCanvasErrorStore`).
- `files-panel.tsx`: cây ảo hóa theo mẫu `layers/layer-tree.tsx` (cùng thư viện ảo hóa, `role="tree"`/`treeitem`, phím mũi tên, Enter mở, F2 đổi tên, Delete xóa); mỗi thư mục nạp khi mở; nhớ thư mục đang mở ở `localStorage` khóa `kumicraft.files.<projectId>` (try/catch).
- Cập nhật: nghe `project.filesChanged` và `history.changed` → nạp lại các thư mục đang mở có liên quan (không nạp lại cả cây).
- Icon theo loại file (thư mục, `.jsx/.tsx`, `.css/.scss/.less`, ảnh, `.json`, khác) bằng icon `lucide-react` sẵn có.
- **Bấm file** theo mục 1.2: trang trong router (khớp `PageInfo.file`) → điều hướng Canvas như danh sách trang hiện có; `.jsx/.tsx` trong `sourceDir` → `enterComponentMode({ componentName: <tên file không đuôi>, filePath })`; còn lại → `openInEditor('<path>:1:1')`.
- **Menu**: thành phần menu dùng lại kiểu menu chuột phải đang có trong Studio (xem `features/layer-menu/`), không thêm thư viện; mở bằng chuột phải và nút "⋯".
- **Đổi tên/tạo**: ô nhập ngay tại dòng; Enter xác nhận, Esc hủy; tên rỗng hoặc chứa ký tự cấm (`\ : * ? " < > |`) → báo lỗi tại chỗ.
- **Xác nhận** (hộp thoại `Dialog` sẵn có): gọi `importers` trước; liệt kê file (tối đa 10 dòng + "và N file khác"); thư mục: số file. Nút xác nhận là nút nguy hiểm (màu đỏ) khi có file sẽ lỗi.
- **Đánh dấu** (mục 1.8): chọn phần tử → `loc` của phần tử cho file → mở các thư mục cha, cuộn tới, tô dòng; lỗi build và file AI sửa: chấm màu (có `aria-label`/`title` cho trình đọc màn hình).
- **Kéo vào chat**: `draggable` + `dataTransfer` kiểu riêng (`application/x-kumicraft-path`); ô chat nhận và thêm vào ngữ cảnh theo đúng cơ chế đính kèm file hiện có của chat (đọc `chat-attachments.tsx`/`chat-context.tsx`, dùng lại, không tạo cơ chế thứ hai).
- **Sao chép đường dẫn**: `navigator.clipboard.writeText(path)` (bọc try/catch).

### 3.4. Trang trong router

- Xóa file là trang (`PageInfo.file === path`) → gọi luồng Xóa trang sẵn có (endpoint + xác nhận hiện có), không gọi `DELETE /project/files`.
- Đổi tên file là trang → mở `rename-page-form` sẵn có cho trang đó.
- Xóa/đổi tên **thư mục** chứa trang → hộp xác nhận ghi thêm "Thư mục có N trang trong router; route sẽ lỗi" (không tự sửa route — K3d).

### 3.5. Phím tắt dãy icon

Không thêm phím tắt mới (nhiều tổ hợp đã bị trình duyệt giữ, R-KB-13). Ghi spec-log.

## 4. Tình huống test (bắt buộc, ≤ 20, gắn mã trong tên test: `WP-4.00` cho mọi test, thêm mã riêng nếu có)

| #   | File test                                    | Tình huống → kết quả                                                                                                                                                |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `file-tree.test.ts` (thư mục tạm, file thật) | Gốc: thư mục trước, theo tên; `node_modules`, `.git`, `dist`, `.kumicraft` không có; `.env` có `hidden: true`                                                       |
| 2   | như trên                                     | `dir=../x` hoặc `dir=node_modules` → lỗi, không liệt kê                                                                                                             |
| 3   | `file-ops.test.ts`                           | Tạo file → có trên đĩa, một mục lịch sử; Undo xóa file; Redo tạo lại; tạo trùng → `E016 exists`                                                                     |
| 4   | như trên                                     | Đổi tên file sang thư mục mới chưa có → thư mục được tạo; một mục lịch sử; Undo trả cả hai đường dẫn đúng từng byte                                                 |
| 5   | như trên                                     | Đổi tên thư mục 3 file (có 1 ảnh PNG) → một mục; Undo trả đúng byte cả ảnh                                                                                          |
| 6   | như trên                                     | Xóa thư mục → một mục; Undo trả mọi file; thư mục > giới hạn → `E016 tooLarge`, không đổi gì                                                                        |
| 7   | như trên                                     | Đích nằm trong `node_modules` hoặc `.kumicraft` → lỗi, không đổi gì                                                                                                 |
| 8   | như trên                                     | Thao tác của Studio không sinh `project.filesChanged` (đã `recordInternalWrite`)                                                                                    |
| 9   | `file-importers.test.ts`                     | `Header.jsx` được import bởi `App.jsx` (`./components/Header`), `Layout.tsx` (`@/components/Header.jsx`), CSS `@import` không tính; import trong comment không tính |
| 10  | như trên                                     | Thư mục `components` → các file import bất kỳ file bên trong                                                                                                        |
| 11  | routes test (thêm)                           | 5 endpoint: schema sai → `E016`; chưa mở dự án → `E021`                                                                                                             |
| 12  | `files-panel.test.tsx`                       | Hiện cấp gốc; bấm thư mục → nạp và hiện con; nhớ thư mục đang mở vào `localStorage`                                                                                 |
| 13  | như trên                                     | Bấm file trang → điều hướng; bấm `.tsx` khác → `enterComponentMode`; bấm `.css` → `openInEditor`                                                                    |
| 14  | như trên                                     | Xóa file có 2 importer → hộp xác nhận liệt kê đúng 2 file; Hủy → không gọi API                                                                                      |
| 15  | như trên                                     | Xóa file là trang → gọi luồng Xóa trang, không gọi `DELETE /project/files`                                                                                          |
| 16  | như trên                                     | Đổi tên tại dòng: Enter gọi API đúng `from`/`to`; Esc hủy; tên có `:` → lỗi tại chỗ                                                                                 |
| 17  | như trên                                     | Lỗi build ở `src/App.tsx` → dòng có chấm đỏ, thư mục `src` có chấm; icon Thư mục có huy hiệu                                                                        |
| 18  | như trên                                     | Chọn phần tử có `loc` `src/components/Header.tsx:3:5` → thư mục cha mở, dòng `Header.tsx` được tô                                                                   |
| 19  | như trên                                     | Sự kiện `project.filesChanged` cho file trong thư mục đang mở → thư mục đó được nạp lại                                                                             |
| 20  | chat test (thêm)                             | Thả `application/x-kumicraft-path` vào ô chat → file vào ngữ cảnh tin nhắn                                                                                          |

## 5. Bẫy đã biết

- Đổi tên trên Windows chỉ khác hoa/thường (`header.jsx` → `Header.jsx`): đích "đã có" vì hệ file không phân biệt hoa thường; cho phép khi `from` và `to` chỉ khác hoa thường (đổi qua tên tạm).
- File lớn/nhị phân: không đọc như UTF-8; giới hạn đọc như `FileSystemPort` (S-29).
- Watcher cũng thấy file tạo bởi thao tác của Studio: phải `recordInternalWrite` **trước** khi ghi; file bị xóa cũng cần được đánh dấu để watcher bỏ qua (xem cách `history-service` xử lý `after` trống).
- Cây ảo hóa: dòng đang tô có thể chưa render; cuộn bằng chỉ số, không bằng `scrollIntoView` của phần tử chưa có.
- Không đọc cả cây một lần (dự án lớn): mỗi thư mục nạp khi mở.
- Ref DOM theo QC-40: `ref={(el) => { r.current = el ?? undefined; }}`.

## 6. Không được làm

- Không sửa Bridge, `docs/spec.md`, MCP, lớp style; không sửa `e2e/` (Claude viết E2E ở lượt QA).
- Không kéo thả để di chuyển file; không thêm phím tắt.
- Không thêm dependency.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ cho xanh; không lọc dữ liệu theo đúng giá trị của test.
- File ≤ 400 dòng.

## 7. Kiểm tay (trong ứng dụng thật)

1. `npm run dev`, mở bản sao `fixtures/projects/react-css`. Icon Thư mục → cây; mở `src/components`.
2. Bấm `Card.tsx` → chế độ sửa component; bấm `Card.css` → mở trong editor.
3. Tạo `src/components/Badge.tsx` → có trên đĩa; Undo → mất; Redo → có lại.
4. Đổi tên `Card.css` → hộp xác nhận liệt kê `Card.tsx`; xác nhận → Canvas báo lỗi build, `Card.tsx` chấm đỏ; Undo → hết lỗi.
5. Xóa thư mục `src/pages` → xác nhận có số file và số trang; Hủy.
6. Chọn một thẻ trong Card trên Canvas → cây tự mở tới `Card.tsx`.
7. Sửa một file bằng editor ngoài (tạo file mới trong `src`) → cây hiện file đó.

## 8. Báo cáo

Theo mẫu của README: file tạo/sửa; bảng 20 tình huống (**tên test đúng như trong code**, đạt/không); kết quả `pnpm verify` và `pnpm test:e2e`; các bước kiểm tay trong ứng dụng thật (bước nào không làm được thì ghi lý do); chỗ làm khác bản giao việc và lý do.

Không tự commit; đề xuất commit message `feat(studio): project file tree with open, create, rename and delete` (đã qua commitlint).
