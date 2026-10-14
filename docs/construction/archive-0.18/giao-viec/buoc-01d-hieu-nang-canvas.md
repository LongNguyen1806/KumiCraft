# Bước 1D — Đo hiệu năng Canvas và đóng WP-1.07 (M-CV, M-OV)

WP-1.07, phần 4/4. Module: M-CV, M-OV. Spec: SPEC-04.1 mục 7.8 (R-CV-05, R-CV-06, R-CV-07), PB-13, PB-16. Yêu cầu: 1A, 1B, 1C đã xong và đã commit.

## Mục tiêu

Chứng minh bằng số đo rằng Canvas đạt ngân sách hiệu năng, rồi đóng WP-1.07.

| Mã      | Ngân sách                                            | Đo gì                                                                  |
| ------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| PB-13   | ≤ 16 ms mỗi lần cập nhật Overlay (hover, khung chọn) | Thời gian tính và vẽ lại overlay sau mỗi `pointermove`, trang 500 node |
| PB-16   | ≤ 1 s                                                | Từ lúc mở trang 500 node đến khi Canvas render xong                    |
| R-CV-05 | Đổi thuộc tính một node chỉ re-render node đó        | Đếm số lần render từng node                                            |
| R-CV-07 | Khối `@theme` chỉ cập nhật khi token đổi             | Đã làm ở 1A; thêm vào bộ đo                                            |

## Phạm vi (chỉ được sửa/thêm)

- `packages/studio/src/features/canvas/**`, `features/overlay/**`: chỉ thêm **mốc đo** (`performance.mark`/`measure`) và sửa lỗi hiệu năng tìm được
- `packages/studio/src/store/editor-store.ts`: chỉ khi test R-CV-05 chứng minh store tạo lại object của node không đổi (xem việc C)
- `e2e/perf/canvas-perf.e2e.ts` (mới), `playwright.config.js` (thêm project/`grep` cho perf nếu cần), `package.json` gốc (script `bench:ui`)
- `docs/construction/progress.md`, `modules.md` (chỉ khi đóng WP)

## Việc cần làm

### A. Mốc đo trong code (rẻ, luôn bật)

- Overlay: bao thân hàm cập nhật bằng `performance.mark('rc:overlay-start')` / `performance.mark('rc:overlay-end')` và `performance.measure('rc:overlay-update', ...)`.
- Canvas: `rc:canvas-open` đặt khi bắt đầu hiển thị một trang (đổi `activePageId` hoặc tải tài liệu); `rc:canvas-ready` đặt sau khi gốc trang đã commit **và** hai lần `requestAnimationFrame` liên tiếp (layout đã xong) **và** Tailwind runtime đã áp CSS (ví dụ `getComputedStyle` của gốc trang khác mặc định, hoặc sự kiện/ MutationObserver trên thẻ `<style>` mà runtime chèn). `measure('rc:canvas-render')`.
- Không in log, không gửi đi đâu; chỉ `performance` API.

### B. Bài đo Playwright: `e2e/perf/canvas-perf.e2e.ts`

- Tạo workspace 500 node một trang bằng `pnpm gen:large-workspace -- --out <dir> --pages 1 --nodes 500 --seed 1` (xem `scripts/gen-large-workspace.ts`) hoặc gọi hàm của nó; chạy CLI trên workspace đó (`e2e/support/cli-session.ts`).
- **PB-16**: mở Studio, đọc `performance.getEntriesByName('rc:canvas-render')`. Lặp 5 lần (tải lại trang), lấy lần lớn nhất. Phải ≤ 1000 ms.
- **PB-13**: di chuột 200 lần qua các node khác nhau (`page.mouse.move` với bước nhỏ) ở zoom 100% và 50%; lấy toàn bộ `rc:overlay-update`; **P95 ≤ 16 ms** và ghi max. Cùng bài đo với nhiều lựa chọn (chọn 20 node bằng Shift+Click rồi di chuột).
- Chạy trên Chromium, Firefox, WebKit. Ba trình duyệt đều phải đạt P95; nếu một trình duyệt vượt, **không nới ngưỡng**: tìm nguyên nhân (đọc layout thừa, không gom `rAF`, vẽ lại toàn bộ) và sửa.
- Ghi số đo ra `bench-results/canvas-perf.json` (`{ pb13: {browser: {p95, max}}, pb16: {browser: ms} }`).
- Thêm script `"bench:ui"` ở `package.json` gốc chạy riêng bài này (`pnpm build && playwright test e2e/perf`). Bài đo **không** nằm trong `pnpm test:e2e` mặc định nếu thời gian chạy dài hơn 60 giây (dùng `test.describe` với tag `@perf` và `--grep-invert` trong cấu hình mặc định); ghi rõ cách chạy trong báo cáo.

### C. R-CV-05: chỉ node đổi mới render lại

Đã làm ở 1A (Claude sửa): `packages/studio/src/features/canvas/canvas-rerender.test.tsx` và `reuseUnchanged` trong `editor-store.ts`. Ở bước này chỉ cần: (1) chạy lại test đó, (2) thêm một ca với trang có `List` và `ComponentInstance` (đổi một node bên trong slot của instance, chỉ node đó được vẽ lại), (3) thêm ca đổi **token**: chỉ khối theme cập nhật, không node nào render lại ngoài các node dùng token đó cũng không cần render lại (class không đổi).

### D. Dọn lỗi tìm được

Ghi mọi thứ đo được cao bất thường vào báo cáo kèm nguyên nhân. Sửa nếu thuộc phạm vi; nếu thuộc module khác, ghi vào `spec-log.md` và báo, đừng tự sửa.

### E. Đóng WP-1.07

Không viết báo cáo WP riêng. Chỉ cập nhật `progress.md` (WP-1.07 → Xong, Phase 1: 7/11) và `modules.md` (M-CV, M-OV → Xong), và ghi trong báo cáo cuối: việc hoãn (R-CV-03 dữ liệu mẫu chờ Phase 4; rich text chờ WP-2.09; Xem thử chờ WP-2.08).

## Kiểm tra (dán kết quả thật)

1. `pnpm verify` mã thoát 0 (số test cũ/mới). `pnpm trace`: 100% cho `R-CV-01, 02, 04, 05, 07, 10`, `R-OV-01, 02` (R-CV-03, 06, 08, 09 đúng phạm vi hoãn sẽ nằm ngoài `scripts/trace-scope.json` — nếu `trace` báo thiếu, đối chiếu file đó và nói rõ trong báo cáo, **không** sửa file phạm vi để cho qua).
2. `pnpm bench:ui`: bảng số đo PB-13 (P95, max) và PB-16 theo từng trình duyệt, đều trong ngân sách.
3. `pnpm test:e2e` xanh trên 3 trình duyệt (mọi E2E của 1A, 1B, 1C và các E2E cũ).
4. `pnpm lint`, `pnpm check:i18n`, `pnpm exec prettier --check docs` sạch.

## Không được làm

- Không nới ngưỡng, không bỏ trình duyệt khỏi bài đo, không đo trên trang nhỏ hơn 500 node.
- Không thêm tính năng mới ngoài mốc đo và sửa hiệu năng.
