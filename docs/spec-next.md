# SPEC — REACTCRAFT LOCAL

## Bộ đặc tả kỹ thuật thi công (Technical Specification Set)

**Dự án:** ReactCraft Local  
**Tài liệu gốc:** ReactCraft Local — Software Requirements Specification v5.0  
**Phiên bản tài liệu:** 1.0 (bản nháp đang viết lại theo hướng "mã nguồn là nguồn sự thật")  
**Trạng thái:** Đang viết lại — xem mục 0.2  
**Cập nhật lần cuối:** 2026-10-14

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
| SPEC-02 | Quy chuẩn code & repo                                             | Chờ viết lại (đợt 3)                                            |
| SPEC-03 | Giao tiếp: API REST, sự kiện WebSocket, giao thức cầu nối, mã lỗi | Đã viết lại (đợt 2); chi tiết endpoint Phase 2–4 ở đợt 3        |
| SPEC-04 | Đặc tả module theo phase                                          | Phase 1 đã viết (đợt 2); Phase 2–4 ở đợt 3                      |
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
3. `packages/bridge/` chạy **trong tiến trình Vite của dự án** (plugin) và **trong trang của dự án** (client). **KHÔNG ĐƯỢC** import gì từ `server` hay `studio`; được import `@reactcraft/shared` (schema giao thức Bridge) và thư viện ghi ở ADR-BE-29.
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
│   │       └── runners/             # script chạy trong tiến trình con, mỗi framework một file (ADR-BE-28, SPEC-04 M-FW)
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

**Quyết định:** dự án được hỗ trợ như SRS mục 8. Kiểm tra khi mở dự án (M-PJ): có `package.json`; `vite` 7.x/8.x, `react` 18.x/19.x, `tailwindcss` 4.x trong dependency; có file cấu hình Vite; có file CSS chứa `@import "tailwindcss"`. Không đạt: E001 với `reasons` là mã lý do (`noPackageJson`, `noVite`, `viteVersion`, `noReact`, `reactVersion`, `noTailwind`, `tailwindVersion`, `noViteConfig`, `noTailwindCss`). CI chạy E2E trên dự án mẫu Vite 8 + React 19 + TS và Vite 7 + React 18 + JS.

### ADR-BE-18 — Ghi file (sửa đổi)

**Quyết định:** mọi lần ghi của Source Editor, History, tạo khung, hoàn tác lượt AI đều qua `FileSystemPort.writeTextAtomic`. Giữ nguyên ký tự xuống dòng (`\n` hay `\r\n`) và BOM của file gốc.

### ADR-FE-04 — Canvas (sửa đổi)

**Quyết định:** Canvas là `<iframe>` có `src` là địa chỉ dev server của dự án (`http://127.0.0.1:<D>/<đường dẫn trang>`), rộng và cao đúng kích thước khung thiết kế, trang cuộn **bên trong** iframe như trên thiết bị thật (đơn vị `vh` của dự án đúng như thật), thu phóng bằng `transform: scale()` trên khung bao trong Studio (SPEC-04 R-RN-21). `sandbox` **không** đặt (dự án cần chạy đầy đủ); an toàn dựa vào khác origin và tin cậy dự án (S-80).

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

- Server spawn tiến trình con `node <reactcraft>/runners/<framework>.js` (qua ADR-BE-31) với `cwd` là thư mục dự án, kênh IPC.
- Tiến trình con nạp `vite` **từ `node_modules` của dự án** (`createRequire(<dự án>/package.json)`), gọi `createServer({ root, server: { host: '127.0.0.1', port: <D>, strictPort: true, cors: false }, plugins: [reactcraftBridge(options)] })`. Cấu hình của dự án (`vite.config.*`) được Vite tự nạp và **gộp** với cấu hình trên; ReactCraft **không ghi** gì vào file cấu hình của dự án.
- Cổng `<D>` chọn trống trong 49152–65535, dùng lại khi khởi động lại trong phiên; bị chiếm thì đổi cổng một lần (SPEC-04 R-RN-04). CSP `frame-src` của Studio cho phép origin dev server hiện tại (chi tiết S-10 ở SPEC-05, đợt 3).
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
- Danh mục thông điệp chính thức ở SPEC-03 mục 7. Thông tin **nguồn** của phần tử (class tĩnh hay biểu thức, chữ tĩnh, component chứa nó) do server đọc từ mã nguồn (`GET /source/element`); Bridge chỉ báo thông tin **lúc chạy** (vị trí, hình chữ nhật, số bản lặp).

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

# SPEC-03 — GIAO TIẾP: API, SỰ KIỆN, GIAO THỨC BRIDGE, MÃ LỖI

**Phiên bản phần:** 1.0  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v5.0 mục 9 (FR), mục 13 (mã lỗi); SPEC-01 ADR-BE-07, ADR-FE-22

---

## 1. MỤC ĐÍCH VÀ QUY ƯỚC

Phần này là **hợp đồng** giữa ba bên: Studio ↔ server (REST, WebSocket) và Studio ↔ Bridge trong Canvas (`postMessage`).

1. Mọi kiểu dưới đây có schema Zod trong `@reactcraft/shared`; kiểu TypeScript suy ra từ schema (ADR-BE-02). Kiểu viết ở đây là bản cho người đọc; schema là bản chính thức và **BẮT BUỘC** khớp với phần này.
2. Mọi object là `strictObject`, mọi trường `readonly` (không viết lại `readonly` ở dưới cho gọn).
3. Cột **Phase** cho biết phase cài đặt. Endpoint của Phase 2–4 chỉ ghi tên ở mục 9; chi tiết viết ở đợt 3.
4. `@reactcraft/bridge` được import `@reactcraft/shared` (schema giao thức Bridge) — bổ sung cho SPEC-01 mục 3.2 quy tắc 3.

---

## 2. KIỂU CƠ SỞ

```ts
type ProjectId = string; // nanoid 10 ký tự
type BackendId = string; // nanoid 10 ký tự
type JobId = string; // 'j_' + nanoid 10
type HistoryId = string; // 'h_' + nanoid 10
type Sha256 = string; // hex thường, 64 ký tự
type RelPath = string; // đường dẫn tương đối từ gốc dự án, dấu '/'
type LocString = string; // `${file}:${line}:${column}` — giá trị của data-rc-loc

type SourceLoc = { file: RelPath; line: number; column: number };
type ElementRef = { loc: LocString; index: number };
type Rect = { x: number; y: number; width: number; height: number };

type ResponsiveKey = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type Breakpoint = 'base' | ResponsiveKey;
type ResponsiveMode = 'desktop-first' | 'mobile-first';
type InteractionState = 'hover' | 'focus' | 'disabled';
type Frame = { id: string; label: string; width: number; height: number };
type EditableAttr = 'href' | 'src' | 'alt' | 'placeholder' | 'type';
```

| Mã    | Quy tắc                                                                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V-100 | `RelPath`: 1..512 ký tự, dấu `/`, không bắt đầu bằng `/` hay tên ổ đĩa, không có đoạn `..` hay `.`, không ký tự điều khiển, không `\`. Sai dạng: E016. Sau khi nối với gốc dự án vẫn phải nằm trong gốc (S-22), ngược lại E012 |
| V-101 | `LocString` tách từ **phải sang trái**: hai đoạn cuối sau dấu `:` là `line`, `column` (số nguyên ≥ 1); phần còn lại là `file` theo V-100. Sai dạng: E016                                                                       |
| V-102 | `line` đếm từ 1. `column` đếm từ 1 theo đơn vị mã UTF-16 (như VS Code), không tính BOM. Vị trí là ký tự `<` của **thẻ mở** JSX                                                                                                 |
| V-103 | `ElementRef.index` là thứ tự (từ 0) của phần tử trong `document.querySelectorAll('[data-rc-loc="<loc>"]')`, theo thứ tự tài liệu, không tính phần tử trong overlay của Bridge                                                  |
| V-104 | `Rect` tính bằng px CSS trong khung nhìn của iframe (như `getBoundingClientRect`), chưa nhân thu phóng của Studio                                                                                                              |
| V-07  | `desktop-first`: khung khác **KHÔNG** được rộng hơn khung chuẩn. `mobile-first`: khung khác **KHÔNG** được hẹp hơn khung chuẩn                                                                                                 |
| V-09  | Danh sách khung có 1..8 khung, `id` theo `^[a-z0-9-]{1,32}$` không trùng, `label` 1..32 ký tự, `width` 320..3840, `height` 320..2160, đúng một khung chuẩn (`primaryFrameId`)                                                  |

Mốc breakpoint mặc định: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536 px; dự án có `--breakpoint-<khóa>` trong `@theme` thì dùng giá trị đó. Thuật toán `bandOf`, `editBreakpoint` giữ nguyên bản 0.18 (đã chuyển sang `shared`, có test):

| Chế độ          | `bandOf(w)`                                                          |
| --------------- | -------------------------------------------------------------------- |
| `desktop-first` | Khóa **nhỏ nhất** có mốc **lớn hơn** `w`; `base` nếu `w ≥` mốc `2xl` |
| `mobile-first`  | Khóa **lớn nhất** có mốc **≤** `w`; `base` nếu `w <` mốc `sm`        |

`editBreakpoint(w)` = `base` nếu `bandOf(w) = bandOf(khung chuẩn)`, ngược lại `bandOf(w)`. Khóa `k` ghi thành biến thể `max-k:` (`desktop-first`) hoặc `k:` (`mobile-first`).

---

## 3. FILE CỦA REACTCRAFT TRONG DỰ ÁN

| File                         | Nội dung                               | Ai ghi                   |
| ---------------------------- | -------------------------------------- | ------------------------ |
| `.reactcraft/workspace.json` | `WorkspaceFile` (dưới đây)             | Server                   |
| `.reactcraft/lock`           | Khóa phiên (giữ cơ chế bản 0.18, E018) | Server                   |
| `.reactcraft/.gitignore`     | Một dòng `lock`                        | Server, khi mở lần đầu   |
| `.reactcraft/agent-guide.md` | Quy ước cho agent AI (Phase 3)         | Template; người dùng sửa |

Lịch sử Undo, ảnh chụp lượt AI, bản sao backend **không** nằm trong dự án (ở thư mục dữ liệu và cache của người dùng, `env-paths`).

```ts
type WorkspaceFile = {
  schemaVersion: 2;
  id: ProjectId;
  name: string; // 1..64 ký tự
  createdAt: string; // ISO 8601 UTC
  framework: 'vite-react'; // id bộ chuyển đổi framework (SPEC-04 mục 1)
  sourceDir: RelPath; // mặc định 'src'
  backends: BackendLink[]; // tối đa 10
  responsiveMode: ResponsiveMode;
  frames: Frame[];
  primaryFrameId: string;
};

type BackendLink = { id: BackendId; path: string; label: string }; // label 1..64 ký tự
```

| Mã    | Quy tắc                                                                                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-03  | Đường dẫn backend nằm trong thư mục cha của dự án được lưu dạng **tương đối**, dấu `/` (ví dụ `../shop-api`)                                                                                       |
| V-04  | Đường dẫn ngoài phạm vi đó lưu tuyệt đối; Studio cảnh báo "dự án không chuyển sang máy khác được"                                                                                                  |
| V-05  | Đường dẫn backend không tồn tại **KHÔNG** làm hỏng việc mở dự án; liên kết hiện trạng thái `missing` để người dùng chọn lại                                                                        |
| V-105 | `workspace.json` không parse được, sai schema, hoặc `schemaVersion` khác `2` (kể cả `1` của bản 0.18): E003 `{ file, reason: 'invalid' \| 'unsupportedVersion' }`. Server **không** tự ghi đè file |
| V-106 | `workspace.json` ≤ 1 MB, độ sâu JSON ≤ 64 (S-29)                                                                                                                                                   |

Khung mặc định khi tạo `workspace.json`:

| Chế độ          | Khung (khung chuẩn in đậm)                                  |
| --------------- | ----------------------------------------------------------- |
| `desktop-first` | **Desktop 1440 × 900**, Tablet 768 × 1024, Mobile 375 × 812 |
| `mobile-first`  | **Mobile 375 × 812**, Tablet 768 × 1024, Desktop 1440 × 900 |

---

## 4. QUY ƯỚC CHUNG CỦA API

### 4.1. Cơ bản (giữ bản 0.18)

| Mục                | Quy định                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Địa chỉ gốc        | `http://127.0.0.1:<P>/api/v1`                                                            |
| Định dạng          | JSON, UTF-8                                                                              |
| Xác thực REST      | `Authorization: Bearer <sessionToken>`                                                   |
| Xác thực WebSocket | Subprotocol `reactcraft.v1` và `reactcraft.token.<sessionToken>`; sai thì đóng mã `4401` |
| Mã request         | `requestId` trong header `X-Request-Id` và trong lỗi                                     |
| Giới hạn body      | 10 MB (ADR-BE-06)                                                                        |
| Thành công         | `{ "data": … }`; 204 không có body                                                       |
| Lỗi                | `{ "error": { "code", "params"?, "details"?, "requestId" } }`                            |

```ts
type AppError = {
  code: ErrorCode;
  params?: Record<string, string | number | boolean | string[]>;
  details?: ErrorDetail[]; // tối đa 50 mục
};
type ErrorDetail = {
  path?: string;
  line?: number;
  column?: number;
  rule?: string;
  message: string;
};
```

### 4.2. Tác vụ dài (job)

```text
POST …                 → 202 { data: { jobId } }
WebSocket              → job.progress (0..n) rồi job.completed | job.failed | job.cancelled
GET  /jobs/{id}        → JobStatus (dùng khi mất kết nối WebSocket)
POST /jobs/{id}/cancel → 202
```

```ts
type JobKind = 'project.install' | 'agent.turn'; // agent.turn từ Phase 3
type JobStatus = {
  id: JobId;
  kind: JobKind;
  state: 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: { done: number; total: number; stepKey?: string };
  result?: unknown; // kiểu theo kind
  error?: AppError;
  startedAt: string;
  finishedAt?: string;
};
```

| Mã   | Quy tắc                                                                                   |
| ---- | ----------------------------------------------------------------------------------------- |
| V-60 | `stepKey` là khóa i18n (ví dụ `jobs:install.running`), không phải câu đã dịch             |
| V-61 | Server giữ trạng thái job đã xong 10 phút                                                 |
| V-62 | Mỗi loại job chạy tối đa **một** cùng lúc trên một dự án; gửi thêm khi đang chạy trả E018 |

---

## 5. DANH MỤC ENDPOINT PHASE 1

### 5.1. Phiên, hệ thống

| Method | Đường dẫn                | Mô tả                                                                         | Thành công             | Lỗi chính        |
| ------ | ------------------------ | ----------------------------------------------------------------------------- | ---------------------- | ---------------- |
| GET    | `/session`               | Phiên bản, nền tảng, dự án đang mở                                            | 200 `SessionInfo`      | E014             |
| GET    | `/fs/directories?path=…` | Liệt kê **thư mục con** để chọn thư mục (S-27). Không có `path`: thư mục home | 200 `DirectoryListing` | E011, E012, E015 |
| POST   | `/open-in-editor`        | Mở file tại vị trí nguồn trong editor đã chọn `{ loc: LocString }`            | 204                    | E012, E015, E021 |
| GET    | `/jobs/{id}`             | Trạng thái job                                                                | 200 `JobStatus`        | E015             |
| POST   | `/jobs/{id}/cancel`      | Hủy job                                                                       | 202                    | E015             |

```ts
type SessionInfo = {
  version: string;
  platform: 'win32' | 'darwin' | 'linux';
  features: FeatureId[];
  project:
    | { state: 'none'; suggestedPath?: string } // thư mục truyền cho CLI nhưng chưa mở được
    | { state: 'open'; id: ProjectId; name: string; trusted: boolean }
    | { state: 'error'; error: AppError };
};

type DirectoryListing = {
  path: string; // tuyệt đối, đã chuẩn hóa
  parent?: string;
  roots?: string[]; // Windows: các ổ đĩa (C:\, D:\…)
  entries: { name: string; path: string; isProject: boolean }[]; // isProject: có package.json
  truncated?: true;
};
```

### 5.2. Cấu hình người dùng

| Method | Đường dẫn   | Mô tả | Thành công     | Lỗi chính |
| ------ | ----------- | ----- | -------------- | --------- |
| GET    | `/settings` | Đọc   | 200 `Settings` |           |
| PATCH  | `/settings` | Sửa   | 200 `Settings` | E016      |

```ts
type Settings = {
  language?: 'vi' | 'en'; // chưa đặt: Studio theo trình duyệt
  editor: 'vscode' | 'cursor' | 'webstorm' | 'zed'; // mặc định 'vscode'
  packageManager?: 'pnpm' | 'npm' | 'yarn'; // ưu tiên khi tạo dự án mới
  agent: { preferred: 'auto' | 'agy' | 'claude' }; // dùng từ Phase 3, mặc định 'auto'
};
type SettingsPatch = Partial<Omit<Settings, 'agent'>> & { agent?: Partial<Settings['agent']> };
```

| Mã    | Quy tắc                                                                                                                                                                                                              |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-107 | `config.json` của bản 0.18 (có `ai`, `export`, `trustedWorkspaces`) đọc được: khóa lạ bị bỏ qua (không lỗi, không mất `language`), bị xóa ở lần ghi sau. Quyết định tin cậy cũ không còn hiệu lực (khác dấu vân tay) |
| V-108 | `config.json` không bao giờ chứa API key hay token                                                                                                                                                                   |

Lệnh mở editor (mảng tham số, không shell, ADR-BE-31): `vscode` → `code -g <file>:<line>:<column>`; `cursor` → `cursor -g <file>:<line>:<column>`; `webstorm` → `webstorm --line <line> --column <column> <file>`; `zed` → `zed <file>:<line>:<column>`. Không tìm thấy lệnh: E021 `{ missing: 'editor', editor }`.

### 5.3. Dự án

| Method | Đường dẫn                | Mô tả                                                                      | Thành công                | Lỗi chính                          |
| ------ | ------------------------ | -------------------------------------------------------------------------- | ------------------------- | ---------------------------------- |
| GET    | `/project/probe?path=…`  | Xem nhanh một thư mục trước khi mở hoặc tạo; không ghi gì                  | 200 `ProjectProbe`        | E011, E012                         |
| POST   | `/project/open`          | `{ path }`: khóa, đọc hoặc tạo `workspace.json`, kiểm tra phạm vi          | 200 `ProjectInfo`         | E001, E003, E011, E012, E015, E018 |
| POST   | `/project/create`        | `{ path, name, packageManager }`: tạo khung từ template rồi mở             | 201 `ProjectInfo`         | E011, E012, E016, E018             |
| GET    | `/project`               | Dự án đang mở                                                              | 200 `ProjectInfo`         | E021                               |
| PATCH  | `/project`               | `{ name?, responsiveMode?, frames?, primaryFrameId? }`                     | 200 `ProjectInfo`         | E016, E021                         |
| POST   | `/project/close`         | Dừng dev server, xóa lịch sử, nhả khóa                                     | 204                       |                                    |
| POST   | `/project/trust`         | `{ trusted: boolean }`                                                     | 200 `SessionInfo`         | E016, E021                         |
| POST   | `/project/install`       | `{ command: string[] }` — phải đúng `installCommand` Studio đã hiện (S-54) | 202 job `project.install` | E011, E016, E018, E021             |
| POST   | `/project/backends`      | `{ path, label }`                                                          | 201 `BackendInfo`         | E011, E012, E015, E016, E021       |
| DELETE | `/project/backends/{id}` | Gỡ liên kết                                                                | 204                       | E015, E021                         |
| GET    | `/project/theme`         | Token đọc từ `@theme` của file CSS chính (chỉ đọc ở Phase 1)               | 200 `ThemeInfo`           | E021                               |

```ts
type UnsupportedReason =
  | 'noPackageJson'
  | 'noVite'
  | 'viteVersion'
  | 'noReact'
  | 'reactVersion'
  | 'noTailwind'
  | 'tailwindVersion'
  | 'noViteConfig'
  | 'noTailwindCss';

type ProjectProbe =
  | { kind: 'missing'; canCreate: boolean } // chưa tồn tại; canCreate khi thư mục cha tồn tại
  | { kind: 'empty' } // tạo khung được (R-PJ-05)
  | { kind: 'project'; support: SupportReport; hasWorkspace: boolean }
  | { kind: 'other' }; // có file nhưng không có package.json

type SupportReport = {
  supported: boolean;
  reasons: UnsupportedReason[];
  framework?: 'vite-react';
  versions: { vite?: string; react?: string; tailwindcss?: string };
  language: 'ts' | 'js';
  packageManager?: 'pnpm' | 'npm' | 'yarn';
  viteConfig?: RelPath;
  tailwindCss?: RelPath; // file CSS chứa @import "tailwindcss"
};

type ProjectInfo = {
  id: ProjectId;
  name: string;
  root: string; // tuyệt đối, để hiển thị
  sourceDir: RelPath;
  support: SupportReport;
  needsInstall: boolean;
  installCommand?: string[]; // ví dụ ['pnpm', 'install']; không có khi chưa biết package manager
  responsiveMode: ResponsiveMode;
  frames: Frame[];
  primaryFrameId: string;
  backends: BackendInfo[];
  trusted: boolean;
};

type BackendInfo = BackendLink & { status: 'ok' | 'missing' | 'blocked' }; // blocked: vi phạm S-28

type ThemeInfo = {
  file?: RelPath;
  colors: { name: string; value: string }[]; // --color-<name>
  fontSizes: { name: string; value: string }[]; // --text-<name>
  radii: { name: string; value: string }[]; // --radius-<name>
  fonts: { name: string; value: string }[]; // --font-<name>
  shadows: { name: string; value: string }[]; // --shadow-<name>
  breakpoints: { name: string; value: string }[]; // --breakpoint-<name>
};
```

### 5.4. Dev server (runner)

| Method | Đường dẫn         | Mô tả                                  | Thành công         | Lỗi chính        |
| ------ | ----------------- | -------------------------------------- | ------------------ | ---------------- |
| GET    | `/runner`         | Trạng thái                             | 200 `RunnerStatus` | E021             |
| POST   | `/runner/start`   | Khởi động (không làm gì nếu đang chạy) | 202 `RunnerStatus` | E011, E021, E025 |
| POST   | `/runner/restart` | Dừng rồi khởi động                     | 202 `RunnerStatus` | E011, E021, E025 |
| POST   | `/runner/stop`    | Dừng                                   | 200 `RunnerStatus` | E021             |

```ts
type RunnerStatus = {
  state: 'stopped' | 'starting' | 'ready' | 'error' | 'crashed';
  origin?: string; // 'http://127.0.0.1:<D>' khi starting/ready
  nonce?: string; // nonce Bridge của lần chạy này (ADR-FE-22), khi starting/ready
  error?: AppError; // E025 khi error/crashed
  startedAt?: string;
};
```

Chưa tin cậy: E011 `{ reason: 'untrusted' }`. Chưa cài dependency: E025 `{ reason: 'notInstalled' }`.

### 5.5. Mã nguồn

| Method | Đường dẫn               | Mô tả                                               | Thành công          | Lỗi chính                                      |
| ------ | ----------------------- | --------------------------------------------------- | ------------------- | ---------------------------------------------- |
| GET    | `/source/element?loc=…` | Thông tin nguồn của phần tử (để Inspector, sửa chữ) | 200 `ElementSource` | E012, E015, E016, E017, E021                   |
| POST   | `/source/edits`         | Một thao tác sửa                                    | 200 `EditResult`    | E011, E012, E015, E016, E017, E021, E023, E024 |

```ts
type StaticOr<T> =
  { kind: 'static'; value: T } | { kind: 'expression'; code: string } | { kind: 'none' };
// code: đoạn mã nguồn của biểu thức, cắt còn tối đa 200 ký tự, chỉ để hiển thị

type ElementSource = {
  loc: LocString;
  tag: string;
  fileHash: Sha256;
  readonly?: 'outsideSource' | 'tooLarge'; // R-SE-03
  className: StaticOr<string> | { kind: 'duplicate' };
  text: StaticOr<string> | { kind: 'mixed' } | { kind: 'selfClosing' };
  attributes: Partial<Record<EditableAttr, StaticOr<string>>>; // chỉ có khóa khi thẻ có thuộc tính đó
  component?: { name: string; usages: number }; // component chứa phần tử và số chỗ dùng (R-SE-14)
  inLoop: boolean; // nằm trong callback của .map (R-SE-15)
};

type SourceEdit =
  | { kind: 'setClassName'; loc: LocString; tag: string; before?: string; after: string }
  | { kind: 'setText'; loc: LocString; tag: string; before: string; after: string }
  | {
      kind: 'setAttribute';
      loc: LocString;
      tag: string;
      name: EditableAttr;
      before?: string;
      after?: string;
    };

type EditRequest = { edit: SourceEdit; coalesceKey?: string }; // coalesceKey ≤ 200 ký tự (ADR-BE-30)

type EditResult = {
  changed: boolean; // false: giá trị mới bằng giá trị cũ, không ghi, không tạo mục lịch sử
  historyId?: HistoryId;
  file: RelPath;
  fileHash: Sha256;
  element: ElementSource; // trạng thái sau khi sửa
};
```

`before` vắng mặt nghĩa là "hiện chưa có thuộc tính này". `after: ''` với `setClassName`, hoặc `after` vắng mặt với `setAttribute`: xóa thuộc tính.

### 5.6. Lịch sử

| Method | Đường dẫn       | Mô tả      | Thành công         | Lỗi chính        |
| ------ | --------------- | ---------- | ------------------ | ---------------- |
| GET    | `/history`      | Trạng thái | 200 `HistoryState` | E021             |
| POST   | `/history/undo` | Undo       | 200 `HistoryStep`  | E011, E015, E017 |
| POST   | `/history/redo` | Redo       | 200 `HistoryStep`  | E011, E015, E017 |

```ts
type HistoryLabel = { key: string; params?: Record<string, string> }; // key i18n, ví dụ 'history:setClassName'
type HistoryState = {
  undo?: HistoryLabel;
  redo?: HistoryLabel;
  undoCount: number;
  redoCount: number;
};
type HistoryStep = { state: HistoryState; files: RelPath[] };
```

Không có gì để Undo/Redo: E015 `{ resource: 'history' }`.

---

## 6. SỰ KIỆN WEBSOCKET

Kết nối, nhịp `ping` 20 s, tự nối lại và gọi `GET /session` sau khi nối lại: giữ bản 0.18 (ADR-FE-17).

```ts
type ServerEvent<T extends string, P> = {
  v: 1;
  type: T;
  at: string;
  correlationId?: string;
  payload: P;
};
```

| `type`                 | Payload                                             | Khi nào                                                             | Phase |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------- | ----- |
| `session.changed`      | `SessionInfo`                                       | Mở, đóng dự án; đổi tin cậy                                         | 1     |
| `project.changed`      | `ProjectInfo`                                       | `PATCH /project`, đổi backend, cài xong, `workspace.json` đổi ngoài | 1     |
| `project.filesChanged` | `{ files: RelPath[]; truncated?: true }`            | File trong dự án đổi **từ bên ngoài** (R-HI-05)                     | 1     |
| `runner.status`        | `RunnerStatus`                                      | Đổi trạng thái dev server                                           | 1     |
| `runner.log`           | `{ stream: 'stdout' \| 'stderr'; lines: string[] }` | Đầu ra của dev server, gộp 200 ms, tối đa 100 dòng mỗi sự kiện      | 1     |
| `history.changed`      | `HistoryState`                                      | Lịch sử đổi                                                         | 1     |
| `settings.changed`     | `Settings`                                          | Cấu hình đổi                                                        | 0     |
| `job.progress`         | `{ jobId, kind, done, total, stepKey? }`            | Job tiến triển                                                      | 1     |
| `job.completed`        | `{ jobId, kind, result }`                           | Job xong                                                            | 1     |
| `job.failed`           | `{ jobId, kind, error: AppError }`                  | Job lỗi                                                             | 1     |
| `job.cancelled`        | `{ jobId, kind }`                                   | Job bị hủy                                                          | 1     |
| `server.shuttingDown`  | `{}`                                                | Server sắp tắt                                                      | 0     |

| Mã   | Quy tắc                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| V-70 | `project.filesChanged` gộp theo cửa sổ 300 ms (ADR-BE-20), `files` tối đa 100 mục (thêm `truncated: true` nếu vượt) |
| V-71 | Payload sự kiện **KHÔNG ĐƯỢC** chứa nội dung file. `runner.log` là đầu ra của Vite, mỗi dòng cắt còn 2.000 ký tự    |

---

## 7. GIAO THỨC BRIDGE (CANVAS ↔ STUDIO)

### 7.1. Phong bì

```ts
type BridgeMessage<T extends string, P> = { rc: 1; nonce: string; type: T; payload: P };
```

| Mã    | Quy tắc                                                                                                                                                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-110 | Studio gửi bằng `iframe.contentWindow.postMessage(msg, <origin dev server>)`; Bridge gửi bằng `window.parent.postMessage(msg, <origin Studio>)`. **KHÔNG ĐƯỢC** dùng `targetOrigin: '*'`                                                       |
| V-111 | Bên nhận chỉ xử lý khi đủ cả bốn: `event.source` đúng cửa sổ đối tác; `event.origin` đúng origin đối tác; `nonce` đúng nonce của lần chạy dev server hiện tại; parse Zod thành công. Thiếu một điều kiện: bỏ qua, không trả lời, không ném lỗi |
| V-112 | Một thông điệp ≤ 1 MB khi tuần tự hóa JSON. Bridge cắt `tree` theo V-113 để không vượt                                                                                                                                                         |
| V-113 | `tree` tối đa 5.000 nút; vượt thì cắt theo thứ tự tài liệu và đặt `truncated: true`                                                                                                                                                            |
| V-114 | `nonce`: 22 ký tự ngẫu nhiên an toàn (`nanoid`), sinh mới mỗi lần khởi động dev server                                                                                                                                                         |

### 7.2. Bridge → Studio

```ts
type ElementInfo = {
  ref: ElementRef;
  found: boolean; // false: không còn phần tử này trong DOM (sau HMR)
  tag: string;
  rect?: Rect;
  instances: number; // số phần tử cùng loc trong DOM
  domClass?: string; // className thực tế lúc chạy, cắt 4.000 ký tự, chỉ để hiển thị
};

type TreeNode = {
  ref: ElementRef;
  parent?: number; // chỉ số của nút cha trong mảng nodes
  tag: string;
  label?: string; // class đầu tiên hoặc 24 ký tự chữ đầu (R-SL-11)
  instances: number;
};
```

| `type`              | Payload                                                                       | Khi nào                                                                       | Phase |
| ------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----- |
| `ready`             | `{ bridgeVersion: string; route: string }`                                    | Bridge client đã chạy xong                                                    | 1     |
| `hover`             | `{ ref?: ElementRef }`                                                        | Phần tử dưới con trỏ đổi (chế độ thiết kế)                                    | 1     |
| `select`            | `{ refs: ElementRef[] }`                                                      | Người dùng chọn trên Canvas (danh sách mới, đã áp R-SL-01..03)                | 1     |
| `selection-info`    | `{ items: ElementInfo[] }`                                                    | Sau `select`, sau lệnh `select` của Studio, sau HMR, khi cuộn, đổi kích thước | 1     |
| `tree`              | `{ nodes: TreeNode[]; truncated?: true }`                                     | Lần đầu và khi cây phần tử có `data-rc-loc` đổi (R-BR-12)                     | 1     |
| `route`             | `{ route: string }`                                                           | Đường dẫn trang đổi (`pathname + search`)                                     | 1     |
| `build-error`       | `{ message: string; file?: string; line?: number; column?: number }`          | Vite báo lỗi biên dịch (`vite:error`)                                         | 1     |
| `build-ok`          | `{}`                                                                          | Cập nhật HMR thành công sau lỗi                                               | 1     |
| `runtime-error`     | `{ message: string; stack?: string }`                                         | `error`, `unhandledrejection` trong trang                                     | 1     |
| `shortcut`          | `{ key: string; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean }` | Phím tắt của Studio bấm khi tiêu điểm ở trong iframe (R-BR-18)                | 1     |
| `text-edit-request` | `{ ref: ElementRef }`                                                         | Nhấp đúp vào phần tử (R-TX-01)                                                | 1     |
| `text-commit`       | `{ ref: ElementRef; text: string }`                                           | Kết thúc sửa chữ có thay đổi                                                  | 1     |
| `text-cancel`       | `{ ref: ElementRef }`                                                         | Hủy sửa chữ hoặc không có thay đổi                                            | 1     |
| `drop-target`       | Phase 2                                                                       |                                                                               | 2     |
| `move-intent`       | Phase 2                                                                       |                                                                               | 2     |

### 7.3. Studio → Bridge

| `type`            | Payload                                   | Tác dụng                                                                             | Phase |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ | ----- |
| `set-mode`        | `{ mode: 'design' \| 'preview' }`         | Thiết kế: chặn tương tác, vẽ overlay. Xem thử: trang chạy bình thường, không overlay | 1     |
| `select`          | `{ refs: ElementRef[]; reveal: boolean }` | Vẽ khung chọn; `reveal` cuộn phần tử chính vào vùng nhìn của iframe                  | 1     |
| `highlight`       | `{ ref?: ElementRef }`                    | Vẽ khung hover từ Layer Tree                                                         | 1     |
| `navigate`        | `{ route: string }`                       | `history.pushState` + phát `popstate` để router của dự án đổi trang                  | 1     |
| `text-edit-start` | `{ ref: ElementRef }`                     | Cho phép sửa chữ phần tử (R-TX-02)                                                   | 1     |
| `text-edit-end`   | `{ ref: ElementRef }`                     | Studio buộc kết thúc sửa chữ (ví dụ đổi khung)                                       | 1     |
| `drag-over`       | Phase 2                                   |                                                                                      | 2     |
| `drag-end`        | Phase 2                                   |                                                                                      | 2     |

---

## 8. GIỚI HẠN

| Giới hạn                             | Giá trị        | Khi vượt                     |
| ------------------------------------ | -------------- | ---------------------------- |
| Body request                         | 10 MB          | E016                         |
| File nguồn Source Editor sửa được    | 1 MB           | `readonly: 'tooLarge'`, E023 |
| Chuỗi `className` mới                | 4.000 ký tự    | E016                         |
| Chữ mới (`setText`)                  | 10.000 ký tự   | E016                         |
| Giá trị thuộc tính mới               | 2.000 ký tự    | E016                         |
| Mục lịch sử                          | 200 mục, 50 MB | Bỏ mục cũ nhất               |
| Thư mục con trong `DirectoryListing` | 1.000          | `truncated: true`            |
| Backend liên kết mỗi dự án           | 10             | E016                         |
| Nút trong `tree` của Bridge          | 5.000          | `truncated: true`            |
| Đầu ra lỗi cài dependency giữ lại    | 200 dòng cuối  | Cắt                          |
| Job cùng loại chạy đồng thời         | 1              | E018                         |

---

## 9. ENDPOINT CỦA PHASE SAU (CHỈ TÊN)

| Phase | Endpoint                                                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 2     | `POST /source/edits` thêm `insert`, `move`, `remove`, `duplicate`, `wrap`, `unwrap`, `paste`                                             |
| 2     | `GET /project/pages`, `POST /project/pages`, `PATCH /project/pages/{route}`, `DELETE /project/pages/{route}`                             |
| 2     | `GET /library`                                                                                                                           |
| 3     | `GET /agents`, `POST /agent/turns` (job `agent.turn`), `GET /agent/turns`, `GET /agent/turns/{id}/diff`, `POST /agent/turns/{id}/revert` |

Endpoint của bản 0.18 bị xóa ở WP-1.01: `POST /workspace`, `GET /workspace/document`, `POST /workspace/operations`, `POST /workspace/reload`, `GET /workspace/backups`, `POST /workspace/backups/{id}/restore`, `POST /workspace/trust` (thay bằng `POST /project/trust`).

---

## 10. DANH MỤC MÃ LỖI

Mã theo SRS v5.0 mục 13. **Đã bỏ (1.0), không dùng lại:** E004, E005, E006, E007, E008, E009, E010, E022.

| Mã   | Tên                     | HTTP | Thử lại | `params` chính                                                  | Khi nào                                                                  |
| ---- | ----------------------- | ---- | ------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| E001 | Unsupported Project     | 422  | Không   | `reasons: UnsupportedReason[]`                                  | Thư mục không thuộc phạm vi (ADR-BE-05)                                  |
| E002 | Server Init Failed      | 500  | Có      | `step`                                                          | Server khởi động lỗi                                                     |
| E003 | Workspace Load Failed   | 500  | Có      | `file`, `reason`                                                | Không đọc được `workspace.json` (V-105)                                  |
| E011 | Permission Error        | 403  | Có      | `path`, `operation` hoặc `reason: 'untrusted'`                  | Hệ điều hành từ chối; hoặc việc cần tin cậy khi dự án chưa tin cậy       |
| E012 | Path Security Violation | 403  | Không   | `path`                                                          | Đường dẫn ra ngoài phạm vi (S-20 đến S-28)                               |
| E013 | Internal Error          | 500  | Có      |                                                                 | Lỗi không lường trước                                                    |
| E014 | Unauthorized            | 401  | Không   |                                                                 | Thiếu hoặc sai token, Origin không hợp lệ                                |
| E015 | Not Found               | 404  | Không   | `resource`, `id`                                                | Tài nguyên, file, mục lịch sử không có                                   |
| E016 | Invalid Request         | 400  | Không   |                                                                 | Không khớp schema, vượt giới hạn; `details` chỉ rõ trường                |
| E017 | Source Changed          | 409  | Có      | `file`, `reason: 'moved' \| 'valueChanged' \| 'fileChanged'`    | Mã nguồn khác lúc Studio đọc (R-SE-02), hoặc file bị sửa ngoài (R-HI-04) |
| E018 | Busy                    | 409  | Có      | `resource`                                                      | Dự án mở ở phiên khác; job cùng loại đang chạy                           |
| E019 | Cancelled               | 499  | Có      | `jobId`                                                         | Job bị hủy                                                               |
| E020 | Timeout                 | 504  | Có      | `operation`, `timeoutMs`                                        | Quá thời gian (cài dependency 10 phút)                                   |
| E021 | Not Configured          | 409  | Không   | `missing: 'project' \| 'editor' \| 'packageManager' \| 'agent'` | Chưa mở dự án, không tìm thấy editor, package manager                    |
| E023 | Source Not Editable     | 422  | Không   | `reason`                                                        | Phần tử không sửa trực quan được (R-SE-03)                               |
| E024 | Edit Breaks Source      | 422  | Không   | `file`; `details` có dòng, cột                                  | Sau khi sửa không phân tích được; không ghi (R-SE-11)                    |
| E025 | Dev Server Error        | 502  | Có      | `reason`, `message?`, `file?`, `line?`                          | Dev server không khởi động được hoặc dừng đột ngột (R-RN-06)             |
| E026 | Agent Not Available     | 409  | Không   | `agent`, `reason: 'notInstalled' \| 'notLoggedIn'`              | Phase 3                                                                  |
| E027 | Agent Run Failed        | 502  | Có      | `agent`, `exitCode?`                                            | Phase 3                                                                  |
| E028 | Install Failed          | 502  | Có      | `packageManager`, `exitCode`                                    | Lệnh cài dependency trả mã khác 0; `details` chứa đầu ra cuối            |

`reason` của E023: `classExpression`, `textExpression`, `textMixed`, `selfClosing`, `attrExpression`, `duplicateAttr`, `outsideSource`, `tooLarge`, `notJsxFile`.  
`reason` của E025: `notInstalled`, `viteNotFound`, `config`, `portInUse`, `timeout`, `crashed`.

| Mã   | Quy tắc                                                                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| V-80 | Mỗi mã lỗi **BẮT BUỘC** có khóa `errors:<mã>.title`, `errors:<mã>.message` ở `vi` và `en`; mỗi `reason` có khóa `errors:<mã>.reasons.<reason>` |
| V-81 | Mã lỗi đã công bố **KHÔNG** đổi ý nghĩa; lỗi mới dùng mã mới                                                                                   |

---

## 11. TRUY VẾT SPEC-03

| Yêu cầu SRS            | Mục                    |
| ---------------------- | ---------------------- |
| FR-01 đến FR-05        | 3, 5.3                 |
| FR-06, FR-17           | 5.4, 6, 7.2            |
| FR-10 đến FR-16        | 2, 7                   |
| FR-20 đến FR-25, FR-29 | 5.5, 5.6               |
| FR-30, L-01, L-02      | 5.5 (`StaticOr`), E023 |
| SRS mục 13             | 10                     |

---

# SPEC-04 — ĐẶC TẢ MODULE (PHASE 1)

**Phiên bản phần:** 1.0 (Phase 1). Module của Phase 2–4 viết ở đợt 3.  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v5.0 FR-01 đến FR-30 (phần Phase 1), L-01 đến L-06; SPEC-03

---

## 0. QUY ƯỚC

1. Mỗi module có: mục đích, nơi đặt code, quy tắc `R-<module>-nn`, và **bộ kiểm thử bắt buộc** (bảng cuối mỗi module). Bộ kiểm thử là danh sách tình huống tối thiểu mà WP-1.02 phải viết thành test (CW-50); được thêm tình huống, không được bớt.
2. Mã module trùng tên với bản 0.18 (`M-IN`) đánh số quy tắc từ `10` để không trùng nghĩa với `R-IN-01` đến `R-IN-07` cũ.
3. "Studio" là code trong `packages/studio`; "server" là `packages/server`; "Bridge" là `packages/bridge`; "shared" là `packages/shared`.

| Mã   | Module                     | Nơi đặt chính                                                                                  | WP      |
| ---- | -------------------------- | ---------------------------------------------------------------------------------------------- | ------- |
| M-FW | Bộ chuyển đổi framework    | `server/src/core/project/frameworks/`, `bridge/src/integrations/`                              | WP-1.03 |
| M-PJ | Dự án                      | `server/src/core/project/`, `studio/src/features/project/`                                     | WP-1.03 |
| M-RN | Dev server và Canvas       | `server/src/core/runner/`, `server/src/runners/`, `studio/src/features/canvas/`                | WP-1.04 |
| M-BR | Bridge                     | `bridge/src/transform/`, `bridge/src/client/`, `bridge/src/integrations/vite.ts`               | WP-1.05 |
| M-SL | Chọn phần tử và Layer Tree | `bridge/src/client/select.ts`, `studio/src/features/selection/`, `studio/src/features/layers/` | WP-1.05 |
| M-SE | Source Editor              | `server/src/core/source-editor/`                                                               | WP-1.06 |
| M-HI | Lịch sử Undo/Redo          | `server/src/core/history/`, `studio/src/features/history/`                                     | WP-1.06 |
| M-TW | Mô hình class Tailwind     | `shared/src/tailwind/`                                                                         | WP-1.07 |
| M-IN | Inspector                  | `studio/src/features/inspector/`                                                               | WP-1.07 |
| M-TX | Sửa chữ trên Canvas        | `bridge/src/client/text-edit.ts`, `studio/src/features/text-edit/`                             | WP-1.08 |

---

## 1. M-FW — BỘ CHUYỂN ĐỔI FRAMEWORK

**Mục đích:** gom mọi chỗ phụ thuộc framework vào một chỗ, để thêm Next.js (hoặc framework khác) sau này bằng **một module mới**, không sửa Source Editor, lịch sử, mô hình Tailwind, Inspector, Bridge client.

```ts
type FrameworkId = 'vite-react'; // sau này: 'next-app', 'next-pages'…

interface FrameworkAdapter {
  readonly id: FrameworkId;
  /** Dependency chính để chọn adapter báo lý do E001 (ví dụ 'vite'). */
  readonly primaryDependency: string;
  /** Chỉ đọc qua FileSystemPort; không chạy lệnh, không ghi. */
  detect(input: DetectInput): Promise<SupportReport>;
  /** Phần mở rộng file mà Bridge gắn vị trí và Source Editor sửa. */
  readonly sourceExtensions: readonly string[]; // ['.jsx', '.tsx']
  /** Script chạy trong tiến trình con (ADR-BE-28) và tùy chọn gửi cho nó. */
  readonly runner: { readonly entry: string; options(ctx: RunnerContext): RunnerOptions };
  /** Template tạo khung (ADR-BE-32). */
  readonly template: string; // 'vite-react-ts-tailwind4'
  /** Quy ước định tuyến (Phase 2, M-PG). */
  readonly routes?: RoutesConvention;
}

type DetectInput = { root: string; packageJson: unknown; fs: FileSystemPort };
type RunnerContext = {
  root: string;
  sourceDir: RelPath;
  port: number;
  nonce: string;
  studioOrigin: string;
};
type RunnerOptions = RunnerContext & { host: '127.0.0.1' };
```

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-FW-01 | Danh sách adapter cố định trong `frameworks/index.ts` (bản 1.0 chỉ có `vite-react`). Phát hiện: chạy `detect` của từng adapter theo thứ tự; adapter đầu tiên `supported` được chọn                                                                                                                             |
| R-FW-02 | Không adapter nào `supported`: E001 với `reasons` của adapter có `primaryDependency` nằm trong dependency của dự án; không có adapter nào như vậy thì dùng adapter đầu tiên                                                                                                                                    |
| R-FW-03 | Code phụ thuộc framework chỉ nằm ở `server/src/core/project/frameworks/<id>/`, `server/src/runners/<id>.ts`, `bridge/src/integrations/<id>.ts`. Module khác **KHÔNG ĐƯỢC** rẽ nhánh theo `FrameworkId`; ESLint `no-restricted-imports` chặn `source-editor`, `history`, `shared/tailwind` import `frameworks/` |
| R-FW-04 | Bridge chia ba phần: `transform/` (gắn `data-rc-loc`, nhận mã nguồn và đường dẫn, trả mã mới và source map, không biết bundler), `client/` (chạy trong trang, không biết framework), `integrations/vite.ts` (plugin Vite). Framework sau thêm `integrations/<tên>.ts`                                          |
| R-FW-05 | `workspace.json` lưu `framework`. Mở dự án mà kết quả phát hiện khác giá trị đã lưu: dùng kết quả phát hiện, ghi lại `framework`                                                                                                                                                                               |

**Kiểm thử bắt buộc**

| #   | Tình huống                                                       | Kỳ vọng                                | Loại |
| --- | ---------------------------------------------------------------- | -------------------------------------- | ---- |
| 1   | Dự án Vite 8 + React 19 + Tailwind 4                             | Chọn `vite-react`                      | Unit |
| 2   | Dự án có `next` nhưng không có `vite`                            | E001, `reasons` chứa `noVite`          | Unit |
| 3   | Adapter giả thứ hai đăng ký trước, `supported`                   | Adapter giả được chọn (thứ tự R-FW-01) | Unit |
| 4   | Lint: file trong `source-editor/` import `frameworks/vite-react` | ESLint báo lỗi                         | Lint |

---

## 2. M-PJ — DỰ ÁN

**Mục đích:** chọn thư mục, kiểm tra phạm vi, tạo khung, cài dependency, mở và đóng dự án, liên kết backend, tin cậy. SRS FR-01 đến FR-05, AC-01, AC-02.

### 2.1. Server

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-PJ-01 | `probe(path)`: đường dẫn qua S-20 đến S-23 (sai: E012). Không tồn tại: `missing`, `canCreate` khi thư mục cha tồn tại. Là thư mục "trống" (R-PJ-02): `empty`. Có `package.json`: `project` (chạy M-FW). Còn lại: `other`. Không ghi gì                                                                                                                                                                                                                                                                                                                                       |
| R-PJ-02 | Thư mục "trống" là thư mục chỉ chứa các mục: `.git`, `.gitignore`, `.gitattributes`, `README.md`, `LICENSE`, `.DS_Store`, `Thumbs.db`, `.vscode`, `.idea`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R-PJ-03 | Phát hiện `vite-react`: `package.json` ≤ 1 MB. Dependency = `dependencies` ∪ `devDependencies`. Phiên bản lấy từ `node_modules/<gói>/package.json` nếu có; không có thì lấy số major đầu tiên của chuỗi phiên bản (bỏ `^ ~ >= = v`); không xác định được thì coi là sai phiên bản. Đạt khi: `vite` 7/8, `react` 18/19, `tailwindcss` 4, có `vite.config.{ts,mts,cts,js,mjs,cjs}`, có file CSS chứa `@import "tailwindcss"` (hoặc nháy đơn) trong `sourceDir`                                                                                                                 |
| R-PJ-04 | File CSS chính tìm theo thứ tự `src/index.css`, `src/main.css`, `src/App.css`, `src/styles.css`, rồi các `.css` khác trong `sourceDir` theo thứ tự tên (tối đa 200 file, mỗi file ≤ 1 MB, không theo symlink). File đầu tiên khớp là `tailwindCss`                                                                                                                                                                                                                                                                                                                           |
| R-PJ-05 | `language` = `ts` nếu có `tsconfig.json`, ngược lại `js`. `packageManager` theo thứ tự: trường `packageManager` của `package.json`; file khóa `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`; package manager đã chọn khi tạo khung trong phiên này; `Settings.packageManager`; không có thì để trống                                                                                                                                                                                                                                                                    |
| R-PJ-06 | `needsInstall` = thiếu `node_modules/vite/package.json` hoặc `node_modules/react/package.json` ở gốc dự án. `node_modules` là junction/symlink vẫn đọc được (chỉ đọc)                                                                                                                                                                                                                                                                                                                                                                                                        |
| R-PJ-07 | `open(path)`: probe phải là `project` và `supported`, ngược lại E001 (`other`, `empty`, `missing` → `reasons: ['noPackageJson']`). Đang mở dự án khác thì đóng trước (R-PJ-12). Lấy khóa (E018). Đọc `workspace.json` (V-105) hoặc tạo (R-PJ-08). Phát `session.changed`. Đã tin cậy và không `needsInstall`: khởi động dev server (R-RN-01)                                                                                                                                                                                                                                 |
| R-PJ-08 | Tạo `workspace.json`: `id` mới, `name` = tên thư mục (cắt 64 ký tự; rỗng thì `project`), `framework` theo M-FW, `sourceDir: 'src'`, `backends: []`, `responsiveMode` theo R-PJ-09, khung mặc định (SPEC-03 mục 3). Tạo `.reactcraft/.gitignore`. Ghi nguyên tử                                                                                                                                                                                                                                                                                                               |
| R-PJ-09 | Dò `responsiveMode`: đếm trong các file `.jsx`/`.tsx` của `sourceDir` (tối đa 500 file) số lần khớp `\bmax-(sm\|md\|lg\|xl\|2xl):` và `(^\|[\s"'\x60])(sm\|md\|lg\|xl\|2xl):`. Nhiều `max-` hơn: `desktop-first`; nhiều loại kia hơn: `mobile-first`; bằng nhau: `desktop-first`                                                                                                                                                                                                                                                                                             |
| R-PJ-10 | `create(path, name, packageManager)`: probe phải là `missing` có `canCreate`, hoặc `empty`; ngược lại E016 `{ reason: 'notEmpty' }`. Chép template của adapter; thay `{{packageName}}` trong `package.json` bằng tên gói (R-PJ-11), `{{title}}` trong `index.html` bằng `name` đã escape HTML. File đã có (R-PJ-02) không bị ghi đè. Ghi lỗi giữa chừng: xóa các file vừa tạo, trả E011. Thành công: `open` (R-PJ-07), trả 201                                                                                                                                               |
| R-PJ-11 | Tên gói từ `name`: chữ thường, bỏ dấu tiếng Việt (`đ` → `d`, NFD rồi bỏ dấu), ký tự ngoài `[a-z0-9-]` thành `-`, gộp `-` liền nhau, bỏ `-` ở hai đầu, tối đa 214 ký tự, rỗng thì `app`                                                                                                                                                                                                                                                                                                                                                                                       |
| R-PJ-12 | `close`: dừng dev server (R-RN-07), hủy job cài đặt, xóa lịch sử (R-HI-08), nhả khóa, phát `session.changed`. Tắt server cũng làm như vậy                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R-PJ-13 | `install(command)`: cần dự án mở (E021), đã tin cậy (E011 `untrusted`), biết package manager (E021 `packageManager`), `command` đúng bằng `installCommand` (E016 `commandMismatch`). Lệnh: `['pnpm','install']`, `['npm','install']`, `['yarn','install']`; spawn qua ProcessPort, `cwd` là gốc dự án, môi trường theo S-53. Tối đa 10 phút (E020). Hủy: dừng cả cây tiến trình (E019). Mã thoát khác 0: E028, `details` là 200 dòng cuối. Không tìm thấy lệnh: E021 `packageManager`. Xong: tính lại `needsInstall`, phát `project.changed`, khởi động dev server (R-RN-01) |
| R-PJ-14 | Backend: đường dẫn qua S-20 đến S-23 và S-28 (E012); phải là thư mục tồn tại (E015); không trùng gốc dự án, không trùng backend đã có (E016); tối đa 10 (E016). `label` mặc định là tên thư mục. Lưu theo V-03, V-04. Người dùng tự thêm hoặc gỡ khi dự án đang tin cậy: cập nhật dấu vân tay tin cậy theo liên kết mới (không hỏi lại)                                                                                                                                                                                                                                      |
| R-PJ-15 | Tin cậy: khóa gồm `id`, đường dẫn gốc dự án, dấu vân tay = JSON của danh sách đường dẫn backend đã sắp xếp (S-82, S-84). Chưa tin cậy: không khởi động dev server, không cài, không chạy agent (E011 `untrusted`); vẫn duyệt thư mục, xem thông tin dự án được. Chuyển sang chưa tin cậy khi đang chạy: dừng dev server                                                                                                                                                                                                                                                      |
| R-PJ-16 | `workspace.json` bị sửa từ bên ngoài: đọc lại; hợp lệ thì phát `project.changed` (và áp R-PJ-15 nếu liên kết đổi); không hợp lệ thì giữ bản trong bộ nhớ, ghi log `warn`, không ghi đè file                                                                                                                                                                                                                                                                                                                                                                                  |
| R-PJ-17 | `GET /project/theme`: đọc các khối `@theme` (kể cả `@theme inline`) của `tailwindCss`, lấy biến `--color-*`, `--text-*` (bỏ `--text-*--line-height`), `--radius-*`, `--font-*`, `--shadow-*`, `--breakpoint-*`. Dùng lại bộ đọc `theme-css` của bản 0.18. File đổi thì lần gọi sau đọc lại                                                                                                                                                                                                                                                                                   |
| R-PJ-18 | CLI `reactcraft [dir]`: `dir` là dự án hợp lệ thì tự mở; ngược lại `SessionInfo.project = { state: 'none', suggestedPath: dir }`                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### 2.2. Studio

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-PJ-20 | Nút **Project** trên thanh công cụ mở hộp thoại: ô nhập đường dẫn, danh sách thư mục con (`/fs/directories`), đường dẫn dạng breadcrumb, danh sách ổ đĩa trên Windows, nhãn "Dự án" cho thư mục có `package.json`. Chưa mở dự án nào (`state: 'none'`): hộp thoại tự mở ở `suggestedPath` hoặc thư mục home |
| R-PJ-21 | Chọn thư mục thì gọi `probe` và hiện: `project` hợp lệ → nút **Mở**; không hợp lệ → danh sách lý do (khóa i18n theo từng `reason`); `empty` hoặc `missing` có `canCreate` → biểu mẫu **Tạo dự án** (tên, package manager pnpm/npm/yarn); `other` → thông báo "thư mục không phải dự án và không trống"      |
| R-PJ-22 | Sau khi mở, chưa tin cậy: hộp thoại tin cậy (giữ từ bản 0.18) liệt kê gốc dự án và backend. Tin cậy rồi mà `needsInstall`: hộp thoại cài đặt hiện **đúng** `installCommand` (font mono), nút **Cài**, khi chạy hiện 20 dòng log cuối và nút Hủy; lỗi hiện E028 kèm đầu ra                                   |
| R-PJ-23 | Hộp thoại Project có phần **Backend**: danh sách (nhãn, đường dẫn, trạng thái `ok`/`missing`/`blocked`), thêm bằng cùng bộ chọn thư mục, gỡ có xác nhận                                                                                                                                                     |
| R-PJ-24 | Tên dự án và trạng thái dev server hiện trên thanh công cụ                                                                                                                                                                                                                                                  |

**Kiểm thử bắt buộc**

| #   | Tình huống                                                                                                                                                  | Kỳ vọng                                                                                                                             | Loại                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1   | Probe: không tồn tại (cha có/không có), trống (chỉ `.git` + `README.md`), có `package.json`, có file khác                                                   | `missing` (`canCreate` đúng), `empty`, `project`, `other`                                                                           | Unit                       |
| 2   | Phát hiện: Vite 6, Vite 9, React 17, Tailwind 3, thiếu `tailwindcss`, thiếu `vite.config.*`, thiếu CSS `@import "tailwindcss"`, `"vite": "latest"` chưa cài | Đúng từng `reason` (`viteVersion`, `reactVersion`, `tailwindVersion`, `noTailwind`, `noViteConfig`, `noTailwindCss`, `viteVersion`) | Unit                       |
| 3   | Phiên bản: range `^7.1.0` nhưng đã cài 8.0.2                                                                                                                | Dùng 8.0.2 (bản đã cài)                                                                                                             | Unit                       |
| 4   | Package manager: trường `packageManager`, từng loại file khóa, không có gì                                                                                  | Đúng thứ tự R-PJ-05                                                                                                                 | Unit                       |
| 5   | Dò `responsiveMode`: chỉ `md:`, chỉ `max-md:`, không có, bằng nhau                                                                                          | `mobile-first`, `desktop-first`, `desktop-first`, `desktop-first`                                                                   | Unit                       |
| 6   | Tạo khung vào thư mục chưa tồn tại; vào thư mục có `.git` và `README.md`                                                                                    | Đủ file template; `README.md` cũ giữ nguyên byte                                                                                    | Unit                       |
| 7   | Tạo khung vào thư mục có `src/`                                                                                                                             | E016 `notEmpty`, không file nào được tạo                                                                                            | Unit                       |
| 8   | Ghi lỗi ở file thứ 3 khi tạo khung                                                                                                                          | E011; không còn file nào vừa tạo                                                                                                    | Unit                       |
| 9   | Tên "Cửa hàng Đồ Gỗ!"                                                                                                                                       | Tên gói `cua-hang-do-go`                                                                                                            | Unit                       |
| 10  | Mở dự án chưa có `.reactcraft/`                                                                                                                             | Tạo `workspace.json`, `.gitignore`; mở lần hai dùng lại `id`                                                                        | Contract                   |
| 11  | `workspace.json` hỏng; `schemaVersion: 1`                                                                                                                   | E003 `invalid`; E003 `unsupportedVersion`; file không bị ghi                                                                        | Contract                   |
| 12  | Mở khi phiên khác giữ khóa                                                                                                                                  | E018                                                                                                                                | Contract                   |
| 13  | Cài khi chưa tin cậy; `command` khác `installCommand`; lệnh không tồn tại; mã thoát 1; quá 10 phút (đồng hồ giả); hủy                                       | E011 `untrusted`; E016 `commandMismatch`; E021; E028 có đầu ra; E020; E019                                                          | Contract (ProcessPort giả) |
| 14  | Backend: gốc ổ đĩa, thư mục home, không tồn tại, trùng, quá 10, nằm ngoài thư mục cha của dự án                                                             | E012, E012, E015, E016, E016, lưu tuyệt đối (V-04)                                                                                  | Contract                   |
| 15  | Sửa `workspace.json` từ ngoài thêm backend khi đang tin cậy và dev server chạy                                                                              | Chuyển chưa tin cậy, dev server dừng, `session.changed`                                                                             | Contract                   |
| 16  | Người dùng thêm backend qua API khi đang tin cậy                                                                                                            | Vẫn tin cậy                                                                                                                         | Contract                   |
| 17  | Đọc `@theme` có `--color-brand`, `--text-hero`, `--text-hero--line-height`                                                                                  | `colors` có `brand`; `fontSizes` có `hero`, không có `hero--line-height`                                                            | Unit                       |
| 18  | E2E: thư mục trống → Project → Tạo → tin cậy → Cài → Canvas hiện Home (AC-01, cần mạng, nhãn `@network`)                                                    | Đạt trên 3 trình duyệt                                                                                                              | E2E                        |
| 19  | E2E: Project → chọn dự án mẫu → Mở (AC-02 phần mở); chọn thư mục không hợp lệ → thấy lý do bằng `vi` và `en`                                                | Đạt                                                                                                                                 | E2E                        |

---

## 3. M-RN — DEV SERVER VÀ CANVAS

**Mục đích:** chạy dev server của dự án (ADR-BE-28) và hiển thị nó trong Canvas. SRS FR-06, FR-10, FR-17.

### 3.1. Server và runner

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-RN-01 | Tự khởi động khi: dự án mở, `supported`, đã tin cậy, không `needsInstall`. Xảy ra sau `open`, sau tin cậy, sau cài xong. `POST /runner/start` khi đang `starting`/`ready` không làm gì                                                                                                                                                                                                                           |
| R-RN-02 | Spawn `process.execPath` với `adapter.runner.entry`, `cwd` là gốc dự án, kênh IPC, môi trường theo S-53 thêm `NODE_ENV=development`. Sau khi spawn, gửi IPC `{ type: 'start', options: RunnerOptions }`. Nonce mới mỗi lần khởi động (V-114)                                                                                                                                                                     |
| R-RN-03 | Runner `vite-react`: tìm `vite` bằng `createRequire(<gốc>/package.json).resolve('vite')` (không thấy: IPC `error { reason: 'viteNotFound' }`); `import()` bản ESM; `createServer({ root, server: { host, port, strictPort: true, open: false }, clearScreen: false, customLogger, plugins: [reactcraftBridge(options)] })` để Vite tự nạp và gộp `vite.config.*` của dự án; `listen()`; báo IPC `ready { port }` |
| R-RN-04 | Cổng: lần đầu chọn cổng trống ngẫu nhiên trong 49152–65535 trên `127.0.0.1`; các lần khởi động lại trong phiên dùng lại cổng đó; cổng bị chiếm thì chọn cổng mới **một** lần; vẫn lỗi thì E025 `portInUse`                                                                                                                                                                                                       |
| R-RN-05 | Quá 60 s từ lúc spawn chưa `ready`: dừng cả cây tiến trình, trạng thái `error`, E025 `timeout`                                                                                                                                                                                                                                                                                                                   |
| R-RN-06 | Lỗi nạp cấu hình hoặc plugin: runner báo IPC `error { reason: 'config', message, file?, line? }` → `error`, E025 `config`. Tiến trình con thoát khi đang `starting`/`ready` mà không do lệnh dừng → `crashed`, E025 `crashed`, `details` là 50 dòng log cuối. **Không** tự khởi động lại                                                                                                                         |
| R-RN-07 | Dừng: IPC `stop` → runner gọi `server.close()` rồi thoát; sau 5 s chưa thoát thì dừng cả cây tiến trình (Windows: `taskkill /T /F` qua ProcessPort). Trạng thái `stopped`                                                                                                                                                                                                                                        |
| R-RN-08 | Đầu ra (`stdout`, `stderr`, logger của Vite) chuyển thành `runner.log` (V-71). Server giữ 500 dòng cuối trong bộ nhớ cho `details` của E025                                                                                                                                                                                                                                                                      |
| R-RN-09 | Mọi thay đổi trạng thái phát `runner.status`. Chuyển trạng thái hợp lệ: `stopped → starting → ready \| error`; `ready → crashed \| stopped`; `error \| crashed → starting \| stopped`                                                                                                                                                                                                                            |

### 3.2. Canvas trong Studio

| Mã      | Quy tắc                                                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-RN-20 | Theo trạng thái: chưa tin cậy → lời nhắc và nút tin cậy; `needsInstall` → lời nhắc cài; `stopped` → nút Chạy; `starting` → đang tải; `ready` → iframe; `error`/`crashed` → bảng lỗi (thông điệp, `file:dòng` bấm được để mở editor, 20 dòng log cuối, nút Khởi động lại)   |
| R-RN-21 | iframe có `src` = `origin` + đường dẫn trang hiện tại; rộng = `frame.width`, cao = `frame.height` (trang cuộn **bên trong** iframe như trên thiết bị thật); thu phóng bằng `transform: scale()` trên khung bao, 10 %–400 %, mặc định "Vừa khung" theo bề ngang vùng Canvas |
| R-RN-22 | Đổi khung chỉ đổi kích thước iframe, **không** tải lại. Khởi động lại dev server (origin hoặc nonce mới) thì đặt lại `src`                                                                                                                                                 |
| R-RN-23 | Nút Thiết kế / Xem thử gửi `set-mode`. Mặc định Thiết kế                                                                                                                                                                                                                   |
| R-RN-24 | iframe đã tải mà 10 s không nhận `ready` của Bridge: dải cảnh báo "Không kết nối được Bridge" kèm nút xem log                                                                                                                                                              |
| R-RN-25 | `build-error`: dải lỗi phía trên Canvas có thông điệp và `file:dòng` mở được trong editor; `build-ok` ẩn dải lỗi. `runtime-error`: danh sách lỗi (gộp trùng thông điệp, hiện tối đa 5), không chặn thao tác. Studio không bao giờ bị treo vì lỗi của dự án (FR-17)         |
| R-RN-26 | Thanh công cụ Canvas: chọn khung (theo `ProjectInfo.frames`), mức thu phóng, đường dẫn trang hiện tại (từ `route`)                                                                                                                                                         |

**Kiểm thử bắt buộc**

| #   | Tình huống                                                                                                               | Kỳ vọng                                                                                                       | Loại        |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Máy trạng thái với tiến trình giả: ready, lỗi cấu hình, thoát đột ngột, quá 60 s, dừng không thoát sau 5 s               | Đúng chuỗi `runner.status`; E025 đúng `reason`; dừng cả cây sau 5 s                                           | Unit        |
| 2   | Khởi động khi chưa tin cậy; khi `needsInstall`; khi chưa mở dự án                                                        | E011 `untrusted`; E025 `notInstalled`; E021                                                                   | Contract    |
| 3   | `start` hai lần liên tiếp                                                                                                | Một tiến trình con                                                                                            | Unit        |
| 4   | Cổng cũ bị chiếm khi khởi động lại                                                                                       | Cổng mới, `origin` mới trong `runner.status`                                                                  | Unit        |
| 5   | Runner thật trên dự án mẫu Vite 8 + React 19 + TS và Vite 7 + React 18 + JS                                              | `ready` ≤ 15 s (PB-04); trang trả 200; `vite.config` của dự án có hiệu lực (plugin đánh dấu của fixture chạy) | Integration |
| 6   | Fixture có `vite.config.ts` lỗi cú pháp                                                                                  | `error`, E025 `config`, có `file`                                                                             | Integration |
| 7   | Tắt server khi dev server đang chạy                                                                                      | Không còn tiến trình con (kiểm bằng pid)                                                                      | Integration |
| 8   | Môi trường tiến trình con                                                                                                | Không có biến `REACTCRAFT_*`, không có token phiên (S-53)                                                     | Unit        |
| 9   | E2E: mở dự án mẫu → Canvas hiện trang; đổi khung Mobile → iframe rộng 375 không tải lại (giữ trạng thái đếm trong trang) | Đạt 3 trình duyệt                                                                                             | E2E         |
| 10  | E2E: sửa file sinh lỗi cú pháp từ ngoài → dải lỗi có `file:dòng`; sửa lại → dải lỗi biến mất                             | Đạt                                                                                                           | E2E         |
| 11  | E2E: chế độ Xem thử → bấm link trong trang điều hướng thật; chế độ Thiết kế → bấm link không điều hướng                  | Đạt                                                                                                           | E2E         |

---

## 4. M-BR — BRIDGE

**Mục đích:** gắn vị trí nguồn vào DOM, vẽ overlay, chuyển tương tác trong Canvas thành thông điệp cho Studio (ADR-FE-07, ADR-FE-22, SPEC-03 mục 7).

### 4.1. Biến đổi mã (plugin)

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-BR-01 | Chỉ biến đổi module có id là file thật, phần mở rộng thuộc `adapter.sourceExtensions`, nằm trong `sourceDir`, không trong `node_modules`, không có `?` truy vấn, không bắt đầu bằng `\0`                                                                                                            |
| R-BR-02 | Gắn `data-rc-loc="<file>:<dòng>:<cột>"` (SPEC-03 V-100 đến V-102) vào mọi thẻ mở JSX có tên là `JSXIdentifier` bắt đầu bằng chữ thường (phần tử HTML, SVG). Bỏ qua: Fragment, tên có `.` hoặc `:`, thẻ viết hoa, thẻ đã có `data-rc-loc`. Chèn ngay sau tên thẻ (`<div` → `<div data-rc-loc="…"`)   |
| R-BR-03 | Dùng `@babel/parser` (ADR-BE-29) và `magic-string`; trả source map `hires` để lỗi và DevTools vẫn đúng dòng. Phân tích lỗi: trả `undefined` (để Vite và plugin React báo lỗi như bình thường)                                                                                                       |
| R-BR-04 | Plugin `enforce: 'pre'`, `apply: 'serve'`; chỉ được thêm bởi runner của ReactCraft; **không** có tác dụng với `vite build`                                                                                                                                                                          |
| R-BR-05 | Plugin phục vụ client tại `/@reactcraft/bridge-client.js` (file đã build sẵn) và chèn vào `index.html` qua `transformIndexHtml`: một thẻ `<script type="application/json" id="__rc_bridge">` chứa `{ nonce, studioOrigin }` và một thẻ `<script type="module" src="/@reactcraft/bridge-client.js">` |

### 4.2. Client

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-BR-10 | Nhận thông điệp theo V-110, V-111. Không ở trong iframe (`window.parent === window`): không làm gì                                                                                                                                                                                                                                                        |
| R-BR-11 | Overlay: một phần tử gắn vào `document.documentElement`, **shadow root đóng**, `position: fixed; inset: 0; pointer-events: none; z-index: 2147483647`. Bị gỡ khỏi DOM (ứng dụng thay nội dung) thì gắn lại (MutationObserver)                                                                                                                             |
| R-BR-12 | Gửi `tree` lần đầu sau `ready`, rồi khi cây phần tử có `data-rc-loc` đổi: MutationObserver (`childList`, `subtree`, thuộc tính `data-rc-loc`) gộp 100 ms, và sau `vite:afterUpdate`. Chỉ gửi khi khác lần trước. Mỗi `loc` có nhiều phần tử: chỉ đưa cây con của phần tử đầu tiên, `instances` là số phần tử (V-113)                                      |
| R-BR-13 | Chế độ Thiết kế: bắt ở pha capture trên `window` các sự kiện `pointerdown`, `pointerup`, `click`, `dblclick`, `auxclick`, `contextmenu`, `submit`, `dragstart`; `preventDefault` và `stopPropagation` để trang không phản ứng (link không điều hướng, form không gửi). Ngoại lệ: phần tử đang sửa chữ (R-TX-03). Chế độ Xem thử: không bắt gì, ẩn overlay |
| R-BR-14 | Phần tử đích: `document.elementsFromPoint`, bỏ phần tử overlay, lấy `closest('[data-rc-loc]')` của phần tử trên cùng. Không có: không có đích                                                                                                                                                                                                             |
| R-BR-15 | Khung hover và khung chọn cập nhật trong `requestAnimationFrame` khi rê, cuộn, đổi kích thước, DOM đổi; mỗi khung hình ≤ 16 ms với trang 2.000 phần tử (PB-01). Khung chọn có nhãn tên thẻ; phần tử có `instances > 1` vẽ khung mờ cho các bản lặp khác                                                                                                   |
| R-BR-16 | Sau HMR hoặc DOM đổi: tìm lại phần tử theo `ref`; gửi `selection-info` với `found: false` cho ref không còn                                                                                                                                                                                                                                               |
| R-BR-17 | Lỗi: `error`, `unhandledrejection` → `runtime-error` (thông điệp ≤ 2.000, stack ≤ 8.000 ký tự). `import.meta.hot.on('vite:error')` → `build-error`; `vite:afterUpdate` sau một `build-error` → `build-ok`. Đường dẫn `file` trong `build-error` đổi thành tương đối với gốc dự án                                                                         |
| R-BR-18 | Phím: ở chế độ Thiết kế, `keydown` có Ctrl/Cmd+Z, Ctrl+Y, Cmd+Shift+Z, Esc (và phím của Phase 2) được `preventDefault` và gửi `shortcut`. Không áp dụng khi đang sửa chữ hoặc tiêu điểm ở ô nhập của trang ở chế độ Xem thử                                                                                                                               |
| R-BR-19 | Đường dẫn trang: bọc `history.pushState`, `history.replaceState`, nghe `popstate` → `route`. `navigate` gọi `pushState` rồi phát `PopStateEvent`                                                                                                                                                                                                          |
| R-BR-20 | `select` có `reveal: true`: `scrollIntoView({ block: 'nearest', inline: 'nearest' })` phần tử chính                                                                                                                                                                                                                                                       |

### 4.3. Phía Studio

| Mã      | Quy tắc                                                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-BR-30 | `bridge-channel.ts` là nơi duy nhất trong Studio gọi `postMessage` và nghe `message`; kiểm tra V-111 với `origin`, `nonce` của `RunnerStatus` hiện tại; nonce đổi thì bỏ mọi thông điệp của nonce cũ |
| R-BR-31 | Thông điệp đã qua kiểm tra được đưa vào store (ADR-FE-10) theo từng loại; component không nghe `message` trực tiếp                                                                                   |

**Kiểm thử bắt buộc**

| #   | Tình huống                                                                                                                                                                                                | Kỳ vọng                                                                   | Loại           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------- |
| 1   | Biến đổi: thẻ thường, tự đóng, lồng nhau, SVG, Fragment, `<Card>`, `<motion.div>`, `<svg:rect>`, đã có `data-rc-loc`, JSX trong `.map`, file CRLF, file có BOM, ký tự tiếng Việt trước thẻ trên cùng dòng | Đúng thẻ được gắn; `dòng:cột` khớp V-102 (so với vị trí `<` tính độc lập) | Unit           |
| 2   | File ngoài `sourceDir`, trong `node_modules`, có `?raw`, `.ts` không JSX, file lỗi cú pháp                                                                                                                | Không biến đổi; lỗi cú pháp trả `undefined`                               | Unit           |
| 3   | Source map                                                                                                                                                                                                | Vị trí sau biến đổi ánh xạ về đúng dòng, cột gốc                          | Unit           |
| 4   | `vite build` của fixture có cấu hình chứa plugin                                                                                                                                                          | Bundle không có `data-rc-loc`                                             | Integration    |
| 5   | Thông điệp sai origin, sai nonce, sai `source`, sai schema, nonce của lần chạy trước                                                                                                                      | Bị bỏ qua cả hai phía                                                     | Unit + E2E     |
| 6   | Overlay bị ứng dụng xóa (`document.body.innerHTML = …`)                                                                                                                                                   | Gắn lại                                                                   | Unit (DOM)     |
| 7   | Chế độ Thiết kế: click link, submit form, nút có `onClick`                                                                                                                                                | Không điều hướng, không gửi, handler không chạy                           | E2E            |
| 8   | Trang 2.000 phần tử: rê chuột 200 khung hình                                                                                                                                                              | P95 thời gian cập nhật overlay ≤ 16 ms (PB-01)                            | E2E (Chromium) |
| 9   | Sửa file từ ngoài làm phần tử đang chọn biến mất                                                                                                                                                          | `selection-info` có `found: false`                                        | E2E            |
| 10  | Lỗi runtime ném trong `onClick` ở chế độ Xem thử; lỗi biên dịch                                                                                                                                           | `runtime-error`; `build-error` có `file` tương đối                        | E2E            |
| 11  | Ctrl+Z khi tiêu điểm trong iframe                                                                                                                                                                         | Studio nhận `shortcut`, thực hiện Undo                                    | E2E            |
| 12  | `navigate('/about')` với react-router 7                                                                                                                                                                   | Trang đổi, `route` = `/about`                                             | E2E            |

---

## 5. M-SL — CHỌN PHẦN TỬ VÀ LAYER TREE

**Mục đích:** SRS FR-11 đến FR-15, AC-02.

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-SL-01 | Chuỗi ứng viên của một cú bấm: các phần tử có `data-rc-loc` từ ngoài vào trong tới phần tử đích (R-BR-14). **Gốc** = phần tử ngoài cùng của chuỗi có ít nhất hai phần tử con (trực tiếp hoặc sâu hơn, không qua phần tử có `data-rc-loc` khác) mang `data-rc-loc`; không có thì gốc là phần tử ngoài cùng                                                                                                 |
| R-SL-02 | Bấm thường, theo thứ tự ưu tiên: (a) phần tử đang chọn `S` là tổ tiên của đích → chọn phần tử kế tiếp sau `S` trong chuỗi (đi sâu một cấp); (b) cha của `S` là tổ tiên của đích → chọn phần tử trong chuỗi là con của cha `S` (chọn ngang hàng); (c) còn lại → chọn phần tử ngay sau **gốc** trong chuỗi (gốc là phần tử sâu nhất thì chọn gốc). `S` đã là phần tử sâu nhất và bấm lại vào nó: giữ nguyên |
| R-SL-03 | Ctrl/Cmd + bấm: chọn phần tử sâu nhất. Shift + bấm: thêm phần tử theo R-SL-02 vào vùng chọn, hoặc bỏ nếu đã có                                                                                                                                                                                                                                                                                            |
| R-SL-04 | Esc: chọn cha (theo cây `tree`); đang ở gốc thì bỏ chọn. Bấm vào vùng trống của Canvas ngoài iframe: bỏ chọn                                                                                                                                                                                                                                                                                              |
| R-SL-05 | Vùng chọn trong store là `ElementRef[]`; phần tử **chính** là phần tử được chọn sau cùng. Bridge là nơi tính R-SL-01 đến R-SL-03 (biết DOM); Studio là nơi giữ vùng chọn và gửi `select` để Bridge vẽ                                                                                                                                                                                                     |
| R-SL-06 | Panel vị trí nguồn hiện `file:dòng` của phần tử chính và nút **Mở trong editor** (`POST /open-in-editor`)                                                                                                                                                                                                                                                                                                 |
| R-SL-07 | Layer Tree dựng từ `tree` của Bridge; ảo hóa (ADR-FE-21); mở rộng, thu gọn nhớ theo `loc`                                                                                                                                                                                                                                                                                                                 |
| R-SL-08 | Nhãn nút: `<tag>` + `label` (R-SL-11). `instances > 1`: thêm "×N". Nút có `file` khác nút cha: thêm huy hiệu tên file không đuôi (ranh giới component)                                                                                                                                                                                                                                                    |
| R-SL-09 | Đồng bộ hai chiều: chọn trên Canvas → Layer Tree mở các nút tổ tiên và cuộn tới nút; chọn trên Layer Tree → gửi `select` với `reveal: true`. Rê trên Layer Tree → `highlight`; `hover` từ Bridge → tô dòng trên Layer Tree (không cuộn)                                                                                                                                                                   |
| R-SL-10 | `tree` mới (sau HMR): giữ các ref còn trong cây, bỏ ref không còn; phần tử chính bị bỏ thì phần tử chính là phần tử còn lại sau cùng                                                                                                                                                                                                                                                                      |
| R-SL-11 | `label` do Bridge tính: class đầu tiên của phần tử (không tính class có `:`), không có thì 24 ký tự đầu của chữ trực tiếp, không có thì bỏ trống                                                                                                                                                                                                                                                          |
| R-SL-12 | Layer Tree 5.000 nút cuộn mượt (không khung hình nào > 50 ms khi cuộn liên tục)                                                                                                                                                                                                                                                                                                                           |

**Kiểm thử bắt buộc**

| #   | Tình huống                                                                                                                                        | Kỳ vọng                                                                   | Loại           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------- |
| 1   | DOM `div#root` (không có `data-rc-loc`) `> div.layout > (header, main > section > h1, footer)`: bấm `h1` khi chưa chọn; bấm lại; bấm lại; bấm lại | `main`; `section`; `h1`; `h1`                                             | Unit (DOM)     |
| 2   | Đang chọn `header`, bấm `h1`                                                                                                                      | `main` (ngang hàng với `header`)                                          | Unit (DOM)     |
| 3   | Ctrl+bấm `h1` khi chưa chọn; Shift+bấm `footer` khi đang chọn `header`; Shift+bấm lại `footer`                                                    | `h1`; [`header`, `footer`]; [`header`]                                    | Unit (DOM)     |
| 4   | Chuỗi chỉ có một phần tử; đích không có `data-rc-loc` nhưng tổ tiên có; không tổ tiên nào có                                                      | Chọn phần tử đó; chọn tổ tiên; không chọn                                 | Unit (DOM)     |
| 5   | Esc liên tiếp từ `h1`                                                                                                                             | `section`, `main`, `div.layout`, bỏ chọn                                  | Unit           |
| 6   | Danh sách `.map` 3 mục: bấm mục 2                                                                                                                 | Ref `index: 1`; Layer Tree một nút "×3"                                   | E2E            |
| 7   | Component `Card` dùng hai lần trong `Home.tsx`                                                                                                    | Nút của `Card.tsx` có huy hiệu `Card`                                     | E2E            |
| 8   | E2E AC-02: bấm tiêu đề trên Canvas                                                                                                                | Panel nguồn hiện `src/pages/Home.tsx:<dòng đúng>`; Layer Tree tô đúng nút | E2E            |
| 9   | Bấm nút trên Layer Tree ở cuối trang dài                                                                                                          | Canvas cuộn tới phần tử, khung chọn hiện                                  | E2E            |
| 10  | Mở trong editor (editor giả qua ProcessPort)                                                                                                      | Lệnh `code -g <tuyệt đối>:<dòng>:<cột>`, mảng tham số                     | Contract       |
| 11  | Layer Tree 5.000 nút                                                                                                                              | R-SL-12 đạt                                                               | E2E (Chromium) |

---

## 6. M-SE — SOURCE EDITOR

**Mục đích:** đọc thông tin nguồn của phần tử và sửa mã nguồn tối thiểu, an toàn (ADR-BE-29, SRS NFR-06 đến NFR-08, FR-20 đến FR-25, FR-30, L-01, L-02).

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-SE-01 | Chỉ xử lý file có phần mở rộng thuộc `adapter.sourceExtensions` (khác: E023 `notJsxFile`) trong `sourceDir`, không trong `node_modules` (khác: `readonly: 'outsideSource'`, sửa thì E023). File > 1 MB: `readonly: 'tooLarge'`, sửa thì E023                                                                                                                                                           |
| R-SE-02 | Định vị: bỏ BOM, phân tích (ADR-BE-29), tìm thẻ mở JSX có ký tự `<` tại `line`, `column` (V-102). Không có, hoặc tên thẻ khác `tag`: E017 `moved`. `before` khác giá trị tĩnh hiện tại: E017 `valueChanged`                                                                                                                                                                                            |
| R-SE-03 | Giá trị không tĩnh: E023 với `reason` tương ứng (`classExpression`, `textExpression`, `textMixed`, `selfClosing`, `attrExpression`, `duplicateAttr`)                                                                                                                                                                                                                                                   |
| R-SE-04 | Thuộc tính tĩnh là một trong: `a="…"`, `a='…'`, `a={"…"}`, `a={'…'}`, ``a={`…`}`` (template không có `${}`). Dạng khác là `expression` (kèm `code` ≤ 200 ký tự). Thẻ có hai thuộc tính cùng tên: `className` là `duplicate`; thuộc tính khác là `attrExpression` khi sửa                                                                                                                               |
| R-SE-05 | Ghi giá trị tĩnh: chỉ thay phần **bên trong** dấu nháy, giữ loại nháy. Thuộc tính JSX dạng chuỗi (`"…"`, `'…'`) không có escape: giá trị mới chứa dấu nháy đó hoặc xuống dòng thì đổi thành `{"…"}` với escape JSON. Dạng `{'…'}`, `{"…"}`: escape theo chuỗi JS. Template: escape `` ` ``, `\`, `${`                                                                                                  |
| R-SE-06 | Thêm `className` khi chưa có: chèn ` className="<giá trị>"` ngay sau tên thẻ. Thêm thuộc tính khác: chèn ` <tên>="<giá trị>"` ngay trước `>` hoặc `/>` của thẻ mở (sau thuộc tính cuối). Xóa thuộc tính: xóa thuộc tính và khoảng trắng liền trước; thuộc tính nằm một mình trên một dòng thì xóa cả dòng                                                                                              |
| R-SE-07 | Đọc chữ: con của phần tử chỉ gồm `JSXText` → `static`, giá trị là chuỗi React hiển thị (giải mã thực thể HTML, áp quy tắc khoảng trắng của JSX: bỏ dòng chỉ có khoảng trắng, cắt khoảng trắng đầu cuối mỗi dòng, nối các dòng bằng một dấu cách). Không có con: `static` `''`. Thẻ tự đóng: `selfClosing`. Chỉ có `{…}`: `expression`. Có phần tử con hoặc trộn: `mixed`                               |
| R-SE-08 | Ghi chữ: chuẩn hóa (xuống dòng thành dấu cách, gộp khoảng trắng liền nhau, cắt hai đầu); mã hóa `{` → `&#123;`, `}` → `&#125;`, `<` → `&lt;`, `>` → `&gt;`, `&` đứng trước mẫu `[#a-zA-Z0-9]+;` → `&amp;`. Đoạn con cũ có xuống dòng: ghi dạng nhiều dòng (xuống dòng, thụt lề của dòng chứa thẻ đóng thêm một bậc, chữ, xuống dòng, thụt lề của thẻ đóng); không có: ghi trên một dòng                |
| R-SE-09 | Bậc thụt lề: tab nếu dòng của thẻ mở bắt đầu bằng tab; ngược lại số dấu cách nhỏ nhất khác 0 giữa các dòng thụt lề trong file, mặc định 2                                                                                                                                                                                                                                                              |
| R-SE-10 | Giữ BOM và kiểu xuống dòng của file (ADR-BE-18); đoạn chèn có xuống dòng dùng kiểu xuống dòng chiếm đa số trong file                                                                                                                                                                                                                                                                                   |
| R-SE-11 | Sau khi sửa: phân tích lại toàn file; lỗi thì **không ghi**, trả E024 kèm dòng, cột                                                                                                                                                                                                                                                                                                                    |
| R-SE-12 | Giá trị mới bằng giá trị hiện tại (sau chuẩn hóa): `changed: false`, không ghi, không tạo mục lịch sử                                                                                                                                                                                                                                                                                                  |
| R-SE-13 | Các thao tác trên cùng một file xếp hàng tuần tự. Ghi qua `writeTextAtomic`; ghi xong báo M-HI hash đã ghi (R-HI-05); trả `EditResult` có `ElementSource` mới                                                                                                                                                                                                                                          |
| R-SE-14 | `component`: hàm bao gần nhất chứa phần tử là component (khai báo `function` hoặc `const` gán arrow/function, tên bắt đầu bằng chữ hoa). `usages` = số thẻ JSX `<Tên` trong `sourceDir` thuộc các file import đúng component đó (import tương đối, hoặc alias `@/` khi `tsconfig.json` có `paths` `@/*` → `src/*`), cộng số lần dùng trong chính file. Chỉ mục được tính lười và làm mới theo file đổi |
| R-SE-15 | `inLoop`: phần tử nằm trong hàm là tham số của lời gọi có callee là thuộc tính `map` hoặc `flatMap`                                                                                                                                                                                                                                                                                                    |
| R-SE-16 | Bộ nhớ đệm kết quả phân tích theo (file, hash), LRU 50 file                                                                                                                                                                                                                                                                                                                                            |
| R-SE-17 | Thay đổi tối thiểu: mọi byte ngoài đoạn giá trị thuộc tính (hoặc đoạn con của phần tử, hoặc đoạn chèn/xóa thuộc tính) giữ nguyên                                                                                                                                                                                                                                                                       |

**Kiểm thử bắt buộc** (bộ 40 file của VG-16 là một phần của bộ này)

| #   | Tình huống                                                                                                                                  | Kỳ vọng                                                                                    | Loại     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| 1   | Đọc `className` ở 5 dạng tĩnh, `cn(…)`, biến, template có `${}`, hai `className`, không có                                                  | `static` ×5, `expression` ×3 (có `code`), `duplicate`, `none`                              | Unit     |
| 2   | Đổi class ở 5 dạng tĩnh                                                                                                                     | Giữ loại nháy; diff chỉ trong dấu nháy                                                     | Unit     |
| 3   | Giá trị mới có `"` trong thuộc tính `"…"` (ví dụ `content-["x"]`); có `` ` `` trong template                                                | Đổi thành `{"…"}` hợp lệ; escape đúng; đọc lại ra đúng giá trị                             | Unit     |
| 4   | Thêm `className` cho `<div>`, `<img />`, thẻ có thuộc tính nhiều dòng; xóa `className` ở thẻ một dòng và khi nằm riêng một dòng             | Đúng vị trí R-SE-06; không dòng trống thừa                                                 | Unit     |
| 5   | Vị trí sai dòng; đúng dòng sai tên thẻ; `before` cũ                                                                                         | E017 `moved`, `moved`, `valueChanged`; file không đổi                                      | Unit     |
| 6   | Đọc chữ: một dòng, nhiều dòng, có `&amp;`, `&nbsp;`, chỉ `{name}`, `Xin chào {name}`, có `<b>`, rỗng, tự đóng                               | `static` đúng giá trị React hiển thị; `expression`; `mixed` ×2; `static ''`; `selfClosing` | Unit     |
| 7   | Ghi chữ tiếng Việt có dấu; chữ có `{`, `<`, `&copy;` gõ tay; chữ nhiều dòng cũ; thụt lề bằng tab                                            | Mã hóa đúng R-SE-08; đọc lại ra đúng chuỗi đã ghi; giữ dạng nhiều dòng                     | Unit     |
| 8   | File CRLF, file có BOM, file trộn LF/CRLF                                                                                                   | BOM và kiểu xuống dòng giữ nguyên; so sánh từng byte ngoài vùng sửa                        | Unit     |
| 9   | Sửa thuộc tính `href` tĩnh; `href={url}`; thêm `alt` cho `<img src="…" />`; xóa `placeholder`                                               | Đúng; E023 `attrExpression`; chèn trước `/>`; xóa sạch                                     | Unit     |
| 10  | Sửa làm hỏng cú pháp (giả lập bằng cách tiêm lỗi vào bước sinh)                                                                             | E024, file không đổi                                                                       | Unit     |
| 11  | Giá trị không đổi                                                                                                                           | `changed: false`, không ghi (FileSystemPort giả đếm số lần ghi = 0)                        | Unit     |
| 12  | 20 yêu cầu song song trên cùng file                                                                                                         | Tuần tự, kết quả cuối có đủ 20 thay đổi hoặc E017 đúng chỗ, không mất ghi                  | Unit     |
| 13  | `component`: phần tử trong `Card` dùng ở 2 file (import tương đối và `@/`); trong trang chỉ dùng ở `routes.tsx`; `inLoop` trong `.map` lồng | `usages: 2`; `usages: 1`; `inLoop: true`                                                   | Unit     |
| 14  | File ngoài `sourceDir`, trong `node_modules`, `.ts`, 1,5 MB                                                                                 | `outsideSource`, `outsideSource`, E023 `notJsxFile`, `tooLarge`                            | Unit     |
| 15  | Đường dẫn `../x.tsx`, `C:/x.tsx`, symlink trỏ ra ngoài dự án                                                                                | E016, E016, E012                                                                           | Contract |
| 16  | Hiệu năng file 2.000 dòng                                                                                                                   | P95 ≤ 100 ms (PB-03)                                                                       | Bench    |
| 17  | VG-16: bộ 40 file × (đổi class, đổi chữ, thêm/xóa thuộc tính)                                                                               | Diff tối thiểu; Undo đúng từng byte                                                        | Unit     |

---

## 7. M-HI — LỊCH SỬ UNDO/REDO

**Mục đích:** ADR-BE-30, SRS FR-29, NFR-08, L-06, AC-10.

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-HI-01 | Mỗi thao tác sửa có `changed: true` tạo một mục `{ id, label, coalesceKey?, files: [{ path, before, after, beforeHash, afterHash }], updatedAt }`. `label`: `history:setClassName`, `history:setText`, `history:setAttribute` với `params.tag`                                                       |
| R-HI-02 | Gộp: mục mới có cùng `coalesceKey` và cùng file với mục trên cùng của ngăn Undo, cách `updatedAt` của mục đó ≤ 500 ms, và chưa Undo nào xảy ra sau mục đó → gộp vào mục đó (giữ `before` cũ, thay `after`, cập nhật `updatedAt`)                                                                     |
| R-HI-03 | Thao tác sửa mới xóa ngăn Redo                                                                                                                                                                                                                                                                       |
| R-HI-04 | Undo: mọi file của mục phải có hash hiện tại bằng `afterHash`; Redo: bằng `beforeHash`. Không bằng: bỏ khỏi cả hai ngăn mọi mục có file đó, phát `history.changed`, trả E017 `{ file, reason: 'fileChanged' }`, không ghi gì                                                                         |
| R-HI-05 | File trong dự án đổi (watcher) mà hash khác hash ReactCraft ghi gần nhất cho file đó: là sửa từ bên ngoài → áp phần "bỏ mục" của R-HI-04 ngay và phát `project.filesChanged`. Hash bằng: là ghi của ReactCraft, bỏ qua                                                                               |
| R-HI-06 | Undo ghi `before`, Redo ghi `after`, đúng từng byte, qua `writeTextAtomic`; ghi hash như R-HI-05. Mục nhiều file: ghi lần lượt; một file lỗi thì ghi lại nội dung cũ của các file đã ghi trong lần đó và trả lỗi                                                                                     |
| R-HI-07 | Tối đa 200 mục hoặc 50 MB tổng nội dung; vượt thì bỏ mục cũ nhất                                                                                                                                                                                                                                     |
| R-HI-08 | Lịch sử chỉ trong bộ nhớ, xóa khi đóng dự án hoặc tắt server                                                                                                                                                                                                                                         |
| R-HI-09 | Studio: Ctrl/Cmd+Z = Undo; Ctrl+Y và Cmd+Shift+Z (và Ctrl+Shift+Z) = Redo; cả khi phím đến từ Bridge (`shortcut`). **Không** bắt khi tiêu điểm ở ô nhập của Studio (để Undo gõ chữ của trình duyệt chạy) hoặc khi đang sửa chữ trên Canvas. Nút Undo/Redo trên thanh công cụ có tooltip theo `label` |
| R-HI-10 | Lỗi E017 khi Undo: thông báo "File <file> đã bị sửa từ nơi khác, không hoàn tác được bước này"                                                                                                                                                                                                       |

**Kiểm thử bắt buộc**

| #   | Tình huống                                                                                                 | Kỳ vọng                                           | Loại               |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------ |
| 1   | 3 sửa → Undo ×3 → Redo ×3                                                                                  | Nội dung từng bước đúng từng byte (so hash)       | Unit               |
| 2   | 10 sửa cùng `coalesceKey` cách nhau 100 ms; rồi một sửa sau 600 ms                                         | 2 mục                                             | Unit (đồng hồ giả) |
| 3   | Cùng `coalesceKey` nhưng xen giữa có Undo                                                                  | Không gộp                                         | Unit               |
| 4   | Sửa mới sau Undo                                                                                           | Ngăn Redo trống                                   | Unit               |
| 5   | File A sửa từ ngoài; lịch sử có mục của A và B                                                             | Mục của A bị bỏ, mục của B còn, `history.changed` | Unit               |
| 6   | Watcher báo file vừa do ReactCraft ghi                                                                     | Không bỏ mục nào                                  | Unit               |
| 7   | Undo khi file đổi nhưng watcher chưa kịp báo                                                               | E017 `fileChanged`, file không đổi                | Unit               |
| 8   | 201 mục; mục 30 MB + mục 25 MB                                                                             | Còn 200 mục; mục cũ bị bỏ để ≤ 50 MB              | Unit               |
| 9   | Undo/Redo khi trống                                                                                        | E015 `history`                                    | Contract           |
| 10  | E2E AC-03: đổi padding trên cùng thành 40 px → `pt-10`, `git diff` một dòng; Undo → hash file bằng ban đầu | Đạt                                               | E2E                |
| 11  | E2E AC-10: sửa file trang bằng tiến trình ngoài → Canvas cập nhật; Undo → E017                             | Đạt                                               | E2E                |
| 12  | E2E: Ctrl+Z khi đang gõ trong ô Inspector                                                                  | Không Undo lịch sử (chỉ hoàn tác ô nhập)          | E2E                |

---

## 8. M-TW — MÔ HÌNH CLASS TAILWIND

**Mục đích:** đọc chuỗi class thành giá trị theo thuộc tính, ghi giá trị thành chuỗi class thay đổi tối thiểu (ADR-FE-06). Thuần TypeScript trong `shared`, không DOM, không Node.

```ts
type PropertyId = string; // theo bảng 8.2
type ClassValue =
  | { kind: 'scale'; token: string } // p-4, w-1/2, text-lg
  | { kind: 'keyword'; name: string } // w-auto, flex, items-center
  | { kind: 'theme'; name: string } // bg-brand (từ @theme)
  | { kind: 'arbitrary'; css: string }; // p-[13px]
type ClassToken = {
  raw: string;
  start: number;
  end: number; // vị trí trong chuỗi
  variants: string[];
  important: boolean;
  negative: boolean;
  utility: string;
  property?: PropertyId;
  value?: ClassValue;
  opacity?: string; // bg-red-500/50
};
type Scope = { breakpoint: Breakpoint; state?: InteractionState };
type ClassContext = {
  theme: ThemeInfo;
  mode: ResponsiveMode;
  breakpoints: Record<ResponsiveKey, number>;
};

function parseClasses(input: string, ctx: ClassContext): ClassToken[];
function readValue(
  tokens: ClassToken[],
  property: PropertyId,
  view: { width: number; state?: InteractionState },
  ctx: ClassContext,
): { value?: ClassValue; from?: Scope; token?: ClassToken; conflict: boolean };
function writeValue(
  input: string,
  property: PropertyId,
  scope: Scope,
  value: ClassValue | undefined,
  ctx: ClassContext,
): string;
```

### 8.1. Quy tắc

| Mã      | Quy tắc                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-TW-01 | Tách token theo khoảng trắng ASCII nằm **ngoài** `[]` và `()`; giữ vị trí `start`, `end`                                                                                                                                                                                                                                                                                                                                                                                 |
| R-TW-02 | Tách biến thể theo `:` nằm ngoài `[]`, `()`; đoạn cuối là utility. `!` ở đầu (v3) hoặc cuối (v4) utility: `important`. `-` ở đầu utility: `negative`                                                                                                                                                                                                                                                                                                                     |
| R-TW-03 | Biến thể được nhận: responsive `sm` … `2xl` và `max-sm` … `max-2xl` (và tên trong `--breakpoint-*`), trạng thái `hover`, `focus`, `disabled`. Token có biến thể khác (`dark:`, `group-hover:`, `aria-*`, `[&>*]:`…) hoặc utility không có trong bảng 8.2: không có `property`, giữ nguyên, Inspector liệt kê ở "Class khác"                                                                                                                                              |
| R-TW-04 | `readValue`: ứng viên là token cùng `property`, mọi biến thể responsive **áp dụng** ở `width` (`k:` khi `width ≥ mốc k`; `max-k:` khi `width < mốc k`), biến thể trạng thái bằng `view.state` (không chọn trạng thái thì loại token có biến thể trạng thái). Thắng: hạng trạng thái cao hơn, rồi hạng responsive cao hơn (`k:` theo mốc tăng dần; `max-k:` theo mốc giảm dần — mốc nhỏ hơn thắng; không biến thể = 0). Bằng hạng: token đứng sau thắng, `conflict: true` |
| R-TW-05 | `writeValue`: tập biến thể đích = biến thể responsive của `scope.breakpoint` theo `mode` (`base` → không có) + `scope.state`. Token cùng `property` có **đúng** tập biến thể đích (không kể thứ tự): thay token đầu tiên tại chỗ (giữ thứ tự biến thể, `important` của nó), xóa các token còn lại. Không có: thêm vào cuối, biến thể responsive trước biến thể trạng thái. `value` là `undefined`: xóa các token đó                                                      |
| R-TW-06 | Chỉ thay, xóa đúng token; phần còn lại của chuỗi (kể cả khoảng trắng giữa các token khác) giữ nguyên. Xóa token thì xóa thêm **một** đoạn khoảng trắng liền kề (ưu tiên bên trái). Thêm token thì nối bằng một dấu cách (chuỗi rỗng thì không)                                                                                                                                                                                                                           |
| R-TW-07 | Họ thuộc tính: `padding` > `paddingX`/`paddingY` > `paddingTop`/`Right`/`Bottom`/`Left` (tương tự `margin`, `inset`, `gap`). Đọc một cạnh: ứng viên gồm token của cạnh, trục, và tất cả; bằng hạng R-TW-04 thì cạnh > trục > tất cả. Ghi "tất cả" (Inspector ở chế độ liên kết cạnh): ghi `p-*`, xóa `px py pt pr pb pl` cùng tập biến thể. Ghi một cạnh: chỉ ghi token của cạnh đó                                                                                      |
| R-TW-08 | Nhập px cho thuộc tính dùng thang khoảng cách: `px / spacing` (spacing = `--spacing` của `@theme`, mặc định 4 px) là bội của 0,5 → `scale` (`pt-10` cho 40 px); ngược lại `arbitrary` (`pt-[13px]`). `0` → `0`, `1px` → `px`                                                                                                                                                                                                                                             |
| R-TW-09 | Phân biệt `text-*`: từ khóa căn lề → `textAlign`; tên cỡ (`xs`…`9xl`, `--text-*`) hoặc `[<độ dài>]` → `fontSize`; còn lại là màu (`--color-*`, bảng màu, `[#…]`, `[rgb(…)]`, `[oklch(…)]`, `[var(…)]`) → `textColor`. Phân biệt `border-*`: số hoặc `[<độ dài>]` → `borderWidth`; kiểu nét → `borderStyle`; màu → `borderColor`                                                                                                                                          |
| R-TW-10 | Giá trị `arbitrary` ghi `prefix-[css]` với dấu cách đổi thành `_`; đọc thì ngược lại                                                                                                                                                                                                                                                                                                                                                                                     |
| R-TW-11 | Khứ hồi: `writeValue(s, p, scope, readValue(...).value)` với `from` bằng `scope` trả về đúng `s`                                                                                                                                                                                                                                                                                                                                                                         |

### 8.2. Bảng thuộc tính Phase 1

| Nhóm (FR-20)     | Thuộc tính                                                          | Utility                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bố cục           | `display`                                                           | `block inline-block inline flex inline-flex grid inline-grid hidden contents`                                                                                 |
|                  | `flexDirection`, `flexWrap`                                         | `flex-row flex-row-reverse flex-col flex-col-reverse`; `flex-wrap flex-wrap-reverse flex-nowrap`                                                              |
|                  | `justifyContent`, `alignItems`                                      | `justify-{start,end,center,between,around,evenly,stretch}`; `items-{start,end,center,baseline,stretch}`                                                       |
|                  | `gap`, `gapX`, `gapY`                                               | `gap-`, `gap-x-`, `gap-y-` + thang khoảng cách                                                                                                                |
|                  | `gridCols`                                                          | `grid-cols-{n,none,subgrid,[…]}`                                                                                                                              |
| Vị trí trong cha | `alignSelf`, `flex`, `grow`, `shrink`                               | `self-{auto,start,end,center,stretch,baseline}`; `flex-{1,auto,initial,none,[…]}`; `grow grow-0`; `shrink shrink-0`                                           |
|                  | `position`, `zIndex`                                                | `static relative absolute fixed sticky`; `z-{n,auto,[…]}`                                                                                                     |
|                  | `inset`, `insetX`, `insetY`, `top`, `right`, `bottom`, `left`       | `inset-`, `inset-x-`, `inset-y-`, `top-`, `right-`, `bottom-`, `left-` + thang, phân số, `auto`, `full`, âm                                                   |
| Kích thước       | `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | `w- h- min-w- max-w- min-h- max-h-` + thang, phân số, `auto full screen svh dvh min max fit px`, `max-w-{xs…7xl,prose}`, `[…]`                                |
| Khoảng cách      | `padding*`, `margin*`                                               | `p px py pt pr pb pl`, `m mx my mt mr mb ml` + thang, `[…]`; margin có `auto` và âm                                                                           |
| Chữ              | `fontSize`, `fontWeight`, `fontFamily`                              | `text-{xs…9xl,--text-*,[…]}`; `font-{thin,extralight,light,normal,medium,semibold,bold,extrabold,black}`; `font-{sans,serif,mono,--font-*}`                   |
|                  | `lineHeight`, `letterSpacing`, `textAlign`                          | `leading-{none,tight,snug,normal,relaxed,loose,n,[…]}`; `tracking-{tighter,tight,normal,wide,wider,widest,[…]}`; `text-{left,center,right,justify,start,end}` |
|                  | `textTransform`, `textDecoration`, `fontStyle`                      | `uppercase lowercase capitalize normal-case`; `underline overline line-through no-underline`; `italic not-italic`                                             |
| Màu              | `textColor`, `backgroundColor`, `borderColor`                       | `text-`, `bg-`, `border-` + màu (R-TW-09), có `/<độ mờ>`                                                                                                      |
| Viền             | `borderWidth`, `borderStyle`, `borderRadius`                        | `border border-{0,2,4,8,[…]}`; `border-{solid,dashed,dotted,double,hidden,none}`; `rounded rounded-{none,xs,sm,md,lg,xl,2xl,3xl,4xl,full,--radius-*,[…]}`     |
| Hiệu ứng         | `boxShadow`, `opacity`                                              | `shadow shadow-{2xs,xs,sm,md,lg,xl,2xl,none,--shadow-*,[…]}`; `opacity-{0…100,[…]}`                                                                           |
| Hiển thị         | `overflow`, `visibility`, `objectFit`                               | `overflow-{auto,hidden,clip,visible,scroll}`; `visible invisible`; `object-{contain,cover,fill,none,scale-down}`                                              |

Cạnh riêng của viền và bo góc (`border-t`, `rounded-tl`…) chưa có ở Phase 1: là "Class khác".

**Kiểm thử bắt buộc**

| #   | Tình huống                                                                                                                                                                 | Kỳ vọng                                                         | Loại |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---- |
| 1   | Tách `p-4 md:hover:bg-[url('a b')] !font-bold -mt-2 grid-cols-[repeat(2,minmax(0,1fr))] bg-red-500/50`                                                                     | 6 token, biến thể, `important`, `negative`, `opacity` đúng      | Unit |
| 2   | Nhận diện mọi dòng của bảng 8.2 (ít nhất 2 ví dụ mỗi thuộc tính) và 10 class lạ                                                                                            | Đúng `property`, `value`; class lạ không có `property`          | Unit |
| 3   | `text-lg`, `text-center`, `text-brand` (có `--color-brand`), `text-hero` (có `--text-hero`), `text-[14px]`, `text-[#fff]`; `border-2`, `border-dashed`, `border-slate-200` | R-TW-09 đúng                                                    | Unit |
| 4   | `readValue` `p-4 max-md:p-2 max-sm:p-1` ở 1440, 700, 500 (`desktop-first`)                                                                                                 | `4` từ `base`; `2` từ `md`; `1` từ `sm`                         | Unit |
| 5   | `readValue` `p-1 md:p-2 lg:p-3` ở 375, 800, 1200                                                                                                                           | `1`, `2`, `3`                                                   | Unit |
| 6   | `bg-white hover:bg-gray-100` với `state` hover và không có                                                                                                                 | `gray-100`; `white`                                             | Unit |
| 7   | `p-4 pt-2` đọc `paddingTop`, `paddingBottom`; `px-3 pl-1` đọc `paddingLeft`, `paddingRight`                                                                                | `2`, `4`; `1`, `3`                                              | Unit |
| 8   | `p-4 p-2` đọc `padding`                                                                                                                                                    | `2`, `conflict: true`                                           | Unit |
| 9   | `writeValue` thay tại chỗ: `flex p-4 text-sm` → `padding` = `6`                                                                                                            | `flex p-6 text-sm`                                              | Unit |
| 10  | Ghi ở `scope` `sm` (`desktop-first`) khi chưa có; khi đã có `max-sm:p-2`; ghi `undefined`                                                                                  | Thêm `max-sm:p-…` ở cuối; thay tại chỗ; xóa và một khoảng trắng | Unit |
| 11  | Ghi `scope` `{ breakpoint: 'md', state: 'hover' }` `mobile-first`                                                                                                          | `md:hover:…`                                                    | Unit |
| 12  | Ghi "tất cả" khi có `px-2 pt-1 md:pt-3`                                                                                                                                    | `p-…` mới; `px-2 pt-1` bị xóa; `md:pt-3` giữ                    | Unit |
| 13  | Nhập 40 px, 13 px, 10 px, 0, 1 px; `--spacing: 0.5rem`                                                                                                                     | `10`, `[13px]`, `2.5`, `0`, `px`; với spacing 8 px: 40 px → `5` | Unit |
| 14  | Chuỗi có nhiều khoảng trắng, xuống dòng giữa các class                                                                                                                     | Ghi chỉ đổi token liên quan, khoảng trắng khác giữ nguyên       | Unit |
| 15  | Khứ hồi R-TW-11 trên 200 chuỗi class lấy từ fixture                                                                                                                        | Không đổi                                                       | Unit |

---

## 9. M-IN — INSPECTOR

**Mục đích:** SRS FR-20 đến FR-23, FR-25, FR-30, AC-03, AC-04, AC-12.

| Mã      | Quy tắc                                                                                                                                                                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-IN-10 | Chọn **một** phần tử: Studio gọi `GET /source/element`, phân tích `className` bằng M-TW với `ThemeInfo`, hiện các nhóm theo thứ tự bảng 8.2. Chọn nhiều: hiện "Đã chọn N phần tử", không có ô sửa (Phase 2 mở rộng). Không chọn: trống                            |
| R-IN-11 | Mỗi ô hiện giá trị `readValue` ở độ rộng khung đang xem và trạng thái đang chọn. Giá trị đến từ phạm vi khác phạm vi ghi: nhãn "kế thừa từ <phạm vi>". Giá trị thuộc đúng phạm vi ghi: tô nổi và có nút "Bỏ ghi đè" (ghi `undefined`) khi phạm vi ghi khác `base` |
| R-IN-12 | Phạm vi ghi: `breakpoint` = `editBreakpoint(frame.width, primaryFrame.width, mode)`, `state` = ô chọn trạng thái (Không, Hover, Focus, Disabled). Đầu Inspector hiện tiền tố sẽ ghi (ví dụ `max-sm:hover:`)                                                       |
| R-IN-13 | Sửa một ô: chuỗi mới = `writeValue(...)`; gửi `setClassName` với `before` = chuỗi hiện tại, `coalesceKey` = `<loc>                                                                                                                                                | <property> | <tiền tố>`. Mỗi phần tử tối đa một yêu cầu đang bay; yêu cầu sau dùng `className`trong`EditResult`trước. Ô hiện giá trị mới ngay; lỗi thì trả về giá trị của server và báo lỗi. E017: tải lại`ElementSource` và báo "mã nguồn đã đổi, đã tải lại" |
| R-IN-14 | Nhập liên tục (kéo số, thanh trượt, giữ phím mũi tên): gửi tối đa một yêu cầu mỗi 100 ms, giá trị cuối luôn được gửi                                                                                                                                              |
| R-IN-15 | `className` là `expression` hoặc `duplicate`, hoặc phần tử `readonly`: mọi ô khóa; hiện lý do (khóa i18n theo `reason` của E023), đoạn `code`, nút "Mở trong editor" đúng `file:dòng:cột` (AC-12, FR-30)                                                          |
| R-IN-16 | `component.usages > 1`: dải "Thay đổi áp dụng cho mọi nơi dùng <name> (N chỗ)" (FR-14). `inLoop` hoặc `instances > 1`: dải "Lặp N lần: sửa áp dụng cho mọi bản lặp" (FR-13)                                                                                       |
| R-IN-17 | Mục "Class khác": token không có `property` dạng thẻ chỉ đọc. Ô "Chuỗi class" (thu gọn mặc định) cho sửa cả chuỗi tĩnh, Enter để ghi                                                                                                                              |
| R-IN-18 | Thuộc tính theo thẻ (FR-25): `a` → `href`; `img` → `src`, `alt`; `input` → `placeholder`, `type`; `textarea` → `placeholder`; `button` → `type`. `expression` thì chỉ đọc kèm "Mở trong editor"                                                                   |
| R-IN-19 | Ô màu: token màu của `@theme` theo tên trước, rồi bảng màu Tailwind, rồi ô nhập mã màu (ghi `arbitrary`). Ô cỡ chữ, bo góc, bóng, font: tên trong `@theme` trước, rồi thang mặc định (FR-23)                                                                      |
| R-IN-20 | Làm mới `ElementSource` (gộp 100 ms) khi `project.filesChanged` có file của phần tử, sau Undo/Redo, sau `tree` mới. Ô đang có tiêu điểm không bị ghi đè tới khi mất tiêu điểm                                                                                     |
| R-IN-21 | Từ lúc xác nhận một ô tới khi `selection-info` có `domClass` chứa class mới ≤ 500 ms P95 trên dự án mẫu (PB-02)                                                                                                                                                   |

**Kiểm thử bắt buộc**

| #   | Tình huống                                                                                                              | Kỳ vọng                                                 | Loại      |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------- |
| 1   | Hiện đủ nhóm, đúng giá trị cho phần tử `flex flex-col gap-4 p-6 text-lg font-bold bg-white rounded-xl shadow-md`        | Đúng từng ô                                             | Component |
| 2   | Khung Mobile, `desktop-first`, phần tử có `p-6`                                                                         | Ô padding hiện `6` "kế thừa từ base"; tiền tố `max-sm:` | Component |
| 3   | Kéo số padding 20 lần trong 1 s                                                                                         | ≤ 11 yêu cầu; một mục lịch sử; giá trị cuối đúng        | Component |
| 4   | Server trả E017 khi đang sửa                                                                                            | Tải lại `ElementSource`, báo lỗi, ô hiện giá trị server | Component |
| 5   | `className={cn('p-4', x)}`                                                                                              | Mọi ô khóa, lý do `classExpression`, nút mở editor      | Component |
| 6   | Phần tử trong `Card` dùng 2 nơi; phần tử trong `.map`                                                                   | Hai dải cảnh báo                                        | Component |
| 7   | Chọn nhiều                                                                                                              | "Đã chọn 2 phần tử", không ô sửa                        | Component |
| 8   | E2E AC-03 (xem M-HI #10) và đo PB-02                                                                                    | Đạt; P95 ≤ 500 ms                                       | E2E       |
| 9   | E2E AC-04: dự án `desktop-first` khung chuẩn 1440; ở Mobile đổi padding → file có `max-sm:p-…`; về Desktop → giá trị cũ | Đạt                                                     | E2E       |
| 10  | E2E: chọn trạng thái Hover, đổi màu nền → `hover:bg-…`; rê chuột ở chế độ Xem thử thấy màu mới                          | Đạt                                                     | E2E       |
| 11  | E2E AC-12: phần tử `className={cn(...)}` → Inspector khóa, nêu lý do, "Mở trong editor" gọi đúng `file:dòng:cột`        | Đạt                                                     | E2E       |
| 12  | E2E: token `--color-brand` hiện tên "brand" trong ô màu; chọn → class `bg-brand`                                        | Đạt                                                     | E2E       |
| 13  | E2E: sửa `href` của link, `alt` của ảnh                                                                                 | File đổi đúng thuộc tính                                | E2E       |
| 14  | Mọi chữ của Inspector có ở `vi` và `en` (VG-12)                                                                         | Đạt                                                     | Unit      |

---

## 10. M-TX — SỬA CHỮ TRÊN CANVAS

**Mục đích:** SRS FR-24, AC-06, L-02.

| Mã      | Quy tắc                                                                                                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-TX-01 | Nhấp đúp ở chế độ Thiết kế: Bridge gửi `text-edit-request` cho phần tử đích (theo R-SL-02 sau cú bấm thứ hai). Studio lấy `ElementSource`: `text.kind === 'static'` và không `readonly` → gửi `text-edit-start`; ngược lại báo E023 theo lý do kèm "Mở trong editor" |
| R-TX-02 | `text-edit-start`: Bridge lưu `textContent` cũ, đặt `contenteditable="plaintext-only"` (trình duyệt không hỗ trợ thì `true`), focus, chọn hết chữ; overlay vẽ khung sửa chữ                                                                                          |
| R-TX-03 | Trong lúc sửa: Bridge không chặn sự kiện bên trong phần tử đó; bấm ra ngoài phần tử = kết thúc có lưu. Enter (không Shift) = kết thúc có lưu; Shift+Enter bị chặn (chữ một đoạn); Esc = hủy                                                                          |
| R-TX-04 | Kết thúc: **gỡ mọi listener trước**, rồi bỏ `contenteditable`. Lưu: chữ = `innerText` chuẩn hóa như R-SE-08; bằng chữ cũ (sau chuẩn hóa) → `text-cancel`; khác → `text-commit`. Hủy: trả lại `textContent` cũ, `text-cancel`                                         |
| R-TX-05 | Studio nhận `text-commit`: gửi `setText` với `before` = `ElementSource.text.value`. Lỗi: báo lỗi; HMR hoặc lần render sau đưa DOM về đúng mã nguồn                                                                                                                   |
| R-TX-06 | `text-edit-end` từ Studio (đổi khung, đổi chế độ, Undo, mất kết nối dev server): kết thúc có lưu                                                                                                                                                                     |
| R-TX-07 | Phần tử có `instances > 1`: cho sửa, Studio hiện dải "Lặp N lần" (sửa mẫu chung)                                                                                                                                                                                     |
| R-TX-08 | Gõ bằng bộ gõ tiếng Việt (IME, `compositionstart`/`compositionend`): Enter trong lúc đang ghép chữ **không** kết thúc sửa                                                                                                                                            |

**Kiểm thử bắt buộc**

| #   | Tình huống                                                                                | Kỳ vọng                                                       | Loại       |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------- |
| 1   | E2E AC-06: nhấp đúp tiêu đề, gõ "Sản phẩm nổi bật", Enter                                 | Đúng đoạn chữ trong JSX đổi; `git diff` chỉ dòng đó           | E2E        |
| 2   | Esc sau khi gõ                                                                            | File không đổi, DOM về chữ cũ                                 | E2E        |
| 3   | Bấm ra ngoài sau khi gõ                                                                   | Lưu                                                           | E2E        |
| 4   | Không đổi gì rồi Enter                                                                    | Không có yêu cầu `setText`                                    | E2E        |
| 5   | Nhấp đúp `<p>Xin chào {name}</p>`, `<p>{title}</p>`                                       | Không vào chế độ sửa; báo lý do `textMixed`, `textExpression` | E2E        |
| 6   | Gõ `{a} < b & c`                                                                          | File có thực thể đúng; Canvas hiện đúng chuỗi đã gõ           | E2E        |
| 7   | Phím Enter trong lúc IME đang ghép chữ (giả lập `compositionstart`)                       | Chưa kết thúc                                                 | Unit (DOM) |
| 8   | Listener gỡ trước khi bỏ `contenteditable` (bài học WP-1.08): Esc không tạo `text-commit` | Đạt                                                           | Unit (DOM) |
| 9   | Undo sau khi sửa chữ                                                                      | File về đúng từng byte                                        | E2E        |

---

## 11. BỘ TEST PHASE 1 (WP-1.02)

### 11.1. Fixture

| Fixture                              | Nội dung                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixtures/projects/vite8-react19-ts` | Đúng quy ước template; `Home.tsx` có tiêu đề, đoạn văn, nút, link, ảnh, danh sách `.map` 3 mục, `Card` dùng 2 lần (import tương đối và `@/`), một phần tử `className={cn(...)}`, chữ có `&amp;`; `Crlf.tsx` (CRLF), `Bom.tsx` (BOM); `@theme` có `--color-brand`, `--text-hero`; `vite.config.ts` có một plugin đánh dấu (chèn `<meta name="fixture-plugin">`); `desktop-first` |
| `fixtures/projects/vite7-react18-js` | `.jsx`, không `tsconfig.json`, `mobile-first`                                                                                                                                                                                                                                                                                                                                   |
| `fixtures/projects/unsupported/*`    | Một thư mục cho mỗi `UnsupportedReason`                                                                                                                                                                                                                                                                                                                                         |
| `fixtures/projects/broken-config`    | `vite.config.ts` lỗi cú pháp                                                                                                                                                                                                                                                                                                                                                    |
| `fixtures/source-corpus/`            | 40 file `.tsx`/`.jsx` cho VG-16 (định dạng khác nhau, CRLF, BOM, tab, chuỗi nhiều dòng, JSX lồng sâu)                                                                                                                                                                                                                                                                           |

| Mã      | Quy tắc                                                                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-QA-01 | Fixture dự án nằm trong pnpm workspace của repo để có `node_modules` khi `pnpm install`. Test **không** sửa fixture tại chỗ: chép mã nguồn (trừ `node_modules`) sang thư mục tạm và tạo junction/symlink `node_modules` trỏ về `node_modules` của fixture |
| R-QA-02 | Test không chạm cấu hình thật của người dùng: đặt `REACTCRAFT_CONFIG_DIR`, thư mục dữ liệu và cache vào thư mục tạm                                                                                                                                       |
| R-QA-03 | Test E2E cần mạng mang nhãn `@network`, chạy ở cổng G1 và theo lịch, không chạy mỗi lần đẩy code                                                                                                                                                          |
| R-QA-04 | Mỗi test ghi mã quy tắc trong ngoặc vuông (QC-93), ví dụ `[R-SE-05]`, để `pnpm trace` truy vết                                                                                                                                                            |

### 11.2. Thứ tự viết

1. Unit thuần: M-TW, phần biến đổi của M-BR, M-SE, M-HI, phát hiện của M-PJ — viết trước, kiểm bằng bản cài đặt nháp khi khả thi (CW-50).
2. Contract (route + core với port giả): M-PJ, M-RN, M-SE, M-HI.
3. Integration: runner thật trên fixture (M-RN #5–7, M-BR #4).
4. E2E trên 3 trình duyệt: danh sách E2E của mọi module ở trên; cổng G1 chạy cả bộ một lần (CW-51).

---

## 12. TRUY VẾT SPEC-04 PHASE 1

| SRS                    | Module, quy tắc                        |
| ---------------------- | -------------------------------------- |
| FR-01, FR-03           | M-FW, R-PJ-01 đến R-PJ-11, R-PJ-20, 21 |
| FR-02                  | R-PJ-14, R-PJ-23                       |
| FR-04, FR-05           | R-PJ-13, R-PJ-15, R-PJ-22              |
| FR-06, FR-17           | M-RN, R-BR-17                          |
| FR-10                  | R-RN-21, R-RN-26                       |
| FR-11, FR-12, FR-15    | M-SL, R-BR-12 đến R-BR-16              |
| FR-13, FR-14           | R-SE-14, R-SE-15, R-IN-16              |
| FR-16                  | R-BR-19 (điều hướng đầy đủ ở Phase 2)  |
| FR-20 đến FR-23        | M-TW, M-IN                             |
| FR-24                  | M-TX, R-SE-07, R-SE-08                 |
| FR-25                  | R-SE-04 đến R-SE-06, R-IN-18           |
| FR-29                  | M-HI                                   |
| FR-30, L-01, L-02      | R-SE-03, R-IN-15, R-TX-01              |
| L-04, L-06             | R-IN-16, R-HI-04, R-HI-05              |
| NFR-06, NFR-07, NFR-08 | R-SE-11, R-SE-13, R-HI-06              |
| AC-01                  | M-PJ #18                               |
| AC-02                  | M-PJ #19, M-SL #8                      |
| AC-03                  | M-HI #10, M-IN #8                      |
| AC-04                  | M-IN #9                                |
| AC-06                  | M-TX #1                                |
| AC-10                  | M-HI #11                               |
| AC-12                  | M-IN #11                               |

**Chưa làm ở Phase 1 (ghi để không quên):** `className` dạng `cn('tĩnh', …)` sửa được phần chuỗi tĩnh (L-01 đầy đủ, Phase 4); chọn phần tử của thư viện ngoài theo chỗ dùng component (L-03, Phase 2); breakpoint tùy biến ngoài `sm`…`2xl` ghi được (Phase 4); cạnh riêng của viền, bo góc (Phase 4).

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

| Ngày       | Phiên bản         | Thay đổi                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-13 | 1.0 (nháp, đợt 1) | Chuyển sang hướng "mã nguồn là nguồn sự thật" theo SRS v5.0. Viết lại Phần 0, SPEC-01, lộ trình SPEC-07. Bỏ toàn bộ hướng Design Model của bản 0.18                                                                                                                                                                                                                                               |
| 2026-10-14 | 1.0 (nháp, đợt 2) | Viết SPEC-03 (API, sự kiện, giao thức Bridge, mã lỗi) và SPEC-04 Phase 1 (M-FW, M-PJ, M-RN, M-BR, M-SL, M-SE, M-HI, M-TW, M-IN, M-TX, bộ test Phase 1). Thêm bộ chuyển đổi framework để thêm Next.js sau. Sửa ADR-BE-05 (lý do `noTailwindCss`), ADR-BE-28 (thư mục `runners/`, đổi cổng), ADR-FE-04 (iframe cao theo khung, cuộn bên trong), ADR-FE-22 (danh mục thông điệp chuyển sang SPEC-03) |
