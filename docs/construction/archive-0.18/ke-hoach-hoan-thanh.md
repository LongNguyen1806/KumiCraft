# Kế hoạch hoàn thành KumiCraft (bàn giao cho người thực hiện tiếp theo)

Lập: 2026-10-12 · Người lập: Claude · Người nhận: Gemini (làm theo từng bước), sau đó Claude kiểm tra và sửa lỗi.

Bản giao việc chi tiết từng phần: [giao-viec/](giao-viec/README.md) (Claude soạn khi tới lượt từng bước).

Tài liệu gốc để tra cứu: [spec.md](../spec.md) (SPEC-07 mục 5 đến 9 là danh sách WP và cổng), [progress.md](progress.md), [spec-log.md](spec-log.md), [modules.md](modules.md).

---

## 0. Quy tắc bắt buộc (đọc trước khi làm bất kỳ bước nào)

> **Từ 2026-10-13 áp dụng Quy trình v3** (Claude viết test trước, Gemini làm cho xanh, quy tắc dừng sau 3 lần sửa) và lộ trình chia nhỏ ở [giao-viec/README.md](giao-viec/README.md). **Từ 2026-10-12 có quy trình rút gọn** ở [giao-viec/README.md](giao-viec/README.md) mục "Quy trình rút gọn". Nếu mâu thuẫn với các điều 5, 6, 11, 12 bên dưới thì theo quy trình rút gọn. Kiểm thử không bị giảm.

1. **Không commit, không tạo nhánh, không ghi vào `.git`.** Chủ sản phẩm tự commit theo lô. Cuối mỗi bước, đưa ra danh sách lệnh `git add` / `git commit` gợi ý. Đọc Git chỉ dùng `git --no-optional-locks`.
2. **Thông điệp commit gợi ý**: tiếng Anh, dạng `type(scope): mô tả`, tiêu đề tối đa 72 ký tự (nên ≤ 60), không có dòng ghi công AI (CW-45). Chạy thử bằng commitlint trước khi đưa cho chủ sản phẩm.
3. **Trả lời chủ sản phẩm bằng tiếng Việt**; code, tên biến, thông điệp commit giữ tiếng Anh.
4. **Báo cáo ngắn**: tổng trước, rồi danh sách đánh số, mỗi mục một dòng. Khi cần hỏi chủ sản phẩm, giải thích từng lựa chọn dưới góc nhìn người dùng ứng dụng (chọn A thì người dùng thấy gì, chọn B thì thấy gì, chi phí, đề xuất của bạn).
5. **Spec là kim chỉ nam, không phải luật.** Khi lệch hoặc thiếu, ghi vào [spec-log.md](spec-log.md) (số thứ tự tiếp theo sau #94). Lỗi quan trọng thì sửa ngay vào `docs/spec.md`.
6. **Làm từng phần nhỏ, mỗi bộ thay đổi thuộc đúng một module.** Báo trước phần đang làm. Làm xong một bước, dừng để chủ sản phẩm xem và commit.
7. **Lint bắt buộc** (`pnpm lint` phải 0 lỗi):
   - QC-40: cấm literal `null` (dùng `undefined`, hoặc `?? undefined` khi nhận `null` từ DOM/JSON).
   - QC-42: cấm chuỗi `.then`; dùng `async/await`.
   - Chỉ `export` có tên; `export default` chỉ cho file config.
   - Mỗi hàm tối đa 50 dòng.
   - Studio: cấm chuỗi chữ trực tiếp trong JSX (i18next no-literal-string). Mọi chữ hiển thị qua `t('...')`, thêm khóa vào **cả hai** `packages/studio/src/i18n/locales/vi/common.json` và `en/common.json`; chạy `pnpm check:i18n`.
   - Import `.ts`/`.tsx` có đuôi file (ESM); đúng thứ tự import (eslint tự sửa bằng `pnpm lint --fix`).
8. **Test gắn mã quy tắc** (QC-93): tên test chứa mã trong ngoặc vuông, ví dụ `it('... [R-SH-03]', ...)`. `pnpm trace` phải 100% cho phạm vi WP đang làm.
9. **Test không bao giờ đụng cấu hình thật của người dùng** (`%APPDATA%\kumicraft-nodejs`). Dùng biến `KUMICRAFT_CONFIG_DIR` hoặc thư mục tạm.
10. **Giữ nguyên**: `babel-plugin-react-compiler` (đừng gỡ); email trong `SECURITY.md` (bỏ qua).
11. **Kiểm tra cuối mỗi bước**: `pnpm verify` phải xanh (lint, typecheck, format, check:i18n, unit test, trace, build). Bước có giao diện thì thêm `pnpm test:e2e` (Chromium, Firefox, WebKit). Bước có hiệu năng thì thêm `pnpm bench`.
12. **Sau mỗi bước**: cập nhật [progress.md](progress.md) (bảng WP và ngày cập nhật), [modules.md](modules.md) (trạng thái module), thêm báo cáo VG nếu có ở `docs/construction/vg/`.
13. **Chạy được trên Windows và macOS** (người dùng dev dùng cả hai). Phím tắt dùng `app/platform.ts` (Ctrl trên Windows/Linux, Cmd trên macOS). Không viết đường dẫn kiểu một hệ điều hành.
14. **Thư viện**: `@dnd-kit/*` và `@tiptap/*` hiện nằm ở devDependencies của studio. Khi code thật dùng chúng (WP-1.07/1.08), chuyển sang `dependencies`. TipTap phải nạp lười (lazy import) để giữ ngân sách PB-17.

### Hiện trạng cần biết

Đã xong và đã commit (tới `3e64b7b`):

- Phase 0 gần đủ: repo, CI cấu hình sẵn (chưa chạy thật vì chưa có GitHub), 4 package, bảo mật mạng, i18n, hạ tầng test, fixture, spike VG-01/07/09A/10/11/12/13/14.
- Phase 1: WP-1.01 đến WP-1.06 xong (model đầy đủ, operation, migration, Styling Map, server API + Design Store + WebSocket + watcher, Studio Welcome/Editor/Settings/Undo-Redo/tin cậy workspace). E2E luồng chính 12/12 trên 3 trình duyệt.
- WP-1.07 **làm dở**: đã có Canvas Renderer 25 loại node trong iframe (commit `3e64b7b`), chuyển đổi text runs ↔ TipTap (`rich-text/`).
- Kiểm tra gần nhất (2026-10-12): lint sạch, typecheck sạch, 365/366 test xanh. Test duy nhất đỏ là `packages/model/src/operations/engine.property.test.ts` ("undoing a whole batch restores the document") do hết 5 giây khi cả bộ chạy song song; chạy riêng thì qua (lỗi mức nhẹ: máy chậm, không phải lỗi logic).

Việc chờ chủ sản phẩm: (1) duyệt Spec để đóng `G0` chính thức; (2) gõ thử Unikey/EVKey thật bằng `node scripts/vg/vg-14-manual.mjs`; (3) quyết định Q-01 (tên package npm) trước `G1`.

---

## BƯỚC 0 — Dọn nền (nhỏ, làm trước)

**Việc cần làm**

1. Sửa test property hết giờ: đặt timeout rõ cho test đó (tham số thứ ba của `it`, ví dụ 30 000 ms) hoặc giảm `numRuns`; không giảm độ phủ loại operation.
2. `progress.md`: phần "Kiểm tra gần nhất" và "Bước tiếp theo" đang cũ (ghi 236 test, 8 e2e, WP-1.06 chưa xong). Cập nhật theo số thật.
3. `modules.md`: gần như toàn bộ module ghi "Chưa bắt đầu"; cập nhật đúng trạng thái module Phase 0 và 1 đã làm (M-MC, M-TK, M-SM, M-WS, M-DS, M-SH, M-HS xong; M-CV đang làm).
4. `docs/construction/phases/` đang trống: tạo `phase-0.md` (báo cáo phase 0 theo mẫu SPEC-07 mục 19.2) khi chủ sản phẩm duyệt Spec.

**Kiểm tra**: `pnpm verify` xanh 366/366 ở ba lần chạy liên tiếp.

---

## PHASE 1 — STUDIO CORE (mục tiêu: dựng trang tĩnh hoàn chỉnh bằng kéo thả)

### BƯỚC 1 — Hoàn thành WP-1.07: Canvas và Overlay (M-CV, M-OV)

Spec: SPEC-04.1 mục 7, 8; ADR-FE-04 đến 08, 20. Phụ thuộc: WP-1.04, 1.06 (đã xong).

**Việc cần làm**

1. Rà lại phần đã có ở `packages/studio/src/features/canvas/`: xác minh từng việc sau đã có hay còn thiếu rồi làm phần thiếu.
   - Tailwind runtime trong iframe (VG-10 đã chứng minh dùng `@tailwindcss/browser`; Canvas thật phải nạp nó trong iframe, chạy offline, không gọi CDN). Class sinh bởi `toTailwindClasses` phải ra đúng giao diện (VG-09A so khớp với bản build).
   - Zoom: hiện `canvas-area.tsx` dùng CSS `zoom`; VG-11 kiểm chứng kéo thả với `transform: scale`. Chọn một cách, đảm bảo toạ độ overlay đúng ở zoom 50%, 100%, 200%; ghi lựa chọn vào spec-log.
   - Khung (frame) 3 cỡ, chuyển khung đổi giá trị theo phạm vi responsive (desktop-first và mobile-first).
   - Đủ 25 loại node, kể cả `ComponentInstance`, `Slot`, và node dữ liệu (Table, List, Chart...) hiển thị bằng dữ liệu mẫu (sample data).
   - Chế độ không tin cậy (restricted): không chạy gì ngoài hiển thị.
2. **Overlay (M-OV)**: lớp phủ trong suốt trên iframe vẽ khung hover (viền mỏng), khung chọn (viền đậm + tay cầm), nhãn tên node. Hover lệch zoom phải đúng. Chọn bằng click đồng bộ với Layer Tree (store: `selectedIds`), Esc bỏ chọn, click nền chọn root của trang.
3. **Sửa chữ trực tiếp không định dạng** (nhấp đúp vào Text/Heading/Button): sửa tại chỗ bằng `contenteditable` thuần (không TipTap — rich text thuộc WP-2.09), Enter/blur chốt thành một operation `node.update` (một bước Undo), Esc huỷ. Gõ tiếng Việt (Unikey/Telex) không mất ký tự.
4. Hiệu năng: PB-13 (vẽ lại khi đổi 1 node) và PB-16 theo bảng ngân sách trong spec. Thêm bench vào `pnpm bench`.

**Kiểm tra**

- `fixtures/designs/all-nodes.json` hiển thị đúng 25 loại node (test render + ảnh chụp E2E, không lỗi console).
- Test `[R-CV-xx]`, `[R-OV-xx]` cho từng quy tắc của hai module; `pnpm trace` 100% cho phạm vi.
- E2E (3 trình duyệt): hover, chọn, đổi khung, zoom, sửa chữ trực tiếp, Undo 1 bước.
- PB-13, PB-16 đạt (`pnpm bench`). `pnpm verify` xanh.

### BƯỚC 2 — WP-1.08: Kéo thả, Library, Layer Tree (M-DD, M-LB, M-LT)

Spec: SPEC-04.1 mục 9, 10, 12; ADR-FE-09. Phụ thuộc: WP-1.07.

**Việc cần làm**

1. **M-DD**: dựng từ spike VG-11 (`packages/studio/spikes/vg-11/` có `findDropTarget`, `dropStops`, DndContext với PointerSensor + KeyboardSensor). Chuyển thành code thật trong `features/dnd/`: kéo từ Library vào Canvas, kéo di chuyển node trên Canvas, kéo trong Layer Tree; đường chỉ vị trí thả; kéo bằng bàn phím; chặn thả vào nơi không hợp lệ (quy tắc cha-con của model, node bị khoá `locked`); mỗi lần thả sinh một batch operation (một bước Undo).
2. **M-LB**: panel Library trái: nhóm, tìm kiếm, preset (SPEC-04.1 mục 10.2: Thanh điều hướng, Hero, Lưới tự co giãn, Card, Chân trang...). **Bỏ qua preset có tương tác** (làm ở WP-2.08, cờ tính năng). Preset tạo qua `assignIds` để sinh id mới.
3. **M-LT**: cây lớp: mở/đóng, chọn, đổi tên, ẩn/hiện, khoá, kéo sắp xếp, menu chuột phải (nhân bản, xoá, bọc vào Stack). Đồng bộ chọn với Canvas.
4. Chuyển `@dnd-kit/*` sang `dependencies` của studio.

**Kiểm tra**

- AC-02 tự động hoá: kéo preset Hero + Lưới 4 Card vào trang trống, kết quả đúng cây node.
- Kéo thả bằng bàn phím có test; thả sai chỗ bị chặn đúng.
- PB-15 (tính điểm thả ≤ ngân sách), VG-11 vẫn Đạt (`node scripts/vg/vg-11.mjs`).
- E2E 3 trình duyệt (chú ý WebKit headless: cần nhịp chờ giữa các lần kéo như script VG-11). `pnpm verify` xanh.

### BƯỚC 3 — WP-1.09: Inspector (M-IN)

Spec: SPEC-04.1 mục 11. Phụ thuộc: WP-1.07.

**Việc cần làm**

1. Panel Inspector phải: các nhóm thuộc tính theo loại node (layout, kích thước, khoảng cách, chữ, màu/nền, viền/bóng, vị trí...), điều khiển phù hợp (số + đơn vị, chọn token màu, segmented, bật tắt).
2. **Phạm vi responsive và trạng thái**: sửa giá trị ở khung 375 chỉ ghi vào breakpoint đó (override), quay lại 1440 vẫn thấy giá trị gốc; trạng thái hover/focus/active/dark; nút "đặt lại về kế thừa" cho từng thuộc tính; chỉ báo giá trị đang bị override.
3. Mỗi thay đổi = một operation (gộp thay đổi liên tiếp khi kéo thanh trượt thành một bước Undo, dùng `coalesceKey`).
4. **Bỏ qua** mục 11.2 (Tương tác) và nhóm Dữ liệu: chỉ hiển thị chỉ-đọc (CW-19), mở ở WP-2.08, 4.07.
5. Validate theo luật V-xx của model; lỗi hiện tại chỗ, không áp dụng giá trị sai.

**Kiểm tra**

- AC-03 tự động hoá: kịch bản "ở khung 375 đổi padding Card, quay lại 1440 thấy giá trị gốc".
- PB-14 (phản hồi khi đổi thuộc tính) đạt.
- Test `[R-IN-xx]`; E2E 3 trình duyệt; `pnpm verify` xanh.

### BƯỚC 4 — WP-1.10: Clipboard, Phím tắt, Quản lý trang (M-CB, M-KB, M-PG)

Spec: SPEC-04.1 mục 14 đến 16. Phụ thuộc: WP-1.08.

**Việc cần làm**

1. **M-CB**: Copy/Cut/Paste/Duplicate node (kể cả giữa các trang), Paste đúng vị trí cha đang chọn, cấp lại id (`assignIds`); dán nội dung văn bản ngoài vào Text.
2. **M-KB**: bảng phím tắt theo SPEC-04.1 mục 15 (chọn, xoá, nhân bản, nhóm, di chuyển bằng mũi tên, zoom, ẩn/hiện panel...). Mở rộng `use-editor-shortcuts.ts` hiện có; Windows dùng Ctrl, macOS dùng Cmd (xem `shortcutFor`, `shortcutLabel`); không giành các phím mà trình duyệt giữ trên macOS (Cmd+[ , Cmd+] , Cmd+Y). Phím tắt không kích hoạt khi đang gõ trong ô nhập.
3. **M-PG**: thêm, đổi tên, nhân bản, xoá, sắp xếp trang; mỗi trang có `route` (ví dụ "Giới thiệu" → `/gioi-thieu`, tự bỏ dấu); không cho xoá trang cuối; Undo được.

**Kiểm tra**

- Phím tắt SPEC-04.1 mục 15 hoạt động trên Windows và macOS (test đơn vị cho cả hai nền, E2E trên máy hiện có).
- Test `[R-CB-xx]`, `[R-KB-xx]`, `[R-PG-xx]`; `pnpm verify` xanh.

### BƯỚC 5 — WP-1.11: CLI hoàn chỉnh

Spec: ADR-BE-03, 25. Phụ thuộc: WP-1.05.

**Việc cần làm**

1. Mọi tham số của ADR-BE-03 (`--port`, `--host` giữ 127.0.0.1, `--no-open`, `--log-level`, `--config-dir`...), `--help`, `--version` có thông báo rõ ràng, mã thoát đúng.
2. Xử lý khoá E018 (workspace đang mở ở tiến trình khác) kèm báo cổng của phiên cũ.
3. Tắt an toàn: Ctrl+C / SIGTERM lưu nốt thay đổi chờ ghi rồi mới thoát (kiểm bằng test kill).
4. Đóng gói: `pnpm package` ra tarball; `npx ./kumicraft-<ver>.tgz` chạy được trong thư mục trống. Script `scripts/smoke` đã có, mở rộng cho tarball.

**Kiểm tra**

- Chạy tarball trong thư mục trống trên Windows và macOS (Ubuntu qua CI khi có GitHub). PB-10 (khởi động) đạt.
- Test kill 20 lần giữa lúc thao tác: mất tối đa 2 giây thao tác (NFR-06).
- `pnpm verify` xanh.

### BƯỚC 6 — Cổng G1 (đóng Phase 1)

Tiêu chí: SPEC-07 mục 5.3 (G1-01 đến G1-09).

**Việc cần làm**

1. G1-01: E2E AC-01, AC-02, AC-03 trên 3 trình duyệt, `vi` và `en`; chạy trên Windows, macOS (chủ sản phẩm chạy tay), Ubuntu (CI).
2. G1-02: rà SPEC-04.1 mục 17.1, mọi test bắt buộc phải có.
3. G1-03: PB-01 đến PB-04, PB-10, PB-11, PB-13 đến PB-19 đạt; cần workflow `nightly` chạy ≥ 3 lần liên tiếp (cần repo GitHub; xem Bước 7).
4. G1-04: VG-07, 10, 11, 13 (B) Đạt; **VG-13 còn thiếu so sánh PB-14 khi bật/tắt React Compiler** — làm nốt.
5. G1-05: sinh `packages/model/schema-v1.json` từ `z.toJSONSchema()`, commit, thêm bước CI so sánh (đổi schema là CI đỏ).
6. G1-06: NFR-06 (kill 20 lần) và NFR-07 (khôi phục file hỏng) có test.
7. G1-07: nhóm "Đường dẫn", "Workspace trust", "Fuzz" của SPEC-05 mục 17.1 cho mọi endpoint hiện có.
8. G1-08: chủ sản phẩm quyết Q-01 (tên package npm).
9. G1-09: SPEC-04.2 phải ở trạng thái Đã duyệt; SPEC-06.2 có bản nháp.
10. Chạy tay kịch bản nghiệm thu G1 (SPEC-07 mục 5.4, 7 bước), quay màn hình.
11. Viết `docs/construction/phases/phase-1.md` (mẫu SPEC-07 mục 19.2), cập nhật Spec/SRS (GC-11).

**Kiểm tra**: toàn bộ G1-01..09 + GC-01..GC-12 (SPEC-07 mục 11.3) đạt; `pnpm audit` không có lỗ hổng high.

### BƯỚC 7 — Đưa lên GitHub để CI chạy thật (làm sớm nhất có thể, trước G1-03)

**Việc cần làm** (chủ sản phẩm thực hiện bước tạo repo; người thực hiện chuẩn bị):

1. Chủ sản phẩm tạo repo GitHub và `git push`. Người thực hiện **không** push.
2. Xác nhận workflow trong `.github/workflows/` chạy trên Ubuntu, Windows, macOS; sửa lỗi riêng từng nền (đường dẫn, phím tắt, WebKit).
3. Bật workflow `nightly` cho bench. Ghi 3 lần xanh liên tiếp vào báo cáo phase.

**Kiểm tra**: CI xanh 5 lần liên tiếp trên `main` (GC-02).

---

## PHASE 2 — XUẤT CODE VÀ TƯƠNG TÁC (mục tiêu: trang trong Studio chạy được trong project thật)

DR-02 của SPEC-07: mọi VG phụ thuộc phải Đạt giai đoạn A trước. Phase 2 chỉ bắt đầu sau `G1`.

### BƯỚC 8 — WP-2.00: Spike VG-02, VG-03 (A), VG-08

**Việc cần làm**: viết script trong `scripts/vg/`: VG-02 (Prettier format ổn định, cấu hình theo project đích), VG-03 (code mẫu viết tay theo SPEC-04.2 biên dịch được trong cả 2 project mẫu), VG-08 (`tsc --noEmit` trên code xuất).

**Kiểm tra**: ba báo cáo `docs/construction/vg/vg-02.md`, `vg-03.md`, `vg-08.md` kết luận Đạt kèm số đo.

### BƯỚC 9 — WP-2.01: Target Project Analyzer và Template (M-TP, M-PT)

**Việc cần làm**: endpoint `/target-project/*`; phát hiện project (Vite/React, Tailwind v3 hay v4, TS/JS, package manager, alias, thư mục `src`); trả E001 kèm `reasons` khi không hỗ trợ; tạo project mới từ `templates/` (Vite 8 + React 19 + Tailwind 4). UI chọn/tạo Target Project trong Studio.

**Kiểm tra**: nhận đúng 2 project mẫu và 4 project không hỗ trợ; test `[R-TP-xx]`, `[R-PT-xx]`.

### BƯỚC 10 — WP-2.02: Code Generator lõi (M-CG)

**Việc cần làm**: IR (biểu diễn trung gian), lowering từ document sang IR, emitter React (SPEC-04.2 mục 5, 6.1–6.6, 6.8), sinh User Component (6.3), format bằng Prettier (mục 7).

**Kiểm tra**: golden file cho từng loại node; R-CG-01 (cùng đầu vào ra cùng byte); PB-06, PB-07 đạt.

### BƯỚC 11 — WP-2.03: Theme và chế độ tối (M-CG)

**Việc cần làm**: sinh `theme.css` (Tailwind v4) và `tailwind.config` (v3) từ token; chế độ tối; chỉnh sửa hỗ trợ.

**Kiểm tra**: đúng cho cả hai bản Tailwind (golden test trên 2 project mẫu).

### BƯỚC 12 — WP-2.04: Xuất HTML/CSS (M-HT)

**Việc cần làm**: xuất trang tĩnh `index.html` + CSS, không phụ thuộc framework (SPEC-04.2 mục 9).

**Kiểm tra**: AC-10 (mở bằng trình duyệt, đúng bố cục, so ảnh với Canvas).

### BƯỚC 13 — WP-2.05: Kiểm tra code xuất ra (M-VL)

**Việc cần làm**: T1 (kiểm cú pháp/AST), T2 (worker: `tsc`/lint), T3 (tiến trình con: build thật), có giới hạn thời gian/bộ nhớ, thoát sạch tiến trình con (SPEC-05 mục 10).

**Kiểm tra**: PB-09, PB-12; nhóm "Tiến trình con" SPEC-05 mục 17.1.

### BƯỚC 14 — WP-2.06: Export Manager (M-EX)

**Việc cần làm**: kế hoạch xuất, diff, ghi theo transaction (tất cả hoặc không), manifest, phát hiện xung đột với file người dùng sửa tay, trạng thái `orphaned`, danh sách bước thủ công (ADR-BE-17, 18).

**Kiểm tra**: AC-11; VG-01 (B) trên transaction thật; fault injection qua `FileSystemPort` 50 lần (NFR-09).

### BƯỚC 15 — WP-2.07: Màn hình Export (M-XU)

**Việc cần làm**: màn hình Export, diff bằng CodeMirror, duyệt từng file, chọn cách xử lý xung đột, huỷ.

**Kiểm tra**: E2E xuất, duyệt từng file, huỷ (3 trình duyệt, vi/en); ảnh chụp VG-12 không tràn chữ.

### BƯỚC 16 — WP-2.08: Tương tác và Xem thử

**Việc cần làm**: Inspector mục 11.2 (hành động: mở Modal, đóng, toast, điều hướng, gửi form...), R-LT-08, R-LT-09, preset có tương tác (Modal, Tabs, Accordion...), chế độ Xem thử (SPEC-04.1 mục 7.7) chạy thật trong iframe, sinh code tương tác (SPEC-04.2 mục 6.7, R-HT-04). Bỏ cờ tính năng tương ứng.

**Kiểm tra**: AC-14 (nút "Thêm mới" mở Modal chứa form, gửi thành công đóng Modal, hiện toast; kiểm ở 375 và 1440).

### BƯỚC 17 — WP-2.09: Rich text, chế độ tối, ràng buộc nhập liệu

**Việc cần làm**: thanh định dạng rich text dùng TipTap lazy-load (extensions và `runs.ts` đã có), chế độ tối (cài đặt, nút xem sáng/tối), ràng buộc nhập liệu ở Inspector và codegen. Chuyển `@tiptap/*` sang `dependencies`.

**Kiểm tra**: AC-15; VG-14 (B) có gõ thử Telex thật (chủ sản phẩm).

### BƯỚC 18 — WP-2.10: Project JavaScript và monorepo

**Việc cần làm**: xuất JS (không TS), monorepo (R-TP-04); thêm fixture `vite8-react19-js`, `monorepo-pnpm`.

**Kiểm tra**: xuất và build đạt trên hai fixture mới.

### BƯỚC 19 — WP-2.11: Bảo mật code xuất ra

**Việc cần làm**: SPEC-05 mục 12 (thoát chuỗi, chặn URL `javascript:`, không nhúng secret, không import `kumicraft`).

**Kiểm tra**: nhóm "Code xuất ra" SPEC-05 mục 17.1; NFR-12, NFR-13.

### BƯỚC 20 — WP-2.12: CI `export-compat` và harness VG-09

**Việc cần làm**: job CI chạy VG-03 ở mọi PR; harness VG-09 trong `scripts/vg/`.

**Kiểm tra**: job chạy ở mọi PR.

### BƯỚC 21 — Cổng G2

Tiêu chí G2-01..07 (SPEC-07 mục 6.3): AC-08 (phần giao diện), 09, 10, 11, 14, 15; VG-01(B), 02, 03(B), 08, 09(B), 14(B); PB-06..09, 12; NFR-09, 12, 13; nhóm "Code xuất ra", "Tiến trình con". Chạy tay kịch bản nghiệm thu G2 (6 bước, mục 6.4) trên Windows và macOS. Viết `phase-2.md`. SPEC-04.3 phải Đã duyệt, SPEC-06.3 có bản nháp.

---

## PHASE 3 — AI

### BƯỚC 22 — WP-3.00: Spike VG-06 (A)

Script dùng AI SDK, structured output với schema operation thật, bộ 50 yêu cầu, chạy với 4 provider (OpenAI, Anthropic, Google, Ollama); chọn model Ollama khuyến nghị (trả lời Q-04).

**Kiểm tra**: báo cáo Đạt.

### BƯỚC 23 — WP-3.01: AI Provider Gateway (M-AG)

Lưu API key **ngoài workspace** (cấu hình người dùng), kiểm tra Ollama chạy cục bộ, màn hình cấu hình AI.

**Kiểm tra**: test chứng minh key không bao giờ xuống trình duyệt.

### BƯỚC 24 — WP-3.02: AI Context Builder mức 0–2 (M-AC)

Xây ngữ cảnh gửi AI theo mức, xem trước ngữ cảnh, xác nhận lần đầu gửi ra ngoài.

**Kiểm tra**: golden ngữ cảnh; bộ 40 yêu cầu chọn đúng mức.

### BƯỚC 25 — WP-3.03: Prompt và hợp đồng đầu ra (M-AP)

Prompt có phiên bản, danh mục node sinh từ schema, hợp đồng đầu ra.

**Kiểm tra**: danh mục trong prompt khớp `z.toJSONSchema()`.

### BƯỚC 26 — WP-3.04: Kiểm tra và sửa đề xuất (M-AV)

Validate đề xuất qua đúng engine của thao tác tay, tự sửa, thử lại 1 lần, `outOfScope`.

**Kiểm tra**: bộ 30 đầu ra lỗi cố ý ra đúng kết quả.

### BƯỚC 27 — WP-3.05: AI Panel (M-AU)

Panel AI, xem trước đề xuất trên Canvas, chấp nhận/từ chối/sửa tiếp, trạng thái `stale` khi tài liệu đổi.

**Kiểm tra**: AC-06 (E2E với phản hồi ghi sẵn).

### BƯỚC 28 — WP-3.06: Responsive Audit (M-AR)

Chế độ `optimizeResponsive`, audit các vấn đề responsive.

**Kiểm tra**: trang mẫu có 7 vấn đề, RA đo đúng.

### BƯỚC 29 — WP-3.07: Phản hồi AI ghi sẵn cho CI

Bộ phản hồi ghi sẵn (ADR-BE-26), harness VG-06 trong `scripts/vg/`.

**Kiểm tra**: CI không gọi provider thật.

### BƯỚC 30 — Cổng G3

G3-01..07 (SPEC-07 mục 7.3): AC-06, AC-07 (phần không dữ liệu); VG-06 (B); NFR-08 (provider lỗi/treo/hết hạn mức mà thiết kế và xuất code vẫn chạy); NFR-16; nhóm "AI" và không lọt chuỗi `RC_SECRET_MARKER_*`; chủ sản phẩm thử 10 yêu cầu ngẫu nhiên với mỗi provider thật và ghi kết quả. Kịch bản nghiệm thu mục 7.4. Viết `phase-3.md`.

---

## PHASE 4 — NGỮ CẢNH BACKEND (backend luôn chỉ đọc)

### BƯỚC 31 — WP-4.00: Fixture backend và spike VG-04, VG-05

Fixture `express/`, `nestjs-prisma/`, `django/`, `openapi/` (bộ VG-04), `secrets/` (chuỗi `RC_SECRET_MARKER_*`).

**Kiểm tra**: báo cáo VG-04 (OpenAPI), VG-05 (tree-sitter Django) Đạt.

### BƯỚC 32 — WP-4.01: Backend Scanner (M-BS)

Quét backend, lọc secrets (không đọc `.env`), job và endpoint quét.

**Kiểm tra**: PB-05; nhóm "Secrets".

### BƯỚC 33 — WP-4.02: Trích xuất OpenAPI (M-XO)

**Kiểm tra**: bộ VG-04 trích đúng 100%.

### BƯỚC 34 — WP-4.03: Trích xuất JS/TS (M-XJ)

**Kiểm tra**: AC-04 với Express.

### BƯỚC 35 — WP-4.04: Trích xuất Django/DRF (M-XP)

**Kiểm tra**: AC-04 với Django.

### BƯỚC 36 — WP-4.05: Trích xuất bằng AI (M-XA)

**Kiểm tra**: backend không hỗ trợ (fixture Fastify) trích qua phản hồi ghi sẵn.

### BƯỚC 37 — WP-4.06: Data Source Catalog (M-DC)

Catalog nguồn dữ liệu, duyệt, sửa, `stale`.

**Kiểm tra**: quét lại sau khi đổi backend đánh dấu đúng `stale`.

### BƯỚC 38 — WP-4.07: Gắn dữ liệu và dữ liệu mẫu (M-DB, M-MK)

Inspector nhóm Dữ liệu, gắn Table/List/Form với nguồn, sinh dữ liệu mẫu đúng kiểu và đúng tiếng Việt.

**Kiểm tra**: AC-05.

### BƯỚC 39 — WP-4.08: Hành động dữ liệu của tương tác

`refreshData`, `deleteRecord`, sau khi gửi form; 4 trạng thái dữ liệu (tải, rỗng, lỗi, có dữ liệu) trong Xem thử.

**Kiểm tra**: kịch bản xoá bản ghi trong Xem thử với dữ liệu mẫu.

### BƯỚC 40 — WP-4.09: Proxy chỉ đọc (M-LP)

Dữ liệu thật trong Xem thử qua proxy chỉ cho phép GET.

**Kiểm tra**: nhóm "Proxy" SPEC-05 mục 17.1; không có request ghi nào.

### BƯỚC 41 — WP-4.10: Sinh lớp dữ liệu (M-DL)

Kiểu entity, client, auth, hook (có và không có react-query).

**Kiểm tra**: AC-08 đầy đủ — trang xuất ra gọi đúng API của fixture Express đang chạy.

### BƯỚC 42 — WP-4.11: AI ngữ cảnh mức 3

AI dựng trang có dữ liệu thật của backend.

**Kiểm tra**: AC-07 (không bịa field).

### BƯỚC 43 — Cổng G4

G4-01..06 (SPEC-07 mục 8.3): AC-04, 05, 07, 08, 13; VG-03(B đầy đủ), 04, 05, 06(B nhóm có dữ liệu), 09(B); PB-05; R-BS-01 (không ghi, không tạo file, không chạy tiến trình trong thư mục backend suốt E2E, theo dõi bằng watcher); nhóm "Secrets", "Proxy". Kịch bản nghiệm thu mục 8.4 (Express và Django). Viết `phase-4.md`.

---

## PHASE 5 — NÂNG CAO VÀ PHÁT HÀNH 1.0

### BƯỚC 44 — WP-5.01, 5.02: User Component (M-UC)

Tạo component từ vùng chọn, chế độ sửa, `propRef`, dùng lại; đổi props/slot với instance, tách, nhân bản, xoá.

**Kiểm tra**: AC-12; property test "tạo rồi tách" trả về cây tương đương.

### BƯỚC 45 — WP-5.03, 5.04: Design Token (M-TM, M-TI)

Panel token, đổi tên, thay thế, kiểm tra tương phản, kiểu chữ mẫu; nhập token từ Tailwind v3/v4.

**Kiểm tra**: E2E đổi `primary` đổi mọi nơi, cả code xuất; nhập đúng từ 2 project mẫu.

### BƯỚC 46 — WP-5.05: Xem song song nhiều khung

**Kiểm tra**: sửa ở một khung, 3 khung cập nhật; PB-14 giữ nguyên.

### BƯỚC 47 — WP-5.06: Gợi ý tách layout dùng chung (M-LS)

**Kiểm tra**: AC-16; PB-20.

### BƯỚC 48 — WP-5.07: Hoàn thiện phát hành

Tài liệu người dùng `vi`, `en` (README, hướng dẫn bắt đầu, cấu hình AI, giới hạn đã biết), kiểm tra giấy phép phụ thuộc, kiểm tra trên máy sạch (SPEC-07 mục 17.3).

**Kiểm tra**: danh sách mục 17.3 đạt.

### BƯỚC 49 — Cổng G5 (phát hành 1.0)

G5-01..08 (SPEC-07 mục 9.3): toàn bộ AC-01..16 tự động trên Windows và Ubuntu, vi và en; toàn bộ VG-01..14 Đạt; PB-01..20 đạt 3 lần nightly liên tiếp; NFR-01..17 có bằng chứng; SPEC-05 mục 17.1 đạt toàn bộ; không còn câu hỏi mở; không còn cờ tính năng (`RELEASED_PHASE = 5`); danh sách phát hành đạt. Kịch bản nghiệm thu mục 9.4 trên máy sạch Windows, macOS, Ubuntu. Viết `phase-5.md`, cập nhật Spec/SRS.

---

## Phụ lục — Mỗi bước, người thực hiện báo lại theo mẫu này

1. Tổng: đã xong / chưa xong, `pnpm verify` (số test), E2E (số), bench nếu có.
2. Danh sách đánh số, mỗi mục một dòng: việc đã làm.
3. Điểm lệch so với Spec đã ghi vào spec-log (số #).
4. Lệnh `git add` / `git commit -m "..."` gợi ý (đã qua commitlint, không dòng ghi công AI).
5. Việc cần chủ sản phẩm quyết định hoặc thử tay (nếu có).
