# Phase 2 — Lượt 11b: Dễ chọn phần tử (WP-2.12c)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Quy tắc: spec R-SL-13, R-SL-14 (bổ sung 7, 2026-10-19).

**Chia việc:**

- **Claude** làm phần Bridge (`packages/bridge/src/client/`):
  - chặn menu chuột phải của trình duyệt ở chế độ Thiết kế;
  - lấy chuỗi phần tử dưới điểm bấm và gửi `layer-menu`;
  - gửi `layer-menu-close` khi người dùng bấm chuột hoặc cuộn trong Canvas.
- **Gemini** làm toàn bộ phía Studio: menu "Chọn lớp", đường dẫn phần tử trong Inspector, nối thông điệp.
- Hai bên nối qua **thông điệp chốt ở mục 3.1**. Gemini **không sửa** `packages/bridge/src/client/`. Test phía Studio tự giả lập thông điệp, không cần chờ Bridge.

## 1. Mục tiêu (người dùng thấy gì)

1. Ở chế độ Thiết kế, **chuột phải** lên một chỗ trên Canvas → hiện danh sách **Chọn lớp** ngay tại chỗ chuột.
   - Danh sách gồm mọi phần tử dưới điểm bấm, từ ngoài vào trong.
   - Mỗi dòng: `<tag>`, nhãn ngắn, và tên component khi phần tử nằm ở file khác dòng trên.
2. Rê chuột lên một dòng → Canvas tô phần tử đó. Bấm → chọn đúng phần tử đó. Shift + bấm → thêm vào (hoặc bỏ khỏi) vùng chọn.
3. Esc, bấm ra ngoài, hoặc cuộn Canvas → danh sách đóng.
4. Đầu Inspector có **đường dẫn phần tử**: `main › section › div › article`.
   - Rê một bậc → Canvas tô bậc đó. Bấm → chọn bậc đó.
   - Quá 6 bậc thì rút gọn giữa bằng `…`; bấm `…` để hiện hết.
   - Cạnh đường dẫn có gợi ý nhỏ "Esc: chọn cha".

## 2. Đọc trước (CW-52)

| File                                                                                              | Lý do                                                  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `docs/spec.md` R-SL-01, R-SL-11, R-SL-13, R-SL-14                                                 | Quy tắc chọn, nhãn                                     |
| `packages/shared/src/bridge.ts`                                                                   | `ElementRefSchema`, `TreeNodeSchema`, cách viết schema |
| `packages/studio/src/features/selection/bridge-channel.ts`                                        | `dispatchBridgePayload`, `select()`, `highlight()`     |
| `packages/studio/src/features/selection/selection-store.ts`                                       | `selectedRefs`, `treeNodes`, `setSelectedRefs`         |
| `packages/studio/src/features/layers/layer-tree.tsx`                                              | Mẫu chọn và tô từ Studio (`select`, `highlight`)       |
| `packages/studio/src/features/shortcuts/shortcut-actions.ts` (`selectParentNode`)                 | Esc chọn cha; menu mở thì Esc phải đóng menu trước     |
| `packages/studio/src/features/editor/canvas-area.tsx`, `canvas-frame.tsx`, `canvas-view-store.ts` | Chỗ đặt menu trên iframe, `displayedZoom`, `mode`      |
| `packages/studio/src/features/inspector/inspector-panel.tsx`, `components/inspector-header.tsx`   | Chỗ gắn đường dẫn                                      |

## 3. Hợp đồng

### 3.1. Thông điệp Bridge (chốt, Gemini thêm vào `shared/src/bridge.ts` và export qua `index.ts`)

```ts
// Bridge -> Studio, type 'layer-menu' (R-SL-13)
export const LayerMenuItemSchema = z.strictObject({
  ref: ElementRefSchema,
  tag: z.string().min(1),
  label: z.string().max(100).optional(), // cùng quy tắc nhãn R-SL-11 như TreeNode
});
export type LayerMenuItem = z.infer<typeof LayerMenuItemSchema>;

export const BridgeLayerMenuPayloadSchema = z.strictObject({
  x: z.number(), // toạ độ chuột trong khung nhìn của iframe, px CSS, CHƯA nhân zoom
  y: z.number(),
  items: z.array(LayerMenuItemSchema).min(1).max(30), // từ ngoài vào trong
});
export type BridgeLayerMenuPayload = z.infer<typeof BridgeLayerMenuPayloadSchema>;

// Bridge -> Studio, type 'layer-menu-close', payload {} (bấm chuột hoặc cuộn trong iframe)
export const BridgeLayerMenuClosePayloadSchema = z.strictObject({});
```

Không có thông điệp Studio gửi Bridge mới: tô dùng `highlight` có sẵn, chọn dùng `select` có sẵn.

### 3.2. Studio: menu Chọn lớp (`packages/studio/src/features/layer-menu/`, thư mục mới)

**`layer-menu-store.ts`** (zustand):

```ts
type LayerMenuState = {
  readonly menu?: BridgeLayerMenuPayload | undefined;
  show: (menu: BridgeLayerMenuPayload) => void;
  close: () => void;
};
export const useLayerMenuStore: ...;
```

**`bridge-channel.ts`:** trong `dispatchBridgePayload`, thêm `layer-menu` → `show`, `layer-menu-close` → `close`, và `select` từ Bridge → `close`. Payload sai schema thì bỏ qua.

**`layer-menu.tsx`** — `export function LayerMenu()`:

- **Chỗ đặt:** gắn trong `canvas-area.tsx`, cùng khối định vị chứa iframe, để `left = x * displayedZoom`, `top = y * displayedZoom` (px) là đúng chỗ chuột.
  - Đọc `canvas-frame.tsx` để tìm khối đó; nếu iframe có lề hoặc dịch thì cộng vào.
  - Menu tràn đáy hoặc mép phải khối thì lật lên trên / sang trái.
  - Danh sách cao tối đa 320 px, có cuộn.
- **Hiển thị:**
  - `role="menu"`, `data-testid="layer-menu"`, tiêu đề nhỏ `t('layerMenu.title')`.
  - Mỗi dòng là một nút `role="menuitem"`, `data-testid="layer-menu-item"`, `data-loc={ref.loc}`.
  - Nội dung dòng: `<tag>` (font mono) + `label` (màu nhạt, cắt `…` nếu dài).
  - Thêm nhãn file (`data-testid="layer-menu-file"`) khi file trong `ref.loc` **khác file của dòng ngay trên**. Dòng đầu không có nhãn file. Nhãn là tên file bỏ thư mục và đuôi (`src/components/ProductCard.tsx` → `ProductCard`), dùng `parseLocString`. Đây là cách hiện "tên component khi khác file" của R-SL-13; ghi vào `spec-log.md`.
  - Dòng đang được chọn (có trong `selectedRefs`, so `loc` và `index`) thì đánh dấu `aria-checked`.
- **Rê:** `onMouseEnter` dòng → `studioBridgeChannel.highlight(ref)` và `setHoveredRef(ref)`. `onMouseLeave` cả menu → `highlight(undefined)` và `setHoveredRef(undefined)`.
- **Bấm:**
  - Không Shift: `setSelectedRefs([ref])`, rồi `studioBridgeChannel.select([ref], false)`.
  - Shift: có trong vùng chọn thì bỏ, chưa có thì thêm vào cuối, rồi `select(refs, false)`. Bỏ hết thì giữ nguyên vùng chọn cũ.
  - Sau đó `highlight(undefined)` và `close()`.
- **Đóng:**
  - `mousedown` ngoài menu (listener trên `document`, gỡ khi đóng);
  - `mode` chuyển sang `preview`;
  - `layer-menu-close` hoặc `select` từ Bridge;
  - Esc (xem dưới).
  - Khi đóng thì luôn gọi `highlight(undefined)`.
- **Esc:** sửa `selectParentNode()` trong `shortcut-actions.ts`: nếu `useLayerMenuStore.getState().menu !== undefined` thì `close()` và `return true`, **không** đổi vùng chọn. Esc gõ trong iframe hay trong Studio đều đi qua đây.
- **Chế độ Xem trước:** không hiện menu dù nhận được thông điệp.

### 3.3. Studio: đường dẫn phần tử (`features/inspector/components/element-path.tsx`, mới)

Hàm thuần (export để test):

```ts
/** Tổ tiên có data-rc-loc theo tree, từ gốc tới phần tử; không có trong tree → []. */
export function buildElementPath(treeNodes: readonly TreeNode[], ref: ElementRef): TreeNode[];

export type PathSlot =
  { readonly kind: 'node'; readonly node: TreeNode } | { readonly kind: 'more' };
/** ≤ 6 bậc: giữ nguyên. > 6: [bậc đầu, more, 4 bậc cuối] (đủ 6 ô). */
export function collapsePath(path: readonly TreeNode[], max?: number): PathSlot[];
```

- Tìm node theo `loc` **và** `index`, rồi đi ngược `parent`.
- `buildElementPath` không được lặp vô hạn khi `parent` hỏng: tối đa `treeNodes.length` bước.

Component `export function ElementPath()`:

- Hiện khi đúng **một** phần tử được chọn và `buildElementPath` không rỗng. `data-testid="element-path"`, thẻ `nav` có `aria-label`.
- Mỗi bậc **tổ tiên** là nút:
  - `data-testid="element-path-item"`, `data-loc`;
  - chữ hiển thị là `tag`, có `label` thì thêm `.label` màu nhạt, tối đa 12 ký tự;
  - ngăn cách bằng `›`.
- Bậc cuối (phần tử đang chọn) là chữ đậm, không phải nút.
- `…`: nút `data-testid="element-path-more"`, bấm thì hiện đủ mọi bậc. Đổi phần tử chọn thì về lại dạng rút gọn (mẫu "điều chỉnh state khi render" trong README, không `setState` trong effect).
- **Rê** một bậc: `highlight(node.ref)` và `setHoveredRef`. **Rời**: `highlight(undefined)`. **Bấm**: `setSelectedRefs([node.ref])` và `studioBridgeChannel.select([node.ref], true)`.
- Gợi ý `data-testid="element-path-hint"`: `t('inspector.path.hint')` ("Esc: chọn cha").
- Gắn ở đầu khung Inspector một phần tử (`InspectorSingleTargetView`), **trên** `InspectorHeader`.
- Hàng đường dẫn cuộn ngang khi dài, không xuống dòng.

### 3.4. i18n (`vi` và `en`)

| Khóa                   | vi                | en                 |
| ---------------------- | ----------------- | ------------------ |
| `layerMenu.title`      | Chọn lớp          | Select layer       |
| `inspector.path.label` | Đường dẫn phần tử | Element path       |
| `inspector.path.more`  | Hiện mọi bậc      | Show all levels    |
| `inspector.path.hint`  | Esc: chọn cha     | Esc: select parent |

## 4. Tình huống test (Gemini viết, chỉ Studio + shared)

| #   | Đầu vào                                                                                                                  | Kết quả                                                                                        | Mã      |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------- |
| 1   | `BridgeLayerMenuPayloadSchema` với 0 item; 31 item; 3 item hợp lệ                                                        | sai; sai; đúng                                                                                 | R-SL-13 |
| 2   | Bridge gửi `layer-menu` 3 item; rồi `layer-menu-close`; rồi `layer-menu` lại, rồi `select`                               | store có menu; đóng; có menu; đóng                                                             | R-SL-13 |
| 3   | Render menu 4 dòng: `section` (Home.tsx), `div` (Home.tsx), `article` (ProductCard.tsx), `img` (ProductCard.tsx)         | 4 dòng đúng thứ tự, có tag và label; `layer-menu-file` chỉ ở dòng `article`, chữ `ProductCard` | R-SL-13 |
| 4   | Menu x=100, y=50, `displayedZoom` 0.5                                                                                    | `left: 50px`, `top: 25px`                                                                      | R-SL-13 |
| 5   | Rê dòng `div`; rời menu                                                                                                  | `highlight` gọi với ref `div`; rồi với `undefined`                                             | R-SL-13 |
| 6   | Bấm dòng `div`                                                                                                           | `selectedRefs` = [div]; `select([div], false)`; menu đóng                                      | R-SL-13 |
| 7   | Đang chọn `img`, Shift + bấm `div`; Shift + bấm `img`                                                                    | [img, div]; rồi [div]                                                                          | R-SL-13 |
| 8   | Menu mở, gọi `selectParentNode()`                                                                                        | trả `true`, menu đóng, `selectedRefs` không đổi                                                | R-SL-13 |
| 9   | Menu mở: `mousedown` trên `document.body`; mở lại rồi chuyển `mode` sang `preview`                                       | đóng cả hai lần; `highlight(undefined)` được gọi                                               | R-SL-13 |
| 10  | `mode` = `preview`, Bridge gửi `layer-menu`                                                                              | không có `layer-menu` trong DOM                                                                | R-SL-13 |
| 11  | `buildElementPath`: tree `main > section > div > article`, ref `article`; ref không có trong tree; tree có `parent` vòng | 4 node gốc→article; `[]`; dừng, không treo                                                     | R-SL-14 |
| 12  | `collapsePath` với 6 node; 8 node                                                                                        | 6 ô node; [n0, more, n4, n5, n6, n7]                                                           | R-SL-14 |
| 13  | `ElementPath` chọn `article`: bấm `section`                                                                              | `selectedRefs` = [section]; `select([section], true)`                                          | R-SL-14 |
| 14  | `ElementPath` 8 bậc: bấm `element-path-more`; rồi chọn phần tử khác                                                      | hiện đủ 7 nút tổ tiên; về dạng rút gọn                                                         | R-SL-14 |
| 15  | Chọn 2 phần tử; chọn 1 phần tử có trong tree                                                                             | không có `element-path`; có `element-path` và `element-path-hint`                              | R-SL-14 |

## 5. Kiểm tay (chủ dự án, sau khi phần Bridge của Claude xong)

1. Trang Home của dự án mẫu, chế độ Thiết kế: chuột phải lên ảnh trong một thẻ sản phẩm → danh sách có `section`, `div` (lưới), `article`, `img`. Không hiện menu của trình duyệt.
2. Rê từng dòng: Canvas tô đúng phần tử. Bấm `div` lưới: chọn đúng lưới, không phải bấm lặp nhiều lần.
3. Đường dẫn trong Inspector: bấm `section` → chọn lùi đúng một bậc lên `section`. Rê một bậc thấy Canvas tô.
4. Mở menu rồi bấm Esc: menu đóng, vùng chọn giữ nguyên. Bấm Esc lần nữa: chọn cha.
5. Chế độ Xem trước: chuột phải hiện menu bình thường của trình duyệt.
6. Thu phóng 50%: menu vẫn hiện đúng chỗ chuột.

## 6. Bẫy đã biết

- **Không sửa `packages/bridge/src/client/`.** Cần gì thêm từ Bridge thì dừng và báo.
- **So ref bằng cả `loc` và `index`**: phần tử trong vòng lặp có cùng `loc`.
- **Toạ độ chưa nhân zoom**: phải nhân `displayedZoom` (không phải `zoom`, vì `zoom` có thể là `'fit'`).
- **Listener `mousedown` trên `document`** phải gỡ khi đóng hoặc unmount. Bấm _trong_ menu không được tính là "bấm ra ngoài" (kiểm `contains`).
- **Esc** chỉ xử lý qua `selectParentNode()`, không thêm listener Esc thứ hai làm chọn cha hai lần.
- **Không `setState` trong effect** để reset `…` khi đổi phần tử chọn.
- **Viết đúng lint ngay từ đầu**, chạy `pnpm exec eslint <file>` sau mỗi file. File mới ≤ 400 dòng, hàm ≤ 50 dòng.

## 7. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ:

- schema đã thêm vào shared;
- dòng đã ghi vào `spec-log.md`;
- chỗ nào cần Claude làm thêm phía Bridge.

Không chạy `pnpm test:e2e`.

```text
feat(studio): pick nested elements from a layer menu and a path bar
```
