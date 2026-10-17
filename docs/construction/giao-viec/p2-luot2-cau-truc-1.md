# Phase 2 — Lượt 2: Thao tác cấu trúc, phần 1 — chèn, xóa, nhân bản (WP-2.02a)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Kế hoạch chung ở `p2-ke-hoach.md`.

## 1. Mục tiêu (người dùng thấy gì)

- Chọn một phần tử trên Canvas. Đầu panel Thuộc tính có hai nút **Nhân bản** và **Xóa**.
  - **Xóa:** phần tử biến mất khỏi file nguồn, Canvas cập nhật qua HMR, bỏ chọn.
  - **Nhân bản:** một bản sao nằm ngay sau phần tử gốc, cùng cha.
  - Cả hai Undo/Redo được, trả file về **đúng từng byte**.
- Phần tử không được phép xóa (gốc `return` của component, gốc callback `.map`…): nút vẫn bấm được, server trả E023 và Studio hiện lý do bằng tiếng người dùng.
- Thao tác **chèn** (`insert`) chỉ làm ở server và test ở lượt này. Library (lượt 4) và công cụ vẽ (lượt 10) sẽ dùng nó.

Không làm ở lượt này: `move`, `wrap`, `unwrap`, import còn thiếu (R-SE-23), `GET /source/element-text`, `POST /source/edits/batch`. Các phần này ở lượt 3 và lượt 7.

## 2. Đọc trước (CW-52)

| File                                                                                                                                                                 | Lý do                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `docs/spec.md` mục 14 (M-SE thao tác cấu trúc), R-SE-09, R-SE-10, R-SE-11, R-HI-01                                                                                   | Quy tắc                                                                           |
| `packages/server/src/core/source-editor/source-editor-service.ts`                                                                                                    | Luồng đọc → tìm nút → sửa → phân tích lại → ghi → `onWritten`; hàng đợi theo file |
| `.../source-editor-lookup.ts` (`findNodeAt`, `validateLocAndExt`, cache AST), `ast-helpers.ts` (`detectFormat`, `detectIndentation`, `parseJsxAst`, `getJsxTagName`) | Dùng lại, không viết lại                                                          |
| `packages/server/src/adapters/http/routes/source.ts`, `routes/source.test.ts`                                                                                        | Route và cách ghi lịch sử (`historyService.push({ label, files })`)               |
| `packages/shared/src/source.ts`                                                                                                                                      | Schema `SourceEdit`, `EditRequest`, `EditResult`                                  |
| `packages/studio/src/api/source-client.ts`, `features/inspector/components/inspector-header.tsx`, `features/selection/selection-store.ts`                            | Nơi gắn nút                                                                       |
| `packages/studio/src/i18n/locales/{vi,en}/{common,errors}.json` (khóa `history.*`, `E023.reasons`, `E016`)                                                           | Chữ hiển thị                                                                      |

## 3. Hợp đồng

### 3.1. `packages/shared/src/source.ts` (thêm, export qua `index.ts`)

```ts
export const ElementGuardSchema = z.strictObject({
  loc: z.string().min(1),
  tag: z.string().min(1),
});
export const InsertTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('sibling'),
    ref: ElementGuardSchema,
    where: z.enum(['before', 'after']),
  }),
  z.strictObject({
    kind: z.literal('child'),
    parent: ElementGuardSchema,
    where: z.enum(['start', 'end']),
  }),
]);
export const InsertEditSchema = z.strictObject({
  kind: z.literal('insert'),
  target: InsertTargetSchema,
  jsx: z
    .string()
    .min(1)
    .max(256 * 1024),
});
export const RemoveEditSchema = z.strictObject({
  kind: z.literal('remove'),
  elements: z.array(ElementGuardSchema).min(1).max(50),
});
export const DuplicateEditSchema = z.strictObject({
  kind: z.literal('duplicate'),
  elements: z.array(ElementGuardSchema).min(1).max(50),
});
export const StructureEditSchema = z.discriminatedUnion('kind', [
  InsertEditSchema,
  RemoveEditSchema,
  DuplicateEditSchema,
]);

// EditRequest.edit nhận cả hai loại:
export const AnyEditSchema = z.discriminatedUnion('kind', [
  SetClassNameEditSchema,
  SetTextEditSchema,
  SetAttributeEditSchema,
  InsertEditSchema,
  RemoveEditSchema,
  DuplicateEditSchema,
]);
// EditRequestSchema.edit: AnyEditSchema (thay SourceEditSchema)

export const StructureResultSchema = z.strictObject({
  changed: z.boolean(),
  files: z.array(RelPathSchema), // file đã ghi, theo thứ tự đường dẫn
  locs: z.array(z.string()), // `file:dòng:cột` của phần tử mới (insert, duplicate); [] với remove
  warnings: z.array(z.string()).optional(),
});
```

`insert` chưa có trường `from` (import). Trường đó thêm ở lượt 3 (R-SE-23).

### 3.2. Server

- Thư mục mới `packages/server/src/core/source-editor/structure/`:
  - `jsx-children.ts`: `jsxChildren(node: AstNode): AstNode[]` theo R-SE-20.
  - `structure-guard.ts`: tìm đường đi tổ tiên của một phần tử và kiểm R-SE-21 (mục 4.2).
  - `text-edits.ts`: kiểu `TextEdit = { start; end; text; mark?: number }` và hàm `applyTextEdits(code, edits)`. Hàm sắp xếp theo `start`, báo E016 `overlap` khi hai đoạn chồng nhau, trả `{ code, marks }` với `marks` là offset **trong code mới** của các đoạn có `mark`.
  - `structure-ops.ts`: tạo `TextEdit` cho `insert`, `remove`, `duplicate` (mục 4.3 đến 4.6).
- `source-editor-service.ts`: thêm phương thức

  ```ts
  applyStructureEdit(
    projectRoot: string,
    edit: StructureEdit,
    onWritten?: (files: readonly WrittenFile[]) => void,
  ): Promise<Result<StructureResult>>;
  ```

  - Gom phần tử theo file. Mỗi file: đọc (giữ BOM), kiểm hash và AST như `readAndResolveTargetNode`, tạo `TextEdit`, `applyTextEdits`, **phân tích lại** (R-SE-11, sai thì E024).
  - **Kiểm xong mọi file rồi mới ghi file nào** (R-SE-29). Ghi lỗi giữa chừng: ghi lại nội dung cũ cho các file đã ghi, rồi trả lỗi.
  - Chạy trong `queueFileTask` của từng file. Thứ tự lấy khóa theo đường dẫn tăng dần để không kẹt khi hai yêu cầu cùng đụng nhiều file.
  - `onWritten` gọi **một lần** với mọi file đã ghi, để lịch sử có **một** mục.
  - Chuyển `locs` từ offset sang `file:dòng:cột`. Cột theo quy ước hiện có: cột Babel + 1 (xem `findNodeAt`).
  - File không đổi: `changed: false`, không ghi, không gọi `onWritten`.

- `routes/source.ts`: `POST /source/edits` phân loại theo `edit.kind`. Ba loại cũ đi đường cũ, không đổi hành vi. Loại cấu trúc gọi `applyStructureEdit` rồi ghi lịch sử bằng `historyService.push({ label, files })`.
  - Nhãn lịch sử: `{ key: 'history:<kind>', params: { tag, count } }`, với `tag` của phần tử đầu và `count` = số phần tử.
  - Kết quả trả `{ data: StructureResult }`.

### 3.3. Studio

- `api/source-client.ts`: `applyStructureEdit(edit: StructureEdit): Promise<StructureResult>`, parse bằng `StructureResultSchema`.
- `features/inspector/components/structure-actions.tsx` (mới), gắn vào `InspectorHeader` khi đúng **một** phần tử được chọn:
  - Nút **Nhân bản** (`data-testid="inspector-duplicate"`) và **Xóa** (`data-testid="inspector-remove"`).
  - `ElementGuard` lấy từ `target.ref.loc` và `target.source.tag`. Khi `source` chưa tải xong thì nút bị khóa.
  - Đang gửi thì khóa nút. Lỗi hiện bằng `errorText` + `toErrorInfo` (như `backends-view.tsx`), `role="alert"`.
  - Xóa thành công: `useSelectionStore.getState().setSelectedRefs([])`. Nhân bản thành công: giữ chọn phần tử gốc.
- i18n `vi`/`en`:
  - `inspector.duplicate`, `inspector.remove`;
  - `history.insert` ("chèn <{{tag}}>"), `history.remove` ("xóa {{count}} phần tử"), `history.duplicate` ("nhân bản {{count}} phần tử");
  - `errors.E023.reasons`: `rootElement`, `loopRoot`, `expressionChild`, `componentSlot`;
  - `errors.E016.reasons` (hoặc khóa tương ứng đang dùng cho E016): `notJsx`, `overlap`.
  - Kiểm `pnpm check:i18n`.

## 4. Thuật toán

### 4.1. Con JSX (R-SE-20)

`jsxChildren(el)` = các phần tử trong `el.children` có kiểu `JSXElement`, `JSXFragment`, `JSXExpressionContainer` mà `expression` không phải `JSXEmptyExpression`, hoặc `JSXText` có ký tự khác khoảng trắng. Comment `{/* */}` là `JSXEmptyExpression` nên không tính.

### 4.2. Kiểm hợp lệ (R-SE-21)

Lấy đường tổ tiên của phần tử, bỏ qua `ParenthesizedExpression` và `TSAsExpression`.

| Lý do             | Khi nào                                                                                                                                                                | Áp dụng cho                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `loopRoot`        | Cha gần nhất là thân `ArrowFunctionExpression`, hoặc `ReturnStatement` trong một hàm, **và** hàm đó là đối số của `CallExpression` có `callee.property.name === 'map'` | remove; insert `sibling` cạnh nó; duplicate |
| `rootElement`     | Cha gần nhất là `ReturnStatement` hoặc thân `ArrowFunctionExpression` (không phải `.map`), hoặc giá trị của `VariableDeclarator`                                       | remove; insert `sibling`; duplicate         |
| `expressionChild` | Cha gần nhất không phải `JSXElement` hoặc `JSXFragment` (ví dụ nằm trong `{cond && <a/>}` hay `cond ? <a/> : <b/>`)                                                    | remove; insert `sibling`; duplicate         |
| `componentSlot`   | insert `child` vào phần tử mà `jsxChildren` chứa `{children}` (Identifier tên `children`)                                                                              | insert `child`                              |

Phần tử là `JSXElement` con trực tiếp của `JSXElement` hoặc `JSXFragment` thì hợp lệ. Lỗi trả `E023 { reason, loc }`.

### 4.3. Thụt lề và xuống dòng

- `nl` = `detectFormat(raw).newline`.
- `indentOf(line)` = khoảng trắng đầu dòng chứa phần tử.
- `unit` = một bậc thụt lề của file, lấy từ `detectIndentation`: tab, hoặc `step` dấu cách.
- Đoạn `jsx` chèn vào:
  1. Bỏ thụt lề chung nhỏ nhất của các dòng.
  2. Đổi mỗi bậc thụt lề của đoạn (bậc nhỏ nhất khác 0 trong đoạn) thành `unit` của file.
  3. Từ dòng thứ hai trở đi, thêm `indentOf` của vị trí chèn vào đầu dòng.
  4. Nối các dòng bằng `nl`.
- `jsx` phải phân tích được khi bọc `<>…</>` (`parseJsxAst`) và có ít nhất một `JSXElement`. Sai thì E016 `{ reason: 'notJsx' }`.

### 4.4. Insert

Gọi `X` là đoạn đã thụt lề theo 4.3 và `I` là `indentOf(dòng của phần tử tham chiếu)`.

| Đích                                     | Chèn tại                                                              | Văn bản                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `sibling before ref`                     | `ref.start`                                                           | `X + nl + I`                                                                                                         |
| `sibling after ref`                      | `ref.end`                                                             | `nl + I + X`                                                                                                         |
| `child start/end`, cha có con (R-SE-20)  | như `sibling before` con đầu / `sibling after` con cuối               | như trên, với `I` là thụt lề của con đó                                                                              |
| `child`, cha không có con, không tự đóng | `openingElement.end`                                                  | `nl + Ip + unit + X + nl + Ip` (`Ip` = thụt lề dòng của cha), thay luôn khoảng trắng đang có giữa thẻ mở và thẻ đóng |
| `child`, cha tự đóng `<div />`           | thay đoạn `/>` cuối thẻ (giữ khoảng trắng trước nó trừ dấu cách cuối) | `>` + `nl + Ip + unit + X + nl + Ip + '</' + tag + '>'`                                                              |

Phần tử đầu của mỗi đoạn chèn có `mark` để trả `locs`.

### 4.5. Remove (R-SE-25)

- Phần tử nằm riêng trên các dòng của nó (trước `start` tới đầu dòng chỉ là khoảng trắng, sau `end` tới cuối dòng chỉ là khoảng trắng): xóa từ **đầu dòng đầu** tới **hết ký tự xuống dòng của dòng cuối**.
- Phần tử nằm chung dòng với nội dung khác: chỉ xóa `[start, end)`.
- Nhiều phần tử: mỗi phần tử một `TextEdit`. Chồng nhau (cha và con cùng được chọn) thì bỏ phần tử con, giữ cha.

### 4.6. Duplicate (R-SE-26)

Chèn `nl + I + code.slice(start, end)` tại `end`, có `mark`. Bản sao giữ nguyên thụt lề bên trong vì cùng bậc. Nhiều phần tử: mỗi phần tử một bản sao ngay sau nó.

## 5. Tình huống test

Viết bằng Vitest, file ở cạnh mã nguồn. Dùng thư mục tạm và `nodeFs` cho test service, như test hiện có.

| #   | Đầu vào                                                                                                                                                                                                      | Kết quả                                                                                                    | Mã                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | `jsxChildren` của `<div>{/* c */}  <a/> text {x}</div>`                                                                                                                                                      | 3 con: `a`, `text`, `{x}`                                                                                  | R-SE-20                   |
| 2   | `<main>\n  <h1/>\n  <p/>\n</main>`; insert `<hr />` sibling before `p`                                                                                                                                       | `<main>\n  <h1/>\n  <hr />\n  <p/>\n</main>`                                                               | R-SE-22                   |
| 3   | Cùng file; insert sibling after `p`; child start của `main`; child end của `main`                                                                                                                            | Đúng vị trí, cùng thụt lề 2 dấu cách                                                                       | R-SE-22                   |
| 4   | Insert child vào `<section />` thụt 4 dấu cách                                                                                                                                                               | `<section>` + dòng con thụt thêm một bậc + `</section>`                                                    | R-SE-21, R-SE-22          |
| 5   | Insert đoạn nhiều dòng thụt 2 dấu cách vào file thụt **tab**                                                                                                                                                 | Mỗi bậc thành tab, thẳng hàng với vị trí chèn                                                              | R-SE-09                   |
| 6   | File CRLF có BOM: insert, remove, duplicate                                                                                                                                                                  | Giữ BOM và `\r\n`, không lẫn `\n`                                                                          | R-SE-10                   |
| 7   | `jsx` là `hello <b` và `const x = 1`                                                                                                                                                                         | E016 `notJsx`, file không đổi                                                                              | R-SE-22                   |
| 8   | Remove phần tử giữa, cuối, phần tử con duy nhất                                                                                                                                                              | Không còn dòng trống thừa; cha còn `<div>\n</div>` đúng thụt lề                                            | R-SE-25                   |
| 9   | Remove gốc `return (<div>…</div>)`; gốc callback `items.map((i) => <li/>)`; phần tử trong `{ok && <p/>}`                                                                                                     | E023 `rootElement`, `loopRoot`, `expressionChild`; file không đổi                                          | R-SE-21                   |
| 10  | Remove 2 phần tử ở 2 file khác nhau                                                                                                                                                                          | Cả hai file đổi; `onWritten` gọi **một** lần với 2 file                                                    | R-SE-25, R-HI-01          |
| 11  | Remove cha và con cùng lúc                                                                                                                                                                                   | Chỉ xóa cha, không lỗi                                                                                     | R-SE-25                   |
| 12  | Duplicate một `<li>` nhiều dòng                                                                                                                                                                              | Bản sao ngay sau, cùng thụt lề; `locs` trỏ đúng dòng:cột bản sao (dùng `findNodeAt` trên code mới để kiểm) | R-SE-26                   |
| 13  | Tag trong `ElementGuard` không khớp (`span` thay `p`)                                                                                                                                                        | E017 `moved`, không ghi                                                                                    | R-SE-21                   |
| 14  | **Đi hết file thật:** với mọi `.tsx` trong `fixtures/projects/vite8-react19-ts/src` và `templates/vite-react-ts-tailwind4/src`, mỗi `JSXElement` hợp lệ theo 4.2: duplicate rồi remove bản sao (theo `locs`) | File trở về **đúng từng byte**                                                                             | R-SE-26, R-SE-25, R-SE-29 |
| 15  | Route: `POST /source/edits` với `remove`, rồi `POST /history/undo`                                                                                                                                           | 200 và `StructureResult`; Undo trả file đúng từng byte; nhãn `history:remove`                              | R-HI-01                   |
| 16  | Component `StructureActions`: bấm Xóa gọi API với guard đúng, thành công thì bỏ chọn; API trả E023 `rootElement` thì hiện chữ của lý do                                                                      | Đúng                                                                                                       | R-SE-21                   |

## 6. Kiểm tay (chủ dự án)

Trên dự án mới (template Oakline):

1. Chọn một `ProductCard` trên Home, bấm **Nhân bản**: lưới thành 4 thẻ; file `Home.tsx` có thêm đúng một `<ProductCard …/>` cùng thụt lề.
2. Ctrl+Z (hoặc nút Undo): còn 3 thẻ; `git diff` trên `Home.tsx` rỗng.
3. Chọn đoạn mô tả trong hero, bấm **Xóa**: đoạn biến mất, không còn dòng trống thừa trong file. Undo trả về.
4. Chọn thẻ `div` ngoài cùng của Home (gốc `return`), bấm **Xóa**: hiện lý do "phần tử gốc của component", file không đổi.
5. Nhân bản một nút trong hero (phần tử nằm trong `Button.tsx`): bản sao nằm trong `Home.tsx` hay báo lý do. Ghi lại hành vi để Claude xem.

Trên WorkTracker:

6. Xóa một thẻ trong trang Login, rồi Undo: file về đúng như cũ (`git diff` rỗng).
7. Thử Xóa phần tử nằm trong `.map` (một dòng của danh sách): báo lý do, không hỏng file.

## 7. Bẫy đã biết

- **Vị trí `loc`:** cột là cột Babel cộng 1, theo thẻ mở. Sau khi ghi, Bridge gửi `tree` mới; selection cũ có thể trỏ vị trí đã dời. Vì vậy xóa xong phải bỏ chọn.
- **Cache AST** (`getCachedAst`, `cacheAst`): dùng lại như `performEditOnFile`. Code mới phải cache theo hash mới, không để cache cũ phục vụ lần sửa sau.
- **Không dùng MagicString cho thao tác cấu trúc.** `applyTextEdits` tự làm để tính được offset mới cho `locs`. Không sửa `performEditOnFile` cũ.
- **Hàng đợi nhiều file:** `queueFileTask` cho từng file, lồng theo thứ tự đường dẫn. Không giữ khóa file này trong lúc chờ khóa file khác theo thứ tự ngược.
- **Phần tử trong component khác file:** `loc` của nút trong `Button.tsx` trỏ vào `Button.tsx`. Xóa nó là xóa trong `Button.tsx`, ảnh hưởng mọi nơi dùng. Lượt này **không** chặn việc đó (R-SE-14 đã có cảnh báo số chỗ dùng ở Inspector); chỉ đảm bảo đúng file.
- **`exactOptionalPropertyTypes`:** dùng spread có điều kiện như code hiện có, không gán `undefined` vào trường tùy chọn.
- File `source-editor-service.ts` đang 344 dòng (giới hạn 400). Logic mới đặt trong `structure/`; service chỉ thêm phần điều phối ngắn.

## 8. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ: hành vi ở bước kiểm tay 5; số file và số phần tử đã đi qua ở test #14.

Không cần chạy `pnpm test:e2e` ở lượt này.

Commit gợi ý:

```text
feat(server): insert, remove and duplicate jsx elements in the source
```
