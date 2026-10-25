# Kế hoạch Phase 4 — Mọi dự án, mọi hệ CSS (bản tổng quát)

Viết 2026-10-24, sau cổng G3 (verify 1217 test, trace Phase 3 351/351, E2E 32/32, chủ dự án kiểm tay đạt). Đây là **danh sách việc mức tổng quát**. Mỗi đợt giao việc sẽ có bản chi tiết riêng (`p4-luot*.md`): hợp đồng, thuật toán, tình huống test, kiểm tay.

## 1. Mục tiêu

KumiCraft trở thành công cụ thiết kế cho **dự án có sẵn của người dùng**, không chỉ dự án React + Vite + Tailwind do nó tạo ra:

- Chỉnh kiểu dáng trực quan như nhau cho Tailwind, CSS thường, CSS Modules, Bootstrap (nguyên tắc style-parity: không có "chế độ rút gọn").
- "Thêm trang" chạy trên dự án cũ bằng cách quét dự án để biết route đặt ở đâu và trang được viết theo kiểu nào.
- Mở và sửa được dự án ngoài React + Vite: React chạy webpack, Vue, Express + Pug, ASP.NET Core Razor.
- Phần còn lại của khung Phase 4 cũ (SPEC-04 mục 25) và phát hành 1.0.

## 2. Quyết định của chủ dự án (2026-10-24)

| #   | Quyết định                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | JSX chèn qua MCP hoặc Thư viện: server **định dạng đoạn vừa chèn** (theo Prettier của dự án nếu có), không đụng phần còn lại; vẫn là một bước Undo |
| 2   | Thêm trang: **không giả định** tên file hay quy ước. App quét dự án tìm nơi khai báo route và học cách viết trang của dự án                        |
| 3   | CSS thường, CSS Modules, **Bootstrap** bắt buộc có thuộc tính chỉnh trong Inspector, qua **một interface chung** (lớp style)                       |
| 4   | Đa nền tảng, có **ASP.NET Core Razor** (chủ dự án đang học, chắc chắn làm). Thứ tự: React không Vite → Express + Pug → Vue → Razor                 |
| 5   | Terminal nhúng (node-pty) và adapter Codex CLI: **để sau**, không thuộc Phase 4                                                                    |
| 6   | Viết kế hoạch tổng quát trước; mỗi đợt giao việc mổ xẻ chi tiết                                                                                    |

## 3. Hiện trạng đầu Phase 4

| Phần                     | Đã có                                                                                                                                        | Giới hạn hiện tại                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Adapter framework        | `FrameworkAdapter` (`server/src/core/project/frameworks/types.ts`): `detect`, `sourceExtensions`, `runner`, `template`                       | Có hình dạng React + Vite: một runner Vite, plugin Babel đóng dấu `data-rc-loc`, sửa bằng AST Babel |
| Đóng dấu vị trí          | Plugin Vite/Babel gắn `data-rc-loc="file:dòng:cột"` cho mọi thẻ JSX                                                                          | Chỉ JSX/TSX qua Vite                                                                                |
| Sửa code                 | M-SE: thao tác class, chữ, thuộc tính, chèn, di chuyển, bọc… trên AST Babel, giữ định dạng (magic-string)                                    | Chỉ JSX                                                                                             |
| Nhận diện hệ CSS         | `support.styling` (lượt S1): Tailwind, CSS, CSS Modules, Sass, Less, Bootstrap, styled-components, Emotion, MUI, antd, Chakra                | Chỉ **Tailwind 4** sửa được; hệ khác ẩn công cụ kiểu dáng                                           |
| Brand / token            | `@theme` của Tailwind 4 (M-TK một phần, lượt Brand Phase 2)                                                                                  | Không đọc biến `:root`, biến Sass Bootstrap                                                         |
| Tách component           | "Tạo component" (Phase 2 lượt 8–9, M-XC một phần)                                                                                            | Rà lại phần còn thiếu của FR-72 ở WP-4.00                                                           |
| Trang                    | R-PG-10: chỉ `src/routes.tsx` với `createBrowserRouter([...])` viết sẵn                                                                      | Dự án cũ đặt route chỗ khác thì Thêm trang bị từ chối                                               |
| Thư viện khối            | Khối viết bằng class Tailwind 4 (R-LB-11)                                                                                                    | Không dùng được với hệ khác                                                                         |
| Việc hoãn từ phase trước | Hiệu năng PB-01 đến PB-05 (R-IN-21, R-SL-12, S-86, R-SE-16), R-FW-05, R-QA-01, `cn('tĩnh', …)` (L-01), phát hành S-89a, S-90 đến S-96, S-130 | Ghi trong `scripts/trace-scope.json` (phase 4) và spec-log                                          |

## 4. Các khối việc

Mỗi khối chia thành nhiều lượt (≤ 600 dòng code, ≤ 15 tình huống test mỗi lượt) khi viết bản giao việc. Mức tốn: thấp / vừa / cao / rất cao.

### K0. WP-4.00: chốt hợp đồng và spec (Claude, trước mọi lượt)

- Sửa SRS và SPEC-01: phạm vi sản phẩm không còn là "React + Vite + Tailwind"; ghi danh sách framework và hệ CSS mục tiêu.
- Viết chi tiết SPEC-04 mục 25 cho các khối dưới đây, kèm bảng **Kiểm thử bắt buộc** (CW-50).
- ADR mới cho 3 hợp đồng dùng chung, vì các khối sau dựa vào chúng:
  - lớp style (K2);
  - adapter framework tổng quát (K4);
  - bộ tìm route (K3).
- Spike có ghi kết quả trước khi làm khối tương ứng:
  - VG-20: đóng dấu vị trí cho Pug;
  - VG-21: Razor (cách gắn `data-rc-loc`, chạy `dotnet watch`, đọc `.cshtml`);
  - VG-22: Vue SFC.
- Rà các mã phase 4 đang treo trong trace; chuyển sang phase sau những mã không còn hợp.

Tốn: **cao** (một lần, nhưng tránh phải sửa lại hợp đồng ở giữa phase).

**Đã làm 2026-10-24:**

- SRS lên 5.1 (mục 0.4, PR-02, PR-08, mục 8, FR-20, FR-23, FR-32 mới, FR-50, FR-51, FR-70, FR-71, L-07, L-08, L-09).
- `docs/spec.md`:
  - C-03, ADR-BE-35 (lớp style), ADR-BE-36 (adapter ghép, Proposed), ADR-BE-37 (tìm route), ADR-BE-38 (định dạng đoạn chèn);
  - bảng công nghệ thêm `postcss`, `postcss-scss`, `postcss-less`;
  - PB-10, PB-11; VG-19 đến VG-22;
  - SPEC-04 mục 25: M-FM, M-ST, M-RT chi tiết, M-FX khung;
  - SPEC-03 mục 9, SPEC-06 fixture, SPEC-07 mục 6 (WP-4.00 đến 4.90).
- `scripts/trace-scope.json`: `R-FM`, `R-ST`, `R-RT` thuộc phase 4.

**Đổi so với kế hoạch:** VG-19 (cascade CSS) làm ở lượt đầu của K2. VG-20 đến 22 làm ở đầu đợt Pug, Vue, Razor, vì cần cài framework đó và kết quả chỉ dùng cho đợt đó. Rà các mã phase 4 đang treo để lại cho K9.

### K1. Định dạng JSX vừa chèn (quyết định 1)

- Sau mỗi thao tác chèn (MCP `insert_jsx`, Thư viện, Component, dán), định dạng **chỉ phần vừa chèn**:
  - dùng Prettier của dự án nếu dự án có cài và có cấu hình;
  - không có thì dùng bộ thụt lề JSX đơn giản theo thụt lề của dòng cha.
- Một bước Undo; không đổi byte nào ngoài vùng chèn.
- Sau này adapter template của framework khác (K4) cũng dùng chung bước này.

Tốn: **vừa**.

### K2. Lớp style: một interface cho mọi hệ CSS (quyết định 3)

**Hợp đồng chung.** Inspector, Brand, Thư viện, công cụ vẽ, MCP và lời nhắc AI chỉ dùng **mô hình thuộc tính chung**: khoảng cách, kích thước, màu, chữ, viền, bo góc, bóng, bố cục flex/grid, vị trí, hiển thị theo breakpoint. Mỗi hệ CSS có một `StyleAdapter`:

| Việc của adapter  | Nội dung                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đọc               | Giá trị hiện tại của từng thuộc tính cho một phần tử, và **nguồn** của nó (class, rule trong file `.css` ở `file:dòng`, class của `.module.css`, utility Bootstrap) |
| Phạm vi ảnh hưởng | Sửa nguồn đó thì bao nhiêu phần tử đổi theo (rule `.card` dùng ở 12 chỗ)                                                                                            |
| Ghi               | Đổi một thuộc tính bằng sửa văn bản tối thiểu ở đúng nguồn; một bước Undo                                                                                           |
| Token             | Danh sách token của hệ cho Brand: `@theme` (Tailwind 4), `theme.extend` (Tailwind 3), biến `:root`, biến Sass của Bootstrap                                         |
| Khối mẫu          | Dựng khối Thư viện từ định nghĩa trung tính sang cách viết của hệ (class Tailwind, class Bootstrap, rule CSS mới)                                                   |

**Adapter cần làm, theo thứ tự:**

1. **Tailwind 4:** chuyển code hiện có vào sau interface; không đổi hành vi (test cũ phải xanh nguyên).
2. **CSS thường:**
   - đọc rule khớp phần tử (cùng file import và file `.css` toàn cục), theo độ ưu tiên selector;
   - ghi vào rule đó, hoặc tạo class riêng khi người dùng chọn "chỉ phần tử này";
   - Inspector hiện "Ảnh hưởng N phần tử".
3. **CSS Modules:** như CSS thường nhưng gắn với `styles.x` trong JSX và file `.module.css` đi kèm.
4. **Bootstrap 5:** class utility (`p-3`, `text-primary`, `d-flex`…) cho thuộc tính có utility; thiếu utility thì rơi về CSS thường; token là biến Sass hoặc biến CSS `--bs-*`.
5. **Tailwind 3** (nằm trong khung cũ M-SC): như Tailwind 4, token đọc từ `tailwind.config`.
6. **Sass / Less:** đọc và ghi như CSS thường trên file nguồn `.scss` / `.less`. Lồng selector và mixin chỉ đọc nếu VG cho thấy ghi không an toàn.

**Trường hợp không sửa trực quan được** (giá trị tính bằng biểu thức, style nội tuyến động, CSS-in-JS khi chưa có adapter): mọi hệ xử lý giống nhau, tức báo lý do và có nút mở trong editor (như E023).

Tốn: **rất cao** (khối lớn nhất của phase; chia khoảng 6 đến 8 lượt).

**Chia lượt (chủ dự án, 2026-10-24): mỗi khối 1–2 lượt, không có lượt cổng riêng.** E2E của khối Claude viết trong lượt QA; chủ dự án kiểm tay sau K3 và trước khi phát hành. Còn khoảng 13 lượt (2026-10-25: K3 thành 4 lượt K3a–K3d vì thêm thanh hoạt động và cây thư mục). **Phát hành (chủ dự án 2026-10-25): phương án A**, làm đủ mọi framework (K3 đến K9) rồi mới phát hành 1.0 ở K10; không phát hành bản React + Vite riêng trước.

| Lượt           | Nội dung                                                                                                                                                    | Ai                   | Trạng thái |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------- |
| K2a, K2b       | Đọc + sửa CSS thường, VG-19                                                                                                                                 | Claude               | Xong       |
| K2c            | CSS Modules (`p4-luot-k2c-css-modules.md`)                                                                                                                  | Gemini               | Xong       |
| K2d            | Bootstrap 5 + `:hover`/`:focus`/`:disabled` + xem trước khi kéo (R-ST-13), `p4-luot-k2d-bootstrap-trang-thai.md`                                            | Gemini               | Xong       |
| K2e            | Token/Brand mọi hệ (CSS, Sass, Less, Bootstrap) + sửa Sass/Less, `p4-luot-k2e-token-sass-less.md`                                                           | Gemini               | Xong       |
| K2f            | Khối Library theo hệ chính + Tailwind 3; Claude đưa Tailwind 4 vào interface chung ở lượt QA, E2E Bootstrap/Sass/Less; `p4-luot-k2f-thu-vien-tailwind3.md`  | Gemini + Claude      | Xong       |
| K3a–K3d        | Thanh hoạt động kiểu VS Code · cây thư mục (xem, mở, tạo, đổi tên, xóa) · bộ chọn thư mục, `designDirs` nhiều thư mục · bộ tìm route, mẫu trang, Cài router | Gemini               | —          |
| K4/K5 (2 lượt) | Tách adapter framework · React webpack/CRA, JS thuần, monorepo                                                                                              | Gemini               | —          |
| K6 (2 lượt)    | Express + Pug: VG-20 + proxy + đóng dấu · sửa template + route                                                                                              | Claude (VG) + Gemini | —          |
| K7             | Vue                                                                                                                                                         | Gemini               | —          |
| K8 (2 lượt)    | Razor: VG-21 + `dotnet watch` + bộ đọc `.cshtml` · sửa + route                                                                                              | Claude (VG) + Gemini | —          |
| K9             | Nhiều khung, kiểm tra build, `cn()`, breakpoint, viền, hiệu năng                                                                                            | Gemini               | —          |
| K10            | Tài liệu, giấy phép, phát hành 1.0                                                                                                                          | Gemini + Claude      | —          |

### K3. Cây thư mục dự án, bộ tìm route và mẫu trang (quyết định 2; chủ dự án 2026-10-25)

**Ý tưởng (chủ dự án 2026-10-25):** hiện cây thư mục thật của dự án trong KumiCraft. Người dùng **tự chọn** thư mục để tạo trang, component, layout, thay vì KumiCraft đoán chỗ đặt. Cây cho **xem, mở, tạo mới, đổi tên, xóa** (chủ dự án 2026-10-25: người dùng biết code, lỗi do đổi tên/xóa thì họ tự sửa). Trước khi đổi tên/xóa: cảnh báo cụ thể danh sách file đang `import` file đó (hoặc số file trong thư mục) sẽ lỗi; file là trang có trong router thì dùng luồng Xóa trang / Đổi tên trang sẵn có (`page-delete.ts`, `page-rename.ts`, tự sửa route). Mọi đổi tên/xóa là **một mục lịch sử**, Undo khôi phục đúng từng byte. Không kéo thả để di chuyển file (dùng đổi tên đường dẫn).

**Gốc vấn đề hôm nay:** thư mục làm việc bị cố định trong `workspace.json` khóa `designDirs` (`pages`, `layouts`, `components`, `drafts`), mỗi loại **một** thư mục; chỗ cần chọn thư mục khác thì là **ô gõ đường dẫn tay**. Dự án thật như WorkTracker (`layouts/`, `router/`, `stores/`, `services/`, `pages/<nhóm>/`) vì vậy khó dùng.

**Thanh hoạt động bên trái (chủ dự án 2026-10-25), kiểu VS Code.** Hôm nay sidebar trái là 3 tab (Lớp, Thư viện, Component) trong `features/editor/side-panels.tsx`; phải là 3 tab (Thuộc tính, Brand, Chat); Trang và Bản nháp mở bằng hộp thoại đè lên Canvas (`pages-dialog.tsx`, `drafts-dialog.tsx`). Thêm Thư mục thì hàng tab không đủ chỗ, tính năng sau càng khó xếp. Đổi thành:

- Một **dãy icon dọc ngoài cùng bên trái**; bấm icon mở panel tương ứng; bấm lại icon đang mở thì **thu gọn** panel để Canvas rộng ra; nhớ panel đang mở theo từng máy (như `kumicraft.leftPanelTab` hiện có).
- Icon trên (theo thứ tự): **Thư mục** (mới), **Lớp**, **Thư viện**, **Component**, **Trang** (hộp thoại thành panel), **Bản nháp** (hộp thoại thành panel), **Brand** (chuyển từ panel phải sang).
- Icon dưới cùng: **Cài đặt** (chuyển từ thanh trên).
- Panel phải chỉ còn **Thuộc tính** và **Chat AI** (hai thứ dùng cùng lúc với Canvas).
- Mỗi icon có tooltip vi/en, phím tắt mở (`Ctrl/Cmd+Shift+E` Thư mục, các phím khác chọn không trùng phím tắt có sẵn), và **huy hiệu** khi cần (số lỗi build ở Thư mục, số bản nháp).
- **Giữ nút đóng/mở sidebar** (chủ dự án 2026-10-25): hai nút tròn bật/tắt panel trái, phải trên thanh công cụ Canvas (`PanelToggle` trong `editor-toolbar.tsx`) và phím tắt `panels` giữ nguyên tác dụng. Đóng panel trái thì **dãy icon vẫn hiện** (mảnh, như VS Code) để mở lại bằng một lần bấm icon; bấm icon khi panel đang đóng thì mở đúng panel đó và nút tròn chuyển sang trạng thái mở. Nút tròn, phím tắt và việc bấm lại icon đang mở dùng **chung một trạng thái** (không lệch nhau).
- Thêm tính năng sau này = thêm một mục vào danh sách icon (một mảng cấu hình), không sửa bố cục.

**Thống kê tính năng đã có hưởng lợi từ cây thư mục** (đã kiểm code 2026-10-25):

| #   | Tính năng (code hiện tại)                                                                      | Đang khó dùng ở đâu                                                                                    | Cải tiến khi có cây                                                                                      | Lượt  |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----- |
| 1   | **Thêm trang** (`pages/add-page-form.tsx`, server `page-add.ts`)                               | Mặc định `designDirs.pages`; muốn chỗ khác phải gõ tay đường dẫn vào ô `dir`                           | Bấm thư mục trên cây (hoặc chuột phải → "Thêm trang ở đây"); ô `dir` thành bộ chọn thư mục               | K3b   |
| 2   | **Tách thành component** (`components-panel/extract-dialog.tsx`, `component-extract.ts`)       | Mặc định `designDirs.components`; chỗ khác phải gõ tay                                                 | Chọn thư mục đích trên cây                                                                               | K3b   |
| 3   | **Đưa bản nháp thành trang/component** (`drafts/promote-draft-dialog.tsx`, `draft-promote.ts`) | Như trên, gõ tay `dir`                                                                                 | Chọn thư mục đích trên cây                                                                               | K3b   |
| 4   | **Cài đặt thư mục thiết kế** (`project/design-dirs-form.tsx`, `validateDesignDirs`)            | Gõ tay 3 đường dẫn; mỗi loại chỉ một thư mục                                                           | Chuột phải thư mục → "Đặt làm thư mục trang / layout / component"; cho phép **nhiều** thư mục mỗi loại   | K3b   |
| 5   | **Panel Component** (`components-panel`, server `components-list.ts`)                          | Chỉ quét `designDirs.components` và `designDirs.layouts`; component ở `pages/x/components/` không thấy | Quét mọi thư mục đã đặt (mục 4); kéo file component từ cây thẳng vào Canvas để chèn                      | K3b   |
| 6   | **Chế độ sửa trang/layout/component/nháp** (`design/design-target.ts`, `design-bar.tsx`)       | Vào qua panel hoặc chọn phần tử trên Canvas                                                            | Bấm file `.jsx/.tsx` trên cây → mở đúng chế độ sửa của file đó                                           | K3a   |
| 7   | **Cây Lớp và chọn phần tử** (`layers/`, `selection/`)                                          | Không biết phần tử thuộc file nào (trang hay `Header.jsx`)                                             | Chọn phần tử → cây thư mục tự mở tới file của nó và tô đậm                                               | K3a   |
| 8   | **Lỗi build** (`canvas-errors/build-error-banner.tsx`)                                         | Chỉ có banner ghi tên file                                                                             | File lỗi có dấu đỏ trên cây; bấm → mở trong editor                                                       | K3a   |
| 9   | **Chat AI** (`chat/chat-files.tsx`, `chat-context.tsx`, `chat-attachments.tsx`)                | File AI vừa sửa chỉ thấy trong danh sách của lượt chat; muốn chỉ cho AI một thư mục phải gõ tên        | File AI vừa sửa có dấu trên cây; kéo file/thư mục từ cây vào ô chat thành ngữ cảnh                       | K3a   |
| 10  | **Danh sách trang** (`pages.ts`, đọc file router) và **Thêm trang** khi không tìm được router  | Không tìm được file router thì không thêm route được; phải sửa tay                                     | Bộ tìm route (dưới); không chắc chắn → người dùng **bấm file router trên cây** thay vì gõ đường dẫn      | K3c   |
| 11  | **Mẫu trang mới** (kế hoạch K3 cũ: đoán theo trang giống nhất trên toàn dự án)                 | Đoán trên toàn dự án dễ sai                                                                            | Học theo các file **cùng thư mục** người dùng đã chọn (import component chung, bọc layout, cách đặt tên) | K3c   |
| 12  | **Lớp style "chỉ phần tử này"** (`style-apply.ts`, `cssFileFor`)                               | Chưa có file CSS thì tự tạo `<File>.css` cạnh JSX, không hỏi                                           | Mặc định giữ như cũ; thêm lựa chọn chỗ đặt file CSS mới trên cây                                         | K3b   |
| 13  | **Brand** (K2e: file token theo hệ chính)                                                      | Dự án có nhiều file CSS/SCSS toàn cục thì chỉ lấy file đầu                                             | Chọn file token trên cây (lưu vào `workspace.json`)                                                      | K3b   |
| 14  | **Dự án lồng thư mục** (K5 monorepo; ví dụ WorkTracker có `backend/` + `frontend/`)            | Phải mở đúng thư mục `frontend/`                                                                       | Mở từ gốc repo → cây hiện cả repo, người dùng chọn thư mục ứng dụng                                      | K5    |
| 15  | **Framework khác** (K6 Pug `views/`, K7 Vue `src/views/`, K8 Razor `Pages/`)                   | Mỗi framework phải có cách đoán chỗ đặt trang riêng                                                    | Cùng một giao diện "chọn thư mục → tạo trang"; adapter chỉ cần biết đuôi file và mẫu file                | K6–K8 |

**Chia lượt K3 (2026-10-25: 4 lượt vì thêm thanh hoạt động):**

| Lượt    | Tính năng (số trong bảng)               | Người dùng thấy gì                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **K3a** | Thanh hoạt động bên trái                | Dãy icon dọc kiểu VS Code; Lớp, Thư viện, Component, Trang, Bản nháp, Brand, Cài đặt thành các panel mở bằng icon; bấm lại để thu gọn; panel phải còn Thuộc tính và Chat. Chưa có tính năng mới, chỉ sắp lại cho gọn và chừa chỗ.                                                                                                                                                         |
| **K3b** | Cây thư mục + 6, 7, 8, 9 + đổi tên, xóa | Icon "Thư mục": cây thật của dự án, bỏ qua `node_modules`, `dist`, `.git`, `.kumicraft`, cập nhật khi file thêm/xóa từ ngoài. Bấm file giao diện → mở chế độ sửa; chuột phải → "Mở trong editor", "Tạo file/thư mục", "Đổi tên", "Xóa" (cảnh báo danh sách file đang import, Undo được). Phần tử đang chọn, file lỗi build, file AI vừa sửa có dấu trên cây. Kéo file/thư mục vào ô chat. |
| **K3c** | 1, 2, 3, 4, 5, 12, 13                   | Mọi ô gõ đường dẫn thư mục (Thêm trang, Tách component, Đưa nháp) thành **bộ chọn thư mục** dùng chung với cây; chuột phải thư mục → "Thêm trang ở đây", "Đặt làm thư mục component"…; `designDirs` cho nhiều thư mục mỗi loại (đổi định dạng `workspace.json`, chuyển đổi một lần); panel Component thấy component ở mọi thư mục đã đặt; chọn chỗ đặt file CSS mới và file token Brand.  |
| **K3d** | 10, 11 + bộ tìm route + Cài router      | Thêm trang tự thêm route đúng file router (kể cả `router/AppRouter.jsx` như WorkTracker), trang mới viết theo mẫu các file cùng thư mục; không chắc thì hỏi bằng cách bấm file router trên cây; dự án chưa có router có nút "Cài router".                                                                                                                                                 |

Mục 14, 15 làm trong K5 đến K8, dùng lại cây và bộ chọn thư mục của K3b, K3c.

**Bộ tìm route (K3d):**

- đi từ file khởi động (`main.*`, `index.*`, entry trong `index.html`) theo các `import`;
- nhận ra các kiểu: `createBrowserRouter([...])`, `<Routes><Route/></Routes>`, mảng route import từ file khác, route lồng nhau, `lazy()`;
- kết quả: file, dòng, kiểu khai báo, danh sách route đọc được;
- **không chắc chắn** (route sinh bằng code, nhiều router): hỏi người dùng bấm file router trên cây, không đoán;
- **dự án chưa có router:** nút "Cài router" (cài `react-router`, tạo file route, sửa entry) có xác nhận trước và hoàn tác được;
- đổi R-PG-10 thành "quy ước đọc được của bộ tìm route"; MCP `create_page` dùng chung. Framework khác (K5 đến K8) có bộ tìm route riêng: Express `app.get` / `router.get` + `res.render`; ASP.NET Core `Pages/` hoặc controller + `Views/`; Vue `vue-router`.

**Mẫu trang (K3d):** trang mới học theo các file trong thư mục người dùng chọn (import component chung, bọc layout, cách đặt tên, đuôi file); thư mục trống thì học theo thư mục trang gần nhất.

Tốn: K3a **vừa**, K3b **vừa đến cao** (đổi tên, xóa), K3c **vừa đến cao** (đổi `designDirs`), K3d **cao**.

### K4. Adapter framework tổng quát

Tách `FrameworkAdapter` thành các phần ghép được, để mỗi framework chỉ viết phần riêng của nó:

| Phần             | Việc                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nhận diện        | Đọc `package.json`, `*.csproj`, file cấu hình → framework, phiên bản, ngôn ngữ template, hệ CSS                                                          |
| Runner           | Chạy dev server của dự án (Vite, webpack, `node`/`nodemon`, `dotnet watch`), hoặc **proxy** đứng trước server của dự án để chèn Bridge vào HTML trả về   |
| Đóng dấu vị trí  | Gắn `data-rc-loc` cho HTML sinh ra: plugin build (Vite/webpack), hook trình biên dịch template (Pug), hoặc cách VG-21 chọn cho Razor                     |
| Template adapter | Đọc file template thành cây có vị trí; các thao tác của M-SE (class, chữ, thuộc tính, chèn, xóa, di chuyển, bọc) viết lại cho ngôn ngữ đó, giữ định dạng |
| Route            | Bộ tìm route của K3 cho framework đó                                                                                                                     |

- Bridge, Canvas, Inspector, lịch sử Undo, chat và MCP **không đổi**: chúng chỉ làm việc với `data-rc-loc` và các thao tác chung.
- Thao tác nào một ngôn ngữ template chưa làm được thì báo lý do, như nhau ở mọi framework.
- Bảo mật: proxy và runner mới tuân S-01 đến S-08 (chỉ `127.0.0.1`, token, không mở cổng ra ngoài); lệnh chạy dự án vẫn chỉ chạy khi dự án đã tin cậy (S-80).

Tốn: **cao**.

### K5. React không dùng Vite

- webpack và Create React App (`react-scripts`): đóng dấu bằng plugin Babel có sẵn, runner gọi dev server của dự án.
- JSX trong file `.js`; dự án JavaScript thuần (khung cũ WP-4.05).
- Monorepo: `node_modules` treo ở gốc (R-QA-01).
- Next.js (R-FW-05) **chỉ nhận diện và báo** trong Phase 4 nếu K4 cho thấy cần runner riêng; quyết ở WP-4.00.

Tốn: **vừa**.

### K6. Express + Pug (đại diện cho template render ở server)

- Runner: chạy app Express của dự án, KumiCraft làm proxy để chèn Bridge.
- Đóng dấu: hook trình biên dịch Pug thêm `data-rc-loc` (VG-20).
- Template adapter Pug: Pug dựa vào thụt lề nên phải giữ đúng thụt lề khi chèn, di chuyển hoặc bọc.
- Bộ tìm route Express; trang mới = một file view + route `res.render`.
- Mở rộng cùng cách sau khi Pug chạy: EJS, Handlebars (không bắt buộc trong Phase 4).

Tốn: **cao**.

### K7. Vue (SFC, Vite)

- Đóng dấu: plugin trình biên dịch template của Vue (VG-22).
- Template adapter: phần `<template>` của file `.vue`.
- Lớp style: `<style scoped>` là một nguồn của adapter CSS thường hoặc CSS Modules.
- Bộ tìm route `vue-router`.

Tốn: **cao**.

### K8. ASP.NET Core Razor

- Nhận diện: `*.csproj` có `Microsoft.NET.Sdk.Web`, thư mục `Pages/` hoặc `Views/`.
- Điều kiện: máy có .NET SDK. Thiếu thì báo như "chưa cài agent" (R-CH-06): lý do và cách cài.
- Runner: `dotnet watch` + proxy chèn Bridge.
- Đóng dấu: theo VG-21. Ứng viên là một TagHelper hoặc middleware chỉ chạy khi xem trong KumiCraft, không ghi vào code của người dùng.
- Template adapter `.cshtml`: bộ đọc riêng cho HTML + `@` (biểu thức, khối `@{ }`, `@if`, `@foreach`, TagHelper `asp-*`).
  - Thao tác chỉ chạm phần HTML tĩnh.
  - Phần trong khối C# thì báo "sửa trong editor".
- Bộ tìm route: Razor Pages (`@page`) và MVC (controller → view).
- Lớp style: Bootstrap (mẫu mặc định của ASP.NET Core) và CSS thường, dùng lại K2.

Tốn: **rất cao** (rủi ro cao nhất: không có bộ đọc Razor bằng JavaScript; làm sau cùng).

### K9. Phần còn lại của khung Phase 4 cũ

- M-MF: xem nhiều khung cạnh nhau.
- M-BC: kiểm tra build theo yêu cầu, tổng quát theo framework (`tsc` + `vite build`, `webpack`, `dotnet build`); lỗi hiện `file:dòng`.
- M-SC còn lại:
  - `className={cn('tĩnh', …)}` (L-01);
  - breakpoint tùy biến;
  - cạnh riêng của viền và bo góc.
- Hiệu năng PB-01 đến PB-05 (R-IN-21, R-SL-12, S-86, R-SE-16).
- M-TK, M-XC: rà và bổ sung phần còn thiếu so với FR-71, FR-72.

Tốn: **vừa đến cao**.

### K10. Phát hành 1.0 (M-RL)

- Tài liệu người dùng `vi`/`en`, có danh sách framework và hệ CSS được hỗ trợ.
- Kiểm tra giấy phép, SBOM, kiểm tra máy sạch, S-89a, S-90 đến S-96, S-130.
- Phát hành gói `kumicraft` 1.0.

Tốn: **vừa**.

## 5. Thứ tự và các cổng con

Phase này rất lớn, nên đặt cổng con. Từ 2026-10-24 cổng con không còn là lượt riêng: `pnpm verify` + E2E chạy trong lượt QA của khối; chủ dự án kiểm tay sau K3 và trước phát hành.

| Đợt | Khối    | Cổng    | Kết quả người dùng thấy                                                          |
| --- | ------- | ------- | -------------------------------------------------------------------------------- |
| 1   | K0, K1  | —       | Hợp đồng chốt; JSX chèn vào gọn gàng                                             |
| 2   | K2      | **G4a** | Dự án React dùng CSS thường, CSS Modules, Bootstrap chỉnh kiểu dáng như Tailwind |
| 3   | K3      | **G4b** | Thêm trang chạy trên dự án React cũ, theo đúng kiểu của dự án                    |
| 4   | K4, K5  | **G4c** | Mở được React chạy webpack/CRA, JavaScript thuần, monorepo                       |
| 5   | K6      | **G4d** | Mở và sửa dự án Express + Pug                                                    |
| 6   | K7      | **G4e** | Mở và sửa dự án Vue                                                              |
| 7   | K8      | **G4f** | Mở và sửa dự án ASP.NET Core Razor                                               |
| 8   | K9, K10 | **G4**  | Nhiều khung, kiểm tra build, hiệu năng; phát hành 1.0                            |

Đợt 4 (K4) phải xong trước K6, K7, K8. K2 và K3 dựa trên adapter React hiện có, nên làm được trước K4.

## 6. Quy ước chung của Phase 4

| Việc       | Cách làm                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Giao việc  | Như Phase 3: Claude viết bản giao việc chi tiết từng lượt, Gemini code + test, Claude QA (thêm `*-brief.test.ts` khóa tình huống), chủ dự án kiểm tay                       |
| Fixture    | Mỗi framework và hệ CSS có một dự án mẫu nhỏ trong `fixtures/projects/` (React + CSS thường, React + CSS Modules, React + Bootstrap, CRA, Express + Pug, Vue, ASP.NET Core) |
| Dự án thật | Kiểm tay trên dự án thật của chủ dự án: MarketLink (CSS thường), WorkTracker, và một dự án ASP.NET Core khi tới K8                                                          |
| Trace      | `currentPhase` giữ 3 trong lúc làm; mỗi lượt gắn mã vào test; chuyển sang 4 ở cổng G4. Mã mới của K2 đến K8 đặt ở WP-4.00                                                   |
| E2E        | Mỗi cổng con có E2E cho phần của nó (Claude viết); bộ hồi quy chạy ở lượt đụng Bridge, runner, proxy                                                                        |
| Không lách | Hệ hoặc framework chưa có adapter thì báo lý do và mở trong editor; không bao giờ có "chế độ rút gọn" (style-parity)                                                        |

## 7. Rủi ro đã biết

| Rủi ro                                                             | Cách giữ                                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Sửa rule CSS dùng chung làm đổi chỗ khác mà người dùng không ngờ   | Luôn hiện "Ảnh hưởng N phần tử" và cho chọn "chỉ phần tử này"                                               |
| Độ ưu tiên selector, `!important`, media query làm đọc sai giá trị | Đọc giá trị tính từ trình duyệt (Bridge) và đối chiếu với nguồn; không khớp thì báo, không ghi              |
| Pug dựa vào thụt lề: chèn sai thụt lề là hỏng template             | Template adapter kiểm biên dịch lại sau mỗi thao tác; lỗi thì không ghi (như kiểm parse của M-SE)           |
| Razor không có bộ đọc JavaScript; khối C# trộn HTML                | Spike VG-21 trước; chỉ sửa HTML tĩnh; phần C# báo "sửa trong editor"; làm sau cùng                          |
| Proxy chèn Bridge làm hỏng CSP hoặc nén (gzip) của server dự án    | Spike ở K4; proxy bỏ nén khi chèn và chỉ thêm nonce của phiên vào CSP                                       |
| Bộ tìm route đoán sai nơi thêm route                               | Chỉ tự thêm khi nhận ra chắc chắn; còn lại hỏi người dùng                                                   |
| Phase quá dài, hợp đồng bị sửa giữa chừng                          | K0 chốt cả 3 hợp đồng trước; mỗi cổng con chỉ thêm adapter, không sửa interface đã chốt (plan-before-build) |

## 8. Câu hỏi để lại cho bản giao việc từng đợt

- K2: sửa rule CSS dùng chung thì mặc định "sửa chung" hay "chỉ phần tử này"?
- K2: Bootstrap 5 là đủ, hay cần cả Bootstrap 4?
- K6: sau Pug, có cần EJS / Handlebars trong Phase 4 không?
- K7: chỉ Vue 3 hay cả Vue 2?
- K8: Razor Pages, MVC, hay cả hai? Phiên bản .NET mục tiêu (8 LTS)?
- K5: Next.js chỉ nhận diện hay chạy được ở Phase 4?
