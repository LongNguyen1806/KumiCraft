# Phase 4 — Lượt K2c: Lớp style cho CSS Modules (đọc và sửa) (R-ST-02, R-ST-04, R-ST-06, R-ST-08)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

## 0. Bối cảnh

Lớp style (ADR-BE-35, SPEC-04 mục 25.2) đã có cho **CSS thường** (lượt K2a, K2b, Claude làm):

- Bridge gửi `style-probe-result`: các rule khớp phần tử theo thứ tự cascade, kèm file nguồn (`data-vite-dev-id`).
- Server đọc nguồn từng thuộc tính (`POST /style/read`) và ghi một thay đổi (`POST /style/apply`), một mục lịch sử.
- Inspector có `CssStyleEditor`: ô giá trị, công tắc "Sửa: tất cả N phần tử / chỉ phần tử này" (mặc định "tất cả").

Lượt này làm **CSS Modules** chạy giống hệt như vậy (nguyên tắc style-parity: mọi hệ CSS như nhau, không có "chế độ rút gọn").

Khác biệt duy nhất của CSS Modules: tên class trong trang **đã băm** (ví dụ `_card_1x2ab_1`), cách băm tùy cấu hình dự án. Vì vậy **không tìm rule theo selector** mà theo **thứ tự rule trong file**: Vite giữ nguyên thứ tự rule khi chuyển `.module.css` thành `<style>`.

Không sửa: Tailwind (Inspector Tailwind cũ), `e2e/`, `docs/spec.md` (Claude đã sửa R-ST-08), chat AI, MCP.

## 1. Mục tiêu (người dùng thấy gì)

Mở một dự án React + Vite dùng `Card.module.css` và `className={styles.card}`:

1. Chọn một thẻ trên Canvas (hoặc trong cây Lớp) → Inspector, mục **"Nguồn kiểu dáng"**, hiện `padding-top 16px · src/components/Card.module.css:2 · Ảnh hưởng 3 phần tử`. Dòng là dòng thật trong file `.module.css`, không phải tên băm.
2. Ô giá trị **sửa được** (hôm nay CSS Modules chỉ đọc, có banner "chưa hỗ trợ"; banner này mất với CSS Modules).
3. **"Tất cả N phần tử":** đổi đúng khai báo trong rule của file `.module.css`; ba thẻ cùng đổi; Undo một lần trả về đúng từng byte.
4. **"Chỉ phần tử này":**
   - file `.module.css` có thêm rule `.card_rc1a2b { padding-top: 24px; }` ở cuối;
   - JSX `className={styles.card}` thành ``className={`${styles.card} ${styles.card_rc1a2b}`}``;
   - lần sửa sau trên phần tử đó sửa thẳng rule `card_rc1a2b`, không tạo thêm class;
   - một mục lịch sử cho cả hai file.
5. `className={cn(styles.a, x)}` hoặc dạng khác → ô bị khóa, có lý do (L-01), không ghi gì.
6. Khung Mobile: như CSS thường (rule thắng đã nằm trong `@media` thì sửa tại chỗ; không thì ghi vào `@media` của khung).

## 2. Đọc trước (CW-52)

| File                                                                                                                                                                       | Lý do                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `docs/spec.md` mục 25.2 (R-ST-01 đến R-ST-16, nhất là R-ST-08 đã sửa 2026-10-24), ADR-BE-35                                                                                | Hợp đồng                                                                                                   |
| `docs/construction/spec-log.md` #60 đến #62                                                                                                                                | Quyết định của K2a, K2b                                                                                    |
| `packages/shared/src/style.ts`                                                                                                                                             | `MatchedRule`, `StyleReading`, `StyleChange`, `CSS_LONGHAND_OF`, `CSS_SHORTHANDS_OF`, `mediaForBreakpoint` |
| `packages/bridge/src/client/style-probe.ts` + `.test.ts`                                                                                                                   | Cách Bridge đi qua sheet, đếm `occurrence`, `position`                                                     |
| `packages/server/src/core/style/css-locate.ts`, `css-edit.ts`, `style-service.ts`, `style-apply.ts` + test                                                                 | Đọc, ghi CSS thường: **làm CSS Modules theo đúng khuôn này**                                               |
| `packages/server/src/adapters/http/routes/style.ts`                                                                                                                        | Endpoint, ghi lịch sử                                                                                      |
| `packages/server/src/core/source-editor/source-editor-lookup.ts` (`findNodeAt`, `computeSha256`), `ast-helpers.ts` (`parseJsxAst`, `getJsxTagName`), `attribute-reader.ts` | Tìm thẻ JSX theo `loc`, đọc `className`                                                                    |
| `packages/studio/src/features/inspector/components/style-sources-section.tsx`, `features/style/*`                                                                          | `CssStyleEditor`, `WRITABLE`                                                                               |
| `fixtures/projects/react-css/`                                                                                                                                             | Mẫu fixture để chép                                                                                        |

## 3. Hợp đồng

### 3.1. Bridge: `ruleIndex` (`packages/shared/src/style.ts`, `packages/bridge/src/client/style-probe.ts`)

- `MatchedRuleSchema` thêm `ruleIndex: z.number().int().min(0)`: thứ tự (từ 0) của rule này trong **sheet của nó**, tính mọi `CSSStyleRule` theo thứ tự tài liệu, **kể cả rule trong `@media` không áp dụng** và rule trong `@supports`/`@layer`. Đây đúng là thứ tự `walkRulesWithMedia` của server đi qua file nguồn.
- Đếm trong `walkRules`/`visitStyleRule`/`countUnmatched` hiện có (thêm một bộ đếm riêng cho mỗi sheet, khác `position` là thứ tự toàn trang).
- Sau khi sửa shared hoặc bridge: `pnpm --filter @reactcraft/bridge build`.

### 3.2. Server đọc (`packages/server/src/core/style/`)

- `css-locate.ts`: thêm `findRuleByIndex(root, index): Rule | undefined` (rule thứ `index` theo `walkRulesWithMedia`) và `locateRuleByIndex(css, index, longhands): LocatedRule | undefined`.
- `style-service.ts`, hàm `ruleSource`: file là `*.module.css` (`systemOfFile(file) === 'cssModules'`) → dùng `locateRuleByIndex(css, rule.ruleIndex, [longhand])`. `selector` trả về trong `StyleSource` là **selector trong file nguồn** (`.card`), không phải tên băm. Các file khác giữ cách cũ (theo selector).
- `primarySystem`: đã trả `cssModules` khi dự án có CSS Modules; giữ nguyên.

### 3.3. Server ghi (`packages/server/src/core/style/`)

Tạo **`style-apply-modules.ts`** (giữ `style-apply.ts` dưới 400 dòng). `style-apply.ts` gọi sang khi rule thắng nằm trong `*.module.css` hoặc khi phần tử có `className` dạng `styles.x`:

- **`target: 'rule'`:** như CSS thường nhưng tìm rule bằng `ruleIndex`.
  - Thêm vào `css-edit.ts` hàm `setDeclarationAt(css, ruleIndex, property, value)`: cùng thân với `setRuleDeclaration`, khác cách tìm rule. **Tách phần thân chung** để hai hàm cùng dùng, không chép code.
  - Khung có `media` mà rule thắng chưa nằm trong `@media` → `appendRule(css, '<selector trong file>', …, media)`.
- **`target: 'element'`:**
  1. Đọc file JSX của phần tử, `parseJsxAst`, `findNodeAt(line, column)`, lấy thuộc tính `className`.
  2. Nhận 2 dạng (dạng khác → `err({ code: 'E016', params: { reason: 'expression' } })`):
     - `{X.y}` hoặc `{X['y']}` (`MemberExpression`, `X` là định danh);
     - template literal chỉ gồm `${X.y}` cách nhau bởi một dấu cách (`` `${styles.a} ${styles.b}` ``).
  3. Class riêng đã có: một biểu thức trong đó có tên khớp `/_rc[a-z0-9]{4}$/`, và rule của nó có trong probe (dò theo `ruleIndex` + file) → sửa thẳng rule đó như `target: 'rule'`.
  4. Chưa có: tên mới `<y đầu tiên>_rc<4 ký tự a-z0-9>` (cùng `newId` tiêm được như `style-apply.ts`):
     - thêm rule `.<tên mới> { <longhand>: <value>; }` cuối file `.module.css` mà `X` được import từ đó (tìm `import X from './….module.css'` trong file JSX), theo `appendRule` (có `media` thì vào khối `@media`);
     - sửa `className` thành template literal: `{X.y}` → ``{`${X.y} ${X.<tên mới>}`}``; template literal có sẵn → nối thêm ` ${X.<tên mới>}` trước dấu `` ` `` cuối.
  5. Sửa JSX bằng **thay đúng đoạn** giá trị thuộc tính (từ `start` tới `end` của `JSXExpressionContainer`), rồi `parseJsxAst` lại kết quả; parse lỗi → `err({ code: 'E024', … })`, không ghi.
  6. Ghi file như `writeFile` trong `style-apply.ts` (trả `WrittenFile` với `before`, `after`, hash). Một lần gọi trả **mọi file đã ghi**, route gộp thành **một** mục lịch sử (đã có sẵn).
- Giá trị: dùng `StyleChangeSchema` có sẵn (đã chặn `;`, `{`, `}`, `/*`).

### 3.4. Studio (`packages/studio/src/features/inspector/components/style-sources-section.tsx`)

- `WRITABLE` thêm `'cssModules'`. Không đổi gì khác: công tắc, ô nhập, `useStyleCommit` dùng chung.

### 3.5. Fixture `fixtures/projects/react-css-modules/`

Chép cấu trúc `fixtures/projects/react-css/`, đổi `id` trong `.reactcraft/workspace.json` (đúng 10 ký tự `[A-Za-z0-9_-]`, ví dụ `e2emods001`), `name` "React CSS Modules Fixture":

- `src/components/Card.module.css`: `.card { padding: 16px; border-radius: 8px; }` và `@media (max-width: 640px) { .card { padding: 8px; } }`.
- `src/components/Card.tsx`: `import styles from './Card.module.css';`, `<article className={styles.card}>`.
- `src/pages/Home.module.css`: `.lead { font-size: 18px; }`.
- `src/pages/Home.tsx`: `<h1>Sản phẩm</h1>`, hai `<p className={styles.lead}>`, ba `<Card>`.

## 4. Tình huống test (bắt buộc, ≤ 15, gắn mã trong tên test)

| #   | File test                                                          | Tình huống → kết quả                                                                                                                                                                                    | Mã               |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `bridge/src/client/style-probe.test.ts`                            | Sheet có rule A, `@media` không áp dụng chứa rule B, rule C → C có `ruleIndex: 2` (B vẫn được đếm)                                                                                                      | R-ST-04          |
| 2   | `server/src/core/style/style-service.test.ts` (thêm)               | Probe rule từ `D:/…/Card.module.css` với selector băm `._card_x1_1`, `ruleIndex: 0` → `source.file` `src/components/Card.module.css`, `line` của `padding`, `selector: '.card'`, `system: 'cssModules'` | R-ST-04, R-ST-08 |
| 3   | `css-locate` (thêm vào `style-service.test.ts` hoặc file test mới) | `locateRuleByIndex` trên CSS có `@media`: chỉ số 1 là rule trong `@media`                                                                                                                               | R-ST-04          |
| 4   | `css-edit.test.ts` (thêm)                                          | `setDeclarationAt` đổi tại chỗ / thêm dòng cuối; chỉ số không có → E016 `ruleNotFound`                                                                                                                  | R-ST-06          |
| 5   | `style-apply-modules.test.ts` (mới, file thật trong thư mục tạm)   | "Tất cả": chỉ file `.module.css` đổi; `files` có một file, `before` là nội dung cũ                                                                                                                      | R-ST-06, R-ST-15 |
| 6   | như trên                                                           | "Tất cả" ở khung có `media`, rule thắng không có `@media` → rule `.card` mới trong khối `@media`                                                                                                        | R-ST-09          |
| 7   | như trên                                                           | "Chỉ phần tử này" lần đầu: JSX thành template literal, rule `.card_rcab10` cuối file module, `className` trả về, 2 file trong một kết quả                                                               | R-ST-08          |
| 8   | như trên                                                           | Lần hai trên cùng phần tử (probe có rule của `card_rcab10`) → sửa rule đó, không thêm class, JSX không đổi                                                                                              | R-ST-08          |
| 9   | như trên                                                           | `className={`${styles.a} ${styles.b}`}` → nối thêm `${styles.<mới>}`                                                                                                                                    | R-ST-08          |
| 10  | như trên                                                           | `className={cn(styles.a, x)}` → E016 `expression`, không file nào đổi                                                                                                                                   | R-ST-08, L-01    |
| 11  | như trên                                                           | JSX có CRLF và tab: phần còn lại của file giữ nguyên từng byte                                                                                                                                          | R-ST-06          |
| 12  | `style-sources-section.test.tsx` (thêm)                            | `primary: 'cssModules'` → ô nhập bật, không có banner `inspector-style-unsupported`                                                                                                                     | R-ST-02          |

## 5. Bẫy đã biết

- **Không** khớp selector băm với selector trong file bằng regex tên (`_card_…`): cách băm tùy dự án. Chỉ dùng `ruleIndex`.
- `ruleIndex` phải đếm **mọi** rule thường, kể cả trong `@media` không áp dụng; đếm sai lệch một là sửa nhầm rule.
- Vite bỏ `composes:` khỏi CSS chạy trong trang nhưng **rule vẫn còn**; không có rule nào bị thêm hay bớt. Không cần xử lý riêng, nhưng đừng xóa khai báo `composes`.
- Tên class mới phải là định danh JS hợp lệ (`card_rcab10`), không có `-`.
- `findNodeAt` cần `line`, `column` của `loc` (`parseLocString` trong `shared/src/source.ts`). Thẻ lấy từ mã nguồn, không tin `tag` của request (như `elementContext` trong `style-apply.ts`).
- Sửa JSX thì xuống dòng (`\r\n`/`\n`) và BOM của file giữ nguyên (`detectFormat`).
- `pnpm --filter @reactcraft/bridge build` sau khi đổi `shared` hoặc `bridge`, nếu không test `bridge-client-generated` đỏ.

## 6. Không được làm

- Không sửa `e2e/`, `docs/spec.md`, Inspector Tailwind (`inspector-panel.tsx` chỉ được đổi nếu thật cần, và phải báo lý do), chat, MCP.
- Không thêm dependency.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null` (QC-40).
- Không nới test cũ cho xanh. Test cũ đỏ vì đổi hợp đồng (ví dụ `MatchedRule` có thêm `ruleIndex`) thì **chỉ thêm trường đó** vào dữ liệu test, và ghi vào báo cáo.

## 7. Kiểm tay

1. `npm run dev`, mở `fixtures/projects/react-css-modules` (chép ra thư mục tạm trước khi mở), tin cậy.
2. Chọn thẻ "Bàn phím" trong cây Lớp → "Nguồn kiểu dáng" có `src/components/Card.module.css:<dòng>` và "Ảnh hưởng 3 phần tử".
3. Đổi `padding-top` thành 24px ("tất cả") → 3 thẻ đổi; Undo → file về như cũ.
4. Chọn đoạn "lead" đầu, "chỉ phần tử này", `font-size` 22px → chỉ đoạn đầu đổi; `Home.tsx` có template literal; Undo trả cả hai file.

## 8. Báo cáo

Theo mẫu của README:

- danh sách file tạo/sửa;
- bảng 12 tình huống, mỗi tình huống: tên test thật, đạt/không;
- kết quả `pnpm verify` (số test, cảnh báo lint);
- các bước kiểm tay đã thử.

Không tự commit; đề xuất commit message `feat(server): read and edit css modules through the style layer` (đã qua commitlint).
