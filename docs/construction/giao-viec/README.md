# Giao việc cho AI thực hiện (Gemini)

Cách dùng: chủ sản phẩm đưa **một** file `buoc-XX-*.md` cho AI thực hiện, kèm câu: "Đọc `docs/construction/ke-hoach-hoan-thanh.md` mục 0 (quy tắc bắt buộc) rồi làm đúng bản giao việc này. Không làm gì ngoài phạm vi." Khi AI báo xong, chủ sản phẩm đưa kết quả lại cho Claude để kiểm tra và sửa lỗi.

Thứ tự: [bước 0](buoc-00-don-nen.md) → [1A](buoc-01a-canvas-hien-thi.md) → [1B](buoc-01b-overlay-chon.md) → [1C](buoc-01c-sua-chu-truc-tiep.md) → [1D](buoc-01d-hieu-nang-canvas.md). Các bước sau (Bước 2 trở đi trong [ke-hoach-hoan-thanh.md](../ke-hoach-hoan-thanh.md)) sẽ có bản giao việc riêng, Claude soạn khi tới lượt.

## Quy ước chung cho mọi bản giao việc

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
