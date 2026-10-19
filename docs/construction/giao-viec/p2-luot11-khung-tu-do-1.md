# Phase 2 — Lượt 11: Khung tự do, phần 1 (WP-2.12a)

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. Quy tắc ở spec mục 18E (M-FF). Lượt này làm R-FF-10 đến R-FF-14 và R-FF-19. Phím mũi tên, thứ tự lớp, căn, phân bố, đường gióng và nhóm X Y W H là lượt 12.

**Chia việc:**

- **Claude** làm phần tương tác chuột trong Bridge (`packages/bridge/src/client/free-frame/`):
  - đo vị trí;
  - kéo di chuyển trong khung, chấm kéo giãn, xem trước bằng style tạm;
  - lưới chấm, viền nét đứt và nhãn "Khung tự do";
  - tính `placement` khi thả.
- **Gemini** làm mọi phần còn lại: tính class, ghi code, nút trên Studio, nối thông điệp.
- Hai bên nối qua **thông điệp chốt ở mục 3.2**. Gemini **không sửa** `packages/bridge/src/client/`. Cần thêm schema thông điệp thì thêm ở `packages/shared/src/bridge.ts` đúng như mục 3.2.

## 1. Mục tiêu (người dùng thấy gì)

1. Chọn một khung chứa (`div`, `section`…) → Inspector có công tắc **Khung tự do** (`data-testid="free-frame-toggle"`).
   - **Bật:** các con nhận `absolute left-… top-…` đúng chỗ đang hiện, Canvas không xê dịch.
   - **Tắt** (hỏi xác nhận): con về xếp dòng, giữ `w`/`h`.
   - Mỗi lần là một bước Undo.
2. Thả khối từ Thư viện, panel Component hoặc Layer Tree vào khung tự do: khối nằm **đúng chỗ chuột**, hít lưới. Kéo một phần tử từ khung tự do ra chỗ thường: bỏ toạ độ.
3. Trong khung tự do, **kéo** phần tử đang chọn để di chuyển. Kéo **chấm** để đổi kích thước: 8 chấm trong khung tự do, 3 chấm ở chỗ thường. Nhả chuột thì ghi một lần.
4. Thanh Canvas có ô **Lưới** 1, 4, 8, 16 px (`data-testid="canvas-grid-select"`), mặc định 8.
5. Khung tự do nằm trong **file trang** (không phải bản nháp): Inspector cảnh báo "Vị trí cố định, có thể vỡ trên điện thoại" (`data-testid="free-frame-page-warning"`).

## 2. Đọc trước (CW-52)

| File                                                                                                         | Lý do                                               |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `docs/spec.md` mục 18E, R-DD-11, R-SE-24, R-IN (nhóm Inspector)                                              | Quy tắc                                             |
| `packages/shared/src/tailwind/` (model, thang giá trị, `parseClasses`, `writeValue`)                         | Đổi px sang class phải đi qua model Tailwind có sẵn |
| `packages/shared/src/source.ts`, `bridge.ts`                                                                 | Schema sửa, thông điệp Bridge                       |
| `packages/server/src/core/source-editor/structure/` (`structure-plan.ts`, `move-ops.ts`, `structure-ops.ts`) | `insert`/`move` để thêm `placement`                 |
| `packages/server/src/adapters/http/routes/source.ts` (`/source/edits/batch`)                                 | Ghi nhiều sửa trong một mục lịch sử                 |
| `packages/studio/src/features/dnd/` (`drop-actions.ts`, `dnd-store.ts`)                                      | Luồng thả hiện có, thêm `placement`                 |
| `packages/studio/src/features/inspector/` (`inspector-panel.tsx`, `use-live-edit.ts`)                        | Nơi gắn công tắc và cảnh báo                        |
| `packages/studio/src/features/editor/canvas-view-store.ts`, `canvas-area.tsx`                                | Ô Lưới                                              |
| `packages/studio/src/features/selection/bridge-channel.ts`                                                   | Nhận thông điệp mới                                 |

## 3. Hợp đồng

### 3.1. Shared: `packages/shared/src/tailwind/free-position.ts` (mới, export qua `index.ts`)

```ts
export type FreeBox = { left: number; top: number; width?: number; height?: number }; // px
export type Placement = ({ kind: 'free' } & FreeBox) | { kind: 'flow' };
export const PlacementSchema: z.ZodType<Placement>;

/** R-FF-11: Tailwind v4 và px chia hết cho 4 → thang chuẩn (`left-30`); còn lại → `left-[123px]`. */
export function pxClass(prop: 'left' | 'top' | 'w' | 'h', px: number, tailwindMajor: 3 | 4): string;
export function snap(px: number, grid: 1 | 4 | 8 | 16): number; // làm tròn gần nhất, không âm

/**
 * Đổi chuỗi class theo placement, giữ nguyên mọi class khác và thứ tự của chúng:
 * - free: bỏ absolute/relative/fixed/static/sticky, left-*, top-*, right-*, bottom-*, inset-*, z-*
 *   rồi thêm `absolute`, `left-…`, `top-…`, và `w-…`/`h-…` khi có width/height (thay w-/h- cũ).
 * - flow: bỏ absolute, left-*, top-*, right-*, bottom-*, inset-*, z-*; giữ w-/h-.
 * Chỉ đụng các class không có tiền tố (không đụng `md:left-4`, `hover:…`).
 */
export function applyPlacement(
  classString: string,
  placement: Placement,
  tailwindMajor: 3 | 4,
): string;
```

`tailwindMajor` lấy từ `ProjectInfo.support.versions.tailwindcss` (chữ số đầu). Không đọc được thì dùng 4.

### 3.2. Thông điệp Bridge (chốt, thêm vào `shared/src/bridge.ts`)

Studio gửi cho Bridge:

```ts
// set-grid: lưới hiện hành (R-FF-11)
StudioSetGridPayloadSchema = z.strictObject({
  size: z.union([z.literal(1), z.literal(4), z.literal(8), z.literal(16)]),
});
// measure-free: đo con trực tiếp của một phần tử trước khi bật khung tự do (R-FF-10)
StudioMeasureFreePayloadSchema = z.strictObject({ ref: ElementRefSchema });
```

Bridge gửi cho Studio:

```ts
// trả lời measure-free
BridgeFreeMeasurePayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  height: z.number(), // chiều cao đang hiện của khung (px)
  hasHeight: z.boolean(), // khung đã có class h-/min-h- chưa
  children: z
    .array(
      z.strictObject({ ref: ElementRefSchema, tag: z.string(), left: z.number(), top: z.number() }),
    )
    .max(200),
});
// nhả chuột sau khi kéo di chuyển trong khung (R-FF-13); toạ độ đã hít lưới, so với khung
BridgeFreeMovePayloadSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({ ref: ElementRefSchema, tag: z.string(), left: z.number(), top: z.number() }),
    )
    .min(1)
    .max(50),
});
// nhả chuột sau khi kéo giãn (R-FF-14); trường nào không đổi thì vắng; resetSize = bấm đúp chấm
BridgeFreeResizePayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  tag: z.string(),
  left: z.number().optional(),
  top: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  resetSize: z.boolean().optional(),
});
// drop-target (đã có) thêm trường tùy chọn:
//   placement?: PlacementSchema  — Bridge tính khi đích là khung tự do hoặc khi kéo từ khung tự do ra ngoài
// move-intent (đã có) thêm: placement?: PlacementSchema
```

Tên loại thông điệp:

- Studio gửi Bridge: `set-grid`, `measure-free`.
- Bridge gửi Studio: `free-measure`, `free-move`, `free-resize`.

Phần tử của khung tự do trong DOM có thuộc tính `data-rc-free` vì JSX truyền thẳng xuống DOM, nên Bridge tự nhận ra, không cần thông điệp riêng.

### 3.3. Server

- `InsertEditSchema` và `MoveEditSchema` thêm `placement: PlacementSchema.optional()` và `tailwindMajor: z.union([z.literal(3), z.literal(4)]).optional()`.
  - Có `placement` thì thay class của **phần tử gốc** được chèn hoặc di chuyển bằng `applyPlacement`, trong cùng các `TextEdit`, cùng một mục lịch sử.
  - Chưa có `className` thì thêm `className="…"` ngay sau tên thẻ.
  - `className` là biểu thức: E023 `classExpression`, không ghi.
  - Nhiều phần tử: áp cho từng phần tử, `left/top` cộng dồn **16 px** cho phần tử thứ 2, 3… (R-FF-12).
- Thêm sửa `setFlag` vào `SourceEditSchema`/`AnyEditSchema` (bật/tắt thuộc tính boolean của JSX):

  ```ts
  { kind: 'setFlag', loc, tag, name: z.literal('data-rc-free'), on: z.boolean() }
  ```

  - `on: true`: thêm `data-rc-free` (không giá trị) **trước** `className` nếu có, không thì sau tên thẻ.
  - `on: false`: xóa thuộc tính và khoảng trắng thừa.
  - Đã đúng trạng thái: `changed: false`.
  - Chạy được trong `/source/edits/batch` để bật/tắt khung là một mục lịch sử.

### 3.4. Studio

**Ô Lưới:**

- `canvas-view-store.ts` thêm `grid: 1 | 4 | 8 | 16` (mặc định 8, nhớ theo `localStorage` có `try/catch`).
- Ô `canvas-grid-select` trên thanh Canvas.
- Đổi lưới hoặc Bridge `ready`: gửi `set-grid`.

**Công tắc Khung tự do** (`features/free-frame/free-frame-toggle.tsx`):

- Hiện khi đúng **một** phần tử được chọn, `tag` là thẻ chứa (dùng chung danh sách thẻ chứa của Library, `insert-block.ts`, đặt vào shared nếu cần) và `className` tĩnh.
- Trạng thái bật/tắt đọc từ `ElementSource`: thêm `free: boolean` vào `ElementSource` (server đọc thuộc tính `data-rc-free`).
- **Bật:**
  1. Gửi `measure-free`, chờ `free-measure` (tối đa 2 giây, quá hạn thì báo lỗi `free-frame-error`).
  2. Gửi **một** batch gồm:
     - `setFlag on` cho khung;
     - `setClassName` cho khung: thêm `relative`, và `h-[<height>px]` khi `hasHeight: false`;
     - `setClassName` cho từng con: `applyPlacement(free, left, top)` với `left/top` đã `snap` theo lưới.
  3. Con có `className` biểu thức: dừng, báo E023, không ghi.
- **Tắt:**
  1. `window.confirm`.
  2. Gửi một batch:
     - `setFlag off`;
     - khung bỏ `relative`;
     - mỗi con trực tiếp (lấy từ `treeNodes`, cùng file) `applyPlacement(flow)`.

**Nhận thông điệp Bridge** (`bridge-channel.ts` → `features/free-frame/free-frame-commands.ts`):

- `free-move`: một batch `setClassName` với `applyPlacement(free, left, top)` giữ `w/h` hiện có.
- `free-resize`:
  - Một `setClassName` cho phần tử.
  - Phần tử trong khung tự do: `applyPlacement(free…)` với các trường có mặt.
  - Ở chỗ thường: chỉ thay `w-`/`h-` bằng `pxClass`.
  - `resetSize`: bỏ `w-*`, `h-*`.
- **Đọc `className` hiện tại:** từ `GET /source/element` (đã có). Gửi kèm `before` để server phát hiện xung đột (E017) như sửa class hiện có.
- **Thả** (`features/dnd/drop-actions.ts`): `drop-target`/`move-intent` có `placement` thì truyền `placement` và `tailwindMajor` vào `insert`/`move`.
- **Dán và `Mod+D` khi phần tử nằm trong khung tự do:** placement `free` = vị trí gốc + 16 px (R-FF-12). Vị trí gốc đọc từ class `left-*`/`top-*` của phần tử (dùng model Tailwind để đổi class sang px).

**Cảnh báo R-FF-19:** `free-frame-page-warning` khi phần tử đang chọn là khung tự do, hoặc con của khung tự do, và file **không** nằm trong thư mục bản nháp.

**i18n `vi`/`en`:** công tắc, xác nhận tắt, cảnh báo, ô Lưới, lỗi quá hạn đo.

## 4. Tình huống test

| #   | Đầu vào                                                                                                                | Kết quả                                                                                | Mã      |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------- |
| 1   | `pxClass('left', 120, 4)`, `(…, 122, 4)`, `(…, 120, 3)`, `('w', 200, 4)`                                               | `left-30`, `left-[122px]`, `left-[120px]`, `w-50`                                      | R-FF-11 |
| 2   | `snap(130, 8)`, `snap(70, 8)`, `snap(-5, 8)`, `snap(13, 1)`                                                            | 128, 72, 0, 13                                                                         | R-FF-11 |
| 3   | `applyPlacement('p-4 relative left-2 md:left-8 text-red-500', free 128/72)`                                            | `p-4 md:left-8 text-red-500 absolute left-32 top-18` (thứ tự class cũ giữ, mới ở cuối) | R-FF-11 |
| 4   | `applyPlacement('absolute left-32 top-18 w-50 z-10 p-2', flow)`                                                        | `w-50 p-2`                                                                             | R-FF-12 |
| 5   | Insert Card với `placement` free (128, 72) vào khung tự do                                                             | Gốc Card có `absolute left-32 top-18` trong file, một mục lịch sử                      | R-FF-12 |
| 6   | Move phần tử `absolute left-8 top-8` ra section thường với `placement: flow`; Undo                                     | Bỏ toạ độ; Undo đúng từng byte                                                         | R-FF-12 |
| 7   | Duplicate trong khung tự do (Studio tính placement +16)                                                                | Bản sao có `left`/`top` lớn hơn 16 px                                                  | R-FF-12 |
| 8   | `setFlag on` cho `<div className="p-4">`; `on` lần nữa; `off`                                                          | `<div data-rc-free className="p-4">`; `changed: false`; về như cũ đúng từng byte       | R-FF-10 |
| 9   | Batch bật khung (setFlag + class khung + 3 con) rồi Undo một lần                                                       | 3 con có `absolute left-0 top-*` đúng số đo giả lập; một Undo trả cả file              | R-FF-10 |
| 10  | Bật khung khi một con có `className={…}`                                                                               | E023 `classExpression`, file không đổi                                                 | R-FF-10 |
| 11  | Tắt khung: con có `absolute left-4 top-8 w-40`                                                                         | Con còn `w-40`; khung bỏ `relative` và `data-rc-free`                                  | R-FF-10 |
| 12  | Studio nhận `free-move` 2 phần tử                                                                                      | Gọi batch đúng 2 `setClassName` có `before`, một lần                                   | R-FF-13 |
| 13  | Studio nhận `free-resize` cạnh trái (`left`, `width`) trong khung tự do; ở chỗ thường (`width`, `height`); `resetSize` | Class đúng ba trường hợp                                                               | R-FF-14 |
| 14  | Ô Lưới đổi sang 16                                                                                                     | `set-grid { size: 16 }` được gửi; nhớ sau khi tải lại store                            | R-FF-11 |
| 15  | Cảnh báo: chọn con khung tự do trong `src/pages/Home.tsx`; trong `src/drafts/X.tsx`                                    | Có cảnh báo; không có                                                                  | R-FF-19 |
| 16  | `measure-free` không có trả lời trong 2 giây                                                                           | Hiện `free-frame-error`, không gửi sửa nào (dùng `vi.useFakeTimers`)                   | R-FF-10 |

## 5. Kiểm tay (chủ dự án, sau khi phần Bridge của Claude xong)

1. Tạo bản nháp **Khung tự do**. Thả khối **Card** vào giữa: Card nằm đúng chỗ thả. Đổi Lưới sang 16, thả thêm Hero: vị trí là bội số 16.
2. Kéo Card trong khung: thấy nhãn `x … · y …`; Esc giữa chừng thì về chỗ cũ; nhả chuột thì file có `left-…` `top-…` mới.
3. Kéo chấm góc dưới phải của Card: thấy nhãn `W × H`; nhả chuột thì có `w-…` `h-…`. Bấm đúp chấm: về kích thước tự nhiên.
4. Kéo Card ra một section thường bằng tay cầm: Card về xếp dòng (mất `absolute`). Ctrl+Z trả lại.
5. Trên trang Home, chọn lưới sản phẩm, bật **Khung tự do**: 3 thẻ không xê dịch; Inspector có cảnh báo vỡ trên điện thoại. Tắt: các thẻ về lưới cũ. Mỗi lần một Ctrl+Z trả về.
6. Thu phóng 50%: kéo và thả vẫn đúng chỗ chuột.

## 6. Bẫy đã biết

- **Không sửa `packages/bridge/src/client/`.** Cần gì từ Bridge thì dừng và báo, không tự thêm.
- **Model Tailwind có sẵn:** đổi px ↔ class và nhận diện `left-*`, `w-*` phải dùng model trong `shared/src/tailwind/`, không viết regex riêng cho từng class. Thang chuẩn v4: 1 đơn vị = 4 px.
- **Class có tiền tố** (`md:`, `hover:`, `max-sm:`) không được đụng tới.
- **Một mục lịch sử:** bật/tắt khung và kéo nhiều phần tử đi qua `/source/edits/batch`, không gọi lần lượt.
- **`before`:** gửi `className` đang có, để server báo E017 khi file đã đổi từ chỗ khác.
- **Không nâng thời gian chờ test.** Test ghi nhiều lần dùng `directWriteFs`.
- **Viết đúng lint ngay từ đầu** (README mục "Lỗi lint hay vấp"), chạy `pnpm exec eslint <file>` sau mỗi file.

## 7. Báo cáo và commit

Theo mẫu `README.md`. Ghi rõ:

- danh sách thông điệp Bridge đã thêm vào shared;
- chỗ nào cần Claude làm thêm phía Bridge.

Không chạy `pnpm test:e2e`.

```text
feat(studio): place, move and size elements inside free frames
```
