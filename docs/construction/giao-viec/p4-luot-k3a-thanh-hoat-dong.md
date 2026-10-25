# Phase 4 — Lượt K3a: Thanh hoạt động bên trái kiểu VS Code

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

## 0. Bối cảnh

Quyết định của chủ dự án (spec-log #66, kế hoạch `p4-ke-hoach.md` mục K3): sidebar trái đổi thành **thanh hoạt động** kiểu VS Code, để chừa chỗ cho Thư mục (K3b) và các tính năng sau. Lượt này **chỉ sắp xếp lại**, không thêm tính năng mới.

Hôm nay:

- Panel trái (`features/editor/side-panels.tsx`, `LeftPanel`): 3 tab Lớp, Thư viện, Component; tab nhớ ở `localStorage` khóa `kumicraft.leftPanelTab`.
- Panel phải (`RightPanel`): 3 tab Thuộc tính, Brand, Chat; nhớ ở `kumicraft.rightPanelTab`.
- **Trang** và **Bản nháp** mở bằng hộp thoại đè lên Canvas (`features/pages/pages-dialog.tsx`, `features/drafts/drafts-dialog.tsx`), từ hai nút `pages-manage`, `drafts-manage` trong `features/editor/page-select.tsx`.
- **Cài đặt**: `SettingsButton` ở `features/editor/editor-toolbar.tsx` (trong editor) và `features/shell/top-bar.tsx` (màn hình đầu).
- Bật/tắt panel: `features/editor/use-panel-layout.ts` (`usePanelLayoutStore`: `toggle`, `toggleBoth`, khóa `kumicraft.panels`), nút tròn `PanelToggle` trong `editor-toolbar.tsx`, phím tắt `panels`.
- Lưới editor: `features/editor/editor-shell.tsx` (`WorkGrid`: trái, Canvas, phải).

Không sửa: server, Bridge, `docs/spec.md`, chat AI, MCP, nội dung bên trong các panel (Lớp, Thư viện, Component, Brand chỉ được đổi chỗ đặt).

## 1. Mục tiêu (người dùng thấy gì)

```
┌──┬──────────────┬─────────────────┬──────────────┐
│📁│              │                 │ Thuộc tính   │
│≡ │   Panel      │     Canvas      │ Chat AI      │
│▦ │  đang mở     │                 │              │
│◇ │              │                 │              │
│📄│              │                 │              │
│✎ │              │                 │              │
│🎨│              │                 │              │
│⚙ │              │                 │              │
└──┴──────────────┴─────────────────┴──────────────┘
```

1. Ngoài cùng bên trái là **dãy icon dọc** (rộng 48px), luôn hiện trong editor. Thứ tự: **Lớp**, **Thư viện**, **Component**, **Trang**, **Bản nháp**, **Brand**; dưới cùng: **Cài đặt**. (Icon **Thư mục** thêm ở K3b, đứng đầu.)
2. Bấm một icon → panel trái hiện nội dung đó; icon đang mở được tô (như VS Code: vạch màu bên trái + nền nhạt).
3. Bấm lại icon **đang mở** → panel trái **thu gọn**, Canvas rộng ra; dãy icon vẫn hiện.
4. Panel trái đang thu gọn, bấm một icon → panel mở đúng nội dung đó.
5. **Nút tròn bật/tắt panel trái** (`PanelToggle`) và **phím tắt `panels`** vẫn chạy như cũ; nút tròn, phím tắt và việc bấm lại icon dùng **chung một trạng thái** (không lệch nhau).
6. **Trang** và **Bản nháp** không còn là hộp thoại đè Canvas mà là panel trái; nút `pages-manage`, `drafts-manage` trong thanh chọn trang mở đúng panel đó.
7. **Brand** chuyển từ panel phải sang thanh trái; panel phải chỉ còn **Thuộc tính** và **Chat AI**.
8. Icon Brand chỉ hiện khi dự án có lớp style hỗ trợ (`useStyleLayerSupported`, như tab Brand hôm nay); Thư viện luôn hiện (panel tự báo khi hệ chưa hỗ trợ, như hôm nay).
9. Icon Bản nháp có **huy hiệu số bản nháp** khi > 0.
10. Mỗi icon có tooltip (tên + phím tắt nếu có) vi/en và `aria-label`.
11. Cài đặt mở như hôm nay (cùng hộp thoại `SettingsButton` đang mở).
12. KumiCraft nhớ icon đang mở theo từng máy; lần đầu sau khi cập nhật: lấy từ `kumicraft.leftPanelTab` cũ nếu có (`layers`/`library`/`components`), và nếu `kumicraft.rightPanelTab` là `brand` thì mở Brand bên trái, panel phải về Thuộc tính.

## 2. Đọc trước (CW-52)

| File                                                                                             | Lý do                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `docs/construction/giao-viec/p4-ke-hoach.md` mục K3, `docs/construction/spec-log.md` #66         | Quyết định                                  |
| `packages/studio/src/features/editor/side-panels.tsx` + test                                     | Panel trái/phải, `Tab`, cách nhớ tab        |
| `packages/studio/src/features/editor/editor-shell.tsx`, `use-panel-layout.ts` + test             | Lưới, bật/tắt, độ rộng                      |
| `packages/studio/src/features/editor/editor-toolbar.tsx` (`PanelToggle`, `SettingsButton`)       | Nút tròn, Cài đặt                           |
| `packages/studio/src/features/editor/page-select.tsx`                                            | Nút mở Trang, Bản nháp; `PageSelectDialogs` |
| `packages/studio/src/features/pages/pages-dialog.tsx`, `features/drafts/drafts-dialog.tsx`       | Nội dung sẽ thành panel                     |
| `packages/studio/src/features/shortcuts/shortcut-actions.ts`, `packages/shared/src/shortcuts.ts` | Phím tắt `panels`                           |
| `packages/studio/src/features/project/use-style-edit.ts` (`useStyleLayerSupported`)              | Điều kiện hiện Brand                        |

## 3. Hợp đồng

### 3.1. Trạng thái (`packages/studio/src/features/shell/activity-store.ts`)

- `export const ACTIVITY_IDS = ['layers', 'library', 'components', 'pages', 'drafts', 'brand'] as const;` (`ActivityId`).
- Store zustand: `active: ActivityId`, `setActive(id)`, nhớ ở khóa `kumicraft.activity` (đọc/ghi trong `try/catch` như `use-panel-layout.ts`); chuyển đổi một lần từ khóa cũ như mục 1.12, rồi xóa hai khóa cũ.
- `usePanelLayoutStore` thêm `show(side)` (đặt `visible[side] = true`, lưu như `toggle`).
- Hàm dùng chung `activate(id)`: nếu `id === active` và panel trái đang mở → `toggle('left')`; ngược lại `setActive(id)` và `show('left')`. Icon, nút `pages-manage`/`drafts-manage` đều gọi hàm này (riêng hai nút đó: luôn mở, không thu gọn khi đang mở).

### 3.2. Dãy icon (`packages/studio/src/features/shell/activity-bar.tsx`)

- Cấu hình **một mảng** (`ACTIVITY_ITEMS`): `{ id, icon, labelKey, visible?: (ctx) => boolean, badge?: (ctx) => number | undefined }`. Thêm tính năng sau này = thêm một phần tử.
- `<nav aria-label=…>` chứa các `<button>` có `aria-label`, `aria-pressed` (đang mở và panel trái hiện), `title` (tooltip), `data-testid="activity-<id>"`; Cài đặt `data-testid="activity-settings"` dùng lại `SettingsButton` (thêm biến thể hiển thị dạng icon nếu cần, không viết hộp thoại mới).
- Icon: dùng bộ icon đang dùng trong Studio (xem `library-icons.ts`/`editor-toolbar.tsx`), không thêm thư viện.
- Màu, kích thước theo token Studio đang dùng (`text-ink-soft`, `bg-card`, `border-border`…), hỗ trợ cả giao diện sáng/tối như các panel khác.

### 3.3. Bố cục

- `editor-shell.tsx`: lưới thêm cột **48px** đầu tiên cho `ActivityBar` (luôn hiện); cột panel trái theo `layout.visible.left` như cũ.
- `LeftPanel` hiện nội dung theo `active`: `LayerTree`, `LibraryPanel`, `ComponentsPanel`, `PagesPanel`, `DraftsPanel`, `BrandPanel`; tiêu đề panel là tên mục đang mở. Bỏ hàng tab cũ của panel trái.
- `RightPanel`: chỉ còn tab Thuộc tính và Chat; bỏ tab Brand và `activeTab` dự phòng của Brand.
- **Trang, Bản nháp thành panel:** tách phần nội dung của `PagesDialog`/`DraftsDialog` thành `PagesPanel`/`DraftsPanel` (cùng file hoặc file mới trong thư mục của chúng), **dùng lại nguyên** danh sách, nút, form con (`add-page-form`, `rename-page-form`, `new-draft-dialog`, `promote-draft-dialog` vẫn là hộp thoại con như hôm nay). Bỏ khung hộp thoại ngoài; không chép logic. `PageSelectDialogs` không còn mở hai hộp thoại này.
- `SettingsButton` bỏ khỏi `editor-toolbar.tsx` (đã có ở dãy icon); giữ ở `top-bar.tsx` cho màn hình đầu (chưa mở dự án).
- Không có phím tắt mới ở lượt này (để K3b cùng Thư mục, sau khi rà phím trình duyệt chiếm).

### 3.4. i18n

Khóa mới vi/en cho nhãn dãy icon (`activity.*`), tooltip, tiêu đề panel Trang/Bản nháp nếu chưa có. `pnpm check:i18n` phải đạt.

### 3.5. E2E (chỉ đổi đúng 3 chỗ này, không sửa gì khác trong `e2e/`)

- `e2e/canvas-edit.e2e.ts:70`: panel Lớp vẫn là `complementary` tên `editor.layers` (giữ nhãn panel trùng tên cũ để dòng này không phải đổi; nếu buộc phải đổi thì đổi đúng dòng này).
- `e2e/style-systems.e2e.ts:59`: `getByRole('tab', { name: ui('editor.library') })` → `getByTestId('activity-library')`.
- `e2e/style-systems.e2e.ts:91`: `getByTestId('right-tab-brand')` → `getByTestId('activity-brand')`.

## 4. Tình huống test (bắt buộc, ≤ 14, gắn mã trong tên test)

Mã: spec chưa có mã riêng cho bố cục panel; gắn `WP-4.00` (spec-log #66) vào tên mọi test, thêm `R-PG-15` cho test 8 và 10 (panel Trang).

| #   | File test                                | Tình huống → kết quả                                                                                                           |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `shell/activity-store.test.ts`           | Mặc định `layers`; `setActive('brand')` lưu `kumicraft.activity`; `localStorage` ném lỗi vẫn chạy                              |
| 2   | như trên                                 | Chuyển đổi một lần: `leftPanelTab=library` → `active=library`; `rightPanelTab=brand` → `active=brand`; hai khóa cũ bị xóa      |
| 3   | như trên                                 | `activate(id)` khác mục đang mở → đổi mục, panel trái mở; cùng mục và panel đang mở → panel trái thu gọn                       |
| 4   | như trên                                 | Panel trái đang thu gọn (bằng `toggle('left')`), `activate('library')` → mở, `active=library`                                  |
| 5   | `shell/activity-bar.test.tsx`            | Render đủ 6 icon + Cài đặt đúng thứ tự; icon đang mở có `aria-pressed="true"`                                                  |
| 6   | như trên                                 | Dự án styled-components (không có adapter) → không có `activity-brand`; dự án CSS → có                                         |
| 7   | như trên                                 | 3 bản nháp → huy hiệu `3` trên `activity-drafts`; 0 bản nháp → không có huy hiệu                                               |
| 8   | `editor/side-panels.test.tsx` (sửa/thêm) | `active=pages` → panel trái là `PagesPanel` (có nút thêm trang); `active=brand` → `BrandPanel`; không còn hàng tab trái        |
| 9   | như trên                                 | Panel phải chỉ có tab Thuộc tính và Chat, không có `right-tab-brand`                                                           |
| 10  | `editor/page-select.test.tsx` (thêm)     | Bấm `pages-manage` → `active=pages`, panel trái mở, **không** có hộp thoại `role="dialog"`; tương tự `drafts-manage`           |
| 11  | `editor/editor-toolbar` test (thêm)      | Nút tròn trái và `activate` cùng một trạng thái: thu gọn bằng nút tròn rồi bấm icon → mở; `aria-pressed` của nút tròn đổi theo |
| 12  | `editor/editor-shell.test.tsx` (thêm)    | Panel trái thu gọn → `activity-bar` vẫn hiện, cột lưới đầu 48px                                                                |

Test cũ: test nào kiểm hộp thoại Trang/Bản nháp hay hàng tab cũ thì **đổi sang hành vi mới** (panel), giữ nguyên các kiểm tra về nội dung (thêm/đổi tên/xóa trang, đưa nháp…); liệt kê từng test đã đổi trong báo cáo. Không xóa kiểm tra nội dung.

## 5. Bẫy đã biết

- Panel trái thu gọn hôm nay render `<div />` thay cho panel; dãy icon phải nằm **ngoài** điều kiện đó.
- `PagesDialog`/`DraftsDialog` có thể dựa vào `open`/`onClose` để nạp dữ liệu hoặc bẫy focus; panel không có `open` — nạp khi mount, bỏ bẫy focus của hộp thoại.
- Form con (thêm trang, đổi tên, nháp mới, đưa nháp) vẫn là hộp thoại: kiểm chúng mở được từ panel.
- Hai khóa `localStorage` cũ chỉ đọc một lần rồi xóa; khóa lỗi/không hợp lệ → mặc định `layers`.
- Ref DOM theo QC-40: `ref={(el) => { r.current = el ?? undefined; }}`.

## 6. Không được làm

- Không sửa server, Bridge, `docs/spec.md`, chat, MCP; trong `e2e/` chỉ 3 dòng ở mục 3.5.
- Không thêm dependency.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ cho xanh; không xóa kiểm tra nội dung của test cũ.
- File ≤ 400 dòng.

## 7. Kiểm tay (trong ứng dụng thật)

1. `npm run dev`, mở `fixtures/projects/react-css` (bản sao). Bấm lần lượt 6 icon → đúng panel; bấm lại icon đang mở → thu gọn; bấm icon khác → mở.
2. Nút tròn trái và phím tắt `panels` vẫn bật/tắt panel trái, dãy icon luôn còn.
3. Thanh chọn trang → nút quản lý trang → panel Trang bên trái; thêm một trang được.
4. Panel phải chỉ còn Thuộc tính và Chat; Brand mở từ dãy icon.
5. Tải lại trang Studio → mở lại đúng icon cuối cùng.

## 8. Báo cáo

Theo mẫu của README:

- danh sách file tạo/sửa/xóa;
- bảng 12 tình huống: **tên test đúng như trong code**, đạt/không;
- danh sách test cũ đã đổi và lý do;
- kết quả `pnpm verify` và `pnpm test:e2e` (số đạt/không);
- các bước kiểm tay trong ứng dụng thật; bước nào không làm được thì ghi lý do.

Không tự commit; đề xuất commit message `feat(studio): vs code style activity bar for the left panels` (đã qua commitlint).
