# Bước 1B — Overlay: hover, chọn, nhiều lựa chọn (M-OV)

> Giao cùng lúc với [1C](buoc-01c-sua-chu-truc-tiep.md) và [1D](buoc-01d-hieu-nang-canvas.md). Làm lần lượt B → C → D, báo cáo một lần, theo "Quy trình rút gọn" trong [README](README.md).

WP-1.07, phần 2/4. Module: M-OV. Spec: SPEC-04.1 mục 8.1 đến 8.3 (không gồm 8.4), mục 6 (thanh trạng thái). Yêu cầu: 1A đã xong và đã commit.

## Mục tiêu

Người dùng rê chuột thấy viền hover, bấm vào Canvas thì chọn đúng node, bấm tiếp để đi sâu, Shift để chọn nhiều. Lựa chọn đồng bộ hai chiều với Layer Tree và thanh trạng thái.

## Phạm vi (chỉ được sửa/thêm)

- `packages/studio/src/features/overlay/**` (mới)
- `packages/studio/src/features/canvas/canvas-context.ts` (mới, nếu cần: chia sẻ `iframeDocument` và `scale` từ 1A)
- `packages/studio/src/features/canvas/canvas-iframe.tsx`, `canvas-viewport.tsx`, `features/editor/canvas-area.tsx` (chỉ phần gắn Overlay và chia sẻ context)
- `packages/studio/src/store/editor-store.ts` và `editor-store.test.ts`
- `packages/studio/src/features/editor/side-panels.tsx`, `editor-shell.tsx` (chỉ phần hiển thị nhiều lựa chọn)
- i18n `overlay.*`, `e2e/canvas-select.e2e.ts` (mới)

## Việc cần làm

### A. Store: nhiều lựa chọn (giữ tương thích)

Hiện store có `selectedNodeId`, `hoveredNodeId`, `selectNode`, `hoverNode`. Sửa như sau, **không phá chỗ đang dùng `selectedNodeId`**:

- Thêm `selectedNodeIds: readonly string[]` (thứ tự chọn; phần tử cuối là node "chính").
- `selectedNodeId` luôn bằng phần tử cuối của `selectedNodeIds` (hoặc `undefined`).
- `selectNode(id | undefined)`: chọn đúng một node, hoặc bỏ chọn.
- Thêm `toggleNodeSelection(id)` (Shift+Click: thêm/bỏ) và `selectNodes(ids)`.
- Mọi chỗ làm node biến mất (`dispatch`, `undo`, `redo`, tải lại tài liệu, đổi trang) phải **loại khỏi lựa chọn các id không còn trong `flatNodes`**; đổi trang thì bỏ chọn hết.
- Test trong `editor-store.test.ts` cho từng điểm trên.

### B. Hàm chọn thuần (dễ test): `features/overlay/pick-target.ts`

Hàm thuần, không đụng DOM, nhận dữ liệu và trả node cần chọn:

```ts
pickTarget({
  chain,        // id các tổ tiên từ node dưới root đến node sâu nhất bị click (đã bỏ root)
  selected,     // selectedNodeIds hiện tại
  modifiers,    // { shift, deep } deep = Ctrl hoặc Cmd (macOS)
  isLocked,     // (id) => boolean
}) => { kind: 'select' | 'toggle' | 'clear'; id?: string }
```

Quy tắc (SPEC-04.1 mục 8.2, 8.3):

1. Bỏ các id `locked` khỏi `chain`. Chuỗi rỗng → `clear`.
2. `deep` (Ctrl/Cmd+Click) → chọn node **sâu nhất** của chuỗi.
3. `shift` → `toggle` node chọn theo quy tắc 4 (không `deep`) hoặc sâu nhất nếu cùng giữ Ctrl/Cmd.
4. Chọn cha trước: gọi `S` là node chính đang chọn. Nếu `S` nằm trong chuỗi ở vị trí `i` và còn node sâu hơn → chọn node ở vị trí `i+1` **[R-OV-02]**; nếu `S` đã là node sâu nhất → giữ nguyên; nếu `S` không nằm trong chuỗi hoặc chưa chọn gì → chọn phần tử **đầu tiên** của chuỗi, tức con cấp 1 của root **[R-OV-01]**.

Test bắt buộc (tên test có `[R-OV-01]`, `[R-OV-02]`): chưa chọn gì; chọn cấp 1 rồi click lại; đi sâu tới đáy rồi click lại; chọn node ở nhánh khác; Ctrl+Click; Shift+Click thêm/bỏ; node `locked` ở giữa chuỗi; chuỗi rỗng.

### C. Từ phần tử DOM sang chuỗi `chain`

Trong `features/overlay/` thêm hàm `chainFromElement(element, getNode)`:

- Đi từ `element.closest('[data-rc-node]')` lên qua các tổ tiên có `data-rc-node`, gom id, đảo thứ tự thành "từ ngoài vào trong", bỏ id của node root của trang.
- **Bản lặp của `List`** (`data-rc-repeat`): các phần tử bên trong bản lặp mang cùng id với node mẫu nên chuỗi tự đúng; kiểm tra có test.
- **Bên trong `ComponentInstance`**: phần tử có `data-rc-inner` hoặc nằm dưới instance (ngoài `slots`) → cắt chuỗi tại instance (chọn cả instance, mục 7.6). Node trong `slots` có `data-rc-node` thì đi tiếp như thường.
- Test bằng DOM giả (jsdom) cho List, Instance, node lồng 4 cấp.

### D. Component Overlay: `features/overlay/canvas-overlay.tsx`

Vẽ trong tài liệu **cha** (không phải trong iframe), một lớp `position: absolute; inset: 0; pointer-events: none` phủ đúng vùng iframe sau thu phóng (dùng `scale` của 1A).

- **Hover** (mục 8.1): viền 1 px màu nhấn quanh `hoveredNodeId`. **Selection**: viền 2 px, nhãn góc trên trái ghi `node.name` hoặc tên loại node (dịch qua i18n), dưới khung ghi `rộng × cao` (px, làm tròn, theo kích thước thật chưa thu phóng). **Nhiều lựa chọn**: viền từng node và một khung bao chung.
- Toạ độ: lấy `getBoundingClientRect()` của phần tử trong iframe (toạ độ theo tài liệu iframe, chưa thu phóng), nhân `scale`. Độ dày viền **không** đổi theo thu phóng (1 px/2 px thật).
- Màu: dùng token Tailwind của Studio (`sun` hoặc `charcoal`; xem `index.css`); không hard-code màu mới ngoài token.
- Cập nhật khi: con trỏ di chuyển, lựa chọn/ hover đổi, `scale` đổi, đổi khung, nội dung node đổi kích thước (`ResizeObserver` trên `documentElement` của iframe + `flatNodes` đổi), cuộn vùng Canvas, đổi cỡ cửa sổ. Gom bằng `requestAnimationFrame`, mỗi frame tối đa một lần tính; không đọc layout (`getBoundingClientRect`) cho node không hiển thị. **Mỗi frame ≤ 16 ms (PB-13)**, đo ở 1D.
- Chỉ bật ở chế độ Thiết kế (hiện chỉ có chế độ này).
- Đặt `data-testid` để E2E tìm được: `"hover-box"`, `"selection-box"` (mỗi node đang chọn một cái, kèm `data-node-id`), `"selection-label"`, `"selection-size"`.

### E. Sự kiện trong iframe

Gắn trên `iframeDocument` (gỡ khi unmount), **pha capture**:

- `pointermove` → tìm `elementFromPoint`, `hoverNode(id cuối của chuỗi theo quy tắc hover = node sâu nhất không locked)`. Rời iframe → `hoverNode(undefined)`.
- `click` (nút trái) → `pickTarget(...)` rồi gọi action store tương ứng. `preventDefault()` + `stopPropagation()`.
- `pointerdown`/`mousedown` → `preventDefault()` để không bôi đen chữ/ không lấy focus vào iframe (trừ khi đang sửa chữ ở 1C: hook cho phép bỏ qua qua một cờ, hiện chưa cần).
- Click vào vùng nền của Canvas **ngoài khung trang** (`<main>` ở `canvas-area.tsx`) → bỏ chọn.
- Phím `Escape` (ở cả tài liệu cha lẫn iframe) → bỏ chọn, **trừ** khi một ô nhập/ trình sửa chữ đang giữ focus.
- Không bắt phím tắt khác ở bước này.

### F. Đồng bộ với Layer Tree và thanh trạng thái

- `side-panels.tsx`: hàng nào nằm trong `selectedNodeIds` thì tô như đang chọn (`aria-current`/ `aria-selected`); click vào hàng gọi `selectNode`; Ctrl/Cmd hoặc Shift+Click vào hàng gọi `toggleNodeSelection`. Rê chuột lên hàng gọi `hoverNode`; hàng của `hoveredNodeId` được tô nhạt.
- Thanh trạng thái (`editor-shell.tsx` phần breadcrumb): khi nhiều lựa chọn ghi "N phần tử đã chọn" (khóa i18n, có số nhiều theo i18next), một lựa chọn thì giữ nguyên hiển thị hiện tại.

## Kiểm tra (dán kết quả thật)

1. `pnpm verify` mã thoát 0; ghi số test cũ/mới. `pnpm trace` báo `R-OV-01`, `R-OV-02` có test.
2. `e2e/canvas-select.e2e.ts` xanh trên Chromium, Firefox, WebKit, gồm:
   - Rê chuột lên node → `hover-box` có kích thước bằng `boundingBox()` của phần tử (sai số ≤ 1 px) ở zoom 100% **và** 50%.
   - Click lần 1/2/3 vào cùng chỗ trong node lồng 3 cấp → chọn cấp 1, rồi cấp 2, rồi cấp 3.
   - Ctrl+Click (Windows) / Meta+Click chọn sâu nhất ngay. Shift+Click thêm rồi bỏ.
   - Click vùng nền ngoài khung → bỏ chọn. `Escape` → bỏ chọn.
   - Click vào Link/Button trong thiết kế → chọn node, **không** điều hướng.
   - Click vào bản lặp của List → chọn node mẫu. Click vào trong ComponentInstance → chọn cả instance.
   - Layer Tree: chọn ở Canvas thì hàng tương ứng sáng; chọn ở Layer Tree thì khung chọn hiện trên Canvas.
   - Xoá node đang chọn bằng API rồi Undo/Redo: không còn khung chọn mồ côi, không lỗi console.
3. `pnpm lint` 0 cảnh báo; `pnpm check:i18n` sạch; không `eslint-disable` mới.

## Không được làm

- Không làm sửa chữ trực tiếp (1C), kéo thả (Bước 2), phím tắt (Bước 4), Padding/gap hint (khi làm Inspector).
- Không đọc `getBoundingClientRect` của toàn bộ node mỗi frame; chỉ node hover/đang chọn.
- Không đổi nghĩa `selectedNodeId` cho các màn hình khác.
