# 03d. Kiến trúc Pug (Express + Pug, sửa được)

Đợt 5 của [04-lo-trinh.md](04-lo-trinh.md) (chủ dự án đưa Pug lên trước Vue, 2026-11-23). Bản phân tích đã duyệt; đã làm, kết quả ở mục 7. Dựa trên code hiện tại (đã đọc: `stacks/view/pug/view.ts`, `runners/pug-loc-plugin.ts`, `stacks/runtime/express/routes.ts`, `fixtures/projects/express-pug`) và cách đã làm cho Razor ([03c](03c-razor.md)).

Mục tiêu: dự án Express + Pug làm được **đủ thao tác** như React và Razor: chọn, đọc style, sửa, chèn khối, Undo, nhờ AI sửa, thêm / đổi tên / xóa trang. Hiện chỉ xem được.

## 0. Đã có và còn thiếu

| Phần                        | Hiện có                                                                         | Còn thiếu                                                                           |
| --------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Nhận diện, chạy dự án       | Có: runner `express-pug`, proxy Bridge                                          | Không                                                                               |
| Gắn nhãn `file:dòng:cột`    | Có: móc vào trình biên dịch Pug của dự án (`pug-loc-plugin`), cả include, mixin | Không                                                                               |
| Canvas tải lại khi view đổi | Có: Studio tải lại khi file trong `views/` đổi (Express dựng trang mỗi lần gọi) | Không                                                                               |
| Danh sách trang             | Có: đọc route `app.get(…)`, `router.get(…)` và `res.render(…)`                  | Thêm, đổi tên, xóa trang                                                            |
| Bộ sửa `.pug`               | **Không**: `pugView` là `viewOnly`                                              | Toàn bộ: đọc phần tử, sửa class / chữ / thuộc tính / thẻ, chèn, xóa, di chuyển, bọc |
| Khối thư viện ra Pug        | Có: `renderPug` của Đợt 3 (305 / 305 khối)                                      | Không                                                                               |
| Tailwind dựng bằng CLI      | Chưa (Express)                                                                  | Dùng lại cách của Razor: chạy script `--watch` của dự án                            |

Việc chính của đợt là **bộ sửa Pug** và **ghi trang** (sửa route trong code JavaScript). Phần chạy và gắn nhãn đã có.

## 1. Điều kiện cần

1. Dự án dùng Pug 2 hoặc 3 (cú pháp như nhau từ 2016). Không cần gì thêm trên máy người dùng: Node đã có.
2. **Bộ đọc Pug chính thức `pug-lexer`** (bản 5, đi cùng Pug 3) cho vị trí đầu và cuối của từng tên thẻ, class rút gọn (`.card`), thuộc tính, đoạn chữ, đoạn code (`= x`, `#{x}`), `each`, `if`, `+mixin`, thụt lề. Đã thử: `div.card.p-4(href="/x" class=a) Hi #{name}` ra đúng từng phần với dòng và cột. KumiCraft thêm `pug-lexer` vào gói của mình (MIT), không phụ thuộc cách cài của dự án.
3. Nhãn trên Canvas (do `pug-loc-plugin` gắn theo dòng và cột của nút trong cây Pug) phải trùng vị trí token thẻ của `pug-lexer`. Kiểm ở bước đầu của đợt, kể cả `div` ngầm (`.card` không ghi `div`).

## 2. Cấu trúc

```
packages/server/src/
  lib/pug/markup.ts            đọc .pug bằng pug-lexer ra phần tử: dòng thẻ, class, thuộc tính, chữ, khối con (theo thụt lề)
  stacks/view/pug/             bộ sửa .pug (như stacks/view/razor): đọc phần tử, sửa, cấu trúc
  stacks/runtime/express/      thêm ghi trang: route trong app.js / routes/*.js + view mới
  runners/express-pug.ts       thêm chạy script Tailwind --watch của dự án (dùng chung với Razor)
```

Bộ sửa được chọn theo ngôn ngữ giao diện qua `editorByView` (đã có từ Đợt 4): `pug` → bộ sửa Pug.

### 2.1 Một phần tử Pug

```
section.cards(id="list")          ← dòng thẻ: tên thẻ, class rút gọn, thuộc tính (vị trí từng phần)
  each product in products        ← code (vòng lặp): phần tử bên trong là "trong vòng lặp"
    +card(product)                ← gọi mixin: phần tử thật nằm ở file mixin
```

- **Khối của phần tử** = dòng thẻ + mọi dòng thụt sâu hơn ngay sau nó. Pug dựa vào thụt lề, nên xóa, nhân bản, di chuyển, bọc đều là thao tác trên **các dòng**, chỉnh lại thụt lề.
- Class có hai cách viết: rút gọn `.card.p-4` và thuộc tính `class="…"` / `class=biểu_thức`. Sửa class giữ cách người dùng đang viết; class là biểu thức thì chỉ xem.
- Chữ có ba cách: cùng dòng (`h1 Xin chào`), dòng `| chữ`, và biểu thức (`h1= title`). Biểu thức và chữ có `#{…}` thì chỉ xem (như Razor).

### 2.2 Ghi trang (Express)

Trang = một route `app.get('/x', …)` hoặc `router.get('/x', …)` gọi `res.render('x')`. Code JavaScript đọc bằng Babel (đã dùng trong `routes.ts`).

- **Thêm:** tạo `views/<tên>.pug` (kế thừa layout nếu các view khác `extends layout`), thêm `app.get('/<tên>', (req, res) => { res.render('<tên>', { title: '…' }); });` sau route cuối cùng của file chứa các route.
- **Đổi tên:** đổi đường dẫn route, tên view trong `res.render`, và tên file view.
- **Xóa:** bỏ route và file view.
- Mỗi việc là một bước Undo (nhiều file, như MVC).

## 3. Luồng

### 3.1 Chọn phần tử

```
Bấm trên Canvas ──► data-rc-loc="views/index.pug:5:3" (đã có)
   ──► bộ sửa Pug: đọc views/index.pug bằng pug-lexer ──► phần tử có thẻ ở dòng 5, cột 3
   ──► Inspector: class, chữ, thuộc tính, có trong `each` không, có trong mixin không
```

### 3.2 Sửa

```
Inspector đổi class ──► bộ sửa Pug: thay đúng đoạn `.card.p-4` (hoặc giá trị class="…") trên dòng thẻ
   ──► ghi file GỐC (đường ghi chung, Undo) ──► Express dựng lại trang ở lần gọi sau
   ──► Studio thấy file trong views/ đổi ──► tải lại Canvas (đã có)
```

Chèn khối: cây khối ──► `renderPug` (Đợt 3) ──► các dòng Pug thụt đúng mức chỗ chèn.

### 3.3 Nhờ AI sửa

Như React và Razor: AI nhận `views/index.pug:5:3` và sửa file gốc; Canvas tải lại như mục 3.2.

## 4. Sửa được gì trên `.pug`

| Thao tác                                         | Pug                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Class, style (Inspector)                         | Có (rút gọn hoặc `class="…"`); `class=biểu_thức` chỉ xem                                 |
| Chữ                                              | Có với chữ cố định; `= biểu thức` và chữ có `#{…}` chỉ xem                               |
| Thuộc tính (`href`, `src`, `alt`…)               | Có với giá trị chuỗi cố định; giá trị là biểu thức chỉ xem                               |
| Đổi thẻ                                          | Có (`div` ngầm `.card` thành `section.card`)                                             |
| Chèn khối, nhân bản, xóa, di chuyển, bọc, gỡ bọc | Có, theo dòng và thụt lề; không di chuyển ra / vào giữa các khối `each` / `if` khác nhau |
| Phần tử trong mixin                              | Sửa ở file mixin: mọi chỗ gọi mixin đều đổi (Studio báo như component dùng lại)          |
| Phần tử trong `each`                             | Sửa một lần là đổi mọi lần lặp                                                           |
| Ảnh                                              | Chép vào `public/images`, `src="/images/<file>"`                                         |

## 5. Kiểm thử (cần và đủ)

| Loại | Kiểm gì                                                                                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit | Đọc phần tử bằng pug-lexer: vị trí trùng nhãn của `pug-loc-plugin` (cả `div` ngầm, mixin, include)                                                             |
| Unit | Bộ sửa: class rút gọn và `class="…"`, chữ cùng dòng và `\|`, thuộc tính, đổi thẻ, chèn khối, xóa / nhân bản / di chuyển / bọc theo thụt lề, chặn đi qua `each` |
| Unit | Ghi trang: thêm, đổi tên, xóa route + view; thêm rồi xóa trả file route về đúng từng byte                                                                      |
| E2E  | Mẫu `express-pug` (sửa `express-pug.e2e.ts`, hiện kiểm "chỉ xem"): chọn, sửa class, sửa chữ, nhân bản (Canvas tải lại trang thật), Undo                        |

## 6. Chưa làm trong đợt này

- Trang nháp, như Next và Razor.
- Template khác của Express (EJS, Handlebars): đợt sau, cùng cách làm.

## 7. Kết quả (2026-11-23, spec-log #167)

- **Bộ sửa Pug** (`stacks/view/pug`): đọc bằng `pug-lexer` (`lib/pug/markup.ts`). Test đối chiếu: mọi nhãn `pug-loc-plugin` gắn (cả `div` ngầm, `li: a`, thuộc tính đứng trước class, mixin, include) đều trùng một phần tử bộ đọc tìm được. Sửa class giữ cách viết rút gọn; class Tailwind có `:` / `/` ghi thành `class="…"`. Chữ cùng dòng và dòng `|`, thuộc tính, đổi thẻ, chèn khối, nhân bản, xóa, di chuyển, bọc, gỡ bọc theo dòng và thụt lề; chặn đi qua `each` / `if`.
- **Khối thư viện ra Pug dễ đọc** (`renderPugSource`: `section.py-5`, `a(href="/x") Go`), cùng bộ 305 / 305 khối của Đợt 3.
- **Khung bộ sửa chung** (`kernel/text-view-editor.ts`): Razor và Pug chỉ cắm phần đọc phần tử và lên thao tác; tìm theo loc, ghi file, gộp Undo, lưu ảnh và CSS của khối là chung. Bộ sửa Razor của Đợt 4 chuyển sang khung này.
- **Trang Express** (`stacks/runtime/express/pages-write.ts`): thêm route `app.get(…)` + view (kế thừa layout như các view khác), đổi tên, xóa; thêm rồi xóa trả `app.js` đúng từng byte. Route trong router con (`routes/*.js`) đọc được nhưng chưa đổi tên / xóa được.
- **Style Express**: đọc CSS trong `public/` (trước đây danh sách hệ style trống), Tailwind qua script `--watch` của dự án (dùng chung với Razor, `runners/css-watch.ts`).

**Lỗi thật tìm được khi làm:**

- Runner Express coi mọi tin nhắn không phải `start` là lệnh dừng: tin `filesWritten` (KumiCraft ghi một file hai lần liền, ví dụ sửa rồi Undo) làm app tắt. Có từ K4, không lộ vì trước đây không sửa được.
- Studio chỉ tải lại Canvas khi file đổi **ngoài** KumiCraft (`project.filesChanged`); sửa trong KumiCraft không tải lại. Express nay tải lại theo `history.changed` (mỗi lần sửa, Undo, Redo).
- Thêm / đổi tên / xóa trang qua Studio đòi bộ công cụ riêng của JSX, nên **Razor (Đợt 4) và Express bị từ chối "chỉ xem"**; test của Đợt 4 gọi thẳng bộ trang nên không thấy. Nay bộ trang của stack được gọi khi dự án sửa được (`project-pages.ts`, `editPages`); test mới đi qua project service.

**Kiểm thử:** unit cho bộ đọc (đối chiếu nhãn thật), bộ sửa, trang Express, và một test đi qua các service của server (`express-editing.test.ts`, thay test "chỉ xem" cũ); E2E `express-pug.e2e.ts`: sửa chữ trên Canvas, Undo, nhân bản (Canvas tải lại trang thật), nút thêm trang.

**Chưa làm:** trang nháp; đổi tên / xóa route trong router con; chữ nhiều đoạn, bọc chữ, thay SVG (E023 `notForPug`); các công cụ chỉ có ở JSX.
