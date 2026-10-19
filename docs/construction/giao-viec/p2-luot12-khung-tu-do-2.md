# Phase 2 — Lượt 12: Khung tự do, phần 2 (WP-2.12b)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Quy tắc: spec mục 18E, R-FF-15 đến R-FF-17, cộng nhóm **X Y W H** trong Inspector (kế hoạch `p2-ke-hoach.md`, dòng 12).

**Chia việc:**

- **Claude** làm R-FF-18 (đường gióng thông minh khi kéo và kéo giãn), toàn bộ nằm trong Bridge.
- **Gemini** làm mọi phần còn lại: phím mũi tên, thứ tự lớp, căn và phân bố, nhóm X Y W H.
- Gemini **không sửa** `packages/bridge/src/client/`. Mọi thông điệp Bridge cần cho lượt này **đã có sẵn**:
  - `measure-free` / `free-measure`. Từ 2026-10-20 khung có thêm `width`, mỗi con có thêm `width`, `height` (px, đã làm tròn).
  - `shortcut`: Bridge chuyển mọi phím khớp bảng `matchShortcut` trong shared. Thêm hành động vào bảng thì Bridge tự chuyển, chỉ cần build lại bundle.

## 1. Mục tiêu (người dùng thấy gì)

1. **Phím mũi tên** (R-FF-15): chọn phần tử trong khung tự do, bấm `←` `→` `↑` `↓`.
   - Mỗi lần dịch một bước lưới (ô Lưới trên thanh Canvas). `Shift` + mũi tên: dịch 1 px.
   - Bấm liên tiếp trong 500 ms thì gộp thành một bước Undo.
   - Tiêu điểm đang ở ô nhập thì mũi tên không dịch gì.
2. **Thứ tự lớp** (R-FF-16): Inspector của phần tử trong khung tự do có 4 nút **Lên trên cùng**, **Lên một lớp**, **Xuống một lớp**, **Xuống dưới cùng**.
   - Phần tử viết sau trong code thì nằm trên. Đổi thứ tự không đổi vị trí `left`/`top`.
3. **Căn và phân bố** (R-FF-17):
   - Chọn ≥ 2 phần tử cùng khung: căn trái, giữa ngang, phải, trên, giữa dọc, dưới theo khung bao của nhóm.
   - Chọn ≥ 3: thêm phân bố đều ngang, dọc.
   - Chọn 1: căn theo chính khung tự do.
   - Mỗi lần bấm là một bước Undo.
4. **Nhóm Vị trí X Y W H**: Inspector của phần tử trong khung tự do có 4 ô số. Sửa số rồi Enter hoặc rời ô thì ghi.

## 2. Đọc trước (CW-52)

| File                                                                                                                                                         | Lý do                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `docs/spec.md` mục 18E (R-FF-15 đến R-FF-18), mục 19 (bảng phím)                                                                                             | Quy tắc                                                                                                                          |
| `packages/shared/src/shortcuts.ts`                                                                                                                           | `SHORTCUT_ACTIONS`, `matchShortcut`, nhãn phím; `Mod+↑/↓` đã là `moveUp`/`moveDown`                                              |
| `packages/shared/src/tailwind/free-position.ts`                                                                                                              | `applyPlacement`, `applySize`, `readClassPx`, `snap`, `pxClass`                                                                  |
| `packages/shared/src/bridge.ts` (`BridgeFreeMeasurePayloadSchema`)                                                                                           | Số đo khung và con                                                                                                               |
| `packages/studio/src/features/free-frame/` (cả thư mục)                                                                                                      | `free-frame-toggle.tsx` (chờ `free-measure` 2 giây), `free-frame-placement.ts`, `free-frame-commands.ts` (`readStaticClassName`) |
| `packages/studio/src/features/shortcuts/shortcut-actions.ts`, `shortcut-help.tsx`                                                                            | `runShortcut`, bảng phím trong hộp trợ giúp                                                                                      |
| `packages/studio/src/features/inspector/inspector-panel.tsx`, `sibling-move.ts`                                                                              | Chỗ gắn, cách tìm anh em để `move`                                                                                               |
| `packages/studio/src/api/source-client.ts` (`editSourceBatch`, `applyStructureEdit`), `packages/shared/src/source.ts` (`BatchEditRequestSchema.coalesceKey`) | Ghi một mục lịch sử, gộp theo `coalesceKey`                                                                                      |
| `packages/studio/src/features/editor/canvas-view-store.ts`                                                                                                   | `grid`, `tailwindMajor`, `placementTailwindMajor`                                                                                |

## 3. Hợp đồng

### 3.0. Ngữ cảnh khung tự do (dùng chung)

Tạo `features/free-frame/free-context.ts`:

```ts
/** Khung tự do chứa phần tử `ref` (cha theo treeNodes có ElementSource.free), hoặc undefined. */
export async function freeFrameOfRef(
  ref: ElementRef,
): Promise<{ ref: ElementRef; tag: string } | undefined>;

/** Gửi measure-free cho khung, chờ free-measure đúng loc tối đa 2 giây; quá hạn → undefined. */
export function requestFreeMeasure(
  frame: ElementRef,
): Promise<BridgeFreeMeasurePayload | undefined>;
```

- `freeFrameOfRef`: tìm node theo `loc` **và** `index` trong `treeNodes`, lấy node cha, đọc `fetchElementSourceByLoc(cha).free`. Lỗi mạng → `undefined`.
- **Sửa lại** `free-frame-toggle.tsx` (đo khi bật khung), `free-frame-placement.ts` và `free-frame-page-warning.tsx` để dùng hai hàm này thay cho code trùng. Hành vi giữ nguyên, test cũ phải còn xanh.
- Hook `useFreeFrameOf(source)` nếu cần cho component: trả khung cha, cập nhật khi đổi phần tử chọn. Không `setState` trong effect một cách đồng bộ: setState chỉ trong callback của promise, có cờ `cancelled`.

### 3.1. Phím mũi tên (R-FF-15)

**Shared** `shortcuts.ts`:

- Thêm 8 hành động vào `SHORTCUT_ACTIONS`:
  - `nudgeLeft`, `nudgeRight`, `nudgeUp`, `nudgeDown`;
  - `nudgeLeftFine`, `nudgeRightFine`, `nudgeUpFine`, `nudgeDownFine` (khi có Shift).
- `matchNoModKey`: `arrowleft`… không Shift → `nudge*`; có Shift → `nudge*Fine`. Không đụng `Mod+↑/↓` (`moveUp`/`moveDown`).
- Nhãn phím và dòng trong hộp trợ giúp (`shortcut-help.tsx`): một dòng "Dịch trong khung tự do" `← → ↑ ↓`, một dòng "Dịch 1 px" `Shift + mũi tên`.

**Studio** `features/free-frame/free-nudge.ts`:

```ts
export function nudgeDelta(
  action: ShortcutAction,
  grid: 1 | 4 | 8 | 16,
): { dx: number; dy: number } | undefined;
export async function nudgeSelection(dx: number, dy: number): Promise<boolean>;
```

- `runShortcut`: 8 hành động gọi `nudgeSelection`, trả `true` khi có ít nhất một phần tử được dịch.
- `nudgeSelection`:
  1. Lấy các phần tử đang chọn **nằm trong khung tự do** (`freeFrameOfRef`). Không có thì trả `false`.
  2. Với mỗi phần tử: `readStaticClassName`; vị trí cũ `readClassPx(left/top) ?? 0`; vị trí mới `max(0, cũ + delta)`.
  3. Class mới = `applyPlacement(cũ, { kind: 'free', left, top }, tailwindMajor)`: không truyền width/height để giữ `w-`/`h-`.
  4. Gửi **một** `editSourceBatch` với `before`, kèm `coalesceKey: 'nudge:' + các loc nối bằng ','` để các lần bấm liền nhau gộp một mục lịch sử (server gộp trong 500 ms).
  5. Lỗi (E017, E023…) → `useDndStore.getState().setError(toErrorInfo(e))` như `free-frame-commands.ts`.
- Phần tử trong vòng lặp có cùng `loc`: chỉ dịch một lần cho mỗi `loc`.

### 3.2. Thứ tự lớp (R-FF-16)

`features/free-frame/layer-order.ts`:

```ts
export type LayerOrderCommand = 'front' | 'forward' | 'backward' | 'back';
/** Đích move trong cùng khung; undefined khi đã ở đầu/cuối (nút bị tắt). */
export function layerOrderTarget(
  cmd: LayerOrderCommand,
  ref: ElementRef,
  tag: string,
  treeNodes: readonly TreeNode[],
): InsertTarget | undefined;
export async function runLayerOrder(
  cmd: LayerOrderCommand,
  ref: ElementRef,
  tag: string,
): Promise<boolean>;
```

- Anh em là các node cùng `parent` trong `treeNodes` **và cùng file** với phần tử, mỗi `loc` một lần.
- Đích:
  - `front`: `{ kind: 'child', parent: khung, where: 'end' }`;
  - `back`: `where: 'start'`;
  - `forward`: `{ kind: 'sibling', ref: anh em ngay sau, where: 'after' }`;
  - `backward`: `{ kind: 'sibling', ref: anh em ngay trước, where: 'before' }`.
  - Đã là cuối (front/forward) hoặc đầu (back/backward) → `undefined`.
- `runLayerOrder` gọi `applyStructureEdit({ kind: 'move', elements: [{ loc, tag }], target })`, **không** `placement`. Server giữ nguyên class nên `left`/`top` không đổi. Dùng `runStructureOp` như các lệnh cấu trúc khác để lỗi hiện đúng chỗ và vùng chọn theo `locs` mới.

### 3.3. Căn và phân bố (R-FF-17)

`features/free-frame/align.ts`, hàm thuần:

```ts
export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';
export type FreeItemBox = {
  readonly key: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};
/** ≥ 2 hộp: căn theo khung bao nhóm; 1 hộp: theo `frame` (0, 0, frame.width, frame.height). Trả left/top mới, làm tròn. */
export function alignBoxes(
  boxes: readonly FreeItemBox[],
  mode: AlignMode,
  frame: { width: number; height: number },
): Map<string, { left: number; top: number }>;
/** ≥ 3 hộp: giữ hai hộp ngoài cùng, chia đều khoảng trống giữa các hộp theo trục. < 3 → map rỗng. */
export function distributeBoxes(
  boxes: readonly FreeItemBox[],
  axis: 'x' | 'y',
): Map<string, { left: number; top: number }>;
```

- `key` = `loc#index`.
- Căn chỉ đổi một trục: căn trái/giữa ngang/phải chỉ đổi `left` và giữ `top`; ngược lại với căn dọc.
- Phân bố:
  - sắp hộp theo `left` (hoặc `top`);
  - khoảng trống = (mép xa của hộp cuối − mép gần của hộp đầu − tổng kích thước) / (n − 1);
  - hộp đầu và hộp cuối giữ nguyên.

`runAlign(mode | distribute)` trong cùng file:

1. Tất cả phần tử đang chọn phải cùng một khung tự do (`freeFrameOfRef`), không thì không làm gì.
2. `requestFreeMeasure(khung)`; quá hạn → lỗi `free-frame-error` (dùng lại khóa `freeFrame.measureTimeout`).
3. Lấy hộp của các phần tử đang chọn từ `children` (so `ref.loc` và `ref.index`).
4. Tính vị trí mới, rồi gửi **một** `editSourceBatch`: mỗi phần tử một `setClassName` `applyPlacement(free, left, top)` có `before`, giữ `w`/`h`.
5. Hộp không đổi chỗ thì bỏ khỏi batch. Batch rỗng thì không gửi.

### 3.4. Inspector: mục "Khung tự do" (`features/free-frame/free-frame-section.tsx`)

Hiện **dưới** `FreeFrameToggle` trong `inspector-panel.tsx` khi phần tử chính nằm trong khung tự do. `inspector-panel.tsx` chỉ thêm một dòng gắn component.

- **Vị trí** (chỉ khi chọn 1 phần tử):
  - 4 ô số `data-testid`: `free-pos-x`, `free-pos-y`, `free-pos-w`, `free-pos-h`.
  - Giá trị = `readClassPx` của class tĩnh hiện tại. W/H không đọc được (`w-full`, không có class) thì để trống, placeholder "auto".
  - Enter hoặc blur, giá trị đổi và là số ≥ 0:
    - X/Y: `applyPlacement(free, { left, top })`, trường kia giữ theo class hiện tại (không có thì 0);
    - W/H: `applySize(cũ, { width } | { height }, tailwindMajor)`.
  - Một `editSource` `setClassName` có `before`. Esc trong ô thì trả lại giá trị cũ, không ghi.
- **Thứ tự lớp** (chỉ 1 phần tử): 4 nút `data-testid` `layer-order-front`, `layer-order-forward`, `layer-order-backward`, `layer-order-back`; nút bị tắt (`disabled`) khi `layerOrderTarget` trả `undefined`.
- **Căn**:
  - 6 nút `data-testid` `align-left`, `align-center-x`, `align-right`, `align-top`, `align-center-y`, `align-bottom`.
  - 2 nút `distribute-x`, `distribute-y`, tắt khi chọn < 3.
  - Có `title`/`aria-label` từ i18n. Dùng icon chữ đơn giản hoặc SVG nội tuyến, **không** thêm thư viện icon mới.
- Một phần tử đang chọn có `className` biểu thức → cả mục hiện nhưng mọi nút và ô bị tắt.

### 3.5. i18n (`vi` và `en`)

Thêm khóa trong `freeFrame.*`:

- `section` (Khung tự do / Free frame), `position` (Vị trí / Position), `x`, `y`, `w`, `h`, `auto`;
- `layerOrder` (Thứ tự lớp / Layer order), `front` (Lên trên cùng / Bring to front), `forward` (Lên một lớp / Bring forward), `backward` (Xuống một lớp / Send backward), `back` (Xuống dưới cùng / Send to back);
- `align` (Căn / Align), `alignLeft`, `alignCenterX`, `alignRight`, `alignTop`, `alignCenterY`, `alignBottom`, `distributeX` (Phân bố đều ngang / Distribute horizontally), `distributeY`.

Thêm `shortcuts.actions.nudge` (Dịch trong khung tự do / Nudge in free frame) và `shortcuts.actions.nudgeFine` (Dịch 1 px / Nudge 1 px). Chạy `pnpm check:i18n`.

## 4. Tình huống test (Gemini viết, chỉ shared + Studio)

| #   | Đầu vào                                                                                                                                     | Kết quả                                                                                                                                      | Mã      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `matchShortcut` `ArrowLeft`; `Shift+ArrowUp`; `Ctrl+ArrowUp` (Windows)                                                                      | `nudgeLeft`; `nudgeUpFine`; `moveUp` (không đổi)                                                                                             | R-FF-15 |
| 2   | `nudgeDelta('nudgeRight', 8)`, `('nudgeUpFine', 8)`, `('undo', 8)`                                                                          | `{dx: 8, dy: 0}`, `{dx: 0, dy: -1}`, `undefined`                                                                                             | R-FF-15 |
| 3   | `nudgeSelection(8, 0)` với 2 phần tử trong khung, class `absolute left-4 top-2 w-40` và `p-2 absolute left-[10px] top-0`                    | một batch, 2 `setClassName` có `before`; sau: `w-40 absolute left-6 top-2`, `p-2 absolute left-[18px] top-0`; `coalesceKey` bắt đầu `nudge:` | R-FF-15 |
| 4   | `nudgeSelection(-8, 0)` khi `left-1` (4 px); phần tử không nằm trong khung tự do                                                            | `left-0` (không âm); trả `false`, không gọi batch                                                                                            | R-FF-15 |
| 5   | `layerOrderTarget` với 3 con A, B, C của khung: `front` cho A; `forward` cho A; `backward` cho C; `back` cho C; `front` cho C; `back` cho A | child end; sibling after B; sibling before B; child start; `undefined`; `undefined`                                                          | R-FF-16 |
| 6   | Bấm `layer-order-front` cho A                                                                                                               | `applyStructureEdit` một lần với `move`, đích child end, **không** có `placement`                                                            | R-FF-16 |
| 7   | `alignBoxes` 3 hộp (left 10/50/90, width 20/40/30), `left`; `right`; `centerX`                                                              | left 10/10/10; right = 120 cho cả ba (left 100/80/90); tâm chung 65 (left 55/45/50)                                                          | R-FF-17 |
| 8   | `alignBoxes` 1 hộp (left 30, top 40, 100×50) với khung 400×300: `right`; `centerY`                                                          | left 300, top 40; left 30, top 125                                                                                                           | R-FF-17 |
| 9   | `distributeBoxes` 3 hộp theo x (left 0/30/200, width 20/20/20); 2 hộp                                                                       | hộp giữa left 100, hai hộp ngoài không có trong map; map rỗng                                                                                | R-FF-17 |
| 10  | `runAlign('left')` với 2 phần tử, `free-measure` giả lập trả số đo                                                                          | `measure-free` gửi cho khung; một batch đúng 2 `setClassName` (hộp đã đúng chỗ thì không có)                                                 | R-FF-17 |
| 11  | `runAlign('left')` khi không có `free-measure` trong 2 giây (`vi.useFakeTimers`)                                                            | không gọi batch; có `free-frame-error`                                                                                                       | R-FF-17 |
| 12  | `FreeFrameSection` chọn 1 phần tử `absolute left-8 top-4 w-full`: đọc ô; nhập X = 64 rồi Enter                                              | X 32, Y 16, W trống, H trống; `editSource` `after` = `w-full absolute left-16 top-4`                                                         | R-FF-11 |
| 13  | Nhập W = 122 rồi blur; nhập Y rồi Esc                                                                                                       | `after` có `w-[122px]` thay `w-full`; Esc không gọi `editSource`                                                                             | R-FF-14 |
| 14  | Chọn 2 phần tử cùng khung; chọn phần tử ngoài khung tự do                                                                                   | có nút căn, `distribute-x` tắt, không có ô vị trí; không có mục `free-frame-section`                                                         | R-FF-17 |
| 15  | Test cũ của `free-frame` (bật khung, cảnh báo, nhân bản/dán) sau khi dùng `free-context.ts`                                                 | vẫn xanh, không sửa assertion                                                                                                                | R-FF-10 |

## 5. Kiểm tay (chủ dự án, sau khi Claude làm xong đường gióng)

1. Bản nháp khung tự do có 3 thẻ Card. Chọn một thẻ, bấm `→` 3 lần nhanh: dịch 24 px (lưới 8), một Ctrl+Z trả về hết. `Shift+→`: dịch 1 px.
2. Hai thẻ chồng lên nhau: chọn thẻ dưới, bấm **Lên trên cùng** → thẻ đó nằm trên, vị trí giữ nguyên.
3. Chọn 3 thẻ (Shift + bấm): **Căn trái** → thẳng mép trái; **Phân bố đều dọc** → khoảng cách bằng nhau. Mỗi lần một Ctrl+Z.
4. Chọn 1 thẻ, **Căn giữa ngang** → thẻ vào giữa khung.
5. Sửa ô X thành 100 → thẻ dịch tới 100 px. Sửa W thành 300 → thẻ rộng 300 px.
6. Kéo một thẻ gần mép thẻ khác → hiện vạch hồng và thẻ hít vào (phần của Claude).

## 6. Bẫy đã biết

- **Không sửa `packages/bridge/src/client/`.** Sửa `shared/src/shortcuts.ts` xong thì chạy `pnpm --filter @reactcraft/bridge build` để bundle có phím mới.
- **So ref bằng `loc` và `index`**; mỗi `loc` chỉ ghi một lần trong một batch (server từ chối `duplicateLoc`).
- **Mũi tên không được ăn phím khi đang gõ** trong ô nhập (Inspector, hộp thoại): bảng phím đã lọc qua `isTypingTarget` ở Bridge; phía Studio kiểm cách lọc hiện có trong `shortcut-actions.ts` / listener phím và giữ đúng.
- **Không gửi `placement` khi đổi thứ tự lớp**: placement sẽ ghi đè `left`/`top`.
- **`tailwindMajor`** lấy từ `useCanvasViewStore.getState().tailwindMajor` cho mọi `applyPlacement`/`applySize`/`pxClass`.
- **Không `setState` đồng bộ trong effect**; đọc ô số theo mẫu "điều chỉnh state khi render" khi đổi phần tử chọn.
- **Viết đúng lint ngay từ đầu**, chạy `pnpm exec eslint <file>` sau mỗi file. File ≤ 400 dòng, hàm ≤ 50 dòng.

## 7. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ:

- các hành động phím đã thêm vào shared;
- chỗ đã gom code trùng vào `free-context.ts`;
- chỗ nào cần Claude làm thêm phía Bridge.

Không chạy `pnpm test:e2e`.

```text
feat(studio): nudge, reorder, align and size elements in free frames
```
