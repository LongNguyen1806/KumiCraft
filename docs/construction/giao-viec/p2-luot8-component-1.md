# Phase 2 — Lượt 8: Component, phần 1 (WP-2.08a)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Đã có sẵn: `insert` với `from: { file, imports }` tự thêm câu import và đổi đường dẫn tương đối theo file đích, giữ alias `@/` (R-SE-23, `structure/imports.ts`); bộ đếm số chỗ dùng component `createUsageCounter` và đọc alias `readAliasPrefix` (`source-editor/component-usages.ts`); danh sách trang có `file` (`usePagesData`, lượt 5); kéo thả từ Studio vào Canvas (`features/dnd/`, lượt 6).

## 1. Mục tiêu (người dùng thấy gì)

1. **Thanh "Đang thiết kế"** ở đầu Canvas: `Trang · Home · src/pages/Home.tsx`. Đổi trang thì thanh đổi theo. Trang không xác định được file (dự án không theo quy ước): `Trang · /duong-dan` và dòng nhỏ "Chưa biết file của trang này".
2. Trên Canvas, rê chuột hoặc chọn một phần tử thuộc **file khác** file đang thiết kế (ví dụ phần tử trong `Header`): khung màu **tím** và nhãn tên file không đuôi (`Header`), thay cho khung xanh.
3. **Panel Component** (thẻ thứ ba cạnh Lớp và Library): danh sách component của dự án, mỗi mục có tên, đường dẫn file, "Dùng ở N chỗ", nhãn "Bố cục" cho layout; ô tìm theo tên. File đổi thì danh sách tự cập nhật.
4. Bấm một component → chèn `<Tên />` theo vị trí như Library, file đích có thêm `import` (alias `@/` nếu dự án có). Kéo component vào Canvas cũng chèn được. Một bước Undo xóa cả thẻ và câu import.
5. Đang chọn phần tử thuộc file khác (ví dụ chữ trong `Header`) rồi bấm khối Library hoặc component: khối được chèn vào **file đang thiết kế**, ở phần tử tổ tiên gần nhất thuộc file đó, không chèn vào `Header.tsx`.

## 2. Đọc trước (CW-52)

| File                                                                                                                                 | Lý do                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `docs/spec.md` mục 18A (M-CP, R-CP-10 đến 13), R-SE-14, R-SE-23; `spec-log.md` #23                                                   | Quy tắc, chỗ lệch đã chốt                                               |
| `packages/server/src/core/source-editor/component-usages.ts`                                                                         | `summarize`, `createUsageCounter`, `readAliasPrefix`, `listSourceFiles` |
| `packages/server/src/core/source-editor/structure/imports.ts` (`buildMissingImportsEdits`, `resolveRelativeImportSource`)            | Hiểu `from` để chèn component có import                                 |
| `packages/server/src/adapters/http/routes/project.ts`, `core/project/project-service.ts`, `src/index.ts`                             | Thêm endpoint, nối phụ thuộc                                            |
| `templates/vite-react-ts-tailwind4/src/` (`components/`, `components/ui/`, `layouts/`, `tsconfig.json` có `@/*`)                     | Dữ liệu test                                                            |
| `packages/studio/src/features/editor/side-panels.tsx`, `features/library/` (`library-panel.tsx`, `insert-block.ts`)                  | Thêm thẻ, mẫu panel, chèn                                               |
| `packages/studio/src/features/editor/page-select.tsx` (`usePagesData`), `selection/selection-store.ts` (`currentRoute`, `treeNodes`) | Xác định trang đang thiết kế                                            |
| `packages/studio/src/features/dnd/` (`dnd-store.ts`, `drop-actions.ts`)                                                              | Thêm nguồn kéo `component`                                              |
| `packages/bridge/src/client/overlay.ts`, `studio-messages.ts`, `bridge-client-runtime.ts`                                            | Khung tím và nhãn                                                       |

## 3. Hợp đồng

### 3.1. Shared

```ts
// project.ts — R-CP-12 (spec-log #23: chưa có preview; thêm importStatement)
export const ProjectComponentSchema = z.strictObject({
  name: z.string().min(1),
  file: RelPathSchema,
  kind: z.enum(['component', 'layout']),
  usages: z.number().int().min(0),
  importStatement: z.string(), // câu import dùng được từ chính file component, xem 3.2 bước 5
});
export const ProjectComponentsSchema = z.strictObject({
  components: z.array(ProjectComponentSchema),
});

// bridge.ts — Studio → Bridge (R-CP-11). file vắng mặt: không biết file đang thiết kế.
export const StudioDesignFilePayloadSchema = z.strictObject({ file: RelPathSchema.optional() });
```

### 3.2. Server — `core/project/components-list.ts` (mới) + `GET /project/components`

`listProjectComponents(deps, root, info): Promise<ProjectComponent[]>`:

1. Thư mục quét: `info.designDirs.components` (loại `component`) và `info.designDirs.layouts` (loại `layout`), **đệ quy**, file `.tsx`/`.jsx`; bỏ `node_modules`, file `*.test.*`, `*.stories.*`. Thư mục không có → bỏ qua, không lỗi.
2. Cộng thêm các file trong `.kumicraft/components.json` dạng `{ "files": ["src/features/x/Promo.tsx"] }` (loại `component`). File này không có, hỏng JSON hoặc sai dạng → bỏ qua, không lỗi (lượt 9 mới ghi file này). File trong danh sách không còn tồn tại → bỏ qua.
3. Mỗi file: `summarize(code)`; mỗi tên export bắt đầu bằng chữ hoa và là **hàm hoặc hằng** (không phải `export type`/`export interface`) → một mục. Export mặc định có tên local viết hoa cũng tính. Nếu `summarize` chưa phân biệt được kiểu, sửa `exportedNames` để bỏ khai báo `exportKind === 'type'`, `TSTypeAliasDeclaration`, `TSInterfaceDeclaration` (thêm test).
4. `usages` = `usageCounter.count(root, sourceDir, file, name)`. Dùng **một** `createUsageCounter(fs)` tạo trong `index.ts` và truyền vào cho cả Source Editor lẫn route này (có cache theo hash).
5. `importStatement`: `readAliasPrefix` có (`@/` → `src/`) và file nằm trong thư mục alias → nguồn `@/` + đường dẫn sau `src/`, **bỏ đuôi** `.tsx`/`.jsx` (và bỏ `/index`); ngược lại nguồn `./<tên file không đuôi>` (tương đối **từ chính file component**; `insert` sẽ đổi theo file đích). Export tên → `import { Name } from '<nguồn>';`; export mặc định → `import Name from '<nguồn>';`.
6. Sắp xếp: `layout` trước, rồi theo `name` (`localeCompare`).

Export `readAliasPrefix`, `listSourceFiles` (hoặc hàm liệt kê tương đương) từ `component-usages.ts` để dùng lại; không chép code.

Endpoint `GET /project/components` trong `routes/project.ts`: chưa mở dự án → E021 như các route khác; trả `{ data: { components } }`.

### 3.3. Studio — file đang thiết kế

**`features/design/design-target.ts`** (mới, hàm thuần):

```ts
export type DesignTarget = { kind: 'page'; name?: string; file?: RelPath; route: string };
/** Trang khớp route hiện tại: so khớp từng đoạn, `:param` khớp mọi đoạn, bỏ `?query` và `/` cuối. */
export function matchPage(pages: readonly PageInfo[], route: string): PageInfo | undefined;
export function designTargetOf(pages: readonly PageInfo[], route: string): DesignTarget;
/**
 * Phần tử để chèn khi phần tử đang chọn thuộc file khác (R-CP-11): đi lên `parent` trong `treeNodes`
 * tới nút đầu tiên có file của `loc` bằng `designFile`. Không có `designFile`, hoặc ref đã thuộc
 * file đó → trả chính ref. Không tìm được → undefined.
 */
export function insertAnchor(
  ref: ElementRef,
  treeNodes: readonly TreeNode[],
  designFile: RelPath | undefined,
): ElementRef | undefined;
```

`kind` hiện chỉ có `'page'`; lượt 9 thêm `'component'` (chế độ sửa component). Giữ kiểu mở rộng được.

**`features/design/design-store.ts`** (zustand): `target?: DesignTarget`, `setTarget`. Hook `useDesignTargetSync()` gắn một lần trong `editor-shell.tsx`: tính `designTargetOf(usePagesData().pages, currentRoute)`, ghi store, và mỗi khi `target.file` đổi hoặc Bridge vừa sẵn sàng (`bridgeReady`) gửi `studioBridgeChannel.setDesignFile(file)` (thêm hàm này vào `bridge-channel.ts`, tin `design-file`).

**`features/design/design-bar.tsx`** (mới), đặt ngay trên khung Canvas trong `canvas-area.tsx`, `data-testid="design-bar"`: nhãn loại (`design.kind.page` "Trang" / "Page"; thêm sẵn `design.kind.layout` "Bố cục" / "Layout", `design.kind.component` "Component"), tên (`data-testid="design-bar-name"`), file (`data-testid="design-bar-file"`, font mono). Không có file: `design.unknownFile` "Chưa biết file của trang này" / "The file of this page is unknown".

**Chèn vào file đang thiết kế:** `insertBlock` (Library, bấm) và chèn component (bấm) dùng `insertAnchor(selectedRef, treeNodes, designFile)` thay cho ref đang chọn. `undefined` → không gọi server, báo `library-hint`-kiểu: `design.selectInFile` "Chọn một phần tử trong {{file}}" / "Select an element in {{file}}". Kéo thả (lượt 6) và dán (lượt 7) **không đổi**.

### 3.4. Studio — panel Component

- `api/project-client.ts`: `fetchComponents(): Promise<ProjectComponent[]>`.
- `features/components-panel/use-project-components.ts`: tải khi mở dự án; tải lại (gộp 300 ms) khi `project.filesChanged` có file `.tsx`/`.jsx` hoặc `.kumicraft/components.json`, và khi `project.changed`.
- `features/components-panel/components-panel.tsx` (`data-testid="components-panel"`): ô tìm `component-search` (tìm theo tên, không phân biệt hoa thường, bỏ dấu như Library); mỗi mục `component-item-<Name>` có tên, file, `components.usages` "Dùng ở {{count}} chỗ" / "Used in {{count}} places", nhãn `components.layout` "Bố cục" khi `kind === 'layout'`. Không có component: `components.empty` "Dự án chưa có component" / "This project has no components yet".
- Bấm mục: như Library (cần vùng chọn, dùng `insertAnchor`). Mục có `file === designFile` bị khóa (`aria-disabled`, tooltip `components.selfInsert` "Không chèn component vào chính nó" / "A component cannot be inserted into itself").
- `insertComponentAt(component, target)` trong `features/components-panel/insert-component.ts`: `applyStructureEdit({ kind: 'insert', target, jsx: '<' + name + ' />', from: { file: component.file, imports: [component.importStatement] } })`; thành công chọn `res.locs[0]`; `warnings` qua `useStructureErrorStore.setWarnings`; lỗi hiện trong panel (`components-error`).
- Kéo: mục `draggable`; `dnd-store` thêm nguồn `{ source: 'component'; component: ProjectComponent }`; tin `drag-over` gửi `source: 'library'` (Bridge không cần biết khác nhau); `handleDrop` nhánh `component` gọi `insertComponentAt`.
- Thẻ thứ ba trong `side-panels.tsx` theo đúng mẫu hai thẻ đang có (nhớ thẻ đang mở như hiện tại), nhãn `editor.components` "Component" / "Components".

### 3.5. Bridge — khung tím

- `studio-messages.ts`: nhận `design-file` → `runtime.setDesignFile(file?)`.
- `overlay.ts`: khi có `designFile`, phần tử hover/chọn có file của `data-rc-loc` khác `designFile` → lớp `.foreign` (viền `#9333ea`, nền `rgba(147, 51, 234, 0.08)`) và nhãn `.tag-label` nền tím ghi tên file không đuôi. Viết hàm thuần `foreignLabel(loc: string, designFile: string | undefined): string | undefined` (trong `overlay-foreign.ts` hoặc file nhỏ tương tự) để test.
- `overlay.ts` đang 379 dòng: phần mới đặt ở file riêng, giữ `overlay.ts` ≤ 400 dòng.

## 4. Tình huống test

Test server dùng dự án tạo từ template chép vào thư mục tạm như các lượt trước.

| #   | Đầu vào                                                                                                                                                                                             | Kết quả                                                                                                                                                              | Mã               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `GET /project/components` trên template                                                                                                                                                             | Có `MainLayout` (`layout`, đứng đầu), `Header`, `Footer`, `ProductCard`, `Badge`, `Button`, `Card`, `Input`; `usages` của `Header` ≥ 1, `ProductCard` ≥ 1; file đúng | R-CP-12          |
| 2   | Cùng lần gọi                                                                                                                                                                                        | `importStatement` của `Header` = `import { Header } from '@/components/Header';`; `Button` = `… from '@/components/ui/Button';`                                      | R-CP-13          |
| 3   | Xóa `paths` khỏi `tsconfig.json` rồi gọi lại                                                                                                                                                        | `Header` = `import { Header } from './Header';`                                                                                                                      | R-CP-13          |
| 4   | File component có `export type ButtonProps`, `export const helper = 1` (chữ thường), `export default function Promo`                                                                                | Chỉ có mục `Promo` (default: `import Promo from …`), không có `ButtonProps`, `helper`                                                                                | R-CP-12          |
| 5   | `.kumicraft/components.json` = `{ "files": ["src/features/x/Promo.tsx"] }` có file; rồi JSON hỏng; rồi file trong danh sách bị xóa                                                                  | Lần 1 có `Promo`; lần 2, 3 không lỗi, không có `Promo`                                                                                                               | R-CP-12          |
| 6   | Chèn `<Header />` vào `src/pages/About.tsx` bằng `insert` với `from` lấy từ mục `Header` (qua `executeStructureEdit`)                                                                               | `About.tsx` có `import { Header } from '@/components/Header';` sau import cuối và thẻ ở đúng chỗ; Undo trả về từng byte                                              | R-CP-13, R-SE-23 |
| 7   | Như #6 nhưng dự án không có alias                                                                                                                                                                   | Import `'../components/Header'`                                                                                                                                      | R-CP-13          |
| 8   | `matchPage` với `/`, `/about`, `/about/`, `/products/42?x=1` (trang `/products/:id`), `/khong-co`                                                                                                   | Home, About, About, trang `:id`, `undefined`                                                                                                                         | R-CP-11          |
| 9   | `insertAnchor`: ref ở `Header.tsx` có cha `div` (`MainLayout.tsx`) có cha `main` (`Home.tsx`), `designFile = src/pages/Home.tsx`; ref đã ở Home; `designFile` không có; không có tổ tiên nào ở Home | `main`; chính ref; chính ref; `undefined`                                                                                                                            | R-CP-11          |
| 10  | `DesignBar` với trang có file; trang không có file                                                                                                                                                  | `design-bar-name` = `Home`, `design-bar-file` = `src/pages/Home.tsx`; dòng `design.unknownFile`                                                                      | R-CP-11          |
| 11  | `ComponentsPanel`: gõ "card" → còn `Card`, `ProductCard`; mục `MainLayout` có nhãn Bố cục; mục có `file === designFile` có `aria-disabled`                                                          | Đúng                                                                                                                                                                 | R-CP-12          |
| 12  | Bấm mục `ProductCard` khi đang chọn `section` của Home                                                                                                                                              | `applyStructureEdit` nhận `insert` `child end` của `section`, `jsx: '<ProductCard />'`, `from` đúng                                                                  | R-CP-13          |
| 13  | Bấm khối Library khi đang chọn phần tử ở `Header.tsx` (cây như #9)                                                                                                                                  | `insert` có đích là `main` của Home, không phải phần tử Header                                                                                                       | R-CP-11          |
| 14  | `handleDrop` với nguồn `component` và đích                                                                                                                                                          | `insertComponentAt` được gọi đúng component và đích                                                                                                                  | R-CP-13, R-DD-14 |
| 15  | `foreignLabel('src/components/Header.tsx:5:3', 'src/pages/Home.tsx')`, cùng file, `designFile` không có                                                                                             | `'Header'`, `undefined`, `undefined`                                                                                                                                 | R-CP-11          |

## 5. Kiểm tay (chủ dự án)

Trên dự án mới (template):

1. Mở Home: thanh "Đang thiết kế" ghi `Trang · Home · src/pages/Home.tsx`. Chuyển sang About: thanh đổi theo.
2. Rê chuột lên logo trong Header: khung tím, nhãn `Header`. Rê lên một section của Home: khung xanh như cũ.
3. Mở thẻ **Component**: thấy `MainLayout` (Bố cục), `Header`, `Footer`, `ProductCard`, `Button`, `Card`, `Badge`, `Input`; số chỗ dùng hợp lý (ví dụ `ProductCard` dùng ở Home).
4. Ở trang About, chọn `main` → bấm `ProductCard`: thẻ hiện ra; `About.tsx` có `import { ProductCard } from '@/components/ProductCard';`; `pnpm build` trong dự án không lỗi. **Ctrl+Z** một lần: cả thẻ và import biến mất.
5. Kéo `Button` từ panel Component vào giữa hai section của Home: nút được chèn ở đó, có import.
6. Chọn chữ "Home" trong menu Header, bấm khối **Đoạn văn** của Library: đoạn văn vào Home (file trang), `Header.tsx` không đổi (`git diff`).
7. Mở `src/components/Header.tsx` trong editor, thêm `export function Promo() { return <div /> }`, lưu: panel Component có thêm `Promo` sau chốc lát.

Trên WorkTracker:

8. Thanh "Đang thiết kế" hiện route và "Chưa biết file của trang này" (nếu không theo quy ước); panel Component liệt kê component trong `src/components` (nếu có); chèn một component vào trang chạy và Undo đúng.

## 6. Bẫy đã biết

- **Không viết thuật toán import mới:** chỉ dựng `importStatement` và truyền qua `from`; `insert` đã đổi đường dẫn tương đối và giữ alias.
- **Một bộ đếm dùng chung:** không tạo `createUsageCounter` mới cho mỗi request (mất cache, chậm trên dự án lớn).
- **`summarize` và export kiểu TypeScript:** kiểm test #4 trước khi tin danh sách.
- **Thứ tự tin Bridge:** khi iframe nạp lại (đổi trang, HMR), Bridge mới không biết `designFile`; gửi lại `design-file` khi `bridgeReady` chuyển sang `true`.
- **Khóa chèn vào chính nó** chỉ ở panel Component; Library không bị ảnh hưởng.
- **Không đổi** kéo thả (lượt 6) và dán (lượt 7); test cũ phải xanh nguyên trạng.
- **Giới hạn:** file ≤ 400 dòng, hàm ≤ 50 dòng.
- Sửa `shared`/`bridge` thì chạy `pnpm --filter @kumicraft/bridge build` trước khi test Studio (commit cả file sinh ra).

## 7. Báo cáo và commit

Theo mẫu `README.md`. Lượt này đụng Bridge nên chạy **một lần** `pnpm test:e2e` (Chromium) ở cuối, sau `pnpm verify`. Ghi rõ:

- danh sách component và `importStatement` mà `GET /project/components` trả trên template (dán nguyên văn JSON);
- kết quả kiểm tay bước 1, 3, 4 nếu tự thử được.

```text
feat(studio): add the component panel and the design target bar
```
