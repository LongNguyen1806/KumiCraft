# Phase 2 — Lượt 13a: Ảnh — tải lên, chèn, Undo xóa ảnh (WP-2.09a)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Quy tắc: spec mục 18B (M-DT), R-DT-13, R-DT-14, R-HI-11, S-20 đến S-24.

Lượt 13 (Công cụ vẽ) chia hai:

- **13a (bản này): phần ảnh.** Server nhận ảnh tải lên, ghi `public/images/`, chèn `<img>` trong **cùng một mục lịch sử**, Undo xóa luôn file ảnh. Studio có hộp chọn ảnh.
- **13b (lượt sau):** thanh công cụ Chọn/Khung/Chữ/Ảnh, vẽ trên Canvas (Bridge), nối hộp chọn ảnh vào công cụ Ảnh.

Lượt này **không sửa Bridge**.

## 1. Mục tiêu (người dùng thấy gì)

1. Hộp **Chọn ảnh** (`data-testid="image-picker"`): lưới ảnh đã có trong `public/` của dự án (kèm ảnh thu nhỏ) và nút **Tải ảnh từ máy**.
2. Chọn hoặc tải một ảnh, điền **mô tả ảnh (alt)** — bắt buộc, gợi ý sẵn từ tên file — bấm **Chèn**: phần tử `<img>` xuất hiện trong file, được chọn ngay.
3. Ảnh tải lên được kiểm loại thật (byte đầu file), tối đa 5 MB; tên file thành chữ thường không dấu, trùng thì thêm `-2`, `-3`…
4. SVG có script hoặc `on…=` hoặc `javascript:` bị từ chối với thông báo rõ.
5. **Một Ctrl+Z** gỡ `<img>` **và** xóa file ảnh vừa tải. Ctrl+Y tạo lại đúng từng byte.

Ở 13a, hộp chọn ảnh được mở từ một nút tạm trong Library: **Ảnh…** (`data-testid="library-insert-image"`), chèn theo cách chọn chỗ của Library (`determineInsertTarget`). 13b sẽ mở nó từ công cụ Ảnh.

## 2. Đọc trước (CW-52)

| File                                                                                                                           | Lý do                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `docs/spec.md` mục 18B, R-HI-04, R-HI-11, S-20 đến S-24, E016                                                                  | Quy tắc                                                                |
| `packages/server/src/core/ports/file-system-port.ts`, `adapters/fs/node-file-system.ts`, `core/workspace/test-support.ts`      | Cổng file; mọi chỗ cài đặt cổng (tìm bằng `tsc` sau khi thêm hàm)      |
| `packages/server/src/core/history/history-service.ts` (+ `history-service-files.test.ts`)                                      | `HistoryFile`, hash, Undo/Redo file tạo/xóa (R-HI-11)                  |
| `packages/server/src/core/source-editor/source-editor-service.ts`, `structure/structure-plan.ts`, `structure/placement-jsx.ts` | `applyStructureEdit`, `planInsert`, `onWritten`                        |
| `packages/server/src/adapters/http/routes/source.ts`, `routes/project.ts`                                                      | Nhãn lịch sử (`history:insert`), route mới                             |
| `packages/server/src/core/project/drafts.ts`                                                                                   | Mẫu tạo file + một mục lịch sử                                         |
| `packages/shared/src/source.ts` (`InsertEditSchema`, `StructureEditSchema`, `AnyEditSchema`)                                   | Thêm loại sửa mới                                                      |
| `packages/studio/src/features/library/insert-block.ts`, `library-panel` (tìm nơi render khối)                                  | Chỗ đặt nút tạm, `determineInsertTarget`, chọn phần tử mới như R-LB-15 |
| `packages/studio/src/features/editor/use-runner-status.ts`                                                                     | Địa chỉ dev server để hiện ảnh thu nhỏ                                 |

## 3. Hợp đồng

### 3.1. Shared (`source.ts`, `project.ts`)

```ts
export const ImageSourceSchema = z.discriminatedUnion('kind', [
  // Ảnh có sẵn: đường dẫn dưới public/, viết như URL, ví dụ '/images/logo.png'
  z.strictObject({ kind: z.literal('existing'), src: z.string().min(2).max(512).startsWith('/') }),
  // Ảnh tải lên: tên gốc (chỉ để đặt tên) + nội dung base64 (≤ 5 MB sau giải mã)
  z.strictObject({
    kind: z.literal('upload'),
    name: z.string().min(1).max(200),
    dataBase64: z.string().min(1).max(7_000_000),
  }),
]);

export const InsertImageEditSchema = z.strictObject({
  kind: z.literal('insertImage'),
  target: InsertTargetSchema,
  image: ImageSourceSchema,
  alt: z.string().trim().min(1).max(200),
  className: z.string().max(500),
  placement: PlacementSchema.optional(),
  tailwindMajor: z.union([z.literal(3), z.literal(4)]).optional(),
});
```

- Thêm `InsertImageEditSchema` vào `StructureEditSchema` và `AnyEditSchema`.
- `project.ts`: `ProjectAssetsSchema = z.strictObject({ files: z.array(RelPathSchema).max(500) })`.

Export qua `index.ts`.

### 3.2. Server: file nhị phân

- **`FileSystemPort`** thêm hai hàm:
  - `readBytes(root, path, options?): Promise<Result<Uint8Array>>`;
  - `writeBytesAtomic(root, path, bytes: Uint8Array): Promise<Result<void>>`.

  Kiểm đường dẫn y như `readText`/`writeTextAtomic` (S-20 đến S-24, từ chối symlink). Cài đặt cho **mọi** chỗ cài cổng: node adapter, file system giả trong test (`tsc` sẽ chỉ ra).

- **`HistoryFile`** thêm `encoding?: 'base64'`. Khi có:
  - `before`/`after` là base64 của byte;
  - hash = SHA-256 của **byte** (không phải của chuỗi base64);
  - Undo/Redo ghi bằng `writeBytesAtomic` (giải mã base64), kiểm hash bằng `readBytes`.

  File chữ (không có `encoding`) giữ nguyên hành vi.

### 3.3. Server: `core/project/images.ts` (mới, hàm thuần + hàm dùng cổng file)

```ts
export type ImageKind = 'png' | 'jpg' | 'webp' | 'gif' | 'svg';
/** Loại ảnh theo byte đầu (không tin đuôi file); không nhận ra → undefined. */
export function detectImageKind(bytes: Uint8Array): ImageKind | undefined;
/** SVG có <script, thuộc tính on…=, hoặc href/xlink:href javascript: → true. */
export function isUnsafeSvg(text: string): boolean;
/** 'Ảnh Đẹp_01.PNG' → 'anh-dep-01'; rỗng → 'image'; tối đa 60 ký tự. */
export function imageBaseName(original: string): string;
/** public/images/<base>.<ext>, trùng thì <base>-2, -3… (kiểm bằng fs.exists). */
export async function uniqueImagePath(
  fs: FileSystemPort,
  root: string,
  base: string,
  kind: ImageKind,
): Promise<string>;
/** Ảnh trong public/ (đệ quy, bỏ node_modules và thư mục ẩn), đuôi png/jpg/jpeg/webp/gif/svg, tối đa 500, sắp theo tên. */
export async function listPublicImages(
  fs: FileSystemPort,
  root: string,
): Promise<Result<readonly string[]>>;
```

**Byte đầu:**

| Loại | Byte đầu                                                                                  |
| ---- | ----------------------------------------------------------------------------------------- |
| PNG  | `89 50 4E 47 0D 0A 1A 0A`                                                                 |
| JPEG | `FF D8 FF`                                                                                |
| GIF  | `GIF87a` hoặc `GIF89a`                                                                    |
| WebP | `RIFF` ở 0–3 và `WEBP` ở 8–11                                                             |
| SVG  | giải mã UTF-8, bỏ BOM và khoảng trắng đầu; bắt đầu bằng `<?xml` hoặc `<svg`, và có `<svg` |

**Tên file:**

- bỏ đuôi;
- chữ thường, bỏ dấu (`normalize('NFD')` + bỏ dấu kết hợp, `đ` → `d`);
- mọi ký tự ngoài `[a-z0-9]` thành `-`;
- gộp các `-` liền nhau, bỏ `-` đầu và cuối.

### 3.4. Server: thực thi `insertImage`

Thêm vào `executeStructureEdit` (hoặc một hàm riêng `executeInsertImage` mà nó gọi), theo thứ tự:

1. **Ảnh có sẵn:** `src` phải dạng `/…`. Đường dẫn file = `public` + `src`. Phải tồn tại, đúng một trong 6 đuôi, qua kiểm đường dẫn → sai: E016 `imageNotFound` (ngoài phạm vi: E012).
2. **Ảnh tải lên:**
   - giải mã base64 (sai: E016 `invalidImage`);
   - > 5 MB (5 × 1024 × 1024 byte): E016 `tooLarge`;
   - `detectImageKind` không nhận ra: E016 `unsupportedImage`;
   - SVG không an toàn: E016 `unsafeSvg`;
   - tính `uniqueImagePath`, `src = '/images/<tên>.<đuôi>'`.
3. Dựng JSX: `<img src="<src>" alt="<alt>" className="<className>" />`. `className` rỗng thì bỏ thuộc tính. Thoát `alt` cho thuộc tính chuỗi JSX: `&` → `&amp;`, `"` → `&quot;`, `<` → `&lt;`, `>` → `&gt;`.
4. Chạy y như `insert` hiện có (cùng `target`, `placement`, `tailwindMajor`) để có `TextEdit` và `locs`.
5. **Ghi:** ảnh tải lên ghi **trước** bằng `writeBytesAtomic`; rồi ghi file mã. Ghi file mã lỗi → xóa ảnh vừa ghi rồi trả lỗi (không để rác).
6. **Một mục lịch sử:** `onWritten` nhận cả file mã và file ảnh `{ path, after: base64, afterHash, encoding: 'base64' }` (không có `before` = file được tạo, R-HI-11).
   - Nhãn lịch sử: `history:insertImage` với `{ name }` = tên file ảnh (thêm khóa i18n ở Studio, `vi`/`en`).
   - Phải ghi nhận ảnh là "do Studio ghi" như các file khác (cùng cơ chế `recordInternalWrite` mà route đang dùng), để watcher không báo "file đổi từ ngoài".

### 3.5. Server: route

- `GET /project/assets` → `ProjectAssets` (`listPublicImages`).
- `insertImage` đi qua `POST /source/edits` sẵn có. Route này đã kiểm `jsx` bằng `validateInsertedJsx` cho `insert`: `insertImage` không có `jsx` từ client nên bỏ qua bước đó.
- Ghi `spec-log.md` (#31): spec có `POST /project/assets` riêng, nhưng ảnh tải lên đi kèm `insertImage` để ảnh và lệnh chèn là **một** mục lịch sử (R-DT-14); `GET /project/assets` giữ đúng spec.

### 3.6. Studio

- `api/assets-client.ts`: `fetchAssets(): Promise<ProjectAssets>`; `insertImage(edit)` dùng `applyStructureEdit`.
- `features/draw/image-picker-dialog.tsx` — `ImagePickerDialog({ open, onClose, onPick })`:
  - `onPick(choice: { image: ImageSource; alt: string })`.
  - Lưới ảnh `data-testid="image-picker-item"` (`data-src`). Ảnh thu nhỏ lấy từ địa chỉ dev server đang chạy + `src`; runner chưa chạy thì chỉ hiện tên file.
  - Nút `image-picker-upload` mở `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml">`. Đọc file thành base64 bằng `FileReader` (bỏ tiền tố `data:…;base64,`). File > 5 MB: báo lỗi ngay `image-picker-error`, không gửi.
  - Ô alt `image-picker-alt`, gợi ý từ tên file: bỏ đuôi, `-`/`_` → khoảng trắng, viết hoa chữ đầu. Ô rỗng thì nút **Chèn** (`image-picker-insert`) bị tắt.
  - Esc hoặc **Hủy** đóng hộp, không gửi gì.
  - Dùng cùng kiểu hộp thoại có sẵn của Studio (tìm hộp thoại Pages/Drafts để theo mẫu), không thêm thư viện.
- `features/draw/insert-image.ts`:
  - `insertImageAt(target, choice, opts?: { className?: string; placement?: Placement })`;
  - `className` mặc định `w-full h-auto`;
  - gọi `applyStructureEdit({ kind: 'insertImage', … , tailwindMajor: placementTailwindMajor(placement) })`;
  - thành công thì chọn phần tử mới như `insert-block.ts`;
  - lỗi thì hiện bằng cơ chế lỗi của Library (`toErrorInfo`).
- Nút tạm **Ảnh…** trong Library: mở hộp, chèn theo `determineInsertTarget` của phần tử đang chọn (không chọn gì thì nút tắt).
- i18n `vi`/`en`:
  - `imagePicker.*`: tiêu đề, tải lên, alt, gợi ý alt, chèn, hủy, lỗi quá 5 MB, chưa có ảnh;
  - `library.insertImage`;
  - `history:insertImage`;
  - các lý do E016 mới: `imageNotFound`, `invalidImage`, `tooLarge` (nếu chưa có), `unsupportedImage`, `unsafeSvg`, trong bản dịch lỗi.

## 4. Tình huống test

| #   | Đầu vào                                                                                                                                      | Kết quả                                                                                                                                                           | Mã               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `detectImageKind`: 8 byte PNG; `FF D8 FF E0`; `GIF89a`; `RIFF????WEBP`; `"﻿  <svg …>"`; `<html>`                                             | png, jpg, gif, webp, svg, undefined                                                                                                                               | R-DT-13          |
| 2   | `isUnsafeSvg`: `<svg><script>`; `<svg onload="x">`; `<a href="javascript:x">`; `<a xlink:href=' JavaScript:x'>`; `<svg><path d="M0"/></svg>` | true, true, true, true, false                                                                                                                                     | R-DT-13          |
| 3   | `imageBaseName`: `Ảnh Đẹp_01.PNG`; `..png`; `___`; tên 100 ký tự `a`                                                                         | `anh-dep-01`; `image`; `image`; 60 ký tự `a`                                                                                                                      | R-DT-13          |
| 4   | `uniqueImagePath` khi đã có `public/images/logo.png` và `logo-2.png`                                                                         | `public/images/logo-3.png`                                                                                                                                        | R-DT-13          |
| 5   | `listPublicImages`: `public/a.png`, `public/images/b.svg`, `public/x.txt`, `public/.hidden/c.png`, `public/node_modules/d.png`               | `['public/a.png', 'public/images/b.svg']`                                                                                                                         | R-DT-13          |
| 6   | `insertImage` upload PNG `Logo Mới.png`, alt `Logo "mới"`, target child end của `<section>`                                                  | file `public/images/logo-moi.png` đúng byte; trang có `<img src="/images/logo-moi.png" alt="Logo &quot;mới&quot;" className="w-full h-auto" />`; `locs` trỏ `img` | R-DT-13          |
| 7   | Như #6 rồi Undo; rồi Redo                                                                                                                    | Undo: trang về đúng byte cũ, file ảnh **không còn**; Redo: file ảnh có lại **đúng từng byte**, trang có `<img>`                                                   | R-DT-14, R-HI-11 |
| 8   | Upload 5 MB + 1 byte; byte ngẫu nhiên đặt tên `.png`; SVG có `onload`                                                                        | E016 `tooLarge`; E016 `unsupportedImage`; E016 `unsafeSvg`; không file nào được ghi                                                                               | R-DT-13          |
| 9   | `existing` `/images/b.svg` (có); `/images/khong-co.png`; `/../secret.png`                                                                    | `<img src="/images/b.svg" …>`; E016 `imageNotFound`; E012 hoặc E016 (không ghi gì)                                                                                | R-DT-13          |
| 10  | `insertImage` mà ghi file mã thất bại (fs giả trả lỗi khi ghi file `.tsx`)                                                                   | trả lỗi, file ảnh đã bị xóa, lịch sử không thêm mục                                                                                                               | R-DT-14          |
| 11  | `HistoryService` với file `encoding: 'base64'` bị sửa ngoài sau khi tạo; rồi Undo                                                            | Undo bị chặn như file chữ (R-HI-04)                                                                                                                               | R-HI-11          |
| 12  | Route `GET /project/assets`                                                                                                                  | 200, `files` đúng như #5                                                                                                                                          | R-DT-13          |
| 13  | `ImagePickerDialog`: hiện 2 ảnh từ `fetchAssets` giả; bấm ảnh `b.svg`                                                                        | alt gợi ý `B`; bấm Chèn → `onPick({ image: { kind: 'existing', src: '/images/b.svg' }, alt: 'B' })`                                                               | R-DT-13          |
| 14  | Chọn file 6 MB qua input; chọn file `anh-san-pham.png` nhỏ; xóa trống alt                                                                    | `image-picker-error`, không `onPick`; alt gợi ý `Anh san pham`; nút Chèn tắt khi alt rỗng                                                                         | R-DT-13          |
| 15  | `insertImageAt` thành công                                                                                                                   | `applyStructureEdit` một lần với `kind: 'insertImage'`, `className: 'w-full h-auto'`; phần tử mới được chọn                                                       | R-DT-14          |

Test ghi nhiều lần trên đĩa dùng `directWriteFs` hoặc thư mục tạm (README); **không nâng timeout**. Byte ảnh PNG cho test: 8 byte chữ ký + vài byte bất kỳ là đủ.

## 5. Kiểm tay (chủ dự án)

1. Chọn một section, bấm **Ảnh…** trong Library: thấy ảnh có sẵn trong `public/` (dự án mẫu có thể chưa có, thì thấy "Chưa có ảnh").
2. **Tải ảnh từ máy** một ảnh PNG tên có dấu, sửa alt, bấm Chèn: ảnh hiện trên Canvas; `public/images/` có file tên không dấu.
3. Ctrl+Z: ảnh biến mất khỏi Canvas **và** file trong `public/images/` bị xóa. Ctrl+Y: có lại.
4. Đổi đuôi một file `.txt` thành `.png` rồi tải lên: báo "không phải ảnh hợp lệ", không có file mới.
5. Mở lại hộp: ảnh vừa tải có trong lưới.

## 6. Bẫy đã biết

- **Không sửa Bridge.**
- **Hash file nhị phân tính trên byte**, không trên chuỗi base64; nếu không Undo sẽ báo "file đã đổi".
- **Không đọc ảnh bằng `readText`** (hỏng byte, BOM).
- **Thoát `alt`** trước khi dựng JSX; alt có `"` không được làm hỏng file.
- **Giới hạn body HTTP**: kiểm route `/source/edits` có giới hạn kích thước body không. Ảnh 5 MB thành base64 khoảng 6,7 MB, nên phải nới đúng route này (không nới toàn bộ server). Ghi rõ trong báo cáo.
- **Rác khi lỗi**: mọi nhánh lỗi sau khi đã ghi ảnh phải xóa ảnh.
- Studio: không tự gọi `fetch` thô; dùng `apiGet`/`applyStructureEdit` có sẵn.
- **Viết đúng lint ngay từ đầu**, `pnpm exec eslint <file>` sau mỗi file. File ≤ 400 dòng, hàm ≤ 50 dòng.

## 7. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ:

- các hàm mới của `FileSystemPort`;
- mọi chỗ cài đặt cổng đã sửa;
- giới hạn body đã đổi;
- dòng spec-log #31.

Không chạy `pnpm test:e2e`.

```text
feat(server): upload images and insert them in one undo step
```
