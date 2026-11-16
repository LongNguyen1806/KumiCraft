# Thiết kế lại phần Component trong Inspector

**Trạng thái:** Đợt 1 xong (spec-log #150, tour 08); Đợt 2 xong (spec-log #151, tour 09); Đợt 3 chưa làm.
**Liên quan:** R-IN-11 (thuộc tính component), R-SE-04 (sửa cấu trúc), spec-log #146, #149.

## 1. Vì sao làm lại

Ảnh chụp của chủ dự án (2026-11-16): chọn một ảnh thì mục "Thuộc tính component (img)" hiện khoảng 60 ô
(`crossOrigin`, `fetchPriority`, `nonce`, `radioGroup`, `suppressHydrationWarning`…). Có ô chọn
"(chưa đặt)" không rõ dùng làm gì, và dòng "Sửa trong editor" không cho biết giá trị. Thứ tự các ô lấy
theo thư viện React nên lộn xộn. Kết luận: tự viết code còn dễ hơn dùng công cụ.

**Nguyên nhân:** `ts-inspect.ts` (`readComponentProps`) đổ ra mọi thuộc tính TypeScript tìm thấy, kể
cả thuộc tính HTML của `@types/react`. Mục này cũng hiện cho thẻ HTML thường (`<img>`). Không có bước
nào hiểu ý nghĩa của từng prop.

## 2. Khái niệm làm nền

1. **Component là một bản thiết kế dùng lại.** Định nghĩa nằm trong một file; chỗ dùng nằm trong các
   trang. Sửa định nghĩa thì mọi chỗ dùng đổi theo; sửa chỗ dùng thì chỉ chỗ đó đổi.
2. **Props là những núm vặn người viết component mở ra.** Núm phải được khai báo và **được đọc** trong
   định nghĩa; giá trị được truyền ở trang dùng. Truyền một prop mà định nghĩa không đọc tới thì không
   có tác dụng.
3. **Component không bắt buộc có prop.** Có 4 cách dùng lại:
   - _Không prop:_ `<Header />`, giống nhau ở mọi nơi.
   - _Có prop:_ `<ProductCard name="Áo" />`.
   - _Ruột truyền vào (children):_ `<Card>…</Card>`. Phần ruột nằm trong file trang.
   - _Tự lấy dữ liệu:_ `<UserMenu />` đọc dữ liệu từ store hoặc API, không qua prop.
4. **Ý nghĩa của prop nằm ở chỗ nó được dùng bên trong**, không nằm ở tên hay kiểu dữ liệu. Hai
   component "404" của hai người viết có thể có núm và hành vi khác hẳn nhau, nên **không dùng khung
   mẫu cố định theo tên component**.
5. **Hành vi** của component là những trạng thái mà props tạo ra: điều kiện hiện/ẩn, biến thể, logic
   chạy (hẹn giờ, chuyển trang). Bảng thuộc tính chính là bảng điều khiển các hành vi đó.

## 3. Ý nghĩa của prop, đọc từ chỗ nó được dùng

App đọc code của định nghĩa và lần theo từng prop xem nó chảy tới đâu:

| Prop được dùng bên trong                         | Ý nghĩa              | Nhóm      | Ô hiện ra                        |
| ------------------------------------------------ | -------------------- | --------- | -------------------------------- |
| In ra thành chữ: `<h3>{title}</h3>`              | Nội dung chữ         | Nội dung  | Ô gõ (dài thì nhiều dòng)        |
| Đưa vào `src`, `poster`, ảnh nền                 | Ảnh / media          | Hình ảnh  | Xem trước + **Chọn ảnh…**        |
| Đưa vào `href`, `to`, `navigate(...)`            | Đích đến             | Liên kết  | **Chọn trang** hoặc gõ link      |
| Điều kiện `{showX && …}`, `x ? … : …`            | Hiện/ẩn một phần     | Hiện / ẩn | Công tắc                         |
| Tra ra class: `variants[variant]`, so sánh chuỗi | Biến thể kiểu dáng   | Kiểu      | Hàng nút (≤ 4) hoặc ô chọn (≥ 5) |
| `slice(0, n)`, số lần lặp                        | Số lượng             | Hành vi   | Ô số                             |
| `setTimeout`, logic chạy                         | Hành vi              | Hành vi   | Ô số có đơn vị (giây…)           |
| Mảng hoặc đối tượng được `.map`                  | Dữ liệu / danh sách  | Nội dung  | "lấy từ code" + Mở (Đợt 3: sửa)  |
| `{...rest}` xuống thẻ HTML, `on…`, `className`   | Kỹ thuật             | —         | **Ẩn**                           |
| Không rõ                                         | Theo kiểu TypeScript | Nâng cao  | chữ / số / công tắc / chọn       |

**Quy tắc chung:**

- Chỉ hiện các núm **do dự án khai báo**. Thuộc tính lấy từ `@types/react` (HTML) bị ẩn, kể cả khi
  được chuyển xuống bằng `...rest`. Ngoại lệ: thuộc tính mà trang dùng đã đặt giá trị thì vẫn hiện.
- Luôn ẩn: `key`, `ref`, `className`, `style`, `on…`, `aria-*` (thuộc mục Trợ năng), `data-*`.
- Thứ tự: đã đặt giá trị, rồi bắt buộc, rồi phần còn lại; gom theo nhóm Nội dung, Hình ảnh, Liên
  kết, Hiện / ẩn, Kiểu, Hành vi, rồi Nâng cao (gập, mặc định đóng).
- Tên hiện ra: tiếng Việt dễ hiểu, lấy từ từ điển tên thường gặp hoặc tách camelCase; dòng nhỏ màu
  xám ghi tên thật trong code.
- Giá trị lấy từ code (`image={item.img}`): hiện biểu thức, mờ đi, có chữ "lấy từ code", nút **Mở**
  và nút **Đặt giá trị cố định**.
- "(chưa đặt)" đổi thành "Mặc định"; nếu định nghĩa có giá trị mặc định thì hiện luôn giá trị đó.
- Ô tích và công tắc nằm cùng hàng với tên.

## 4. Inspector theo từng trường hợp chọn

### 4.1 Chọn chỗ dùng component

**Thẻ Component** ở đầu Inspector:

```
┌─────────────────────────────────────────┐
│ ◇ ProductCard              Dùng ở 3 chỗ │
│ src/components/ProductCard.tsx          │
│ [Sửa component]  [Gỡ khỏi trang]        │
└─────────────────────────────────────────┘
```

- **Sửa component:** vào chế độ component (đã có), thay đổi lúc đó áp cho mọi chỗ dùng.
- **Gỡ khỏi trang:** bỏ chỗ dùng này (spec-log #149), file component giữ nguyên.
- **Dùng ở N chỗ:** bấm vào thì thấy danh sách các trang đang dùng.

**Mục Tùy chỉnh** (thay cho "Thuộc tính component") nằm ngay dưới, **trên** các mục Bố cục và Kiểu dáng:

```
Tùy chỉnh
 Nội dung
   Tên sản phẩm      [Áo thun               ]
   Giá               [200k                  ]
 Hình ảnh
   Ảnh               [🖼 xem trước] [Chọn ảnh…]
 Liên kết
   Đi tới            [/san-pham/ao-thun   ▾]
 Hiện / ẩn
   Hiện nhãn giảm giá                  (○  )
 Kiểu
   Kiểu thẻ          [Phẳng][Nổi][Viền]
 ▸ Nâng cao (2)
 + Thêm tùy chỉnh
```

Component không có núm nào thì mục này ghi: "Component này giống nhau ở mọi chỗ dùng. Muốn đổi, bấm
Sửa component."

### 4.2 Chọn phần nằm cứng trong component (khi đang thiết kế trang)

```
┌─────────────────────────────────────────┐
│ ⓘ Phần này thuộc component ProductCard. │
│   Sửa ở đây sẽ đổi cả 3 chỗ dùng.       │
│   [Sửa component]  [Chọn cả thẻ]        │
└─────────────────────────────────────────┘
```

- Thay cho lỗi E023 khó hiểu.
- Các ô Kiểu dáng hiện nhưng mờ, chỉ dùng được sau khi vào chế độ Sửa component.

### 4.3 Chọn phần ruột do trang truyền vào (children)

- Sửa như phần tử thường, vì phần ruột nằm trong file trang.
- Đầu Inspector có dòng nhỏ "nằm trong ◇ Card"; bấm vào thì chọn cả thẻ.

### 4.4 Kiểu dáng của cả thẻ component

- Component **nhận `className`** (định nghĩa đọc và gắn vào phần tử gốc): sửa kiểu chỉ ghi vào chỗ dùng này.
- Component **không nhận**: mục Kiểu dáng ghi "Kiểu dáng này thuộc component, đổi sẽ áp cho cả N chỗ",
  kèm nút **Sửa component**.

### 4.5 Thẻ HTML thường (`<img>`, `<a>`, `<div>`)

Không có thẻ Component, không có mục Tùy chỉnh. Thuộc tính của các thẻ này nằm ở những mục đã có:
Ảnh, Liên kết, Trợ năng.

## 5. Component từ thư viện (`node_modules`): khóa một phần

**Đã chốt:** khóa một phần.

| Phần                       | Component của dự án                     | Component từ thư viện (có cờ)                                           |
| -------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| Panel Components           | Bình thường                             | Nhãn **📦 tên-gói** (vd. `📦 @mui/material`)                            |
| Thẻ Component              | [Sửa component] [Gỡ khỏi trang]         | "Từ thư viện @mui/material, không sửa được bên trong" + [Gỡ khỏi trang] |
| Mục Tùy chỉnh (núm có sẵn) | Sửa được                                | **Sửa được** (chỉ ghi vào trang)                                        |
| + Thêm tùy chỉnh           | Có                                      | **Ẩn**                                                                  |
| Chọn phần bên trong        | Báo "thuộc component" + [Sửa component] | Báo "thuộc thư viện", **chỉ xem**                                       |
| Kiểu dáng phần bên trong   | Sửa trong chế độ Sửa component          | **Khóa**                                                                |

Với component thư viện, mục Tùy chỉnh chỉ hiện các núm chính mà gói khai báo (`variant`, `size`,
`color`, `disabled`…), không hiện thuộc tính HTML kế thừa. Nhận biết: file khai báo của component nằm
trong `node_modules`, hoặc lệnh import trỏ tới một gói.

## 6. "+ Thêm tùy chỉnh": mở thêm núm từ Inspector

Thêm prop chỉ ở trang thì không có tác dụng. Vì vậy app sửa **cả hai nơi**: thêm núm vào định nghĩa,
rồi truyền giá trị ở chỗ dùng.

| Người dùng chọn                | Trong định nghĩa                                                       | Ở trang                           |
| ------------------------------ | ---------------------------------------------------------------------- | --------------------------------- |
| Một dòng chữ (bấm trên Canvas) | Chữ cứng → `{label}`, mặc định = chữ cũ                                | `label="…"`                       |
| Một ảnh                        | `src` cứng → `{image}`, mặc định = ảnh cũ                              | `image="…"` (Chọn ảnh)            |
| Hiện/ẩn một phần               | Bọc phần đó bằng `{showX && …}`, mặc định bật                          | `showX={false}`                   |
| Kiểu dáng                      | Thêm `variant`; class cũ thành kiểu "Thường", class mới thành kiểu mới | `variant="…"`                     |
| Hành vi khác                   | Không tự sinh                                                          | **Nhờ AI làm** (viết sẵn yêu cầu) |

- **Giá trị mặc định luôn bằng hiện trạng**, nên các chỗ dùng khác không đổi.
- Trước khi tạo, app báo: "Sẽ sửa ProductCard.tsx (dùng ở N chỗ). Các chỗ khác giữ nguyên."
- Một lần Hoàn tác đưa **cả hai file** về như cũ.
- App gợi ý tên núm (vd. "Hiện nhãn giảm giá" → `showSale`) và chặn tên trùng với núm có sẵn.
- Không có với component thư viện.

## 7. Panel Lớp

- Chỗ dùng component hiện một dòng `◇ ProductCard` có màu riêng. Hiện nay nhãn ghi sai "Card" khi hai
  component lồng nhau.
- Phần ruột (children) hiện bình thường; phần nằm cứng trong component hiện mờ.

## 8. Chia đợt

| Đợt | Nội dung                                                                                                                                                                                                               | Ước tính |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 4.5 (bỏ mục cho thẻ HTML); mục 3 (đọc prop chảy tới đâu, ẩn thuộc tính React, gom nhóm, tên dễ hiểu, ô theo ý nghĩa, "lấy từ code", "Mặc định", câu báo không có núm); thẻ Component 4.1; cờ 📦 trong panel Components | ~2,5 giờ |
| 2   | Chọn ảnh… và Chọn trang trong Tùy chỉnh; 4.2 (thay E023); 4.3; 4.4; khóa một phần cho component thư viện (mục 5); Panel Lớp (mục 7)                                                                                    | ~2 giờ   |
| 3   | "+ Thêm tùy chỉnh" (mục 6): 4 loại tự sinh code, kết nối Nhờ AI                                                                                                                                                        | ~3 giờ   |
| sau | Sửa danh sách (mảng) ngay trong bảng; "Dùng ở N chỗ" mở danh sách trang                                                                                                                                                | tính sau |

Mỗi đợt gồm sửa code, test đơn vị, một tour trong `tour/`, ảnh chụp màn hình, mục spec-log, và lệnh
commit đã kiểm bằng commitlint. Đợt sau chỉ bắt đầu khi chủ dự án đã thử và commit đợt trước.

## 9. Tiêu chí xong của từng đợt

- **Đợt 1:**
  - Chọn `<img>` thường: không còn mục Tùy chỉnh.
  - Chọn ProductCard (`name`, `price`, `image`): đúng 3 ô, đúng nhóm, tên tiếng Việt.
  - Chọn component bọc `<img {...rest}>`: chỉ hiện núm của dự án.
  - Component không prop: hiện câu báo.
  - Component MUI: có cờ 📦 và chỉ hiện núm chính.
- **Đợt 2:**
  - Chọn ảnh từ kho → ghi đúng `image="…"` ở trang.
  - Chọn chữ cứng trong component → hiện khung báo, không còn E023.
  - Component thư viện: phần bên trong chỉ xem.
  - Panel Lớp ghi đúng tên component ngoài cùng.
- **Đợt 3:**
  - Thêm công tắc hiện/ẩn cho nhãn → hai file đổi đúng; các chỗ dùng khác không đổi; một lần Hoàn tác
    trả cả hai file.

## 10. Ghi chú kỹ thuật (sơ bộ)

- **Server:**
  - `ts-inspect.ts`: bỏ thuộc tính khai báo trong `node_modules/@types/react`; trả thêm nơi khai báo
    (dự án hay gói) và giá trị mặc định.
  - Một bước mới đọc thân component (Babel, đã có `parseJsxAst`) để gắn ý nghĩa cho từng prop theo mục 3.
- **Studio:** `component-props-section.tsx` viết lại thành mục Tùy chỉnh. Từ điển tên đặt trong i18n.
- **Bridge:** `componentUseOf` (spec-log #149) đã cho biết chỗ dùng đúng. Panel Lớp dùng cùng nguồn đó.
- Component lồng nhiều tầng (`ProductCard` → `Card` → `div`): lần prop qua từng tầng. Không lần được
  thì xếp vào Nâng cao, không đoán.
