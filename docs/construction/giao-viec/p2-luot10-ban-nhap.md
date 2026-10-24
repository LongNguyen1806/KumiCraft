# Phase 2 — Lượt 10: Bản nháp (WP-2.11)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Quy tắc ở spec mục 18D (M-DR, R-DR-10 đến R-DR-16).

**Chia việc:**

- **Claude** làm phần plugin Vite phục vụ trang xem bản nháp (R-DR-12): `packages/bridge/src/integrations/` và file trang HTML ảo. Gemini **không sửa** các file đó.
- **Gemini** làm mọi phần còn lại. Hợp đồng URL ở mục 3.4 là cố định nên hai bên làm song song được.
- Khi kiểm tay, cần cả hai phần đã xong.

## 1. Mục tiêu (người dùng thấy gì)

1. **Ô Trang** trên thanh Canvas có nhóm **Bản nháp**: danh sách bản nháp và mục **Bản nháp mới…** (hỏi tên và kiểu **Trắng** hoặc **Khung tự do**).
2. **Chọn bản nháp:**
   - Canvas hiện bản nháp, dùng đúng màu, font và component của dự án.
   - Thanh "Đang thiết kế" ghi `Bản nháp · <Tên> · <file>`.
   - Mọi chèn và sửa ghi vào file bản nháp.
3. **Chọn lại một trang:** Canvas về trang đó.
4. **Quản lý bản nháp:**
   - Đổi tên, nhân bản, xóa (hỏi xác nhận). Mỗi thao tác một bước Undo.
   - Bản nháp đang được app import: hiện cảnh báo và không xóa được.
5. **Chuyển bản nháp thành trang** (có route) hoặc **thành component**. Ô "Giữ bản nháp" mặc định bật.
6. **Thư mục bản nháp bị `.gitignore` bỏ qua:** hiện cảnh báo vì màu có thể không lên.

## 2. Đọc trước (CW-52)

| File                                                                                                   | Lý do                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `docs/spec.md` mục 18D (M-DR), R-CP-11, R-CP-14, R-CP-16, R-PG-11, R-PG-12, R-HI-11                    | Quy tắc                                                                                                           |
| `packages/server/src/core/project/page-add.ts`, `page-common.ts`, `routes-ast.ts`                      | Tạo file, thêm route, khóa file, kiểm thư mục: **dùng lại** cho tạo bản nháp và "Chuyển thành trang"              |
| `packages/server/src/core/project/component-extract.ts`, `component-scope.ts`, `components-list.ts`    | Tạo file component, đổi đường dẫn import, `.kumicraft/components.json`: **dùng lại** cho "Chuyển thành component" |
| `packages/server/src/core/history/history-service.ts`                                                  | Mục lịch sử tạo, xóa file                                                                                         |
| `packages/shared/src/workspace-file.ts` (`DesignDirsSchema`), `page-names.ts`                          | Thêm khóa `drafts`; tên PascalCase                                                                                |
| `packages/studio/src/features/editor/page-select.tsx`, `canvas-frame.tsx`, `canvas-view-store.ts`      | Ô Trang; `src` của iframe                                                                                         |
| `packages/studio/src/features/design/design-store.ts`, `design-target.ts`, `design-bar.tsx`            | Thanh "Đang thiết kế", file đang thiết kế                                                                         |
| `packages/studio/src/features/pages/add-page-form.tsx`, `features/components-panel/extract-dialog.tsx` | Mẫu form để dựng hộp thoại chuyển                                                                                 |

## 3. Hợp đồng

### 3.1. Shared

```ts
// workspace-file.ts
// DesignDirsSchema thêm drafts: RelPathSchema.optional(); DEFAULT_DESIGN_DIRS.drafts = 'src/drafts'.
// Kiểm R-CP-16 (validateDesignDirs) nay áp dụng cho bốn thư mục.

// project.ts
export const DraftInfoSchema = z.strictObject({
  name: z.string(),
  file: RelPathSchema,
  free: z.boolean(),
  inUse: z.boolean(),
});
export const DraftsInfoSchema = z.strictObject({
  drafts: z.array(DraftInfoSchema),
  dir: RelPathSchema,
  ignored: z.boolean(),
});
export const CreateDraftSchema = z.strictObject({
  name: z.string().trim().max(64).optional(),
  free: z.boolean(),
});
export const RenameDraftSchema = z.strictObject({
  file: RelPathSchema,
  newName: z.string().trim().min(1).max(64),
});
export const DraftFileSchema = z.strictObject({ file: RelPathSchema }); // duplicate, delete
export const PromoteDraftSchema = z.strictObject({
  file: RelPathSchema,
  as: z.enum(['page', 'component']),
  name: z.string().trim().min(1).max(64),
  dir: RelPathSchema.optional(),
  fileName: z.string().max(100).optional(),
  path: z.string().max(200).optional(), // chỉ với 'page'
  keepDraft: z.boolean(),
});
```

`inUse` là phần bổ sung so với spec để Studio hiện cảnh báo R-DR-14 mà không cần gọi thêm API. Ghi vào spec-log.

### 3.2. Server: `packages/server/src/core/project/drafts.ts` (mới; tách `draft-promote.ts` nếu dài)

**Đọc danh sách:**

- `listDrafts`: các file `.tsx`/`.jsx` **trực tiếp** trong thư mục bản nháp (không đệ quy), sắp theo tên.
- `name` là tên component export đầu tiên (đọc bằng AST).
- `free` là `true` khi phần tử JSX gốc của component có thuộc tính `data-rc-free`.
- `inUse` là `true` khi một file `.ts/.tsx/.js/.jsx` trong `sourceDir`, **ngoài** thư mục bản nháp, có câu import mà đường dẫn (tương đối hoặc `@/`) trỏ tới file bản nháp. Quét giới hạn như `pages.ts`: tối đa 500 file, mỗi file 1 MB.
- `ignored`:
  - Đọc `.gitignore` ở gốc dự án. Mỗi dòng bỏ khoảng trắng, bỏ dòng rỗng và dòng `#`.
  - Dòng khớp thư mục bản nháp theo một trong các dạng: `src/drafts`, `/src/drafts`, `src/drafts/`, `src/drafts/**`, `drafts`, `drafts/`. Áp dụng cho đúng giá trị thư mục đang dùng.
  - Chỉ cần đúng các dạng này, không cần đủ cú pháp gitignore.

**Tạo (R-DR-11):**

- Tên mặc định "Bản nháp N", lấy `N` nhỏ nhất chưa có file trùng. Component theo `pageNames` (`BanNhap1`).
- File `<thư mục>/<Component>.tsx` (`.jsx` khi dự án JS).
- Nội dung (thụt 2 dấu cách, `\n`):

  ```tsx
  export function BanNhap1() {
    return <div className="min-h-screen bg-white p-8"></div>;
  }
  ```

  Khi `free: true`, gốc là `<div data-rc-free className="relative min-h-screen w-full bg-white"></div>`.

- Một mục lịch sử tạo file (R-HI-11), nhãn `history:draftCreate`.

**Đổi tên (R-DR-14):**

- File mới `<Tên mới>.<đuôi>` cùng thư mục, chỉ đổi tên khai báo component export, xóa file cũ.
- `inUse` thì E016 `draftInUse`: đổi tên sẽ làm hỏng import của app.
- Nhãn `history:draftRename`.

**Nhân bản:**

- Tên `<Tên>2`, `<Tên>3`…, là số nhỏ nhất chưa có. Nội dung giống hệt, chỉ đổi tên khai báo.
- Nhãn `history:draftDuplicate`.

**Xóa:**

- `inUse` thì E016 `draftInUse`, không xóa.
- Nhãn `history:draftDelete`.

**Chuyển (R-DR-15):**

- **`as: 'page'`:**
  - Tạo file trang ở `dir` (mặc định `designDirs.pages`) với tên, URL, file như R-PG-11.
  - Nội dung = file bản nháp, đổi tên khai báo thành tên trang, và **đổi đường dẫn mọi import tương đối** theo thư mục mới. Dùng hàm đổi đường dẫn của `component-scope.ts`/`imports.ts`; giữ `@/…` và tên gói.
  - Thêm import và route vào `routes.tsx` y như thêm trang (dùng lại phần code của `page-add.ts`, không chép lại).
  - Lỗi như thêm trang: `pathExists`, `fileExists`, `nameExists`, E012, `notConvention`.
- **`as: 'component'`:**
  - Tạo file ở `dir` (mặc định `designDirs.components`) với nội dung đổi tên và đổi import như trên.
  - Ghi `.kumicraft/components.json` khi thư mục nằm ngoài vùng `components`/`layouts`, như R-CP-14.
  - **Không** sửa file nào khác.
- **Chung:**
  - `keepDraft: false`: xóa file bản nháp trong **cùng** mục lịch sử.
  - Kết quả có `pagePath` khi là trang.
  - Nhãn `history:draftPromote`.
- **Tất cả các thao tác:**
  - Kiểm xong mới ghi, hoàn lại khi lỗi, khóa file theo thứ tự (`withFileLocks`).
  - File nằm ngoài thư mục bản nháp thì E012.
  - File không tồn tại thì E017.

### 3.3. Endpoint

Theo spec mục 18D:

- `GET /project/drafts`
- `POST /project/drafts`
- `PATCH /project/drafts`
- `POST /project/drafts/duplicate`
- `DELETE /project/drafts`
- `POST /project/drafts/promote`

Các thao tác ghi trả `{ data: StructureResult }`. Kết quả tạo và nhân bản có thêm `draftFile` (file mới) để Studio mở ngay: thêm `draftFile` tùy chọn vào `StructureResultSchema`. Thêm stub vào `project.test.ts`.

### 3.4. Studio

**Iframe:**

- `canvas-view-store.ts` thêm `draftFile?: string`, `openDraft(file)`, `closeDraft()`.
- `IframeFrame`: khi có `draftFile` thì `src = ${origin}/__kumicraft/draft?file=${encodeURIComponent(draftFile)}`, không thì như hiện tại.
- `key` của `IframeFrame` thêm `draftFile`, để đổi qua lại thì iframe tải lại.
- Bản nháp đang mở được nhớ theo `projectId` trong `localStorage` (bọc `try/catch`). Mở lại dự án thì mở lại bản nháp nếu file còn trong danh sách.

**Ô Trang (`page-select.tsx`):**

- Thêm `<optgroup>` "Bản nháp" liệt kê bản nháp, value dạng `draft:<file>`, và mục `draft:new` ("Bản nháp mới…").
- Chọn bản nháp: `openDraft`. Chọn trang khi đang ở bản nháp: `closeDraft` rồi điều hướng.
- Tách thành file `draft-select-items.tsx` nếu vượt giới hạn.

**`features/drafts/` (mới):**

- `use-drafts.ts`: tải `GET /project/drafts`, tải lại khi `project.changed` hoặc `project.filesChanged` có file trong thư mục bản nháp.
- `new-draft-dialog.tsx` (`data-testid="draft-new-dialog"`):
  - ô tên (`draft-name`, để trống thì server tự đặt);
  - chọn kiểu `draft-kind-blank` / `draft-kind-free`;
  - nút `draft-create`.
  - Tạo xong: `openDraft(draftFile)`.
- `drafts-dialog.tsx` (`data-testid="drafts-dialog"`, mở từ nút `drafts-manage` cạnh `pages-manage`):
  - mỗi dòng có `draft-rename-<file>`, `draft-duplicate-<file>`, `draft-delete-<file>`, `draft-promote-<file>`;
  - bản nháp `inUse` có nhãn `draft-in-use` và nút xóa bị khóa;
  - `ignored` thì hiện `drafts-ignored-warning`.
- `promote-draft-dialog.tsx`:
  - chọn Trang hoặc Component;
  - các ô như form thêm trang hoặc tách component (dùng lại component con nếu tách được, không chép);
  - ô `promote-keep` mặc định bật;
  - bản nháp `free` thì hiện `promote-free-warning`.
  - Chuyển thành trang xong: `closeDraft` rồi `navigate(pagePath)`.

**Thanh "Đang thiết kế":**

- `design-target.ts` thêm loại `draft`. Khi có `draftFile`, đích thiết kế là file bản nháp, thanh ghi `Bản nháp · <Tên> · <file>`.
- `studioBridgeChannel.setDesignFile(draftFile, false)` để chèn và sửa ghi vào file bản nháp (R-CP-11).
- **Lưu ý:** trang bản nháp có `route` riêng do Bridge báo. `useDesignTargetSync` không được coi đó là trang của router.

**Lỗi trang bản nháp:** khi lỗi chạy (R-RN-25) xảy ra lúc đang mở bản nháp, danh sách lỗi thêm dòng gợi ý `draft-provider-hint` ("Bản nháp chạy ngoài app; component này cần Provider").

**i18n `vi`/`en`:**

- nhãn của mọi hộp thoại, nút và cảnh báo trên;
- `history.draftCreate`, `history.draftRename`, `history.draftDuplicate`, `history.draftDelete`, `history.draftPromote`;
- `errors.E016.reasons.draftInUse`.

### 3.5. Phần Claude làm (để Gemini biết, không sửa)

- Plugin Bridge phục vụ `GET /__kumicraft/draft?file=<RelPath>` khi dev server chạy.
  - `file` không nằm trong thư mục bản nháp thì 404.
  - Trang nạp CSS Tailwind của dự án, import component, bọc `MemoryRouter` khi dự án có `react-router`/`react-router-dom`, gắn vào `#root`.
- Runner truyền thư mục bản nháp cho plugin qua `RunnerOptions.draftsDir`. Claude thêm trường này vào shared và runner.

## 4. Tình huống test

Server dùng dự án tạo từ template trong thư mục tạm. Test ghi nhiều lần dùng `directWriteFs`. **Không nâng thời gian chờ.**

| #   | Đầu vào                                                                                                                               | Kết quả                                                                                                                                                                                                                                                                       | Mã               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Tạo không tên (`free: false`) hai lần; tạo "Mockup" `free: true`                                                                      | `src/drafts/BanNhap1.tsx`, `BanNhap2.tsx` đúng nội dung mục 3.2; `Mockup.tsx` có `data-rc-free`; `listDrafts` trả 3 mục, `free` đúng                                                                                                                                          | R-DR-10, R-DR-11 |
| 2   | Tạo rồi Undo, Redo                                                                                                                    | Undo: file không còn; Redo: file đúng từng byte                                                                                                                                                                                                                               | R-DR-11, R-HI-11 |
| 3   | Đổi tên `BanNhap1` thành "Trang chủ mới"                                                                                              | `TrangChuMoi.tsx` có `export function TrangChuMoi`, file cũ mất; Undo đúng từng byte cả hai                                                                                                                                                                                   | R-DR-14          |
| 4   | Nhân bản `Mockup` hai lần                                                                                                             | `Mockup2.tsx`, `Mockup3.tsx`, tên hàm đúng                                                                                                                                                                                                                                    | R-DR-14          |
| 5   | `Home.tsx` import `../drafts/Mockup` rồi xóa `Mockup`; đổi tên `Mockup`                                                               | E016 `draftInUse` cả hai; `listDrafts` có `inUse: true`                                                                                                                                                                                                                       | R-DR-14          |
| 6   | Xóa bản nháp không ai dùng rồi Undo                                                                                                   | Undo tạo lại đúng từng byte                                                                                                                                                                                                                                                   | R-DR-14, R-HI-11 |
| 7   | Bản nháp có `import { Button } from '../components/ui/Button.tsx'`; chuyển thành trang "Khuyến mãi" `/khuyen-mai`, `keepDraft: false` | `src/pages/KhuyenMai.tsx` có `export function KhuyenMai`, import thành `'../components/ui/Button.tsx'` (cùng độ sâu nên không đổi); route `khuyen-mai` thêm như R-PG-12; bản nháp mất; **một** mục lịch sử; Undo trả cả 3 file (`routes.tsx`, trang, bản nháp) đúng từng byte | R-DR-15, R-HI-11 |
| 8   | Như #7 nhưng `dir: 'src/pages/promo'`                                                                                                 | Import thành `'../../components/ui/Button.tsx'`                                                                                                                                                                                                                               | R-DR-15          |
| 9   | Chuyển thành component `PromoBox` vào `src/features/promo`, `keepDraft: true`                                                         | File mới đúng; bản nháp còn nguyên; `components.json` có file mới                                                                                                                                                                                                             | R-DR-15          |
| 10  | Chuyển thành trang với path đã có                                                                                                     | E016 `pathExists`, không file nào đổi                                                                                                                                                                                                                                         | R-DR-15          |
| 11  | `.gitignore` có dòng `src/drafts/`; có dòng `# src/drafts`                                                                            | `ignored: true`; dòng comment thì `false`                                                                                                                                                                                                                                     | R-DR-10          |
| 12  | `PATCH /project { designDirs }` có `drafts` trùng `pages`; `drafts` lồng trong `components`                                           | E016 `designDirs`                                                                                                                                                                                                                                                             | R-CP-16, R-DR-10 |
| 13  | Thao tác với `file: 'src/pages/Home.tsx'` hoặc `'../x.tsx'`                                                                           | E012, không đổi gì                                                                                                                                                                                                                                                            | R-DR-10          |
| 14  | Sau mọi thao tác ở #1–#9, `routes.tsx` không có bản nháp                                                                              | Đúng (chỉ #7 thêm route của **trang mới**)                                                                                                                                                                                                                                    | R-DR-16          |
| 15  | Studio: chọn `draft:<file>` trong ô Trang                                                                                             | `canvas-view-store.draftFile` đổi; `src` iframe là URL bản nháp; thanh "Đang thiết kế" ghi `Bản nháp · …`; `setDesignFile` gửi file bản nháp                                                                                                                                  | R-DR-13          |
| 16  | Studio: chọn một trang khi đang ở bản nháp                                                                                            | `draftFile` hết; iframe về URL trang                                                                                                                                                                                                                                          | R-DR-13          |
| 17  | Studio `DraftsDialog`: bản nháp `inUse` thì nút xóa khóa, có `draft-in-use`; `ignored` thì có cảnh báo                                | Đúng                                                                                                                                                                                                                                                                          | R-DR-14, R-DR-10 |
| 18  | Studio `PromoteDraftDialog`: bản nháp `free` có `promote-free-warning`; `promote-keep` mặc định bật                                   | Đúng                                                                                                                                                                                                                                                                          | R-DR-15          |

## 5. Kiểm tay (chủ dự án, sau khi cả phần Claude xong)

Trên dự án mới (Oakline):

1. Ô Trang → **Bản nháp mới…** → để trống tên, kiểu Trắng: Canvas mở trang trắng; thanh ghi `Bản nháp · BanNhap1 · src/drafts/BanNhap1.tsx`.
2. Mở Thư viện, chọn nền trang trắng, chèn khối **Hero** rồi **Card**: hiện đúng kiểu Tailwind. Panel Component → chèn `Button`: nút có **màu brand** (xanh) như trên trang Home.
3. Chuyển sang trang Home rồi quay lại bản nháp: nội dung còn nguyên.
4. Quản lý bản nháp → **Nhân bản**, **Đổi tên** thành "Mockup cửa hàng", **Xóa** bản nhân bản; Ctrl+Z lần lượt: file trở lại đúng.
5. **Chuyển thành trang** "Khuyến mãi" `/khuyen-mai`, bỏ "Giữ bản nháp": Canvas mở `/khuyen-mai` có đúng nội dung; Header vẫn có (nằm trong layout).
6. Ctrl+Z: trang và route mất, bản nháp quay lại.
7. Tạo bản nháp **Khung tự do**: hộp thoại chuyển thành trang có nhắc kiểm tra trên điện thoại.
8. Trong dự án chạy `pnpm build`: không lỗi, dù có bản nháp không ai import.

Trên WorkTracker:

9. Tạo một bản nháp, chèn vài khối, chèn một component của WorkTracker (ví dụ nút). Nếu component cần Provider thì Canvas báo lỗi kèm dòng gợi ý Provider, không làm hỏng gì.

## 6. Bẫy đã biết

- **Không nâng thời gian chờ test;** test ghi nhiều lần dùng `directWriteFs`.
- **Dùng lại, không chép:** thêm route (`page-add.ts`), đổi đường dẫn import (`component-scope.ts`/`imports.ts`), kiểm thư mục (`page-common.ts`). Hàm cần dùng chung mà đang nội bộ thì export ra, không copy.
- **Đổi tên khai báo:** chỉ đổi tên của component export (và `export default function X` nếu có), không đổi chữ trùng tên ở chỗ khác trong file.
- **Iframe:** `IframeFrame` giữ `src` trong `useState`. Đổi URL phải đổi `key`, không sửa `src` tại chỗ.
- **`currentRoute` khi mở bản nháp:** Bridge báo route của trang bản nháp (`/__kumicraft/draft`). Không được để `useDesignTargetSync` tưởng đây là một trang của router rồi tìm sai file.
- **Giữ file ≤ 400 dòng, hàm ≤ 50 dòng.** Không đổi hành vi các lượt trước; test cũ xanh.

## 7. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ:

- danh sách hàm đã export ra để dùng lại;
- nội dung file trang sau #7 (dán nguyên văn);
- kiểm tay nếu đã thử, chưa thử thì ghi rõ.

Không chạy `pnpm test:e2e`.

```text
feat(studio): add drafts that turn into pages or components
```
