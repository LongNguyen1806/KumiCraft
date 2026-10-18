# Phase 2 — Lượt 4: Library và phím tắt (WP-2.03 + WP-2.06)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Lượt 2–3 đã có các thao tác cấu trúc ở server (`insert`, `remove`, `duplicate`, `move`, `wrap`, `unwrap`) và các nút trong Inspector.

## 1. Mục tiêu (người dùng thấy gì)

1. **Panel trái có thêm thẻ Thư viện** cạnh thẻ Lớp.
   - Ô tìm kiếm, 16 khối chia theo nhóm, mỗi khối có icon và tên.
   - Chọn một phần tử trên Canvas rồi bấm khối: khối được chèn **sau** phần tử đó. Nếu phần tử là thẻ chứa (`div`, `section`…) thì chèn **vào cuối** nó. Khối mới được chọn ngay.
   - Không chọn gì thì các khối bị khóa, kèm dòng gợi ý.
2. **Phím tắt**, kể cả khi đang bấm trong Canvas:

   | Phím              | Việc               |
   | ----------------- | ------------------ |
   | Delete            | Xóa                |
   | Ctrl+D            | Nhân bản           |
   | Ctrl+G            | Bọc cột            |
   | Ctrl+Shift+G      | Bỏ bọc             |
   | Ctrl+↑ / Ctrl+↓   | Lên / Xuống        |
   | Esc               | Chọn cha           |
   | Ctrl+= / Ctrl+-   | Phóng to / Thu nhỏ |
   | Shift+0 / Shift+1 | 100% / Vừa khung   |
   | Alt+P             | Xem thử            |
   | Alt+E             | Mở trong editor    |
   | 1…8               | Chuyển khung       |
   | Ctrl+/            | Bảng phím tắt      |
   - Undo/Redo bấm trong Canvas **hoạt động**. Hiện tại bị hỏng, xem mục 4.1.
   - macOS dùng Cmd thay Ctrl.

3. Gõ trong ô nhập của Studio thì phím tắt không chạy, trừ Alt+P và Ctrl+/ (R-KB-10).

Không làm ở lượt này: sao chép, cắt, dán (lượt 7); Enter, Tab chọn con và anh em (lượt 7); kéo khối vào Canvas (lượt 6).

## 2. Đọc trước (CW-52)

| File                                                                                                                                        | Lý do                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `docs/spec.md` mục 15 (M-LB), mục 19 (M-KB), R-BR-18                                                                                        | Quy tắc                               |
| `packages/studio/src/features/editor/use-editor-shortcuts.ts`, `editor-shell.tsx`                                                           | Phím tắt hiện có                      |
| `packages/studio/src/features/selection/bridge-channel.ts` (`handleBridgeShortcut`)                                                         | Nhận phím từ iframe                   |
| `packages/bridge/src/client/bridge-client-runtime.ts` (`handleKeyDown`)                                                                     | Bridge gửi phím                       |
| `packages/studio/src/features/inspector/components/use-structure-actions.ts`, `structure-actions.tsx`, `features/inspector/sibling-move.ts` | Logic thao tác cấu trúc sẽ dùng chung |
| `packages/studio/src/features/editor/side-panels.tsx`                                                                                       | Thêm thẻ Thư viện                     |
| `packages/studio/src/features/editor/canvas-area.tsx`, `canvas-zoom.tsx`                                                                    | Zoom, khung, chế độ Xem thử           |
| `packages/server/src/core/source-editor/structure/structure-ops.ts` (`validateInsertedJsx`)                                                 | Kiểm khối parse được                  |
| `scripts/check-i18n.mjs`                                                                                                                    | Cách kiểm i18n theo namespace         |

## 3. Hợp đồng

### 3.1. Bảng phím dùng chung: `packages/shared/src/shortcuts.ts` (export qua `index.ts`)

```ts
export const SHORTCUT_ACTIONS = [
  'undo',
  'redo',
  'duplicate',
  'remove',
  'wrap',
  'unwrap',
  'moveUp',
  'moveDown',
  'selectParent',
  'zoomIn',
  'zoomOut',
  'zoomReset',
  'zoomFit',
  'togglePreview',
  'openInEditor',
  'frame1',
  'frame2',
  'frame3',
  'frame4',
  'frame5',
  'frame6',
  'frame7',
  'frame8',
  'togglePanels',
  'showShortcuts',
] as const;
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];
export type KeyPress = { key: string; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean };

/** R-KB-12: the one table. `apple`: Cmd is Mod, Ctrl+Y is not Redo (R-KB-13). */
export function matchShortcut(press: KeyPress, apple: boolean): ShortcutAction | undefined;
/** R-KB-10: keys that still run while typing in a Studio field. */
export const WORKS_WHILE_TYPING: readonly ShortcutAction[] = ['togglePreview', 'showShortcuts'];
/** Label of the keys for the help dialog: `⌘⇧Z` on macOS, `Ctrl+Shift+Z` elsewhere. */
export function shortcutLabel(action: ShortcutAction, apple: boolean): string;
```

- Bảng theo spec mục 19, bỏ các phím của lượt 7.
- `Mod` = `meta` khi `apple`, `ctrl` khi không. Có Mod thì phím **không** được kèm modifier còn lại (Cmd+Ctrl+Z không khớp).
- Phím chữ so không phân biệt hoa thường.
- `Shift+0` và `Shift+1`: so theo `event.code` là không cần. Dùng `key` `')'`/`'0'` và `'!'`/`'1'` cùng `shift: true`, vì `key` đổi theo bố cục bàn phím US.
- Số `1`…`8`, `Delete`, `Backspace`, `Escape`: **không** kèm modifier nào.
- `Ctrl+=`: chấp nhận `key` là `=` hoặc `+`.

### 3.2. Bridge (`bridge-client-runtime.ts`)

`handleKeyDown`:

- Gọi `matchShortcut` với `isMac` hiện có. Có action thì `preventDefault` và gửi `shortcut` với **`key: event.key` nguyên văn** cùng các cờ modifier. Không gửi `'Undo'`/`'Redo'` nữa.
- Giữ điều kiện: chỉ chế độ `design`, không khi đang sửa chữ.
- Không chặn phím khi `event.target` là ô nhập của trang. Dùng cách kiểm như `isTypingTarget` của Studio, viết lại trong Bridge, không import code Studio.
- Sau khi sửa phải chạy `pnpm --filter @reactcraft/bridge build`.

### 3.3. Studio

- `features/shortcuts/` (thư mục mới, R-KB-12):
  - `use-shortcuts.ts`: hook duy nhất nghe `keydown` của cửa sổ Studio và nhận phím từ Bridge, rồi chạy action qua `runShortcut(action)`. Thay `use-editor-shortcuts.ts` (xóa file cũ, chuyển `isTypingTarget` sang đây). `bridge-channel.ts` gọi cùng `runShortcut`.
  - `shortcut-actions.ts`: map `ShortcutAction` → hàm. Lấy trạng thái từ store, không qua prop.
    - **Cấu trúc:** dùng chung hàm với Inspector (mục 3.4).
    - **`selectParent`:** chọn nút cha trong `treeNodes` có `loc` (bỏ qua nếu không có).
    - **Zoom, khung, Xem thử:** đưa `zoom`, `activeFrameId`, `mode` của `canvas-area.tsx` vào store mới `features/editor/canvas-view-store.ts` (zustand) để phím tắt điều khiển được. Nút trên thanh Canvas dùng cùng store.
    - **Bước zoom:** theo `STEPS` của `canvas-zoom.tsx`. `zoomIn` từ `'fit'` lên bước lớn hơn mức đang hiển thị.
    - **`openInEditor`:** như nút mở editor hiện có.
  - `shortcut-help.tsx`: hộp thoại liệt kê phím (nhóm, tên qua i18n, `shortcutLabel`), `data-testid="shortcut-help"`, đóng bằng Esc hoặc nút.
- **Phần tử nào nhận thao tác:** `selectedRefs` có đúng 1 phần tử. Chọn nhiều hoặc không chọn gì thì phím cấu trúc không làm gì.

### 3.4. Logic thao tác cấu trúc dùng chung

- Chuyển phần gọi API và xử lý kết quả trong `use-structure-actions.ts` sang `features/structure/structure-commands.ts`:
  - hàm `async`, không hook;
  - nhận `{ ref, tag }`, tự đọc `treeNodes` từ store cho Lên/Xuống;
  - sau khi xong thì cập nhật chọn như hiện tại.
- Lỗi đưa vào `features/structure/structure-error-store.ts` (zustand: `error?: { targetKey, info }`). `StructureActions` hiển thị lỗi từ store này, nên lỗi do phím tắt cũng hiện ở Inspector.
- Hook `use-structure-actions.ts` chỉ còn là lớp mỏng gọi các hàm này. Test cũ của `structure-actions.test.tsx` phải xanh, chỉ sửa phần import nếu bắt buộc.
- `tag` lấy theo thứ tự: `ElementSource.tag` đang hiển thị (nếu đúng phần tử), không có thì `TreeNode.tag`.

### 3.5. Library

- `packages/shared/src/library/blocks.ts`: `LIBRARY_BLOCKS: readonly LibraryBlock[]` đúng kiểu ở spec mục 15, 16 khối của R-LB-10, nhóm theo `category`.
  - `id` dạng `layout.row`, `content.heading`…
  - `labelKey` thuộc namespace mới `library` (`library:blocks.row`).
- `packages/shared/src/library/search.ts`: `searchBlocks(query, labels)`.
  - Chuẩn hóa: chữ thường; NFD rồi bỏ dấu `̀-ͯ`; `đ` → `d`.
  - Khớp khi chuỗi tìm (đã chuẩn hóa) nằm trong nhãn `vi`, nhãn `en`, hoặc một từ khóa `vi`/`en` (đã chuẩn hóa).
  - `labels` là hàm lấy nhãn theo ngôn ngữ, Studio truyền vào.
- **Nội dung khối (R-LB-11, R-LB-12):**
  - chỉ thẻ HTML viết thường;
  - class Tailwind v4 chuẩn (không `brand`, `card`…);
  - không `{`, không `import`, không địa chỉ mạng.
  - **Ảnh:** `src="data:image/svg+xml,…"` (SVG xám, đã mã hóa URI) và `alt`.
  - **Chữ mẫu:** có bản `vi` và `en`.
  - **Định dạng:** thụt 2 dấu cách, mỗi khối là **một** phần tử gốc.
- `packages/studio/src/features/library/`:
  - `library-panel.tsx` (`data-testid="library-panel"`): ô tìm (`library-search`), nhóm, nút khối (`library-block-<id>`), gợi ý khi chưa chọn (`library-hint`).
  - `library-icons.ts`: map tên → component `lucide-react` **viết tường minh** (không import động cả bộ icon).
  - `insert-block.ts`: chọn đích theo R-LB-14 rồi gọi `applyStructureEdit` `insert`.
    - **Thẻ chứa:** `div section main header footer nav aside article form fieldset ul ol` thì dùng `{ kind: 'child', parent, where: 'end' }`, còn lại `{ kind: 'sibling', ref, where: 'after' }`.
    - `jsx` theo `i18n.language` (`vi` hoặc `en`).
    - Thành công: chọn `locs[0]`. Lỗi: hiện trong panel (`role="alert"`, qua `errorText`).
- `side-panels.tsx`: `LeftPanel` có 2 thẻ **Lớp** và **Thư viện**, bấm để chuyển. Thẻ đang mở nhớ trong `localStorage` qua `try/catch`.
- i18n:
  - namespace mới `library` (`vi`/`en`): tên nhóm, tên 16 khối, `search`, `hint`.
  - `common`: `editor.library`, tên các phím trong `shortcuts.*`, tiêu đề hộp thoại.
  - Đăng ký namespace như các namespace hiện có. `pnpm check:i18n` phải xanh.

## 4. Lưu ý kỹ thuật

### 4.1. Lỗi cũ phải sửa

- Bridge đang gửi `key: 'Undo'`. Studio gọi `shortcutFor` với `key` đó nên luôn trả `undefined`: **Ctrl+Z trong Canvas hiện không làm gì**.
- Sửa bằng bảng chung (3.1) và gửi `event.key` nguyên văn (3.2).
- Có test tái hiện: phím Ctrl+Z từ Bridge gọi `undo` của history store.

### 4.2. Phím trùng của trình duyệt

- `Ctrl+D`: trình duyệt dùng để đánh dấu trang. `Ctrl+G`: tìm tiếp. `Ctrl+=`/`Ctrl+-`: zoom cả trang.
- Ở Studio phải `preventDefault` khi đã khớp action **và** action đang làm được. Không chọn phần tử thì `Ctrl+D` để trình duyệt xử lý.
- `runShortcut` trả `boolean` "đã xử lý" để quyết định có `preventDefault` hay không.
- Trong iframe, Bridge luôn `preventDefault` khi khớp bảng, vì trang dự án ở chế độ Thiết kế không cần các phím này.

### 4.3. Delete và Backspace

Chỉ xóa phần tử khi tiêu điểm **không** ở ô nhập (R-KB-10). Backspace trong ô tìm Library phải xóa chữ, không xóa phần tử.

## 5. Tình huống test

| #   | Đầu vào                                                                                                                                                                                 | Kết quả                                                                   | Mã                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------- |
| 1   | `matchShortcut`: Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y (Windows); Cmd+Z, Cmd+Shift+Z, Cmd+Y (mac)                                                                                                | undo, redo, redo; undo, redo, **undefined**                               | R-KB-12, R-KB-13          |
| 2   | Ctrl+D, Delete, Backspace, Ctrl+G, Ctrl+Shift+G, Ctrl+↑, Escape, `3`, Shift+1 (`!`), Ctrl+`+`, Alt+P, Ctrl+/                                                                            | Đúng action; Ctrl+Alt+D và Cmd+Ctrl+Z không khớp                          | R-KB-12                   |
| 3   | `shortcutLabel('redo', true)` / `(…, false)`                                                                                                                                            | `⌘⇧Z` / `Ctrl+Shift+Z`                                                    | R-KB-12                   |
| 4   | Studio: Delete khi tiêu điểm ở ô tìm Library; Alt+P khi ở ô nhập                                                                                                                        | Không xóa; Alt+P vẫn chuyển Xem thử                                       | R-KB-10                   |
| 5   | Studio: Ctrl+D khi không chọn gì                                                                                                                                                        | Không gọi API, **không** `preventDefault`                                 | R-KB-12                   |
| 6   | Bridge: Ctrl+Z ở chế độ design                                                                                                                                                          | Gửi `shortcut` với `key: 'z'`, `ctrl: true`; Studio gọi `undo`            | R-BR-18, R-KB-11          |
| 7   | Bridge: phím khi đang sửa chữ; khi chế độ preview; Delete khi tiêu điểm ở `input` của trang                                                                                             | Không gửi, không `preventDefault`                                         | R-BR-18, R-KB-10          |
| 8   | Phím `Ctrl+↑` với phần tử có anh em trước cùng file                                                                                                                                     | Gọi `move` đúng đích (dùng `siblingMoveTarget`)                           | R-KB-12                   |
| 9   | Esc với phần tử có cha trong `treeNodes`                                                                                                                                                | `selectedRefs` thành cha                                                  | R-KB-12                   |
| 10  | `Ctrl+=` khi zoom `'fit'` đang hiển thị 0.8; `Shift+0`; `3`                                                                                                                             | Zoom 1; zoom 1; khung thứ 3                                               | R-KB-12                   |
| 11  | Mỗi khối `LIBRARY_BLOCKS` (cả `vi` và `en`): parse bằng `validateInsertedJsx` (test ở server); không có thẻ viết hoa, `{`, `http`; `img` có `alt` và `src` bắt đầu `data:image/svg+xml` | Đúng cho cả 16 × 2                                                        | R-LB-10, R-LB-11, R-LB-12 |
| 12  | Insert mỗi khối vào `templates/.../src/pages/About.tsx` (child end của thẻ gốc) bằng service thật                                                                                       | File parse lại được, Undo-bằng-`remove` theo `locs` trả về đúng từng byte | R-LB-10, R-SE-22          |
| 13  | `searchBlocks`: "nut", "Nút", "button", "BUTTON"                                                                                                                                        | Ra khối Nút; "xyz" ra rỗng                                                | R-LB-13                   |
| 14  | `insert-block`: chọn `section` → `child end`; chọn `p` → `sibling after`; không chọn → không gọi                                                                                        | Đúng                                                                      | R-LB-14                   |
| 15  | `LibraryPanel`: chưa chọn thì khối khóa và có `library-hint`; bấm khối thì gọi insert, thành công thì `selectedRefs` = `locs[0]`                                                        | Đúng                                                                      | R-LB-14, R-LB-15          |
| 16  | `StructureActions` hiện lỗi E023 khi lỗi đến từ phím tắt (qua store)                                                                                                                    | Đúng                                                                      | R-SE-21                   |

Test #12 dùng `directWriteFs` của `core/workspace/test-support.ts`, **không** dùng `nodeFs`. Ghi atomic hàng trăm lần làm nghẽn đĩa và chậm các test khác (bài học lượt 3).

## 6. Kiểm tay (chủ dự án)

Trên dự án mới (Oakline):

1. Panel trái → **Thư viện**: gõ "nut", rồi "button": cả hai ra khối Nút. Xóa chữ bằng Backspace: không phần tử nào bị xóa.
2. Chọn `section` "Featured products", bấm khối **Card**: Card mới nằm cuối section, được chọn; file `Home.tsx` có đúng đoạn JSX thụt lề gọn. Undo.
3. Chọn tiêu đề hero, bấm khối **Đoạn văn**: đoạn văn nằm ngay sau tiêu đề.
4. Bấm vào Canvas, chọn một thẻ sản phẩm: **Ctrl+D** nhân bản, **Delete** xóa bản sao, **Ctrl+Z** trả lại (bấm trong Canvas).
5. **Ctrl+↑** đưa thẻ lên; **Esc** chọn cha; **Ctrl+G** bọc cột; **Ctrl+Shift+G** bỏ bọc.
6. **Ctrl+=**, **Ctrl+-**, **Shift+1**: Canvas phóng to, thu nhỏ, vừa khung. Trang Studio **không** bị trình duyệt phóng to.
7. **Ctrl+/** mở bảng phím tắt; **Alt+P** chuyển Xem thử và ngược lại.
8. Đổi giao diện sang English, chèn khối **Hero**: chữ mẫu tiếng Anh.

Trên WorkTracker:

9. Chèn khối **Ô nhập** vào form đăng nhập, Undo: `git diff` rỗng.

## 7. Bẫy đã biết

- **Không nâng thời gian chờ của test để test qua** (`testTimeout`, tham số thứ 3 của `it`). Test chậm thì tìm nguyên nhân: ghi atomic quá nhiều, tạo dự án lặp lại… Lượt 3 đã phải sửa đúng lỗi này.
- **`event.key` trong iframe:** phần tử lấy từ iframe khác "vũ trụ" JavaScript. Không dùng `instanceof HTMLInputElement`; kiểm bằng `tagName`/`isContentEditable` như `isTypingTarget`.
- **`key` khi giữ Shift:** Shift+1 cho `key === '!'` trên bố cục US. Bảng phải chấp nhận cả `'!'` và `'1'` cùng `shift: true`.
- **React Compiler:** store zustand đọc bằng selector, không đọc `getState()` trong render.
- **Bundle Studio:** chỉ import icon lucide đang dùng (tree-shaking). Không `import * as icons`.
- **Giữ file ≤ 400 dòng, hàm ≤ 50 dòng.** `canvas-area.tsx` đang 375 dòng: tách phần store/thanh công cụ ra file khác nếu cần.
- **Không đổi hành vi lượt 2–3.** Toàn bộ test cũ xanh.

## 8. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ:

- danh sách phím đã nối;
- 16 khối kèm `id`;
- kết quả kiểm tay bước 4 và 6.

Không chạy `pnpm test:e2e`.

```text
feat(studio): add the block library and editor shortcuts
```
