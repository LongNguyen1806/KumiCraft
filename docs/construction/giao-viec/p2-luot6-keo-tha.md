# Phase 2 — Lượt 6: Kéo thả (WP-2.04a)

Đọc `README.md` cùng thư mục trước, rồi làm đúng bản này. Server đã có `insert` và `move` (lượt 2, 3), kể cả kiểm E023. Lượt này **không sửa server**: chỉ `shared`, `bridge`, `studio`.

## 1. Mục tiêu (người dùng thấy gì)

1. Chọn một phần tử trên Canvas: góc trên phải khung chọn có **tay cầm kéo** (ô 16×16, biểu tượng ⠿). Giữ tay cầm và kéo:
   - vạch xanh 2 px hiện giữa các con nơi sẽ thả; thả vào khung rỗng thì viền nét đứt quanh khung và nhãn `↳ <tag>`;
   - không có chỗ thả hợp lệ thì không vẽ gì;
   - con trỏ gần mép trên/dưới iframe (< 40 px) thì trang tự cuộn;
   - thả: file nguồn đổi đúng chỗ, phần tử vừa di chuyển được chọn; **một** bước Undo;
   - **Esc** giữa chừng: hủy, không gửi yêu cầu sửa.
2. Kéo một khối từ panel **Library** vào Canvas: chỉ báo như trên; thả thì chèn khối ở đó. Kéo được **cả khi chưa chọn gì** (bấm khối vẫn cần chọn như lượt 4).
3. Kéo một dòng của **Layer Tree** vào Canvas: di chuyển phần tử đó.
4. Thả ngoài Canvas hoặc Esc: không đổi gì. Server trả E023 (ví dụ di chuyển phần tử gốc của trang): Canvas hiện thông báo lý do, file không đổi.

## 2. Đọc trước (CW-52)

| File                                                                                                            | Lý do                                                                                 |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `docs/spec.md` mục 16 (M-DD), mục 14 (`InsertTarget`, R-SE-21), mục 7.2, 7.3 (tin nhắn Bridge)                  | Quy tắc                                                                               |
| `docs/construction/spec-log.md` #21                                                                             | Các chỗ lượt này lệch spec (đã chốt, làm theo #21)                                    |
| `git show 7b4f0d0:packages/studio/src/features/dnd/drop-target.ts`                                              | Thuật toán bản 0.18 (chỉ số theo trục, vạch chỉ báo, lưu đệm). Có lỗi trục, xem mục 6 |
| `packages/bridge/src/client/bridge-client-runtime.ts`, `overlay.ts`, `studio-messages.ts`, `candidate-chain.ts` | Nơi gắn kéo trong Canvas, vẽ chỉ báo, nhận tin Studio                                 |
| `packages/shared/src/bridge.ts`, `source.ts` (`InsertTargetSchema`, `ElementGuardSchema`, `parseLocString`)     | Thêm schema tin nhắn                                                                  |
| `packages/studio/src/features/selection/bridge-channel.ts`                                                      | Nhận/gửi tin Bridge                                                                   |
| `packages/studio/src/features/editor/canvas-frame.tsx` (`IframeFrame`)                                          | Lớp hứng thả phủ iframe, quy đổi thu phóng                                            |
| `packages/studio/src/features/structure/structure-commands.ts`, `library/insert-block.ts`                       | Dùng lại `runStructureOp`, `applyStructureEdit`                                       |
| `packages/studio/src/features/library/library-panel.tsx`, `layers/layer-tree-row.tsx`                           | Nguồn kéo                                                                             |
| `packages/studio/src/features/inspector/components/structure-actions.tsx` (dòng ~142)                           | Cách hiện `ErrorInfo` (dùng lại cho thông báo lỗi thả)                                |

## 3. Hợp đồng

### 3.1. Shared — `packages/shared/src/bridge.ts` (+ export ở `index.ts`)

```ts
export const DropRectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

// Bridge → Studio. {} = hiện không có chỗ thả hợp lệ (spec-log #21).
export const BridgeDropTargetPayloadSchema = z.union([
  z.strictObject({ target: InsertTargetSchema, rect: DropRectSchema, label: z.string().max(100) }),
  z.strictObject({}),
]);

// Bridge → Studio, khi thả xong một lần kéo trong Canvas (R-DD-14).
export const BridgeMoveIntentPayloadSchema = z.strictObject({
  elements: z.array(ElementGuardSchema).min(1).max(50),
  target: InsertTargetSchema,
});

// Studio → Bridge (R-DD-10). x, y là tọa độ viewport của iframe, đã chia thu phóng.
export const StudioDragOverPayloadSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  source: z.enum(['library', 'layer']),
  refs: z.array(ElementRefSchema).max(50).optional(), // source 'layer': phần tử đang kéo
});
export const StudioDragEndPayloadSchema = z.strictObject({ drop: z.boolean() });
```

Cập nhật bảng tin nhắn trong `studio-messages.ts` (Bridge) và `bridge-channel.ts` (Studio) cho 4 loại `drop-target`, `move-intent`, `drag-over`, `drag-end`. Payload sai schema bị bỏ qua (V-111).

### 3.2. Bridge — `packages/bridge/src/client/drop-target.ts` (mới, hàm thuần)

```ts
export type DropRect = { x: number; y: number; width: number; height: number };
export type LayoutAxis = 'row' | 'column' | 'grid' | 'wrap';
export type DropResult = {
  target: InsertTarget;
  rect: DropRect; // vạch 2 px hoặc khung thả vào trong
  indicator: 'line' | 'box';
  label: string; // tag của cha nhận, ví dụ "section"
};
/** Phần phụ thuộc trình duyệt, tiêm vào để test được trong happy-dom. */
export type DropEnv = {
  hitTest: (x: number, y: number) => readonly Element[]; // elementsFromPoint, đã bỏ overlay
  measure: (el: Element) => DropRect; // getBoundingClientRect
  axisOf: (el: Element) => LayoutAxis;
};
export type DropCache = {
  parent?: Element;
  axis?: LayoutAxis;
  children?: { el: Element; rect: DropRect }[];
};
export function browserDropEnv(doc: Document): DropEnv;
export function layoutAxisOf(el: Element): LayoutAxis;
export function canContain(el: Element): boolean;
export function findDropTarget(
  x: number,
  y: number,
  dragged: readonly Element[],
  env: DropEnv,
  cache: DropCache,
): DropResult | undefined;
```

**`layoutAxisOf`** (dùng `el.ownerDocument.defaultView?.getComputedStyle`): `display` chứa `grid` → `grid`; `display` là `flex`/`inline-flex`: `flexWrap` là `wrap`/`wrap-reverse` → `wrap`, `flexDirection` bắt đầu bằng `row` → `row`, còn lại `column`; **mọi display khác → `column`**.

**`canContain(el)`** (R-DD-11): `el.localName` không thuộc `img, input, br, hr, textarea, select`; mọi `childNodes` là phần tử, hoặc là text chỉ có khoảng trắng, hoặc comment.

**`rcChildren(C, dragged)`**: con trực tiếp của `C` có `data-rc-loc`, bỏ phần tử trong `dragged`. Đo bằng `env.measure`; lưu vào `cache` theo `C` (R-DD-15): `cache.parent === C` thì dùng lại, không đo lại.

**`fileOf(el)`**: `parseLocString(el.getAttribute('data-rc-loc'))?.file`.

**`findDropTarget`**, từng bước:

1. `N` = phần tử đầu tiên trong `env.hitTest(x, y)` có `closest('[data-rc-loc]')`; lấy chính phần tử `closest` đó. Không có → `undefined`.
2. `N` thuộc `dragged` hoặc nằm trong một phần tử của `dragged` → `undefined` (không thả vào chính nó, test #3).
3. **Thả vào trong:** `canContain(N)` và con trỏ cách mọi cạnh của `env.measure(N)` > 12 px:
   - `rcChildren(N)` rỗng → `{ kind: 'child', parent: guard(N), where: 'end' }`, `indicator: 'box'`, `rect` = khung `N`, `label` = `N.localName`;
   - có con → `C = N`, sang bước 5.
4. **Thả cạnh:** `R = N`, `C = R.parentElement?.closest('[data-rc-loc]')`. Không có `C` → `undefined`. Sang bước 6 với `R`.
5. **Chỉ số trong `C`** theo `axisOf(C)` trên `rcChildren(C)` (như 0.18): `row` so `x` với giữa ngang, `column` so `y` với giữa dọc, `grid`/`wrap`: `y < rect.y` → trước; `y ≤ đáy` và `x < giữa ngang` → trước. Chỉ số `i < n` → `R = children[i]`, `where: 'before'`; `i = n` → `R = children[n-1]`, `where: 'after'`. Sang bước 6.
   - Ở bước 4 thì `where` lấy theo vị trí con trỏ so với giữa `R` trên trục của `C` (`row`, `grid`, `wrap`: theo `x`; `column`: theo `y`).
6. **R-DD-12:** `fileOf(R) === fileOf(C)` → kết quả `{ kind: 'sibling', ref: guard(R), where }`, `indicator: 'line'`, `label` = `C.localName`, `rect` = vạch như `makeLineIndicator` của 0.18. Khác file → leo lên: `R = C`, `C = C.parentElement?.closest('[data-rc-loc]')`, tính lại `where` như bước 4, lặp bước 6. Hết cha → `undefined`.

`guard(el)` = `{ loc: el.getAttribute('data-rc-loc'), tag: el.localName }` (dùng `localName`, không `tagName`: giữ đúng hoa thường của SVG như `linearGradient`).

### 3.3. Bridge — `packages/bridge/src/client/drag.ts` (mới) + gắn vào runtime

```ts
export type DragCallbacks = {
  sendDropTarget: (p: BridgeDropTargetPayload) => void;
  sendMoveIntent: (p: BridgeMoveIntentPayload) => void;
  showIndicator: (d: DropResult | undefined) => void;
};
export class DragController {
  constructor(env: DropEnv, cb: DragCallbacks, win: Window);
  isDragging(): boolean;
  beginCanvasDrag(elements: readonly Element[], x: number, y: number): void; // từ tay cầm
  studioDragOver(p: StudioDragOverPayload): void; // lần đầu thì bắt đầu kéo kiểu 'studio'
  studioDragEnd(drop: boolean): void; // chỉ xóa chỉ báo; Studio tự gọi server
  cancel(): void; // Esc
  destroy(): void;
}
```

- **Kéo trong Canvas:** `pointerdown` trên tay cầm → nhớ điểm đầu; chỉ bắt đầu kéo khi chuột đi ≥ 4 px. `pointermove` (đăng ký trên `window`, capture) gộp theo `requestAnimationFrame`: tính `findDropTarget`, gọi `showIndicator`; gửi `drop-target` **chỉ khi** đích đổi (so `JSON.stringify(target)`). `pointerup`: có đích → `sendMoveIntent({ elements: guards theo thứ tự DOM, target })`; luôn xóa chỉ báo và gửi `drop-target {}`. Sau `pointerup` của một lần kéo, **bỏ qua đúng một `click`** kế tiếp (không đổi vùng chọn).
- **Phần tử được kéo** (R-DD-17): vùng chọn 1 phần tử → nó; nhiều phần tử **cùng `parentElement`** → tất cả theo thứ tự DOM; khác cha → **không hiện tay cầm**.
- **Kéo từ Studio:** `drag-over` → `dragged` = các phần tử của `refs` (rỗng với `library`), tính đích như trên, gửi `drop-target` khi đổi. `drag-end` → xóa chỉ báo, về trạng thái nghỉ.
- **Tự cuộn (R-DD-16):** khi đang kéo (cả hai kiểu) mà `y < 40` hoặc `y > innerHeight - 40`: vòng `requestAnimationFrame` gọi `win.scrollBy(0, ∓12)` tới khi con trỏ rời vùng mép hoặc hết kéo. Mỗi lần cuộn, `scroll`, `resize`: xóa `cache` (R-DD-15).
- **Esc:** runtime chặn `keydown` Escape khi `isDragging()` (trước `shouldForwardShortcut`, `preventDefault`), gọi `cancel()`: xóa chỉ báo, gửi `drop-target {}`, không gửi `move-intent`.
- Chế độ `preview` hoặc đang sửa chữ (`textEdit.isActive()`): không kéo, không hiện tay cầm.

### 3.4. Bridge — `overlay.ts`

- Shadow root là `closed`, nên listener ở `window` **không thấy** tay cầm. Tay cầm là `div.drag-handle` (`pointer-events: auto`, `cursor: grab`) trong shadow, gắn `pointerdown` trực tiếp lên nó; overlay nhận callback `onHandleDown(x, y)` qua constructor hoặc `setHandleListener`. Gọi `event.preventDefault()` và `stopPropagation()` trong listener đó.
- `setDragHandle(el | undefined)`: đặt tay cầm ở góc trên phải khung của `el` (lệch ra ngoài 2 px), cập nhật theo `render()` hiện có.
- `setDropIndicator(d | undefined)`: `line` → `div.drop-line` nền `#2563eb`; `box` → `div.drop-box` viền `2px dashed #2563eb` + nhãn `↳ <label>` (dùng lại kiểu `.tag-label`). Khi kéo, ẩn khung hover.
- Giữ `overlay.ts` ≤ 400 dòng; dài quá thì tách `overlay-drag.ts`.

### 3.5. Studio

**`features/dnd/dnd-store.ts`** (zustand, mới):

```ts
type DragSource =
  { source: 'library'; block: LibraryBlock } | { source: 'layer'; ref: ElementRef; tag: string };
type DndState = {
  drag?: DragSource;
  dropTarget?: InsertTarget; // đích cuối cùng Bridge báo
  error?: ErrorInfo;
  startDrag(s: DragSource): void;
  setDropTarget(t: InsertTarget | undefined): void;
  endDrag(): void; // xóa drag và dropTarget
  setError(e: ErrorInfo | undefined): void;
};
```

**`features/dnd/drop-actions.ts`** (mới):

- `executeDropMove(elements: ElementGuard[], target: InsertTarget): Promise<boolean>`: `applyStructureEdit({ kind: 'move', … })`; thành công chọn `res.locs[0]`; lỗi → `dnd-store.setError(toErrorInfo(err))`.
- `executeDropInsert(block, target, lang)`: tách phần gọi server của `insertBlock` thành `insertBlockAt(block, target, lang)` trong `insert-block.ts`; `insertBlock` (bấm) gọi lại nó. Lỗi khi thả → `dnd-store.setError`.
- `handleDrop()`: đọc `drag`, `dropTarget`, gọi `endDrag()` trước, rồi: không có đích → không gọi server; `library` → `executeDropInsert`; `layer` → `executeDropMove([{ loc: ref.loc, tag }], target)`.

**`bridge-channel.ts`:** thêm `dragOver(p)`, `dragEnd(drop)`. Nhận `drop-target` → `setDropTarget(target)` (payload `{}` → `undefined`); `move-intent` → `executeDropMove(elements, target)`.

**`features/dnd/canvas-drop-layer.tsx`** (mới), đặt trong `IframeFrame`, phủ đúng khung iframe (`absolute inset-0` trong khung đã `scale`, cha `relative`), **chỉ render khi `drag` có giá trị**, `data-testid="canvas-drop-layer"`:

- `onDragOver`: `preventDefault()`; gộp theo `requestAnimationFrame`; gửi `dragOver({ x, y, source, refs })` với
  `x = (e.clientX - r.left) / zoom - iframe.clientLeft`, `y = (e.clientY - r.top) / zoom - iframe.clientTop`, `r = iframe.getBoundingClientRect()`. Viết thành hàm thuần `toFrameCoords(clientX, clientY, rect, zoom, clientLeft, clientTop)` để test.
- `onDragLeave` (ra khỏi lớp, không phải vào con): `dragEnd(false)` để Bridge xóa chỉ báo, `setDropTarget(undefined)`; giữ `drag` (người dùng có thể quay lại).
- `onDrop`: `preventDefault()`, `dragEnd(true)`, `handleDrop()`.

**`features/dnd/dnd-error-banner.tsx`** (mới): khi `error` có giá trị, dải báo trên Canvas `role="alert"` `data-testid="dnd-error"`, nội dung như `structure-actions.tsx`, nút đóng `data-testid="dnd-error-dismiss"`. Lần kéo mới xóa lỗi cũ.

**Nguồn kéo:**

- `library-panel.tsx`: khối `draggable`; **bỏ thuộc tính `disabled`** (nút disabled không kéo được), thay bằng `aria-disabled` + chặn `onClick` khi không có vùng chọn, giữ nguyên giao diện mờ. `onDragStart`: `dataTransfer.setData('text/plain', block.id)`, `effectAllowed = 'copy'`, `startDrag({ source: 'library', block })`. `onDragEnd`: `drag` còn (chưa thả vào Canvas) → `dragEnd(false)`, `endDrag()`.
- `layer-tree-row.tsx`: dòng `draggable`, `setData('text/plain', tag)`, `effectAllowed = 'move'`, `startDrag({ source: 'layer', ref, tag })`, `onDragEnd` như trên.

**i18n** (`vi`, `en`, namespace `editor`): `dnd.dismiss` = "Đóng" / "Dismiss". `library.hint` sửa thành "Chọn một phần tử rồi bấm khối, hoặc kéo khối vào Canvas" / "Select an element and click a block, or drag a block onto the Canvas" (nếu khóa nằm ở namespace khác, sửa đúng chỗ đó).

## 4. Tình huống test

Test Bridge dùng `// @vitest-environment happy-dom`. happy-dom **không có** `elementsFromPoint` và trả khung 0: dựng `DropEnv` giả (`hitTest` trả danh sách định sẵn, `measure` đọc từ `Map<Element, DropRect>`, `axisOf` trả trục định sẵn). Cấm mock `findDropTarget` trong test của chính nó.

| #   | Đầu vào                                                                                                                                                                                                                 | Kết quả                                                                                            | Mã          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| 1   | `layoutAxisOf` với style nội tuyến: `display:block`; `flex`; `flex; flex-direction:column`; `flex; flex-wrap:wrap`; `grid`                                                                                              | `column`, `row`, `column`, `wrap`, `grid`                                                          | R-DD-11     |
| 2   | `canContain`: `<img>`, `<p>chữ</p>`, `<div> <span/> </div>`, `<div></div>`, `<div><!--c--><a/></div>`                                                                                                                   | `false`, `false`, `true`, `true`, `true`                                                           | R-DD-11     |
| 3   | Cha cột (x 0–400), 3 con `div` rỗng (y 0–100, 100–200, 200–300, x 0–400); `hitTest` trả con chứa điểm; trỏ `x=5` (trong 12 px mép trái) tại `y=120`, `y=180`, `y=290`                                                   | `sibling` con 2 `before`; con 2 `after`; con 3 `after`                                             | R-DD-11     |
| 4   | Cha hàng (0,0,400,100), 3 con x 0–80, 100–180, 200–280; `hitTest` trả cha; trỏ `(190, 50)`                                                                                                                              | `sibling` con 3 `before`, `label` = tag cha                                                        | R-DD-11     |
| 5   | Lưới 3 cột, 6 con `<p>chữ</p>` ô 100×100 (2 hàng); trỏ `(120, 150)` (nửa trái ô 5); lặp lại với trục `wrap`                                                                                                             | `sibling` ô 5 `before` (cả hai)                                                                    | R-DD-11     |
| 6   | Trỏ vào giữa `<section>` rỗng                                                                                                                                                                                           | `child` `end`, `indicator: 'box'`, `label: 'section'`                                              | R-DD-11     |
| 7   | Trỏ vào `<p>` trong `div` cột (`p` không chứa được), nửa trên của `p`                                                                                                                                                   | `sibling` `ref` = `p`, `before`, `label` = `div`                                                   | R-DD-11     |
| 8   | `section` (`Home.tsx:4:5`) > `div` lưới (`Home.tsx:5:7`) > 2 `div` gốc Card (`Card.tsx:3:5`, có chữ nên không chứa được); trỏ nửa trái Card thứ 2                                                                       | Card và lưới khác file → leo lên: `sibling` `ref` = lưới (`Home.tsx:5:7`), `label: 'section'`      | R-DD-12     |
| 9   | Kéo `div#a`, trỏ vào `#a` và vào con của `#a`                                                                                                                                                                           | `undefined` cả hai                                                                                 | R-DD-11     |
| 10  | Gọi `findDropTarget` 2 lần cùng cha; `measure` đếm số lần gọi                                                                                                                                                           | Lần 2 không đo lại con; đổi cha hoặc xóa `cache` thì đo lại                                        | R-DD-15     |
| 11  | `DragController`: bắt đầu kéo, `pointermove` qua 3 vị trí (2 cùng đích), `pointerup`                                                                                                                                    | `sendDropTarget` gọi 2 lần với đích + 1 lần `{}`; `sendMoveIntent` 1 lần đúng `elements`, `target` | R-DD-13, 14 |
| 12  | `DragController`: kéo rồi `cancel()`; kéo nhiều phần tử khác cha                                                                                                                                                        | Không `sendMoveIntent`; khác cha không bắt đầu kéo                                                 | R-DD-17     |
| 13  | `DragController`: `y = 10` khi đang kéo (`win.scrollBy` giả)                                                                                                                                                            | `scrollBy(0, -12)` được gọi; `y = 300` của `innerHeight 600` thì không                             | R-DD-16     |
| 14  | Studio `toFrameCoords(150, 220, {left:100, top:200}, 0.5, 1, 1)`                                                                                                                                                        | `{ x: 99, y: 39 }`                                                                                 | R-DD-10     |
| 15  | Studio `handleDrop`: (a) library + đích → `applyStructureEdit` nhận `insert` đúng `target`, `jsx` theo ngôn ngữ; (b) layer → `move`; (c) không đích → không gọi; (d) server ném E023 → `dnd-error` hiện, chọn không đổi | Đúng                                                                                               | R-DD-14     |

Test #8: "nửa trái Card thứ 2" chọn theo trục của lưới (`row`); kỳ vọng `where` tính theo giữa của **lưới** trên trục của `section` (`column`), ghi rõ tọa độ trong test.

Thêm vào `library-panel.test.tsx`: không có vùng chọn thì khối vẫn `draggable="true"`, bấm không gọi server (test cũ về khóa vẫn xanh, sửa selector nếu đang dùng `toBeDisabled` → `aria-disabled`, ghi lý do trong báo cáo).

## 5. Kiểm tay (chủ dự án)

Trên dự án mới (template):

1. Chọn section sản phẩm ở Home, kéo tay cầm lên trên hero: vạch xanh hiện giữa hai section; thả → file `Home.tsx` đổi thứ tự hai section, Canvas đúng; **Ctrl+Z** một lần trả lại như cũ.
2. Kéo khối **Card** từ Library vào khoảng giữa hai section: thả → Card mới ở đó, đang được chọn; Ctrl+Z xóa nó.
3. Kéo một nút giữa chừng rồi bấm **Esc**: không có gì đổi (`git status` sạch).
4. Kéo khối Library rồi thả ra ngoài Canvas (vào panel): không có gì đổi.
5. Kéo vào giữa hai thẻ ProductCard trong lưới: không có vạch giữa hai thẻ (ranh giới component, R-DD-12); chỉ báo nhảy ra cạnh lưới.
6. Trang dài: kéo xuống mép dưới Canvas, trang tự cuộn.
7. Kéo một dòng Layer Tree vào Canvas: phần tử di chuyển tới chỗ thả.
8. Kéo phần tử gốc của trang: server từ chối, dải báo lỗi hiện, file không đổi.
9. Thử ở thu phóng 50% và 100%: vạch chỉ báo nằm đúng dưới con trỏ.

Trên WorkTracker:

10. Kéo một thẻ trong một trang sang vị trí khác cùng file: file đúng, Undo đúng; chỗ không hỗ trợ (trong `.map`) báo lý do, không hỏng file.

## 6. Bẫy đã biết

- **Lỗi trục của 0.18:** `flexDirection` mặc định là `row` cả khi `display: block`, nên 0.18 coi mọi khối thường là hàng. Phải xét `display` trước (mục 3.2).
- **Shadow `closed`:** `event.composedPath()` từ `window` không thấy tay cầm; gắn listener lên chính tay cầm.
- **`handleCapturedEvent` đang `preventDefault` mọi `pointerdown`:** không đổi việc đó; kéo bắt đầu từ listener của tay cầm, di chuyển và thả nghe ở `window` capture. Nhớ bỏ đúng một `click` sau khi thả.
- **Kéo HTML5 trên iframe:** sự kiện `dragover` đi vào iframe chứ không tới trang cha, nên cần lớp hứng phủ iframe khi đang kéo; lớp chỉ có khi `drag` có giá trị, nếu không sẽ chặn chọn phần tử.
- **Viền iframe 1 px** và `scale(zoom)`: dùng công thức `toFrameCoords`, test #14.
- **`setData` bắt buộc** trong `dragstart` (Firefox không kéo nếu thiếu).
- **Thứ tự tin nhắn:** Studio dùng `dropTarget` cuối cùng đã nhận; không đợi Bridge trả lời sau `drag-end`.
- **Không viết E2E mới** (spec-log #21: test #4–6 của M-DD thay bằng unit + kiểm tay). Không chạy `pnpm test:e2e` trừ bước cuối dưới đây.
- **Giới hạn:** file ≤ 400 dòng, hàm ≤ 50 dòng; `bridge-client-runtime.ts` đã 404 dòng: chuyển phần nối kéo thả vào `drag.ts`, không làm runtime dài thêm (tách nếu cần).
- Sửa `shared`/`bridge` thì chạy `pnpm --filter @reactcraft/bridge build` trước khi test Studio (file `bridge-client.generated.ts` phải được sinh lại và commit).

## 7. Báo cáo và commit

Theo mẫu `README.md`. Lượt này đụng Bridge nên chạy **một lần** `pnpm test:e2e` (Chromium) ở cuối, sau `pnpm verify`. Ghi rõ:

- kết quả kiểm tay bước 1, 2, 3, 9 nếu tự thử được;
- số dòng của `drop-target.ts`, `drag.ts`, `overlay.ts`, `bridge-client-runtime.ts`.

```text
feat(studio): drag elements and library blocks onto the canvas
```
