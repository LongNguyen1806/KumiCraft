# Phase 4 — Lượt K9.6 A: Công cụ thiết kế nền tảng, icon, hiệu ứng, chuyển động, gói mở rộng

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

Lượt này có **5 chặng**, làm **lần lượt từ chặng 1 đến chặng 5 trong cùng một lần chạy**. Xong **mỗi chặng**: `pnpm format`, `pnpm verify` toàn bộ phải xanh rồi mới sang chặng sau. Xong chặng 5: thêm `pnpm test:e2e` toàn bộ, tất cả xanh rồi báo cáo.

| Chặng | Bước kế hoạch | Nội dung                                                                                                  |
| ----- | ------------- | --------------------------------------------------------------------------------------------------------- |
| **1** | K9.6-1        | Đổi loại thẻ, danh sách, chữ trong dòng (`span`), nhãn, đặt mọi thuộc tính an toàn, MCP chèn khối theo mã |
| **2** | K9.6-2        | Gói Icon không cần mạng (Lucide, chèn thành `<svg>` inline)                                               |
| **3** | K9.6-3        | Hiệu ứng: gradient, bóng màu/phát sáng, kính mờ, biến hình, bộ lọc                                        |
| **4** | K9.6-4        | Chuyển động: transition, trạng thái nhấn, animation, hiện dần khi cuộn                                    |
| **5** | K9.6-5        | Nền gói mở rộng: định nghĩa gói, cài/gỡ gói npm có Hoàn tác, bảng "Thuộc tính" cho props có kiểu          |

## 0. Bối cảnh

Kế hoạch `p4-ke-hoach.md` mục **K9.6**; spec-log #98. Bài thử 2026-11-09: một agent chỉ dùng khối Thư viện và nút Studio (qua MCP) dựng lại trang `/landing` của dự án Test UI chỉ giống khoảng 60%. Thiếu: icon, chữ tô màu trong dòng, nhãn nhỏ, đổi thẻ/danh sách, thuộc tính `id`/`aria-*`, hiệu ứng, chuyển động, tương tác, lặp dữ liệu. Lượt A làm phần nền; lượt B (bước 6–10) làm sau, dựa trên chặng 5 của lượt này.

**Nguyên tắc (bắt buộc):**

- Code trong dự án là gốc. Mọi code KumiCraft ghi vào dự án sinh từ **mẫu có sẵn trong KumiCraft**, không dùng AI.
- Mọi thao tác có **Hoàn tác** (một bước lịch sử, nhãn `history:<loại>` có bản dịch `history.<loại>` trong `common.json` vi/en, thêm vào `HISTORY_KINDS` của `features/editor/editor-toolbar.tsx`).
- **Mọi hệ CSS như nhau** (bộ nhớ style parity): Tailwind 4, Tailwind 3, CSS thường, CSS Modules, Sass/Less, Bootstrap. Tailwind ghi class; hệ khác ghi CSS qua lớp Style (`server/src/core/style/`, `style-apply*.ts`, `CSS_LONGHAND_OF` trong `shared/src/style.ts`). Không làm "chế độ rút gọn" cho hệ nào.
- Mỗi thao tác mới có **công cụ MCP** tương ứng (`packages/cli/src/mcp/`) cho agent bên ngoài.
- Mọi chữ hiện cho người dùng có trong `i18n/locales/vi` và `en`.

**Hiện nay (đọc trước khi sửa):**

- Sửa nguồn: `shared/src/source.ts` (các `*EditSchema`, `EDITABLE_ATTRS = ['href','src','alt','placeholder','type']`, `AnyEditSchema`, `AttributeLevelEditSchema`), `server/src/core/source-editor/` (`edit-mutations.ts`, `attribute-reader.ts`, `text-reader.ts`, `source-editor-service.ts`), thao tác cấu trúc `server/src/core/source-editor/structure/` (`structure-ops.ts`, `structure-runner.ts`, `wrap-ops.ts`, `imports.ts`, `placement-jsx.ts`, `insert-image.ts`).
- Inspector: `studio/src/features/inspector/` (`components/inspector-header.tsx` có ô chọn trạng thái hover/focus/disabled, `components/tag-attributes-section.tsx`, `components/inspector-property-groups.tsx`, `components/property-field.tsx`, `components/color-field.tsx`, `components/style-sources-section.tsx` cho hệ CSS, `use-live-edit.ts`, `inspector-scope.ts` tính `writePrefix`).
- Thuộc tính Tailwind: `shared/src/tailwind/` (`properties.ts`, `property-tables.ts`, `reader.ts`, `writer.ts`, `parser.ts`, `v3-names.ts` cho tên khác nhau giữa Tailwind 3 và 4, `palette.generated.ts`).
- Thư viện: `shared/src/library/` (`types.ts`: mỗi khối có `jsx` vi/en và `neutral` cho hệ không phải Tailwind; `blocks-basic.ts`, `blocks-advanced.ts`, `blocks-neutral.ts`, `render-block.ts`, `search.ts`), Studio `features/library/` (`library-panel.tsx`, `insert-block.ts`, `library-icons.ts`).
- Sửa chữ trên Canvas: Bridge `bridge/src/client/text-edit.ts`, Studio `features/text-edit/use-canvas-text-edit.ts`.
- Theme: `server/src/core/style/tokens/` (`token-service.ts`, `tokens-tailwind4.ts`, `tokens-css.ts`…), `THEME_TOKEN_KINDS` trong `shared/src/project.ts`.
- Cài gói có Hoàn tác: `server/src/core/project/router-install.ts` (cài react-router theo trình quản lý gói của dự án, lịch sử `history:routerInstall`).
- Đọc kiểu props bằng TypeScript của dự án: `server/src/runners/prop-types.ts` (dùng khi tách component, chỉ dự án đã tin cậy).
- MCP: `packages/cli/src/mcp/mcp-tools.ts`, `mcp-edit-tools.ts`, `mcp-structure-tools.ts`, `mcp-element.ts`.

## 1. Mục tiêu (người dùng thấy gì)

### Chặng 1: nền tảng sửa phần tử

- Inspector có ô **"Loại thẻ"**: đổi `div` thành `section`, `header`, `ul`… giữ nguyên class, thuộc tính, con.
- Thư viện có khối **Danh sách** (gạch đầu dòng, đánh số) và **Nhãn** (badge). Thêm mục danh sách bằng Nhân bản sẵn có.
- Đang sửa chữ trên Canvas, **bôi đen một phần chữ** → nút **"Tách thành đoạn riêng"** → phần đó thành `<span>` chọn được và tô màu, đổi cỡ, in đậm như mọi phần tử.
- Mục **Thuộc tính** trong Inspector: thêm/sửa/xóa `id`, `title`, `role`, `target`, `rel`, `name`, `aria-*`, `data-*`… (ngoài 5 thuộc tính cũ).
- Agent bên ngoài chèn khối Thư viện theo **mã khối**, không phải chép JSX.

### Chặng 2: Icon

- Thư viện có mục **Icon**: ô tìm (tên tiếng Anh của Lucide và từ khóa vi), lưới icon. Bấm/kéo → icon vào trang dưới dạng `<svg>` trong code (dự án **không** cần cài thêm gì, chạy được khi không có mạng).
- Chọn icon trên Canvas: Inspector có **"Đổi icon"** (mở lại lưới), **cỡ**, **màu**, **độ dày nét**.

### Chặng 3: Hiệu ứng

Nhóm Inspector **"Hiệu ứng"**, xem trước ngay trên Canvas:

- **Màu chuyển** cho nền (hướng + 2 hoặc 3 điểm màu) và cho **chữ** (chữ tô gradient).
- **Bóng**: mức có sẵn + **màu bóng** (phát sáng).
- **Kính mờ**: làm mờ phía sau (`backdrop-blur`) + nền bán trong suốt (màu có độ trong).
- **Biến hình**: xoay, phóng to/thu nhỏ, dịch ngang/dọc, nghiêng.
- **Bộ lọc**: sáng, tương phản, đen trắng, bão hòa, xoay màu; **hòa trộn** (`mix-blend-mode`).

### Chặng 4: Chuyển động

Nhóm Inspector **"Chuyển động"**:

- **Transition**: áp cho (tất cả / màu / biến hình / độ trong), thời gian, kiểu chuyển, độ trễ.
- Trạng thái thêm **"Nhấn"** (`active`) bên cạnh hover/focus/disabled đã có; trạng thái **"Khi rê chuột vào khối cha"** (`group-hover`, tự thêm `group` vào cha khi cần).
- **Animation**: chọn từ danh sách có sẵn (xoay, nhịp, nảy, ping) và các mẫu KumiCraft mang theo (hiện dần, trượt lên, phóng vào); mẫu cần `@keyframes` thì KumiCraft thêm vào file theme/CSS của dự án; nút **"Phát lại"** để xem trên Canvas.
- **"Hiện dần khi cuộn tới"**: bọc phần tử bằng component `Reveal` do KumiCraft sinh từ mẫu (một lần cho mỗi dự án, trong thư mục components của dự án).

### Chặng 5: Nền gói mở rộng và props có kiểu

- Thư viện có tab **"Gói mở rộng"**: danh sách gói (lượt A chỉ có **gói mẫu nội bộ** để kiểm; gói thật như Biểu đồ làm ở lượt B), nút **Cài / Gỡ** (có Hoàn tác).
- Chọn một component (thẻ viết hoa) trên Canvas: Inspector có mục **"Thuộc tính component"**: props dạng chữ, số, bật/tắt, danh sách chọn, màu, đọc từ kiểu TypeScript của component (component của dự án) hoặc từ định nghĩa gói. Đổi giá trị → KumiCraft sửa đúng prop trong code.

## 2. Đọc trước (CW-52)

`README.md` thư mục này; `p4-ke-hoach.md` mục K9.6; `docs/construction/spec-log.md` #84 (templateStatic), #85 (rule một class), #89 (chèn component điền props bắt buộc), #92 (theme theo `@import`), #94–#98; bộ nhớ dự án về style parity: mọi hệ CSS như nhau.

## 3. Hợp đồng

### 3.1. Chặng 1

1. **Đổi loại thẻ** — `SetTagEditSchema` `{ kind: 'setTag', loc, tag, to }` trong `AttributeLevelEditSchema` hoặc nhóm cấu trúc (chọn nơi hợp với code hiện có, giải thích trong báo cáo). `to` thuộc `CHANGEABLE_TAGS` (khai báo trong `shared`): `div section header footer main nav article aside figure figcaption ul ol li p span strong em small h1 h2 h3 h4 h5 h6 blockquote label`. Từ chối (E023 với lý do rõ): phần tử là component (chữ hoa), thẻ rỗng (`img`, `input`, `br`, `hr`), thẻ có ý nghĩa riêng (`a`, `button`, `form`, `select`, `textarea`, `svg`, `video`). Sửa cả thẻ mở và thẻ đóng; giữ mọi thứ khác từng byte. Lịch sử `history:setTag`. Inspector: ô chọn ở đầu Inspector (`inspector-header.tsx`). MCP `kumicraft_set_tag`.
2. **Danh sách** — khối Thư viện `content.list` (`ul` 3 `li`) và `content.orderedList` (`ol`), có `neutral` đầy đủ (style parity), từ khóa vi/en.
3. **Chữ trong dòng** — `WrapTextRangeEditSchema` `{ kind: 'wrapTextRange', loc, tag, start, end, before? }`: chỉ khi chữ của phần tử là chữ tĩnh (`ElementSourceText` kind tĩnh, một đoạn liền). `start/end` là vị trí ký tự trong chữ **nguồn** (không phải chữ hiển thị đã qua CSS). Kết quả: `trước<span>đoạn</span>sau`, `span` không class (người dùng tô sau). Phần tử có nhiều đoạn chữ/biểu thức xen kẽ: làm được nếu đoạn bôi đen nằm trọn trong **một** đoạn chữ tĩnh; không thì E023 lý do rõ. Bridge: khi đang sửa chữ và có vùng chọn, Studio hiện nút "Tách thành đoạn riêng" (gửi vị trí theo chữ nguồn). Lịch sử `history:wrapTextRange`. MCP `kumicraft_wrap_text_range` (`loc`, `text` cần tách: server tìm vị trí, mơ hồ thì báo lỗi).
4. **Nhãn** — khối `content.badge` (`span` dạng viên thuốc, chữ "Mới"), có `neutral`.
5. **Thuộc tính** — thay `EDITABLE_ATTRS` cố định bằng quy tắc: cho phép `id title role tabIndex target rel name value htmlFor download lang dir` + `aria-[a-z-]+` + `data-[a-z0-9-]+` + 5 thuộc tính cũ; **cấm** `on*`, `style`, `className` (đã có công cụ riêng), `key`, `ref`, `dangerouslySetInnerHTML`, `xmlns*`. Giá trị: chuỗi thuần; `href`/`src`/`action` không nhận `javascript:` (giữ kiểm tra hiện có nếu có, không có thì thêm). Xóa thuộc tính = `after` không có. Inspector `tag-attributes-section.tsx`: liệt kê thuộc tính chuỗi đang có, sửa, xóa, "Thêm thuộc tính" (gợi ý tên). MCP `kumicraft_set_attribute` nhận quy tắc mới.
6. **Chèn khối theo mã** — MCP `kumicraft_list_blocks` (mã, tên, nhóm) và `kumicraft_insert_block { blockId, target, language? }`: server dựng JSX của khối đúng hệ CSS của dự án (dùng `render-block.ts` như Studio), chèn như Studio.

### 3.2. Chặng 2

1. Thêm dependency **`lucide`** (ISC, cùng phiên bản với `lucide-react` 1.48.0 mà Studio đang dùng) vào `packages/server` — **dependency duy nhất được thêm ở lượt này**, ghi tên và giấy phép vào báo cáo. Studio vẽ lưới icon bằng `lucide-react` có sẵn.
2. `InsertIconEditSchema` `{ kind: 'insertIcon', target, icon }` (hoặc mở rộng chèn có sẵn): server sinh `<svg>` JSX từ dữ liệu icon của `lucide` (`xmlns`, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `aria-hidden="true"`, `data-kc-icon="<tên>"`, các `path/circle/…` con với thuộc tính camelCase). Cỡ mặc định: Tailwind `className="size-5"`; hệ khác `width="20" height="20"` (sửa cỡ qua thuộc tính hoặc lớp Style).
3. `SetIconEditSchema` `{ kind: 'setIcon', loc, icon?, strokeWidth? }`: thay toàn bộ con của `svg` có `data-kc-icon` và giá trị `data-kc-icon`; đổi `strokeWidth`. Giữ class và thuộc tính khác.
4. Studio: mục Icon trong Thư viện (tìm theo tên + từ khóa vi cho ~100 icon hay dùng: sao, tim, giỏ hàng, tìm kiếm, tick, mũi tên…, danh sách từ khóa trong `shared`), kéo thả như khối; Inspector khi chọn `svg[data-kc-icon]`: "Đổi icon", cỡ, màu (dùng `text-*`/`color`), độ dày nét.
5. MCP `kumicraft_list_icons { search? }`, `kumicraft_insert_icon`, `kumicraft_set_icon`.
6. Lịch sử `history:insertIcon`, `history:setIcon`.

### 3.3. Chặng 3

1. Thuộc tính mới (`shared/src/tailwind` + `CSS_LONGHAND_OF` + lớp Style), mỗi thuộc tính đọc được từ class/CSS hiện có và ghi lại đúng:
   - gradient nền: hướng (`bg-linear-to-*` Tailwind 4 / `bg-gradient-to-*` Tailwind 3, dùng `v3-names.ts`), điểm màu `from-* via-* to-*`; CSS: `background-image: linear-gradient(...)`;
   - chữ gradient: gradient + `bg-clip-text text-transparent`; CSS: `background-clip: text; color: transparent`;
   - màu bóng: `shadow-<màu>[/độ trong]`; CSS: ghép vào `box-shadow`;
   - `backdrop-blur-*`; CSS `backdrop-filter: blur()`;
   - nền có độ trong: màu kèm `/độ trong` (kiểm `color-field.tsx` đã hỗ trợ chưa, chưa thì thêm);
   - biến hình: `rotate-*`, `scale-*`, `translate-x-*`, `translate-y-*`, `skew-x-*`, `skew-y-*`; CSS `transform` (Tailwind 4 dùng `rotate/scale/translate` riêng: đọc kỹ cách Tailwind 4 sinh CSS);
   - bộ lọc: `brightness-* contrast-* grayscale saturate-* hue-rotate-*`; CSS `filter`;
   - `mix-blend-*`; CSS `mix-blend-mode`.
2. Studio: nhóm "Hiệu ứng" trong `inspector-property-groups.tsx` (tách file mới nếu dài), có xem trước như các nhóm khác; hệ CSS hiện trong bảng Style (`style-sources-section.tsx`) với ô phù hợp (gradient có ô chọn hướng + màu).
3. Theo breakpoint và trạng thái như mọi thuộc tính (`writePrefix`).

### 3.4. Chặng 4

1. Thuộc tính: `transition` / `transition-colors` / `transition-transform` / `transition-opacity` / `transition-all` / `transition-none`, `duration-*`, `ease-*`, `delay-*`; CSS `transition-property/-duration/-timing-function/-delay`.
2. Trạng thái: thêm `active` vào `InteractionStateSchema` (`shared/src/responsive.ts`) và `STYLE_STATES` (`shared/src/style.ts`) — kiểm mọi chỗ dùng bằng typecheck; thêm `group-hover`: chọn trạng thái này thì Studio hỏi khối cha nào là "nhóm", thêm class `group` vào cha (một bước lịch sử chung). Hệ CSS: `.cha:hover .con` qua lớp Style (giải thích cách làm trong báo cáo; nếu một hệ chưa làm được thì báo rõ, không giả vờ).
3. Animation: `animate-spin|ping|pulse|bounce` + mẫu KumiCraft `fade-in`, `slide-up`, `zoom-in`. Mẫu cần keyframes: Tailwind 4 thêm `--animate-<tên>` và `@keyframes` vào file `@theme` của dự án (qua dịch vụ token); Tailwind 3 thêm vào `tailwind.config` (`theme.extend.animation/keyframes`); CSS: thêm `@keyframes` vào file CSS chung + `animation:` qua lớp Style. Không thêm trùng nếu đã có. Nút "Phát lại" gửi Bridge chạy lại animation của phần tử (xóa và gắn lại animation trên DOM, không đổi code).
4. "Hiện dần khi cuộn tới": mẫu `Reveal.tsx`/`Reveal.jsx` (theo ngôn ngữ dự án) dùng `IntersectionObserver`, thêm class hiện khi vào màn hình, tôn trọng `prefers-reduced-motion`; sinh vào thư mục components của dự án (`designDirs.components`) nếu chưa có; bọc phần tử bằng `<Reveal>` + `import` (dùng thao tác bọc sẵn có). Một bước lịch sử `history:reveal`.
5. MCP cho từng thao tác mới (`kumicraft_set_animation`, `kumicraft_wrap_reveal`…; thuộc tính transition dùng `kumicraft_update_classes`/công cụ Style có sẵn nếu đủ, nếu không thì thêm).

### 3.5. Chặng 5

1. **Định nghĩa gói** (`shared/src/packs/`): `PackManifest` `{ id, name (vi/en), description, npm?: { name, version }[], blocks: PackBlock[], components: PackComponent[] }`; `PackBlock` `{ id, label vi/en, keywords, files: { path (theo `designDirs`), template }[], insert: { component, importFrom } }`; `PackComponent` `{ name, props: PackProp[] }`; `PackProp` `{ name, label vi/en, kind: 'text'|'number'|'boolean'|'enum'|'color', options?, default? }`. Mẫu file là chuỗi có chỗ thay (`{{componentName}}`…), viết cho TS và JS.
2. **Gói mẫu nội bộ** `kc-demo` (không có npm): một khối "Thẻ thống kê" sinh `StatCard.tsx` với props `value: string`, `label: string`, `highlight: boolean`, `tone: 'neutral'|'brand'` — dùng cho test và làm mẫu cho lượt B.
3. **Cài / gỡ gói** (`server/src/core/packs/`): job `project.packInstall` / `project.packRemove`, chỉ dự án đã tin cậy (E011), dùng trình quản lý gói của dự án như `router-install.ts`; một bước lịch sử trả lại `package.json` + lockfile (+ file đã sinh); không có mạng/lỗi npm → lỗi có mã và câu dễ hiểu. Test dùng tiến trình giả (không gọi npm thật trong test).
4. **Props có kiểu**: `SetPropEditSchema` `{ kind: 'setProp', loc, tag, name, value: { kind: 'text', text } | { kind: 'number', n } | { kind: 'boolean', on } | { kind: 'remove' }, before? }` — ghi `name="..."`, `name={12}`, `name` / `name={false}`; giữ props khác từng byte. Đọc props: component của dự án lấy kiểu qua `runners/prop-types` (chỉ dự án đã tin cậy; chưa tin cậy thì mục hiện "chỉ đọc") và quy về `PackProp.kind` (union chuỗi literal → `enum`, `string` có tên chứa color/colour → có ô chọn màu); component của gói lấy từ manifest. Props dạng hàm/đối tượng/mảng: hiện tên + "sửa trong editor", không sửa.
5. Studio: tab "Gói mở rộng" trong `library-panel.tsx` (tách file); mục "Thuộc tính component" trong Inspector (file mới).
6. MCP: `kumicraft_list_packs`, `kumicraft_install_pack`, `kumicraft_remove_pack`, `kumicraft_get_props`, `kumicraft_set_prop`.

## 4. Tình huống test (bắt buộc, tên test có `K9.6`)

**Chặng 1:** 1a đổi `div`→`section` giữ class/thuộc tính/con, Hoàn tác trả nguyên byte; 1b từ chối đổi component/`img`/`a`; 1c chèn `content.list` trên dự án Tailwind và dự án CSS thường (style parity); 1d tách "huyền thoại" trong `<h1>Âm thanh huyền thoại</h1>` thành `span`, chữ có `text-transform: uppercase` vẫn tách đúng theo chữ nguồn; 1e đoạn bôi đen vắt qua biểu thức → E023; 1f đặt `id="features"`, `aria-label`, `data-x`, xóa thuộc tính; từ chối `onClick`, `style`, `href="javascript:..."`; 1g MCP `kumicraft_insert_block` chèn `composite.hero` trên dự án Tailwind và CSS thường.

**Chặng 2:** 2a chèn icon `star` → `svg` đúng thuộc tính JSX, dự án build được (dùng kiểm tra build hiện có trong test server), Tailwind và CSS; 2b đổi icon `star`→`heart` giữ class; 2c đổi độ dày nét; 2d tìm "giỏ" ra `shopping-cart`; 2e Hoàn tác mọi thao tác.

**Chặng 3:** mỗi nhóm (gradient nền, chữ gradient, màu bóng, kính mờ, biến hình, bộ lọc, hòa trộn): đọc từ class/CSS có sẵn và ghi đúng cho Tailwind 4, Tailwind 3 (tên khác nhau), CSS thường; theo breakpoint và hover.

**Chặng 4:** transition + duration + ease ghi đúng mọi hệ; trạng thái `active` và `group-hover` (thêm `group` vào cha, một bước Hoàn tác); animation mẫu `fade-in` thêm keyframes đúng một lần (Tailwind 4 `@theme`, Tailwind 3 config, CSS); `Reveal` sinh một lần, bọc đúng, `import` đúng, Hoàn tác trả nguyên mọi file.

**Chặng 5:** manifest hợp lệ/không hợp lệ; cài `kc-demo` sinh file, chèn component, Hoàn tác xóa file đã sinh; cài gói có npm dùng tiến trình giả, Hoàn tác trả `package.json` + lockfile; `setProp` text/number/boolean/remove giữ byte phần khác; đọc kiểu props component dự án thành ô đúng loại; dự án chưa tin cậy → chỉ đọc.

**E2E** (`e2e/`, một file mỗi chặng, dùng dự án mẫu `fixtures/projects/*`): mỗi chặng ít nhất một luồng người dùng thật trên Studio: chọn → thao tác → thấy trên Canvas → kiểm file → Hoàn tác.

## 5. Bẫy đã biết

- Vị trí chữ khi tách `span`: Canvas hiện chữ **sau CSS** (`text-transform`, khoảng trắng gộp); phải quy về vị trí trong chữ **nguồn** (bài học spec-log #86).
- `writePrefix` có cả breakpoint và trạng thái (`md:hover:`): giữ thứ tự Tailwind.
- Tailwind 3 và 4 khác tên (`bg-gradient-to-r` / `bg-linear-to-r`, `shadow-sm` đổi thang): dùng `v3-names.ts`, có test cả hai.
- Dự án CSS thường: phần tử có rule một class thì ghi vào rule đó (spec-log #85), không sinh class mới vô cớ.
- `svg` trong JSX: thuộc tính camelCase (`strokeWidth`), không `class`.
- Ghi file theo cơ chế hiện có (đã có báo Vite đọc lại khi ghi dồn: spec-log #97); không tự `fs.writeFile`.
- Cài gói: không chạy npm thật trong test; `pnpm`/`npm`/`yarn` theo lockfile; monorepo dùng gốc workspace (K5).
- File ≤ 400 dòng, hàm ≤ 50 dòng: tách file mới, không nhồi vào file sẵn dài.
- Ref DOM theo QC-40: `ref={(el) => { r.current = el ?? undefined; }}`.

## 6. Không được làm

- Không sửa `docs/spec.md`; không sửa `fixtures/` có sẵn (được **thêm** fixture mới nếu cần, ghi trong báo cáo).
- Không thêm dependency ngoài `lucide` (chặng 2).
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ cho xanh; không lọc theo đúng giá trị của test.
- Không commit; không chạy git checkout/restore/reset/stash/clean; không cài gói ngoài `lucide`.
- Không làm phần của lượt B (tương tác không cần code, lặp dữ liệu, khối mẫu mới ngoài 3 khối ở chặng 1, gói Biểu đồ, component thư viện ngoài).

## 7. Tự kiểm trước khi báo cáo (bắt buộc)

1. Sau mỗi chặng: `pnpm format` → `pnpm verify` toàn bộ xanh.
2. Sau chặng 5: thêm `pnpm test:e2e` toàn bộ xanh.
3. Chỉ báo cáo khi tất cả xanh; lỗi thì tự sửa đúng gốc rồi chạy lại, không dừng để hỏi.

## 8. Báo cáo (ngắn, tiếng Việt, ở cuối câu trả lời)

```
## BÁO CÁO K9.6 lượt A
- verify: <số test> xanh | e2e: <số> xanh
- Dependency thêm: lucide <phiên bản> (ISC)
- Chặng 1..5: file tạo / file sửa (theo chặng)
- Công cụ MCP mới: …
- Test cũ đã sửa và lý do: …
- Tình huống: 1a <tên test đúng như trong code> — đạt; …
- Hệ CSS chưa làm được điều gì (nếu có) và lý do: …
- Khác bản giao việc và lý do: …
```

Đề xuất commit message (một commit cho cả lượt):
`feat(studio): add tag, span, icon, effect, motion and pack tools`
