# Giao việc cho AI thực hiện (Gemini)

Cách dùng: chủ sản phẩm đưa **một** file `buoc-XX-*.md` cho Gemini, kèm câu: "Đọc `docs/construction/giao-viec/README.md` (mục Quy trình v3 và Quy ước chung) rồi làm đúng bản giao việc này." Gemini báo xong thì chủ sản phẩm đưa kết quả lại cho Claude kiểm tra.

Thứ tự còn lại của Phase 1: xem mục "Lộ trình" cuối file.

## Quy trình v3: Claude viết test trước, Gemini làm cho xanh (từ WP-1.09, ưu tiên hơn mọi chỗ khác)

Bài học WP-1.08: viết code nhanh, thứ tốn thời gian là **mò lỗi** vì test lỏng và yêu cầu chưa rõ. Từ nay:

| Bước          | Ai     | Việc                                                                                                                                                                                               |
| ------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Thiết kế   | Claude | Bản giao việc ghi **hợp đồng**: file, tên hàm và kiểu, `data-testid`, khóa i18n, thuật toán từng bước, **các bẫy đã biết**. Phần khó (iframe, kéo thả, hiệu năng) có mã khung hoặc mã giả chi tiết |
| 2. Test trước | Claude | Viết sẵn test nghiệm thu (unit + E2E) trong repo, **kiểm chính test bằng một bản cài đặt nháp** rồi xóa bản nháp, để test đỏ đúng lý do "chưa có chức năng"                                        |
| 3. Code       | Gemini | Viết code tới khi các test đó xanh. **Không sửa file test được giao** (danh sách "Test khóa" trong bản giao việc)                                                                                  |
| 4. QA         | Claude | Chạy đủ, đọc diff, sửa, đưa lệnh commit                                                                                                                                                            |

**Kích thước**: mỗi lần giao khoảng ≤ 600 dòng code, ≤ 15 test, một tiêu chí xong.

### Quy tắc gỡ lỗi của Gemini (bắt buộc, để không mò)

1. Một test đỏ: đọc thông báo lỗi và `test-results/<tên test>/error-context.md` trước khi sửa.
2. Lỗi logic: tái hiện bằng unit test (`pnpm exec vitest run <file>`), không build.
3. Lỗi chỉ thấy trên trình duyệt: chạy `pnpm dev <thư mục workspace mẫu>` (tự nạp lại khi sửa, không cần build) và xem trực tiếp; chỉ build khi chạy E2E.
4. **Sửa 3 lần mà một test vẫn đỏ thì dừng**, báo: tên test, thông báo lỗi, đã thử gì, nghi ngờ gì. Claude xử lý. Không thử lần thứ 4.
5. **Cấm** làm test qua bằng cách: sửa file test khóa, thêm `waitForTimeout`, `if (...) return` trong test, đổi code sản phẩm cho khớp test sai (ví dụ cố định token mặc định). Thấy test có vẻ sai thì dừng và báo.
6. Trong lúc làm chỉ chạy: `pnpm exec eslint <file sửa>`, `pnpm exec tsc --noEmit -p packages/<gói>`, `pnpm exec vitest run <file>`, `pnpm build` rồi `pnpm exec playwright test <file> --project=chromium`. Chạy chờ kết quả, không chạy nền rồi hỏi lại.
7. Cuối cùng chạy một lần: `pnpm verify`, `pnpm test:e2e` (3 trình duyệt).

### Báo cáo khi xong (5 dòng)

1. Kết quả lệnh cuối (số test, mã thoát). 2. Việc đã làm. 3. Test nào dừng theo quy tắc 4 (nếu có). 4. Lệch spec. 5. Lệnh commit gợi ý.

## Quy trình rút gọn (2026-10-12, vẫn áp dụng phần không trái Quy trình v3)

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

- **E2E phải kiểm kết quả thật**: đọc file trang đã lưu (`e2e/support/small-page.ts`: `writeSmallWorkspace`, `expectSaved`) hoặc trạng thái chắc chắn; **cấm** `if (!box) return`, `if (count > 0)` hay test không có câu `expect` cuối (WP-1.08: nhiều test như vậy "xanh" trong khi chức năng hỏng).
- **Test model/preset với bộ token của fixture** (`fixtures/designs/all-nodes.json`), không thay bằng `createDefaultTokens()`: workspace thật thiếu token, lỗi chỉ lộ ra như vậy. Preset luôn tạo qua `instantiatePreset`.
- **Node mới trong thao tác dùng ID tạm `tmp_<số>`** rồi `assignIds`; không chép node cũ giữ nguyên ID, không dùng `tmp_chữ`.
- **React Compiler + `@tanstack/react-virtual`**: đọc `getVirtualItems()` trong hook, không trong component (spec-log #101).
- **Vòng làm việc nhanh**: khi sửa chỉ chạy `pnpm exec eslint <file>`, `pnpm exec tsc --noEmit -p packages/<gói>`, `pnpm exec vitest run <file>`, E2E một file trên Chromium; chạy ở chế độ chờ kết quả, không chạy nền rồi hỏi lại. Lệnh đầy đủ chỉ chạy một lần ở cuối.

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

## Lộ trình còn lại của Phase 1 (mỗi dòng là một lần giao)

| Lần giao                                  | Nội dung                                                                                                                                                                                                                  | Ai code |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [9A](buoc-09a-responsive-scope.md) (xong) | Model: khóa responsive theo khung, giá trị hiệu lực, scope `setStyle`, sửa cascade `2xl`                                                                                                                                  | Gemini  |
| [9B](buoc-09b-inspector-core.md)          | Inspector khung: thanh phạm vi (11.1), ô token/tùy chỉnh (R-IN-01), chấm ghi đè (R-IN-02), kế thừa (R-IN-03), sai giá trị (R-IN-05), scrub (R-IN-04); nhóm Bố cục (hướng), Khoảng cách (padding, gap), Hiệu ứng (opacity) | Gemini  |
| 9C                                        | Nhóm còn lại của 11.2 (Kích thước, Chữ, Nền, Viền...) (trừ Tương tác, Dữ liệu), chọn nhiều (R-IN-06), AC-03 E2E, PB-14                                                                                                    | Gemini  |
| 10A                                       | Phím tắt (M-KB) + Clipboard (M-CB)                                                                                                                                                                                        | Gemini  |
| 10B                                       | Quản lý trang (M-PG)                                                                                                                                                                                                      | Gemini  |
| 11                                        | CLI hoàn chỉnh, tắt an toàn, tarball                                                                                                                                                                                      | Gemini  |
| G1                                        | Kiểm cổng G1, schema-v1, báo cáo phase 1                                                                                                                                                                                  | Claude  |
