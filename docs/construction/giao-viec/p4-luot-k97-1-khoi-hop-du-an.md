# Lượt K9.7-1: Đẹp sẵn và hợp dự án (đợt D1)

Lượt chạy **hai chặng**. **Chặng A** (mục 1–7): TK-43, TK-47, TK-48. **Chặng B** (mục 8): TK-44, TK-69, TK-70, TK-71, TK-72. Chặng B chỉ bắt đầu khi Claude đã kiểm xong chặng A.

Kế hoạch: `p4-ke-hoach.md` mục **K9.7**, lượt **K9.7-1**. Người làm: Gemini. Người kiểm: Claude.

## 1. Mục tiêu (người dùng thấy gì)

1. **Khối mang màu, bo góc, font của dự án (TK-43).** Kéo "Nút" vào WorkTracker thì nút có màu chủ đạo của WorkTracker (token `primary`/`brand`… của dự án), không phải `bg-blue-600` cứng. Dự án không có token nào thì vẫn ra màu mặc định đẹp như hiện nay.
2. **Biến thể (TK-47).** Ô khối có nút nhỏ `▾`. Bấm vào thấy các kiểu: Nút (Chính, Viền, Chữ; cỡ Nhỏ, Vừa, Lớn), Thẻ (Phẳng, Có viền, Nổi), Tiêu đề (Lớn, Vừa, Nhỏ), Hero (Căn giữa, Chia đôi). Chọn kiểu rồi bấm `+` hoặc kéo thì chèn đúng kiểu đó. App nhớ kiểu chọn gần nhất của từng khối.
3. **Tự co giãn (TK-48).** Hàng, Lưới, Thẻ, Hero, Navbar, Footer tự xuống dòng trên màn hình hẹp mà **không cần tiền tố responsive**, nên đúng cho cả dự án mobile-first lẫn desktop-first và cả CSS thường.

Mọi hệ style chạy như nhau (bộ nhớ `style-parity`): Tailwind 4, Tailwind 3, Bootstrap 5, CSS thường, CSS Modules, Sass, Less.

## 2. Hiện trạng (đã đọc code)

- Khối: `packages/shared/src/library/blocks-basic.ts`, `blocks-advanced.ts` (JSX Tailwind 4 theo `vi`/`en`), `blocks-neutral.ts` (JSX `className="@key"` + `styles` CSS + `bootstrap`), kiểu ở `types.ts`.
- Dựng khối theo hệ: `packages/shared/src/library/render-block.ts` `renderBlock(block, system, lang)` → `{ jsx, rules }`. Tailwind 3 qua `v4ToV3Classes`.
- Studio gọi: `packages/studio/src/features/library/insert-block.ts` (`localizedBlockJsx`, `insertBlockAt`), `features/dnd/drop-actions.ts` (thả từ Thư viện), `features/draw/draw-commands.ts` (công cụ vẽ chữ dùng `localizedBlockJsx`).
- Token dự án: `GET /project/theme` → `ThemeInfo` (`packages/shared/src/project.ts`: `colors`, `radii`, `fonts`, `shadows`…; mỗi token `{ name, value, variable? }`). Studio có store `useThemeStore` ở `packages/studio/src/features/inspector/use-project-theme.ts` (`load()`, `theme`).
- Ô Thư viện: `packages/studio/src/features/library/library-panel.tsx` (`BlockItem`, `data-testid="library-block-<id>"`, nút `library-add-<id>`).

## 3. Thiết kế

### 3.1. Vai trò màu (role) trong mẫu khối

Trong JSX Tailwind của khối, chỗ nào là màu hay bo góc "của thương hiệu" thì viết **dấu vai trò** `{role}` trong tên class, ví dụ:

```
bg-{primary} text-{on-primary} hover:bg-{primary}/90 rounded-{radius} border-{border} text-{text} text-{muted} bg-{surface} bg-{surface-muted} font-{heading}
```

Trong `neutral.styles`, giá trị CSS viết `{primary}`, `{radius}`… (ví dụ `'background-color': '{primary}'`, `'border-radius': '{radius}'`).

Danh sách vai trò và giá trị mặc định (khi dự án không có token phù hợp):

| Vai trò         | Tìm trong tên token (không phân biệt hoa thường, theo thứ tự)      | Tailwind mặc định | CSS mặc định    |
| --------------- | ------------------------------------------------------------------ | ----------------- | --------------- |
| `primary`       | `primary`, `brand`, `accent`, `main` (loại kind màu)               | `blue-600`        | `#2563eb`       |
| `on-primary`    | `primary-foreground`, `on-primary`, `primary-contrast`             | `white`           | `#ffffff`       |
| `surface`       | `background`, `surface`, `card`, `paper`                           | `white`           | `#ffffff`       |
| `surface-muted` | `muted`, `secondary`, `surface-muted`, `subtle-bg`                 | `gray-50`         | `#f9fafb`       |
| `text`          | `foreground`, `text`, `ink`, `body`, `heading`                     | `gray-900`        | `#111827`       |
| `muted`         | `muted-foreground`, `text-muted`, `subtle`, `secondary-foreground` | `gray-600`        | `#4b5563`       |
| `border`        | `border`, `line`, `divider`, `outline`                             | `gray-200`        | `#e5e7eb`       |
| `radius`        | trong `radii`: `DEFAULT`, `radius`, `md`, `lg`, `base`             | `lg`              | `8px`           |
| `heading`       | trong `fonts`: `heading`, `display`, `title`                       | _(bỏ class)_      | _(bỏ khai báo)_ |

Quy tắc thay:

- **Tailwind 4 / 3:** có token → tên token (`bg-{primary}` → `bg-brand`). Không có → mặc định (`bg-blue-600`). Vai trò `heading` không có token → **bỏ cả class** (`font-{heading}` biến mất, không để lại khoảng trắng thừa). Sau khi thay mới chạy `v4ToV3Classes` cho Tailwind 3.
- **CSS thường, Modules, Sass, Less:** token có `variable` → `var(--tên)`; có token mà không có `variable` → `value`; không có → mặc định. `heading` không có → bỏ khai báo đó.
- **Bootstrap:** giữ class Bootstrap như hiện nay (Bootstrap đã mang màu theme qua `btn-primary`…). Phần rơi về CSS của Bootstrap thay vai trò như CSS thường.
- Dấu vai trò lạ (không có trong bảng) → lỗi lập trình: test bắt; renderer giữ nguyên chuỗi để dễ thấy.

Hàm mới trong shared (thuần, không I/O): `packages/shared/src/library/project-look.ts`

```ts
export type ProjectLook = { readonly roles: Readonly<Partial<Record<LookRole, LookValue>>> };
export function lookFromTheme(theme: ThemeInfo | undefined): ProjectLook; // dò token theo bảng trên
export function resolveTailwindRoles(classes: string, look: ProjectLook): string;
export function resolveCssRoles(
  decls: Record<string, string>,
  look: ProjectLook,
): Record<string, string>;
```

`renderBlock(block, system, lang, look?, variantId?)`: thêm hai tham số **tùy chọn ở cuối** (không đổi chữ ký cũ, test cũ vẫn chạy). Không có `look` → dùng mặc định.

### 3.2. Biến thể

`types.ts`: `LibraryBlock.variants?: readonly LibraryBlockVariant[]` với

```ts
export type LibraryBlockVariant = {
  readonly id: string; // 'outline', 'lg', 'elevated'…
  readonly labelKey: string; // 'library:variants.outline'
  readonly jsx: { readonly vi: string; readonly en: string };
  readonly neutral: NeutralBlock;
};
```

Khối không có `variants` hoặc `variantId` không khớp → dùng `jsx`/`neutral` của khối (kiểu mặc định). Có biến thể cho: `form.button` (solid mặc định, `outline`, `ghost`, `sm`, `lg`), `composite.card` (mặc định có viền, `flat`, `elevated`), `content.heading` (mặc định vừa, `lg`, `sm`), `composite.hero` (mặc định căn giữa, `split`).

Studio: `BlockItem` có nút `▾` (`data-testid="library-variant-<id>"`, chỉ khi có biến thể) mở menu (`library-variant-menu`, mỗi mục `library-variant-<id>-<variantId>`), mục đang chọn có dấu ✓. Lựa chọn lưu `localStorage` khóa `kumicraft.libraryVariant.<blockId>` (bọc `try/catch`). Cả `+`, kéo thả và công cụ vẽ đều dùng biến thể đang chọn. i18n `vi`/`en` cho tên biến thể (`library` namespace).

### 3.3. Tự co giãn không cần tiền tố

Viết lại mẫu để tự xuống dòng:

- Hàng: `flex flex-wrap gap-4`, mỗi ô `flex-1 basis-60` (CSS: `flex-wrap: wrap`, ô `flex: 1 1 240px`).
- Lưới, danh sách thẻ, footer nhiều cột: `grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6` (CSS: `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`).
- Hero chia đôi, Navbar: `flex flex-wrap items-center justify-between gap-4`.
- Ảnh: `max-w-full h-auto`.
- **Không** dùng `sm:`/`md:`/`max-*:` trong mẫu. Bootstrap giữ lưới `row`/`col-12 col-md-6` của Bootstrap.

### 3.4. Studio nạp token trước khi dựng

`insert-block.ts`: hàm `currentLook()` đọc `useThemeStore.getState().theme`; nếu chưa nạp (`theme.file === undefined` và chưa thử), gọi `await useThemeStore.getState().load()` **một lần** rồi dựng. `localizedBlockJsx` (đồng bộ, dùng cho vẽ chữ) dùng theme đang có. Lỗi nạp theme → dùng mặc định, vẫn chèn được.

## 4. Không được làm

- Không đổi API máy chủ, không đổi `StructureEdit`, không thêm gói npm.
- Không đổi khối ngoài 16 khối hiện có (khối mới là đợt D4).
- Không sửa `blocks-neutral.ts` theo cách làm mất `bootstrap` của khối nào.
- Không `git commit/push/checkout/restore/reset/stash/clean`, không `rm -rf`, không cài gói.
- Không `any`, `as unknown as`, `!`, `null` (QC-40), `eslint-disable`, `@ts-ignore`; không `.then()` (dùng async/await); file ≤ 400 dòng, hàm ≤ 50 dòng; React ref dạng callback `el ?? undefined`.
- Không nới lỏng test cũ. Test cũ đổi vì mẫu đổi (ví dụ chuỗi `bg-blue-600`) thì sửa kỳ vọng **đúng theo thiết kế mới** và ghi lý do trong báo cáo.

## 5. Test bắt buộc

Unit (shared, `packages/shared/src/library/project-look.test.ts` và `render-block.test.ts`):

1. `lookFromTheme`: token `primary` → vai trò `primary`; chỉ có `brand` → dùng `brand`; có cả hai → ưu tiên `primary`; theme rỗng → không vai trò nào.
2. Tên kiểu shadcn (`background`, `foreground`, `primary`, `primary-foreground`, `muted-foreground`, `border`) → đủ 6 vai trò.
3. `resolveTailwindRoles`: có token → `bg-brand hover:bg-brand/90`; không có → `bg-blue-600 hover:bg-blue-600/90`; `font-{heading}` không có token → biến mất, không thừa khoảng trắng.
4. `resolveCssRoles`: token có `variable` → `var(--primary)`; không `variable` → `value`; không token → mặc định; `heading` không có → khai báo bị bỏ.
5. `renderBlock` Tailwind 3 với look → vai trò đã thay rồi mới đổi tên v3.
6. `renderBlock` CSS thường với look → `rules` có `var(--…)`.
7. `renderBlock` Bootstrap → vẫn ra class Bootstrap của nút (`btn btn-primary`…).
8. Biến thể: `form.button` + `outline` → JSX khác mặc định; `variantId` lạ → mặc định.
9. **Mọi khối × mọi biến thể × 7 hệ:** sau khi dựng không còn chuỗi `{` … `}` vai trò nào, không còn `@key`, JSX hợp lệ: đặt test này ở `packages/server` (đã có bộ đọc JSX, xem `packages/server/src/core/source-editor/ast-helpers.ts` `parseJsxAst`) dưới tên `library-render-all.test.ts`, vì `shared` không có bộ đọc JSX; không cài gói mới.
10. Không khối Tailwind nào còn tiền tố `sm:`, `md:`, `lg:`, `xl:`, `max-` (trừ `max-w-…`).

Unit (studio): 11. `library-panel`: khối có biến thể hiện `▾`; khối không có thì không; chọn `outline` → ✓ ở mục đó, `localStorage` lưu; render lại vẫn nhớ. 12. `insert-block`: theme có `brand` → JSX gửi đi có `bg-brand`; theme chưa nạp → `load` được gọi một lần rồi mới gửi; `load` lỗi → vẫn chèn với mặc định. 13. Kéo thả dùng biến thể đang chọn (`drop-actions`).

E2E (mới, `e2e/library-look.e2e.ts`). Fixture `projects/vite8-react19-ts` **đã có** `--color-brand: #3b82f6;` trong `@theme` của `src/index.css`; fixture `projects/react-css` **đã có** `--brand: #2563eb;` và `--radius: 8px;` trong `src/index.css`: 14. Chọn phần tử chứa, bấm `library-add-form.button` → file có `bg-brand`. 15. Chọn biến thể `outline` của Nút rồi `+` → file có class viền (`border`) và không có `bg-brand` đặc. 16. Fixture `projects/react-css`: chèn Nút → file CSS được ghi có `var(--brand)` và `var(--radius)`; JSX không có class Tailwind.

Kiểm ngược (ghi vào báo cáo): tạm bỏ việc truyền `look` trong `insert-block.ts` → test 12 và E2E 14 phải hỏng; trả lại thì qua.

## 6. Kiểm tra cuối

`pnpm format`, `pnpm typecheck`, `npx eslint . --ignore-pattern "Mockup/**"`, `pnpm check:i18n`, `pnpm test`, `pnpm build`, `pnpm test:e2e` (toàn bộ). Tất cả xanh mới xong.

Ghi `docs/construction/spec-log.md` một dòng mới (số tiếp theo) tóm tắt thiết kế vai trò, biến thể, tự co giãn.

## 7. Báo cáo chặng A

Kết thúc bằng mục `## BÁO CÁO K9.7-1A` (tiếng Việt, ngắn): file đã đổi, số test mới theo từng nhóm 1–16, kết quả từng lệnh ở mục 6 (số test qua), kết quả kiểm ngược, chỗ nào làm khác bản giao việc và lý do.

## 8. Chặng B

### 8.1. Component shadcn của dự án (TK-44)

- **Nhận biết** (máy chủ, khi mở dự án): có `components.json` ở gốc ứng dụng theo kiểu shadcn (có `aliases.ui` hoặc `aliases.components`) và thư mục ui tồn tại (mặc định `src/components/ui`). Thêm vào `SupportReportSchema` (`packages/shared/src/project.ts`) trường **tùy chọn** `uiKit?: { kind: 'shadcn'; uiDir: RelPath; importBase: string; components: string[] }` (`components` = tên file trong `uiDir`, ví dụ `button`, `card`, `input`; tối đa 100). Không nhận ra thì bỏ trống, mọi thứ chạy như chặng A. Lưu ý: `.kumicraft/components.json` là file riêng của KumiCraft, **không** phải file của shadcn; chỉ đọc `components.json` ở gốc ứng dụng.
- **Chèn:** khi có `uiKit` và có file tương ứng, khối dùng component của dự án thay thẻ trần: `form.button` → `<Button variant="default|outline|ghost" size="sm|default|lg">`, `form.input` → `<Input>` (kèm `<Label>` nếu có `label`), `composite.card` → `<Card><CardHeader><CardTitle>…</CardTitle></CardHeader><CardContent>…</CardContent></Card>`. Biến thể chặng A ánh xạ sang `variant`/`size` của shadcn.
- **Import:** dùng trường `from` có sẵn của sửa `insert` (`{ file, imports }` trong `packages/shared/src/source.ts`), ví dụ `import { Button } from '@/components/ui/button';` (đường dẫn dựng từ `importBase` đọc trong `components.json`). Máy chủ: import trùng không thêm lần hai; giữ đúng alias của dự án.
- Ô Thư viện có nhãn nhỏ "của dự án" (`library-kit-badge-<id>`) trên khối đang dùng component dự án.

### 8.2. Bộ phong cách (TK-69)

Đầu bảng Thư viện có ô chọn phong cách (`library-style-select`): **Mặc định**, **Tối giản** (không bóng, bo nhỏ, viền mảnh), **Mềm** (bo lớn, bóng nhẹ), **Kính mờ** (nền bán trong suốt + `backdrop-blur`, viền trắng mờ), **Đậm** (bóng lớn, nút gradient từ `primary`). Lưu theo dự án trong `localStorage` (`kumicraft.libraryStyle.<projectId>`, bọc `try/catch`).

Thêm hai vai trò trong `project-look.ts`: `{shadow}` (Tailwind `shadow-none|shadow-sm|shadow-lg|shadow-xl`; CSS `box-shadow` tương ứng) và `{effect}` (Tailwind: rỗng hoặc `bg-white/60 backdrop-blur-md border-white/40`; CSS: `backdrop-filter: blur(12px)` và `background-color: rgba(255, 255, 255, 0.6)`), cộng ghi đè `radius` theo phong cách. Phong cách chỉ ảnh hưởng khối **chèn mới**. Chữ ký: `lookFromTheme(theme, style?)`.

### 8.3. Bảng màu gợi ý (TK-70)

Bảng Thương hiệu (`packages/studio/src/features/brand/brand-panel.tsx`, nhóm màu) có nút "Gợi ý bảng màu" (`brand-palette-open`): chọn một màu gốc, app tính `primary`, `primary-foreground`, `background`, `foreground`, `muted`, `muted-foreground`, `border` bằng hàm thuần `packages/shared/src/library/palette.ts` (đổi sang HSL, chỉnh độ sáng; `primary-foreground` chọn trắng hoặc gần đen theo tương phản WCAG ≥ 4.5:1). Xem trước 7 ô màu kèm tỉ lệ tương phản; "Thêm vào theme" (`brand-palette-apply`) gửi `ThemeEdit` `add` (hoặc `set` nếu token đã có) qua API có sẵn. Nếu API không gộp được thành một lần Hoàn tác thì ghi rõ trong báo cáo.

### 8.4. Cặp font gợi ý (TK-71)

Nhóm font của bảng Thương hiệu có nút "Cặp font gợi ý" (`brand-fonts-open`): danh sách cố định 8 cặp Google Fonts: Inter + Inter, Poppins + Inter, Playfair Display + Source Sans 3, Space Grotesk + Inter, DM Serif Display + DM Sans, Manrope + Manrope, Outfit + Nunito Sans, Lora + Open Sans; mỗi cặp hiện mẫu chữ. Áp dụng: thêm token font `heading` và `body` qua `ThemeEdit`, và thêm **một dòng** `@import url('https://fonts.googleapis.com/css2?family=…&display=swap');` ở **đầu** file theme. Dòng import cần thao tác máy chủ mới: `op: 'importFont'` trong `ThemeEditSchema`, trường `families` chỉ nhận tên thuộc danh sách cố định (máy chủ kiểm, chống chèn URL tùy ý); đã có thì không thêm lại; có Hoàn tác.

### 8.5. Nhịp khoảng cách (TK-72)

Inspector, nhóm Khoảng cách (`spacing-box.tsx` và ô padding/margin/gap): giá trị **ngoài nhịp** (thang Tailwind `0, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24`; giá trị px: bội của 4 tới 96) thì ô có chấm vàng nhỏ (`spacing-offbeat-<prop>`) và chú thích "Lệch nhịp, gợi ý: N"; bấm chấm → đổi sang giá trị nhịp gần nhất (một lần Hoàn tác; hòa thì lấy giá trị lớn hơn). Danh sách gợi ý của ô đặt giá trị nhịp lên đầu. Không chặn người dùng gõ giá trị lệch nhịp.

### 8.6. Test chặng B

17. Máy chủ: có `components.json` + `src/components/ui/button.tsx` → `uiKit.components` có `button`; không có `components.json` → không có `uiKit`.
18. Dựng khối với `uiKit`: `form.button` + `outline` → `<Button variant="outline">` và import đúng alias; không có file `card` → `composite.card` dùng mẫu thường.
19. Máy chủ: chèn hai lần cùng `from.imports` → chỉ một dòng import.
20. `lookFromTheme(theme, 'glass')` → `{effect}` có `backdrop-blur-md`; `'minimal'` → `shadow-none`; phong cách không đổi màu `primary` của dự án.
21. `palette.ts`: màu gốc tối → `primary-foreground` trắng; màu gốc sáng → gần đen; mọi cặp chữ/nền trả về có tương phản ≥ 4.5.
22. Máy chủ `importFont`: tên ngoài danh sách bị từ chối; import trùng không thêm; Hoàn tác gỡ dòng import.
23. Inspector: `p-5` có chấm vàng, bấm → `p-6`; `p-4` không có chấm.
24. E2E, fixture mới `fixtures/projects/react-shadcn` (Vite + React + Tailwind 4 + `components.json` + `src/components/ui/button.tsx` và `card.tsx` tối thiểu, tự viết bằng Tailwind, **không** cài gói shadcn hay `cva`): chèn Nút → file có `<Button` và `import { Button } from '@/components/ui/button'`; chọn phong cách "Kính mờ" rồi chèn Thẻ → có `backdrop-blur-md`.
25. E2E bảng màu: chọn màu gốc, "Thêm vào theme" → file theme có `--color-primary` và `--color-primary-foreground`.

Kiểm ngược chặng B: bỏ nhận biết `uiKit` → test 18 và E2E 24 hỏng.

Kiểm tra cuối như mục 6. Báo cáo bằng mục `## BÁO CÁO K9.7-1B`.
