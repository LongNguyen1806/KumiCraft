# Phase 1, lượt 5: trạng thái dev server trên thanh công cụ (R-PJ-24) và ô chọn theo theme dự án (R-IN-19)

Nguồn: `docs/spec.md` tìm `| R-PJ-24 |`, `| R-IN-19 |`, `| R-PJ-17 |`.

Claude đã chạy thử phần lõi trên code thật; các giá trị ghi "đã chạy thử" là kết quả thật. Phần giao diện là **tính năng mới**: làm đúng hợp đồng (tên file, `data-testid`, khóa i18n, hành vi) dưới đây.

## Quy tắc (bắt buộc)

1. Chỉ sửa/tạo file trong mục "Phạm vi file" của từng phần. Cần sửa file khác: dừng và báo.
2. Không đổi API, kiểu, `data-testid` đang có. Test cũ phải xanh **không sửa assertion**; chỉ được thêm `vi.mock` cho hook mới nếu một test cũ render thanh công cụ mà không có WebSocket giả (ghi tên test trong báo cáo).
3. Không `null` (trừ `toBeNull()` cho API DOM), không `any`, không `as unknown as`, không `eslint-disable`, không `waitForTimeout`. Mọi câu người dùng thấy đi qua `t()`, có ở cả `vi` và `en`.
4. Mỗi test phải đỏ nếu bỏ phần code nó kiểm. Tag dạng `[R-PJ-24]`.
5. Test đỏ: kiểm lại test của mình; vẫn đỏ vì code cũ thì dừng và báo nguyên văn.
6. Cuối lượt: `pnpm format`, `pnpm verify` (thoát mã 0, 0 cảnh báo), `pnpm test:e2e`. Dán nguyên văn dòng tổng. Không commit.

---

## Phần A: R-PJ-24, trạng thái dev server cạnh tên dự án

**Người dùng thấy:** cạnh tên dự án trên thanh công cụ có chấm màu và chữ: "Đã dừng" (xám), "Đang khởi động" (vàng), "Đang chạy" (xanh), "Lỗi" (đỏ), "Dừng đột ngột" (đỏ).

**Vấn đề kỹ thuật phải giải trước:** `features/editor/use-runner-status.ts` mỗi lần gọi lại tự mở một WebSocket (`createEventsClient`) và tự giữ state. Thanh công cụ là nơi gọi thứ hai, nên phải dùng **chung một nguồn**.

### A1. Nguồn trạng thái chung

Viết lại **bên trong** `features/editor/use-runner-status.ts`, giữ nguyên tên file, tên `useRunnerStatus` và kiểu trả về `{ status, logTail, start, restart }` (để `canvas-area.tsx` và `canvas-area.test.tsx` không đổi):

- State nằm trong một store zustand cấp module (`status: RunnerStatus`, khởi đầu `{ state: 'stopped' }`; `logTail: string[]`, tối đa 20 dòng như hiện nay).
- Biến đếm người dùng cấp module. Lần gọi đầu tiên (đếm từ 0 lên 1) mới gọi `fetchRunnerStatus()` và tạo **một** `createEventsClient`, xử lý `runner.status` và `runner.log` như code hiện tại. Lần cuối thôi dùng (đếm về 0) thì `client.close()`.
- `start`, `restart` giữ hành vi hiện tại, ghi kết quả vào store.

### A2. Nhãn trạng thái

`features/editor/runner-status-badge.tsx` (mới): `export function RunnerStatusBadge()` dùng `useRunnerStatus()`, render `<span data-testid="runner-status-badge" data-state={status.state}>` gồm một chấm tròn màu và chữ `t(\`editor.runnerState.${status.state}\`)`. Màu: `stopped`xám,`starting`vàng,`ready`xanh lá,`error`và`crashed` đỏ (dùng class màu Tailwind có sẵn trong Studio).

`features/editor/editor-toolbar.tsx`: đặt `<RunnerStatusBadge />` ngay sau `<span data-testid="project-name">` trong khối tên dự án. Không đổi phần khác.

Khóa i18n mới trong `common.json` nhóm `editor`:

| Khóa                          | vi             | en       |
| ----------------------------- | -------------- | -------- |
| `editor.runnerState.stopped`  | Đã dừng        | Stopped  |
| `editor.runnerState.starting` | Đang khởi động | Starting |
| `editor.runnerState.ready`    | Đang chạy      | Running  |
| `editor.runnerState.error`    | Lỗi            | Error    |
| `editor.runnerState.crashed`  | Dừng đột ngột  | Crashed  |

### A3. Test

`features/editor/use-runner-status.test.tsx` (mới), mock `../../api/runner-client.ts` (`fetchRunnerStatus` trả `{ state: 'ready', origin: 'http://127.0.0.1:5173', nonce: 'n'.repeat(22) }`) và `vi.spyOn(eventsClient, 'createEventsClient')` trả object giả `{ close: vi.fn(), isConnected: () => true }` **và giữ lại** `options.onEvent` để test tự phát sự kiện:

1. `it('shares one WebSocket between the Canvas and the toolbar [R-PJ-24]')`: render 2 component cùng gọi `useRunnerStatus()` → `createEventsClient` được gọi **đúng 1 lần**; unmount 1 component → `close` chưa gọi; unmount nốt → `close` gọi đúng 1 lần.
2. `it('shows the dev server state next to the project name [R-PJ-24]')`: render `RunnerStatusBadge`; chờ `runner-status-badge` có `data-state="ready"` và chữ `Đang chạy` (vi) hoặc `Running` (en, nếu đổi ngôn ngữ trong test); gọi `onEvent({ v: 1, type: 'runner.status', at: '…', payload: { state: 'crashed' } })` trong `act` → `data-state="crashed"`, chữ `Dừng đột ngột`.

Kiểm nhanh phần A: `pnpm exec vitest run packages/studio/src/features/editor`.

### Phạm vi file phần A

`features/editor/use-runner-status.ts`, `features/editor/use-runner-status.test.tsx` (mới), `features/editor/runner-status-badge.tsx` (mới), `features/editor/editor-toolbar.tsx`, `i18n/locales/{vi,en}/common.json`, và `vi.mock` trong test cũ nếu cần (quy tắc 2).

---

## Phần B: R-IN-19, ô chọn theo theme dự án

**Người dùng thấy:**

- Ô **màu chữ, màu nền, màu viền** là nút có ô màu nhỏ; bấm mở bảng chọn gồm: "Màu của dự án" (token `--color-*` trong `@theme`), "Bảng màu Tailwind", và ô nhập mã màu tự do.
- Ô **cỡ chữ, bo góc, bóng, font** liệt kê tên trong `@theme` của dự án **trước**, rồi tới các giá trị mặc định đang có.

**Hiện trạng (đã kiểm):** API `GET /project/theme` đã đúng (R-PJ-17), `fetchProjectTheme()` có trong `api/project-client.ts` nhưng **không nơi nào gọi**; `side-panels.tsx` render `<InspectorPanel />` không truyền `theme`, nên Inspector luôn dùng theme rỗng. Phần lõi `@kumicraft/shared` đã đọc/ghi đúng (đã chạy thử với theme có `brand`, `hero`, `card`, `soft`, `display`):

| Thao tác                                                                    | Kết quả                                 |
| --------------------------------------------------------------------------- | --------------------------------------- |
| đọc `text-brand` (`textColor`)                                              | `{ kind: 'theme', name: 'brand' }`      |
| đọc `text-red-500`                                                          | `{ kind: 'scale', token: 'red-500' }`   |
| đọc `text-[#ff6600]`                                                        | `{ kind: 'arbitrary', css: '#ff6600' }` |
| đọc `text-hero` (`fontSize`), `rounded-card`, `shadow-soft`, `font-display` | `{ kind: 'theme', name: … }`            |
| `writeValue('p-4','textColor',base,{kind:'theme',name:'brand'})`            | `'p-4 text-brand'`                      |
| `writeValue('p-4','borderColor',base,{kind:'scale',token:'slate-200'})`     | `'p-4 border-slate-200'`                |
| `writeValue('p-4','backgroundColor',base,{kind:'arbitrary',css:'#ff6600'})` | `'p-4 bg-[#ff6600]'`                    |
| `writeValue('p-4','fontSize',base,{kind:'theme',name:'hero'})`              | `'p-4 text-hero'`                       |

### B1. Dữ liệu bảng màu Tailwind

- `scripts/gen-tailwind-palette.mjs` (mới): đọc `packages/studio/node_modules/tailwindcss/theme.css`, lấy mọi dòng `^  --color-<tên>: <giá trị>;` (ví dụ `--color-red-50: oklch(97.1% 0.013 17.38);`, `--color-black: #000;`), ghi `packages/shared/src/tailwind/palette.generated.ts` dạng:
  ```ts
  // Generated by scripts/gen-tailwind-palette.mjs from tailwindcss/theme.css. Do not edit.
  export const TAILWIND_COLORS: readonly { readonly name: string; readonly value: string }[] = [ … ];
  ```
  theo đúng thứ tự trong file. Thêm script `"gen:palette": "node scripts/gen-tailwind-palette.mjs"` vào `package.json` gốc. Chạy một lần, commit file sinh ra.
- Export `TAILWIND_COLORS` qua `packages/shared/src/index.ts`.
- `packages/shared/src/tailwind/palette.test.ts` (mới) `it('carries the default Tailwind palette with black and white [R-IN-19]')`: có `{ name: 'red-50', value: 'oklch(97.1% 0.013 17.38)' }`, có `{ name: 'black', value: '#000' }`, `{ name: 'white', value: '#fff' }`; có `slate-200`, `blue-500`, `rose-950`; không có tên trùng.

### B2. Tải theme trong Studio

- `features/inspector/use-project-theme.ts` (mới): `export function useProjectTheme(): ThemeInfo`. Gọi `fetchProjectTheme()` khi mount; lỗi thì giữ theme rỗng (cùng giá trị `DEFAULT_THEME` của `inspector-panel.tsx`; chuyển hằng này sang file hook và export để hai nơi dùng chung). Nghe `project.changed`, và `project.filesChanged` có `files` chứa `theme.file` → tải lại.
- `features/editor/side-panels.tsx`: `const theme = useProjectTheme();` và `<InspectorPanel theme={theme} />`. Không đổi gì khác.

### B3. Ô màu

`features/inspector/components/color-field.tsx` (mới), dùng cho `textColor`, `backgroundColor`, `borderColor` thay cho ô chữ hiện tại (trong `inspector-panel.tsx` chọn component theo `property`; giữ nguyên nhãn, nhãn "kế thừa", nút "bỏ ghi đè" như `PropertyField`, có thể tách phần đầu chung ra để dùng lại).

Hợp đồng:

| Phần tử       | `data-testid`                 | Hành vi                                                                                                                                                                       |
| ------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nút mở        | `color-field-<property>`      | Hiện ô màu nhỏ (màu hiện tại; không có thì ô gạch chéo) và tên giá trị (`brand`, `red-500`, `[#ff6600]`, hoặc `—`). Bấm mở/đóng bảng chọn. `disabled` theo khóa của Inspector |
| Mục màu dự án | `color-option-theme-<name>`   | Một nút cho mỗi `theme.colors`; nền là `value`; `title` là tên. Bấm → `onValueChange(property, { kind: 'theme', name })`, đóng bảng                                           |
| Mục bảng màu  | `color-option-palette-<name>` | Một nút cho mỗi `TAILWIND_COLORS`; nền là `value`; `title` là tên. Bấm → `onValueChange(property, { kind: 'scale', token: name })`, đóng bảng                                 |
| Ô nhập        | `color-custom-input`          | Nhận `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(…)`, `rgba(…)`, `hsl(…)`, `oklch(…)`                                                                                       |
| Nút áp dụng   | `color-custom-apply`          | Giá trị hợp lệ → `onValueChange(property, { kind: 'arbitrary', css: value.trim() })`; không hợp lệ → không gọi, hiện `role="alert"` `t('inspector.color.invalid')`            |

Khóa i18n mới nhóm `inspector.color`: `project` ("Màu của dự án" / "Project colors"), `palette` ("Bảng màu Tailwind" / "Tailwind palette"), `custom` ("Mã màu" / "Color code"), `apply` ("Áp dụng" / "Apply"), `invalid` ("Mã màu không hợp lệ" / "Invalid color code"), `noProjectColors` ("Dự án chưa khai báo màu trong @theme" / "The project declares no @theme colors").

### B4. Ô cỡ chữ, bo góc, bóng, font

Trong `inspector-panel.tsx` (chỗ truyền `options={f.options}`), với `fontSize`, `borderRadius`, `boxShadow`, `fontFamily`: `options` = tên theo theme (`theme.fontSizes`, `theme.radii`, `theme.shadows`, `theme.fonts`) **trước**, rồi `f.options` hiện có, bỏ trùng. Các ô khác giữ nguyên.

**Ngoại lệ duy nhất được sửa test cũ:** `inspector-panel.test.tsx` Scenario 1 đang có

```ts
const bgInput = screen.getByTestId<HTMLInputElement>('input-backgroundColor');
expect(bgInput.value).toBe('white');
```

Ô màu nền không còn là `<input>`, nên thay đúng 2 dòng này bằng

```ts
expect(screen.getByTestId('color-field-backgroundColor').textContent).toContain('white');
```

(cùng ý nghĩa: Inspector hiện đúng màu nền hiện tại). Không sửa dòng nào khác của test cũ.

### B5. Test

`features/inspector/components/color-field.test.tsx` (mới), theme `{ colors: [{ name: 'brand', value: '#f00' }], … }`, `onValueChange = vi.fn()`:

1. `it('offers project colors before the Tailwind palette [R-IN-19]')`: bấm `color-field-textColor` → có `color-option-theme-brand`, `color-option-palette-red-500`; trong DOM nút `theme-brand` đứng **trước** mọi nút `palette-` (so `compareDocumentPosition`).
2. `it('writes a project color by name and a palette color as a scale token [R-IN-19]')`: bấm `color-option-theme-brand` → `onValueChange` với `('textColor', { kind: 'theme', name: 'brand' })`; mở lại, bấm `color-option-palette-slate-200` → `('textColor', { kind: 'scale', token: 'slate-200' })`.
3. `it('writes a valid custom color and refuses an invalid one [R-IN-19]')`: nhập `#ff6600`, áp dụng → `{ kind: 'arbitrary', css: '#ff6600' }`; nhập `banana`, áp dụng → không gọi thêm, có `role="alert"`.
4. `it('shows the current value with its swatch [R-IN-19]')`: render với giá trị hiện tại `text-brand` → nút mở có chữ `brand`.

`features/inspector/inspector-panel.test.tsx` thêm (dựng như Scenario 1, truyền `theme` có `fontSizes: [{ name: 'hero', value: '3rem' }]`):

5. `it('lists project font sizes first [R-IN-19]')`: `input-fontSize` (select) có option đầu tiên sau `—` là `hero`.
6. `it('reads text-brand as the project color brand [R-IN-19]')`: `className` `'text-brand p-4'`, theme có `brand` → `color-field-textColor` có chữ `brand`.

`features/inspector/use-project-theme.test.ts` (mới):

7. `it('loads the project theme and reloads it when its CSS changes [R-IN-19, R-PJ-17]')`: `fetchProjectTheme` giả trả lần 1 theme có `brand`, lần 2 có thêm `accent`; sự kiện `project.filesChanged` `{ files: ['src/index.css'] }` (khi `theme.file === 'src/index.css'`) → hook trả theme có `accent`; sự kiện với file khác → không gọi lại.

Kiểm nhanh phần B: `pnpm exec vitest run packages/studio/src/features/inspector packages/shared/src/tailwind`, `pnpm check:i18n`.

### Phạm vi file phần B

`scripts/gen-tailwind-palette.mjs` (mới), `package.json` (chỉ thêm script), `packages/shared/src/tailwind/palette.generated.ts` (mới), `palette.test.ts` (mới), `packages/shared/src/index.ts` (thêm export), `features/inspector/use-project-theme.ts` (mới) và test, `features/inspector/components/color-field.tsx` (mới) và test, `features/inspector/inspector-panel.tsx`, `inspector-panel.test.tsx`, `features/editor/side-panels.tsx`, `i18n/locales/{vi,en}/common.json`, `bridge-client.generated.ts` (chỉ khi `pnpm --filter @kumicraft/bridge build` đổi nó do shared đổi).

---

## Mẫu báo cáo

1. Phần nào xong, phần nào dừng (kèm nguyên văn lỗi).
2. Danh sách file tạo/sửa (đường dẫn, số dòng thêm/bớt).
3. Nguyên văn dòng tổng `pnpm verify`, `pnpm test:e2e`; kết quả `pnpm trace` với `currentPhase: 1` (sau đó trả lại `0`). Mong đợi chỉ còn: R-FW-05, R-QA-01, R-IN-21, R-SE-16, R-SL-12, S-86.
4. Test cũ đã thêm `vi.mock` (nếu có) và lý do.
5. Mọi chỗ làm khác bản này. Không commit.
