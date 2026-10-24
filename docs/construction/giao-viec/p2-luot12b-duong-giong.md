# Phase 2 — Lượt 12b: Đường gióng và ô lưới khi kéo (WP-2.12d)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"** và **"Bài học kỹ thuật"** (phần tử trong iframe), rồi làm đúng bản này.

Lượt này làm hai việc, **toàn bộ trong Bridge** (`packages/bridge/src/client/`):

- **A. Đường gióng thông minh** — spec R-FF-18.
- **B. Ô lưới khi kéo qua khung `grid`** — bổ sung theo chủ dự án ngày 2026-10-20, ghi ở `spec-log.md` #30.

Khác các lượt trước: lượt này **Gemini được sửa Bridge**, nhưng **chỉ các file ở mục 3**. Không cần thông điệp mới giữa Bridge và Studio, nên **không sửa Studio, shared, server**.

## 1. Mục tiêu (người dùng thấy gì)

1. **Kéo** một phần tử trong khung tự do (kéo thân phần tử, R-FF-13):
   - Mép trái, tâm ngang hoặc mép phải của nó cách mép trái, tâm hoặc mép phải của một anh em (hoặc của chính khung) **≤ 4 px** → phần tử **hít vào** đúng vị trí đó và hiện **vạch hồng `#ec4899`** dọc.
   - Tương tự theo chiều dọc với mép trên, tâm dọc, mép dưới → vạch hồng ngang.
   - Đường gióng **ưu tiên hơn lưới**: trục nào hít được thì không làm tròn theo lưới nữa; trục nào không hít thì vẫn theo lưới như cũ.
   - Phần tử nằm giữa hai anh em trên cùng hàng (hoặc cùng cột) và hai khoảng cách chênh nhau ≤ 4 px → hít cho **cách đều**, vẽ hai dấu khoảng cách màu hồng kèm số px.
2. **Kéo giãn** bằng chấm (R-FF-14) trong khung tự do: mép đang kéo hít vào mép/tâm của anh em và khung (≤ 4 px, ưu tiên hơn lưới), có vạch hồng. Phần tử ở chỗ thường (3 chấm) không có đường gióng.
3. Nhả chuột hoặc Esc: mọi vạch hồng biến mất.
4. **Kéo qua một khung `display: grid`** (kéo trong Canvas bằng tay cầm, hoặc kéo từ Thư viện/Component/Layer Tree):
   - Khi vị trí thả nằm trong khung đó (khung chứa của kết quả thả là `grid`), Bridge vẽ **đủ các ô lưới** của khung bằng nét đứt xanh mờ.
   - Vạch chèn xanh có sẵn vẫn hiện như cũ.
   - Ra khỏi khung hoặc thả xong thì các ô biến mất.
   - Khung `flex` và khung thường không đổi gì.

## 2. Đọc trước (CW-52)

| File                                                                                                    | Lý do                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `docs/spec.md` R-FF-13, R-FF-14, R-FF-18, R-DD-11 đến R-DD-13; `docs/construction/spec-log.md` #29, #30 | Quy tắc                                                                                         |
| `packages/bridge/src/client/free-frame/free-geometry.ts`                                                | `Box`, `Measure`, `boxInFrame`, `pointInFrame`, `directLocChildren`, `freeFrameOf`              |
| `packages/bridge/src/client/free-frame/free-drag.ts`                                                    | `previewMove`, `previewResize`, `FreeDragCallbacks`, phiên kéo; `free-frame.test.ts` (mẫu test) |
| `packages/bridge/src/client/free-frame/resize-box.ts`                                                   | `resizeBox`: hít mép theo lưới                                                                  |
| `packages/bridge/src/client/free-frame/free-overlay.ts`                                                 | Vẽ trong shadow root của overlay (`FreeOverlay`, CSS)                                           |
| `packages/bridge/src/client/canvas-tools.ts`, `overlay.ts`                                              | Nối callback, thứ tự vẽ (`render()`), `setDropIndicator`                                        |
| `packages/bridge/src/client/drag.ts`, `drop-target.ts`                                                  | `evaluateDropTarget`, `DropEnv` (tiêm phụ thuộc để test), `DropResult.container`                |

## 3. Hợp đồng

### 3.1. A — Hàm thuần `free-frame/smart-guides.ts` (mới)

Mọi toạ độ là **toạ độ trong khung** (như `boxInFrame`), px.

```ts
export const GUIDE_THRESHOLD_PX = 4;

/** Một vạch gióng: axis 'x' = vạch dọc tại x = pos, kéo từ `from` tới `to` theo y; 'y' ngược lại. */
export type GuideLine = {
  readonly axis: 'x' | 'y';
  readonly pos: number;
  readonly from: number;
  readonly to: number;
};
/** Dấu khoảng cách bằng nhau: đoạn [from, to] trên trục `axis`, nằm ở `at` của trục kia. */
export type GapMark = {
  readonly axis: 'x' | 'y';
  readonly from: number;
  readonly to: number;
  readonly at: number;
};

export type GuideResult = {
  /** Vị trí đã hít; undefined trên trục không hít được (caller làm tròn theo lưới). */
  readonly left?: number | undefined;
  readonly top?: number | undefined;
  readonly lines: readonly GuideLine[];
  readonly gaps: readonly GapMark[];
};

/** Hít cả hộp đang kéo vào anh em và khung (R-FF-18). */
export function snapMove(
  moving: Box,
  others: readonly Box[],
  frame: { width: number; height: number },
): GuideResult;

/** Hít một mép đang kéo giãn: trả vị trí mép mới và vạch, hoặc undefined khi không có đích ≤ 4 px. */
export function snapEdge(
  axis: 'x' | 'y',
  value: number,
  others: readonly Box[],
  frame: { width: number; height: number },
): { readonly pos: number; readonly line: GuideLine } | undefined;
```

**Thuật toán `snapMove`, theo từng trục (ví dụ trục x):**

1. Điểm của hộp đang kéo: `left`, `left + width/2`, `left + width`.
2. Đích:
   - mỗi hộp trong `others`: `left`, tâm, phải;
   - khung: `0`, `frame.width / 2`, `frame.width`.
3. Chọn cặp (điểm, đích) có `|đích − điểm|` nhỏ nhất và ≤ 4. Không có → trục đó `undefined`, không vạch.
4. Có → `left` mới = `left + (đích − điểm)`. Vạch dọc tại `pos = đích`:
   - `from` = min(top) của hộp đã hít và **mọi** hộp có cùng đích (sai số 0,5 px);
   - `to` = max(bottom) của các hộp đó;
   - đích là khung thì `from = 0`, `to = frame.height`.
5. **Cách đều** (chỉ khi trục x không hít theo mép/tâm ở bước 3):
   - Tìm hộp gần nhất bên trái (`right ≤ moving.left`) và bên phải (`left ≥ moving.right`) mà chồng theo trục y với hộp đang kéo.
   - Gọi `gL = moving.left − A.right`, `gR = B.left − moving.right`.
   - `|gL − gR| ≤ 4` → `left` mới làm hai khoảng bằng nhau (`(A.right + B.left − width) / 2`, làm tròn), kèm 2 `GapMark` trục x, `at` = tâm dọc của hộp đang kéo.
6. Làm tương tự cho trục y.
7. Mọi số trả về làm tròn `Math.round`.

**`snapEdge`:** đích như bước 2 của trục tương ứng, chọn đích gần nhất ≤ 4. Vạch kéo suốt chiều cao (hoặc rộng) của hộp đích và khung tương ứng.

### 3.2. A — Nối vào `free-drag.ts`

- **Lúc bắt đầu phiên** (`tryBeginMove`, `beginResize` khi phần tử nằm trong khung tự do):
  - đo một lần các anh em `others` = `directLocChildren(frame)` trừ các phần tử đang kéo (`boxInFrame`);
  - đo kích thước khung `frame` (`measure(frame)` width/height trừ viền: dùng `frame.clientWidth`/`clientHeight`);
  - lưu vào phiên. Không đo lại mỗi lần di chuột.
- **`previewMove`:**
  1. Tính hộp thô của phần tử đầu = `start + (dx, dy)` (chưa làm tròn).
  2. `snapMove(hộp thô, others, frame)`.
  3. `left` = kết quả hít nếu có, không thì `snap(thô, grid)` như cũ; `top` tương tự.
  4. Các phần tử khác dời theo phần tử đầu như hiện tại.
  5. Gọi callback mới `showGuides(lines, gaps)`.
- **`previewResize`** (chỉ khi `inFree`):
  - Thêm tham số tuỳ chọn cho `resizeBox`: `edgeSnap?: (axis: 'x' | 'y', value: number) => number | undefined`.
  - Mép nào đang kéo thì thử `edgeSnap` trước; `undefined` thì làm tròn theo lưới như cũ.
  - Kẹp kích thước tối thiểu và Shift giữ tỉ lệ giữ nguyên như cũ.
  - Gom các vạch của mép đã hít, gọi `showGuides(lines, [])`.
- **`end()`** (nhả chuột, Esc, hủy) gọi `showGuides([], [])`.
- `FreeDragCallbacks` thêm `showGuides: (lines: readonly GuideLine[], gaps: readonly GapMark[], frame?: Element) => void`. `frame` để overlay đổi toạ độ khung sang toạ độ màn hình.

### 3.3. A — Vẽ trong `free-overlay.ts`

- Lớp mới trong shadow root (sau chấm kéo giãn, trước nhãn số đo): `setGuides(lines, gaps, frame)`, rồi vẽ ở `render()`.
- **Đổi toạ độ khung → màn hình:**
  - `x_màn hình = frameRect.left + frame.clientLeft − frame.scrollLeft + x`;
  - `y_màn hình = frameRect.top + frame.clientTop − frame.scrollTop + y`.
- **Vạch:** div 1 px, nền `#ec4899`, `pointer-events: none`.
- **Dấu khoảng cách:** đoạn 1 px màu hồng có hai gạch đầu, kèm nhãn số px (chữ trắng nền hồng, 10 px) ở giữa đoạn.
- `canvas-tools.ts`: callback `showGuides` → `overlay.free.setGuides(...)` rồi `overlay.requestRender()`.

### 3.4. B — Ô lưới khi kéo qua `grid`

**Hàm thuần `grid-cells.ts`** (mới, trong `src/client/`):

```ts
export type GridTracks = {
  readonly columns: readonly number[]; // px từng cột (đã resolve)
  readonly rows: readonly number[];
  readonly columnGap: number;
  readonly rowGap: number;
  /** Gốc của vùng nội dung (sau viền và padding) trong toạ độ màn hình. */
  readonly originX: number;
  readonly originY: number;
};
/** Đọc từ getComputedStyle: `grid-template-columns`/`rows` là danh sách px ("200px 200px"); không phải grid → undefined. */
export function readGridTracks(el: Element): GridTracks | undefined;
/** Hình chữ nhật từng ô theo hàng rồi cột; tối đa 200 ô. */
export function gridCells(tracks: GridTracks): DropRect[];
```

- `readGridTracks`:
  - `display` chứa `grid`;
  - tách `gridTemplateColumns`/`gridTemplateRows` theo khoảng trắng, mỗi phần `parseFloat`, bỏ phần không phải số (`none`, `subgrid`) → danh sách rỗng thì `undefined`;
  - `columnGap`/`rowGap`: `parseFloat`, `normal` → 0;
  - gốc = `rect.left + borderLeftWidth + paddingLeft`, tương tự trên.
  - Dùng `el.ownerDocument.defaultView?.getComputedStyle` như `layoutAxisOf` (bài học iframe).
- `gridCells`: x của cột i = gốc + tổng cột trước + i × gap; tương tự hàng.

**Nối:**

- `DropEnv` thêm `gridTracks?: (el: Element) => GridTracks | undefined`; `browserDropEnv` gán `readGridTracks`. Để tuỳ chọn để các test cũ không phải đổi.
- `DragController.evaluateDropTarget`: sau khi có kết quả cuối (cả sau `applyFreeFrame`), nếu `res.container` có `env.gridTracks` trả giá trị thì gọi callback mới `showGridCells(gridCells(tracks))`; không thì `showGridCells(undefined)`. Mọi chỗ đang gọi `showIndicator(undefined)` (hủy, thả, kết thúc kéo từ Studio) cũng gọi `showGridCells(undefined)`.
- `DragCallbacks` thêm `showGridCells: (cells: readonly DropRect[] | undefined) => void`.
- `overlay.ts`:
  - thêm `setGridCells(cells)`;
  - lớp vẽ các ô là div `box-sizing: border-box`, `border: 1px dashed rgba(37, 99, 235, 0.45)`, nền `rgba(37, 99, 235, 0.04)`, `pointer-events: none`;
  - vẽ **dưới** vạch chèn (thêm vào shadow root trước `dropLine`).
- `bridge-client-runtime.ts`: thêm callback `showGridCells` vào `DragController`, gọi `this.overlay.setGridCells(c)`. File đang gần 400 dòng: chỉ thêm đúng 3 dòng callback; quá giới hạn thì gom callback vào một hàm trong `canvas-tools.ts`, **không** tắt luật `max-lines`.

### 3.5. Phạm vi file

| Được sửa/tạo                                                                                                                                                                                                                                                                                                                    | Không được sửa                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `free-frame/smart-guides.ts` (mới), `free-frame/free-drag.ts`, `free-frame/resize-box.ts`, `free-frame/free-overlay.ts`, `canvas-tools.ts`, `grid-cells.ts` (mới), `drag.ts`, `drop-target.ts`, `overlay.ts`, `bridge-client-runtime.ts` (chỉ nối callback), test tương ứng, `bridge-client.generated.ts` (sinh lại bằng build) | Mọi file khác của Bridge; `packages/shared`, `server`, `studio`; `docs/spec.md` |

## 4. Tình huống test (Gemini viết, happy-dom, đo bằng `Measure`/`DropEnv` giả như `free-frame.test.ts`)

Khung 600×400; anh em `A` = {left 40, top 24, 200×100}, `B` = {left 400, top 24, 100×100}.

| #   | Đầu vào                                                                                                                               | Kết quả                                                                                                                              | Mã      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 1   | `snapMove` hộp {left 43, top 300, 50×50}, others [A, B]                                                                               | `left` 40 (mép trái A), `top` undefined; một vạch x pos 40, from 24, to 350                                                          | R-FF-18 |
| 2   | `snapMove` hộp {left 112, top 300, 50×50} (tâm 137, tâm A 140)                                                                        | `left` 115; vạch x pos 140                                                                                                           | R-FF-18 |
| 3   | `snapMove` hộp {left 547, top 177, 50×50} với others rỗng                                                                             | `left` 550 (mép phải khung 600), `top` 175 (tâm khung 200); vạch x from 0 to 400 và vạch y                                           | R-FF-18 |
| 4   | `snapMove` hộp {left 320, top 300, 50×50} (cách mọi đích > 4)                                                                         | `left`, `top` undefined; không vạch, không gap                                                                                       | R-FF-18 |
| 5   | `snapMove` hộp {left 318, top 40, 50×50} giữa A (phải 240) và B (trái 400): gL 78, gR 32 → không đều; hộp {left 293, …}: gL 53, gR 57 | lần 1: không gap; lần 2: `left` 295, 2 `GapMark` trục x (240→295, 345→400)                                                           | R-FF-18 |
| 6   | `snapEdge('x', 238, [A], frame)`; `snapEdge('x', 320, [A], frame)`                                                                    | pos 240 kèm vạch; undefined                                                                                                          | R-FF-18 |
| 7   | `FreeDragController` kéo phần tử C (có A, B cùng khung) tới chỗ mép trái lệch A 3 px, lưới 16                                         | `style.left` = 40px (không phải bội 16); `showGuides` được gọi với 1 vạch; nhả chuột → `free-move` left 40; rồi `showGuides([], [])` | R-FF-18 |
| 8   | Kéo C tới chỗ không gần đích nào, lưới 16                                                                                             | `left` là bội 16; `showGuides([], [])` mỗi lần di                                                                                    | R-FF-11 |
| 9   | Kéo giãn C mép `e` tới cách mép trái B 2 px; Esc                                                                                      | `style.width` để mép phải = 400; vạch x 400; Esc → `showGuides([], [])`, không gửi `free-resize`                                     | R-FF-18 |
| 10  | Kéo giãn phần tử ở chỗ thường (không trong khung tự do)                                                                               | `showGuides` không có vạch nào                                                                                                       | R-FF-14 |
| 11  | `gridCells` 3 cột 100 px, 2 hàng 50 px, gap 10/20, gốc (10, 5)                                                                        | 6 ô; ô hàng 2 cột 3: x 230, y 75, 100×50                                                                                             | #30     |
| 12  | `readGridTracks` với style giả: grid, cột `200px 200px`, hàng `80px`; grid, cột `none`; `display: flex`                               | columns [200, 200], rows [80]; undefined; undefined                                                                                  | #30     |
| 13  | `DragController` (env có `gridTracks`) kéo từ Studio qua khung grid; rồi ra khung thường; rồi `studioDragEnd(false)`                  | `showGridCells` nhận mảng ô; rồi `undefined`; rồi `undefined`                                                                        | #30     |
| 14  | Test cũ của `drag.test.ts`, `drop-target.test.ts`, `free-frame.test.ts`                                                               | vẫn xanh; chỉ thêm callback mới vào chỗ dựng controller, không sửa assertion                                                         | —       |

Ghi chú #12: grid chỉ khai báo cột thì Chrome vẫn trả `grid-template-rows` là danh sách px của các hàng ngầm, nên hàm không cần tự tính hàng.

## 5. Kiểm tay (chủ dự án)

1. Bản nháp khung tự do có 3 thẻ Card. Kéo thẻ thứ ba tới gần mép trái thẻ thứ nhất: vạch hồng dọc, thẻ hít thẳng mép. Kéo tới gần giữa khung: vạch hồng ở tâm khung.
2. Đặt ba thẻ trên một hàng, kéo thẻ giữa: khi gần cách đều thì hiện hai dấu khoảng cách có số px, thẻ hít vào giữa.
3. Kéo giãn mép phải một thẻ tới gần mép thẻ bên cạnh: hít vào, có vạch hồng. Esc: thẻ về kích thước cũ, vạch biến mất.
4. Trang Home: kéo khối **Card** từ Thư viện qua lưới sản phẩm (`grid` 3 cột): thấy đủ các ô nét đứt xanh, vạch chèn vẫn đúng chỗ. Kéo ra ngoài lưới: ô biến mất.
5. Kéo một sản phẩm trong lưới bằng tay cầm: các ô của lưới hiện trong lúc kéo; thả xong biến mất.
6. Thu phóng 50%: vạch hồng và ô lưới vẫn nằm đúng chỗ.

## 6. Bẫy đã biết

- **Chỉ sửa file trong mục 3.5.** Không đụng shared, server, Studio.
- **Toạ độ khung ≠ toạ độ màn hình**: hàm thuần làm việc trong toạ độ khung; chỉ overlay đổi sang màn hình (cộng `clientLeft/Top`, trừ `scrollLeft/Top`).
- **Không đo lại trong `pointermove`**: đo anh em một lần lúc bắt đầu phiên; phần tử đang kéo có style tạm nên đo lại sẽ sai.
- **Phần tử trong iframe**: không dùng `instanceof HTMLElement` của trang cha. Bridge chạy trong iframe nên `instanceof` trong Bridge vẫn đúng; giữ cách viết hiện có trong `free-drag.ts`.
- **`getComputedStyle` trong happy-dom** không tính layout: test `readGridTracks` bằng cách `vi.spyOn(window, 'getComputedStyle')` trả object giả; còn `DragController` thì tiêm `gridTracks` qua `DropEnv`.
- **Không thay đổi hành vi cũ**: kéo khi không có anh em gần thì giống hệt lượt 11 (làm tròn theo lưới); thả ngoài grid giống hệt trước.
- Bridge chạy ở mọi trang của dự án người dùng: **không** `console.log`, không ném lỗi ra ngoài; `getComputedStyle` trả số lạ thì bỏ qua (không vẽ ô).
- Sửa xong chạy `pnpm --filter @kumicraft/bridge build` để sinh lại bundle.
- **Viết đúng lint ngay từ đầu**, chạy `pnpm exec eslint <file>` sau mỗi file. File ≤ 400 dòng, hàm ≤ 50 dòng; `free-drag.ts` đã ~280 dòng, nên đặt logic gióng vào `smart-guides.ts` và chỉ nối ở `free-drag.ts`.

## 7. Báo cáo và commit

Theo mẫu `README.md`. **Lượt này sửa Bridge nên phải chạy `pnpm test:e2e` một lần** (bộ hồi quy 28 test, Chromium) sau `pnpm verify`, và ghi kết quả vào báo cáo.

```text
feat(bridge): snap to smart guides and show grid cells while dragging
```
