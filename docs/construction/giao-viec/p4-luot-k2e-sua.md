# Phase 4 — Lượt K2e (sửa sau QA): sửa token bằng AST, `@media` lồng, selector có ngoặc

Đọc `README.md` cùng thư mục và `p4-luot-k2e-token-sass-less.md` trước. Lượt này chỉ sửa 3 lỗi QA tìm ra trong code K2e; không thêm tính năng.

## 0. Claude đã sửa trong lúc QA (không làm lại)

- Kiểu của `postcss-less`: bỏ `postcss-less.d.ts`, dùng gói `@types/postcss-less` (devDependency của `packages/server`), `import postcssLess from 'postcss-less'`; `parseStylesheet` kiểm `parsed.type === 'root'`.
- `token-service.ts` `editTokens`: tính lại nội dung mới **trong** khóa file (trước đây đọc ngoài khóa, có thể ghi đè thay đổi của editor).
- `token-service.ts`: hệ chính `cssModules` dùng adapter CSS (trước đây Brand trống).

## 1. Lỗi 1 — Token đọc/sửa bằng regex trên cả file (nặng)

**Hiện tại:** `tokens-css.ts`, `tokens-sass.ts`, `tokens-less.ts`, `tokens-bootstrap.ts` tìm và sửa biến bằng `RegExp` trên toàn file (`modifyExistingCssVar`, `declRe`, `lineRe`…).

**Hậu quả người dùng thấy:**

- CSS: `.dark { --brand-blue: #000; }` đứng trước `:root { --brand-blue: #1d4ed8; }` → sửa `brand-blue` trong Brand lại đổi khối `.dark`. Comment `/* --brand-blue: cũ; */` trước `:root` cũng bị sửa.
- Sass: `// $brand: #000;` hoặc `.a { $brand: red; }` đứng trước `$brand` cấp cao → sửa nhầm dòng đó.
- Less, Bootstrap: tương tự.

**Sửa:**

- Tạo `packages/server/src/core/style/tokens/variable-edit.ts`, dùng `parseStylesheet(text, file)` của `css-locate.ts`:
  - `listVariables(text, file, scope): VariableNode[]` với `scope`: `'root'` (khai báo `--*` trực tiếp trong rule có selector đúng `:root` ở cấp cao nhất), `'sass'` (khai báo `$*` là con trực tiếp của `Root`), `'less'` (`AtRule` có `variable: true` là con trực tiếp của `Root`; kiểu `LessVariableAtRule`/`VariableAtRule` của `@types/postcss-less`, không ép kiểu). Mỗi phần tử: `variable` (tên đầy đủ: `--x`, `$x`, `@x`), `value` (không gồm `!default`), `start`, `end` (offset trong văn bản gốc, lấy từ `node.source.start.offset` / `node.source.end.offset`).
  - `setVariable(text, file, scope, variable, value): Result<string>`: thay **đúng phần giá trị** của node tìm được (giữ `!default`, `!important`, khoảng trắng, dấu `;`).
  - `removeVariable(text, file, scope, variable): Result<string>`: xóa node; nếu node nằm một mình trên dòng thì xóa cả dòng (gồm xuống dòng `\r\n` hoặc `\n`).
  - `insertVariable(...)`: giữ logic chèn hiện có (cuối `:root`, sau biến cấp cao cuối, trước dòng import Bootstrap), nhưng vị trí tính từ AST.
  - **BOM:** postcss bỏ BOM khi parse nên offset lệch 1; tách BOM ra trước, sửa phần còn lại, ghép lại.
  - Không có node → `err({ code: 'E016', params: { reason: 'tokenNotFound' } })`.
- 4 adapter dùng `variable-edit.ts` cho **cả đọc lẫn sửa**; xóa mọi regex tìm khai báo biến. Regex chỉ còn được dùng cho `countUses` (đếm chỗ dùng trong file nguồn) và `BOOTSTRAP_IMPORT_RE`.
- Gộp code lặp: `escapeRegExp` (đang có 4 bản), `kindPrefix`, `targetBucket`/`getBucketForKind`, `TokenBuckets`/`emptyBuckets`/`pushTokenToBucket` → một chỗ (`tokens/token-buckets.ts`), các file khác import.

## 2. Lỗi 2 — `@media` lồng trong rule làm hỏng cây cú pháp

**Hiện tại:** `walkRulesWithMedia` (`css-locate.ts`) gặp `.card { @media (…) { padding: 8px; } }` thì tạo rule giả `postcss.rule({ selector: container.selector, nodes: directDecls })`. `postcss.rule({ nodes })` **chuyển** các khai báo ra khỏi khối `@media` gốc (postcss gỡ node khỏi cha cũ khi append). Selector của rule giả lại là selector **chưa giải lồng**.

**Hậu quả:** đọc nguồn đúng, nhưng "tất cả N" ở khung mobile sửa vào rule giả → file không đổi, hoặc ghi sai chỗ.

**Sửa:** không tạo rule giả. Hàm duyệt trả về **vùng chứa khai báo** (`Rule` hoặc `AtRule` `@media` lồng) kèm `selector` đã giải lồng (`resolvedSelector` của rule cha) và chuỗi `media`. `css-edit.ts` sửa khai báo trực tiếp trên vùng chứa đó (kiểu `Container`), không clone. Không đổi kết quả đọc của các test hiện có.

## 3. Lỗi 3 — Selector có `(` bị coi là không sửa được

**Hiện tại:** `resolvedSelector` trả `undefined` khi selector chứa `(` ở bất kỳ đâu, nên `.item:nth-child(2)`, `.a:not(.b)`, `:is(.x, .y) p` trong `.scss`/`.less` thành chỉ đọc.

**Sửa:** chỉ coi là không sửa được khi là **định nghĩa mixin Less** (`/^[.#][\w-]+\s*\(/` trên selector của chính rule đó hoặc rule cha) hoặc có nội suy `#{` / `@{`. Ngoặc của pseudo-class giữ nguyên.

## 4. Test (bắt buộc, gắn mã trong tên)

| #   | File                              | Tình huống → kết quả                                                                                                                 | Mã               |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | `tokens/variable-edit.test.ts`    | CSS có comment `/* --brand-blue: x; */` và `.dark { --brand-blue: #000; }` trước `:root` → `set` chỉ đổi dòng trong `:root`          | R-ST-11          |
| 2   | như trên                          | Sass có `// $brand: x;` và `.a { $brand: red; }` trước `$brand: #e11d48 !default;` → `set` đổi dòng cấp cao, giữ `!default`          | R-ST-11          |
| 3   | như trên                          | Less `@brand` trong rule và cấp cao → chỉ cấp cao được đọc/sửa; `remove` xóa cả dòng, file CRLF giữ từng byte phần còn lại           | R-ST-11          |
| 4   | như trên                          | File có BOM: `set` đúng vị trí, BOM giữ nguyên                                                                                       | R-ST-11, R-TH-11 |
| 5   | `tokens/tokens-bootstrap.test.ts` | Chế độ CSS: `.btn { --bs-primary: red; }` trước `:root` → `set primary` chỉ đổi trong `:root`                                        | R-ST-11          |
| 6   | `tokens/token-service.test.ts`    | Hệ chính `cssModules` → Brand đọc biến `:root` của CSS toàn cục (`system: 'css'`)                                                    | R-ST-11          |
| 7   | `style/css-locate.test.ts`        | `.card { @media (max-width: 640px) { padding: 8px; } }`: sau khi duyệt, cây cú pháp in lại **giống hệt** văn bản gốc                 | R-ST-09          |
| 8   | `style/style-apply.test.ts`       | `.scss` "tất cả" ở khung có `media`, rule thắng là `@media` lồng → khai báo trong khối `@media` lồng đổi, phần còn lại giữ từng byte | R-ST-09          |
| 9   | `style/css-locate.test.ts`        | `.list { .item:nth-child(2) { … } }` → `resolvedSelector` `.list .item:nth-child(2)`; `.m() { … }` (Less) → `undefined`              | R-ST-04          |

Test cũ phải xanh nguyên; nếu test cũ đang kiểm hành vi sai ở trên (ví dụ chấp nhận sửa nhầm) thì báo trong báo cáo, không tự nới.

## 5. Không được làm

- Không sửa `e2e/`, `docs/spec.md`, Studio (trừ khi test cũ cần), chat, MCP.
- Không thêm dependency.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không đụng các chỗ Claude đã sửa ở mục 0, trừ khi chuyển code lặp sang `token-buckets.ts`.
- File ≤ 400 dòng.

## 6. Báo cáo

- File tạo/sửa/xóa.
- Bảng 9 tình huống: tên test đúng như trong code, đạt/không.
- `pnpm verify`: số test, lỗi/cảnh báo lint, typecheck.
- Kiểm tay trong ứng dụng thật: mở `fixtures/projects/react-sass`, sửa token `brand` trong Brand, sửa `font-size` của tiêu đề thẻ (rule lồng) ở khung Mobile.

Không tự commit. Commit message đề xuất (cùng commit với K2e): `feat(server): brand tokens for every style system, edit sass and less`.
