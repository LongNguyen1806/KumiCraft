# Giao việc cho AI thực hiện (Gemini)

Cách dùng: chủ sản phẩm đưa **một** file `buoc-XX-*.md` cho AI thực hiện, kèm câu: "Đọc `docs/construction/ke-hoach-hoan-thanh.md` mục 0 (quy tắc bắt buộc) rồi làm đúng bản giao việc này. Không làm gì ngoài phạm vi." Khi AI báo xong, chủ sản phẩm đưa kết quả lại cho Claude để kiểm tra và sửa lỗi.

Thứ tự: [bước 0](buoc-00-don-nen.md), 1A, 1B, 1C, 1D (xong, WP-1.07 đã đóng) → **[Bước 2: WP-1.08](buoc-02-keo-tha-library-layer.md)** → các WP sau, mỗi WP một lần giao và một lần kiểm (xem [ke-hoach-hoan-thanh.md](../ke-hoach-hoan-thanh.md)).

## Quy trình rút gọn (hiệu lực từ 2026-10-12, ưu tiên hơn mọi chỗ khác nếu mâu thuẫn)

Mục tiêu: xong Phase 1 nhanh. **Kiểm thử giữ nguyên độ kỹ**; bỏ phần giấy tờ không làm sản phẩm tốt hơn.

Đã bỏ hoặc giảm:

1. **Không xin phép** cho việc nằm trong phạm vi bản giao việc: sửa lint, sửa lỗi kiểu, sửa test sai, tách hàm, đổi tên. Cứ làm, ghi vào báo cáo. Chỉ dừng hỏi khi cần sửa ngoài phạm vi, thêm thư viện, hoặc đổi hành vi người dùng thấy.
2. **Không cập nhật `progress.md`, `modules.md` sau từng bước.** Chỉ cập nhật một lần khi đóng cả WP.
3. **Không viết báo cáo WP (`wp/wp-x.md`) và không viết báo cáo phase** cho đến cổng G1; ghi số đo vào báo cáo cuối mỗi lần giao là đủ.
4. **`spec-log.md`: chỉ ghi khi lệch spec thật** (đổi hành vi, thêm/bớt so với spec), không ghi chi tiết kỹ thuật nội bộ.
5. **Commit: gom theo WP**, tối đa 2 đến 3 commit mỗi lần giao (ví dụ: code, test/E2E, docs). Chạy commitlint một lần cho cả lô.
6. **Báo cáo ngắn**: 5 dòng đủ (kết quả lệnh kiểm tra, việc đã làm, việc chưa làm, rủi ro, lệnh commit).
7. **Trong lúc làm**, chỉ chạy lệnh nhanh cho phần đang sửa: `pnpm lint`, `pnpm typecheck`, test của file đó (`pnpm exec vitest run <file>`), E2E của file mới trên Chromium. **Cuối mỗi lần giao** mới chạy đủ `pnpm verify` + `pnpm test:e2e` (3 trình duyệt).
8. Bench PB-xx và ảnh chụp VG-12: chỉ làm ở bản giao việc có ghi rõ (1D, cổng G1), không làm cho mọi bước.

**Giữ nguyên, không được bớt:**

- Test cho nhiều tình huống: đường chạy đúng, dữ liệu rỗng/lớn, biên, lỗi, Undo/Redo, hai hệ điều hành (phím tắt), `vi` và `en`; property test ở model.
- Test gắn mã quy tắc `[R-xx]`, `pnpm trace` 100% cho phạm vi.
- E2E 3 trình duyệt trước khi báo xong mỗi lần giao.
- Lint, typecheck sạch; cấm `eslint-disable`, `@ts-ignore`, `as any`, nới ngưỡng, bỏ test.
- Claude **tự chạy** lệnh kiểm tra và đọc diff trước khi cho commit hoặc giao việc tiếp.

## Quy ước chung cho mọi bản giao việc

- **Phần tử trong iframe là của "vũ trụ" JavaScript khác.** Không dùng `x instanceof HTMLElement` / `HTMLStyleElement` / `Element` của trang cha với phần tử lấy từ iframe: luôn `false` trên trình duyệt thật (jsdom không tái hiện được). Dùng `iframeDocument.defaultView?.Element`, hoặc `querySelector<T>()`, hoặc `closest`/`matches` sau khi kiểm tra bằng cách khác. Lỗi này đã làm hỏng khối theme và chặn link ở 1A.
- **Store: node không đổi phải giữ nguyên object** (đã làm trong `editor-store.ts`, `reuseUnchanged`). Component đọc store phải dùng selector hẹp (`s.flatNodes[id]`, `s.document?.tokens`); **cấm** `useEditorStore((s) => s.document)` trong component vẽ node, vì mỗi thao tác sẽ vẽ lại mọi node (R-CV-05).
- **Giới hạn hiện tại của Studio:** chưa nhận thay đổi tài liệu do client khác gửi lên server (chỉ có một Studio). E2E không được dựa vào việc gọi API từ ngoài để đổi tài liệu rồi chờ giao diện tự cập nhật; muốn đổi tài liệu trong E2E thì phải thao tác qua giao diện hoặc tạo sẵn file trước khi mở Studio.
- **E2E trên Canvas phải mở Studio bằng `openCanvasStudio` (`e2e/support/canvas-studio.ts`)**: nó trả lời hộp thoại tin cậy và chờ Tailwind áp style xong (`data-rc-styled`). Đo vị trí rồi bấm trước lúc đó sẽ bấm trượt.
- **Bài đo hiệu năng chạy 1 luồng** (`pnpm bench:ui`); E2E thường chạy 4 luồng (đặt trong `playwright.config.js`).
- **E2E không dùng vòng lặp `await` từng phần tử** (chậm, quá giờ khi 3 trình duyệt chạy song song). Gom bằng một lần `evaluateAll`.

- Chỉ sửa file thuộc phạm vi ghi ở mục "Phạm vi". Cần sửa ngoài phạm vi thì **dừng và báo**, không tự làm.
- Không thêm thư viện mới nếu bản giao việc không cho phép.
- Không được "làm cho test qua" bằng cách nới ngưỡng, bỏ test, `skip`, `eslint-disable`, `@ts-ignore`, `as any`. Gặp vướng thì báo.
- Không sửa `docs/spec.md` trừ khi bản giao việc nói rõ; chỗ lệch ghi vào `docs/construction/spec-log.md`.
- Xong phải chạy đúng các lệnh ở mục "Kiểm tra" và dán kết quả thật (số test, mã thoát), không tóm tắt chung chung.

## Mẫu báo cáo khi xong (AI thực hiện điền)

```
BƯỚC: <mã>
1. Tổng: <xong / chưa xong>; pnpm verify: <số test xanh/tổng, mã thoát>; E2E: <số>; bench: <số đo>
2. Đã làm: (mỗi việc một dòng, kèm đường dẫn file)
3. Chưa làm / bỏ qua và lý do:
4. Lệch so với Spec (số # trong spec-log):
5. Rủi ro hoặc điều Claude nên soi kỹ:
6. Lệnh commit gợi ý (đã qua commitlint, không dòng ghi công AI):
```
