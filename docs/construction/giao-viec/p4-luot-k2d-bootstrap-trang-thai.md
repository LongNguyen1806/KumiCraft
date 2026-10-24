# Phase 4 — Lượt K2d: Bootstrap 5, trạng thái hover/focus/disabled, xem trước khi gõ (R-ST-09, R-ST-10, R-ST-13)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

## 0. Bối cảnh

Lớp style (ADR-BE-35, SPEC-04 mục 25.2) đã đọc và sửa được **CSS thường** (K2a, K2b) và **CSS Modules** (K2c):

- Bridge gửi `style-probe-result`: các rule khớp phần tử theo cascade, kèm file nguồn và `ruleIndex`.
- Server: `POST /style/read` (nguồn từng thuộc tính), `POST /style/apply` (một thay đổi, một mục lịch sử).
- Studio: `CssStyleEditor` trong `style-sources-section.tsx`, ô giá trị, công tắc "tất cả N phần tử / chỉ phần tử này", Enter mới ghi.

Lượt này làm 3 việc, đều theo nguyên tắc style-parity (mọi hệ CSS như nhau, không có "chế độ rút gọn"):

1. **Bootstrap 5:** đọc nguồn là class utility (`pt-3`), sửa bằng đổi class utility khi giá trị đúng thang, không đúng thang thì rơi về CSS thường.
2. **Trạng thái** `:hover`, `:focus`, `:disabled` cho CSS thường, CSS Modules, Bootstrap (Bootstrap không có utility trạng thái nên luôn ghi CSS).
3. **Xem trước khi gõ** (R-ST-13): gõ trong ô giá trị là phần tử trên Canvas đổi ngay; Enter mới ghi file; Esc trả về như cũ.

Không sửa: Tailwind (Inspector Tailwind cũ, `inspector-panel.tsx` trừ khi thật cần), `e2e/`, `docs/spec.md` (Claude đã sửa R-ST-09), chat AI, MCP.

## 1. Mục tiêu (người dùng thấy gì)

Mở một dự án React + Vite có `import 'bootstrap/dist/css/bootstrap.min.css'`:

1. Chọn thẻ có `className="card p-3"` → "Nguồn kiểu dáng" hiện `padding-top 16px · class p-3` (không phải "bên ngoài"), ô **sửa được**.
2. Gõ `24px` vào `padding-top` → Canvas đổi ngay (xem trước), file chưa đổi. Enter → JSX thành `className="card p-3 pt-4"`; một mục lịch sử; Undo trả đúng từng byte.
3. Gõ `20px` (không đúng thang Bootstrap) → ghi như CSS thường "chỉ phần tử này": class riêng `card-xxxx` + rule trong file CSS (đúng như K2b).
4. Khung `md` của dự án `mobile-first` → `pt-md-4`. Dự án `desktop-first` (khung có `max-width`) → không có utility, rơi về CSS thường với `@media`.
5. Ô **Trạng thái** (Mặc định / Hover / Focus / Disabled) trên mục "Nguồn kiểu dáng". Chọn Hover, đổi `background-color` → CSS có `.btn-buy:hover { background-color: … }`; mục nguồn đọc rule `:hover` đó ở lần sau.
6. Esc khi đang gõ → Canvas về như cũ, không ghi gì.

## 2. Đọc trước (CW-52)

| File                                                                                                     | Lý do                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/spec.md` mục 25.2 (R-ST-01 đến R-ST-16, nhất là R-ST-09, R-ST-10, R-ST-13)                         | Hợp đồng                                                                                                                                                                    |
| `docs/construction/spec-log.md` #62, #63                                                                 | Quyết định K2b và lượt này (ánh xạ breakpoint Bootstrap)                                                                                                                    |
| `packages/shared/src/style.ts`, `responsive.ts`                                                          | `StyleChangeSchema`, `StudioStyleProbePayloadSchema`, `mediaForBreakpoint`, `BREAKPOINT_WIDTHS`                                                                             |
| `packages/bridge/src/client/style-probe.ts` + test, `studio-messages.ts`, `free-frame/preview-styles.ts` | Cách probe đi qua sheet; cách nhận tin từ Studio; mẫu lưu/trả style nội tuyến                                                                                               |
| `packages/server/src/core/style/*.ts` + test                                                             | `style-service.ts` (`ruleSource`, `winnerFor`), `style-apply.ts` (`elementContext`, `addClass`, `applyToElement`), `style-apply-modules.ts`, `css-edit.ts`, `css-locate.ts` |
| `packages/studio/src/features/style/*`, `features/selection/bridge-channel.ts` (`style-probe`)           | Probe, commit, store công tắc                                                                                                                                               |
| `packages/studio/src/features/inspector/components/style-sources-section.tsx`                            | `CssStyleEditor`, `StyleRow`, `WRITABLE`                                                                                                                                    |
| `fixtures/projects/react-css/`                                                                           | Mẫu fixture để chép                                                                                                                                                         |

## 3. Hợp đồng

### 3.1. Shared (`packages/shared/src/style.ts`)

- `export const STYLE_STATES = ['hover', 'focus', 'disabled'] as const;` và `StyleStateSchema = z.enum(STYLE_STATES)`.
- `StudioStyleProbePayloadSchema` thêm `state: StyleStateSchema.optional()`.
- `StyleChangeSchema` thêm `state: StyleStateSchema.optional()`.
- Tin mới Studio → Bridge (đặt cạnh `style-probe`):
  - `style-preview`: `StudioStylePreviewPayloadSchema = z.strictObject({ ref: ElementRefSchema, property: z.string().min(1).max(100) /* longhand */, value: CssValueSchema })`.
  - `style-preview-clear`: `StudioStylePreviewClearPayloadSchema = z.strictObject({})` (trả mọi phần tử đang xem trước).
- Sau khi sửa shared hoặc bridge: `pnpm --filter @kumicraft/bridge build`.

### 3.2. Bridge

**Probe theo trạng thái** (`style-probe.ts`). Khi `state` có:

- Rule có selector (một phần tử sau `splitSelectorList`) chứa `:<state>` được xét bằng `el.matches(<selector đã bỏ mọi ":<state>">)`; khớp thì vào danh sách như rule thường, độ ưu tiên tính trên **selector gốc** (có `:hover`, nên mạnh hơn rule không có).
- Rule thường vẫn xét như cũ. Không có `state` → hành vi giữ nguyên từng chi tiết (test cũ xanh nguyên).
- `ruleIndex`, `occurrence` đếm như cũ (rule `:hover` vốn đã được đếm).
- `computed`: khi có `state`, lấy giá trị từ rule thắng theo trạng thái nếu có (khai báo của rule đầu danh sách có longhand đó), không có thì `getComputedStyle` như cũ. Trình duyệt không cho ép `:hover`, nên đây là cách duy nhất.

**Xem trước** (file mới `client/style-preview.ts`, theo khuôn `PreviewStyles`):

- `apply(el, longhand, value)`: lần đầu với một cặp (phần tử, longhand) thì lưu `el.style.getPropertyValue(longhand)` và `getPropertyPriority(longhand)`; rồi `el.style.setProperty(longhand, value, 'important')` (để thắng utility Bootstrap vốn `!important`).
- `clearAll()`: trả mọi giá trị đã lưu (rỗng thì `removeProperty`).
- `studio-messages.ts`: thêm `case 'style-preview'` và `case 'style-preview-clear'`, parse bằng schema, gọi handler mới (`handleStylePreview?`, `handleStylePreviewClear?`). Phần tử tìm theo `ref` như `style-probe`.
- Đổi chọn phần tử, đổi route, `set-mode` → `clearAll()`.

### 3.3. Server đọc: Bootstrap (`packages/server/src/core/style/`)

Tạo **`bootstrap-utilities.ts`** (dữ liệu và hàm thuần, không I/O):

| Thuộc tính (`PropertyId`)      | Tiền tố utility     | Thang (giá trị CSS → hậu tố)                                                                                        | Có breakpoint |
| ------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------- |
| `paddingTop/Right/Bottom/Left` | `pt` `pe` `pb` `ps` | `0`→0, `4px`→1, `8px`→2, `16px`→3, `24px`→4, `48px`→5                                                               | có            |
| `marginTop/Right/Bottom/Left`  | `mt` `me` `mb` `ms` | như padding, thêm `auto`→auto                                                                                       | có            |
| `display`                      | `d`                 | `none` `inline` `inline-block` `block` `grid` `flex` `inline-flex` (hậu tố = giá trị)                               | có            |
| `flexDirection`                | `flex`              | `row` `column` `row-reverse` `column-reverse`                                                                       | có            |
| `justifyContent`               | `justify-content`   | `flex-start`→start, `flex-end`→end, `center`, `space-between`→between, `space-around`→around, `space-evenly`→evenly | có            |
| `alignItems`                   | `align-items`       | `flex-start`→start, `flex-end`→end, `center`, `baseline`, `stretch`                                                 | có            |
| `textAlign`                    | `text`              | `left`/`start`→start, `center`, `right`/`end`→end                                                                   | có            |
| `fontWeight`                   | `fw`                | `300`→light, `400`→normal, `500`→medium, `600`→semibold, `700`→bold                                                 | không         |
| `fontSize`                     | `fs`                | `40px`→1, `32px`→2, `28px`→3, `24px`→4, `20px`→5, `16px`→6                                                          | không         |
| `borderRadius`                 | `rounded`           | `0`→0, `4px`→1, `6px`→2, `8px`→3, `16px`→4, `32px`→5                                                                | không         |

- Giá trị so sau khi chuẩn hóa: bỏ khoảng trắng, chữ thường, `rem` đổi sang px theo 16px, `0px` = `0`.
- Hàm cần có:
  - `parseUtility(className): { property: string; breakpoint?: 'sm'|'md'|'lg'|'xl'|'xxl'; suffix: string } | undefined` — nhận cả dạng có breakpoint (`pt-md-3`, `d-lg-flex`).
  - `utilityFor(property, cssValue, breakpoint?): string | undefined` — tên class khi giá trị đúng thang, `undefined` khi không.
  - Dạng gộp `p-3`, `px-3`, `py-3`, `m-3`, `mx-3`, `my-3` cũng được `parseUtility` nhận (property là longhand của cạnh tương ứng, dùng khi **đọc** nguồn); khi **ghi** luôn dùng dạng một cạnh (`pt-4`).
- Màu (`text-primary`, `bg-*`) không làm ở lượt này: giá trị màu Bootstrap phụ thuộc biến theme; làm cùng token ở K2e. Màu trong dự án Bootstrap đi đường CSS thường.

`style-service.ts`, hàm `ruleSource`: rule thắng **không thuộc dự án** (sheet `link` có `href` chứa `bootstrap`, hoặc `module` có id trong `node_modules/bootstrap/`), selector là **một class** (`/^\.[\w-]+$/`, Vite có thể giữ `.pt-3` nguyên) và `parseUtility` nhận class đó → `source: { kind: 'class', system: 'bootstrap5', className }`, `editable: true`. Rule Bootstrap khác (`.card`, `.btn`) giữ `external` như cũ nhưng **`editable: true`** khi dự án có hệ chính `bootstrap5` (sửa sẽ đi đường "chỉ phần tử này").

### 3.4. Server ghi: Bootstrap (`style-apply-bootstrap.ts` mới)

`style-apply.ts` gọi sang khi `primarySystem(project.styling) === 'bootstrap5'` (truyền `styling` vào `applyStyleChange` qua `StyleApplyDeps` hoặc tham số, chọn một cách và giữ cho route `style.ts` gọn), `change.state` không có, và `utilityFor(property, value, breakpoint)` trả tên class. Còn lại đi đường CSS thường như cũ.

- Breakpoint từ `change.media`: `(min-width: Npx)` → khóa có `BREAKPOINT_WIDTHS[k] === N`; ánh xạ `sm→sm`, `md→md`, `lg→lg`, `xl→xl`, `2xl→xxl`. `(max-width: …)` (desktop-first) → **không** dùng utility, đi CSS thường. Lý do ghi ở spec-log #63.
- Ghi: dùng `elementContext` và `addClass` của `style-apply.ts` (export ra, đổi `addClass` thành hàm nhận danh sách class mới, không chép code). `className` không tĩnh → E016 `expression` như cũ.
  - Bỏ class cùng **tiền tố một cạnh + cùng breakpoint** (`pt-2` khi ghi `pt-4`; `pt-md-2` khi ghi `pt-md-4`); không đụng `p-3`, `py-2` (utility một cạnh đứng sau trong CSS Bootstrap nên thắng).
  - Thêm class mới cuối danh sách. `value` rỗng (xóa) → chỉ bỏ class cùng tiền tố một cạnh + breakpoint; không có gì để bỏ → `ok({ files: [] })`.
  - Trả `className` là class mới.

### 3.5. Server ghi: trạng thái (CSS thường và CSS Modules)

Khi `change.state` có, selector ghi thêm `:<state>` (`:disabled` dùng nguyên tên):

- **`target: 'rule'`:** selector của rule thắng (trong file: `rule.selector` cho CSS thường; selector theo `ruleIndex` cho CSS Modules) đã chứa `:<state>` → sửa tại chỗ (như cũ). Chưa chứa → tìm rule có **đúng** selector `<sel>:<state>` (cùng `media`) trong cùng file: có thì sửa, không có thì `appendRule(css, '<sel>:<state>', …, media)`. Selector list (có dấu phẩy) → mỗi phần thêm `:<state>`.
- **`target: 'element'`:** class riêng như cũ (tạo hoặc dùng lại); rule ghi là `<selector của class riêng>:<state>`. Dùng lại class riêng: nhận ra rule của nó trong probe cả khi selector có `:<state>`.
- Bootstrap có `state` → luôn đi CSS thường "chỉ phần tử này".
- Thêm vào `css-edit.ts` hàm `findRuleBySelector(root, selector, media)` (so selector đã chuẩn hóa khoảng trắng) và dùng nó; không lặp lại code duyệt rule.

### 3.6. Studio

- `style-sources-section.tsx`:
  - `WRITABLE` thêm `'bootstrap5'`.
  - `SourceText` cho `source.kind === 'class'`: `class <className>` (chuỗi i18n mới `inspector.styleSources.class`).
  - Ô **Trạng thái** (select, `data-testid="style-state"`, nhãn vi/en: Mặc định/Default, Hover, Focus, Disabled) ngay dưới tiêu đề, chỉ hiện khi `writable`. Đổi trạng thái → probe lại với `state`; commit gửi `state`.
  - `StyleRow`: mỗi lần `onChange` gửi `style-preview` (giá trị rỗng hoặc không hợp lệ theo `CssValueSchema` thì `style-preview-clear`); Esc và blur không đổi gì → `style-preview-clear`. Khi đang ở trạng thái khác "Mặc định" **không** xem trước (trình duyệt không ép được `:hover`).
- Trạng thái chọn giữ theo phần tử như `style-target-store` (thêm trường vào store đó, không tạo store mới).
- `use-style-commit.ts`: sau `applyStyle` thành công, gửi `style-preview-clear` **trước** mỗi lần `refresh` (nếu không, probe đọc thấy style nội tuyến xem trước); lỗi → `style-preview-clear` ngay.
- `bridge-channel.ts`: thêm `sendStylePreview(ref, property, value)` và `clearStylePreview()` cạnh `style-probe`; `requestStyleProbe` nhận thêm `state?`.

### 3.7. Fixture `fixtures/projects/react-bootstrap/`

Chép `fixtures/projects/react-css/`, `id` mới đúng 10 ký tự (ví dụ `e2eboot001`), `name` "React Bootstrap Fixture", thêm `"bootstrap": "5.3.3"` vào `dependencies` của **fixture** (không phải package của KumiCraft):

- `src/main.tsx`: `import 'bootstrap/dist/css/bootstrap.min.css';` trước `./index.css`.
- `src/index.css`: `.btn-buy { background-color: #0d6efd; }`.
- `src/pages/Home.tsx`: `<h1 className="fs-2 fw-bold">Sản phẩm</h1>`, ba `<div className="card p-3 mb-3">`, một `<button className="btn btn-buy">Mua</button>`.

## 4. Tình huống test (bắt buộc, ≤ 18, gắn mã trong tên test)

| #   | File test                                            | Tình huống → kết quả                                                                                                                         | Mã               |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `bridge/src/client/style-probe.test.ts`              | `state: 'hover'`: rule `.a:hover{color:red}` và `.a{color:blue}` → `:hover` đứng đầu, `computed.color` là `red`                              | R-ST-09          |
| 2   | như trên                                             | Không có `state`: rule `.a:hover` không vào danh sách (giữ hành vi cũ)                                                                       | R-ST-04          |
| 3   | `bridge/src/client/style-preview.test.ts` (mới)      | `apply` hai lần rồi `clearAll` → `style` nội tuyến về đúng giá trị cũ (kể cả có sẵn `padding-top: 2px`)                                      | R-ST-13          |
| 4   | `bridge/src/client/studio-messages.test.ts` (thêm)   | `style-preview` sai schema (value có `;`) → handler không được gọi                                                                           | R-ST-13          |
| 5   | `server/src/core/style/bootstrap-utilities.test.ts`  | `parseUtility('pt-md-3')`, `parseUtility('p-3')`, `parseUtility('card')` → đúng / đúng / `undefined`                                         | R-ST-10          |
| 6   | như trên                                             | `utilityFor('paddingTop','1.5rem')` → `pt-4`; `utilityFor('paddingTop','20px')` → `undefined`; `utilityFor('fontWeight','700')` → `fw-bold`  | R-ST-10          |
| 7   | `server/src/core/style/style-service.test.ts` (thêm) | Probe rule `.p-3` sheet `node_modules/bootstrap/dist/css/bootstrap.min.css` → `source.kind 'class'`, `className 'p-3'`, `editable: true`     | R-ST-04, R-ST-10 |
| 8   | `style-apply-bootstrap.test.ts` (mới, thư mục tạm)   | `card p-3` + `paddingTop 24px` → `card p-3 pt-4`, chỉ file JSX đổi, `className: 'pt-4'`                                                      | R-ST-10          |
| 9   | như trên                                             | `card pt-2` + `paddingTop 24px` → `card pt-4` (bỏ `pt-2`)                                                                                    | R-ST-10          |
| 10  | như trên                                             | `media: '(min-width: 768px)'` → thêm `pt-md-4`, giữ `pt-2`                                                                                   | R-ST-09          |
| 11  | như trên                                             | `media: '(max-width: 767px)'` → không có utility, đi CSS thường (class riêng + rule trong `@media`)                                          | R-ST-09          |
| 12  | như trên                                             | `paddingTop 20px` → CSS thường "chỉ phần tử này" (class riêng `card-xxxx`)                                                                   | R-ST-10          |
| 13  | `style-apply.test.ts` (thêm)                         | CSS thường, `target 'rule'`, `state 'hover'`, rule thắng `.btn-buy` → thêm `.btn-buy:hover { … }`; lần hai sửa đúng rule đó, không thêm rule | R-ST-09          |
| 14  | như trên                                             | `target 'element'`, `state 'focus'` → rule `.<class riêng>:focus`, class riêng dùng lại ở lần sau                                            | R-ST-09          |
| 15  | `style-apply-modules.test.ts` (thêm)                 | CSS Modules, `state 'hover'`, `target 'rule'` → `.card:hover` cuối file `.module.css`                                                        | R-ST-08, R-ST-09 |
| 16  | `css-edit.test.ts` (thêm)                            | `findRuleBySelector` phân biệt rule cùng selector trong và ngoài `@media`                                                                    | R-ST-09          |
| 17  | `style-sources-section.test.tsx` (thêm)              | `primary: 'bootstrap5'`, source `class p-3` → ô bật, hiện `class p-3`, có ô `style-state`                                                    | R-ST-02          |
| 18  | `use-style-commit.test.ts` (mới hoặc thêm)           | Commit thành công → `clearStylePreview` được gọi trước `refresh`                                                                             | R-ST-13          |

## 5. Bẫy đã biết

- Utility Bootstrap đều `!important`: xem trước phải dùng `setProperty(…, 'important')`, nếu không Canvas không đổi.
- `winnerFor` đã xử lý `!important`; đừng sắp xếp lại rule ở server.
- `parseUtility` không được nhận nhầm class thành phần: `card`, `btn`, `text-muted`, `d-print-none` (print không phải breakpoint) → `undefined`.
- Bỏ `:hover` khỏi selector chỉ ở **phần tử cuối** của selector phức (`.nav a:hover` → `.nav a`); `:hover` nằm trong `:not(...)` thì bỏ qua rule đó.
- Probe với `state` vẫn chạy cùng giới hạn `MAX_RULES`.
- Sửa JSX giữ CRLF, tab, BOM (`detectFormat`), như K2c.
- Không gửi `style-preview` mỗi phím tới server: chỉ Bridge, không ghi file, không vào lịch sử.
- `pnpm --filter @kumicraft/bridge build` sau khi đổi `shared` hoặc `bridge`, nếu không test `bridge-client-generated` đỏ.

## 6. Không được làm

- Không sửa `e2e/`, `docs/spec.md`, Inspector Tailwind, chat, MCP.
- Không thêm dependency cho các package của KumiCraft (chỉ fixture có `bootstrap`).
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null` (QC-40).
- Không nới test cũ cho xanh. Test cũ đỏ vì hợp đồng có thêm trường thì **chỉ thêm trường đó** vào dữ liệu test, và ghi vào báo cáo.
- File mới ≤ 400 dòng; `style-apply.ts` không vượt 400 dòng.

## 7. Kiểm tay

1. Chép `fixtures/projects/react-bootstrap` ra thư mục tạm, `pnpm install` trong đó, `npm run dev` ở KumiCraft, mở dự án, tin cậy.
2. Chọn thẻ card đầu → `padding-top` có nguồn `class p-3`. Gõ `24px` (chưa Enter) → Canvas đổi ngay; Esc → về như cũ, file không đổi.
3. Gõ lại `24px`, Enter → `Home.tsx` có `pt-4`; Undo → về như cũ.
4. Gõ `20px`, Enter → class riêng + rule trong file CSS.
5. Chọn nút "Mua", Trạng thái = Hover, `background-color` `#084298`, Enter → `index.css` có `.btn-buy:hover`; rê chuột lên nút ở chế độ Xem trước thấy màu mới.

## 8. Báo cáo

Theo mẫu của README:

- danh sách file tạo/sửa;
- bảng 18 tình huống, mỗi tình huống: tên test thật, đạt/không;
- kết quả `pnpm verify` (số test, cảnh báo lint);
- các bước kiểm tay đã thử.

Không tự commit; đề xuất commit message `feat(studio): edit bootstrap utilities, hover states and live preview` (đã qua commitlint).
