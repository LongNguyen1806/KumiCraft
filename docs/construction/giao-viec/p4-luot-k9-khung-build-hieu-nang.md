# Phase 4 — Lượt K9: Nhiều khung, mở rộng Inspector, kiểm tra build, hiệu năng

Đọc `README.md` cùng thư mục trước, nhất là mục **"Lỗi lint hay vấp"**, rồi làm đúng bản này.

Lượt này làm theo **3 chặng**. Mỗi lần chạy chỉ làm **một chặng** mà prompt yêu cầu. Xong chặng đó thì `pnpm format`, `pnpm verify` toàn bộ, `pnpm test:e2e` toàn bộ, tất cả xanh rồi mới báo cáo.

| Chặng | Nội dung                                                                               | Mã spec                                       |
| ----- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| **A** | Nhiều khung cạnh nhau, mỗi khung một phiên đăng nhập                                   | M-MF                                          |
| **B** | Inspector mở rộng: `cn('tĩnh', …)`, breakpoint tùy biến, cạnh riêng của viền và bo góc | M-SC, L-01                                    |
| **C** | Kiểm tra build theo yêu cầu; đo và giữ hiệu năng                                       | M-BC, PB-01 đến PB-05, R-SE-16, R-SL-12, S-86 |

## 0. Bối cảnh

Kế hoạch `p4-ke-hoach.md` mục K9; `docs/spec.md` mục M-MF, M-BC, M-SC (bảng khung Phase 4 cũ), PB-01 đến PB-05, R-SE-16, R-SL-12, S-86; spec-log #76 đến #79 (phiên đăng nhập), #81.

Hiện nay:

- **Canvas một khung.** `canvas-area.tsx` vẽ một `IframeFrame` (`canvas-frame.tsx`). Danh sách khung và khung đang chọn nằm ở `canvas-view-store.ts` (`frames`, `activeFrameId`, thanh dưới "Khung: Desktop (1440×900)"). Kênh Bridge là một bản duy nhất `studioBridgeChannel` (`features/selection/bridge-channel.ts`), dùng ở khoảng 24 file.
- **Phiên đăng nhập** (spec-log #76, #79): `useCanvasSession` trong `editor/session-select.tsx`. Phiên n ≥ 2 = origin `http://s<n>.localhost:<cổng>` (`sessionOrigin`); Bridge chỉ nhận tin từ origin của phiên đang mở (V-111). Người dùng đổi phiên bằng tay, trang giữ nguyên.
- **`className={cn(…)}`**: Inspector khóa với lý do `expression` (`source-editor/attribute-reader.ts`, `StaticOrString` trong `shared/src/source.ts`). Fixture `vite8-react19-ts` có `src/utils/cn.ts`. E2E `canvas-edit.e2e.ts` có tình huống "className={cn(...)} is locked with reason" (AC-12).
- **Breakpoint** cố định `sm`…`2xl` (`shared/src/responsive.ts`, `RESPONSIVE_KEYS`). Token Brand đã đọc được `breakpoints` (`ThemeInfo.breakpoints`, K2e).
- **Viền và bo góc**: Inspector chỉ sửa cả 4 cạnh cùng lúc (`features/inspector/components/inspector-property-groups.tsx` và các section).
- **Hiệu năng**: chưa có bài đo PB-01 đến PB-04. `pnpm bench` (vitest bench) và `pnpm bench:ui` (`e2e/perf/`, chưa có thư mục) đã khai báo trong `package.json`. Có một bench mẫu: `server/src/adapters/http/session.bench.ts`.

Không sửa: `docs/spec.md`, MCP, `fixtures/`. Chặng C được tạo `e2e/perf/` (mục 3.3). Các thư mục `e2e/` khác thuộc Claude (viết ở lượt QA).

## 1. Mục tiêu (người dùng thấy gì)

### Chặng A: nhiều khung

1. Thanh dưới có nút **"Thêm khung"**. Canvas hiện các khung **cạnh nhau** (cuộn ngang khi không đủ chỗ). Mỗi khung có thanh tiêu đề nhỏ ghi tên khung, kích thước, **phiên đăng nhập** của khung, và nút đóng. Không đóng được khung cuối cùng.
2. Mỗi khung chọn phiên riêng: Desktop ở Phiên 1 (customer), Mobile ở Phiên 2 (farmer), cùng trang hoặc khác trang. Giống mở 3 cửa sổ Chrome với 3 profile.
3. **Khung đang làm việc** (viền đậm) là khung nhận lệnh của Inspector, Lớp, chèn, kéo thả. Bấm vào một khung là chuyển sang khung đó.
4. **Chọn phần tử đồng bộ theo `loc`:** chọn ở một khung thì các khung khác cùng trang tô cùng phần tử (khung mờ). Sửa class thì mọi khung cập nhật, vì HMR của dev server tự đẩy tới mọi iframe.
5. Bố cục (danh sách khung, kích thước, phiên, trang của từng khung) nhớ theo dự án trong trình duyệt, mở lại vẫn còn.

### Chặng B: Inspector mở rộng

1. `className={cn('px-4 py-2', active && 'bg-blue-500')}`: Inspector sửa được **phần chuỗi tĩnh đầu tiên** (`'px-4 py-2'`), còn phần điều kiện giữ nguyên. Ô class hiện chữ nhỏ "Phần có điều kiện giữ nguyên: `active && 'bg-blue-500'`".
2. Dự án có breakpoint riêng (`--breakpoint-3xl: 1920px` trong `@theme` của Tailwind 4, `theme.screens` của Tailwind 3, hoặc biến breakpoint của Bootstrap Sass) → khung, dải breakpoint và tiền tố class (`3xl:`) dùng được breakpoint đó như `sm`…`2xl`.
3. **Viền và bo góc** có nút "từng cạnh" / "từng góc": sửa riêng `border-t`, `border-r`… và `rounded-tl`…; với CSS thường, CSS Modules, Bootstrap thì ghi `border-top-width`… / `border-top-left-radius`… qua lớp style của K2.

### Chặng C: kiểm tra build và hiệu năng

1. Thanh dưới có nút **"Kiểm tra build"**. Bấm → chạy lệnh kiểm của dự án ở chế độ nền (job), hiện tiến trình. Xong thì hiện danh sách lỗi `file:dòng:cột` + thông điệp; bấm một lỗi → mở trong editor; file lỗi có dấu đỏ trên cây thư mục. Không lỗi → "Build ổn".
2. Có bài đo tự động cho PB-01 đến PB-05; vượt ngân sách thì sửa đúng chỗ chậm. Kết quả ghi vào báo cáo.

## 2. Đọc trước (CW-52)

| File                                                                                                                              | Chặng |
| --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `docs/spec.md`: M-MF, M-BC, M-SC, mục ngân sách hiệu năng (PB-01 đến PB-05), R-BR-15, R-SE-16, R-SL-12, S-86, mục Bench           | Mọi   |
| `studio/src/features/editor/canvas-area.tsx`, `canvas-frame.tsx`, `canvas-view-store.ts`, `canvas-zoom.tsx`, `session-select.tsx` | A     |
| `studio/src/features/selection/bridge-channel.ts`, `selection-store.ts`; mọi chỗ import `studioBridgeChannel`                     | A     |
| `server/src/core/source-editor/attribute-reader.ts`, `class-edit*.ts`, `shared/src/source.ts`                                     | B     |
| `shared/src/responsive.ts`, `shared/src/style.ts` (R-ST-09), `server/src/core/style/tokens/*`, `features/inspector/*`             | B     |
| `server/src/core/jobs/job-service.ts`, `core/project/project-install.ts` (mẫu job chạy lệnh), `features/canvas-errors/*`          | C     |
| `server/src/adapters/http/session.bench.ts`, `vitest.config.js`, `package.json` (`bench`, `bench:ui`)                             | C     |

## 3. Hợp đồng

### 3.1. Chặng A: nhiều khung (M-MF)

- `canvas-view-store.ts`: khung trên Canvas là `openFrames: readonly { id: string; frameId: string; sessionId: number; route: string }[]` (`id` riêng cho mỗi khung đang mở; `frameId` trỏ vào preset `frames`), cộng `activeOpenFrameId`. Lưu `localStorage` theo dự án: `kumicraft.openFrames.<projectId>`. Dữ liệu cũ, không có gì → một khung = preset đang chọn, phiên đang chọn, route hiện tại.
- **Kênh Bridge theo khung.** Mỗi khung một `BridgeChannel` riêng: origin của phiên khung đó, nonce riêng do runner cấp (như hiện nay). `studioBridgeChannel` giữ nguyên tên và API, nhưng chuyển mọi lệnh tới **kênh của khung đang làm việc**. Như vậy 24 chỗ đang import nó không phải sửa.
  - Thêm `bridgeChannels.forEachOther(fn)` để gửi `select`/`highlight` cho các khung khác.
  - Tin nhận về (`route`, `select`, `tree`…) từ khung không làm việc chỉ cập nhật trạng thái riêng của khung đó (route, tiêu đề). Riêng khi người dùng bấm chọn phần tử trong khung đó, khung đó thành khung làm việc rồi xử lý như hiện nay.
- **Đồng bộ chọn:** vùng chọn của khung làm việc đổi → gửi `select { refs }` cho các khung khác **cùng route**, dùng cờ vẽ khung mờ có sẵn (instances); khung khác route không nhận.
- **Phiên theo khung:** ô phiên trên thanh tiêu đề mỗi khung dùng lại `SessionSelect` (danh sách phiên của dự án là chung, phiên chọn là riêng từng khung). `useCanvasSession` trả phiên của khung làm việc cho phần còn lại của Studio.
- Mỗi khung có zoom chung của Canvas (`canvas-zoom.tsx`); "Vừa khung" tính cho cả dãy khung.
- Tối đa **4 khung** (bộ nhớ, tải dev server); nút "Thêm khung" tắt khi đủ 4, có tooltip lý do.
- Chế độ "Xem thử" (preview) áp dụng cho mọi khung.

### 3.2. Chặng B: Inspector mở rộng (M-SC)

- **`cn` tĩnh (L-01):**
  - `className={f('…', …)}` với `f` là `cn`, `clsx`, `classnames`, `classNames`, `twMerge`, `twJoin`, và **đối số đầu tiên** là chuỗi literal (hoặc template literal không có `${}`) → `ElementClassName` mới `{ kind: 'callStatic', value, callee, rest: string }`. `rest` là mã nguồn các đối số sau, cắt tối đa 200 ký tự để hiện.
  - Sửa class chỉ thay đối số đầu; giữ nguyên dấu nháy và định dạng; một bước Undo.
  - Đối số đầu không phải literal → giữ khóa `expression` như cũ.
  - Lớp style "chỉ phần tử này" (R-ST-07) với `callStatic` dùng cùng cách thêm class vào chuỗi tĩnh.
- **Breakpoint tùy biến:**
  - `RESPONSIVE_KEYS` giữ làm mặc định. Thêm `projectBreakpoints(theme): readonly { key: string; min: number }[]`, ghép mặc định với breakpoint của dự án (đọc từ `ThemeInfo.breakpoints`, đã có ở K2e), sắp theo `min`.
  - Mọi nơi đang dùng `RESPONSIVE_KEYS`, `BreakpointSchema`, `breakpointOf` đổi sang danh sách của dự án: dải breakpoint trên khung, tiền tố class, R-ST-09.
  - Schema chuyển từ `z.enum` sang chuỗi theo regex `^[a-z0-9]{1,10}$`, kèm kiểm tra "có trong danh sách của dự án" ở server.
  - Key trùng mặc định nhưng khác giá trị (dự án đổi `md`) → dùng giá trị của dự án.
- **Cạnh và góc riêng:**
  - Nhóm Viền: nút gạt "Cả 4 cạnh / Từng cạnh". Từng cạnh hiện 4 ô `top/right/bottom/left` cho độ dày, cộng màu và kiểu chung.
  - Nhóm Bo góc: "Cả 4 góc / Từng góc" với `tl/tr/br/bl`.
  - Tailwind: `border-t-2`, `rounded-tl-lg`… Gỡ class 4 cạnh khi chuyển sang từng cạnh với giá trị khác nhau, và ngược lại khi 4 giá trị bằng nhau.
  - CSS thường, CSS Modules, Bootstrap, Sass, Less: thuộc tính CSS dài (`border-top-width`, `border-top-left-radius`) qua lớp style K2, đọc đúng nguồn của từng cạnh. Shorthand `border-radius: 4px 8px` phải tách được khi đọc.

### 3.3. Chặng C: build và hiệu năng (M-BC, PB)

- **Kiểm tra build:**
  - `POST /project/build-check` → job `project.buildCheck`, chỉ chạy khi dự án đã tin cậy (S-80). Loại tiến trình mới thêm vào danh sách cho phép S-50.
  - Lệnh theo adapter:
    - Vite + React: có `tsconfig.json` thì `tsc --noEmit -p <tsconfig>` (TypeScript của dự án), rồi `vite build --outDir <thư mục tạm ngoài dự án> --emptyOutDir`. Không ghi vào `dist/` của dự án; xóa thư mục tạm khi xong.
    - Express + Pug: biên dịch thử mọi file `.pug` trong `viewsDir` bằng Pug của dự án (không render).
    - Adapter khác: `unsupported` có lý do.
  - Kết quả job: `{ ok: boolean, problems: { file: RelPath, line, column?, message, source: 'tsc' | 'vite' | 'pug' }[] }`, tối đa 200 lỗi. Đọc lỗi từ output `tsc` dạng `file(line,col): error TSxxxx: …`, lỗi Rollup/Vite có `id`/`loc`, lỗi Pug có `filename`/`line`.
  - Studio:
    - nút "Kiểm tra build" ở thanh dưới;
    - panel kết quả (dùng lại kiểu `canvas-errors`);
    - bấm lỗi → `openInEditor('file:line:col')`;
    - cây thư mục đánh dấu file lỗi (đã có cơ chế dấu lỗi build ở K3a; dùng lại).
- **Hiệu năng:** viết bài đo, chạy, vượt ngân sách thì sửa nguyên nhân.

  | Mã      | Bài đo                                                                                         | Ngân sách                | Nơi                               |
  | ------- | ---------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------- |
  | PB-01   | Trang 2.000 phần tử, rê chuột 200 khung hình, `performance.mark` trong Bridge                  | P95 ≤ 16 ms              | `e2e/perf/overlay.perf.ts`        |
  | PB-02   | Xác nhận ô Inspector → `selection-info` có class mới, 30 lần, fixture TS                       | P95 ≤ 500 ms             | `e2e/perf/inspector.perf.ts`      |
  | PB-03   | `setClassName`, `setText` trên file 2.000 dòng                                                 | ≤ 100 ms                 | `source-editor/*.bench.ts`        |
  | PB-04   | Runner Vite `starting` → `ready`, fixture đã cài                                               | ≤ 15 s                   | test integration hiện có, ghi số  |
  | PB-05   | CLI khởi động tới Studio sẵn sàng                                                              | ≤ 2 s                    | `cli/*.bench.ts` hoặc integration |
  | R-SE-16 | Bộ nhớ đệm phân tích theo (file, hash), LRU 50 file: lần đọc thứ hai cùng hash không parse lại | có test                  | `source-editor/*.test.ts`         |
  | R-SL-12 | Cây Lớp 5.000 nút cuộn liên tục                                                                | không khung hình > 50 ms | `e2e/perf/layers.perf.ts`         |
  | S-86    | Các regex chạy trên nội dung dự án (S-33, R-PJ-09, R-TW-01, đọc lỗi build mới) với chuỗi 1 MB  | ≤ 100 ms mỗi regex       | `*.test.ts`                       |
  - Bài `e2e/perf/` chạy bằng `pnpm bench:ui`, **không** nằm trong `pnpm test:e2e`.
  - Trang 2.000 phần tử và file 2.000 dòng sinh lúc chạy test, không thêm vào `fixtures/`.

## 4. Tình huống test (bắt buộc, tên test có `WP-4.00`)

| #   | Tình huống                                                                                                                                                                             | Chặng |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A1  | Thêm khung Mobile → 2 iframe, mỗi cái một nonce; `studioBridgeChannel.select` chỉ tới khung đang làm việc; đóng khung về 1; không đóng được khung cuối                                 | A     |
| A2  | Khung 1 phiên 1, khung 2 phiên 2 → iframe 2 dùng `s2.localhost`; tin từ khung 2 không lọt vào kênh khung 1 (V-111 theo khung)                                                          | A     |
| A3  | Chọn phần tử ở khung 1 → khung 2 cùng route nhận `select` cùng `refs`; khung 3 khác route không nhận                                                                                   | A     |
| A4  | Bấm chọn trong khung 2 → khung 2 thành khung làm việc, Inspector theo phần tử đó                                                                                                       | A     |
| A5  | Bố cục lưu theo dự án; tải lại → còn đúng khung, phiên, route; dữ liệu cũ → một khung như trước                                                                                        | A     |
| A6  | Tối đa 4 khung: nút thêm tắt, có lý do                                                                                                                                                 | A     |
| B1  | Đọc `className={cn('px-4 py-2', active && 'x')}` → `callStatic` (`value: 'px-4 py-2'`, `callee: 'cn'`); `clsx`, `twMerge` tương tự; `cn(base, 'x')` → `expression`                     | B     |
| B2  | Sửa class trên `callStatic` → chỉ đối số đầu đổi, dấu nháy giữ, phần sau giữ nguyên từng byte; Undo trả đúng file                                                                      | B     |
| B3  | Tailwind 4 có `--breakpoint-3xl: 1920px` → danh sách breakpoint có `3xl` sau `2xl`; khung 1920 thuộc dải `3xl`; sửa class ở khung đó ghi `3xl:` (desktop-first/mobile-first đúng R-RS) | B     |
| B4  | Breakpoint key lạ (không có trong dự án) gửi lên server → bị từ chối có mã lỗi                                                                                                         | B     |
| B5  | Tailwind: viền từng cạnh → `border-t-2 border-b-4`; về 4 cạnh bằng nhau → `border-2`; bo góc `rounded-tl-lg rounded-br-lg`                                                             | B     |
| B6  | CSS thường: `border-radius: 4px 8px` đọc ra tl=4, tr=8, br=4, bl=8; sửa riêng tl → ghi `border-top-left-radius` đúng rule nguồn; một bước Undo                                         | B     |
| C1  | Build check fixture Vite TS có lỗi kiểu chèn trong test → problem `src/x.tsx:3:7` nguồn `tsc`; sửa hết lỗi → `ok: true`; `dist/` của dự án không bị tạo hay đổi                        | C     |
| C2  | Lỗi Vite (import file không có) → problem có file, dòng; Pug sai cú pháp ở fixture copy tạm → problem `views/x.pug:2`                                                                  | C     |
| C3  | Dự án chưa tin cậy → build check bị từ chối (`E011`)                                                                                                                                   | C     |
| C4  | Đọc lỗi build: output 1 MB toàn rác → ≤ 100 ms, không treo (S-86)                                                                                                                      | C     |
| C5  | R-SE-16: đọc cùng file cùng hash 2 lần → parse 1 lần; 51 file khác nhau → file cũ nhất bị loại                                                                                         | C     |
| C6  | Các bài bench, perf ở mục 3.3 có mặt và chạy được; số đo ghi vào báo cáo                                                                                                               | C     |

## 5. Bẫy đã biết

- **Chặng A:**
  - mỗi iframe một nonce và một origin; đừng nới V-111 thành "mọi `*.localhost`";
  - đóng khung phải `detach` kênh của nó;
  - `canvas-area.tsx` gần giới hạn dòng: tách component khung (`canvas-frame-tile.tsx`…), không nhồi vào file cũ;
  - test cũ dùng `studioBridgeChannel` trực tiếp phải còn xanh mà không sửa ý nghĩa.
- **Playwright với khung thu nhỏ:** Playwright đặt vị trí phần tử trong iframe như khi chưa thu nhỏ, nên cú bấm lệch. Xem helper `clickInCanvas` trong `e2e/express-pug.e2e.ts` (tính theo `getBoundingClientRect` của khung × tỉ lệ).
- **Chặng B:**
  - Babel: `cn` có thể là thành viên (`utils.cn(...)`): chấp nhận `MemberExpression` có thuộc tính cuối nằm trong danh sách;
  - chuỗi có `\n` hoặc nhiều khoảng trắng: giữ nguyên phần không đổi;
  - đổi `BreakpointSchema` từ enum sang chuỗi ảnh hưởng nhiều chỗ: tìm hết bằng typecheck, không ép kiểu.
- **Chặng C:**
  - `tsc` và `vite` lấy của **dự án** (`node_modules/.bin` hoặc `createRequire` từ gốc dự án, có tính `workspaceRoot` của K5), không phải của KumiCraft;
  - thư mục build tạm nằm trong thư mục cache của KumiCraft, dọn khi xong hoặc khi job bị hủy;
  - bài perf không được làm chậm `pnpm test:e2e`.
- Ref DOM theo QC-40: `ref={(el) => { r.current = el ?? undefined; }}`.

## 6. Không được làm

- Không sửa `docs/spec.md`, MCP, `fixtures/`; ngoài `e2e/perf/` (chặng C) không sửa `e2e/`.
- Không thêm dependency.
- Không `as unknown as`, `as any`, `!`, `@ts-ignore`, `eslint-disable`, `null`.
- Không nới test cũ cho xanh; không lọc theo đúng giá trị của test.
- File ≤ 400 dòng, hàm ≤ 50 dòng sau khi chạy Prettier.
- Không commit; không chạy git checkout/restore/reset/stash/clean; không cài gói.

## 7. Tự kiểm trước khi báo cáo (bắt buộc)

1. `pnpm format` → `pnpm verify` toàn bộ → `pnpm test:e2e` toàn bộ (chặng C thêm `pnpm bench` và `pnpm bench:ui`).
2. Chỉ báo cáo khi tất cả xanh; lỗi thì tự sửa đúng gốc rồi chạy lại, không dừng để hỏi.

## 8. Báo cáo (ngắn, tiếng Việt, ở cuối câu trả lời)

```
## BÁO CÁO K9 chặng <A|B|C>
- verify: <số test> xanh | e2e: <số> xanh
- File tạo: …
- File sửa: …
- Test cũ đã sửa và lý do: …
- Tình huống: A1 <tên test đúng như trong code> — đạt; …
- (chặng C) Số đo: PB-01 … ms, PB-02 … ms, PB-03 … ms, PB-04 … s, PB-05 … s, R-SL-12 … ms
- Khác bản giao việc và lý do: …
```

Đề xuất commit message:

- chặng A: `feat(studio): show several canvas frames, each in its own session`;
- chặng B: `feat(studio): edit cn static classes, custom breakpoints and sides`;
- chặng C: `feat(server): check the project build and add performance benches`.
