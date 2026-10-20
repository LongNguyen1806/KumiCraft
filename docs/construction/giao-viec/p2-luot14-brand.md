# Phase 2 — Lượt 14: Panel Brand — sửa `@theme` (WP-2.10)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Quy tắc: spec mục 18C (M-TH), R-TH-10 đến R-TH-14, R-PJ-17, M-HI.

Lượt này **không sửa Bridge**: Canvas tự đổi theo nhờ HMR khi file CSS đổi.

## 1. Mục tiêu (người dùng thấy gì)

1. Panel phải có tab **Brand** cạnh **Thuộc tính** (`data-testid="right-tab-brand"`). Tab này hiện 5 nhóm: **Màu**, **Font**, **Cỡ chữ**, **Bo góc**, **Bóng**, lấy từ `@theme` của dự án. Mỗi token có ô xem trước:
   - ô màu;
   - dòng chữ mẫu theo font, hoặc theo cỡ chữ;
   - khung có bo góc;
   - khung có đổ bóng.
2. **Sửa** một token (ví dụ màu `brand`), Enter hoặc rời ô: file CSS đổi đúng một giá trị; mọi nút dùng `bg-brand` trên Canvas đổi màu ngay. Ctrl+Z trả lại.
3. **Thêm** token: nút **+** của mỗi nhóm mở dòng nhập tên + giá trị.
   - Tên sai dạng hoặc đã có: báo lỗi, không ghi.
   - Dự án chưa có khối `@theme`: tạo mới.
4. **Xóa** token: nếu đang được dùng ở N chỗ thì hỏi "Token đang dùng ở N chỗ. Xóa?". Xóa không sửa các class đang dùng nó.
5. Giá trị không hợp lệ (ví dụ màu `#12`): báo lỗi, file không đổi.
6. Sửa file CSS bằng tay ở ngoài: panel tự tải lại.

## 2. Đọc trước (CW-52)

| File                                                                                                                                | Lý do                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `docs/spec.md` mục 18C, R-PJ-17, R-SE-09 (thụt lề), R-SE-17 (giữ byte), M-HI                                                        | Quy tắc                                                                                    |
| `packages/server/src/core/project/theme.ts` (+ `theme.test.ts`)                                                                     | Bộ đọc `@theme` hiện có (`readThemeTokens`)                                                |
| `packages/server/src/core/project/project-service.ts` (`theme()`), `core/project/drafts.ts`                                         | Nơi thêm thao tác; mẫu ghi file + `recordInternalWrite` + `history.push` (một mục lịch sử) |
| `packages/server/src/adapters/http/routes/project.ts`                                                                               | Route `GET /project/theme` hiện có                                                         |
| `packages/shared/src/project.ts` (`ThemeInfoSchema`)                                                                                | Kiểu theme                                                                                 |
| `packages/studio/src/features/inspector/use-project-theme.ts`, `packages/studio/src/features/editor/side-panels.tsx` (`RightPanel`) | Cách Studio tải theme, chỗ đặt tab                                                         |
| `packages/studio/src/features/inspector/components/color-field.tsx`                                                                 | Mẫu ô màu có sẵn                                                                           |
| `packages/studio/src/features/editor/editor-toolbar.tsx` (`resolveHistoryLabel`)                                                    | Nhãn lịch sử                                                                               |

## 3. Hợp đồng

### 3.1. Shared (`project.ts`, export qua `index.ts`)

```ts
export const THEME_TOKEN_KINDS = ['color', 'font', 'fontSize', 'radius', 'shadow'] as const;
export const ThemeTokenKindSchema = z.enum(THEME_TOKEN_KINDS);
export type ThemeTokenKind = z.infer<typeof ThemeTokenKindSchema>;
export const THEME_TOKEN_NAME = /^[a-z][a-z0-9-]{0,39}$/;

export const ThemeEditSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('set'),
    kind: ThemeTokenKindSchema,
    name: z.string().regex(THEME_TOKEN_NAME),
    value: z.string().trim().min(1).max(300),
  }),
  z.strictObject({
    op: z.literal('add'),
    kind: ThemeTokenKindSchema,
    name: z.string().regex(THEME_TOKEN_NAME),
    value: z.string().trim().min(1).max(300),
  }),
  z.strictObject({
    op: z.literal('remove'),
    kind: ThemeTokenKindSchema,
    name: z.string().regex(THEME_TOKEN_NAME),
  }),
]);
export type ThemeEdit = z.infer<typeof ThemeEditSchema>;

export const ThemeUsageSchema = z.strictObject({ count: z.number().int().nonnegative() });

/** Tiền tố biến CSS của từng loại. */
export const THEME_VAR_PREFIX: Readonly<Record<ThemeTokenKind, string>> = {
  color: '--color-',
  font: '--font-',
  fontSize: '--text-',
  radius: '--radius-',
  shadow: '--shadow-',
};
```

### 3.2. Server: `core/project/theme-edit.ts` (mới, hàm thuần trên chuỗi CSS)

```ts
/** R-TH-14: giá trị hợp lệ cho từng loại; sai → false. */
export function isValidThemeValue(kind: ThemeTokenKind, value: string): boolean;
/** Trả CSS mới, hoặc lỗi E016 (tokenExists, tokenNotFound, invalidValue). Không đụng byte nào khác. */
export function applyThemeEdit(css: string, edit: ThemeEdit): Result<string>;
/** Số class trong một file nguồn dùng token (R-TH-13). */
export function countTokenUses(source: string, kind: ThemeTokenKind, name: string): number;
```

**`isValidThemeValue`:** mọi loại đều cấm `;`, `{`, `}`, xuống dòng, `/*`, `*/`. Thêm theo loại:

| Loại                 | Hợp lệ                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `color`              | `#` + 3, 4, 6 hoặc 8 chữ số hex; hoặc `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `oklab(`, `color-mix(`, `var(--` … kết thúc bằng `)`, ngoặc cân bằng |
| `fontSize`, `radius` | số (có thể thập phân) + `px` / `rem` / `em`; hoặc `0`; hoặc `calc(`…`)` hay `var(--`…`)` ngoặc cân bằng                                                |
| `font`               | chữ, số, khoảng trắng, dấu phẩy, `-`, `_`, nháy đơn/kép cân bằng, `var(--…)`; tối đa 300 ký tự                                                         |
| `shadow`             | không rỗng; ngoặc cân bằng; tối đa 300 ký tự                                                                                                           |

**`applyThemeEdit`:**

- Tìm dòng của biến `<prefix><name>` **trong các khối `@theme`** (kể cả `@theme inline`; dùng cùng cách nhận khối như `theme.ts`):
  - so đúng tên: `--color-brand` không khớp `--color-brand-soft`;
  - với `fontSize` không khớp `--text-<name>--line-height`.
- `set`: biến không có → E016 `tokenNotFound`. Có → thay **chỉ phần giá trị** giữa `:` (cùng khoảng trắng sau nó) và `;`, giữ nguyên mọi byte khác: thụt lề, khoảng trắng, comment cuối dòng, `\r\n`.
- `add`: biến đã có → E016 `tokenExists`.
  - Có khối `@theme`: thêm dòng `<thụt lề><prefix><name>: <value>;` vào **cuối khối `@theme` đầu tiên**, ngay trước `}`. Thụt lề = thụt lề của dòng biến cuối trong khối (không có thì 2 dấu cách). Xuống dòng theo kiểu của file (`\r\n` hoặc `\n`).
  - Không có khối: chèn sau dòng `@import "tailwindcss";` (hoặc `'tailwindcss'`) đoạn `<nl>@theme {<nl>  <dòng><nl>}<nl>`. Không có dòng import thì thêm vào cuối file.
- `remove`: biến không có → E016 `tokenNotFound`; có → xóa cả dòng (gồm ký tự xuống dòng của nó).
- Giá trị không hợp lệ (`isValidThemeValue`) → E016 `invalidValue`.

**`countTokenUses`:** đếm số lần class (có thể có biến thể `md:`, `hover:`, `!` và đuôi `/50`) bằng `<tiền tố>-<name>`, với tiền tố theo loại:

| Loại       | Tiền tố class                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color`    | `bg`, `text`, `border`, `border-t`, `border-r`, `border-b`, `border-l`, `border-x`, `border-y`, `ring`, `ring-offset`, `outline`, `fill`, `stroke`, `from`, `via`, `to`, `divide`, `placeholder`, `accent`, `caret`, `decoration`, `shadow` |
| `font`     | `font`                                                                                                                                                                                                                                      |
| `fontSize` | `text`                                                                                                                                                                                                                                      |
| `radius`   | `rounded`, `rounded-t`, `rounded-r`, `rounded-b`, `rounded-l`, `rounded-tl`, `rounded-tr`, `rounded-br`, `rounded-bl`, `rounded-s`, `rounded-e`                                                                                             |
| `shadow`   | `shadow`                                                                                                                                                                                                                                    |

Ranh giới:

- trước class là đầu chuỗi, khoảng trắng, `"`, `'`, `` ` ``, `{` hoặc `:` (sau biến thể);
- sau là cuối chuỗi, khoảng trắng, `"`, `'`, `` ` ``, `}` hoặc `/`.

`bg-brand-soft` **không** tính cho `brand`.

### 3.3. Server: thực thi và route

`ProjectService.editTheme(edit): Promise<Result<ThemeInfo>>`, `ProjectService.themeUsage(kind, name): Promise<Result<{ count }>>`:

1. Dự án chưa mở → E021. `support.tailwindCss` vắng → E016 `noThemeFile`.
2. Đọc CSS (`readText`, `keepBom`) → `applyThemeEdit`.
3. Ghi `writeTextAtomic`, `recordInternalWrite`.
4. Đọc lại bằng `readThemeTokens`:
   - `set`/`add` phải có đúng `name` với giá trị = `value.trim()`;
   - `remove` phải không còn `name`.

   Sai → ghi lại nội dung cũ, trả **E024** (R-TH-14).

5. Đúng → `history.push` **một** mục: `label: { key: 'history:theme', params: { op, name } }`, file có `before`/`after`/hash như drafts.
6. Trả `ThemeInfo` mới.

- `themeUsage`: duyệt mọi file nguồn trong `sourceDir` (đuôi `.tsx .jsx .ts .js`, bỏ `node_modules`, dùng hàm duyệt file có sẵn của server nếu có, tối đa 2000 file), cộng `countTokenUses`.
- Route:
  - `PATCH /project/theme` (body `ThemeEditSchema`) → `{ data: ThemeInfo }`;
  - `GET /project/theme/usage?kind=…&name=…` → `{ data: { count } }`.
- Ghi `spec-log.md` (#33): route đếm chỗ dùng không có trong spec; spec chỉ ghi "Studio hỏi xác nhận kèm số chỗ dùng".

### 3.4. Studio

- **Theme dùng chung:** đổi `use-project-theme.ts` thành store zustand `useThemeStore` (`theme`, `load()`, `setTheme(theme)`):
  - giữ hook `useProjectTheme()` trả `useThemeStore((s) => s.theme)` để Inspector không phải đổi;
  - lắng nghe sự kiện như hiện tại để tải lại khi file đổi từ ngoài;
  - nghe sự kiện **một lần** (ở `EditorShell` hoặc component gốc của trình sửa), không phải mỗi component.
- `api/project-client.ts`:
  - `editTheme(edit): Promise<ThemeInfo>` (`apiPatch`, parse bằng `ThemeInfoSchema`);
  - `fetchThemeUsage(kind, name)`.
- `features/brand/brand-panel.tsx` (+ file con nếu cần, mỗi file ≤ 400 dòng):
  - Nhóm `data-testid="brand-group-<kind>"`, dòng token `brand-token` (`data-name`), ô giá trị `brand-value`, nút xóa `brand-remove`, nút thêm `brand-add-<kind>`, ô tên khi thêm `brand-new-name`, ô giá trị khi thêm `brand-new-value`, nút lưu `brand-new-save`.
  - **Xem trước:**
    - màu: ô vuông nền `value`;
    - font: chữ "Aa Bb 123" với `fontFamily` = value;
    - cỡ chữ: "Aa" với `fontSize` = value;
    - bo góc: ô 32 px có `borderRadius` = value;
    - bóng: ô 32 px có `boxShadow` = value.

    Giá trị dùng `var(--…)` thì không xem trước được; hiện ô trống có gạch chéo.

  - **Sửa:**
    - Enter hoặc blur, giá trị đổi → `editTheme({ op: 'set', … })` → `useThemeStore.setTheme(kết quả)`;
    - Esc trả giá trị cũ;
    - màu có thêm `<input type="color">` (chỉ khi giá trị hiện tại là hex 6 số; chọn xong ghi hex);
    - font có `<datalist>` gợi ý: `Inter, Roboto, "Open Sans", Montserrat, Poppins, Lato, "Be Vietnam Pro", system-ui, serif, monospace`.
  - **Thêm:** tên + giá trị, lưu → `op: 'add'`; lỗi hiện dưới dòng nhập.
  - **Xóa:** `fetchThemeUsage`; count > 0 → `window.confirm(t('brand.confirmRemove', { count }))`; đồng ý (hoặc count 0) → `op: 'remove'`.
  - **Lỗi:** hiện bằng `errorText` ở đầu panel (`brand-error`).
  - Dự án không có file CSS Tailwind: hiện `brand-empty` "Dự án chưa có file CSS Tailwind".
- `side-panels.tsx` (`RightPanel`): tab **Thuộc tính** | **Brand** | AI (tắt).
  - Nhớ tab đã chọn theo `localStorage` có `try/catch`, giống panel trái.
  - Tab Brand hiện `BrandPanel`.
- Nhãn lịch sử `history:theme` trong `resolveHistoryLabel`:
  - `vi`: "Sửa màu thương hiệu {{name}}" / "Thêm token {{name}}" / "Xóa token {{name}}" theo `op`;
  - `en` tương ứng.
- i18n `vi`/`en`:
  - `brand.*`: tiêu đề tab, 5 tên nhóm, thêm, lưu, hủy, xóa, xác nhận xóa, tên, giá trị, không có file CSS, không xem trước được;
  - lý do E016 mới: `tokenExists`, `tokenNotFound`, `invalidValue`, `noThemeFile`.

## 4. Tình huống test

| #   | Đầu vào                                                                                                                                                     | Kết quả                                                                                                             | Mã      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `isValidThemeValue('color', …)`: `#1d4ed8`, `#abc`, `#12`, `oklch(0.6 0.2 250)`, `rgb(1 2 3`, `red; }`                                                      | true, true, false, true, false, false                                                                               | R-TH-14 |
| 2   | `isValidThemeValue`: radius `0.5rem`, `8px`, `0`, `8`, `1vw`; fontSize `1.125rem`; font `"Be Vietnam Pro", sans-serif`; shadow `0 1px 2px rgb(0 0 0 / 0.1)` | true, true, true, false, false; true; true; true                                                                    | R-TH-14 |
| 3   | CSS `@import "tailwindcss";\r\n\r\n@theme {\r\n  --color-brand: #1d4ed8; /* main */\r\n  --color-brand-soft: #dbeafe;\r\n}\r\n`, `set color brand #b91c1c`  | chỉ `#1d4ed8` thành `#b91c1c`; comment, `\r\n`, dòng `brand-soft` giữ nguyên từng byte                              | R-TH-11 |
| 4   | Cùng CSS, `add color accent #f59e0b`; rồi `add color brand #000`                                                                                            | dòng `  --color-accent: #f59e0b;\r\n` ngay trước `}`; lần 2 E016 `tokenExists`                                      | R-TH-12 |
| 5   | CSS chỉ có `@import "tailwindcss";\n.btn { color: red; }\n`, `add radius card 1rem`                                                                         | `@import "tailwindcss";\n\n@theme {\n  --radius-card: 1rem;\n}\n.btn { color: red; }\n`                             | R-TH-12 |
| 6   | `remove color brand-soft`; `remove color nope`; `set fontSize hero 2rem` khi có `--text-hero--line-height` nhưng không có `--text-hero`                     | dòng `brand-soft` mất, phần còn lại nguyên; E016 `tokenNotFound`; E016 `tokenNotFound`                              | R-TH-13 |
| 7   | `set color brand "red; }"`                                                                                                                                  | E016 `invalidValue`, CSS không đổi                                                                                  | R-TH-14 |
| 8   | `countTokenUses` color `brand` trên `<a className="bg-brand md:hover:text-brand/80 bg-brand-soft border-brand">` và ``cn(`ring-brand`)``                    | 4 (bg, text có biến thể và /80, border, ring); `bg-brand-soft` không tính                                           | R-TH-13 |
| 9   | `countTokenUses` radius `card` trên `rounded-card rounded-t-card rounded-cardx`; shadow `soft` trên `shadow-soft hover:shadow-soft/50`                      | 2; 2                                                                                                                | R-TH-13 |
| 10  | `ProjectService.editTheme` set trên dự án tạm; rồi Undo                                                                                                     | trả ThemeInfo có giá trị mới; file đúng; một mục lịch sử nhãn `history:theme`; Undo trả CSS đúng từng byte          | R-TH-14 |
| 11  | `editTheme` khi đọc lại không khớp (fs giả: lần đọc thứ hai trả CSS cũ)                                                                                     | E024; file được ghi lại nội dung cũ; không có mục lịch sử                                                           | R-TH-14 |
| 12  | Route `PATCH /project/theme` body sai schema; `GET /project/theme/usage?kind=color&name=brand` với 2 file dùng 3 lần                                        | 400/E016; `{ count: 3 }`                                                                                            | R-TH-13 |
| 13  | `BrandPanel` với theme giả 2 màu, 1 font, 1 radius: sửa giá trị màu `brand` rồi Enter; Esc ở ô khác                                                         | `editTheme({ op: 'set', kind: 'color', name: 'brand', value })` một lần; store nhận ThemeInfo trả về; Esc không gọi | R-TH-11 |
| 14  | Bấm `brand-add-color`, nhập tên `Accent!` rồi lưu; nhập `accent` + `#f59e0b` rồi lưu                                                                        | lần 1 báo lỗi tên, không gọi API; lần 2 `op: 'add'`                                                                 | R-TH-12 |
| 15  | Bấm `brand-remove` với usage 3 và `confirm` trả false; usage 0                                                                                              | không gọi `remove`; gọi `remove` không hỏi                                                                          | R-TH-13 |

## 5. Kiểm tay (chủ dự án)

1. Dự án mẫu Oakline, tab **Brand**: thấy màu `brand`, `brand-soft`…, font, bo góc, bóng với ô xem trước.
2. Đổi màu `brand` sang đỏ: nút trên Canvas đổi đỏ ngay. Ctrl+Z: về màu cũ. Mở `src/index.css`: chỉ đúng một giá trị đổi.
3. Thêm màu `accent` `#f59e0b`; ô Inspector màu nền có `accent` trong danh sách token.
4. Xóa `brand`: hỏi "đang dùng ở N chỗ"; Hủy thì không đổi.
5. Nhập màu `#12`: báo lỗi, file không đổi.
6. Sửa `index.css` bằng VS Code: tab Brand tự cập nhật.

## 6. Bẫy đã biết

- **Giữ từng byte** ngoài phần giá trị: không viết lại cả khối, không chuẩn hóa khoảng trắng, giữ `\r\n` và BOM (`readText` với `keepBom`).
- **So tên chính xác**: `--color-brand` khác `--color-brand-soft`; `--text-hero` khác `--text-hero--line-height`.
- **Đọc lại để xác nhận** (bước 4) trước khi ghi lịch sử; lỗi thì khôi phục file.
- **Ghi file CSS** phải `recordInternalWrite`, nếu không watcher sẽ coi là sửa từ ngoài.
- **Một store theme duy nhất**: Inspector và Brand dùng chung, không gọi API hai lần mỗi lần render.
- Không thêm thư viện chọn màu; dùng `<input type="color">` có sẵn của trình duyệt.
- **Viết đúng lint ngay từ đầu**, `pnpm exec eslint <file>` sau mỗi file. File ≤ 400 dòng, hàm ≤ 50 dòng.

## 7. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ dòng spec-log #33. Không chạy `pnpm test:e2e` (không đổi Bridge, runner, phiên).

```text
feat(studio): edit brand tokens of the project theme
```
