# SL-07: Studio hiện lỗi build và lỗi runtime của dự án (R-RN-25)

Nguồn: `docs/construction/spec-log.md` dòng #7. Quy tắc: `docs/spec.md` dòng R-RN-25 (tìm `| R-RN-25 |`).

## Mục tiêu (một tiêu chí xong)

Khi dự án người dùng lỗi, Studio hiện cho họ biết mà không treo:

1. Vite báo lỗi build (`build-error`): **dải lỗi đỏ phía trên Canvas**, có thông điệp và nút `file:dòng` mở file trong editor. Sửa xong (`build-ok`) thì dải lỗi tự ẩn.
2. Trang ném lỗi lúc chạy (`runtime-error`): **danh sách lỗi nhỏ** ở góc Canvas, gộp lỗi trùng thông điệp (hiện `×N`), tối đa 5 lỗi mới nhất, có nút đóng. Không che, không chặn thao tác trên Canvas.

Bridge **đã gửi** cả 3 tin nhắn (`packages/bridge/src/client/bridge-client-runtime.ts`, hàm `attachErrorListeners` và `attachViteHmr`). Việc này chỉ làm phía Studio.

## Đọc trước khi viết code (CW-52)

1. `AGENTS.md`, `docs/construction/giao-viec/README.md` (quy tắc gỡ lỗi, điều cấm).
2. `packages/shared/src/bridge.ts`: `BridgeRuntimeErrorPayloadSchema`, `BridgeBuildErrorPayloadSchema` (`file`, `line`, `column` đều có thể thiếu).
3. `packages/studio/src/features/selection/bridge-channel.ts`: hàm `dispatchBridgePayload` (nơi thêm 3 case mới), `detach()`.
4. `packages/studio/src/features/selection/bridge-channel.test.ts`: cách test gửi `MessageEvent` (dùng lại helper sẵn có).
5. `packages/studio/src/features/selection/selection-store.ts`: mẫu store zustand của dự án.
6. `packages/studio/src/features/editor/canvas-area.tsx`: `CanvasArea`, `TextEditOverlay`, biến `editor = useOpenInEditor()` và khối `open-editor-error` đã có.
7. `packages/studio/src/features/editor/canvas-prompts.tsx`: mẫu dải cảnh báo (màu, class Tailwind).
8. `packages/studio/src/i18n/locales/vi/common.json` và `en/common.json`: nhóm khóa `canvas`.

## Hợp đồng

### 1. Store mới: `packages/studio/src/features/canvas-errors/canvas-error-store.ts`

```ts
import type { BridgeBuildErrorPayload, BridgeRuntimeErrorPayload } from '@reactcraft/shared';

export type RuntimeErrorEntry = {
  readonly message: string;
  readonly stack?: string | undefined;
  readonly count: number;
};

export const MAX_RUNTIME_ERRORS = 5;

type CanvasErrorState = {
  readonly buildError?: BridgeBuildErrorPayload | undefined;
  readonly runtimeErrors: readonly RuntimeErrorEntry[]; // mới nhất đứng đầu
  readonly setBuildError: (payload: BridgeBuildErrorPayload) => void;
  readonly clearBuildError: () => void;
  readonly addRuntimeError: (payload: BridgeRuntimeErrorPayload) => void;
  readonly dismissRuntimeErrors: () => void;
  readonly reset: () => void;
};

export const useCanvasErrorStore = create<CanvasErrorState>(/* ... */);
```

Thuật toán `addRuntimeError`:

1. Có mục cùng `message` → bỏ mục đó khỏi vị trí cũ, đưa lên đầu với `count + 1`, `stack` lấy bản mới.
2. Chưa có → thêm lên đầu với `count: 1`.
3. Cắt danh sách còn `MAX_RUNTIME_ERRORS` mục (bỏ mục cũ nhất).

### 2. Nối vào `bridge-channel.ts`

Trong `dispatchBridgePayload` thêm (payload luôn `safeParse`, sai thì bỏ qua):

| `type`          | Hành động                                                                 |
| --------------- | ------------------------------------------------------------------------- |
| `build-error`   | `setBuildError(res.data)`                                                 |
| `build-ok`      | `clearBuildError()`                                                       |
| `runtime-error` | `addRuntimeError(res.data)`                                               |
| `ready` (đã có) | giữ việc cũ, **thêm** `dismissRuntimeErrors()` (trang vừa tải lại từ đầu) |

`detach()` gọi thêm `useCanvasErrorStore.getState().reset()` (đổi dự án, tắt Canvas thì không còn lỗi cũ).

Không xóa `buildError` khi `ready`: Vite có thể gửi lại lỗi build trước tin `ready`.

### 3. Hai component mới trong `packages/studio/src/features/canvas-errors/`

**`build-error-banner.tsx`**: `export function BuildErrorBanner({ onOpenLoc }: { readonly onOpenLoc: (loc: string) => void })`

- Đọc `buildError` từ store; `undefined` thì trả `undefined`.
- Gốc: `role="alert"`, `data-testid="canvas-build-error"`, nằm ngay dưới `CanvasToolbar`.
- Tiêu đề: `t('canvas.buildError.title')`.
- Thông điệp: trong `<pre data-testid="canvas-build-error-message">`, `whitespace-pre-wrap`, `max-h-32 overflow-auto`, chữ mono cỡ `text-xs`.
- Có `file` **và** `line` thì hiện nút `data-testid="canvas-build-error-open"`, chữ là `file:line` (thêm `:column` nếu có), bấm thì gọi `onOpenLoc(\`${file}:${line}:${column ?? 1}\`)`. Thiếu một trong hai thì không có nút.

**`runtime-error-list.tsx`**: `export function RuntimeErrorList()`

- `runtimeErrors` rỗng thì trả `undefined`.
- Gốc: `data-testid="canvas-runtime-errors"`, `absolute bottom-3 left-3 z-10 max-w-md`. Không có lớp phủ toàn khung: phần còn lại của Canvas vẫn bấm được.
- Tiêu đề `t('canvas.runtimeErrors.title', { count: runtimeErrors.length })`, nút đóng `data-testid="canvas-runtime-errors-dismiss"` (`aria-label` = `t('canvas.runtimeErrors.dismiss')`) gọi `dismissRuntimeErrors()`.
- Mỗi mục `data-testid="canvas-runtime-error-item"`: thông điệp một dòng (`truncate`, `title` = thông điệp đầy đủ), `count > 1` thì thêm `<span data-testid="canvas-runtime-error-count">×{count}</span>`.

**An toàn (S-xx, dữ liệu từ dự án là dữ liệu không tin cậy):** chỉ hiện chữ thường qua JSX. Cấm `dangerouslySetInnerHTML`, cấm dựng HTML từ thông điệp.

### 4. Gắn vào `canvas-area.tsx`

Trong `CanvasArea`, ngay sau `<CanvasToolbar … />`: `<BuildErrorBanner onOpenLoc={editor.open} />`. `RuntimeErrorList` đặt **bên trong** vùng `CanvasViewport` (đã `relative`). Dùng lại biến `editor` và khối `open-editor-error` sẵn có, không tạo `useOpenInEditor()` thứ hai.

### 5. Khóa i18n (thêm vào **cả** `vi` và `en`, trong nhóm `canvas` của `common.json`)

| Khóa                               | vi                                                   | en                                                   |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `canvas.buildError.title`          | Dự án đang lỗi build, Canvas hiện bản cuối chạy được | Build error, the canvas shows the last working build |
| `canvas.runtimeErrors.title_one`   | {{count}} lỗi khi chạy trang                         | {{count}} runtime error                              |
| `canvas.runtimeErrors.title_other` | {{count}} lỗi khi chạy trang                         | {{count}} runtime errors                             |
| `canvas.runtimeErrors.dismiss`     | Ẩn danh sách lỗi                                     | Hide errors                                          |

Nếu nhóm `canvas` chưa có, kiểm `i18next.d.ts` xem kiểu khóa lấy từ đâu, rồi thêm đúng chỗ. Không đổi khóa cũ.

## Test bắt buộc (Gemini viết, gắn `[R-RN-25]` trong tên `describe`/`it`)

Tổng ≤ 15 test. Mỗi test có `expect` thật về kết quả, không test rỗng.

**`canvas-error-store.test.ts`** (5 test):

1. `addRuntimeError` hai lần cùng thông điệp → 1 mục, `count: 2`, `stack` là bản sau.
2. Thông điệp A, B, rồi A → thứ tự `[A, B]`, A có `count: 2`.
3. Thêm 6 thông điệp khác nhau → còn 5, mục đầu tiên thêm vào bị bỏ.
4. `setBuildError` rồi `clearBuildError` → `buildError` là `undefined`.
5. `reset()` xóa cả hai. (Mỗi test bắt đầu bằng `reset()` trong `beforeEach`.)

**`bridge-channel.test.ts`** (thêm 4 test, dùng helper sẵn có, **không** thêm ép kiểu mới):

6. Tin `build-error` hợp lệ → store có `buildError` đúng `file`, `line`.
7. Tin `build-ok` sau đó → `buildError` là `undefined`.
8. Tin `runtime-error` có `message` dài 2001 ký tự (sai schema) → store không đổi.
9. `detach()` → store đã `reset`.

**`build-error-banner.test.tsx` + `runtime-error-list.test.tsx`** (5 test, nhớ `afterEach(cleanup)`, dự án **không** có jest-dom: dùng `toHaveProperty`, `textContent`):

10. Có `file`, `line`, `column` → bấm `canvas-build-error-open` gọi `onOpenLoc('src/pages/Home.tsx:12:5')`.
11. Thiếu `line` → không có `canvas-build-error-open`, vẫn có thông điệp.
12. Thông điệp chứa `<img src=x onerror=alert(1)>` → `textContent` chứa nguyên chuỗi đó, `expect(container.querySelector('img')).toBeNull()` (`querySelector` là API DOM nên trả `null`).
13. Hai lỗi, một lỗi `count: 3` → 2 `canvas-runtime-error-item`, có `×3`.
14. Bấm `canvas-runtime-errors-dismiss` → danh sách biến mất.

**E2E** thêm 1 test vào `e2e/canvas-edit.e2e.ts`:

15. `build error banner shows the file and hides after the fix [R-RN-25]`: mở dự án như test AC-02, chờ Canvas sẵn sàng; ghi đè `src/pages/Home.tsx` (trong bản sao fixture) bằng nội dung gốc cộng một dòng JSX hỏng (ví dụ thêm `<div>` không đóng); chờ `canvas-build-error` hiện và `canvas-build-error-open` chứa `src/pages/Home.tsx`; ghi lại nội dung gốc; chờ `canvas-build-error` biến mất (`toBeHidden`). Không dùng `waitForTimeout`.

## Phạm vi file

- Tạo: `packages/studio/src/features/canvas-errors/` (store, 2 component, 3 file test).
- Sửa: `bridge-channel.ts`, `bridge-channel.test.ts`, `canvas-area.tsx`, `locales/vi/common.json`, `locales/en/common.json`, `e2e/canvas-edit.e2e.ts`, `docs/construction/spec-log.md` (gạch dòng #7, cột cuối ghi "Xong: …").
- Không sửa gì khác. Cần sửa ngoài danh sách → dừng và báo.

## Bẫy đã biết

1. `CanvasArea` đã gần giới hạn `max-lines-per-function`: đặt logic trong component mới, chỉ thêm 1–2 dòng vào `CanvasArea`.
2. Quy tắc QC-40: không dùng `null` trong code của mình; state không có lỗi là `undefined`.
3. Lỗi trong `vite:error` có thể chứa mã ANSI màu. Nếu E2E thấy ký tự lạ thì báo, **không** tự viết bộ lọc ANSI trong phạm vi này.
4. Vite có thể reload cả trang thay vì gửi `vite:afterUpdate` sau khi sửa lỗi. Nếu test 15 kẹt vì dải lỗi không ẩn, dừng và báo kèm log, không nới test.

## Kiểm tra trước khi báo xong

1. `pnpm exec vitest run packages/studio/src/features/canvas-errors packages/studio/src/features/selection`
2. `pnpm build`, rồi `pnpm exec playwright test e2e/canvas-edit.e2e.ts --project=chromium`
3. Cuối cùng chạy một lần: `pnpm verify`, `pnpm test:e2e`.

## Mẫu báo cáo

1. Danh sách file tạo/sửa (đường dẫn, số dòng thêm/bớt).
2. Kết quả nguyên văn dòng tổng của `pnpm verify` và `pnpm test:e2e`.
3. Chỗ nào làm khác bản giao việc và lý do.
4. Không commit. Không tự gạch mục khác trong spec-log.
