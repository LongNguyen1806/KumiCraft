# Bước 2 — WP-1.08: Kéo thả, Library, Layer Tree (M-DD, M-LB, M-LT)

Spec: SPEC-04.1 mục 9 (kéo thả), mục 10 (Library), mục 12 (Layer Tree), ADR-FE-09; SRS AC-02. Yêu cầu: WP-1.07 đã commit. Một lần giao, làm theo thứ tự A → B → C → D → E, báo cáo một lần (quy trình rút gọn trong [README](README.md)).

## Hiện trạng đã kiểm (2026-10-13, Claude đọc code)

- **Chưa có**: hàm `canInsert` trong model; preset (`@reactcraft/model/presets`); `@tanstack/react-virtual`; bộ icon Lucide (`lucide-react`).
- **Đã có, dùng lại**: `validateOperation`, `applyBatch`, `assignIds` (`packages/model/src/operations/`); kiểm tra cha-con V-10 ở `operations/precheck-tree.ts` và `schema/validate/rules-structure.ts`; spike VG-11 đã Đạt ở `packages/studio/spikes/vg-11/` (`drop-target.ts`: `findDropTarget`, `dropStops`; `main.tsx`: `DndContext` + `PointerSensor` khoảng cách 4 + `KeyboardSensor`, lớp phủ che iframe khi kéo).
- Canvas thu phóng bằng `transform: scale` (spec-log #95); hệ số đọc qua `useCanvasScale()`. Iframe **cao bằng nội dung, không tự cuộn**; vùng cuộn là `<main data-testid="editor">` ở `canvas-area.tsx`.
- Layer Tree hiện là danh sách phẳng trong `features/editor/side-panels.tsx` (`LayerList`); tab Library đang ghi "sẽ có sau" (`editor.libraryLater`).
- `@dnd-kit/*` đang ở `devDependencies` của studio.

## Phạm vi

- Model: `packages/model/src/operations/can-insert.ts` (+ test), `packages/model/src/presets/**` (+ test), xuất qua `packages/model/src/index.ts`.
- Studio: `features/dnd/**` (mới), `features/library/**` (mới), `features/layers/**` (mới, chuyển Layer Tree ra khỏi `side-panels.tsx`), `features/editor/side-panels.tsx`, `features/overlay/canvas-overlay.tsx` (chỉ phần chỉ báo thả), i18n (namespace `common`, khóa `library.*`, `layers.*`, `dnd.*`).
- `packages/studio/package.json`: chuyển `@dnd-kit/*` sang `dependencies`; **được phép thêm** `@tanstack/react-virtual` và `lucide-react` (spec yêu cầu: R-LT-01, mục 7.2 Icon, 10.1). Ghim đúng phiên bản (không `^`), chọn bản phát hành ít nhất 2 tuần trước. Không thêm thư viện khác.
- E2E: `e2e/canvas-dnd.e2e.ts`, `e2e/layers.e2e.ts` (mới). Dùng `openCanvasStudio` trong `e2e/support/canvas-studio.ts`.

## Việc cần làm

### A. Model: `canInsert` (hàm thuần, dùng chung với `validateOperation`)

```ts
canInsert(doc, target, parentId, subject, index): Result<void>
// subject: { kind: 'new', node: DesignNodeInput } | { kind: 'move', nodeIds: readonly string[] }
```

- Dựng operation `insert` hoặc `move` tương ứng rồi gọi đúng `validateOperation` (không viết lại luật). Trả lỗi kèm mã V-xx.
- Phải chặn: node lá nhận con (V-10), `Modal` trong `Card` (AC-02), kéo node vào chính nó hoặc con cháu của nó, `List` có hơn 1 con (V-14), `Tabs` (V-15), vượt độ sâu/số node (V-19), root của trang (V-20), node bên trong định nghĩa component từ instance.
- Test: mỗi luật một ca vi phạm và một ca hợp lệ (gắn mã `[V-xx]`), cộng property test nhỏ: mọi kết quả `canInsert` = ok thì `applyBatch` với operation đó cũng ok.

### B. Model: preset (SPEC-04.1 mục 10.1, 10.2)

- `packages/model/src/presets/`: kiểu `Preset` đúng như spec; mỗi preset là hàm thuần `create({ tokens, contentLocale })` trả cây **chưa có ID**; khi thả dùng `assignIds`.
- Làm **mọi preset ở bảng 10.2, trừ hai preset có tương tác**: "Thanh điều hướng responsive" và "Form tạo mới có Modal" (WP-2.08). `Modal` và `Tabs` không có tương tác nên vẫn làm.
- R-LB-01: chữ mẫu theo `contentLocale` (`vi-*` tiếng Việt, còn lại tiếng Anh). R-LB-02: chỉ dùng token có trong bộ mặc định; token đã bị xoá thì dùng giá trị `{ px }` tương đương và trả cảnh báo.
- Test: **mọi** preset tạo cây hợp lệ theo schema (chạy `checkDocument` sau khi chèn vào trang trống), đúng chữ theo `vi-VN` và `en-US`, đúng giá trị mặc định chính ở bảng 10.2 (golden test).

### C. Kéo thả trên Canvas (M-DD, SPEC-04.1 mục 9)

- Chuyển `findDropTarget` của spike thành `features/dnd/drop-target.ts`, làm đúng 6 bước của mục 9.2: toạ độ vào iframe `x = (clientX − frameRect.left) / scale`; bỏ node đang kéo, node `locked`; quy tắc 12 px để vào trong container; tính chỉ số theo flex-row, flex-column, grid/wrap; **gọi `canInsert`, không hợp lệ thì thử cha, tối đa tới root**.
- Nguồn kéo (mục 9.1): mục trong Library (insert preset), **nhãn của khung chọn** trên Canvas (move), dòng trong Layer Tree (move).
- Trong lúc kéo: lớp phủ che iframe (như spike) để `@dnd-kit` nhận sự kiện; chỉ báo theo bảng 9.3 (vạch 2 px, viền nét đứt khi thả vào trong, nhãn "Vào Card" dịch qua i18n), con trỏ `not-allowed` khi không có vị trí hợp lệ.
- Luật:
  - R-DD-01: cache vị trí con của container đang trỏ, chỉ đo lại khi đổi container, cuộn, đổi zoom; **≤ 8 ms mỗi lần di chuột** (PB-15).
  - R-DD-02: tự cuộn khi con trỏ cách mép trên/dưới < 40 px. Vì iframe không tự cuộn, **cuộn vùng `<main data-testid="editor">`**; ghi lệch này vào spec-log.
  - R-DD-03: Esc huỷ, không tạo operation. R-DD-04: thả đúng chỗ cũ không tạo operation.
  - R-DD-05: kéo nhiều node đã chọn chỉ khi cùng cha; một batch `move` giữ thứ tự.
  - R-DD-06: bàn phím: chọn node, `Space` nhấc, mũi tên đi qua danh sách vị trí hợp lệ theo thứ tự cây, `Space` thả, `Esc` huỷ. Có thông báo cho trình đọc màn hình (`announcements` của `@dnd-kit`, dịch qua i18n).
- Mỗi lần thả = **một** bước Undo. Thả xong, node mới được chọn.
- Chuyển `@dnd-kit/*` sang `dependencies`.

### D. Library (M-LB)

- Tab Library ở panel trái: nhóm theo `category`, tìm kiếm theo tên **cả `vi` và `en`** (R-LB-03), icon Lucide, kéo vào Canvas. Bấm đúp một mục: chèn vào cuối container đang chọn (hoặc root) nếu hợp lệ.
- Bỏ khóa `editor.libraryLater` nếu không còn dùng.

### E. Layer Tree (M-LT)

- Chuyển ra `features/layers/`. Ảo hoá bằng `@tanstack/react-virtual` (R-LT-01): trang 500 node vẫn cuộn mượt.
- R-LT-02: mỗi dòng có icon loại node, tên (hoặc tên loại dịch), nút ẩn/hiện, nút khoá (thao tác `setNodeMeta`, một bước Undo), biểu tượng binding nếu có. Có mở/đóng nhánh.
- R-LT-03: đồng bộ chọn hai chiều (đã có từ 1B); chọn trên Canvas thì **tự mở nhánh và cuộn tới dòng**.
- R-LT-04: nhấp đúp tên hoặc `F2` để đổi tên (`setNodeMeta`), `Enter` lưu, `Esc` huỷ.
- R-LT-05: kéo sắp xếp bằng `@dnd-kit/sortable`, kiểm tra bằng `canInsert`.
- R-LT-06: menu chuột phải: Nhân bản, Xoá, Bọc trong Hàng/Cột/Lưới, Bỏ bọc, Đổi tên. "Sao chép" và "Dán vào trong" hiện nhưng **tắt** (làm ở WP-1.10).
- R-LT-07: `ComponentInstance` là một dòng, mở ra thấy slot, không hiện node nội bộ.
- Bỏ qua R-LT-08, R-LT-09 (tương tác, WP-2.08).

## Kiểm tra (dán kết quả thật)

1. `pnpm verify` mã thoát 0, ghi số test cũ/mới; `pnpm trace` có `R-DD-01..06`, `R-LB-01..03`, `R-LT-01..07`.
2. `e2e/canvas-dnd.e2e.ts` xanh trên 3 trình duyệt, gồm **AC-02**: kéo Section, Card, Button từ Library vào trang; đổi thứ tự bằng kéo nhãn khung chọn; thả `Modal` vào `Card` bị từ chối (không có operation, con trỏ `not-allowed`); Esc huỷ; thả chỗ cũ không tạo Undo; kéo bằng bàn phím; kéo nhiều node cùng cha; thả ở zoom 50% đúng vị trí; tự cuộn khi kéo gần mép; một lần Undo xoá đúng một lần thả.
3. `e2e/layers.e2e.ts` xanh 3 trình duyệt: đổi tên (nhấp đúp, F2), ẩn/hiện, khoá (node khoá không chọn được trên Canvas), kéo sắp xếp, menu chuột phải từng mục, chọn trên Canvas thì cây mở và cuộn tới dòng (trang 500 node).
4. Đo PB-15: thêm vào `e2e/perf/canvas-perf.e2e.ts` một bài kéo qua trang 500 node, đo thời gian tính vị trí thả (`performance.measure('rc:drop-target')`), P95 ≤ 8 ms trên cả 3 trình duyệt. Chạy `pnpm bench:ui` (1 luồng), dán bảng số.
5. Chạy `pnpm test:e2e` **hai lượt liên tiếp** đều xanh (kéo thả hay lỗi lúc có lúc không).

## Không được làm

- Không làm preset có tương tác, R-LT-08/09, Sao chép/Dán (WP-1.10), Inspector (WP-1.09).
- Không viết lại luật hợp lệ trong `canInsert`; phải gọi `validateOperation`.
- Không dùng `instanceof` lớp DOM của trang cha với phần tử trong iframe (xem README).
- Không nới ngân sách PB-15, không bỏ trình duyệt nào khỏi E2E.
