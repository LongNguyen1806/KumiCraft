# Giao việc cho AI thực hiện (Gemini) — bản 1.0

Cách dùng: chủ sản phẩm đưa **một** file `<WP>-<phần>.md` cho Gemini, kèm câu: "Đọc `docs/construction/giao-viec/README.md` rồi làm đúng bản giao việc này." Gemini báo xong thì chủ sản phẩm đưa kết quả cho Claude kiểm tra. Quy trình theo SPEC-07 mục 8 (vai trò, DoR DR-10 đến DR-13, DoD DW-10 đến DW-14).

Tài liệu giao việc của hướng cũ (Design Model) ở `../archive-0.18/giao-viec/`, chỉ để tra bài học.

## Quy trình (từ Phase 2): Claude viết hợp đồng, Gemini code và test, chủ dự án kiểm tay

| Bước              | Ai        | Việc                                                                                                                                                                               |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Thiết kế       | Claude    | Bản giao việc ghi **hợp đồng**: file được tạo/sửa, file phải đọc trước, kiểu và tên hàm, `data-testid`, khóa i18n, thuật toán từng bước, **các bẫy đã biết**                       |
| 2. Danh sách test | Claude    | Bản giao việc ghi **từng tình huống test** (đầu vào → kết quả, mã quy tắc) lấy từ bảng Kiểm thử bắt buộc của spec (CW-50). Lượt rủi ro cao có thể kèm test khóa do Claude viết sẵn |
| 3. Code           | Gemini    | Viết code **và** unit/component/integration test cho đúng các tình huống đã ghi. **Không viết E2E Playwright mới.** Không sửa file trong danh sách "Test khóa" nếu có              |
| 4. QA             | Claude    | **Tự chạy** `pnpm verify`, đọc từng file đổi (không tin báo cáo), đối chiếu test với từng tình huống, sửa lỗi nhỏ                                                                  |
| 5. Kiểm tay       | Chủ dự án | Chạy mục **Kiểm tay** của bản giao việc trên dự án mới tạo và dự án có sẵn (SPEC-06 mục 7). Đạt thì commit; lỗi thì Claude sửa trước lượt sau                                      |

Kích thước mỗi lần giao: khoảng ≤ 600 dòng code, ≤ 15 test, một tiêu chí xong.

### Quy tắc gỡ lỗi của Gemini (bắt buộc)

1. Trước khi sửa một file: đọc file đó và các file liên quan (nơi gọi, nơi được gọi, test) — CW-52.
2. Một test đỏ: đọc thông báo lỗi và `test-results/<tên test>/error-context.md` trước khi sửa.
3. Lỗi logic: tái hiện bằng unit test (`pnpm exec vitest run <file>`), không build.
4. **Sửa 3 lần mà một test vẫn đỏ thì dừng**, báo: tên test, thông báo lỗi, đã thử gì, nghi ngờ gì. Không thử lần thứ 4.
5. **Cấm** làm test qua bằng cách: sửa file test khóa, thêm `waitForTimeout`, `if (...) return` trong test, `skip`, nới ngưỡng, `eslint-disable`, `@ts-ignore`, `as any`. Thấy test có vẻ sai thì dừng và báo.
6. Trong lúc làm chỉ chạy lệnh nhanh cho phần đang sửa: `pnpm exec eslint <file>`, `pnpm exec tsc --noEmit -p packages/<gói>`, `pnpm exec vitest run <file>` (chạy từ thư mục gốc repo). Chạy chờ kết quả, không chạy nền.
7. Cuối cùng chạy một lần `pnpm verify` (CW-51, CW-53). `pnpm test:e2e` (bộ hồi quy, Chromium) chỉ chạy khi bản giao việc ghi rõ (lượt sửa Bridge, runner, phiên). Sửa shared hoặc bridge thì chạy `pnpm --filter @reactcraft/bridge build` trước.
8. Tự chạy thử mục **Kiểm tay** trên dự án mẫu khi làm được, và ghi bước nào đã thử vào báo cáo.

## Lỗi lint hay vấp (viết đúng ngay từ đầu)

Các lượt Phase 2 đều phải sửa lại những lỗi sau ở cuối. Viết đúng ngay khi tạo file, và chạy `pnpm exec eslint <file>` **sau mỗi file**, không đợi tới `pnpm verify`.

| Quy tắc                                                                | Viết thế này                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Hàm ≤ 50 dòng, file ≤ 400 dòng (`max-lines-per-function`, `max-lines`) | Tách hàm con hoặc hook ngay khi hàm gần 40 dòng; component React tách phần render con      |
| QC-40: không `null` (`no-restricted-syntax`)                           | `x !== undefined`, `Boolean(x)`, `typeof x === 'object'`; ref React dùng `el ?? undefined` |
| Arrow xử lý sự kiện trả `void` (`no-confusing-void-expression`)        | `onClick={() => { doIt(); }}`, không viết `onClick={() => doIt()}`                         |
| Điều kiện thừa (`no-unnecessary-condition`)                            | Không `?.` hay `&&` với giá trị đã chắc chắn có                                            |
| Thứ tự import (`simple-import-sort`)                                   | Chạy `pnpm exec eslint --fix <file>`                                                       |
| Không `any` (`no-unsafe-*`), kể cả `expect.any(...)` trong test        | So với giá trị cụ thể                                                                      |

## Quy ước chung

- Chỉ sửa file trong phạm vi bản giao việc; cần sửa ngoài phạm vi, thêm thư viện, hoặc đổi hành vi người dùng thấy thì **dừng và báo**.
- Không sửa `docs/spec.md`; chỗ lệch ghi vào `docs/construction/spec-log.md` (CW-61).
- Test gắn mã quy tắc `[R-xx]`, `[V-xx]`, `[S-xx]`, `[AC-xx]` (QC-93); `pnpm trace` phải xanh.
- Test không chạm cấu hình thật của người dùng: `REACTCRAFT_CONFIG_DIR` và thư mục tạm (R-QA-02). Fixture không sửa tại chỗ (QC-06, R-QA-01).
- Test kiểm kết quả thật (đọc file trên đĩa, so từng byte khi spec yêu cầu); **cấm** test không có `expect` cuối hoặc thoát sớm bằng `if`.
- Không viết E2E mới. Sửa test E2E cũ chỉ khi bản giao việc cho phép (thay đổi hành vi có chủ đích).

### Bài học kỹ thuật giữ từ bản 0.18

- **Phần tử trong iframe thuộc "vũ trụ" JavaScript khác**: không dùng `instanceof HTMLElement` của trang cha với phần tử lấy từ iframe (luôn `false` trên trình duyệt thật). Dùng `defaultView?.Element`, `querySelector<T>()`, `closest`/`matches`.
- **React Compiler + `@tanstack/react-virtual`**: đọc `getVirtualItems()` trong hook, không trong component; phần tử cuộn giữ trong state.
- **State thay đổi theo prop**: dùng mẫu "điều chỉnh state khi render" (so prop trước), không `setState` trong effect.
- **Sửa chữ bằng `contenteditable`**: gỡ listener trước rồi mới bỏ `contenteditable`, nếu không Esc vẫn lưu (R-TX-04).
- **Ghi file thất bại phải thử lại**, không bỏ thay đổi (bài học design-store, ADR-BE-18).

## Mẫu báo cáo khi xong (AI thực hiện điền)

```
WP: <mã>-<phần>
1. Tổng: <xong / chưa xong>; pnpm verify: <số test xanh/tổng, mã thoát>; E2E (nếu yêu cầu): <số>; kiểm tay đã tự thử: <các bước>
2. Đã làm: (mỗi việc một dòng, kèm đường dẫn file)
3. Chưa làm / dừng theo quy tắc 4, lý do:
4. Lệch so với spec (số # trong spec-log):
5. Rủi ro hoặc điều Claude nên soi kỹ:
6. Lệnh commit gợi ý (đã qua commitlint, không dòng ghi công AI):
```

## Lộ trình Phase 2

Xem `p2-ke-hoach.md`: thứ tự các lượt, phạm vi, phụ thuộc và danh sách kiểm tay. Bản giao việc chi tiết của từng lượt (`p2-luot<N>-<tên>.md`) được Claude viết ngay trước khi giao, sau khi lượt trước đã QA và commit.

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
