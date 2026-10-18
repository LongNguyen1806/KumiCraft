# Phase 2 — Lượt 3: Thao tác cấu trúc, phần 2 — di chuyển, bọc, bỏ bọc, import (WP-2.02b)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Lượt 2 (`p2-luot2-cau-truc-1.md`) đã có `insert`, `remove`, `duplicate`; lượt này **mở rộng cùng bộ khung**, không viết lại.

## 1. Mục tiêu (người dùng thấy gì)

Chọn một phần tử. Đầu panel Thuộc tính, cạnh **Nhân bản** và **Xóa**, có thêm:

- **↑ Lên**, **↓ Xuống**: đổi chỗ với phần tử anh em liền trước hoặc liền sau trong cùng file.
- **Bọc ▾** (Hàng, Cột, Lưới): bọc phần tử trong một `div` flex hoặc grid.
- **Bỏ bọc**: thay thẻ bằng các con của nó.

Mọi thao tác Undo về đúng từng byte. Thao tác không làm được thì nút bị khóa, hoặc server trả lý do và Studio hiện bằng chữ người dùng.

Server có thêm:

- `move` sang cha khác, sang file khác (lượt 6 kéo thả sẽ dùng);
- `insert` có tự thêm import (R-SE-23);
- `GET /source/element-text` (lượt 7 sao chép sẽ dùng).

## 2. Đọc trước (CW-52)

| File                                                                             | Lý do                                                                        |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `docs/spec.md` R-SE-21 đến R-SE-30, R-SE-09, R-SE-10                             | Quy tắc                                                                      |
| `packages/server/src/core/source-editor/structure/*` (toàn bộ, kể cả test)       | Khung đã có: `applyTextEdits`, guard, `formatInsertedJsx`, runner nhiều file |
| `packages/shared/src/source.ts` (phần cấu trúc)                                  | Schema hiện có                                                               |
| `packages/studio/src/features/inspector/components/structure-actions.tsx` + test | Nơi thêm nút                                                                 |
| `packages/studio/src/features/selection/selection-store.ts` (`treeNodes`)        | Tính anh em cho Lên/Xuống                                                    |
| `packages/server/src/adapters/http/routes/source.ts`                             | Thêm route `element-text`                                                    |

## 3. Hợp đồng

### 3.1. Shared (`source.ts`, export qua `index.ts`)

```ts
export const MoveEditSchema = z.strictObject({
  kind: z.literal('move'),
  elements: z.array(ElementGuardSchema).min(1).max(50),
  target: InsertTargetSchema,
});
export const WrapEditSchema = z.strictObject({
  kind: z.literal('wrap'),
  elements: z.array(ElementGuardSchema).min(1).max(50),
  wrapper: z.enum(['row', 'column', 'grid']),
});
export const UnwrapEditSchema = z.strictObject({
  kind: z.literal('unwrap'),
  element: ElementGuardSchema,
});
// InsertEditSchema thêm: from: z.strictObject({ file: RelPathSchema, imports: z.array(z.string().max(2000)).max(50) }).optional()
// StructureEditSchema và AnyEditSchema thêm move, wrap, unwrap.

export const ElementTextSchema = z.strictObject({
  jsx: z.string(), // văn bản nguồn của phần tử, đã bỏ thụt lề chung
  file: RelPathSchema,
  imports: z.array(z.string()), // câu import (nguyên văn) của mọi tên thẻ viết hoa dùng trong phần tử
});
```

`StructureResult.warnings` dùng các giá trị: `missingImport`, `attributesDropped`.

### 3.2. Server

- File mới trong `structure/`:
  - `move-ops.ts`;
  - `wrap-ops.ts` (bọc và bỏ bọc);
  - `imports.ts` (R-SE-23);
  - `element-text.ts` (R-SE-30).
  - Mỗi file dưới 300 dòng.
- `structure-runner.ts`: tổng quát hóa để **mỗi file có danh sách thao tác riêng**. `move` khác file là một file bị xóa phần tử và một file được chèn. Giữ nguyên các bất biến của lượt 2:
  - khóa theo thứ tự đường dẫn;
  - kiểm xong mọi file rồi mới ghi;
  - hoàn lại khi ghi lỗi;
  - `onWritten` gọi **một lần**;
  - file không đổi thì `changed: false`.
- Runner đang 303 dòng. Tách phần chuẩn bị theo file ra `structure-plan.ts` nếu vượt 400 dòng.
- `source-editor-service.ts`: thêm `getElementText(projectRoot, loc)`.
- `routes/source.ts`: thêm `GET /source/element-text?loc=…` trả `{ data: ElementText }`. Lỗi giống `GET /source/element`. Nhãn lịch sử thêm `history:move`, `history:wrap`, `history:unwrap`.

### 3.3. Studio

- `features/inspector/components/structure-actions.tsx`: thêm các nút sau, mỗi nút một `data-testid`:

  | Nút                          | `data-testid`         |
  | ---------------------------- | --------------------- |
  | Lên                          | `inspector-move-up`   |
  | Xuống                        | `inspector-move-down` |
  | Bọc (select Hàng, Cột, Lưới) | `inspector-wrap`      |
  | Bỏ bọc                       | `inspector-unwrap`    |
  - Bỏ bọc bị khóa khi `tag` viết hoa.
  - Nếu file vượt 200 dòng thì tách phần tính toán ra hook `use-structure-actions.ts`.

- `features/inspector/sibling-move.ts` (mới, hàm thuần): `siblingMoveTarget(treeNodes, ref, direction): InsertTarget | undefined`.
  - Anh em là các nút cùng `parent` trong `treeNodes`, có `loc` **cùng file** với phần tử, bỏ nút trùng `loc` với phần tử (cùng loc do `.map` sinh ra).
  - **Lên:** `{ kind: 'sibling', ref: <anh em liền trước>, where: 'before' }`.
  - **Xuống:** `{ kind: 'sibling', ref: <anh em liền sau>, where: 'after' }`.
  - Không có anh em phù hợp: trả `undefined`, nút bị khóa.
  - `tag` của anh em lấy từ `TreeNode.tag`.
- Sau `move` và `wrap`: chọn `locs[0]` (giống nhân bản ở lượt 2). Sau `unwrap`: bỏ chọn.
- i18n `vi`/`en`:
  - `inspector.moveUp`, `inspector.moveDown`, `inspector.wrap`, `inspector.wrapRow`, `inspector.wrapColumn`, `inspector.wrapGrid`, `inspector.unwrap`;
  - `history.move`, `history.wrap`, `history.unwrap`;
  - `errors.E016.reasons`: `moveIntoSelf`, `notSameParent`, `notContiguous`, `nothingToUnwrap`;
  - `errors.E023.reasons`: `componentTag`;
  - cảnh báo `missingImport`, `attributesDropped` (hiện dưới các nút sau khi thao tác thành công).

## 4. Thuật toán

Ký hiệu như lượt 2:

- `nl` là kiểu xuống dòng của file;
- `I` là thụt lề dòng của phần tử tham chiếu;
- `unit` là một bậc thụt lề;
- `formatInsertedJsx` là hàm đã có của lượt 2.

### 4.1. Văn bản của một phần tử (dùng chung cho move và element-text)

`elementText(code, el)` = `indentOf(el) + code.slice(el.start, el.end)`, rồi bỏ thụt lề chung nhỏ nhất của mọi dòng. Kết quả là đoạn JSX mà dòng đầu không thụt, các dòng sau giữ thụt **tương đối**.

### 4.2. Move (R-SE-24)

1. Kiểm `checkElementStructureGuard` cho từng phần tử (như `remove`) và guard của đích (như `insert`).
2. Nhiều phần tử phải **cùng cha** (E016 `notSameParent`). Sắp xếp theo vị trí trong file. Văn bản di chuyển là các `elementText` nối bằng `nl`; mỗi đoạn giữ thụt lề tương đối của nó.
3. Đích nằm **trong** một phần tử đang di chuyển (khoảng `[start, end)` của đích nằm trong khoảng của phần tử, hoặc đích chính là phần tử với `kind: 'child'`): E016 `moveIntoSelf`.
4. **Cùng file:** tạo cả hai loại `TextEdit` trên **toạ độ gốc**:
   - xóa: như `buildRemoveTextEdits`;
   - chèn: như `buildInsertTextEdit` với `jsx` là văn bản di chuyển.
   - Đích là anh em ngay trước hoặc ngay sau (về đúng chỗ cũ): kết quả trùng code cũ nên `changed: false`. Không cần nhánh riêng, runner đã trả `changed: false` khi code không đổi.
   - Đích dính ranh giới vùng xóa (ví dụ `sibling before` phần tử ngay sau): đoạn chèn đặt tại `ref.start`, nằm **ngoài** vùng xóa. Nếu `applyTextEdits` báo `overlap` thì phải sửa cách tính vùng, không được nới kiểm tra overlap.
5. **Khác file:** file nguồn có thao tác xóa; file đích có thao tác chèn kèm import (4.5) với `from = { file: <file nguồn>, imports: <các câu import của file nguồn> }`. Hai file chung một mục lịch sử.
6. `locs`: vị trí phần tử đầu sau khi di chuyển (`mark` trên đoạn chèn).

### 4.3. Wrap (R-SE-27)

1. Guard của mỗi phần tử như `remove`: gốc `return` → E023 `rootElement`; gốc `.map` → `loopRoot`; trong `{…}` → `expressionChild`.
2. Mọi phần tử cùng cha (E016 `notSameParent`) và **liền nhau** theo `jsxChildren` (E016 `notContiguous`).
3. Vùng thay thế: từ **đầu dòng** của phần tử đầu (nếu phần tử đầu đứng riêng dòng; không thì từ `start`) tới `end` của phần tử cuối.
4. Văn bản mới:

   ```text
   I + '<div className="' + CLS + '">' + nl
   + (mỗi dòng của vùng cũ, thêm `unit` ở đầu dòng; dòng rỗng giữ rỗng) + nl
   + I + '</div>'
   ```

   `CLS`: `row` → `flex flex-row gap-4`, `column` → `flex flex-col gap-4`, `grid` → `grid grid-cols-2 gap-4`. Dòng đầu của vùng cũ được thêm `I + unit` nếu vùng bắt đầu từ `start`.

5. `mark` tại `<div` mới, nên `locs[0]` là vị trí thẻ bọc.

### 4.4. Unwrap (R-SE-28)

1. Tag viết hoa: E023 `componentTag`. Không có con (`jsxChildren` rỗng): E016 `nothingToUnwrap`.
2. Phần tử là gốc `return`/`.map`/biến và có **nhiều hơn một** con: E023 `rootElement` hoặc `loopRoot`, vì bỏ bọc sẽ thành nhiều gốc. Một con thì được.
3. Nội dung trong = `code.slice(opening.end, closing.start)`. Bỏ các dòng chỉ có khoảng trắng ở đầu và cuối, rồi bỏ **một** `unit` thụt lề ở đầu mỗi dòng (dòng không có đủ một bậc thì bỏ khoảng trắng đầu dòng hiện có).
4. Thay phần tử (vùng như `remove` khi đứng riêng dòng: từ đầu dòng tới hết dòng cuối, rồi chèn lại nội dung đã thụt lùi kèm `nl` cuối) bằng nội dung đó.
5. Thuộc tính khác `className` (kể cả `key`, `id`, `onClick`): vẫn làm, thêm `warnings: ['attributesDropped']`.
6. `locs`: rỗng.

### 4.5. Import còn thiếu (R-SE-23)

Khi `insert` có `from`, và khi `move` sang file khác:

1. Tên cần có = các tên thẻ viết hoa trong đoạn chèn (tên đầu của `JSXMemberExpression`, ví dụ `Icons` của `<Icons.Star/>`).
2. Bỏ tên đã có trong file đích: đã import (mọi specifier), hoặc khai báo ở cấp cao nhất (`function Card`, `const Card =`).
3. Với mỗi tên còn lại, tìm trong `from.imports` câu import có specifier đó (parse từng câu bằng `parseJsxAst`).
   - Đường dẫn bắt đầu bằng `.`: tính lại tương đối từ thư mục file đích. Dùng `path.posix`, kết quả có tiền tố `./` hoặc `../`, giữ nguyên đuôi file như câu gốc.
   - Bắt đầu bằng `@/` hoặc tên gói: giữ nguyên.
   - Câu import chỉ có một phần specifier cần: tạo câu mới **chỉ** với specifier đó, giữ kiểu default/named/`type`.
4. Không tìm được: không thêm, `warnings` có `missingImport`.
5. Chỗ chèn: sau **câu import cuối** của file đích (`nl` + câu), hoặc đầu file nếu chưa có import. Câu trùng nguyên văn với câu đã có thì bỏ qua.

### 4.6. `GET /source/element-text` (R-SE-30)

`{ jsx: elementText(...), file, imports }`, với `imports` = nguyên văn các câu import của file chứa phần tử có specifier trùng tên thẻ viết hoa dùng trong phần tử (lấy cả câu, không cắt). Phần tử không tìm thấy: E017 `moved`.

## 5. Tình huống test

| #   | Đầu vào                                                                                                                             | Kết quả                                                                                                                                                               | Mã                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | `<ul>` có `a`, `b`, `c` (mỗi thẻ một dòng); move `c` sibling before `a`                                                             | Thứ tự `c a b`; thụt lề giữ                                                                                                                                           | R-SE-24                   |
| 2   | Move `a` sibling after `b`; rồi move `b` sibling before `a` (đã đứng ngay trước)                                                    | `b a c`; lần hai `changed: false`, file không đổi                                                                                                                     | R-SE-24                   |
| 3   | Move một `div` nhiều dòng thụt 4 sang child end của `section` thụt 2 (cùng file)                                                    | Văn bản thụt lại đúng bậc mới, các dòng con giữ thụt tương đối                                                                                                        | R-SE-24, R-SE-09          |
| 4   | Move `section` vào child của chính nó; vào con cháu của nó                                                                          | E016 `moveIntoSelf`, file không đổi                                                                                                                                   | R-SE-24                   |
| 5   | Move 2 phần tử khác cha                                                                                                             | E016 `notSameParent`                                                                                                                                                  | R-SE-24                   |
| 6   | Move `<Card/>` từ `src/pages/Home.tsx` (có `import { Card } from '../components/Card.tsx'`) sang `src/App.tsx`                      | `App.tsx` có `import { Card } from './components/Card.tsx';` sau import cuối; `Home.tsx` mất phần tử; **một** mục lịch sử 2 file; Undo trả cả hai file đúng từng byte | R-SE-24, R-SE-23          |
| 7   | Insert `<Card/>` có `from.imports` dùng alias `@/components/Card`; insert `<Unknown/>`                                              | Import giữ `@/…`; lần hai `warnings: ['missingImport']`, phần tử vẫn chèn                                                                                             | R-SE-23                   |
| 8   | Insert `<Card/>` vào file đã import `Card`, và vào file khai báo `function Card`                                                    | Không thêm import                                                                                                                                                     | R-SE-23                   |
| 9   | Wrap 2 nút liền nhau với `row`                                                                                                      | `<div className="flex flex-row gap-4">` bọc đúng, con thụt thêm một bậc; `locs[0]` trỏ thẻ bọc                                                                        | R-SE-27                   |
| 10  | Wrap 2 phần tử không liền nhau; wrap gốc `return`                                                                                   | E016 `notContiguous`; E023 `rootElement`                                                                                                                              | R-SE-27, R-SE-21          |
| 11  | Unwrap `<div className="flex">` có 2 con; unwrap `<div id="x">`; unwrap `<Card>`; unwrap `<p/>` rỗng                                | Con thụt lùi một bậc thay chỗ thẻ; `attributesDropped`; E023 `componentTag`; E016 `nothingToUnwrap`                                                                   | R-SE-28                   |
| 12  | Unwrap gốc `return` có 2 con; có 1 con                                                                                              | E023 `rootElement`; một con thì làm được và file phân tích được                                                                                                       | R-SE-28                   |
| 13  | CRLF + BOM + tab: move, wrap, unwrap                                                                                                | Giữ BOM, `\r\n`, tab                                                                                                                                                  | R-SE-10                   |
| 14  | `GET /source/element-text` cho `<section>` dùng `Card` và `Button` (2 câu import) thụt 4                                            | `jsx` dòng đầu không thụt, dòng sau thụt tương đối; `imports` đúng 2 câu nguyên văn                                                                                   | R-SE-30                   |
| 15  | **Đi hết file thật** (như #14 lượt 2): mỗi phần tử hợp lệ có anh em sau cùng file: move xuống rồi move lên lại                      | Đúng từng byte                                                                                                                                                        | R-SE-24                   |
| 16  | **Đi hết file thật:** mỗi phần tử hợp lệ: wrap `column` rồi unwrap thẻ bọc (theo `locs[0]`)                                         | Đúng từng byte                                                                                                                                                        | R-SE-27, R-SE-28          |
| 17  | `siblingMoveTarget`: anh em khác file bị bỏ; phần tử đầu thì Lên trả `undefined`; nút cùng `loc` (vòng `.map`) bị bỏ                | Đúng                                                                                                                                                                  | R-SE-24                   |
| 18  | Component `StructureActions`: bấm Lên gọi `move` với đích tính từ tree; Bọc chọn Lưới gọi `wrap` `grid`; Bỏ bọc khóa với tag `Card` | Đúng                                                                                                                                                                  | R-SE-24, R-SE-27, R-SE-28 |

Test #15 và #16 gồm cả tab, CRLF nếu có file như vậy trong fixture. Ghi số file và số phần tử đã đi qua vào báo cáo, dùng `toBeGreaterThanOrEqual` (không viết cứng số đúng).

## 6. Kiểm tay (chủ dự án)

Trên dự án mới (Oakline):

1. Chọn thẻ sản phẩm thứ 3, bấm **↑ Lên** hai lần: thẻ lên đầu lưới; Undo hai lần về như cũ (`git diff` rỗng).
2. Chọn đoạn mô tả trong hero, **Bọc → Hàng**: có `div flex` bọc ngoài, phần tử bọc được chọn; **Bỏ bọc**: về đúng như cũ.
3. Chọn lưới sản phẩm, **Bỏ bọc**: 3 thẻ nằm thẳng trong `section`; Undo.
4. Chọn `ProductCard` thứ nhất (thẻ trong `Card.tsx`): Lên/Xuống bị khóa hoặc báo lý do; không làm hỏng file nào.

Trên WorkTracker:

5. Đổi thứ tự 2 trường trong form đăng nhập bằng Lên/Xuống, rồi Undo: file về đúng như cũ.
6. Bọc một nhóm nút bằng Lưới rồi Undo.

## 7. Bẫy đã biết

- **Toạ độ gốc:** mọi `TextEdit` của một file tính trên code **gốc** của file đó. Không áp dụng nối tiếp rồi tính lại vị trí.
- **Move cùng file kề nhau:** vùng xóa của phần tử là cả dòng (kể cả `nl`), nên đích `sibling before` phần tử ngay sau nằm đúng **cuối** vùng xóa. Chèn tại `ref.start` (đầu chữ, sau thụt lề) nằm ngoài vùng xóa. Không được đổi `applyTextEdits` để chấp nhận overlap.
- **Thụt lề khi đổi cha:** dùng `elementText` rồi `formatInsertedJsx`. Không cộng trừ số dấu cách thủ công.
- **Import:** không dùng `node:path` theo hệ điều hành; đường dẫn trong code luôn là `/`, nên dùng `path.posix`.
- **Anh em trong `treeNodes`:** nút do `.map` sinh ra có cùng `loc`. Không coi chúng là anh em để đổi chỗ, vì chúng là một phần tử trong nguồn.
- **Không đổi hành vi lượt 2.** Test cũ của `structure.test.ts`, `structure-format.test.ts` phải xanh nguyên văn.

## 8. Báo cáo và commit

Theo mẫu `README.md`. Ghi số file và số phần tử ở test #15, #16; kết quả kiểm tay bước 4.

Không chạy `pnpm test:e2e`.

```text
feat(server): move, wrap and unwrap jsx elements with their imports
```
