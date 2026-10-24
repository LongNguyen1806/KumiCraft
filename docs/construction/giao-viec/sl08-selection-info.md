# SL-08: Bridge gửi `selection-info` (R-BR-16)

Nguồn: `docs/construction/spec-log.md` dòng #8. Quy tắc: `docs/spec.md`, tìm `| R-BR-16 |`, bảng thông điệp Bridge (dòng có `` `selection-info` ``) và kịch bản kiểm thử số 9 của M-BR ("Sửa file từ ngoài làm phần tử đang chọn biến mất").

## Mục tiêu (một tiêu chí xong)

Bridge báo cho Studio tình trạng của các phần tử đang chọn: còn hay mất, vị trí, số bản sao trên trang, class thật trong DOM. Studio **đã có chỗ nhận** (`bridge-channel.ts` case `selection-info` → `selection-store.setSelectionInfo`; Inspector dùng `instances` để cảnh báo phần tử lặp). Hiện Bridge chưa gửi nên cảnh báo đó không bao giờ hiện, và R-IN-21 (đo thời gian tới khi `domClass` có class mới) không đo được.

Việc này chỉ làm ở **Bridge**. Studio không đổi.

## Đọc trước khi viết code (CW-52)

1. `AGENTS.md`, `docs/construction/giao-viec/README.md`.
2. `packages/shared/src/bridge.ts`: `ElementInfoSchema` (`ref`, `found`, `tag` ≥ 1 ký tự, `rect?`, `instances` ≥ 1, `domClass?` ≤ 4000), `BridgeSelectionInfoPayloadSchema`, `BridgeEnvelopeSchema`.
3. `packages/bridge/src/client/bridge-client-runtime.ts`: `selectedRefs`, `handleSelectMessage`, chỗ gửi `'select'` khi click (khoảng dòng 340–360), `domObserver`, `attachViteHmr`, `scheduleTreeScan`, `destroy`.
4. `packages/bridge/src/client/bridge-client-runtime.test.ts`: cách dựng runtime và bắt `window.parent.postMessage`.
5. `packages/bridge/src/client/dom-scanner.ts`: cách quét phần tử `data-rc-loc`.
6. `packages/bridge/scripts/build-client.ts` và `bridge-client-generated.test.ts`: client được build thành `bridge-client.generated.ts`, phải sinh lại sau khi sửa.
7. `packages/studio/src/features/inspector/use-inspector-target.ts` (đoạn `selectionInfo.find`): chỉ đọc để hiểu Studio dùng gì.

## Hợp đồng

### 1. Tách file trước (bắt buộc, làm đầu tiên)

`bridge-client-runtime.ts` đang 422 dòng, vượt `max-lines` 400. Chuyển `ViteErrorSchema`, `toRelativePath`, `toBuildError` sang file mới `packages/bridge/src/client/build-error.ts` (giữ nguyên code, giữ JSDoc). Runtime import lại từ đó. Test `toBuildError` trong `bridge-client-runtime.test.ts` đổi import sang `./build-error.ts` (chỉ đổi dòng import, không đổi nội dung test). Sau khi xong cả việc này, runtime phải **≤ 400 dòng**.

### 2. Hàm thuần mới: `packages/bridge/src/client/selection-info.ts`

```ts
import type { ElementInfo, ElementRef } from '@kumicraft/shared';

export const MAX_DOM_CLASS = 4000;

/** R-BR-16: current state of each selected ref in the page. */
export function collectSelectionInfo(
  refs: readonly ElementRef[],
  root: ParentNode,
  previous: readonly ElementInfo[],
): ElementInfo[];
```

Thuật toán cho mỗi `ref`:

1. `matches` = các phần tử trong `root.querySelectorAll('[data-rc-loc]')` có `getAttribute('data-rc-loc') === ref.loc`. **Không** nhét `ref.loc` vào chuỗi selector (đường dẫn có thể chứa `"` hoặc `]`).
2. `el = matches[ref.index]`.
3. Có `el`: `{ ref, found: true, tag: el.tagName.toLowerCase(), rect, instances: Math.max(1, matches.length), domClass? }`.
   - `rect` = `getBoundingClientRect()` → `{ x, y, width, height }` (tọa độ trong khung iframe).
   - `domClass` = `el.getAttribute('class')` cắt còn `MAX_DOM_CLASS` ký tự; thuộc tính không có thì **bỏ hẳn khóa** `domClass`.
4. Không có `el`: `{ ref, found: false, tag, instances: Math.max(1, matches.length) }`, không có `rect`, `domClass`. `tag` lấy từ mục cùng `ref` (`loc` và `index`) trong `previous`; không có thì là `'unknown'`.

### 3. Gắn vào runtime

Thêm vào `BridgeClientRuntime`:

- `private lastSelectionInfo: ElementInfo[] = []` và `private selectionInfoTimer: ReturnType<typeof setTimeout> | undefined`.
- `private scheduleSelectionInfo(): void`: gộp nhiều lần gọi trong **16 ms** bằng `setTimeout` (giống `scheduleTreeScan`, **không** dùng `requestAnimationFrame` để test bằng fake timer được). Khi chạy: `items = collectSelectionInfo(this.selectedRefs, document, this.lastSelectionInfo)`, lưu vào `lastSelectionInfo`, rồi `sendToStudio('selection-info', { items })`. Danh sách chọn rỗng thì vẫn gửi `{ items: [] }`.
- Gọi `scheduleSelectionInfo()` ở các chỗ sau (bảng thông điệp của spec):

| Khi                                | Chỗ trong code                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Người dùng click chọn hoặc bỏ chọn | ngay sau mỗi `sendToStudio('select', …)`                                                                   |
| Studio gửi lệnh `select`           | cuối `handleSelectMessage`                                                                                 |
| Sau HMR                            | trong handler `vite:afterUpdate`                                                                           |
| DOM đổi                            | callback của `domObserver` (xem dưới)                                                                      |
| Cuộn, đổi kích thước               | `window.addEventListener('scroll', …, { capture: true, passive: true })` và `'resize'`, gỡ trong `destroy` |

- `domObserver`: thêm `'class'` vào `attributeFilter`. Callback nhận danh sách `MutationRecord`: luôn gọi `scheduleSelectionInfo()`; chỉ gọi `scheduleTreeScan()` khi có bản ghi `childList` hoặc `attributeName === 'data-rc-loc'` (để đổi class không làm quét lại cây).
- `destroy()`: xóa `selectionInfoTimer`, gỡ 2 listener `scroll`, `resize` (lưu handler thành thuộc tính để gỡ đúng).

### 4. Không làm

- Không sửa Studio. Studio chưa hiện gì khi `found: false` (spec chưa nói); không tự thêm giao diện.
- Không đổi `ElementInfoSchema`.

## Test bắt buộc (Gemini viết, gắn mã trong tên `describe`/`it`)

Tổng ≤ 12 test. Mỗi test có `expect` về kết quả thật.

**`packages/bridge/src/client/selection-info.test.ts`** `[R-BR-16]` (6 test):

1. 3 phần tử cùng `loc`, `ref.index = 1` → `found: true`, `tag` đúng, `instances: 3`, `domClass` đúng, `rect` đúng với `getBoundingClientRect` đã giả lập bằng `vi.spyOn(Element.prototype, 'getBoundingClientRect')`.
2. `ref` không có trong DOM, `previous` có mục cùng ref với `tag: 'h2'` → `{ found: false, tag: 'h2', instances: 1 }` và **không** có khóa `rect`, `domClass` (`not.toHaveProperty`).
3. Không có `previous` → `tag: 'unknown'`.
4. `ref.index` lớn hơn số bản sao → `found: false`, `instances` = số bản sao thật.
5. `loc` chứa dấu `"` (ví dụ `src/a"b.tsx:1:1`) → vẫn tìm ra, không ném lỗi.
6. Phần tử không có `class` → không có khóa `domClass`; `class` dài 5000 ký tự → `domClass` dài 4000.

**`bridge-client-runtime.test.ts`** thêm `describe('selection info [R-BR-16]')` (5 test, `vi.useFakeTimers()`, lọc `postMessage` theo `type === 'selection-info'`):

7. Studio gửi `select` với ref của phần tử có trong DOM → sau `vi.advanceTimersByTime(16)` có đúng **1** tin `selection-info` (dù trong 16 ms gọi nhiều lần), `items[0].found === true`.
8. Sau khi chọn, xóa phần tử khỏi DOM (`el.remove()`), chờ microtask của `MutationObserver` (`await Promise.resolve()`), rồi `advanceTimersByTime(16)` → tin mới có `found: false`.
9. Đổi `class` của phần tử đang chọn → tin mới có `domClass` mới; **không** có tin `tree` mới sau 100 ms.
10. Gọi handler `vite:afterUpdate` của `hot` giả → có tin `selection-info`.
11. Chọn rỗng (`select` với `refs: []`) → tin có `items: []`.

**E2E** thêm 1 test vào `e2e/canvas-edit.e2e.ts`:

12. `selected element removed by an external edit reports found false [R-BR-16]`:
    - Mở dự án như test AC-03, click heading "Sản phẩm nổi bật" trên Canvas.
    - Trước khi click, gắn bộ nghe ở trang Studio bằng `tab.evaluate`: nghe `message`, nếu `event.data?.type === 'selection-info'` thì ghi `JSON.stringify(event.data.payload)` vào `document.body.dataset.rcSelectionInfo`. Không ép kiểu `as unknown as`, không gán biến lên `window`.
    - `expect.poll` đọc `dataset.rcSelectionInfo` tới khi chứa `"found":true`.
    - Ghi lại `src/pages/Home.tsx` bỏ dòng heading đó (dùng `replace` trên nội dung gốc), `expect.poll` tới khi chứa `"found":false`. Cuối test ghi lại nội dung gốc.
    - Không `waitForTimeout`.

## Phạm vi file

- Tạo: `packages/bridge/src/client/build-error.ts`, `selection-info.ts`, `selection-info.test.ts`.
- Sửa: `bridge-client-runtime.ts`, `bridge-client-runtime.test.ts`, `bridge-client.generated.ts` (chỉ bằng lệnh build), `e2e/canvas-edit.e2e.ts`, `docs/construction/spec-log.md` (gạch dòng #8, cột cuối "Xong: …").
- Không sửa gì khác. Cần sửa ngoài danh sách thì dừng và báo.

## Bẫy đã biết

1. Client Bridge chạy trong trang người dùng: không import gì nặng ngoài `@kumicraft/shared` (kiểu). Hàm mới phải thuần, không đụng `window` ngoài `root` được truyền vào.
2. Phần tử trong iframe thuộc "vũ trụ" JavaScript khác: trong `selection-info.ts` không dùng `instanceof HTMLElement`.
3. QC-40: không dùng `null` trong code mình viết. `getAttribute` trả `null` thì chuyển ngay: `el.getAttribute('class') ?? undefined`.
4. Sau mọi lần sửa runtime phải chạy `pnpm --filter @kumicraft/bridge build`, nếu không `bridge-client-generated.test.ts` đỏ và E2E chạy client cũ.
5. Trên trình duyệt thật, `scroll` bắn rất dày: bắt buộc gộp 16 ms như trên, không gửi mỗi sự kiện.

## Kiểm tra trước khi báo xong

1. `pnpm exec vitest run packages/bridge/src/client`
2. `pnpm --filter @kumicraft/bridge build`, `pnpm build`, rồi `pnpm exec playwright test e2e/canvas-edit.e2e.ts --project=chromium`
3. Cuối cùng một lần: `pnpm verify`, `pnpm test:e2e`.
4. Số dòng `bridge-client-runtime.ts` ≤ 400 (ghi số trong báo cáo).

## Mẫu báo cáo

1. Danh sách file tạo/sửa (đường dẫn, số dòng thêm/bớt).
2. Nguyên văn dòng tổng của `pnpm verify` và `pnpm test:e2e`.
3. Chỗ làm khác bản giao việc và lý do.
4. Không commit. Không gạch mục khác trong spec-log.
