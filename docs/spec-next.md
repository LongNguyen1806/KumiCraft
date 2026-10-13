# SPEC — REACTCRAFT LOCAL

## Bộ đặc tả kỹ thuật thi công (Technical Specification Set)

**Dự án:** ReactCraft Local  
**Tài liệu gốc:** ReactCraft Local — Software Requirements Specification v5.0  
**Phiên bản tài liệu:** 1.0 (bản nháp đang viết lại theo hướng "mã nguồn là nguồn sự thật")  
**Trạng thái:** Đang viết lại — xem mục 0.2  
**Cập nhật lần cuối:** 2026-10-13

---

# PHẦN 0 — HƯỚNG DẪN SỬ DỤNG TÀI LIỆU

## 0.1. Mục đích

SRS v5.0 mô tả **hệ thống phải làm gì**. Tài liệu này mô tả **hệ thống được xây dựng như thế nào**: công nghệ, cấu trúc, hợp đồng giao tiếp, tiêu chí kiểm chứng và nghiệm thu.

> Tài liệu này là bản vẽ thi công. Người triển khai làm đúng theo tài liệu, không tự chọn công nghệ, không tự đặt cấu trúc. Điều gì chưa có trong tài liệu thì bổ sung vào tài liệu trước khi làm.

**Thay đổi lớn ở bản 1.0:** bỏ toàn bộ hướng "Design Model là nguồn sự thật" của bản 0.18 (Design Model, Design Operation, sinh code, xuất code, AI tự gọi API bằng API key, bộ quét backend). Bản 0.18 còn trong lịch sử Git (commit `7b4f0d0` trở về trước). Số hiệu ADR còn hiệu lực được **giữ nguyên số**; ADR bị bỏ ghi "Đã bỏ (1.0)"; quyết định mới nhận số mới.

---

## 0.2. Cấu trúc và tiến độ viết lại

| Phần    | Nội dung                                                          | Trạng thái                                                      |
| ------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Phần 0  | Hướng dẫn sử dụng tài liệu                                        | Đã viết lại                                                     |
| SPEC-01 | Kiến trúc kỹ thuật & tech stack (gộp backend và Studio)           | Đã viết lại                                                     |
| SPEC-02 | Quy chuẩn code & repo                                             | Chờ viết lại (đợt 2)                                            |
| SPEC-03 | Giao tiếp: API REST, sự kiện WebSocket, giao thức cầu nối, mã lỗi | Chờ viết lại (đợt 2)                                            |
| SPEC-04 | Đặc tả module theo phase                                          | Chờ viết lại (đợt 2: Phase 1; đợt 3: Phase 2–4)                 |
| SPEC-05 | Bảo mật                                                           | Chờ viết lại (đợt 3)                                            |
| SPEC-06 | Chất lượng & kiểm thử                                             | Chờ viết lại (đợt 3)                                            |
| SPEC-07 | Quy trình thi công, phase, cổng nghiệm thu                        | Đã viết lại (lộ trình); chi tiết DoR/DoD giữ như 0.18 tới đợt 3 |

---

## 0.3. Mức độ bắt buộc

| Từ khóa        | Ý nghĩa                                         |
| -------------- | ----------------------------------------------- |
| **BẮT BUỘC**   | Phải tuân thủ. Vi phạm là lỗi nghiệm thu        |
| **KHÔNG ĐƯỢC** | Cấm tuyệt đối                                   |
| **NÊN**        | Mặc định phải làm. Muốn làm khác phải ghi lý do |
| **CÓ THỂ**     | Tùy chọn                                        |

---

## 0.4. Mã định danh

| Tiền tố                                                                            | Ý nghĩa                                           | Ví dụ     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------- | --------- |
| `C-xx`                                                                             | Ràng buộc                                         | C-01      |
| `ADR-BE-xx`, `ADR-FE-xx`                                                           | Quyết định kiến trúc phía server, phía Studio     | ADR-BE-28 |
| `VG-xx`                                                                            | Bài kiểm chứng bắt buộc                           | VG-15     |
| `PB-xx`                                                                            | Ngân sách hiệu năng                               | PB-02     |
| `QC-xx`                                                                            | Quy chuẩn code (SPEC-02)                          | QC-40     |
| `V-xx`                                                                             | Quy tắc hợp lệ của dữ liệu và API (SPEC-03)       | V-60      |
| `E0xx`                                                                             | Mã lỗi (SPEC-03)                                  | E024      |
| `M-xx`                                                                             | Mã module (SPEC-04)                               | M-SE      |
| `R-<module>-nn`                                                                    | Quy tắc xử lý của một module                      | R-SE-01   |
| `S-xx`                                                                             | Biện pháp bảo mật (SPEC-05), có thể có hậu tố chữ | S-04a     |
| `CW-xx`, `WP-n.nn`, `GC-xx`, `G<n>-xx`, `DR-xx`, `DW-xx`, `RK-xx`, `SEV-n`, `Q-xx` | Như bản 0.18 (SPEC-07)                            | WP-1.03   |
| `FR / NFR / SEC / AC`                                                              | Mã yêu cầu trong SRS v5.0                         | AC-03     |

Mã đã dùng trong một phần **đã duyệt** không bao giờ dùng lại. Các mã của bản 0.18 chưa được duyệt; bản 1.0 không dùng lại mã module, `R-…`, `V-…` của hướng cũ cho nghĩa khác.

---

## 0.5. Trạng thái ADR

| Trạng thái            | Ý nghĩa                                                        |
| --------------------- | -------------------------------------------------------------- |
| **Accepted**          | Đã chốt, áp dụng ngay                                          |
| **Accepted — chờ VG** | Đã chốt, phải qua bài kiểm chứng trước khi viết code phụ thuộc |
| **Proposed**          | Đề xuất cho phase sau                                          |
| **Đã bỏ (1.0)**       | Thuộc hướng cũ, không áp dụng                                  |

---

## 0.6. Quy tắc cập nhật tài liệu

1. Toàn bộ spec nằm trong một file `docs/spec.md`. Trong lúc viết lại, bản mới nằm ở `docs/spec-next.md` và **thay** `docs/spec.md` khi đủ các phần ở mục 0.2 và code cũ đã được dọn (WP-1.01), để `pnpm trace` luôn khớp với code.
2. Mọi thay đổi ghi vào Lịch sử thay đổi cuối tài liệu.
3. Tiến độ và kết quả thi công ghi ở `docs/construction/`, không ghi vào đây.

---

# SPEC-01 — KIẾN TRÚC KỸ THUẬT & TECH STACK

**Phiên bản phần:** 1.0  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v5.0

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

Chốt kiến trúc runtime, cách tổ chức mã nguồn và **toàn bộ công nghệ** cho server local, Studio, cầu nối trong dự án, CLI. Thư viện không có trong phần này thì không được dùng; muốn thêm phải cập nhật phần này trước.

---

## 2. RÀNG BUỘC

| Mã   | Ràng buộc                                                                                    | Nguồn              |
| ---- | -------------------------------------------------------------------------------------------- | ------------------ |
| C-01 | Chạy hoàn toàn trên máy người dùng. Mạng chỉ cần khi cài dependency và khi agent AI làm việc | SRS PR-06, SEC-09  |
| C-02 | Mã nguồn dự án là nguồn sự thật duy nhất của giao diện                                       | SRS PR-01          |
| C-03 | Dự án được hỗ trợ: Vite 7/8, React 18/19, TypeScript hoặc JavaScript, Tailwind v4            | SRS mục 8          |
| C-04 | Không ghi vào thư mục backend; không bao giờ đọc file bí mật                                 | SRS SEC-02, SEC-04 |
| C-05 | Hệ điều hành phát triển chính là Windows; hỗ trợ macOS và Linux                              | SRS NFR-11         |
| C-06 | Canvas là trang của dev server dự án, **khác origin** với Studio                             | Hệ quả của C-02    |
| C-07 | Không lưu API key; AI qua agent dòng lệnh người dùng đã cài                                  | SRS PR-06          |
| C-08 | Một người dùng, một phiên trên một dự án                                                     | SRS NG-01          |

---

## 3. KIẾN TRÚC RUNTIME

### 3.1. Sơ đồ tiến trình

```text
 Trình duyệt
 ┌───────────────────────────────────────────────────────────────────┐
 │ Studio  (origin http://127.0.0.1:<P>)                             │
 │   Panels · Inspector · Layer Tree · Library · Chat · Toolbar      │
 │   ┌───────────────────────────────────────────────────────────┐   │
 │   │ iframe Canvas (origin http://127.0.0.1:<D>, dev server)    │   │
 │   │   App của dự án + Bridge client (overlay trong shadow root)│   │
 │   └───────────────▲───────────────────────────────────────────┘   │
 │        postMessage │ (kiểm tra origin + nonce, ADR-FE-22)          │
 └────────────────────┼──────────────────────────────────────────────┘
          REST + WS   │ token phiên (SPEC-05)
 ┌────────────────────▼──────────────────────────────────────────────┐
 │ Node.js: reactcraft (CLI + Local Server, Fastify)                  │
 │  core: project · runner · source-editor · history · agent ·       │
 │        mirror · workspace(trust) · settings                       │
 └───┬──────────────┬───────────────┬────────────────┬───────────────┘
     │ spawn (IPC)  │ spawn         │ spawn          │ đọc/ghi
     ▼              ▼               ▼                ▼
  Runner con:    Agent CLI       Package manager   Dự án frontend (ghi)
  Vite của dự án (agy / claude)  (cài dependency)  Bản sao backend (chỉ đọc
  + plugin Bridge cwd = dự án                      với agent, ADR-BE-33)
```

### 3.2. Nguyên tắc phân lớp

**BẮT BUỘC:**

1. `packages/server/src/core/` **KHÔNG ĐƯỢC** import `fastify`, `chokidar`, `node:child_process` hay bất cứ thứ gì trong `adapters/`. Core giao tiếp ra ngoài qua **port** trong `core/ports/`.
2. `packages/shared/` chỉ chứa schema Zod và kiểu dùng chung giữa Studio và server (API, sự kiện, mã lỗi, mô hình class Tailwind). **KHÔNG ĐƯỢC** import `node:*` hay API DOM.
3. `packages/bridge/` chạy **trong tiến trình Vite của dự án** (plugin) và **trong trang của dự án** (client). **KHÔNG ĐƯỢC** import gì từ `server` hay `studio`; chỉ được dùng thư viện ghi ở ADR-BE-29.
4. Kiểm tra tự động bằng ESLint `no-restricted-imports`.

Port tối thiểu:

```ts
interface FileSystemPort {
  readText;
  writeTextAtomic;
  exists;
  stat;
  list;
  copy;
  remove;
  rename;
}
interface FileWatcherPort {
  watch(root, options): Subscription;
}
interface ProcessPort {
  spawn(command, args, options): ChildHandle;
} // không shell (S-51)
interface EventBusPort {
  publish(type, payload, correlationId?): void;
}
interface LoggerPort {
  debug;
  info;
  warn;
  error;
}
interface SystemPort {
  now;
  pid;
  hostname;
  isProcessAlive;
  isListening;
}
```

### 3.3. Cấu trúc mã nguồn

```text
reactcraft/
├── packages/
│   ├── shared/         # @reactcraft/shared: schema API, sự kiện, mã lỗi, mô hình class Tailwind
│   ├── server/         # Local Server
│   │   └── src/
│   │       ├── core/
│   │       │   ├── ports/
│   │       │   ├── workspace/       # workspace.json, khóa phiên, tin cậy (giữ từ 0.18)
│   │       │   ├── project/         # kiểm tra phạm vi, tạo khung, cài dependency
│   │       │   ├── runner/          # vòng đời dev server
│   │       │   ├── source-editor/   # phân tích, định vị, sửa, kiểm tra, ghi
│   │       │   ├── history/         # Undo/Redo theo file
│   │       │   ├── agent/           # chạy agent, luồng tiến trình, lượt AI
│   │       │   ├── mirror/          # bản sao backend chỉ đọc
│   │       │   └── shared/
│   │       ├── adapters/  http · fs · watcher · process · log · system
│   │       └── runner-entry.ts      # script chạy trong tiến trình con Vite (ADR-BE-28)
│   ├── bridge/         # plugin Vite + client chạy trong trang dự án
│   ├── studio/         # Studio UI
│   └── cli/            # lệnh `reactcraft`, đóng gói mọi thứ
├── templates/
│   └── vite-react-ts-tailwind4/     # khung dự án mới (ADR-BE-32)
└── fixtures/
    ├── projects/       # dự án mẫu để test (đúng quy ước, có className động, có component dùng chung…)
    └── backends/       # backend mẫu (Express có API sản phẩm, có `.env` chứa chuỗi đánh dấu)
```

`packages/model` của bản 0.18 bị xóa ở WP-1.01; phần còn dùng được (bảng ánh xạ Tailwind, khóa responsive) chuyển sang `packages/shared`.

---

## 4. BẢNG TỔNG HỢP CÔNG NGHỆ

| Lớp                       | Công nghệ                                                                            | ADR           | Trạng thái                                            |
| ------------------------- | ------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------- |
| Runtime                   | Node.js ≥ 22.12, khuyến nghị 24 LTS                                                  | ADR-BE-01     | Accepted                                              |
| Ngôn ngữ                  | TypeScript 6.x, `strict`, ESM                                                        | ADR-BE-02     | Accepted                                              |
| Mô hình chạy              | Server local, khởi động bằng CLI                                                     | ADR-BE-03     | Accepted (cập nhật 1.0)                               |
| Tổ chức mã                | pnpm workspace: `shared`, `server`, `bridge`, `studio`, `cli`                        | ADR-BE-04     | Accepted (cập nhật 1.0)                               |
| Phạm vi dự án             | Vite 7/8, React 18/19, TS/JS, Tailwind v4                                            | ADR-BE-05     | Accepted (cập nhật 1.0)                               |
| HTTP server               | Fastify 5 + `@fastify/websocket` + `@fastify/static`                                 | ADR-BE-06     | Accepted                                              |
| Giao thức Studio ↔ server | REST JSON + WebSocket                                                                | ADR-BE-07     | Accepted                                              |
| Schema                    | Zod 4                                                                                | ADR-BE-08     | Accepted                                              |
| Định danh                 | `nanoid`                                                                             | ADR-BE-10     | Accepted                                              |
| Duyệt file                | `tinyglobby` + `ignore`                                                              | ADR-BE-15     | Accepted (dùng cho bản sao backend, ảnh chụp lượt AI) |
| Diff                      | `diff` (jsdiff)                                                                      | ADR-BE-17     | Accepted (dùng cho xem lại lượt AI)                   |
| Ghi file                  | Ghi nguyên tử tự viết, có thử lại (VG-01)                                            | ADR-BE-18     | Accepted (cập nhật 1.0)                               |
| Theo dõi file             | `chokidar`                                                                           | ADR-BE-20     | Accepted                                              |
| Logging                   | `pino`                                                                               | ADR-BE-23     | Accepted                                              |
| Cấu hình người dùng       | `env-paths`                                                                          | ADR-BE-24     | Accepted (bỏ API key)                                 |
| Build, đóng gói           | tsdown + Vite, phát hành một package `reactcraft`                                    | ADR-BE-25     | Accepted                                              |
| Kiểm thử                  | Vitest + Playwright                                                                  | ADR-BE-26     | Accepted                                              |
| Chất lượng code           | ESLint + typescript-eslint + Prettier                                                | ADR-BE-27     | Accepted                                              |
| Chạy dự án                | Vite của chính dự án, trong tiến trình con, plugin Bridge chèn vào cấu hình lúc chạy | ADR-BE-28     | Accepted — chờ VG-15                                  |
| Phân tích và sửa mã nguồn | `@babel/parser` + bộ duyệt cây tự viết + `magic-string`                              | ADR-BE-29     | Accepted — chờ VG-16                                  |
| Lịch sử sửa               | Lưu nội dung trước/sau từng file kèm hash                                            | ADR-BE-30     | Accepted                                              |
| Tiến trình con            | `cross-spawn`, mảng tham số, không shell                                             | ADR-BE-31     | Accepted                                              |
| Khung dự án mới           | Template nội bộ + package manager của người dùng                                     | ADR-BE-32     | Accepted                                              |
| AI                        | Agent dòng lệnh trên máy (Antigravity CLI; Claude Code CLI tùy chọn)                 | ADR-BE-33     | Accepted — chờ VG-17                                  |
| Studio framework          | React 19 + Vite 8 + React Compiler                                                   | ADR-FE-01, 02 | Accepted                                              |
| Studio ngôn ngữ           | TypeScript                                                                           | ADR-FE-03     | Accepted                                              |
| State Studio              | Zustand                                                                              | ADR-FE-10     | Accepted (cập nhật 1.0)                               |
| Giao diện Studio          | Tailwind v4 (của Studio), `lucide-react`, font đóng gói                              | ADR-FE-14     | Accepted                                              |
| i18n                      | i18next + react-i18next                                                              | ADR-FE-16     | Accepted                                              |
| Kết nối server            | fetch + WebSocket tự viết, tự nối lại                                                | ADR-FE-17     | Accepted                                              |
| Kiểm thử Studio           | Vitest + Testing Library + Playwright                                                | ADR-FE-18     | Accepted                                              |
| Kéo thả trong Studio      | `@dnd-kit/core` (từ Library ra mép Canvas); trong Canvas do Bridge xử lý             | ADR-FE-09     | Accepted (cập nhật 1.0)                               |
| Danh sách dài             | `@tanstack/react-virtual`                                                            | ADR-FE-21     | Accepted                                              |
| Canvas                    | iframe trỏ vào dev server dự án, thu phóng bằng `transform`                          | ADR-FE-04     | Accepted (cập nhật 1.0) — chờ VG-15                   |
| Giao thức Canvas ↔ Studio | `postMessage` có kiểm tra origin và nonce                                            | ADR-FE-22     | Accepted — chờ VG-15                                  |
| Overlay                   | Bridge vẽ trong shadow root bên trong iframe                                         | ADR-FE-07     | Accepted (cập nhật 1.0) — chờ VG-15                   |
| Mô hình class Tailwind    | Đọc, ghi class theo nhóm thuộc tính, dùng bảng ánh xạ chung                          | ADR-FE-06     | Accepted (cập nhật 1.0)                               |

**ADR đã bỏ (1.0):** ADR-BE-09 (Design Model), ADR-BE-11 (lưu Design Document), ADR-BE-12, 13, 14 (phân tích backend), ADR-BE-16 (sinh code), ADR-BE-19 (kiểm tra code xuất ra), ADR-BE-21 (worker phân tích), ADR-BE-22 (AI SDK), ADR-FE-05 (Tailwind runtime trong Canvas), ADR-FE-08 (khung nhìn dựng từ model: thay bằng ADR-FE-04), ADR-FE-11, 12, 13 (chưa dùng), ADR-FE-15 (CodeMirror: thay bằng xem diff tự viết), ADR-FE-20 (TipTap).

**Quy tắc phiên bản:** dùng bản ổn định đã phát hành ít nhất 2 tuần, ghim chính xác trong `pnpm-lock.yaml`.

---

## 5. ADR GIỮ LẠI (TÓM TẮT RÀNG BUỘC)

Phần giải thích đầy đủ của các ADR này có trong bản 0.18; dưới đây là ràng buộc còn hiệu lực.

| ADR               | Ràng buộc                                                                                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-BE-01         | Import module lõi có tiền tố `node:`. Không dùng API `fs` đồng bộ trên luồng chính trừ lúc khởi động CLI. Tác vụ hủy được dùng `AbortSignal`. So sánh đường dẫn trên Windows và macOS không phân biệt hoa thường                                               |
| ADR-BE-02         | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. Không `any`, không `@ts-ignore`. Kiểu qua ranh giới suy ra từ Zod                                                                                                  |
| ADR-BE-03         | `npx reactcraft [dir]`, `--port`, `--no-open`, `--log-level`. Chỉ lắng nghe `127.0.0.1`. Tắt sạch khi `SIGINT`/`SIGTERM`: dừng tiến trình con (dev server, agent, cài đặt), hoàn tất ghi file đang dở, giải phóng khóa. Một server trên một dự án (khóa, E018) |
| ADR-BE-06         | Route chỉ là lớp mỏng: parse bằng Zod, gọi core, trả kết quả. Giới hạn body 10 MB                                                                                                                                                                              |
| ADR-BE-07         | REST dưới `/api/v1/*`, sự kiện qua `/api/v1/events`. Tác vụ dài trả `jobId` ngay, tiến trình qua WebSocket, hủy được. Server không trả câu đã dịch, chỉ mã lỗi và tham số                                                                                      |
| ADR-BE-08         | `safeParse` cho mọi dữ liệu vào; schema chặt (`strict`)                                                                                                                                                                                                        |
| ADR-BE-10         | `nanoid` cho mọi định danh do ReactCraft tạo (workspace, backend, job, lượt AI, mục lịch sử)                                                                                                                                                                   |
| ADR-BE-15         | Duyệt file bằng `tinyglobby` không theo symlink; áp `.gitignore` và danh sách loại trừ (S-30)                                                                                                                                                                  |
| ADR-BE-17         | Diff hiển thị cho người dùng dùng `diff` (unified, 3 dòng ngữ cảnh)                                                                                                                                                                                            |
| ADR-BE-18         | Ghi nguyên tử: file tạm cùng thư mục, `fsync`, `rename` có thử lại khi `EPERM`/`EBUSY`/`EACCES` (tối đa 10 lần). Ghi thất bại: báo lỗi, không để file dở                                                                                                       |
| ADR-BE-20         | Theo dõi thư mục dự án và `.reactcraft/` bằng `chokidar`, bỏ `node_modules`, `.git`, `dist`; gộp sự kiện 300 ms                                                                                                                                                |
| ADR-BE-23         | `pino`, xoay vòng log; `redact` token, header xác thực                                                                                                                                                                                                         |
| ADR-BE-24         | Cấu hình người dùng ở thư mục `env-paths` (`REACTCRAFT_CONFIG_DIR` ghi đè cho test). Không có API key. Lưu: ngôn ngữ, agent ưu tiên, editor để mở file, danh sách dự án đã tin cậy                                                                             |
| ADR-BE-25         | Phát hành một package `reactcraft` gồm server, Studio đã build, Bridge đã build, template; không có `postinstall`                                                                                                                                              |
| ADR-BE-26, FE-18  | Vitest cho unit, Playwright (Chromium, Firefox, WebKit) cho E2E chạy trên bản build thật                                                                                                                                                                       |
| ADR-BE-27, FE-19  | ESLint (QC-40 cấm `null`, QC-42 cấm chuỗi `.then`, hàm ≤ 50 dòng, file ≤ 400 dòng, không chữ cứng trong JSX), Prettier                                                                                                                                         |
| ADR-FE-01, 02, 03 | React 19, Vite 8, React Compiler (giữ `babel-plugin-react-compiler`), TypeScript                                                                                                                                                                               |
| ADR-FE-14         | Giao diện Studio dùng Tailwind v4 của Studio với token thiết kế (`wash`, `card`, `ink`, `sun`…), `lucide-react` cho icon, font Be Vietnam Pro và JetBrains Mono đóng gói                                                                                       |
| ADR-FE-16         | Mọi chữ hiển thị qua i18next, `vi` và `en` đầy đủ (VG-12); đổi ngôn ngữ không tải lại                                                                                                                                                                          |
| ADR-FE-17         | REST bằng `fetch` có token; WebSocket tự nối lại, sau khi nối lại gọi `GET /session`                                                                                                                                                                           |

---

## 6. ADR SỬA ĐỔI Ở BẢN 1.0

### ADR-BE-04 — Tổ chức mã nguồn (sửa đổi)

**Quyết định:** pnpm workspace gồm `shared`, `server`, `bridge`, `studio`, `cli` (mục 3.3). Phát hành một package `reactcraft`. `@reactcraft/shared` là nguồn duy nhất của schema API, sự kiện, mã lỗi và mô hình class Tailwind (dùng ở cả Studio và server).

### ADR-BE-05 — Phạm vi dự án (sửa đổi)

**Quyết định:** dự án được hỗ trợ như SRS mục 8. Kiểm tra khi mở dự án (M-PJ): có `package.json`; `vite` 7.x/8.x, `react` 18.x/19.x, `tailwindcss` 4.x trong dependency; có file cấu hình Vite; có file CSS chứa `@import "tailwindcss"`. Không đạt: E001 với `reasons` là mã lý do (`noPackageJson`, `noVite`, `viteVersion`, `noReact`, `reactVersion`, `noTailwind`, `tailwindVersion`, `noViteConfig`). CI chạy E2E trên dự án mẫu Vite 8 + React 19 + TS và Vite 7 + React 18 + JS.

### ADR-BE-18 — Ghi file (sửa đổi)

**Quyết định:** mọi lần ghi của Source Editor, History, tạo khung, hoàn tác lượt AI đều qua `FileSystemPort.writeTextAtomic`. Giữ nguyên ký tự xuống dòng (`\n` hay `\r\n`) và BOM của file gốc.

### ADR-FE-04 — Canvas (sửa đổi)

**Quyết định:** Canvas là `<iframe>` có `src` là địa chỉ dev server của dự án (`http://127.0.0.1:<D>/<đường dẫn trang>`), rộng đúng độ rộng khung thiết kế, cao theo nội dung (Bridge báo chiều cao), thu phóng bằng `transform: scale()` trên khung bao trong Studio. Không có thanh cuộn riêng trong iframe; vùng cuộn là vùng Canvas của Studio. `sandbox` **không** đặt (dự án cần chạy đầy đủ); an toàn dựa vào khác origin và tin cậy dự án (S-80).

### ADR-FE-06 — Mô hình class Tailwind (sửa đổi)

**Bối cảnh:** Inspector phải đọc class Tailwind thành giá trị và ghi giá trị thành class, tôn trọng biến thể (`max-sm:`, `md:`, `hover:`).

**Quyết định:**

- `@reactcraft/shared` có **bộ phân tích class**: tách chuỗi class thành danh sách `{ variants: string[], utility: string, value }`, nhận diện nhóm thuộc tính (padding, margin, gap, width, display, flex-direction, màu chữ, nền…) theo bảng ánh xạ của bản 0.18 (Styling Map) dùng theo chiều ngược.
- **Ghi:** thay đúng các class của một nhóm thuộc tính với cùng tập biến thể; class không nhận diện được giữ nguyên vị trí; không sắp xếp lại các class khác.
- Giá trị trên thang Tailwind (theo `@theme` của dự án nếu có) ghi dạng tên (`p-4`); giá trị khác ghi dạng tùy ý (`p-[13px]`).
- Biến thể responsive: `desktop-first` ghi `max-<bp>:`, `mobile-first` ghi `<bp>:`; khóa theo khung giữ thuật toán `bandOf`/`editBreakpoint` của WP-1.09A (chuyển sang `shared`).

### ADR-FE-07 — Overlay (sửa đổi)

**Quyết định:** khung hover, khung chọn, nhãn, tay cầm kéo, chỉ báo thả do **Bridge client vẽ bên trong iframe**, trong một phần tử gốc có **shadow root đóng** và `pointer-events: none` (trừ tay cầm), `z-index` cao nhất. Lý do: Studio không đọc được DOM của iframe khác origin; vẽ tại chỗ giữ PB-01 ≤ 16 ms mà không phải gửi tọa độ mỗi khung hình. Studio chỉ giữ **trạng thái chọn** và gửi lệnh (chọn theo vị trí nguồn, cuộn tới, tô sáng) qua ADR-FE-22.

### ADR-FE-09 — Kéo thả (sửa đổi)

**Quyết định:**

- Kéo **trong** Canvas (di chuyển phần tử): Bridge xử lý bằng Pointer Events, tính vị trí thả (thuật toán của bản 0.18 SPEC-04.1 mục 9.2, đã kiểm ở WP-1.08), gửi ý định `move` cho Studio.
- Kéo **từ Library vào Canvas**: Studio dùng `@dnd-kit/core`; khi con trỏ vào vùng Canvas, Studio gửi tọa độ (đã quy đổi theo thu phóng) cho Bridge; Bridge trả vị trí thả và vẽ chỉ báo; thả thì Studio gọi server chèn.

### ADR-FE-10 — State Studio (sửa đổi)

**Quyết định:** Zustand giữ trạng thái giao diện: dự án, trạng thái dev server, khung, thu phóng, vùng chọn (danh sách vị trí nguồn), thông tin phần tử đang chọn (do Bridge gửi), lịch sử hội thoại đang mở. **Không** giữ bản sao mã nguồn. Selector hẹp (R-CV-05 của bản 0.18 vẫn đúng tinh thần: không đọc cả store).

---

## 7. ADR MỚI Ở BẢN 1.0

### ADR-BE-28 — Chạy dự án: Vite của chính dự án trong tiến trình con

**Trạng thái:** Accepted — chờ VG-15

**Bối cảnh:** Canvas phải là dự án thật (C-02), với đúng cấu hình và plugin của dự án.

**Quyết định:**

- Server spawn tiến trình con `node <reactcraft>/runner-entry.js` (qua ADR-BE-31) với `cwd` là thư mục dự án, kênh IPC.
- Tiến trình con nạp `vite` **từ `node_modules` của dự án** (`createRequire(<dự án>/package.json)`), gọi `createServer({ root, server: { host: '127.0.0.1', port: <D>, strictPort: true, cors: false }, plugins: [reactcraftBridge(options)] })`. Cấu hình của dự án (`vite.config.*`) được Vite tự nạp và **gộp** với cấu hình trên; ReactCraft **không ghi** gì vào file cấu hình của dự án.
- Cổng `<D>` chọn trống trong 49152–65535, giữ nguyên trong suốt phiên (khởi động lại dev server dùng lại cổng) để CSP của Studio (S-10) không đổi.
- Tiến trình con báo qua IPC: `ready { port }`, `error { message, file?, line? }` (lỗi cấu hình, lỗi build), `exit`. Server chuyển thành sự kiện `runner.*`.
- Dự án chưa có `node_modules` hoặc thiếu `vite`: không chạy, báo cần cài dependency (M-PJ).

**Phương án đã xem xét:** chạy Vite trong cùng tiến trình server (lỗi plugin của dự án làm sập server, xung đột phiên bản Vite); chạy lệnh `npm run dev` của dự án (không chèn được plugin Bridge, không biết cổng chắc chắn).

### ADR-BE-29 — Phân tích và sửa mã nguồn

**Trạng thái:** Accepted — chờ VG-16

**Quyết định:**

- Phân tích bằng `@babel/parser` với `sourceType: 'module'`, plugin `jsx`, `typescript` (với `.ts`, `.tsx`), `errorRecovery: false`, giữ vị trí (`ranges`).
- Định vị phần tử theo **vị trí nguồn** (dòng, cột của thẻ mở JSX) mà Bridge gắn (ADR-FE-22).
- Sửa bằng `magic-string` trên văn bản gốc: chỉ thay, chèn, xóa đúng đoạn cần đổi; **không** in lại cây cú pháp, **không** chạy Prettier.
- Sau khi sửa: phân tích lại toàn file; lỗi thì **không ghi** và trả E024 (SRS NFR-06).
- Thụt lề của đoạn JSX chèn mới theo thụt lề của dòng nơi chèn.
- `@babel/parser` và `magic-string` cũng dùng trong plugin Bridge (gắn vị trí nguồn lúc Vite biến đổi file).

**Phương án đã xem xét:** `recast` (in lại cây làm đổi định dạng ngoài ý muốn), `ts-morph` (nặng, chỉ cho TypeScript), `oxc-parser` (nhanh nhưng hệ sinh thái sửa văn bản kém hơn; có thể thay ở bản sau nếu VG-16 cần).

### ADR-BE-30 — Lịch sử sửa (Undo/Redo)

**Trạng thái:** Accepted

**Quyết định:**

- Mỗi thao tác sửa nguồn tạo một mục lịch sử: `{ id, label, files: [{ path, before, after, beforeHash, afterHash }] }` (nội dung đầy đủ, để Undo đúng từng byte, NFR-08).
- Undo: với mỗi file, nội dung hiện tại phải có hash bằng `afterHash`; khác thì từ chối cả mục với E017 (file đã bị sửa từ nơi khác) và đánh dấu mục đó cùng các mục cũ hơn của file đó là không dùng được.
- Lưu trong bộ nhớ của server, tối đa 200 mục hoặc 50 MB; không lưu xuống đĩa (khởi động lại thì lịch sử trống; mã nguồn đã nằm trên đĩa).
- Gộp: các thay đổi liên tiếp của cùng một ô Inspector, cùng phần tử, trong 500 ms thành một mục (scrub, gõ số).
- Lượt AI có cơ chế riêng (ADR-BE-33), không đi qua lịch sử này.

### ADR-BE-31 — Tiến trình con

**Trạng thái:** Accepted

**Quyết định:** dùng `cross-spawn`, lệnh và tham số là mảng cố định, **không** dùng shell. Chỉ các loại được phép: runner dev server, cài dependency, agent AI, mở editor của người dùng, mở trình duyệt (S-50). Biến môi trường truyền xuống loại bỏ biến `REACTCRAFT_*` và token phiên (S-53). Mọi tiến trình con bị dừng khi server tắt.

### ADR-BE-32 — Khung dự án mới

**Trạng thái:** Accepted

**Quyết định:**

- Template nội bộ `templates/vite-react-ts-tailwind4/` (Vite 8, React 19, TypeScript, Tailwind v4 qua `@tailwindcss/vite`, `react-router` 7), không tải template qua mạng.
- Cấu trúc bắt buộc của template: `src/main.tsx`, `src/routes.tsx` (`createBrowserRouter` với mảng route tĩnh), `src/pages/Home.tsx`, `src/index.css` (`@import "tailwindcss"` và khối `@theme`), `src/api/` (trống, nơi agent viết lớp gọi API), `.reactcraft/agent-guide.md` (quy ước cho agent, người dùng sửa được).
- Cài dependency bằng package manager người dùng chọn (pnpm, npm, yarn) sau khi người dùng xem lệnh và đồng ý (S-54). Cần mạng.

### ADR-BE-33 — AI qua agent dòng lệnh trên máy

**Trạng thái:** Accepted — chờ VG-17

**Bối cảnh:** không lưu API key (C-07); agent của người dùng đọc backend và viết code tốt hơn bộ trích xuất tự viết.

**Quyết định:**

- Hỗ trợ **Antigravity CLI** (`agy`) trước; **Claude Code CLI** (`claude`) là tùy chọn nếu có trong `PATH`. Dò bằng cách chạy lệnh phiên bản (`agy --version`, `claude --version`).
- Mỗi lượt AI: server spawn agent ở chế độ không tương tác, `cwd` là thư mục dự án, đầu ra dạng luồng JSON, thêm thư mục **bản sao backend** (ADR-BE-34) làm thư mục đọc. Lệnh cụ thể và cờ quyền (cho phép sửa file trong dự án, không chạy lệnh shell tùy ý) chốt sau VG-17; ứng viên: `agy --print --output-format stream-json --add-dir <bản sao> [--conversation <id>]`; `claude -p --output-format stream-json --add-dir <bản sao> --permission-mode acceptEdits`.
- **Trước** lượt: chụp nội dung mọi file của dự án (trừ `node_modules`, `.git`, thư mục build) vào thư mục dữ liệu của ReactCraft. **Sau** lượt: so hash để lập danh sách file đã đổi, tạo mới, xóa. "Hoàn tác lượt này" khôi phục từ ảnh chụp.
- Lời nhắc gửi agent gồm: yêu cầu của người dùng; ngữ cảnh (SRS FR-62); nội dung `.reactcraft/agent-guide.md`; đường dẫn bản sao backend; tài liệu tính năng người dùng đã chỉ định.
- Hủy lượt: dừng tiến trình con (cả cây tiến trình).
- Hội thoại nhiều lượt dùng cơ chế tiếp tục hội thoại của agent; ReactCraft lưu tóm tắt từng lượt (yêu cầu, danh sách file đổi) trong thư mục dữ liệu, không lưu đầu ra thô của agent quá 1 MB mỗi lượt.

**Phương án đã xem xét:** MCP server để agent gọi công cụ của ReactCraft (người dùng phải chuyển qua lại giữa ứng dụng; để sau nếu cần); tự gọi API nhà cung cấp (cần API key, đã loại).

### ADR-BE-34 — Bản sao backend chỉ đọc

**Trạng thái:** Accepted

**Quyết định:**

- Agent **không bao giờ** nhận đường dẫn thật của backend. Server tạo bản sao ở `<thư mục cache>/mirrors/<workspaceId>/<backendId>/`.
- Loại khỏi bản sao: mọi mẫu file bí mật (S-30), `node_modules`, `.git`, `dist`, `build`, `.next`, `.venv`, `venv`, `__pycache__`, `target`, file nhị phân, file > 1 MB, và theo `.gitignore` của backend.
- Tổng dung lượng tối đa 50 MB; vượt thì báo, không chạy lượt AI có backend đó.
- Làm mới gia tăng (so `mtime` và kích thước) trước mỗi lượt.

### ADR-FE-21 — Danh sách dài

**Trạng thái:** Accepted. `@tanstack/react-virtual` cho Layer Tree và danh sách file đã đổi. Đọc `getVirtualItems()` trong hook mà React Compiler bỏ qua (bài học WP-1.08).

### ADR-FE-22 — Giao thức Canvas ↔ Studio (Bridge)

**Trạng thái:** Accepted — chờ VG-15

**Quyết định:**

- Plugin Bridge (chạy trong Vite của dự án) với mỗi file `.jsx`/`.tsx` trong thư mục nguồn của dự án (không phải `node_modules`): gắn thuộc tính `data-rc-loc="<đường dẫn tương đối>:<dòng>:<cột>"` vào **thẻ JSX viết thường** (phần tử HTML), dùng ADR-BE-29. Chỉ ở dev server do ReactCraft chạy; không ảnh hưởng `vite build`.
- Plugin chèn script Bridge client vào `index.html` khi phục vụ (`transformIndexHtml`).
- Trao đổi chỉ qua `window.postMessage`: Studio gửi tới `iframe.contentWindow` với `targetOrigin` = origin dev server; Bridge gửi tới `window.parent` với `targetOrigin` = origin Studio. Mỗi thông điệp có `rc: 1`, `nonce` (sinh mỗi phiên, truyền cho plugin qua tùy chọn) và `type`. Bên nhận **BẮT BUỘC** kiểm tra `event.origin`, `nonce`, và parse bằng Zod trước khi dùng (S-new ở SPEC-05).
- Danh mục thông điệp (chi tiết ở SPEC-03): Bridge → Studio: `ready`, `hover`, `select`, `selection-info` (vị trí nguồn, hình chữ nhật, thẻ, chuỗi class, chữ tĩnh?), `tree` (cây phần tử có vị trí nguồn), `route` (đường dẫn hiện tại), `size` (chiều cao trang), `runtime-error`, `drop-target`, `move-intent`, `text-commit`. Studio → Bridge: `select-loc`, `highlight-loc`, `scroll-to`, `set-mode` (thiết kế / xem thử), `drag-over`, `drag-end`, `navigate`.

---

## 8. NGÂN SÁCH HIỆU NĂNG

| Mã    | Chỉ tiêu                                                          | Ngân sách                           | SRS    |
| ----- | ----------------------------------------------------------------- | ----------------------------------- | ------ |
| PB-01 | Cập nhật khung hover, khung chọn trong Bridge                     | ≤ 16 ms mỗi khung hình              | NFR-01 |
| PB-02 | Xác nhận ô Inspector → Canvas hiện thay đổi (gồm ghi file và HMR) | ≤ 500 ms (P95), dự án mẫu           | NFR-02 |
| PB-03 | Thao tác sửa nguồn ở server: phân tích, sửa, phân tích lại, ghi   | ≤ 100 ms, file ≤ 2.000 dòng         | NFR-03 |
| PB-04 | Dev server sẵn sàng                                               | ≤ 15 s, dự án mẫu đã cài dependency | NFR-04 |
| PB-05 | Khởi động CLI tới khi Studio sẵn sàng (chưa tính dev server)      | ≤ 2 s                               | —      |
| PB-06 | Bundle khởi đầu của Studio                                        | ≤ 600 KB gzip                       | —      |
| PB-07 | Đổi ngôn ngữ Studio                                               | ≤ 200 ms, không tải lại             | NFR-12 |
| PB-08 | Làm mới bản sao backend                                           | ≤ 10 s cho 50 MB                    | NFR-05 |
| PB-09 | Bộ nhớ server (không tính tiến trình con)                         | ≤ 400 MB                            | —      |

Mã PB của bản 0.18 không còn hiệu lực.

---

## 9. BÀI KIỂM CHỨNG BẮT BUỘC (VG)

| VG    | Kiểm chứng                 | ADR                      | Đạt khi                                                                                                                                                                                                                                                                                                                                                                     | Trạng thái |
| ----- | -------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| VG-01 | Ghi nguyên tử trên Windows | ADR-BE-18                | Đã đạt ở Phase 0                                                                                                                                                                                                                                                                                                                                                            | Đạt        |
| VG-07 | Server local               | ADR-BE-03, 06            | Đã đạt ở Phase 0                                                                                                                                                                                                                                                                                                                                                            | Đạt        |
| VG-12 | Đầy đủ bản dịch            | ADR-FE-16                | Đã đạt, chạy ở mọi cổng                                                                                                                                                                                                                                                                                                                                                     | Đạt        |
| VG-13 | React Compiler             | ADR-FE-02                | Đã đạt                                                                                                                                                                                                                                                                                                                                                                      | Đạt        |
| VG-15 | Chạy dự án và Bridge       | ADR-BE-28, FE-04, 07, 22 | Trên Chromium, Firefox, WebKit, với dự án mẫu Vite 8 + React 19 + TS và Vite 7 + React 18 + JS: dev server khởi động qua runner; iframe khác origin hiển thị; rê và bấm phần tử trả đúng `file:dòng:cột`; sau khi sửa file (HMR) vị trí nguồn vẫn đúng; thông điệp sai origin hoặc sai nonce bị bỏ qua; khung hover ≤ 16 ms                                                 | Chưa làm   |
| VG-16 | Sửa nguồn khứ hồi          | ADR-BE-29, 30            | Bộ 40 file mẫu (TS, JS, nhiều kiểu định dạng, CRLF, BOM): đổi class, đổi chữ, chèn, xóa, di chuyển thẻ; diff chỉ ở đúng chỗ; Undo đúng từng byte; file sai cú pháp sau sửa không được ghi; PB-02, PB-03 đạt                                                                                                                                                                 | Chưa làm   |
| VG-17 | Agent chạy không tương tác | ADR-BE-33, 34            | Với `agy` (và `claude` nếu có): chạy không cần tương tác, sửa được file trong dự án, **không** chạy lệnh shell khi cấu hình chặn, có luồng tiến trình đọc được, hủy được, tiếp tục hội thoại được; dò được trạng thái "chưa cài" và "chưa đăng nhập"; một yêu cầu mẫu (đọc bản sao backend Express, viết lớp gọi API và một trang) chạy hết; thư mục backend thật không đổi | Chưa làm   |
| VG-18 | Khung dự án và cài đặt     | ADR-BE-32                | Tạo khung + cài bằng pnpm, npm, yarn trên Windows và macOS; dev server chạy được ngay; thời gian cài ghi lại                                                                                                                                                                                                                                                                | Chưa làm   |

VG-02 đến VG-06, VG-08 đến VG-11, VG-14 của bản 0.18: không còn hiệu lực.

---

# SPEC-07 — QUY TRÌNH THI CÔNG (LỘ TRÌNH BẢN 1.0)

**Phiên bản phần:** 1.0 (lộ trình). DoR, DoD, kiểm soát thay đổi, mức nghiêm trọng, phát hành: giữ như bản 0.18 tới khi viết lại ở đợt 3.

---

## 1. QUY TẮC THI CÔNG MỚI

| Mã    | Quy tắc                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CW-50 | **Test của cả phase viết trước:** đầu mỗi phase, bộ test nghiệm thu của phase (E2E cho mọi AC của cổng, unit và hợp đồng cho từng module) được viết, kiểm bằng bản cài đặt nháp khi khả thi, và khóa lại. Code của phase làm cho bộ test đó xanh |
| CW-51 | **Chạy test một lần:** trong lúc làm chỉ chạy test của phần đang sửa; bộ đầy đủ của phase chạy ở cuối mỗi lần giao và ở cổng                                                                                                                     |
| CW-52 | **Đọc trước khi sửa:** trước khi sửa một file, đọc file đó và các file liên quan (nơi gọi, nơi được gọi, test). Không đoán                                                                                                                       |
| CW-53 | **Xong là đúng:** một lần giao chỉ xong khi `pnpm verify` và bộ E2E của phase đã viết xanh trên 3 trình duyệt                                                                                                                                    |

Quy trình giao việc và kiểm tra (Claude viết test và hợp đồng, Gemini viết code, Claude QA) ghi ở `docs/construction/giao-viec/README.md`.

---

## 2. TỔNG QUAN PHASE

| Phase | Tên                            | Mục tiêu                                                                                                                   | Cổng                          |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 0     | Nền móng                       | Repo, CI, server an toàn, CLI, i18n, hạ tầng test, Settings, tin cậy dự án                                                 | Đã đạt phần việc; giữ kết quả |
| 1     | Dự án và Canvas chạy code thật | Mở, tạo khung, chạy dự án; Canvas hiện dự án; chọn phần tử ra đúng dòng code; Inspector sửa class; sửa chữ; Undo/Redo      | G1                            |
| 2     | Cấu trúc và trang              | Library, kéo thả, di chuyển, xóa, bọc, sao chép/dán, phím tắt, chọn nhiều, quản lý trang, CLI hoàn chỉnh và gói cài        | G2                            |
| 3     | AI chat                        | Agent trên máy, bản sao backend, chat có tiến trình, xem lại và hoàn tác lượt AI                                           | G3                            |
| 4     | Nâng cao và phát hành          | Token `@theme`, tách component, xem nhiều khung, kiểm tra build, Tailwind v3, monorepo, tài liệu người dùng, phát hành 1.0 | G4                            |

---

## 3. PHASE 1 — DỰ ÁN VÀ CANVAS CHẠY CODE THẬT

### 3.1. Gói công việc

| Mã      | Nội dung                                                                                                                                                                                                                                                                                                                                                                | Phụ thuộc        | Đầu ra kiểm chứng được                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| WP-1.01 | **Dọn hướng cũ:** xóa Design Model, Design Store, Canvas dựng từ model, Overlay/kéo thả/Inspector/Layer Tree/Library theo model, test và fixture của chúng; tạo `packages/shared` (chuyển schema API, mã lỗi, bảng ánh xạ Tailwind, khóa responsive); giữ shell, Settings, tin cậy, bảo mật, CLI; thay `docs/spec.md` bằng bản 1.0; cập nhật `scripts/trace-scope.json` | Spec 1.0 đủ phần | `pnpm verify` xanh; E2E còn lại (khởi động, phiên, cài đặt, tin cậy) xanh |
| WP-1.02 | **Bộ test nghiệm thu Phase 1 (CW-50)** + spike VG-15, VG-16                                                                                                                                                                                                                                                                                                             | WP-1.01          | Báo cáo VG-15, VG-16 Đạt; bộ test Phase 1 có, đỏ đúng lý do               |
| WP-1.03 | M-PJ: mở dự án, `workspace.json` mới, kiểm tra phạm vi (E001), tạo khung (ADR-BE-32), cài dependency có xác nhận (E028), nút Project trong Studio, liên kết backend                                                                                                                                                                                                     | WP-1.02          | AC-01                                                                     |
| WP-1.04 | M-RN: runner dev server (ADR-BE-28), trạng thái và lỗi, khởi động lại; Canvas iframe, khung, thu phóng, chiều cao theo nội dung                                                                                                                                                                                                                                         | WP-1.03          | AC-02 (phần hiển thị); PB-04                                              |
| WP-1.05 | M-BR + M-SL: plugin và client Bridge, vị trí nguồn, overlay trong shadow root, chọn và hover, Layer Tree theo cây Bridge, mở trong editor                                                                                                                                                                                                                               | WP-1.04          | AC-02; PB-01                                                              |
| WP-1.06 | M-SE + M-HI: Source Editor (đổi class, đổi chữ, đổi thuộc tính), kiểm tra sau sửa (E024), không sửa được (E023), lịch sử Undo/Redo (E017), sửa từ bên ngoài                                                                                                                                                                                                             | WP-1.05          | AC-10, AC-12; PB-03                                                       |
| WP-1.07 | M-TW + M-IN: mô hình class Tailwind, Inspector (các nhóm của SRS FR-20), responsive, trạng thái, token theo tên                                                                                                                                                                                                                                                         | WP-1.06          | AC-03, AC-04; PB-02                                                       |
| WP-1.08 | Sửa chữ trực tiếp trên Canvas                                                                                                                                                                                                                                                                                                                                           | WP-1.06          | AC-06                                                                     |

### 3.2. Cổng G1

| Mã    | Tiêu chí                                                                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1-01 | AC-01, 02, 03, 04, 06, 10, 12 và phần bảo mật của AC-11 (token, Origin, dự án chưa tin cậy không chạy dev server) tự động hóa, đạt trên Chromium, Firefox, WebKit, giao diện `vi` và `en` |
| G1-02 | VG-15, VG-16 Đạt                                                                                                                                                                          |
| G1-03 | PB-01 đến PB-05 đạt                                                                                                                                                                       |
| G1-04 | Kịch bản nghiệm thu chạy tay trên Windows và macOS (mục 3.3)                                                                                                                              |

### 3.3. Kịch bản nghiệm thu G1

1. `reactcraft` trong thư mục trống → Project → tạo khung → đồng ý cài → Canvas hiện trang Home.
2. Chọn tiêu đề trên Canvas: Studio hiện `src/pages/Home.tsx:<dòng>`; mở trong editor đúng dòng.
3. Inspector: đổi padding, màu chữ; `git diff` chỉ đổi chuỗi class; Undo về đúng như cũ.
4. Khung Mobile: đổi cỡ chữ; file có class `max-sm:…`; khung Desktop không đổi.
5. Sửa file bằng VS Code: Canvas cập nhật; Undo báo file đã đổi.

---

## 4. PHASE 2 — CẤU TRÚC VÀ TRANG

| Mã      | Nội dung                                                                          | Đầu ra                                       |
| ------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| WP-2.01 | Bộ test nghiệm thu Phase 2                                                        | Có, đỏ đúng lý do                            |
| WP-2.02 | M-SE mở rộng: chèn, di chuyển, xóa, nhân bản, bọc, bỏ bọc thẻ JSX                 | Unit + VG-16 mở rộng                         |
| WP-2.03 | M-LB: Library khối JSX + Tailwind, tìm kiếm `vi`/`en`, kéo vào Canvas             | AC-05                                        |
| WP-2.04 | Kéo thả trong Canvas (Bridge), chọn nhiều, sao chép/dán                           | AC-05                                        |
| WP-2.05 | M-PG: trang theo `src/routes.tsx` (thêm, đổi tên, xóa), điều hướng trong Canvas   | AC-07                                        |
| WP-2.06 | M-KB: phím tắt Windows và macOS                                                   | Test cả hai nền                              |
| WP-2.07 | CLI hoàn chỉnh (tham số, tắt an toàn dừng tiến trình con), gói cài `pnpm package` | Cài và chạy từ tarball trên Windows và macOS |

Cổng G2: AC-05, AC-07 và mọi E2E của Phase 1 vẫn xanh.

---

## 5. PHASE 3 — AI CHAT

| Mã      | Nội dung                                                         | Đầu ra                                               |
| ------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| WP-3.01 | Bộ test nghiệm thu Phase 3 (agent giả lập cho CI) + spike VG-17  | VG-17 Đạt                                            |
| WP-3.02 | M-MR: bản sao backend (ADR-BE-34)                                | Chuỗi đánh dấu bí mật không có trong bản sao (AC-11) |
| WP-3.03 | M-AG: kết nối agent (dò, chạy, luồng tiến trình, hủy, hội thoại) | Test với agent giả lập                               |
| WP-3.04 | Ảnh chụp lượt AI, danh sách file đổi, diff, hoàn tác lượt        | NFR-09                                               |
| WP-3.05 | M-CH: ô chat trong Studio, ngữ cảnh vùng chọn, cài đặt agent     | AC-08, AC-09                                         |

CI dùng **agent giả lập** (một script nhận đúng tham số dòng lệnh và đọc kịch bản ghi sẵn) để không gọi AI thật. Cổng G3 có thêm kiểm tra tay với agent thật trên Windows và macOS.

---

## 6. PHASE 4 — NÂNG CAO VÀ PHÁT HÀNH

| Mã      | Nội dung                                                                            |
| ------- | ----------------------------------------------------------------------------------- |
| WP-4.01 | Token trong `@theme` (màu, cỡ chữ, bo góc): xem, sửa, thêm                          |
| WP-4.02 | Tách vùng chọn thành component (file mới, thay chỗ cũ)                              |
| WP-4.03 | Xem nhiều khung cạnh nhau                                                           |
| WP-4.04 | Kiểm tra build (`tsc --noEmit`, `vite build`) theo yêu cầu                          |
| WP-4.05 | Mở rộng phạm vi: Tailwind v3, dự án JavaScript thuần, monorepo                      |
| WP-4.06 | Tài liệu người dùng `vi`/`en`, kiểm tra giấy phép, kiểm tra máy sạch, phát hành 1.0 |

---

## 7. NHỮNG GÌ GIỮ LẠI TỪ PHASE 0 VÀ PHASE 1 CŨ

| Kết quả cũ                                                                                                                                                       | Số phận                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Repo, CI, hook commit, lint, format, i18n, hạ tầng test, VG-01, 07, 12, 13                                                                                       | Giữ                                             |
| Server: bảo mật (token, Host/Origin, header), phiên, WebSocket, cấu hình người dùng, khóa dự án E018, tin cậy dự án (S-80 đến S-84), ghi nguyên tử có thử lại    | Giữ, điều chỉnh theo `workspace.json` mới       |
| Studio: khung ứng dụng, thanh công cụ, panel co giãn, Settings, hộp thoại tin cậy, lớp phủ mất kết nối, chọn ngôn ngữ                                            | Giữ                                             |
| Bảng ánh xạ Tailwind (Styling Map), khóa responsive (`bandOf`, `editBreakpoint`)                                                                                 | Chuyển sang `shared`, dùng theo chiều đọc class |
| Thuật toán vị trí thả, cách gom selection, bài học iframe khác "vũ trụ" JS                                                                                       | Dùng lại trong Bridge                           |
| Design Model, operation, Design Store, Canvas dựng từ model, Overlay/Inspector/Layer Tree/Library/kéo thả theo model, preset dạng model, TipTap, Inspector 9A–9C | Xóa ở WP-1.01                                   |

---

# LỊCH SỬ THAY ĐỔI

| Ngày       | Phiên bản         | Thay đổi                                                                                                                                            |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-13 | 1.0 (nháp, đợt 1) | Chuyển sang hướng "mã nguồn là nguồn sự thật" theo SRS v5.0. Viết lại Phần 0, SPEC-01, lộ trình SPEC-07. Bỏ toàn bộ hướng Design Model của bản 0.18 |
