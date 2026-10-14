# Giao việc cho AI thực hiện (Gemini) — bản 1.0

Cách dùng: chủ sản phẩm đưa **một** file `<WP>-<phần>.md` cho Gemini, kèm câu: "Đọc `docs/construction/giao-viec/README.md` rồi làm đúng bản giao việc này." Gemini báo xong thì chủ sản phẩm đưa kết quả cho Claude kiểm tra. Quy trình theo SPEC-07 mục 8 (vai trò, DoR DR-10 đến DR-13, DoD DW-10 đến DW-14).

Tài liệu giao việc của hướng cũ (Design Model) ở `../archive-0.18/giao-viec/`, chỉ để tra bài học.

## Quy trình: Claude viết test trước, Gemini làm cho xanh

| Bước          | Ai     | Việc                                                                                                                                                         |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Thiết kế   | Claude | Bản giao việc ghi **hợp đồng**: file được tạo/sửa, file phải đọc trước, kiểu và tên hàm, `data-testid`, khóa i18n, thuật toán từng bước, **các bẫy đã biết** |
| 2. Test trước | Claude | Test của WP có trong bộ test phase (CW-50), đã kiểm bằng bản cài đặt nháp khi khả thi, đang **đỏ đúng lý do**                                                |
| 3. Code       | Gemini | Viết code tới khi các test đó xanh. **Không sửa file test được giao** (danh sách "Test khóa")                                                                |
| 4. QA         | Claude | **Tự chạy** lệnh kiểm tra, đọc từng file đổi (không tin báo cáo), sửa, đưa lệnh commit                                                                       |

Kích thước mỗi lần giao: khoảng ≤ 600 dòng code, ≤ 15 test, một tiêu chí xong.

### Quy tắc gỡ lỗi của Gemini (bắt buộc)

1. Trước khi sửa một file: đọc file đó và các file liên quan (nơi gọi, nơi được gọi, test) — CW-52.
2. Một test đỏ: đọc thông báo lỗi và `test-results/<tên test>/error-context.md` trước khi sửa.
3. Lỗi logic: tái hiện bằng unit test (`pnpm exec vitest run <file>`), không build.
4. **Sửa 3 lần mà một test vẫn đỏ thì dừng**, báo: tên test, thông báo lỗi, đã thử gì, nghi ngờ gì. Không thử lần thứ 4.
5. **Cấm** làm test qua bằng cách: sửa file test khóa, thêm `waitForTimeout`, `if (...) return` trong test, `skip`, nới ngưỡng, `eslint-disable`, `@ts-ignore`, `as any`. Thấy test có vẻ sai thì dừng và báo.
6. Trong lúc làm chỉ chạy lệnh nhanh cho phần đang sửa: `pnpm exec eslint <file>`, `pnpm exec tsc --noEmit -p packages/<gói>`, `pnpm exec vitest run <file>`, E2E một file trên Chromium (sau `pnpm build`). Chạy chờ kết quả, không chạy nền.
7. Cuối cùng chạy một lần: `pnpm verify`, `pnpm test:e2e` (3 trình duyệt) — CW-51, CW-53.

## Quy ước chung

- Chỉ sửa file trong phạm vi bản giao việc; cần sửa ngoài phạm vi, thêm thư viện, hoặc đổi hành vi người dùng thấy thì **dừng và báo**.
- Không sửa `docs/spec.md`; chỗ lệch ghi vào `docs/construction/spec-log.md` (CW-61).
- Test gắn mã quy tắc `[R-xx]`, `[V-xx]`, `[S-xx]`, `[AC-xx]` (QC-93); `pnpm trace` phải xanh.
- Test không chạm cấu hình thật của người dùng: `REACTCRAFT_CONFIG_DIR` và thư mục tạm (R-QA-02). Fixture không sửa tại chỗ (QC-06, R-QA-01).
- E2E kiểm kết quả thật (đọc file trên đĩa, trạng thái chắc chắn); **cấm** test không có `expect` cuối hoặc thoát sớm bằng `if`.
- E2E không `await` từng phần tử trong vòng lặp; gom bằng một lần `evaluateAll`.

### Bài học kỹ thuật giữ từ bản 0.18

- **Phần tử trong iframe thuộc "vũ trụ" JavaScript khác**: không dùng `instanceof HTMLElement` của trang cha với phần tử lấy từ iframe (luôn `false` trên trình duyệt thật). Dùng `defaultView?.Element`, `querySelector<T>()`, `closest`/`matches`.
- **React Compiler + `@tanstack/react-virtual`**: đọc `getVirtualItems()` trong hook, không trong component; phần tử cuộn giữ trong state.
- **State thay đổi theo prop**: dùng mẫu "điều chỉnh state khi render" (so prop trước), không `setState` trong effect.
- **Sửa chữ bằng `contenteditable`**: gỡ listener trước rồi mới bỏ `contenteditable`, nếu không Esc vẫn lưu (R-TX-04).
- **Ghi file thất bại phải thử lại**, không bỏ thay đổi (bài học design-store, ADR-BE-18).

## Mẫu báo cáo khi xong (AI thực hiện điền)

```
WP: <mã>-<phần>
1. Tổng: <xong / chưa xong>; pnpm verify: <số test xanh/tổng, mã thoát>; E2E: <số>; đo: <số đo>
2. Đã làm: (mỗi việc một dòng, kèm đường dẫn file)
3. Chưa làm / dừng theo quy tắc 4, lý do:
4. Lệch so với spec (số # trong spec-log):
5. Rủi ro hoặc điều Claude nên soi kỹ:
6. Lệnh commit gợi ý (đã qua commitlint, không dòng ghi công AI):
```

## Lộ trình Phase 1 (SPEC-07 mục 3)

| WP      | Nội dung                                                                      | Ai code         |
| ------- | ----------------------------------------------------------------------------- | --------------- |
| WP-1.01 | Dọn hướng cũ, tạo `packages/shared`, thay spec (xong, xem `../wp/wp-1.01.md`) | Claude          |
| WP-1.02 | Bộ test nghiệm thu Phase 1 + spike VG-15, VG-16                               | Claude          |
| WP-1.03 | M-FW + M-PJ: mở, tạo khung, cài, nút Project, backend                         | Gemini          |
| WP-1.04 | M-RN: runner dev server, Canvas iframe                                        | Gemini + Claude |
| WP-1.05 | M-BR + M-SL: Bridge, chọn phần tử, Layer Tree                                 | Gemini + Claude |
| WP-1.06 | M-SE + M-HI: Source Editor, Undo/Redo                                         | Gemini          |
| WP-1.07 | M-TW + M-IN: mô hình class Tailwind, Inspector                                | Gemini          |
| WP-1.08 | M-TX: sửa chữ trên Canvas                                                     | Gemini          |
| G1      | Kiểm cổng G1, báo cáo phase 1                                                 | Claude          |
