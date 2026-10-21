# Phase 3 — Lượt 3: Ảnh chụp lượt AI, danh sách file đổi, diff, hoàn tác (WP-3.04)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Kế hoạch phase: `p3-ke-hoach.md`. Quy tắc: spec ADR-BE-33 (đoạn "Trước lượt… Sau lượt…"), ADR-BE-17, mục 23 (R-AG-12 phần so hash, R-AG-15), SPEC-05 S-31, S-113, SRS NFR-09.

Lượt này **chỉ làm server**, chưa nối với agent (lượt 4 ghép), chưa có route REST (lượt 4), chưa có giao diện (lượt 6). Không sửa Studio, Bridge, `e2e/`, `docs/spec.md`, `packages/shared/src/agent.ts`.

**Quyết định chủ dự án 2026-10-21:** ảnh chụp lưu **theo nội dung** (giống git): mỗi nội dung file lưu **một lần** theo `sha256`; mỗi lượt chỉ lưu danh sách `đường dẫn → sha256`. File không đổi giữa các lượt không tốn thêm ổ đĩa.

## 1. Mục tiêu (người dùng thấy gì — qua lượt 4 và 6)

1. Trước mỗi lượt AI, ReactCraft chụp lại dự án frontend. Bỏ qua `node_modules`, `.git`, thư mục build, `.reactcraft`, file theo `.gitignore` gốc, file bí mật.
2. Dự án (phần cần chụp) lớn hơn 200 MB thì lượt AI không chạy và báo lý do.
3. Sau lượt: biết chính xác file nào **sửa**, **tạo mới**, **bị xóa**.
4. Xem **diff** từng file (dòng cũ, dòng mới, 3 dòng ngữ cảnh).
5. **Hoàn tác cả lượt**: mọi file về đúng từng byte như trước lượt. Nếu người dùng đã sửa thêm một file trong lượt đó thì từ chối (E017) và **không file nào** đổi.
6. Giữ 20 lượt gần nhất. Nội dung không còn lượt nào dùng thì bị xóa.

## 2. Đọc trước (CW-52)

| File                                                       | Lý do                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `docs/spec.md` ADR-BE-33, ADR-BE-17, mục 23, SPEC-05 S-113 | Quy tắc gốc                                                                       |
| `packages/server/src/core/mirror/mirror-scan.ts`           | Cách duyệt thư mục, `loadRootIgnore`, `isBinaryFile`: **dùng lại**, không chép mã |
| `packages/server/src/core/mirror/mirror-manifest.ts`       | Cách đọc/ghi manifest bằng schema Zod, `computeSha256`                            |
| `packages/server/src/core/shared/secret-paths.ts`          | `isSecretPath` (S-30, S-31)                                                       |
| `packages/server/src/core/ports/file-system-port.ts`       | `readBytes`, `writeBytesAtomic`, `stat`, `readDir`, `remove`, `exists`            |
| `packages/server/src/core/shared/result.ts`                | `ok`, `err`, kiểu `params`                                                        |
| `packages/shared/src/agent.ts`                             | `TurnFile`, `TURN_FILE_CHANGES` (dùng, không sửa)                                 |
| `packages/server/src/index.ts`, `server-services.ts`       | `ensureMirrorsDir`, `deps.cacheDir`: làm tương tự cho `dataDir`                   |

## 3. Hợp đồng

### 3.1. Thư mục và gói mới

- Mã ở `packages/server/src/core/agent/snapshot/`. Tách file để hàm ≤ 50 dòng, file ≤ 400 dòng. Gợi ý: `snapshot-scan.ts`, `snapshot-objects.ts`, `snapshot-manifest.ts`, `snapshot-store.ts`.
- Thêm dependency `"diff": "9.0.0"` (jsdiff, ADR-BE-17) vào `packages/server/package.json` **và** `packages/cli/package.json` (CLI liệt kê dependency của server, xem lượt 1), rồi `pnpm install`. jsdiff 9 có sẵn kiểu TypeScript; không thêm `@types/diff`.
- `StartServerOptions.deps` thêm `dataDir?: string`, mặc định `envPaths('reactcraft').data`. Tạo `join(dataDir, 'turns')` bằng `mkdir(..., { recursive: true, mode: 0o700 })` giống `ensureMirrorsDir` (S-113). Tạo store trong `server-services.ts` và đưa vào đối tượng services trả về. Chưa có route.

### 3.2. Kiểu và hằng

```ts
export const SNAPSHOT_MAX_BYTES = 200 * 1024 * 1024; // S-113
export const SNAPSHOT_KEEP_TURNS = 20; // S-113
export const SNAPSHOT_DIFF_MAX_BYTES = 1024 * 1024; // larger files: no diff text
export const SNAPSHOT_EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.reactcraft',
] as const;

export type TurnSnapshotStore = {
  /** Before a turn: records every tracked file; E016 projectTooLarge when over the limit. */
  capture(
    projectId: string,
    projectRoot: string,
    turnId: string,
  ): Promise<Result<{ readonly files: number; readonly bytes: number }>>;
  /** After a turn: records the new state and returns what changed, sorted by path (R-AG-12). */
  finish(
    projectId: string,
    projectRoot: string,
    turnId: string,
  ): Promise<Result<readonly TurnFile[]>>;
  /** Unified diff of one changed file, 3 context lines (ADR-BE-17). */
  diff(projectId: string, turnId: string, path: string): Promise<Result<string>>;
  /** R-AG-15: all-or-nothing restore of the files the turn changed. */
  revert(
    projectId: string,
    projectRoot: string,
    turnId: string,
  ): Promise<Result<readonly TurnFile[]>>;
};
export function createTurnSnapshotStore(
  deps: { readonly fs: FileSystemPort; readonly dataDir: string; readonly logger: LoggerPort },
  options?: { readonly maxBytes?: number; readonly keepTurns?: number }, // tests only
): TurnSnapshotStore;
```

`turnId` và `projectId` phải khớp `/^[A-Za-z0-9_-]{1,64}$/`, sai thì E016 `{ reason: 'invalidId' }`, không đụng ổ đĩa. Chặn `../` lọt vào đường dẫn.

### 3.3. Cách lưu (gốc FS là `dataDir`)

| Đường dẫn                                     | Nội dung                                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turns/<projectId>/objects/<sha[0..2]>/<sha>` | Byte gốc của một nội dung file (`writeBytesAtomic`). Đã có thì không ghi lại                                                                                                  |
| `turns/<projectId>/<turnId>.json`             | `{ version: 1, turnId, createdAt, before: Entry[], after?: Entry[], changes?: TurnFile[], reverted: boolean }`, `Entry = { path, sha256, size, mtimeMs }`. Đọc qua schema Zod |

`sha256` tính trên **byte** đọc bằng `readBytes` (giữ BOM, CRLF, file nhị phân), không phải trên chuỗi.

### 3.4. Thuật toán

**Duyệt (`capture` và `finish` dùng chung):** đệ quy bằng `fs.readDir` từ gốc dự án (symlink đã bị bỏ, S-25). Bỏ thư mục trong `SNAPSHOT_EXCLUDED_DIRS` (so tên, mọi độ sâu), bỏ đường dẫn mà `isSecretPath` trả `true` (**không mở**, S-31), bỏ theo `.gitignore` gốc (`loadRootIgnore` của `mirror-scan.ts`). Với mỗi file: `fs.stat`.

**`capture`:**

1. Cộng `size` mọi file. Vượt `maxBytes` → `err({ code: 'E016', params: { reason: 'projectTooLarge', limitBytes } })`, **không ghi gì**.
2. Lấy manifest **mới nhất** của dự án (theo `createdAt`). Với file có cùng `path`, `size`, `mtimeMs` với một entry trong `after` (hoặc `before` nếu chưa có `after`) của manifest đó: dùng lại `sha256`, **không đọc** file.
3. File còn lại: `readBytes`, tính `sha256`, ghi object nếu chưa có.
4. Ghi manifest `{ before, reverted: false }`. Sau đó dọn (mục "Dọn").

**`finish`:** manifest không có → E015 `{ resource: 'turn', id: turnId }`. Duyệt lại, đọc **mọi** file có `size`/`mtimeMs` khác entry `before` cùng `path` (và file mới). Ghi object cho nội dung mới. So `before` với `after` theo `path`:

- có cả hai, `sha256` khác → `modified`;
- chỉ có ở `after` → `created`;
- chỉ có ở `before` → `deleted`.

Ghi `after`, `changes` (sort theo `path`) vào manifest, trả `changes`.

**`diff`:** `path` không nằm trong `changes` → E015 `{ resource: 'file', id: path }`. Nội dung trước, sau lấy từ object (rỗng nếu `created`/`deleted`). Một trong hai > `SNAPSHOT_DIFF_MAX_BYTES` hoặc là nhị phân (`isBinaryFile`) → trả chuỗi `Binary or large file changed: <path>\n`. Còn lại: `createTwoFilesPatch(path, path, before, after, '', '', { context: 3 })` của `diff`, với nội dung giải mã UTF-8.

**`revert`** (R-AG-15, tất cả hoặc không):

1. Manifest không có hoặc chưa `finish` → E015. `reverted: true` → E016 `{ reason: 'alreadyReverted' }`.
2. **Kiểm trước, chưa ghi gì:** với mỗi file trong `changes`:
   - `modified`, `created`: file hiện tại phải tồn tại **và** `sha256` của byte hiện tại bằng `after`;
   - `deleted`: file hiện tại phải **không** tồn tại.

   Sai ở bất kỳ file nào → `err({ code: 'E017', params: { file: path, reason: 'fileChanged' } })`, không file nào đổi.

3. Áp: `modified`, `deleted` → `writeBytesAtomic(projectRoot, path, object trước)`; `created` → `fs.remove`. Lỗi giữa chừng: log `warn` (chỉ mã lỗi), trả lỗi đó (không thể tất cả hoặc không ở mức hệ điều hành; ghi spec-log).
4. Ghi `reverted: true`. Trả `changes`.

**Dọn (sau `capture`):** giữ `keepTurns` manifest mới nhất, xóa manifest cũ hơn. Rồi xóa mọi object không còn manifest nào nhắc tới (duyệt `objects/`).

### 3.5. Spec-log (số tiếp theo sau #41)

- `#42` S-113, ADR-BE-33: ảnh chụp lưu theo nội dung (`sha256`, mỗi nội dung một lần) thay vì chép nguyên dự án mỗi lượt (quyết định chủ dự án 2026-10-21). Ngoài danh sách của spec còn bỏ `.reactcraft/`, `.turbo`, `.cache`, `coverage` và file theo `.gitignore` gốc. File bí mật (S-30) không được chụp nên agent sửa `.env` thì không hoàn tác được.
- `#43` R-AG-15: dự án quá lớn trả E016 `projectTooLarge`; hoàn tác lần hai trả E016 `alreadyReverted`. Lỗi hệ điều hành giữa lúc áp hoàn tác (sau khi đã kiểm xong) có thể để lại một phần file đã khôi phục; trả lỗi và log.

## 4. Tình huống test

Dùng file **thật** trong thư mục tạm (`mkdtemp`, `createNodeFileSystem`), `dataDir` là thư mục tạm riêng. Giả lập "agent" bằng cách tự ghi, sửa, xóa file giữa `capture` và `finish`.

| #   | Tình huống                                                                                                                                                                                                         | Kỳ vọng                                                                                                                                                                                                              | Mã                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Dự án có `src/App.tsx`, `src/main.tsx`, `public/logo.png` (có byte 0), `node_modules/x.js`, `.git/HEAD`, `dist/a.js`, `.reactcraft/workspace.json`, `.env`, `.gitignore` chứa `tmp/` và có `tmp/t.txt`; spy bọc FS | Manifest `before` có đúng `.gitignore`, `public/logo.png`, `src/App.tsx`, `src/main.tsx`; spy không thấy lần đọc/stat nào với `.env`; mỗi nội dung có một object                                                     | [S-113, S-31]     |
| 2   | `capture` lượt A, rồi `capture` lượt B, không đổi gì; spy `readBytes` ở lần B                                                                                                                                      | Số object không tăng; lần B **không** gọi `readBytes`                                                                                                                                                                | [S-113]           |
| 3   | `capture` với `maxBytes` nhỏ hơn tổng                                                                                                                                                                              | E016 `projectTooLarge` kèm `limitBytes`; không có manifest, không có object mới                                                                                                                                      | [S-113]           |
| 4   | Sau `capture`: sửa `src/App.tsx`, sửa `src/main.tsx`, tạo `src/pages/Products.tsx` (thư mục mới), xóa `public/logo.png`; `finish`                                                                                  | `[{ path:'public/logo.png', change:'deleted' }, { path:'src/App.tsx', change:'modified' }, { path:'src/main.tsx', change:'modified' }, { path:'src/pages/Products.tsx', change:'created' }]`                         | [R-AG-12]         |
| 5   | `capture` rồi `finish` không đổi gì                                                                                                                                                                                | `[]`                                                                                                                                                                                                                 | [R-AG-12]         |
| 6   | `diff` sau tình huống 4: `src/App.tsx` (đổi dòng 5 của file 10 dòng); `src/pages/Products.tsx`; `public/logo.png`; `src/Unknown.tsx`                                                                               | App: có `--- src/App.tsx`, `+++ src/App.tsx`, một dòng `-` cũ, một dòng `+` mới, đúng 3 dòng ngữ cảnh mỗi phía; Products: mọi dòng bắt đầu `+`; logo: `Binary or large file changed: public/logo.png`; Unknown: E015 | [S-16]            |
| 7   | `revert` sau tình huống 4. `src/main.tsx` ban đầu có BOM và CRLF                                                                                                                                                   | Trả 4 thay đổi; mọi file **từng byte** bằng ban đầu (so `Buffer`), `src/pages/Products.tsx` không còn, `public/logo.png` có lại đúng byte                                                                            | [R-AG-15, NFR-09] |
| 8   | Sau tình huống 4, người dùng sửa thêm `src/App.tsx`; `revert`                                                                                                                                                      | E017 `{ file: 'src/App.tsx', reason: 'fileChanged' }`; **cả 4** file vẫn ở trạng thái sau lượt (không file nào bị khôi phục)                                                                                         | [R-AG-15]         |
| 9   | Sau tình huống 4: (a) người dùng xóa `src/pages/Products.tsx`; (b) ở dự án khác, người dùng tạo lại `public/logo.png`; `revert` từng trường hợp                                                                    | Cả hai E017 với đúng `file`; không file nào đổi                                                                                                                                                                      | [R-AG-15]         |
| 10  | `revert` hai lần liên tiếp                                                                                                                                                                                         | Lần hai E016 `alreadyReverted`                                                                                                                                                                                       | [R-AG-15]         |
| 11  | `keepTurns: 3`; 5 lượt `capture` + `finish`, mỗi lượt sửa `src/App.tsx` thành nội dung riêng                                                                                                                       | Còn đúng 3 manifest mới nhất; object của nội dung chỉ lượt 1 và 2 dùng đã bị xóa; object dùng chung (`src/main.tsx`) còn                                                                                             | [S-113]           |
| 12  | `finish`, `diff`, `revert` với `turnId` chưa từng `capture`; `capture` với `turnId: '../x'`                                                                                                                        | E015; E016 `invalidId`, không tạo file nào ngoài `dataDir/turns`                                                                                                                                                     |                   |

## 5. Kiểm tay (chủ dự án)

Lượt này chưa có nút trên giao diện. Phần kiểm tay thật nằm ở lượt 4 (chạy lượt với agent) và lượt 6 (nút Hoàn tác, xem diff). Lượt này chỉ cần:

1. `pnpm verify` của Claude xanh.
2. Chạy `reactcraft` bình thường, mở một dự án: Studio, Canvas, Inspector vẫn chạy như trước (lượt này không đổi hành vi nào bạn thấy).

## 6. Bẫy đã biết

1. Hash phải tính trên **byte**, không phải chuỗi đã bỏ BOM. Đọc bằng `readBytes`, ghi bằng `writeBytesAtomic`.
2. `mtimeMs` có thể giống nhau khi test sửa file quá nhanh. Test sửa file phải đổi **cả kích thước** hoặc gọi `utimes` như test lượt 1.
3. Revert: kiểm **mọi** file xong rồi mới ghi file đầu tiên.
4. `revert` không đụng lịch sử Undo; watcher (R-HI-05) tự coi đó là sửa từ bên ngoài.
5. Đường dẫn trong manifest luôn dùng `/`, kể cả trên Windows.
6. Không log đường dẫn file hay nội dung (S-89); chỉ `projectId`, `turnId`, mã lỗi.
7. `diff` 9 là ESM; import `{ createTwoFilesPatch } from 'diff'`. Kiểm `pnpm build` của CLI vẫn chạy (lượt 1 đã gặp chuyện thiếu dependency ở CLI).

## 7. Báo cáo và commit

Báo cáo: file tạo và sửa (kèm số dòng), bảng 12 tình huống → tên test, kết quả `pnpm verify` (số test), chỗ nào làm khác bản này và vì sao.

Commit (đã qua commitlint):

```
feat(server): snapshot agent turns, diff and revert them
```
