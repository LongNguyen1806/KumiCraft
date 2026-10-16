# Phase 1, lượt 3: cổng G1 (đóng Phase 1)

Nguồn: `docs/spec.md` tìm `| G1-01 |` đến `| G1-04 |`, `| VG-15 |`, `| VG-16 |`, bảng PB (`| PB-01 |` hai chỗ: chỉ tiêu và cách đo), SPEC-06 mục 6 (trace).

Lượt này gồm 4 phần **làm theo thứ tự A → B → C → D**. Xong phần nào chạy kiểm tra của phần đó. Một phần kẹt (sửa 3 lần vẫn đỏ, cần đổi thiết kế, cần thêm thư viện chưa được duyệt) thì **dừng ở phần đó và báo**.

Đọc trước: `AGENTS.md`, `docs/construction/giao-viec/README.md`.

## Quy tắc chung (bắt buộc, QA các lượt trước đã bắt lỗi)

1. Không đổi điều kiện, giá trị, thông điệp của code đang chạy ngoài việc được giao.
2. Không `null`, `any`, `as unknown as`, `eslint-disable`, `@ts-ignore`; không `waitForTimeout`; không test rỗng (test phải đỏ nếu tính năng hỏng).
3. **Gắn tag không phải là viết test.** Chỉ gắn `[MÃ]` vào test đã có khi test đó thật sự kiểm đúng nội dung quy tắc. Không gắn tag hàng loạt cho đủ số.
4. Trước khi báo xong: `pnpm format`, rồi `pnpm verify` (thoát mã 0, 0 cảnh báo lint), `pnpm test:e2e`, `pnpm test:e2e:network`. Dán nguyên văn dòng tổng.
5. Báo cáo kê **mọi** file sửa và mọi chỗ làm khác bản giao việc.

---

## Phần A: E2E giao diện tiếng Anh (G1-01)

Hiện `playwright.config.js` đặt `locale: 'vi-VN'` cho mọi project; nhiều selector E2E viết cứng chữ tiếng Việt của **giao diện Studio** (ví dụ `'Chưa mở dự án nào'`, `'Để sau'`, `'Tin cậy dự án này'`, `'Bạn có tin tưởng dự án này?'`, `'Xem và tin cậy'`, `'Lớp'`). Chữ của **dự án mẫu** (`'Sản phẩm nổi bật'`, `'Welcome'`) không phụ thuộc ngôn ngữ, giữ nguyên.

1. `e2e/support/ui-text.ts`: hàm `ui(key)` đọc `packages/studio/src/i18n/locales/<lang>/common.json` theo `test.info().project.use.locale` (`vi-VN` → `vi`, còn lại `en`), trả câu của khóa (ví dụ `ui('noProject.title')`). Khóa sai thì ném lỗi rõ ràng. Kiểu khóa: chuỗi đường dẫn có dấu chấm; không ép kiểu `as`, đi bằng kiểm tra `typeof` từng cấp.
2. Đổi mọi selector dùng chữ giao diện Studio trong `e2e/*.e2e.ts` sang `ui('…')` (hoặc `data-testid` sẵn có). Không đổi bước, không đổi assertion.
3. `playwright.config.js`: thêm 3 project `chromium-en`, `firefox-en`, `webkit-en` (thiết bị như 3 project hiện có, `locale: 'en-US'`), chỉ chạy test có tag AC: `grep: /\[AC-/`. Giữ `grepInvert`/`grep` của `@network` đang có (test AC-01 `@network` chạy cả `vi` và `en` khi `RC_E2E_NETWORK=1`).
4. `pnpm test:e2e`: 51 test `vi` + các test AC × 3 trình duyệt `en`, tất cả xanh. Ghi tổng số mới.

---

## Phần B: trace Phase 1 (G1-01, SPEC-06 mục 6)

1. Đổi `scripts/trace-scope.json` `"currentPhase": 1`.
2. `pnpm trace` sẽ liệt kê **96 mã** Phase 1 chưa có test (R-BR, R-FW, R-HI, R-IN, R-PJ, R-QA, R-RN, R-SE, R-SL, R-TW, R-TX, S-xx, V-xx). Với **từng** mã, đọc quy tắc trong `docs/spec.md` rồi làm một trong ba việc:
   - **(a) Đã có test kiểm đúng quy tắc** → gắn tag vào tên test đó.
   - **(b) Code đã làm nhưng chưa có test** → viết test (unit, hoặc E2E nếu quy tắc là hành vi giao diện/trình duyệt), gắn tag.
   - **(c) Code chưa làm hoặc làm khác spec** → nếu sửa được ≤ 50 dòng trong đúng module thì làm và viết test; lớn hơn thì **không làm**, thêm một dòng vào `docs/construction/spec-log.md` (mã, lệch gì, đề xuất) và ghi vào bảng báo cáo.
3. Nếu sau khi xử lý hết vẫn còn mã thuộc loại (c) chưa làm: `pnpm trace` sẽ đỏ. Khi đó **không** đổi `trace-scope.json` để lách; báo danh sách (c) để chủ dự án quyết định.
4. Báo cáo phần B là bảng 96 dòng: `mã | a/b/c | file test (hoặc dòng spec-log)`.

---

## Phần C: VG-15 và VG-16

- **VG-15** cần dự án mẫu thứ hai **Vite 7 + React 18 + JS** (`fixtures/projects/vite7-react18-js/`, làm theo cấu trúc `vite8-react19-ts`: trang Home có heading, một component, Tailwind 4) và chạy E2E AC-02, AC-03 trên nó ở 3 trình duyệt.
  - Bản sao fixture hiện liên kết `node_modules` tới gói của repo (`e2e/support/copy-fixture.ts`), mà repo dùng Vite 8/React 19. Fixture Vite 7/React 18 cần dependency riêng. **Chỉ làm tiếp nếu prompt của chủ dự án ghi "được thêm dependency cho fixture vite7"**; nếu không thì dừng ở đầu phần C và đề xuất cách làm (gói nào, phiên bản nào, đặt ở đâu, ảnh hưởng thời gian E2E).
- **VG-16**: chạy `node scripts/vg/vg-16.mjs` (có sẵn). Đạt thì ghi kết quả; không đạt thì báo nguyên văn lỗi, không sửa mã nguồn Source Editor trong lượt này.
- Cập nhật cột trạng thái của `| VG-15 |`, `| VG-16 |` **không** làm trong `docs/spec.md`; ghi kết quả vào `docs/construction/spec-log.md`.

---

## Phần D: đo hiệu năng PB-01 đến PB-05 (G1-03)

Theo bảng "cách đo" trong spec (tìm dòng thứ hai của `| PB-01 |`):

1. PB-01, PB-02: Playwright `@perf` trong `e2e/perf/` (script `bench:ui` đã có trong `package.json`), Chromium, P95. PB-01 cần trang 2.000 phần tử: thêm trang vào fixture TS (route riêng, không đổi trang Home).
2. PB-03: `vitest bench` cho `setClassName`, `setText` trên file 2.000 dòng.
3. PB-04: test integration đo `starting` → `ready` của runner trên fixture đã cài.
4. PB-05: script `scripts/bench-startup.mjs` đo CLI (bản build) tới `GET /session` 200.
5. Mỗi bài in con số đo và chỉ tiêu; bài vượt chỉ tiêu thì **không** nới chỉ tiêu, ghi vào spec-log và báo.
6. Bài `@perf` không chạy trong `pnpm test:e2e` mặc định (thêm `@perf` vào `grepInvert` giống `@network`).

---

## Mẫu báo cáo

1. Phần nào xong, phần nào dừng (và vì sao).
2. Danh sách file tạo/sửa (đường dẫn, số dòng thêm/bớt), theo phần.
3. Nguyên văn dòng tổng của `pnpm verify`, `pnpm test:e2e`, `pnpm test:e2e:network`, `pnpm trace`.
4. Bảng 96 mã của phần B.
5. Kết quả VG-16 và các số đo PB (đo được / chỉ tiêu / đạt hay không).
6. Không commit.
