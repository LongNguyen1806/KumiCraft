# Phase 4 — Lượt K9.6 B: Tương tác không cần code, lặp dữ liệu, khối mẫu mới, gói Biểu đồ, component thư viện

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này. **Chỉ bắt đầu sau khi lượt A (`p4-luot-k96a-cong-cu-thiet-ke.md`) đã được QA và commit**: lượt B dùng định nghĩa gói, cài gói và bảng props có kiểu của lượt A chặng 5.

Lượt này có **5 chặng**, làm **lần lượt từ chặng 6 đến chặng 10 trong cùng một lần chạy**. Xong **mỗi chặng**: `pnpm format`, `pnpm verify` toàn bộ phải xanh rồi mới sang chặng sau. Xong chặng 10: thêm `pnpm test:e2e` toàn bộ, tất cả xanh rồi báo cáo.

| Chặng  | Bước kế hoạch | Nội dung                                                                               |
| ------ | ------------- | -------------------------------------------------------------------------------------- |
| **6**  | K9.6-6        | Tương tác không cần code: Tab, Mở/đóng, Bật/tắt, Chọn một trong nhiều, Trình chiếu ảnh |
| **7**  | K9.6-7        | Lặp dữ liệu: 1 thẻ mẫu + bảng dữ liệu như Excel                                        |
| **8**  | K9.6-8        | Khoảng 15 khối mẫu mới trong Thư viện                                                  |
| **9**  | K9.6-9        | Gói Biểu đồ (Recharts)                                                                 |
| **10** | K9.6-10       | Component từ thư viện người dùng đã cài                                                |

## 0. Bối cảnh

Kế hoạch `p4-ke-hoach.md` mục **K9.6**; spec-log #98 và các mục lượt A. Nguyên tắc như lượt A (bắt buộc): code trong dự án là gốc, mọi code KumiCraft ghi vào dự án **sinh từ mẫu có sẵn** (không AI); mọi thao tác có Hoàn tác (`history:<loại>` + bản dịch + `HISTORY_KINDS`); **mọi hệ CSS như nhau** (Tailwind 3/4, CSS thường, CSS Modules, Sass/Less, Bootstrap; khối và mẫu có dạng `neutral` cho hệ không phải Tailwind); mỗi thao tác có công cụ MCP; chữ người dùng thấy có vi/en.

**Dựa trên lượt A:** `shared/src/packs/` (`PackManifest`, `PackBlock`, `PackComponent`, `PackProp`), `server/src/core/packs/` (cài/gỡ gói có Hoàn tác), `SetPropEditSchema` + mục "Thuộc tính component" trong Inspector, `kumicraft_insert_block`, khối `content.list`/`content.badge`, gói Icon, nhóm Hiệu ứng và Chuyển động. Đọc báo cáo lượt A và code thật trước khi làm; nếu lượt A đặt tên khác bản này thì theo code đã commit.

## 1. Mục tiêu (người dùng thấy gì)

### Chặng 6: Tương tác không cần code

Thư viện có nhóm **"Tương tác"**. Mỗi khối là một **component sinh từ mẫu**, state (`useState`) nằm sẵn **bên trong component đó**; người dùng không thấy và không phải viết code, chỉ:

- sửa **chữ, ảnh, class** của từng phần như mọi phần tử (các phần bên trong component hiện ra chọn được trên Canvas);
- **thêm/bớt mục** bằng nút (tab mới, câu hỏi mới, ảnh mới) — dữ liệu mục nằm trong file `.data.ts` (dùng chặng 7) hoặc trong JSX, chọn cách dễ sửa nhất và giải thích;
- chỉnh hành vi bằng **"Thuộc tính component"** (lượt A): mục mở sẵn, chỉ mở một mục một lúc, tự chạy trình chiếu, thời gian chuyển…

Khối: **Tab**, **Mở/đóng** (FAQ, cho phép nhiều mục), **Bật/tắt** (ví dụ chuyển sáng/tối cho một vùng), **Chọn một trong nhiều** (ví dụ chọn màu → đổi ảnh/chữ tương ứng), **Trình chiếu ảnh** (nút trước/sau, chấm, tự chạy). Trên Canvas chế độ **Xem thử** các khối chạy thật; chế độ thiết kế: bấm để chọn phần tử, có nút nhỏ "Mục kế" để xem các trạng thái khi thiết kế.

### Chặng 7: Lặp dữ liệu

- Chọn một thẻ (ví dụ thẻ đánh giá) → **"Lặp theo danh sách"**: KumiCraft tạo file dữ liệu `<Tên>.data.ts` (mảng đối tượng, mỗi trường lấy từ chữ/ảnh/link trong thẻ), thay thẻ bằng `{items.map((item) => (<thẻ mẫu dùng item.x/>))}` + `key`, `import` mảng dữ liệu.
- Nút **"Sửa dữ liệu"** mở **bảng như Excel**: thêm/xóa/sắp xếp dòng, sửa ô (chữ, số, link, ảnh chọn từ thư mục tài nguyên). Lưu ghi file dữ liệu (định dạng gọn, Prettier của dự án nếu có).
- Sửa thẻ mẫu trên Canvas (class, chữ cố định) thì mọi thẻ đổi theo; chữ lấy từ dữ liệu thì sửa trên Canvas = sửa ô tương ứng trong dữ liệu.
- **"Bỏ lặp"**: trả về các thẻ tĩnh (mỗi dòng dữ liệu một thẻ).

### Chặng 8: Khối mẫu mới

Khoảng **15 khối** đẹp, hiện đại, dùng icon/hiệu ứng/chuyển động/tương tác/lặp dữ liệu của các chặng trước: bảng giá (3 gói), lời chứng thực (lặp), FAQ (mở/đóng), số liệu nổi bật, logo đối tác (lặp), đội ngũ (lặp), tính năng có icon (lưới), CTA (2 kiểu), so sánh (bảng tick), timeline, thẻ blog (lặp), footer nhiều cột, hero (3 kiểu: ảnh bên, nền gradient, video/ảnh nền). Mỗi khối có `jsx` vi/en, `neutral` (hệ không phải Tailwind), từ khóa vi/en, ảnh thu nhỏ trong bảng Thư viện.

### Chặng 9: Gói Biểu đồ

Gói `charts` (Recharts) trong tab "Gói mở rộng": Cài (npm `recharts`) → khối **Biểu đồ đường, cột, tròn, vùng** → sinh component + file dữ liệu → chèn. "Sửa dữ liệu" dùng bảng của chặng 7. "Thuộc tính component": màu (các series), hiện lưới, chú thích, chiều cao, bo góc cột, đường cong/thẳng.

### Chặng 10: Component từ thư viện đã cài

Bảng Component có mục **"Từ thư viện"**: KumiCraft đọc `package.json` của dự án, với các thư viện giao diện đã cài (MUI, Ant Design, Chakra, shadcn/ui đã sinh vào dự án, Headless UI…) liệt kê component xuất ra và kiểu props (TypeScript của dự án, như `runners/prop-types`), kéo thả vào trang (thêm `import` đúng), chỉnh props dạng đơn giản qua "Thuộc tính component"; props phức tạp ghi "sửa trong editor".

## 2. Đọc trước (CW-52)

`README.md`; `p4-ke-hoach.md` mục K9.6; spec-log #84–#98 và các mục lượt A; báo cáo lượt A; code `shared/src/packs/`, `server/src/core/packs/`, `shared/src/library/`, `server/src/runners/prop-types.ts`, `server/src/core/source-editor/structure/`.

## 3. Hợp đồng

### 3.1. Chặng 6

1. Mỗi khối tương tác là một **gói nội bộ** (định nghĩa bằng `PackManifest` của lượt A, không npm), mẫu TS và JS, mỗi mẫu một component trong thư mục components của dự án (`designDirs.components`), tên không trùng (thêm số nếu trùng), state bên trong, **không phụ thuộc thư viện ngoài**, có thuộc tính trợ năng (`role="tablist"`, `aria-expanded`, `aria-controls`, điều khiển bằng bàn phím).
2. Props chỉnh được khai trong manifest (ví dụ Tab: `defaultIndex`; Mở/đóng: `multiple`, `defaultOpen`; Trình chiếu: `autoPlay`, `intervalMs`, `showDots`).
3. Thêm/bớt mục: thao tác cấu trúc có Hoàn tác (`history:addItem`/`history:removeItem` hoặc dùng nhân bản/xóa sẵn có nếu đủ — giải thích).
4. "Mục kế" khi thiết kế: Studio gửi Bridge, Bridge phát sự kiện mà component mẫu lắng nghe (chỉ khi có cờ thiết kế của KumiCraft), **không** sửa code.
5. MCP: chèn khối tương tác dùng `kumicraft_insert_block`/`kumicraft_install_pack` sẵn có; thêm `kumicraft_add_item`, `kumicraft_remove_item` nếu thêm thao tác mới.

### 3.2. Chặng 7

1. `MakeRepeatEditSchema` `{ kind: 'makeRepeat', loc, tag, name }` → tạo `<name>.data.ts|js` (cạnh file trang hoặc trong thư mục dữ liệu, ghi rõ), thay thẻ bằng `.map`; trường dữ liệu: mỗi chữ tĩnh, `src`, `href`, `alt` trong thẻ thành một trường (tên trường từ thẻ/class, không trùng); các thẻ giống hệt nằm cạnh nhau (do nhân bản) gộp thành nhiều dòng dữ liệu.
2. `SetDataEditSchema` `{ kind: 'setData', file, rows, before? }`: ghi lại mảng dữ liệu, kiểu trường giữ nguyên (chuỗi/số/boolean), Hoàn tác một bước.
3. `UnrepeatEditSchema`: ngược lại `makeRepeat`.
4. Sửa chữ trên Canvas trong thẻ lặp: chữ đến từ `item.x` → sửa ô dữ liệu của đúng dòng (Bridge biết chỉ số phần tử); chữ cố định → sửa thẻ mẫu.
5. Studio: bảng dữ liệu (component mới, ≤ 400 dòng mỗi file), mở từ Inspector khi chọn thẻ lặp hoặc từ "Thuộc tính component" khi component có file dữ liệu.
6. MCP: `kumicraft_make_repeat`, `kumicraft_get_data`, `kumicraft_set_data`, `kumicraft_unrepeat`.

### 3.3. Chặng 8

1. Khối mới trong `shared/src/library/` (tách file theo nhóm, ≤ 400 dòng), `LibraryBlockCategory` thêm nhóm nếu cần (ví dụ `marketing`), mọi khối có `neutral` đầy đủ; khối dùng tương tác/lặp thì là `PackBlock` (sinh component/file dữ liệu) thay vì JSX tĩnh.
2. Ảnh thu nhỏ: dựng từ chính khối (render trong Studio) hoặc SVG mô phỏng, không dùng ảnh ngoài mạng.
3. Tìm kiếm vi/en (`search.ts`).

### 3.4. Chặng 9

1. Gói `charts`: `npm: [{ name: 'recharts', version: <phiên bản ổn định ít nhất 2 tuần tuổi, ghi trong báo cáo> }]`, 4 khối, mẫu TS/JS sinh component bọc `ResponsiveContainer`, đọc dữ liệu từ file `.data.ts` (chặng 7), props trong manifest.
2. Dự án chưa cài `recharts`: chèn khối → hỏi cài (job cài gói của lượt A); không có mạng → báo rõ, không chèn nửa vời.
3. Test dùng tiến trình giả cho npm; E2E dùng fixture đã có `recharts` sẵn (thêm fixture mới nhỏ, ghi trong báo cáo) hoặc kiểm phần sinh file + props, không tải mạng.

### 3.5. Chặng 10

1. `server/src/core/packs/library-components.ts` (hoặc tên tương tự): với mỗi dependency của dự án có kiểu TypeScript, liệt kê component xuất ra (hàm/lớp trả JSX, `ForwardRefExoticComponent`…) và props đơn giản qua TypeScript của dự án (chạy trong runner con như `prop-types`, chỉ dự án đã tin cậy, có giới hạn thời gian và số component).
2. Danh sách thư viện được quét: danh sách cho sẵn (MUI `@mui/material`, `antd`, `@chakra-ui/react`, `@headlessui/react`, `@radix-ui/*`) + thư mục `components/ui` của shadcn trong dự án.
3. Chèn: thêm `import { X } from 'pkg'` đúng (không trùng), dùng thao tác chèn sẵn có.
4. Studio: mục "Từ thư viện" trong bảng Component (nhóm theo thư viện, tìm kiếm).
5. MCP: `kumicraft_list_library_components`, chèn qua `kumicraft_insert_jsx` có kiểm tra tên component hợp lệ hoặc công cụ mới.

## 4. Tình huống test (bắt buộc, tên test có `K9.6`)

**Chặng 6:** mỗi khối tương tác: sinh đúng file TS và JS, dự án build được, chạy thật (E2E bấm tab/mở FAQ/chuyển ảnh trong chế độ Xem thử), thêm/bớt mục, đổi props, Hoàn tác trả nguyên mọi file; hệ CSS thường có `neutral`.

**Chặng 7:** lặp 3 thẻ đánh giá giống nhau thành 1 thẻ + 3 dòng dữ liệu; sửa ô → Canvas đổi; sửa chữ trên Canvas của dòng 2 → đúng ô; sửa class thẻ mẫu → cả 3 đổi; bỏ lặp trả 3 thẻ tĩnh; Hoàn tác từng bước trả nguyên byte.

**Chặng 8:** mỗi khối mới chèn được trên Tailwind 4 và CSS thường, dự án build được, tìm được theo từ khóa vi và en.

**Chặng 9:** cài gói (tiến trình giả) + chèn biểu đồ đường → file component + dữ liệu đúng; sửa dữ liệu; đổi màu series qua props; gỡ gói trả nguyên `package.json`/lockfile/file sinh.

**Chặng 10:** fixture nhỏ có một thư viện giả trong `node_modules` (kèm `.d.ts`) → liệt kê component và props; chèn thêm `import` đúng; dự án chưa tin cậy → không quét.

**E2E** (`e2e/`, một file mỗi chặng): một luồng người dùng thật mỗi chặng trên Studio, kiểm file và Hoàn tác.

## 5. Bẫy đã biết

- Component mẫu chạy trong Canvas có Bridge chặn sự kiện ở chế độ thiết kế: tương tác chỉ chạy ở chế độ Xem thử; "Mục kế" đi qua Bridge.
- `.map` cần `key` ổn định (dùng trường `id` sinh khi tạo dữ liệu, không dùng chỉ số).
- `data-rc-loc` trong thẻ lặp: mọi bản lặp cùng một vị trí nguồn; Bridge phải cho biết chỉ số bản lặp để sửa đúng dòng dữ liệu.
- Mẫu JS và TS khác nhau (kiểu props): sinh đúng theo ngôn ngữ dự án.
- Ghi file theo cơ chế hiện có (spec-log #97), không tự `fs.writeFile`.
- File ≤ 400 dòng, hàm ≤ 50 dòng; ref theo QC-40.

## 6. Không được làm

- Không sửa `docs/spec.md`; không sửa fixture có sẵn (được thêm fixture mới).
- Dependency: chỉ được thêm vào **dự án người dùng** qua job cài gói; **không** thêm dependency vào KumiCraft (Recharts không vào KumiCraft).
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ; không commit; không chạy git checkout/restore/reset/stash/clean; không gọi mạng thật trong test.

## 7. Tự kiểm trước khi báo cáo (bắt buộc)

1. Sau mỗi chặng: `pnpm format` → `pnpm verify` toàn bộ xanh.
2. Sau chặng 10: thêm `pnpm test:e2e` toàn bộ xanh.
3. Chỉ báo cáo khi tất cả xanh; lỗi thì tự sửa đúng gốc rồi chạy lại, không dừng để hỏi.

## 8. Báo cáo (ngắn, tiếng Việt, ở cuối câu trả lời)

```
## BÁO CÁO K9.6 lượt B
- verify: <số test> xanh | e2e: <số> xanh
- Chặng 6..10: file tạo / file sửa (theo chặng)
- Phiên bản recharts trong gói: …
- Công cụ MCP mới: …
- Test cũ đã sửa và lý do: …
- Tình huống: 6a <tên test đúng như trong code> — đạt; …
- Hệ CSS chưa làm được điều gì (nếu có) và lý do: …
- Khác bản giao việc và lý do: …
```

Đề xuất commit message (một commit cho cả lượt):
`feat(studio): add interactive blocks, data lists, charts, ui libraries`
