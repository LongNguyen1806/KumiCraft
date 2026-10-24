# Phase 2 — Lượt 13b: Công cụ vẽ trên Canvas (WP-2.09b)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"** và **"Bài học kỹ thuật"**, rồi làm đúng bản này. Quy tắc: spec mục 18B, R-DT-10, R-DT-11, R-DT-12, R-DT-14, R-DT-15.

Lượt 13a đã xong phần ảnh (`insertImage`, hộp `ImagePickerDialog`, `insertImageAt`). Lượt này thêm **thanh công cụ** và **vẽ trực tiếp trên Canvas**.

Gemini **được sửa Bridge**, nhưng chỉ các file ở mục 3.6.

## 1. Mục tiêu (người dùng thấy gì)

1. Thanh Canvas (chỉ ở chế độ Thiết kế) có 4 nút công cụ: **Chọn** (`V`), **Khung** (`F`), **Chữ** (`T`), **Ảnh** (`I`). Công cụ đang dùng được tô đậm.
2. Công cụ khác Chọn: con trỏ trên Canvas là hình chữ thập; bấm vào Canvas **không chọn** phần tử.
3. **Khung:**
   - kéo trên Canvas thấy hình chữ nhật xanh đi theo chuột; nhả thì có `<div>` mới đúng chỗ;
   - rộng gần bằng khung chứa (lệch ≤ 8 px) thì là `w-full`;
   - chỉ bấm (vùng < 8 × 8 px) thì chèn khung `h-24 w-full`;
   - trong khung tự do thì nằm đúng vị trí và kích thước đã kéo.
4. **Chữ:** bấm một điểm → chèn đoạn văn mẫu (theo ngôn ngữ Studio) rồi vào **ngay** chế độ sửa chữ.
5. **Ảnh:** bấm hoặc kéo → mở hộp **Chọn ảnh**; chọn xong thì `<img>` nằm ở chỗ đó, kích thước theo vùng kéo (bấm thì `w-full h-auto`). Hủy hộp thì không chèn gì.
6. Chèn xong: công cụ tự về **Chọn**, phần tử mới được chọn. Mỗi lần vẽ là **một** bước Undo.
7. `Esc` đang kéo: bỏ vùng kéo, không chèn. `Esc` khi đang cầm công cụ (không kéo): về Chọn.

## 2. Đọc trước (CW-52)

| File                                                                                                                                                                              | Lý do                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `docs/spec.md` mục 18B; R-DD-11, R-DD-12 (chọn chỗ thả cùng file); R-TX (sửa chữ)                                                                                                 | Quy tắc                                                                   |
| `packages/bridge/src/client/bridge-client-runtime.ts`, `canvas-tools.ts`, `studio-messages.ts`                                                                                    | Nối sự kiện: `handleCapturedEvent` → `handleToolEvent`, thông điệp Studio |
| `packages/bridge/src/client/drop-target.ts` (`canContain`), `free-frame/free-geometry.ts` (`directLocChildren`, `pointInFrame`, `isFreeFrame`), `overlay-focus.ts` (`focusRoots`) | Tìm khung chứa, vị trí chèn, khung tự do, gốc file thiết kế               |
| `packages/bridge/src/client/overlay.ts`, `free-frame/free-overlay.ts`                                                                                                             | Vẽ trong shadow root (mẫu cho hình chữ nhật đang kéo)                     |
| `packages/shared/src/bridge.ts`, `shortcuts.ts`                                                                                                                                   | Thêm schema thông điệp, phím V/F/T/I                                      |
| `packages/studio/src/features/editor/canvas-area.tsx` (`CanvasToolbar`), `canvas-view-store.ts`                                                                                   | Chỗ đặt nút, nơi giữ công cụ                                              |
| `packages/studio/src/features/selection/bridge-channel.ts`                                                                                                                        | `ready` (gửi lại trạng thái), `startTextEdit`, nhận thông điệp            |
| `packages/studio/src/features/library/insert-block.ts`, `packages/shared/src/library/blocks-basic.ts` (`content.paragraph`)                                                       | Chèn khối, chữ mẫu theo ngôn ngữ (R-LB-11)                                |
| `packages/studio/src/features/draw/` (lượt 13a)                                                                                                                                   | `ImagePickerDialog`, `insertImageAt`                                      |

## 3. Hợp đồng

### 3.1. Shared

`bridge.ts`:

```ts
export const DRAW_TOOLS = ['select', 'frame', 'text', 'image'] as const;
export const DrawToolSchema = z.enum(DRAW_TOOLS);
export type DrawTool = z.infer<typeof DrawToolSchema>;

// Studio → Bridge, type 'set-tool'
export const StudioSetToolPayloadSchema = z.strictObject({ tool: DrawToolSchema });

// Bridge → Studio, type 'draw-end' (nhả chuột sau khi vẽ; Esc thì không gửi)
export const BridgeDrawEndPayloadSchema = z.strictObject({
  tool: z.enum(['frame', 'text', 'image']),
  target: InsertTargetSchema,
  /** Kích thước đã kéo (px, đã làm tròn); vắng = bấm (vùng < 8 × 8 px). */
  size: z.strictObject({ width: z.number().positive(), height: z.number().positive() }).optional(),
  /** Bề rộng vùng nội dung của khung chứa (px), để quyết định w-full. */
  containerWidth: z.number().nonnegative(),
  /** Khung chứa là khung tự do: vị trí và kích thước trong khung, đã hít lưới. */
  placement: PlacementSchema.optional(),
});
```

`shortcuts.ts`:

- thêm hành động `toolSelect`, `toolFrame`, `toolText`, `toolImage`;
- `matchNoModKey`: phím `v`, `f`, `t`, `i` không Shift, không phím bổ trợ;
- nhãn `V`, `F`, `T`, `I`, kèm dòng trong hộp trợ giúp phím.
- **Không** thêm vào `WORKS_WHILE_TYPING`.

Ghi `spec-log.md` (#32): spec ghi `draw-end { tool, target: ElementRef, index, rect }`; code dùng `InsertTarget` (cùng kiểu với `insert`, đã có quy tắc cùng file R-DD-12), thêm `containerWidth` và `placement`.

### 3.2. Bridge: `draw-tool.ts` (mới)

**Hàm thuần**, test được trong happy-dom với `Measure` giả:

```ts
export type DrawResult = BridgeDrawEndPayload | undefined;
/**
 * Khung chứa: phần tử có data-rc-loc SÂU NHẤT dưới điểm bắt đầu mà canContain (đi từ sâu ra ngoài
 * theo getCandidateChain). Không có → phần tử gốc đầu tiên của file thiết kế (focusRoots), không có
 * file thiết kế → phần tử data-rc-loc đầu tiên của trang; vẫn không có → undefined.
 */
export function findDrawContainer(
  doc: Document,
  start: Point,
  designFile: string | undefined,
): Element | undefined;
/**
 * Vị trí chèn trong khung chứa theo trục dọc (R-DT-11): con trực tiếp đầu tiên (directLocChildren)
 * có tâm dọc > start.y và CÙNG FILE với khung chứa → sibling 'before' con đó; không có → child 'end'.
 * Khung chứa là khung tự do → luôn child 'end'.
 */
export function drawTarget(container: Element, start: Point, measure: Measure): InsertTarget;
/** Ghép kết quả: size (≥ 8 × 8 mới tính), containerWidth, placement khi khung tự do (hít lưới). */
export function buildDrawEnd(
  tool: 'frame' | 'text' | 'image',
  container: Element,
  start: Point,
  end: Point,
  grid: GridSize,
  measure: Measure,
): BridgeDrawEndPayload;
```

- `containerWidth` = `clientWidth` trừ `paddingLeft` + `paddingRight` (đọc `getComputedStyle` qua `defaultView` như `layoutAxisOf`; đọc không được thì coi padding là 0).
- Vùng kéo = hình chữ nhật từ `start` tới `end` (kéo ngược cũng đúng).
- **Khung tự do:** góc trên trái của vùng đổi sang toạ độ khung (`pointInFrame`) rồi `snap` theo lưới; `placement = { kind: 'free', left, top }`, có thêm `width`/`height` khi có `size`.
- **Chữ:** chỉ dùng điểm bắt đầu, không gửi `size`.

**Lớp `DrawController`:**

- `setTool(tool)`;
- `isActive()` (công cụ khác `select`);
- `begin(x, y)`: gọi ở `pointerdown` khi công cụ khác Chọn;
- `cancel()` (Esc);
- `destroy()`.

Hành vi:

- Khi công cụ khác Chọn: `document.documentElement.style.cursor = 'crosshair'`. Về Chọn thì trả lại giá trị cũ.
- Kéo: lắng nghe `pointermove`/`pointerup` trên `window` (capture), gỡ khi xong; vẽ hình chữ nhật xanh qua overlay (`overlay.setDrawRect(rect | undefined)`, nét liền 1 px `#2563eb`, nền `rgba(37, 99, 235, 0.08)`).
- `pointerup`: tính `findDrawContainer` (theo **điểm bắt đầu**). Không có khung chứa thì bỏ, không gửi. Có thì `buildDrawEnd` → callback `sendDrawEnd`.
- Sau khi gửi, Bridge **không** tự đổi công cụ; Studio gửi `set-tool select`.

**Nối vào `canvas-tools.ts` và runtime:**

- `studio-messages.ts`: `set-tool` → `tools.setTool`.
- `handleToolEvent` trong runtime:
  - `pointerdown` khi công cụ khác Chọn → `draw.begin`, **không** gọi chọn hay kéo tự do;
  - `click`/`dblclick` khi công cụ khác Chọn → bỏ qua (không chọn, không sửa chữ);
  - `contextmenu` giữ như cũ.
- `handleKeyDown`: `Escape` khi đang kéo vẽ → `draw.cancel()`, chặn phím, **không** chuyển tiếp lên Studio.
- `setMode('preview')` → hủy vẽ, trả con trỏ.
- `pointermove` (hover) khi đang kéo vẽ → không gửi `hover`.
- Runtime đang ~400 dòng: chỉ thêm dòng nối; logic để trong `draw-tool.ts` và `canvas-tools.ts`. Không tắt `max-lines`.

### 3.3. Studio: công cụ

- `canvas-view-store.ts`:
  - `tool: DrawTool` (mặc định `select`, **không** nhớ qua lần tải lại);
  - `setTool(tool)` gửi `set-tool` qua `studioBridgeChannel`.
  - Chuyển `mode` sang `preview` → `tool` về `select`.
  - Bridge `ready` → gửi lại `set-tool` hiện tại (như `set-grid`).
- `features/draw/draw-toolbar.tsx`:
  - 4 nút `data-testid` `draw-tool-select`, `draw-tool-frame`, `draw-tool-text`, `draw-tool-image`;
  - `aria-pressed`, `title` có phím tắt;
  - chỉ hiện ở chế độ Thiết kế; gắn vào `CanvasToolbar`. Icon SVG nội tuyến, không thư viện mới.
- `runShortcut`:
  - `tool*` → `setTool(...)`;
  - `selectParent` (Esc): `tool !== 'select'` thì về `select` và trả `true` **trước** mọi xử lý khác của Esc (sau phần đóng menu Chọn lớp).

### 3.4. Studio: nhận `draw-end` (`features/draw/draw-commands.ts`)

`handleDrawEnd(payload)`, sau đó luôn `setTool('select')` (kể cả khi lỗi hoặc hủy hộp ảnh):

- **Khung (`frame`):**
  - Có `placement` (khung tự do): JSX `<div className="rounded-md bg-slate-100"></div>` và truyền `placement` cho `insert` (server ghi `absolute left/top w/h`).
  - Không `placement`:
    - `size` vắng → class `h-24 w-full rounded-md bg-slate-100`;
    - có `size` → `w` = `w-full` khi `|size.width − containerWidth| ≤ 8`, không thì `pxClass('w', size.width, major)`; `h` = `pxClass('h', size.height, major)`; class `<w> <h> rounded-md bg-slate-100`.
  - Gọi `applyStructureEdit({ kind: 'insert', target, jsx, placement?, tailwindMajor? })`, chọn phần tử mới như `insert-block.ts`.
- **Chữ (`text`):**
  - Chèn khối `content.paragraph` của Library theo ngôn ngữ Studio (`localizedBlockJsx`), cùng `target`/`placement`.
  - Rồi vào sửa chữ: chờ tới khi `treeNodes` có node mang `loc` mới (theo dõi store, tối đa 3 giây; quá hạn thì thôi, phần tử vẫn được chọn), gọi `studioBridgeChannel.startTextEdit({ loc, index: 0 })`.
- **Ảnh (`image`):**
  - Mở `ImagePickerDialog` (component gắn một lần ở `canvas-area.tsx`, mở qua một store nhỏ `useImagePickerStore`).
  - Chọn → `insertImageAt(target, choice, { className, placement })`:
    - `className` khi `size` vắng: `w-full h-auto`;
    - có `size`: `w-full` hoặc `pxClass('w', …)` như khung, cộng `h-auto`;
    - trong khung tự do thì `placement` mang `width`/`height` (`className` để `''`).
  - Hủy → không chèn.
- Lỗi → hiện như lỗi kéo thả (`useDndStore.setError(toErrorInfo(e))`).

### 3.5. i18n (`vi`/`en`)

- `draw.select` (Chọn / Select), `draw.frame` (Khung / Frame), `draw.text` (Chữ / Text), `draw.image` (Ảnh / Image), `draw.toolbar` (Công cụ vẽ / Drawing tools);
- `shortcuts.actions.toolSelect`, `toolFrame`, `toolText`, `toolImage`.

### 3.6. Phạm vi file Bridge được sửa

- Mới: `packages/bridge/src/client/draw-tool.ts` (+ test).
- Sửa: `canvas-tools.ts`, `studio-messages.ts`, `bridge-client-runtime.ts` (chỉ nối), `overlay.ts` (thêm `setDrawRect`), `bridge-client.generated.ts` (chỉ sinh lại bằng build).
- **Không** sửa file Bridge khác.

## 4. Tình huống test

| #   | Đầu vào                                                                                                                 | Kết quả                                                                                                                                              | Mã      |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `matchShortcut` `v`, `f`, `t`, `i`; `Ctrl+F`; `Shift+F`                                                                 | `toolSelect`, `toolFrame`, `toolText`, `toolImage`; không phải `toolFrame`; `undefined`                                                              | R-DT-10 |
| 2   | `findDrawContainer`: điểm trên `<img>` trong `<article>` trong `<section>` (đều có `data-rc-loc`)                       | `article` (img không chứa được con)                                                                                                                  | R-DT-11 |
| 3   | `findDrawContainer`: điểm ngoài mọi phần tử, file thiết kế `src/pages/Home.tsx` có gốc `<main>`; không có file thiết kế | `main`; phần tử `data-rc-loc` đầu tiên của trang                                                                                                     | R-DT-15 |
| 4   | `drawTarget` khung chứa có 3 con xếp dọc (tâm y 50, 150, 250), điểm y = 120; y = 300                                    | sibling `before` con thứ 2; child `end`                                                                                                              | R-DT-11 |
| 5   | `drawTarget` khi con gần nhất khác file với khung chứa (component)                                                      | child `end`                                                                                                                                          | R-DD-12 |
| 6   | `buildDrawEnd('frame')` kéo (10,10)→(15,14); kéo (10,10)→(210,90) ngược chiều (end trước start)                         | không có `size`; `size` {200, 80}                                                                                                                    | R-DT-15 |
| 7   | `buildDrawEnd('frame')` trong khung tự do (khung ở 100,50), kéo (233,127)→(433,227), lưới 8                             | `target` child `end` của khung tự do; `placement` {free, left 136, top 80, width 200, height 100}                                                    | R-DT-11 |
| 8   | `DrawController` công cụ `frame`: `pointerdown` → `pointermove` → `pointerup`; rồi lần nữa với `Esc` giữa chừng         | lần 1 gửi đúng 1 `draw-end`, `setDrawRect(undefined)` khi xong; lần 2 không gửi gì; con trỏ `crosshair` khi khác Chọn, trả lại khi về Chọn           | R-DT-15 |
| 9   | Runtime: công cụ `frame`, `click` trên một phần tử                                                                      | không gửi `select`                                                                                                                                   | R-DT-10 |
| 10  | `handleDrawEnd` frame không `size`; có `size` {596, 120}, `containerWidth` 600; có `size` {200, 80}                     | class `h-24 w-full rounded-md bg-slate-100`; `w-full h-30 rounded-md bg-slate-100`; `w-50 h-20 rounded-md bg-slate-100`; mỗi lần `setTool('select')` | R-DT-11 |
| 11  | `handleDrawEnd` frame có `placement`                                                                                    | `insert` có `placement` và `tailwindMajor`, JSX `<div className="rounded-md bg-slate-100"></div>`                                                    | R-DT-11 |
| 12  | `handleDrawEnd` text; `treeNodes` có node mới sau 100 ms (fake timers)                                                  | `insert` với JSX đoạn văn theo ngôn ngữ; `startTextEdit({ loc mới, index: 0 })` gọi đúng một lần                                                     | R-DT-12 |
| 13  | `handleDrawEnd` image: chọn ảnh có sẵn; lần khác bấm Hủy                                                                | `insertImageAt` với `className: 'w-full h-auto'`; Hủy → không gọi, công cụ về `select`                                                               | R-DT-13 |
| 14  | `DrawToolbar`: bấm `draw-tool-frame`; chế độ `preview`                                                                  | `setTool('frame')`, gửi `set-tool { tool: 'frame' }`, nút `aria-pressed`; ở preview không có thanh và `tool` = `select`                              | R-DT-10 |
| 15  | `selectParentNode()` khi `tool = 'text'`                                                                                | trả `true`, `tool` = `select`, vùng chọn không đổi                                                                                                   | R-DT-15 |

## 5. Kiểm tay (chủ dự án)

1. Trang Home: bấm `F`, kéo một hình giữa hai section → có khung xám đúng chỗ; con trỏ là chữ thập; xong thì về Chọn và khung mới được chọn. Ctrl+Z gỡ.
2. Kéo khung gần hết bề ngang một section → class `w-full`.
3. Bấm `T` rồi bấm vào một section → có đoạn văn mẫu và đang ở chế độ sửa chữ, gõ được ngay.
4. Bấm `I` rồi kéo → hộp Chọn ảnh mở; chọn ảnh → ảnh nằm đúng chỗ. Lần khác bấm Hủy → không có gì.
5. Bản nháp khung tự do: `F` rồi kéo trong khung → khung mới nằm đúng chỗ kéo (absolute), đúng kích thước.
6. Đang kéo bấm `Esc` → không chèn. Cầm công cụ Khung, bấm `Esc` → về Chọn.
7. Thu phóng 50%: vẽ vẫn đúng chỗ chuột.

## 6. Bẫy đã biết

- **Khung chứa lấy theo điểm bắt đầu kéo**, không phải điểm nhả.
- **Không chèn cạnh phần tử khác file** (R-DD-12): con khác file thì chèn cuối khung chứa.
- **Công cụ khác Chọn thì Bridge không chọn và không kéo tự do**: kiểm thứ tự trong `handleToolEvent`. Vẽ phải được xét **trước** `freeDrag`/chọn.
- **Phím `v` `f` `t` `i` khi đang gõ** (ô Inspector, sửa chữ trên Canvas) không được đổi công cụ: bảng phím đã lọc theo `isTypingTarget` và `shouldForwardShortcut`; giữ nguyên.
- **Vào sửa chữ ngay sau chèn**: phần tử chưa có trong DOM cho tới khi HMR xong, nên phải chờ `treeNodes` có `loc` mới (không `setTimeout` cố định).
- **Không đổi hành vi khi công cụ là Chọn**: mọi test cũ của Bridge và Studio phải còn xanh, không sửa assertion.
- Sửa shared hoặc Bridge xong chạy `pnpm --filter @kumicraft/bridge build`.
- **Viết đúng lint ngay từ đầu**, `pnpm exec eslint <file>` sau mỗi file. File ≤ 400 dòng, hàm ≤ 50 dòng.

## 7. Báo cáo và commit

Theo mẫu `README.md`. **Lượt này sửa Bridge nên phải chạy `pnpm test:e2e` một lần** (28 test, Chromium) sau `pnpm verify`, và ghi kết quả.

```text
feat(studio): draw frames, text and images on the canvas
```
