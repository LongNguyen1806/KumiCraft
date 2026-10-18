# Phase 2 — Lượt 7: Sao chép, cắt, dán, sửa nhiều phần tử (WP-2.04b)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Đã có sẵn: `GET /source/element-text` (trả `{ jsx, file, imports }`), `insert` có trường `from` để thêm import còn thiếu (R-SE-23), `remove` nhiều phần tử, chọn nhiều trên Canvas (Ctrl/Shift+bấm).

## 1. Mục tiêu (người dùng thấy gì)

1. **Ctrl+C / Ctrl+X / Ctrl+V** (Cmd trên macOS) chạy cả khi tiêu điểm ở Canvas lẫn ở Studio:
   - sao chép phần tử đang chọn (một hoặc nhiều);
   - dán vào cuối phần tử đang chọn nếu nó là khung chứa, ngược lại ngay sau nó; phần vừa dán được chọn;
   - dán sang trang/file khác: câu `import` của component được thêm;
   - đoạn dán có biểu thức `{…}` sang file khác: cảnh báo "Đoạn dán dùng biến của file gốc, có thể cần sửa";
   - dán chữ thường (không phải JSX): báo lỗi, file không đổi;
   - cắt = sao chép + xóa; **Ctrl+Z** một lần trả lại phần đã xóa.
2. **Inspector khi chọn nhiều phần tử** (thay cho dòng "Đã chọn N phần tử"):
   - các nhóm thuộc tính (khoảng cách, kích thước, màu, chữ…) hiện giá trị chung, hoặc **"Hỗn hợp"** nếu khác nhau;
   - đổi một ô thì áp cho **mọi** phần tử, ghi một lần, **một** bước Undo;
   - có phần tử nào `className` không tĩnh (ví dụ `cn(...)`): mọi ô bị khóa, dòng giải thích nêu thẻ và vị trí phần tử đó.
   - Thuộc tính thẻ, nội dung chữ, "Class khác", nút cấu trúc **không** hiện khi chọn nhiều (spec-log #22).

## 2. Đọc trước (CW-52)

| File                                                                                                                                                                 | Lý do                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `docs/spec.md` mục 17 (M-CB), mục 19 (M-KB), R-SE-23; `docs/construction/spec-log.md` #19, #22                                                                       | Quy tắc và chỗ lệch đã chốt                                            |
| `packages/server/src/core/source-editor/source-editor-service.ts`                                                                                                    | `performEditOnFile`, `executeEditMutation`, `readAndResolveTargetNode` |
| `packages/server/src/core/source-editor/structure/structure-runner.ts` (`withFileLocks`, `commitPreparedFiles`)                                                      | Khóa nhiều file theo thứ tự, ghi tất cả hoặc không (rollback)          |
| `packages/server/src/core/source-editor/structure/structure-plan.ts` (~dòng 90–125, chèn) và `imports.ts`                                                            | Chỗ thêm cảnh báo `foreignExpression`                                  |
| `packages/server/src/adapters/http/routes/source.ts`                                                                                                                 | Thêm endpoint batch, mẫu ghi lịch sử một mục                           |
| `packages/shared/src/source.ts`, `shortcuts.ts`                                                                                                                      | Schema batch; thêm phím copy/cut/paste                                 |
| `packages/studio/src/features/structure/structure-commands.ts`, `library/insert-block.ts` (`determineInsertTarget`)                                                  | Dùng lại `runStructureOp`, vị trí chèn                                 |
| `packages/studio/src/features/shortcuts/` (`shortcut-actions.ts`, `use-shortcuts`)                                                                                   | Nối hành động phím                                                     |
| `packages/studio/src/features/inspector/` (`inspector-panel.tsx`, `use-inspector-target.ts`, `use-live-edit.ts`, `components/property-field.tsx`, `color-field.tsx`) | Inspector hiện tại (một phần tử), `readValue`/`writeValue` của shared  |

## 3. Hợp đồng

### 3.1. Shared

```ts
// source.ts — R-CB-15 (spec-log #22: batch chỉ nhận sửa thuộc tính, chưa nhận thao tác cấu trúc)
export const BatchEditRequestSchema = z.strictObject({
  edits: z
    .array(
      z.discriminatedUnion('kind', [
        SetClassNameEditSchema,
        SetAttributeEditSchema,
        SetTextEditSchema,
      ]),
    )
    .min(1)
    .max(50),
  coalesceKey: z.string().max(200).optional(),
});
export const BatchEditResultSchema = z.strictObject({
  changed: z.boolean(),
  files: z.array(RelPathSchema),
});

// shortcuts.ts — R-KB (bảng M-KB): thêm 'copy', 'cut', 'paste' vào SHORTCUT_ACTIONS
// matchModKey: 'c' → copy, 'x' → cut, 'v' → paste (chỉ khi không Shift, không Alt).
// Nhãn: '⌘C' '⌘X' '⌘V' / 'Ctrl+C' 'Ctrl+X' 'Ctrl+V'. Tên i18n cạnh các hành động khác.
```

Dùng đúng tên schema đang có trong `source.ts` cho ba loại sửa (đọc file để lấy tên thật).

### 3.2. Server — sửa nhiều phần tử một lần

**Tách trước, không đổi hành vi:** chuyển `applyClassNameMutation`, `applyAttributeMutation`, `applyTextMutation`, `executeEditMutation` sang `source-editor/edit-mutations.ts`; chuyển `withFileLocks`, `commitPreparedFiles` (và kiểu `PreparedFileWrite`) sang `source-editor/file-commit.ts`, `structure-runner.ts` import lại. Test cũ phải xanh nguyên trạng.

**`source-editor/edit-batch.ts`** (mới):

```ts
export async function executeEditBatch(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
  sourceExtensions: readonly string[],
  edits: readonly AttributeLevelEdit[],
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<BatchEditResult>>;
```

1. `validateLocAndExt` cho từng `edit.loc`; lỗi đầu tiên → trả lỗi đó, không ghi gì.
2. Nhóm theo file; hai sửa cùng `loc` → E016 `{ reason: 'duplicateLoc' }`.
3. `withFileLocks(projectRoot, filesSorted, …)`; trong khóa, **mỗi file đọc một lần**, lấy AST (`getCachedAst`), một `MagicString` cho cả file.
4. Với từng sửa của file: `findNodeAt(ast, line, column)`, kiểm tag như `readAndResolveTargetNode` (sai → E017 `moved`), gọi `executeEditMutation` trên **cùng** `MagicString` (mọi vị trí tính trên code gốc nên thứ tự không quan trọng; thuộc tính của các thẻ mở khác nhau không chồng nhau). Lỗi bất kỳ (E017, E023) → trả lỗi đó, **không ghi file nào**.
5. File không có sửa nào đổi → bỏ qua. Còn lại: `parseModifiedCode` (E024 nếu hỏng), giữ BOM, dựng `PreparedFileWrite`, `commitPreparedFiles` (lỗi ghi giữa chừng thì trả các file đã ghi về như cũ).
6. Có file được ghi → `onWritten(files)` **một lần**; trả `{ changed: files.length > 0, files }`.

`SourceEditorService.applyEditBatch(projectRoot, edits, onWritten)` gọi hàm trên.

**Endpoint** `POST /source/edits/batch` (`routes/source.ts`): parse `BatchEditRequestSchema` (sai → E016 có `details`), gọi `applyEditBatch`, có file đổi thì `historyService.push({ label: { key: 'history:batch', params: { count: String(edits.length) } }, coalesceKey, files })` (một mục). Trả `{ data: BatchEditResult }`. Thêm khóa `history:batch` vào locale Studio ("Sửa {{count}} phần tử" / "Edit {{count}} elements").

**Cảnh báo dán khác file (R-CB-14)** trong `structure-plan.ts` nhánh `insert`: khi `edit.from` có và `edit.from.file !== rel`, và `astSnippet` có `JSXExpressionContainer` mà biểu thức **không** là `JSXEmptyExpression` hay chuỗi/số literal → thêm `'foreignExpression'` vào `warnings` (không trùng lặp). Studio: khóa `inspector.warning.foreignExpression` = "Đoạn dán dùng biến của file gốc, có thể cần sửa" / "The pasted code uses variables from its original file and may need changes".

### 3.3. Studio — clipboard

**`features/clipboard/clipboard-store.ts`** (zustand): `entry?: { text: string; from?: { file: RelPath; imports: string[] } }`, `setEntry`, `clear`.

**`features/clipboard/clipboard-actions.ts`:**

- `sortRefsInDocumentOrder(refs, treeNodes)`: theo vị trí trong `treeNodes` (thứ tự quét DOM); ref không có trong cây giữ thứ tự cũ, đặt cuối.
- `copySelection(): Promise<boolean>`: không chọn gì → `false`. Gọi `GET /source/element-text` cho từng ref (thêm `fetchElementText(loc)` vào `api/source-client.ts` nếu chưa có), `text` = các `jsx` nối bằng `\n`. Mọi phần tử **cùng file** → `from = { file, imports: hợp các imports, bỏ trùng }`; khác file → không có `from` (spec-log #22). `setEntry`, rồi `navigator.clipboard.writeText(text)` trong `try/catch` (bỏ qua lỗi: khi tiêu điểm ở iframe, trình duyệt từ chối ghi clipboard hệ thống; bản trong bộ nhớ vẫn dán được). Lỗi đọc element-text → `useStructureErrorStore.setError` như `runStructureOp`.
- `cutSelection()`: `copySelection()` thành công → `remove` mọi phần tử đã chọn (một lệnh `remove` có nhiều `elements`) → xóa vùng chọn.
- `pasteClipboard(): Promise<boolean>`: không chọn gì → `false`. Đích = phần tử chính (cuối `selectedRefs`), vị trí bằng `determineInsertTarget` (spec-log #22). Đọc `navigator.clipboard.readText()` trong `try/catch`; đọc được và **khác** `entry.text` → dán chữ đó, không `from`; đọc lỗi hoặc bằng `entry.text` → dùng `entry` (kể cả `from`). Không có gì để dán → `false`. Chữ > 1 MB (S-17) → không gửi, báo E016 `{ reason: 'tooLarge' }` qua `structure-error-store`. Gửi `insert { target, jsx, from? }` qua `runStructureOp` (xuất hàm này từ `structure-commands.ts`); thành công chọn **mọi** `res.locs`, `setWarnings(res.warnings)`.

**Phím:** nối `copy`, `cut`, `paste` trong `shortcut-actions.ts`. Khi tiêu điểm ở Studio mà người dùng đang bôi đen chữ trong trang Studio (`window.getSelection()?.toString()` khác rỗng) thì **không** chặn Ctrl+C (để trình duyệt chép chữ đó). Bridge tự chuyển phím vì dùng chung `matchShortcut`, không sửa Bridge.

### 3.4. Studio — Inspector chọn nhiều

**`features/inspector/use-multi-inspector-target.ts`** (mới): khi `selectedRefs.length > 1`, tải `ElementSource` của từng ref (song song, `fetchElementSource`), có `refresh()`. Trả:

```ts
type MultiTarget = {
  kind: 'multi';
  items: { ref: ElementRef; source?: ElementSource }[];
  loading: boolean;
  lock?: { tag: string; loc: string }; // phần tử đầu tiên có className 'expression'/'duplicate' hoặc readonly
  currentScope: Scope;
  writePrefix: string;
  refresh: () => void;
};
```

`InspectorTarget` thêm nhánh này thay cho `{ kind: 'multiple' }` (cập nhật nơi đang dùng `'multiple'`, kể cả test).

**`features/inspector/multi-inspector-view.tsx`** (mới, `data-testid="inspector-multi"`): tiêu đề "Đã chọn N phần tử"; `lock` có giá trị → dòng `data-testid="inspector-multi-locked"` "Không sửa chung được: <tag> ở <loc> có class tính bằng biểu thức" và mọi ô `disabled`. Hiện **các nhóm thuộc tính** như một phần tử (dùng lại `InspectorPropertyGroups` / `PropertyField` / `ColorField`):

- Giá trị mỗi ô: `readValue` trên class của từng phần tử; tất cả bằng nhau (so `JSON.stringify(value)`) → hiện như bình thường với `tokens` của phần tử đầu; khác nhau → ô trống có placeholder "Hỗn hợp" (`inspector.mixed` = "Hỗn hợp" / "Mixed"). Thêm prop tùy chọn `mixed?: boolean` vào `PropertyField` và `ColorField`, không đổi hành vi khi không truyền.
- Đổi một ô: với mỗi phần tử, `after = writeValue(classCủaNó, property, scope, value, ctx)`; bỏ phần tử có `after === before`; còn lại gửi `POST /source/edits/batch` với `setClassName { loc, tag, before, after }`, `coalesceKey = multi|<property>|<writePrefix>|<các loc nối bằng ,>`. Gộp thay đổi liên tiếp 150 ms, chỉ một yêu cầu đang chạy, giữ yêu cầu mới nhất (như `LiveEditQueue`). Xong → `refresh()`. Lỗi → `data-testid="inspector-error"` với `t(errorKey)` như Inspector một phần tử; E017 → `refresh()`.

`api/source-client.ts`: thêm `editSourceBatch(req): Promise<BatchEditResult>`.

## 4. Tình huống test

Test server dùng dự án tạo từ template chép vào thư mục tạm như các lượt trước; kiểm **byte trên đĩa**.

| #   | Đầu vào                                                                                                                                                                                                                                   | Kết quả                                                                                         | Mã            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------- |
| 1   | Batch đổi `className` 3 phần tử cùng file (có cặp cha–con và 2 phần tử cùng dòng)                                                                                                                                                         | Cả 3 đổi đúng, phần còn lại của file y nguyên từng byte; `onWritten` gọi 1 lần với 1 file       | R-CB-15       |
| 2   | Batch 2 phần tử ở `Home.tsx` + 1 ở `Header.tsx`, qua endpoint; rồi Undo                                                                                                                                                                   | 2 file đổi; lịch sử thêm **một** mục; Undo trả cả 2 file đúng từng byte                         | R-CB-15, R-HI |
| 3   | Batch có 1 phần tử `className={cn(...)}`                                                                                                                                                                                                  | E023 `classExpression`; **không file nào** đổi                                                  | R-CB-15       |
| 4   | Batch có 1 `before` cũ (file đã sửa từ ngoài)                                                                                                                                                                                             | E017 `valueChanged`; không file nào đổi                                                         | R-CB-15       |
| 5   | Batch mà mọi `after === before`                                                                                                                                                                                                           | `{ changed: false, files: [] }`, không ghi, không mục lịch sử                                   | R-CB-15       |
| 6   | Batch 2 sửa cùng `loc`; batch 51 sửa                                                                                                                                                                                                      | E016 `duplicateLoc`; E016 có `details`                                                          | R-CB-15       |
| 7   | Insert có `from.file` khác file đích, `jsx` = `<p>{product.name}</p>`; rồi `jsx` = `<p>{'x'}</p>`; rồi cùng file                                                                                                                          | `warnings` có `foreignExpression`; không có; không có                                           | R-CB-14       |
| 8   | `matchShortcut` Ctrl+C, Ctrl+X, Ctrl+V, Cmd+V (apple), Ctrl+Shift+V                                                                                                                                                                       | `copy`, `cut`, `paste`, `paste`, `undefined`                                                    | R-KB          |
| 9   | Studio `copySelection` với 2 ref cùng file (thứ tự chọn ngược thứ tự DOM), `clipboard.writeText` ném lỗi                                                                                                                                  | `entry.text` = jsx theo **thứ tự DOM** nối `\n`; có `from` với imports bỏ trùng; vẫn trả `true` | R-CB-10       |
| 10  | `copySelection` 2 ref khác file                                                                                                                                                                                                           | `entry` không có `from`                                                                         | R-CB-10       |
| 11  | `pasteClipboard`: (a) `readText` ném lỗi → gửi `insert` có `from` của `entry`; (b) `readText` trả chữ khác → gửi chữ đó, không `from`; (c) chọn `section` → `child end`, chọn `p` → `sibling after`; (d) không chọn gì → không gọi server | Đúng                                                                                            | R-CB-11, 12   |
| 12  | `cutSelection` 2 phần tử                                                                                                                                                                                                                  | Một lệnh `remove` có 2 `elements`, sau khi `entry` đã đặt; vùng chọn rỗng                       | R-CB-13       |
| 13  | `MultiInspectorView`: 3 phần tử, 2 có `p-4`, 1 có `p-2`; 3 cùng `bg-white`                                                                                                                                                                | Ô padding có placeholder "Hỗn hợp"; ô nền hiện `white`                                          | R-CB-15       |
| 14  | `MultiInspectorView`: đổi padding thành `6`                                                                                                                                                                                               | `editSourceBatch` gọi **một lần** với 3 `setClassName` đúng `before`/`after`                    | R-CB-15       |
| 15  | `MultiInspectorView`: 1 phần tử `className` `expression`                                                                                                                                                                                  | Có `inspector-multi-locked` nêu tag và loc; ô bị `disabled`; không gọi server                   | R-CB-15       |

Test cũ của `inspector-panel.test.tsx` đang kiểm `selected-multiple-message`: sửa sang `inspector-multi` (thay đổi hành vi có chủ đích, ghi lý do trong báo cáo).

## 5. Kiểm tay (chủ dự án)

Trên dự án mới (template):

1. Chọn một Card trên Home → **Ctrl+C** → chọn section khác → **Ctrl+V**: Card mới nằm cuối section đó, đang được chọn.
2. Chép một `ProductCard` ở Home, chuyển sang trang About, chọn `main` → Ctrl+V: thẻ hiện ra; `About.tsx` có thêm `import { ProductCard } …`; `pnpm build` không lỗi.
3. Chép một phần tử có `{…}` (nếu Home có) sang About: dòng cảnh báo "Đoạn dán dùng biến của file gốc" hiện.
4. Chép một đoạn chữ thường từ Notepad, chọn một phần tử trong Canvas, Ctrl+V: báo lỗi, file không đổi.
5. Chọn một nút → **Ctrl+X** → nút biến mất; **Ctrl+Z** một lần: nút trở lại đúng chỗ.
6. Ctrl+bấm chọn 3 nút → Inspector hiện các ô; ô có giá trị khác nhau ghi "Hỗn hợp"; đổi màu nền một lần: cả 3 đổi; **Ctrl+Z** một lần: cả 3 về như cũ.
7. Chọn nhiều phần tử, có một phần tử dùng `cn(...)` (component `ui/Button` nếu có): Inspector khóa và nêu phần tử đó.
8. Bấm chuột vào trong Canvas rồi Ctrl+C, Ctrl+V: vẫn chạy (bản trong bộ nhớ).

Trên WorkTracker:

9. Chép–dán một thẻ trong cùng trang; chọn nhiều thẻ và đổi một khoảng cách; Undo một lần đúng.

## 6. Bẫy đã biết

- **Clipboard hệ thống khi tiêu điểm ở iframe:** `navigator.clipboard.writeText/readText` của Studio bị từ chối vì tài liệu Studio không có tiêu điểm. Không coi đó là lỗi; luôn có bản trong bộ nhớ (spec-log #22). Firefox không cho `readText` tự do: cùng cách xử lý.
- **Một `MagicString` cho cả file:** không đọc lại file giữa các sửa của cùng file, không ghi từng sửa một (sẽ sinh nhiều mục lịch sử và mất tính "tất cả hoặc không").
- **Thứ tự khóa file:** luôn `withFileLocks` với danh sách đã sắp xếp, như `structure-runner` (tránh khóa chéo với sửa đơn đang chạy).
- **Cache AST:** sau khi ghi, cập nhật `cacheAst` cho từng file như `commitPreparedFiles` đang làm.
- **`remove` nhiều phần tử** có thể bị E023 nếu có phần tử gốc `return`; giữ nguyên `entry` đã chép, báo lỗi, không xóa gì.
- **Không đổi Inspector một phần tử:** `use-live-edit` và test của nó giữ nguyên.
- **Ctrl+C trong ô nhập của Studio** phải chép chữ trong ô như bình thường (R-KB-10 đã lo; thêm test nếu sửa chỗ này).
- **Giới hạn:** file ≤ 400 dòng, hàm ≤ 50 dòng; `source-editor-service.ts` (399 dòng) phải **ngắn đi** sau khi tách.
- Không sửa Bridge. Không viết E2E mới, không chạy `pnpm test:e2e`.

## 7. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ:

- kết quả kiểm tay bước 1, 5, 6 nếu tự thử được;
- số dòng `source-editor-service.ts` trước và sau;
- nguyên văn `About.tsx` sau bước 2 nếu đã thử.

```text
feat(studio): copy, cut, paste and edit several elements at once
```
