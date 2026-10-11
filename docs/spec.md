# SPEC — REACTCRAFT LOCAL

## Bộ đặc tả kỹ thuật thi công (Technical Specification Set)

**Dự án:** ReactCraft Local  
**Tài liệu gốc:** ReactCraft Local — Software Requirements Specification v4.0  
**Phiên bản tài liệu:** 0.17  
**Trạng thái:** Đang xây dựng — viết và duyệt từng phần  
**Cập nhật lần cuối:** 2026-10-07

---

# PHẦN 0 — HƯỚNG DẪN SỬ DỤNG TÀI LIỆU

## 0.1. Mục đích

SRS v4.0 mô tả **hệ thống phải làm gì**. Tài liệu này mô tả **hệ thống được xây dựng như thế nào**: công nghệ nào, cấu trúc ra sao, giao tiếp theo hợp đồng nào, kiểm chứng và nghiệm thu bằng tiêu chí nào.

Nguyên tắc:

> Tài liệu này là bản vẽ thi công. Người triển khai (developer hoặc AI coding assistant) làm đúng theo tài liệu, không tự chọn công nghệ, không tự đặt cấu trúc. Điều gì chưa có trong tài liệu thì phải bổ sung vào tài liệu trước khi làm.

---

## 0.2. Cấu trúc và tiến độ

| Phần | Nội dung | Trạng thái |
|---|---|---|
| SPEC-00 | Hướng dẫn sử dụng tài liệu, quy ước chung (Phần 0) | Đã viết |
| SPEC-01.1 | Backend Technology Stack | Draft v0.2 — chờ duyệt |
| SPEC-01.2 | Studio UI Technology Stack | Draft v0.1 — chờ duyệt |
| SPEC-02 | Quy chuẩn code & repo: cấu trúc, đặt tên, lint, Git, review | Draft v0.1 — chờ duyệt |
| SPEC-03 | Interface: Design Model, Design Operation, API REST, sự kiện WebSocket, mã lỗi | Draft v0.1 — chờ duyệt |
| SPEC-04.1 | Workspace & Studio Core (Phase 1) | Draft v0.1 — chờ duyệt |
| SPEC-04.2 | Xuất code (Phase 2) | Draft v0.1 — chờ duyệt |
| SPEC-04.3 | AI (Phase 3) | Draft v0.1 — chờ duyệt |
| SPEC-04.4 | Quét backend, Data Source, gắn dữ liệu (Phase 4) | Draft v0.1 — chờ duyệt |
| SPEC-04.5 | User Component & Design Token | Draft v0.1 — chờ duyệt |
| SPEC-05 | Bảo mật: mô hình mối đe dọa, token phiên, Host/Origin, CSP, path boundary, secrets, AI, tiến trình con, proxy, workspace trust, chuỗi cung ứng | Draft v0.1 — chờ duyệt |
| SPEC-06 | Chất lượng & kiểm thử: hạ tầng kiểm thử, fixture, benchmark, bản đồ AC-01..AC-16 | Viết dần trong thi công: SPEC-06.0 ở Phase 0, SPEC-06.*n* ở đầu Phase *n* (SPEC-07 mục 18) |
| SPEC-07 | Quy trình thi công: phase, gói công việc, lịch VG, cờ tính năng, DoR/DoD, cổng nghiệm thu, kiểm soát thay đổi spec, rủi ro, phát hành | Draft v0.1 — chờ duyệt |

---

## 0.3. Mức độ bắt buộc

| Từ khóa | Ý nghĩa |
|---|---|
| **BẮT BUỘC** | Phải tuân thủ. Vi phạm là lỗi nghiệm thu |
| **KHÔNG ĐƯỢC** | Cấm tuyệt đối |
| **NÊN** | Mặc định phải làm. Muốn làm khác phải ghi lý do trong PR |
| **CÓ THỂ** | Tùy chọn |

---

## 0.4. Mã định danh

| Tiền tố | Ý nghĩa | Ví dụ |
|---|---|---|
| `C-xx` | Ràng buộc (Constraint) | C-01 |
| `ADR-BE-xx` | Quyết định kiến trúc backend | ADR-BE-05 |
| `ADR-FE-xx` | Quyết định kiến trúc Studio UI (frontend) | ADR-FE-01 |
| `VG-xx` | Bài kiểm chứng bắt buộc (Verification Gate) | VG-01 |
| `PB-xx` | Mục ngân sách hiệu năng (Performance Budget) | PB-03 |
| `QC-xx` | Quy chuẩn code (SPEC-02) | QC-14 |
| `V-xx` | Quy tắc hợp lệ của Design Model, operation, API (SPEC-03) | V-14 |
| `E0xx` | Mã lỗi (SPEC-03 mục 13) | E010 |
| `M-xx` | Mã module (SPEC-04, module nền ở SPEC-07 mục 3.5) | M-DD |
| `R-<module>-nn` | Quy tắc xử lý của một module (SPEC-04) | R-DD-01 |
| `S-xx` | Biện pháp bảo mật (SPEC-05). Có thể có hậu tố chữ cho biện pháp con, ví dụ S-04a | S-22 |
| `A-xx`, `T-xx` | Tài sản, tác nhân đe dọa (SPEC-05) | T-01 |
| `CW-xx` | Nguyên tắc, quy tắc thi công (SPEC-07) | CW-03 |
| `WP-n.nn` | Gói công việc của phase *n* (SPEC-07) | WP-1.08 |
| `CS-n.nn-k` | Bộ thay đổi thứ *k* của gói công việc WP-n.nn (SPEC-07 mục 3.5) | CS-1.08-2 |
| `GC-xx` | Tiêu chí chung của mọi cổng nghiệm thu (SPEC-07) | GC-04 |
| `G<n>-xx` | Tiêu chí riêng của cổng phase *n* (SPEC-07) | G2-01 |
| `DR-xx`, `DW-xx` | Definition of Ready, Definition of Done của gói công việc (SPEC-07) | DR-02 |
| `RK-xx` | Rủi ro (SPEC-07) | RK-01 |
| `SEV-n` | Mức nghiêm trọng của lỗi, 1 đến 4 (SPEC-07) | SEV-2 |
| `CR-nnn` | Yêu cầu thay đổi spec (SPEC-07 mục 13.3) | CR-001 |
| `Q-xx` | Câu hỏi mở | Q-01 |
| `FR / NFR / SEC / AC` | Mã yêu cầu trong SRS (phiên bản ghi ở đầu tài liệu) | FR-11 |

Mã định danh là **duy nhất trong toàn tài liệu**. Khi phần chứa nó đã được duyệt, mã **không bao giờ dùng lại**, kể cả khi mục bị xóa. Trong bản nháp chưa duyệt, mã có thể được đánh lại.

---

## 0.5. Trạng thái ADR

| Trạng thái | Ý nghĩa |
|---|---|
| **Accepted** | Đã chốt, áp dụng ngay |
| **Accepted — chờ VG** | Đã chốt, nhưng phải qua bài kiểm chứng tương ứng trước khi viết code phụ thuộc |
| **Proposed** | Đề xuất cho phase sau, chưa áp dụng |
| **Superseded** | Đã bị thay thế bởi ADR khác |

---

## 0.6. Quy tắc cập nhật tài liệu

1. Toàn bộ spec nằm trong **một file duy nhất** này. Mỗi phần mới được thêm vào đúng vị trí theo thứ tự ở mục 0.2.
2. Mỗi phần được viết và duyệt **lần lượt**. Không viết phần sau khi phần trước còn câu hỏi ảnh hưởng trực tiếp.
3. Số mục được đánh lại **trong từng phần**. Tham chiếu trong cùng phần ghi "mục 3.2". Tham chiếu sang phần khác ghi "SPEC-01.1 mục 3.2".
4. Mọi thay đổi **BẮT BUỘC** ghi vào Lịch sử thay đổi ở cuối tài liệu và cập nhật trạng thái ở mục 0.2.
5. Sửa một quyết định đã **Accepted** thì không xóa ADR cũ. Đánh dấu **Superseded** và tạo ADR mới.
6. Phần đã ở trạng thái **Đã duyệt** chỉ được sửa theo quy trình kiểm soát thay đổi ở SPEC-07 mục 13.
7. Tài liệu này và Lịch sử thay đổi của nó chỉ ghi **đặc tả** (yêu cầu, thiết kế, quyết định). Tiến độ và kết quả thi công ghi trong báo cáo thi công riêng ở `docs/construction/` (SPEC-07 mục 12.5), không gộp vào đây.

---

# SPEC-01.1 — BACKEND TECHNOLOGY STACK

**Thuộc:** SPEC-01 — Kiến trúc kỹ thuật & Tech stack  
**Phiên bản phần:** 0.3  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0  
**Phạm vi:** Công nghệ, thư viện và quy tắc sử dụng cho ReactCraft Local Backend

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

### 1.1. Mục đích

Phần này chốt **toàn bộ công nghệ dùng cho Local Backend**: tiến trình chạy trên máy người dùng, phục vụ Studio UI, lưu bản thiết kế, đọc backend, gọi AI và xuất code.

Mỗi quyết định được ghi thành một ADR gồm: bối cảnh, quyết định, phương án đã xem xét, hệ quả, ràng buộc triển khai, điều kiện xem xét lại, truy vết SRS.

Nguyên tắc:

> Thư viện không có trong phần này thì không được dùng cho backend. Muốn thêm phải cập nhật phần này trước.

---

### 1.2. Phạm vi

**Trong phạm vi:**

- runtime, ngôn ngữ, mô hình chạy, tổ chức mã nguồn;
- HTTP server, giao thức với Studio UI;
- Design Model ở phía backend, lưu trữ workspace;
- phân tích Target Project và thư mục backend;
- sinh code, diff, ghi file, kiểm tra code xuất ra;
- theo dõi file, xử lý đồng thời;
- AI SDK, logging, cấu hình người dùng;
- build, đóng gói, kiểm thử, chất lượng code;
- ngân sách hiệu năng, bài kiểm chứng, chính sách phụ thuộc.

**Ngoài phạm vi:**

| Nội dung | Tài liệu |
|---|---|
| Công nghệ Studio UI (canvas, kéo thả, inspector) | SPEC-01.2 |
| Quy tắc đặt tên, Git, review | SPEC-02 |
| Schema chi tiết Design Model, API, message, mã lỗi | SPEC-03 |
| Thuật toán từng module (scan, codegen, export…) | SPEC-04 |
| Chi tiết bảo mật (token, Origin, path boundary, secrets) | SPEC-05 |
| Fixture, chiến lược kiểm thử chi tiết | SPEC-06 |
| Quy trình thi công | SPEC-07 |

---

## 2. BỐI CẢNH VÀ RÀNG BUỘC

| Mã | Ràng buộc | Nguồn |
|---|---|---|
| C-01 | Chạy hoàn toàn trên máy người dùng. Chức năng thiết kế, quét backend, xuất code không cần Internet. Chỉ AI provider bên ngoài và cài dependency mới cần mạng | SRS 6.1, FR-27 |
| C-02 | Đầu ra là React + TypeScript + Tailwind. Format và kiểm tra code đầu ra cần bộ công cụ JavaScript (Prettier, TypeScript, Vite) | FR-31, FR-37, FR-38 |
| C-03 | Phải đọc backend viết bằng nhiều ngôn ngữ (JS/TS, Python, sau này Java, PHP), **chỉ đọc** | FR-17, SEC-02 |
| C-04 | TypeScript 7 chưa có programmatic API ổn định, dự kiến có ở 7.1 | Hệ sinh thái |
| C-05 | Hệ điều hành phát triển chính là Windows. Hỗ trợ cả macOS và Linux | SRS 11.4 |
| C-06 | Design Model có schema chặt và được dùng ở **cả** Studio UI (trình duyệt) và backend (Node.js) | SRS 8.5 |
| C-07 | Chỉ ghi trong Workspace và Target Project. Thư mục backend chỉ đọc | SEC-02, SEC-03 |
| C-08 | Một người dùng, một phiên chỉnh sửa trên một workspace. Không có cộng tác thời gian thực | SRS 17 |
| C-09 | Nội dung thiết kế và code có tiếng Việt và ký tự Unicode | Môi trường dự án |
| C-10 | Chỉ tiêu hiệu năng NFR-01 đến NFR-05 | SRS 11.1 |

---

## 3. KIẾN TRÚC RUNTIME

### 3.1. Sơ đồ process

```text
                 Trình duyệt
        ┌──────────────────────────────┐
        │ ReactCraft Studio UI         │
        │ (SPEC-01.2)                  │
        └──────────────┬───────────────┘
                       │ HTTP (REST JSON) + WebSocket
                       │ 127.0.0.1:<port>, token phiên
┌──────────────────────▼───────────────────────────────────────┐
│ Node.js process: reactcraft (CLI)                            │
│                                                              │
│  adapters/http  (Fastify: REST, WebSocket, static Studio UI) │
│        │                                                     │
│  core/                                                       │
│   workspace · design-store · target-project ·                │
│   backend-context · ai · codegen · export · validation       │
│        │                                                     │
│  @reactcraft/model (schema, operations, migrations)          │
│        │                                                     │
│  Worker pool (piscina): backend scan · TS type check         │
└──────┬──────────────┬───────────────┬──────────────┬─────────┘
       │ đọc/ghi      │ chỉ đọc       │ ghi khi xuất │ HTTPS
       ▼              ▼               ▼              ▼
   Workspace     Thư mục backend   Target Project   AI Providers
   .reactcraft/                    (child process:  (Ollama: localhost)
                                    vite build)
```

---

### 3.2. Nguyên tắc phân lớp

**BẮT BUỘC:**

1. `packages/model/` **KHÔNG ĐƯỢC** import module Node (`node:*`), API trình duyệt (DOM), hay bất kỳ package nào ngoài `zod` và `nanoid`. Nó chạy được ở cả hai môi trường.
2. `packages/server/src/core/` **KHÔNG ĐƯỢC** import `fastify`, `chokidar`, hay bất cứ thứ gì trong `adapters/`. Core giao tiếp ra ngoài qua **port** khai báo trong `core/ports/`.
3. `adapters/` hiện thực các port bằng thư viện cụ thể.
4. Các quy tắc trên được kiểm tra tự động bằng ESLint `no-restricted-imports` (ADR-BE-27).

Port tối thiểu (chữ ký chính thức ở SPEC-03):

```ts
// packages/server/src/core/ports/ — phác thảo
interface FileSystemPort  { read; readDir; stat; writeAtomic; remove; }
interface FileWatcherPort { watch(root, options): Subscription; }
interface EventBusPort    { publish(event): void; }          // đẩy sự kiện xuống UI
interface ProcessPort     { run(cmd, args, options): Promise<ProcessResult>; }
interface AIPort          { generateOperations(request): Promise<AIResult>; }
interface LoggerPort      { info; warn; error; debug; }
```

---

### 3.3. Cấu trúc mã nguồn

```text
reactcraft/                      # pnpm workspace (monorepo)
├── packages/
│   ├── model/                   # @reactcraft/model — dùng chung UI và server
│   │   └── src/
│   │       ├── schema/          # Zod schema: node, props, token, page, data source
│   │       ├── operations/      # Design Operation: apply, invert, validate
│   │       ├── migrations/      # nâng cấp schema giữa các phiên bản
│   │       ├── mock/            # sinh dữ liệu mẫu theo kiểu field (SPEC-03 mục 6)
│   │       ├── styling/         # ánh xạ thuộc tính → class Tailwind (dùng chung Canvas và codegen, SPEC-01.2 ADR-FE-06)
│   │       ├── analysis/        # phân tích thiết kế: gợi ý layout dùng chung (SPEC-04.5 mục 6a)
│   │       └── features.ts      # cờ tính năng theo phase (SPEC-07 mục 3.4)
│   ├── server/                  # Local Backend
│   │   └── src/
│   │       ├── core/
│   │       │   ├── ports/
│   │       │   ├── workspace/       # mở, khóa, cấu hình liên kết
│   │       │   ├── design-store/    # đọc, ghi, sao lưu Design Document
│   │       │   ├── target-project/  # phát hiện React, Vite, Tailwind, quy ước
│   │       │   ├── backend-context/ # quét backend, Data Source Catalog
│   │       │   ├── ai/              # context builder, gateway
│   │       │   ├── codegen/         # IR, emitter React, emitter HTML
│   │       │   ├── export/          # diff, transaction, manifest, xung đột
│   │       │   ├── validation/      # kiểm tra code xuất ra
│   │       │   └── shared/
│   │       ├── adapters/
│   │       │   ├── http/            # Fastify: route, WebSocket, static
│   │       │   ├── fs/
│   │       │   ├── watcher/
│   │       │   ├── process/
│   │       │   └── ai/
│   │       └── workers/
│   ├── studio/                  # Studio UI (SPEC-01.2)
│   └── cli/                     # lệnh `reactcraft`
├── templates/                   # template Target Project mới (ADR-BE-05)
└── fixtures/                    # backend mẫu, project mẫu (SPEC-06)
```

Thư mục con theo từng module và quyền sở hữu thư mục: SPEC-07 mục 3.5.

---

## 4. BẢNG TỔNG HỢP CÔNG NGHỆ

| Lớp | Công nghệ | ADR | Trạng thái |
|---|---|---|---|
| Runtime | Node.js ≥ 22.12, khuyến nghị 24 LTS | ADR-BE-01 | Accepted |
| Ngôn ngữ | TypeScript 6.x, `strict`, ESM | ADR-BE-02 | Accepted |
| Mô hình chạy | Server local độc lập, khởi động bằng CLI | ADR-BE-03 | Accepted |
| Tổ chức mã | pnpm workspace, `@reactcraft/model` dùng chung | ADR-BE-04 | Accepted |
| Tương thích | React 18/19, Vite 7/8, Tailwind v3/v4 | ADR-BE-05 | Accepted — chờ VG-03 |
| HTTP server | Fastify 5 + `@fastify/websocket` + `@fastify/static` | ADR-BE-06 | Accepted — chờ VG-07 |
| Giao thức | REST JSON + WebSocket event | ADR-BE-07 | Accepted |
| Schema | Zod 4 | ADR-BE-08 | Accepted |
| Design Model runtime | Operation-based, engine dùng chung | ADR-BE-09 | Accepted |
| Định danh | `nanoid` | ADR-BE-10 | Accepted |
| Lưu workspace | JSON tách file, ghi nguyên tử, sao lưu, migration | ADR-BE-11 | Accepted |
| Phân tích JS/TS | `oxc-parser` + `estree-walker` | ADR-BE-12 | Accepted |
| Phân tích đa ngôn ngữ | `web-tree-sitter` (Python trước) | ADR-BE-13 | Accepted — chờ VG-05 |
| OpenAPI | `@apidevtools/swagger-parser` + `yaml` | ADR-BE-14 | Accepted — chờ VG-04 |
| Duyệt file | `tinyglobby` + `ignore` | ADR-BE-15 | Accepted |
| Sinh code | IR riêng + emitter + Prettier | ADR-BE-16 | Accepted — chờ VG-02 |
| Diff | `diff` (jsdiff) | ADR-BE-17 | Accepted |
| Ghi file, transaction | `write-file-atomic` + retry + export manifest | ADR-BE-18 | Accepted — chờ VG-01 |
| Kiểm tra code xuất | oxc → TypeScript 6 API → `vite build` (tùy chọn) | ADR-BE-19 | Accepted — chờ VG-08 |
| Theo dõi file | `chokidar` | ADR-BE-20 | Accepted |
| Đồng thời | `p-queue` + `piscina` | ADR-BE-21 | Accepted |
| AI SDK | Vercel AI SDK (`ai`) | ADR-BE-22 | Accepted — chờ VG-06 |
| Logging | `pino` (tích hợp Fastify) | ADR-BE-23 | Accepted |
| Cấu hình người dùng | `env-paths`, file cấu hình riêng | ADR-BE-24 | Accepted |
| Build, đóng gói | tsdown + Vite, phát hành 1 package | ADR-BE-25 | Accepted |
| Kiểm thử | Vitest + Playwright + golden file | ADR-BE-26 | Accepted |
| Chất lượng code | ESLint + typescript-eslint + Prettier | ADR-BE-27 | Accepted |

**Quy tắc phiên bản:** dùng bản ổn định mới nhất tại thời điểm khởi tạo repo, ghim chính xác trong `pnpm-lock.yaml` và ghi vào mục 13.3.

---

## 5. ADR — NỀN TẢNG

### ADR-BE-01 — Runtime: Node.js

**Trạng thái:** Accepted

#### Bối cảnh

Backend phải format code bằng Prettier, kiểm tra bằng TypeScript, build thử bằng Vite của Target Project (C-02), và chia sẻ Design Model với Studio UI viết bằng TypeScript (C-06).

#### Quyết định

- Runtime: **Node.js**, tối thiểu **22.12**, khuyến nghị **24 LTS**.
- `package.json`: `"engines": { "node": ">=22.12" }`.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Bun | Tương thích Node chưa tuyệt đối với các công cụ cần dùng (TypeScript API, worker, Prettier plugin). Bắt người dùng cài thêm runtime |
| Deno | Tương thích hệ sinh thái npm kém hơn |
| Java / C# / Go / Python | Không chạy trực tiếp được Prettier, TypeScript, Vite. Không dùng chung được Design Model với UI. Phải gọi chéo process |

#### Hệ quả

- (+) Một ngôn ngữ cho UI, server, model dùng chung.
- (+) Dùng trực tiếp bộ công cụ của chính đầu ra (React/TS).
- (−) Đơn luồng. Tác vụ nặng phải vào worker (ADR-BE-21).

#### Ràng buộc triển khai

1. **BẮT BUỘC** import module lõi có tiền tố `node:`.
2. **KHÔNG ĐƯỢC** dùng API đồng bộ của `fs` trên luồng chính, trừ lúc khởi động CLI.
3. **BẮT BUỘC** dùng `AbortSignal` cho tác vụ hủy được: quét backend, type check, AI request, export.
4. **BẮT BUỘC** xử lý đường dẫn bằng `node:path`. So sánh đường dẫn trên Windows **BẮT BUỘC** không phân biệt hoa thường.

#### Điều kiện xem xét lại

Node 22 hết hạn hỗ trợ (nâng mức tối thiểu).

#### Truy vết

C-01, C-02, C-06.

---

### ADR-BE-02 — Ngôn ngữ: TypeScript 6.x, strict, ESM

**Trạng thái:** Accepted

#### Bối cảnh

Backend cần TypeScript programmatic API để kiểm tra code xuất ra (FR-37). TypeScript 7 chưa có API ổn định (C-04).

#### Quyết định

- **TypeScript 6.x** cho toàn bộ mã nguồn ReactCraft và cho việc kiểm tra code xuất ra.
- **ESM thuần**, `"type": "module"`.
- `tsconfig` gốc **BẮT BUỘC** có tối thiểu:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

`packages/model` và `packages/studio` dùng `"module": "ESNext"`, `"moduleResolution": "Bundler"`.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| TypeScript 7.x | Chưa có programmatic API |
| JavaScript + JSDoc | Kiểm tra kiểu yếu hơn, AI sinh code kém an toàn hơn |
| CommonJS | Hệ sinh thái hiện tại là ESM |

#### Ràng buộc triển khai

1. **KHÔNG ĐƯỢC** dùng `any`. Dữ liệu chưa rõ kiểu dùng `unknown` rồi parse bằng Zod.
2. **KHÔNG ĐƯỢC** dùng `@ts-ignore`. Trường hợp bất khả kháng dùng `@ts-expect-error` kèm lý do.
3. Kiểu đi qua ranh giới module **BẮT BUỘC** suy ra từ schema Zod (`z.infer`).

#### Điều kiện xem xét lại

TypeScript 7.1 có programmatic API ổn định và typescript-eslint hỗ trợ.

#### Truy vết

FR-37, C-04.

---

### ADR-BE-03 — Mô hình chạy: server local độc lập

**Trạng thái:** Accepted

#### Bối cảnh

SRS v4.0 không còn chèn vào app đang chạy. Studio là ứng dụng riêng, cần một backend đọc/ghi file trên máy.

#### Quyết định

- Người dùng chạy lệnh:

```text
npx reactcraft            # mở workspace ở thư mục hiện tại
npx reactcraft <thư mục>  # mở workspace ở thư mục chỉ định
```

- CLI khởi động server Node.js, chọn cổng trống, lắng nghe **chỉ trên `127.0.0.1`**, sinh token phiên, rồi mở trình duyệt tới Studio UI.
- Server phục vụ cả Studio UI (file tĩnh đã build) và API trên **cùng một origin**.
- Tham số dòng lệnh đọc bằng `node:util` `parseArgs`. Mở trình duyệt bằng package `open`.

Tham số CLI tối thiểu:

| Tham số | Ý nghĩa | Mặc định |
|---|---|---|
| `[dir]` | Thư mục workspace | Thư mục hiện tại |
| `--port` | Cổng | Tự chọn cổng trống |
| `--no-open` | Không tự mở trình duyệt | Mở |
| `--log-level` | Mức log | `info` |

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Vite plugin (như bản nháp 0.1) | Không còn phù hợp: Studio không chạy trong app của người dùng |
| Ứng dụng desktop (Electron, Tauri) | Non-goal của SRS. Đóng gói nặng, phức tạp |
| Trình duyệt dùng File System Access API, không cần backend | Không chạy được Prettier plugin, TypeScript check, `vite build`, worker. Chỉ hỗ trợ Chromium |

#### Hệ quả

- (+) Một lệnh là chạy. Không phụ thuộc cấu hình của project người dùng.
- (+) Studio UI và API cùng origin, đơn giản hóa bảo mật.
- (−) Mở một cổng local, phải bảo vệ (SPEC-05).

#### Ràng buộc triển khai

1. **BẮT BUỘC** chỉ lắng nghe `127.0.0.1`. **KHÔNG ĐƯỢC** lắng nghe `0.0.0.0` hay `::`.
2. **BẮT BUỘC** mọi request API và kết nối WebSocket có token phiên hợp lệ và Origin đúng (chi tiết SPEC-05).
3. **BẮT BUỘC** tắt sạch khi nhận `SIGINT`/`SIGTERM`: hoàn tất ghi file đang dở, dừng worker, giải phóng khóa workspace.
4. **BẮT BUỘC** chỉ cho mở **một** server trên một workspace tại một thời điểm (khóa workspace, ADR-BE-11).

#### Điều kiện xem xét lại

Cần bản desktop, hoặc cần chạy Studio từ xa.

#### Truy vết

FR-01, SEC-01, C-01, C-08.

---

### ADR-BE-04 — Tổ chức mã nguồn: monorepo, model dùng chung

**Trạng thái:** Accepted

#### Bối cảnh

Design Model, schema và Design Operation phải giống hệt nhau ở Studio UI (áp dụng ngay khi người dùng thao tác) và ở backend (kiểm tra, lưu, AI, sinh code) (C-06).

#### Quyết định

- Mã nguồn tổ chức thành **pnpm workspace** gồm 4 package: `model`, `server`, `studio`, `cli` (mục 3.3).
- `@reactcraft/model` là **nguồn duy nhất** của schema, Design Operation, migration.
- **Phát hành một package npm duy nhất** `reactcraft`, gom cả 4 package khi build (ADR-BE-25).

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Một package, một thư mục `src/` | Khó giữ ranh giới: code trình duyệt dễ vô tình import `node:*` |
| Sao chép schema sang UI | Hai bản lệch nhau là nguồn lỗi chắc chắn |
| Phát hành nhiều package | Chưa có nhu cầu dùng riêng từng phần |

#### Ràng buộc triển khai

1. Mọi thay đổi schema **BẮT BUỘC** làm trong `@reactcraft/model` và tăng `schemaVersion` kèm migration (ADR-BE-11).
2. `@reactcraft/model` **BẮT BUỘC** có độ phủ test ≥ 90% dòng lệnh.

#### Truy vết

SRS 8.5, FR-14, FR-25, C-06.

---

### ADR-BE-05 — Ma trận tương thích

**Trạng thái:** Accepted — chờ VG-03

#### Quyết định

**Target Project (nơi xuất code):**

| Thành phần | Hỗ trợ |
|---|---|
| React | 18.x, 19.x |
| Vite | 7.x, 8.x |
| Ngôn ngữ | TypeScript 5.x, 6.x hoặc JavaScript (SPEC-04.2 mục 6.9) |
| Tailwind CSS | v3.4 trở lên, v4 (cần biến thể `max-*` cho chế độ desktop-first) |
| Package manager | pnpm, npm, yarn, bun (chỉ để phát hiện và gợi ý lệnh) |

**Tạo Target Project mới (FR-03):** từ template nội bộ trong `templates/` (Vite 8 + React 19 + TypeScript + Tailwind v4). **KHÔNG** gọi `create-vite` qua mạng. Cài dependency là bước riêng, cần người dùng đồng ý (SEC-08).

**Backend được quét (FR-17):**

| Nguồn | Phase |
|---|---|
| OpenAPI 3.0, 3.1, Swagger 2.0 (JSON/YAML) | Phase 4 |
| Express, NestJS (JS/TS) | Phase 4 |
| Django, Django REST Framework (Python) | Phase 4 |
| Spring, Laravel, framework khác | Phase 5 hoặc qua AI |

**Môi trường chạy Studio:** Windows 10/11, macOS 13+, Ubuntu 22.04+. Trình duyệt Chrome, Edge, Firefox bản ổn định.

#### Ràng buộc triển khai

1. CI **BẮT BUỘC** chạy kiểm thử xuất code trên hai Target Project mẫu: Vite 8 + React 19 + Tailwind v4, và Vite 7 + React 18 + Tailwind v3.

#### Truy vết

FR-03, FR-17, FR-31, SRS 11.4.

---

## 6. ADR — SERVER VÀ GIAO TIẾP

### ADR-BE-06 — HTTP server: Fastify 5

**Trạng thái:** Accepted — chờ VG-07

#### Quyết định

- **Fastify 5** làm HTTP server.
- **`@fastify/websocket`** cho kênh sự kiện.
- **`@fastify/static`** phục vụ Studio UI đã build.
- Kiểm tra token và Origin bằng hook `onRequest` dùng chung cho mọi route và WebSocket.

#### Phương án đã xem xét

| Phương án | Điểm mạnh | Lý do không chọn |
|---|---|---|
| Hono | Nhẹ, theo Web Standard, có client có kiểu | Hỗ trợ WebSocket trên Node qua adapter riêng, ít được dùng thực tế hơn |
| Express 5 | Phổ biến nhất | Chậm hơn, hệ thống hook và schema yếu hơn |
| `node:http` thuần | Không phụ thuộc | Phải tự làm routing, static, WebSocket, logging |
| tRPC | Kiểu dữ liệu xuyên suốt | Thêm lớp trừu tượng. Zod schema dùng chung đã đủ đảm bảo kiểu |

#### Hệ quả

- (+) Ổn định, nhanh, hệ thống hook rõ ràng cho bảo mật.
- (+) Tích hợp sẵn `pino` (ADR-BE-23).
- (−) Gắn với Fastify, nhưng chỉ trong `adapters/http`.

#### Ràng buộc triển khai

1. Route **BẮT BUỘC** chỉ là lớp mỏng: parse request bằng Zod, gọi core, trả kết quả. **KHÔNG ĐƯỢC** chứa logic nghiệp vụ.
2. **BẮT BUỘC** giới hạn kích thước body (mặc định 10 MB).

#### Truy vết

FR-01, SEC-01.

---

### ADR-BE-07 — Giao thức Studio UI ↔ Backend

**Trạng thái:** Accepted

#### Quyết định

| Kênh | Dùng cho |
|---|---|
| **REST JSON** dưới `/api/v1/*` | Lệnh có phản hồi: mở workspace, lưu operation, quét backend, yêu cầu AI, xem trước và thực hiện export |
| **WebSocket** tại `/api/v1/events` | Sự kiện từ server: tiến độ quét, luồng phản hồi AI, file thay đổi bên ngoài, kết quả kiểm tra code |

Dạng sự kiện WebSocket (schema chính thức ở SPEC-03):

```json
{
  "v": 1,
  "type": "scan.progress",
  "correlationId": "req_8fK2pQ",
  "payload": { "done": 120, "total": 450 }
}
```

#### Ràng buộc triển khai

1. Mọi request và sự kiện **BẮT BUỘC** có schema Zod trong `@reactcraft/model` hoặc `server/core/shared/schema`.
2. Lỗi trả về **BẮT BUỘC** theo một dạng chung có mã lỗi E0xx (SPEC-03).
3. Tác vụ dài (quét, AI, export) **BẮT BUỘC** trả `correlationId` ngay, tiến độ đi qua WebSocket, và hủy được qua API.
4. Phiên bản giao thức nằm trong đường dẫn (`/v1`) và trường `v` của sự kiện.
5. Server **KHÔNG ĐƯỢC** trả câu thông báo đã dịch. Lỗi chỉ gồm mã E0xx và tham số. Studio UI dịch theo ngôn ngữ đang dùng (SPEC-01.2 ADR-FE-16).

#### Truy vết

FR-18, FR-26, FR-35, NFR-08.

---

### ADR-BE-08 — Schema và validate: Zod 4

**Trạng thái:** Accepted

#### Quyết định

**Zod 4** cho mọi dữ liệu đi qua ranh giới:

- Design Model và Design Operation;
- request, response, sự kiện;
- file workspace đọc từ disk;
- cấu hình người dùng;
- output của AI (sinh JSON Schema cho AI bằng `z.toJSONSchema()`).

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Valibot | Nhỏ hơn, nhưng AI SDK hỗ trợ Zod tốt hơn |
| TypeBox + Ajv | Phải duy trì kiểu và schema theo hai hướng |

#### Ràng buộc triển khai

1. **BẮT BUỘC** dùng `safeParse`. Dữ liệu không hợp lệ trả lỗi có mã, không ném exception khỏi handler.
2. Schema của Design Model **BẮT BUỘC** chặt (`strict`): field lạ là lỗi, không bị bỏ qua âm thầm.

#### Truy vết

SRS 8.5, FR-25, E004, E005, E007.

---

## 7. ADR — DESIGN MODEL VÀ WORKSPACE

### ADR-BE-09 — Design Model runtime: operation-based

**Trạng thái:** Accepted

#### Bối cảnh

Kéo thả, Inspector, AI đều sửa Design Model (SRS 6.2). Cần Undo/Redo cho mọi thao tác kể cả AI (FR-14). Studio UI phải phản hồi ngay (NFR-02), backend phải kiểm tra và lưu.

#### Quyết định

- Mọi thay đổi là một **Design Operation** định nghĩa trong `@reactcraft/model`.
- Mỗi operation có ba hàm thuần: `validate(doc, op)`, `apply(doc, op)`, `invert(doc, op)` (sinh operation đảo ngược để Undo).
- Nhóm operation thành **transaction thiết kế** (ví dụ một đề xuất AI gồm 12 operation là một lần Undo).

Luồng:

```text
Studio UI: validate → apply ngay (optimistic) → ghi vào Undo stack
     │  gửi batch operation (kèm baseRevision)
     ▼
Server: validate lại bằng cùng engine → apply → tăng revision → lưu (debounce)
     │  nếu từ chối: trả lỗi E005 (operation sai) hoặc E017 (revision cũ)
     ▼
Studio UI: hoàn tác batch bị từ chối, báo lỗi
```

- Server là nơi giữ **bản chính** của Design Document. UI giữ bản làm việc.
- `revision` là số nguyên tăng dần. Batch có `baseRevision` khác revision của server thì bị từ chối với E017 (chống lệch trạng thái, SPEC-03 V-52).

Tập operation tối thiểu (định nghĩa chi tiết ở SPEC-03):

| Operation | Ý nghĩa |
|---|---|
| `insert` | Thêm node vào vị trí trong container |
| `remove` | Xóa node (kèm cây con) |
| `move` | Di chuyển node sang container hoặc vị trí khác |
| `setProps` | Đặt thuộc tính (theo breakpoint, trạng thái) |
| `setBinding` | Gắn hoặc gỡ Binding |
| `setText` | Đổi nội dung chữ |
| `wrap` / `unwrap` | Bọc nhóm node vào container, bỏ bọc |
| `page.*`, `token.*`, `component.*` | Thao tác trên trang, token, User Component |

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| CRDT (Yjs, Automerge) | Dành cho cộng tác nhiều người, là non-goal (C-08). Khó kiểm soát schema chặt |
| Gửi cả Design Document mỗi lần lưu | Tốn băng thông, mất ngữ nghĩa thao tác, khó Undo theo nhóm |
| Immer patches | Patch theo đường dẫn JSON, không mang ngữ nghĩa thiết kế, AI khó sinh đúng |

#### Hệ quả

- (+) AI trả về đúng định dạng operation người dùng tạo ra (FR-25). Một bộ kiểm tra cho cả hai.
- (+) Undo/Redo đồng nhất cho thao tác tay và AI.
- (−) Mỗi operation mới phải viết đủ `validate`, `apply`, `invert` kèm test.

#### Ràng buộc triển khai

1. `apply` **BẮT BUỘC** là hàm thuần, trả document mới, không sửa document cũ.
2. Với mọi operation hợp lệ: `apply(apply(doc, op), invert(doc, op))` **BẮT BUỘC** bằng `doc`. Kiểm tra bằng property-based test.
3. **KHÔNG ĐƯỢC** sửa Design Model ngoài con đường operation.

#### Truy vết

SRS 6.2, 8.5, FR-07, FR-09, FR-14, FR-25, FR-26.

---

### ADR-BE-10 — Định danh: nanoid

**Trạng thái:** Accepted

#### Quyết định

- ID dùng **`nanoid`**, 10 ký tự, kèm tiền tố theo loại:

| Loại | Tiền tố | Ví dụ |
|---|---|---|
| Node | `n_` | `n_V1StGXR8_Z` |
| Page | `p_` | `p_4f90d13a2b` |
| User Component | `c_` | `c_9kLm2xQw7e` |
| Token | `t_` | `t_Qw3rTy8uIo` |
| Data Source | `ds_` | `ds_products` (dùng tên entity nếu duy nhất) |

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| UUID (`crypto.randomUUID`) | 36 ký tự, tốn token khi gửi cho AI |
| ULID | Không cần thứ tự thời gian |
| Số tăng dần | Dễ trùng khi gộp, AI dễ bịa |

#### Ràng buộc triển khai

1. ID **KHÔNG ĐƯỢC** đổi khi node bị di chuyển hay sửa (SRS 8.5).
2. ID do AI đề xuất cho node mới **BẮT BUỘC** bị thay bằng ID do hệ thống sinh khi áp dụng.

#### Truy vết

SRS 8.5, FR-25.

---

### ADR-BE-11 — Lưu trữ workspace

**Trạng thái:** Accepted

#### Quyết định

Cấu trúc thư mục workspace:

```text
<workspace>/
└── .reactcraft/
    ├── workspace.json          # metadata, schemaVersion, liên kết project, backend
    ├── tokens.json
    ├── pages/
    │   └── <pageId>.json
    ├── components/
    │   └── <componentId>.json
    ├── data-sources.json       # Data Source Catalog đã duyệt
    ├── export-manifest.json    # dấu vết lần xuất (ADR-BE-18)
    ├── backups/                # bản sao lưu xoay vòng
    ├── assets/                 # ảnh người dùng thêm vào thiết kế
    ├── cache/                  # cache quét backend, có thể xóa
    └── lock                    # khóa phiên (PID, thời điểm)
```

| Quy tắc | Giá trị |
|---|---|
| Định dạng | JSON, thụt lề 2 dấu cách, thứ tự key ổn định, xuống dòng LF, UTF-8 không BOM |
| Lưu tự động | Debounce 500 ms sau thay đổi cuối, tối đa 2 s (NFR-06) |
| Ghi file | Nguyên tử (ADR-BE-18) |
| Sao lưu | Giữ 20 bản gần nhất mỗi file trong `backups/` |
| Migration | Khi `schemaVersion` cũ hơn: sao lưu, chạy chuỗi migration, ghi lại |
| Khóa phiên | File `lock` chứa PID. Khóa của process đã chết thì được thu hồi |

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Một file JSON duy nhất | Xung đột Git nặng, ghi lại toàn bộ khi sửa một trang |
| SQLite | File nhị phân, không đọc và diff được bằng Git, thêm binary native |
| YAML | Chậm hơn, dễ sai thụt lề |

#### Ràng buộc triển khai

1. File đọc vào **BẮT BUỘC** validate bằng Zod. File hỏng thì đề nghị khôi phục từ `backups/` (NFR-07).
2. **BẮT BUỘC** tạo `.reactcraft/.gitignore` loại trừ `backups/`, `cache/`, `lock`.
3. Thứ tự key ổn định để diff Git chỉ thể hiện thay đổi thật.

#### Truy vết

FR-01, FR-02, NFR-03, NFR-06, NFR-07, SRS 8.5.

---

## 8. ADR — PHÂN TÍCH MÃ NGUỒN

### ADR-BE-12 — Phân tích JS/TS: oxc-parser + estree-walker

**Trạng thái:** Accepted

#### Bối cảnh

Cần đọc mã JS/TS ở hai nơi: Target Project (phát hiện quy ước, alias, cấu hình Tailwind v3) và backend Node (Express, NestJS). Cũng dùng để kiểm tra cú pháp code sinh ra (ADR-BE-19).

#### Quyết định

- Parser: **`oxc-parser`** (JS, JSX, TS, TSX, AST chuẩn ESTree, có sẵn thông tin import/export).
- Duyệt AST: **`estree-walker`**.
- Mọi lời gọi parser đi qua một module duy nhất `core/shared/parse-js.ts`.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| `@babel/parser` | Chậm hơn, phụ thuộc nặng. Giữ làm dự phòng |
| TypeScript Compiler API | Chậm khi chỉ cần cú pháp. Chỉ dùng cho type check |
| `@swc/core` | Vị trí theo byte, có thể cộng dồn giữa các lần parse |

#### Ràng buộc triển khai

1. Lỗi cú pháp **KHÔNG ĐƯỢC** ném exception, trả trong kết quả.
2. **KHÔNG ĐƯỢC** giữ AST lâu hơn một tác vụ. Chỉ lưu dữ liệu đã trích xuất.
3. Package có binary native **BẮT BUỘC** có bản dựng sẵn cho win32-x64, darwin-arm64, darwin-x64, linux-x64.

#### Truy vết

FR-03, FR-17, FR-37, FR-38.

---

### ADR-BE-13 — Phân tích đa ngôn ngữ: web-tree-sitter

**Trạng thái:** Accepted — chờ VG-05

#### Bối cảnh

Backend có thể viết bằng Python (Django), sau này Java, PHP (C-03). Cần một cách đọc cấu trúc mã ổn định, không cần cài trình biên dịch.

#### Quyết định

- **`web-tree-sitter`** (bản WebAssembly) cùng file grammar `.wasm` cho từng ngôn ngữ.
- Phase 4: grammar **Python**. Ngôn ngữ khác thêm ở Phase 5 bằng cách bổ sung grammar và bộ trích xuất.
- Truy vấn cấu trúc bằng **tree-sitter query** (file `.scm`) đặt trong `core/backend-context/extractors/<framework>/`.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Binding native `tree-sitter` | Cần biên dịch native trên máy người dùng, hay lỗi trên Windows |
| Regex | Dễ sai với code thật, không bảo trì được |
| Chạy Python/Java để phân tích | Bắt người dùng có môi trường chạy backend. Có thể thực thi code của backend, vi phạm nguyên tắc chỉ đọc |
| Chỉ dùng AI đọc code | Tốn chi phí, kết quả không ổn định. Giữ làm lớp cuối (FR-17) |

#### Ràng buộc triển khai

1. File grammar `.wasm` **BẮT BUỘC** đóng gói kèm package, không tải qua mạng lúc chạy.
2. Mỗi kết quả trích xuất **BẮT BUỘC** có mức tin cậy và nguồn (file, dòng) theo FR-17.
3. Phân tích chạy trong worker (ADR-BE-21).

#### Truy vết

FR-17, NFR-04, C-03.

---

### ADR-BE-14 — OpenAPI: swagger-parser + yaml

**Trạng thái:** Accepted — chờ VG-04

#### Quyết định

- Đọc và giải tham chiếu (`$ref`) file OpenAPI bằng **`@apidevtools/swagger-parser`**.
- Đọc YAML bằng **`yaml`**.
- Hỗ trợ OpenAPI 3.0, 3.1, Swagger 2.0. Swagger 2.0 được quy đổi sang cùng dạng nội bộ với 3.x.

#### Ràng buộc triển khai

1. **KHÔNG ĐƯỢC** tải `$ref` trỏ ra URL bên ngoài. Chỉ giải tham chiếu nội bộ và file trong thư mục backend.
2. Tham chiếu vòng **BẮT BUỘC** được xử lý mà không treo.

#### Truy vết

FR-17, FR-18.

---

### ADR-BE-15 — Duyệt file: tinyglobby + ignore

**Trạng thái:** Accepted

#### Quyết định

- Liệt kê file bằng **`tinyglobby`**.
- Tôn trọng `.gitignore` của backend và Target Project bằng **`ignore`**.
- Danh sách loại trừ mặc định (bổ sung ở SPEC-05):

```text
node_modules/  .git/  dist/  build/  .venv/  venv/  __pycache__/
.env  .env.*  *.pem  *.key  *.p12  *.pfx  id_rsa*  credentials*  secrets*
```

#### Ràng buộc triển khai

1. File thuộc danh sách secrets **KHÔNG ĐƯỢC** đọc nội dung, kể cả để kiểm tra (FR-21, SEC-05).
2. **KHÔNG ĐƯỢC** đi theo symbolic link ra ngoài thư mục gốc được liên kết.
3. Giới hạn kích thước file đọc (mặc định 1 MB). File lớn hơn bị bỏ qua và ghi log.

#### Truy vết

FR-17, FR-21, SEC-03, SEC-05, NFR-04.

---

## 9. ADR — SINH CODE VÀ XUẤT

### ADR-BE-16 — Sinh code: IR riêng + emitter + Prettier

**Trạng thái:** Accepted — chờ VG-02

#### Bối cảnh

Code xuất ra phải sạch như người viết (SRS 6.5, NFR-10 đến NFR-13) và theo quy ước của Target Project (FR-38).

#### Quyết định

Sinh code qua ba bước:

```text
Design Model + Data Sources + Conventions
   ↓  (1) Lowering
Code IR: cây file → component → JSX element, props, imports, hooks
   ↓  (2) Emit
Chuỗi mã nguồn: React/TSX + Tailwind  |  HTML + CSS
   ↓  (3) Format
Prettier (cấu hình của Target Project nếu có)
```

| Bước | Công nghệ | Ghi chú |
|---|---|---|
| Lowering | Code TypeScript thuần trong `core/codegen/` | Quyết định tách component, đặt tên. Ánh xạ thuộc tính sang class Tailwind **BẮT BUỘC** dùng `@reactcraft/model/styling`, chung với Canvas (SPEC-01.2 ADR-FE-06) |
| Emit | Emitter viết tay, sinh chuỗi | Mỗi đích (React, HTML) một emitter, dùng chung IR |
| Format | **`prettier`** | Dùng `.prettierrc` của Target Project. Có `prettier-plugin-tailwindcss` trong project thì dùng để sắp xếp class |

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Template engine (Handlebars, EJS) | Khó kiểm soát cấu trúc lồng nhau, dễ sinh code sai cú pháp |
| `ts.factory` + printer của TypeScript | Rất dài dòng, format kém, không hỗ trợ cấu hình Prettier |
| Babel generator | Không theo cấu hình format của project |
| Để AI sinh code trực tiếp | Không xác định, không lặp lại được, vi phạm nguyên tắc "AI sửa thiết kế, không sửa code" |

#### Hệ quả

- (+) Cùng một Design Model luôn sinh cùng một code (xác định), test bằng golden file được.
- (+) Thêm đích xuất mới chỉ cần thêm emitter.
- (−) Phải tự viết bảng ánh xạ thuộc tính → class Tailwind cho cả v3 và v4.

#### Ràng buộc triển khai

1. Sinh code **BẮT BUỘC** xác định: cùng đầu vào cho cùng đầu ra từng byte.
2. Giá trị không có trong token và thang Tailwind **BẮT BUỘC** dùng giá trị tùy ý (ví dụ `p-[13px]`), **KHÔNG ĐƯỢC** dùng `style` inline, trừ thuộc tính Tailwind không biểu diễn được.
3. Code xuất ra **KHÔNG ĐƯỢC** import bất cứ thứ gì từ `reactcraft` (NFR-12).
4. Plugin Prettier của Target Project được nạp từ `node_modules` của chính project đó. Không có thì dùng cấu hình mặc định của ReactCraft.

#### Truy vết

FR-31, FR-32, FR-33, FR-34, FR-38, NFR-05, NFR-10 đến NFR-13.

---

### ADR-BE-17 — Diff: jsdiff

**Trạng thái:** Accepted

#### Quyết định

- Tính diff bằng package **`diff`** (jsdiff), dạng unified diff theo dòng.
- Server gửi cho UI: nội dung cũ, nội dung mới, các hunk. UI chịu trách nhiệm hiển thị (SPEC-01.2).

#### Ràng buộc triển khai

1. So sánh **BẮT BUỘC** chuẩn hóa xuống dòng (CRLF/LF) trước khi tính diff để không báo thay đổi giả. Nhưng file ghi ra **BẮT BUỘC** giữ kiểu xuống dòng của file gốc (nếu có) hoặc theo `.editorconfig`/Prettier `endOfLine` của project.

#### Truy vết

FR-35.

---

### ADR-BE-18 — Ghi file, transaction, export manifest

**Trạng thái:** Accepted — chờ VG-01

#### Quyết định

**Ghi file:** **`write-file-atomic`** (ghi file tạm rồi rename), bọc thêm lớp retry cho Windows khi gặp `EPERM`, `EBUSY`, `EACCES`:

| Lần thử | Chờ trước khi thử |
|---|---|
| 1 | 0 ms |
| 2 | 25 ms |
| 3 | 50 ms |
| 4 | 100 ms |
| 5 | 200 ms |

**Transaction export:**

```text
Lập kế hoạch (danh sách file + nội dung)
   ↓
Kiểm tra xung đột với export-manifest
   ↓
Snapshot nội dung hiện tại của mọi file sẽ bị ghi
   ↓
Ghi lần lượt
   ↓  lỗi bất kỳ
Rollback: khôi phục snapshot, xóa file mới tạo
   ↓  thành công
Cập nhật export-manifest
```

**Export manifest** (`.reactcraft/export-manifest.json`) lưu cho mỗi file đã xuất:

| Trường | Ý nghĩa |
|---|---|
| `path` | Đường dẫn tương đối trong Target Project |
| `hash` | SHA-256 nội dung đã ghi |
| `source` | ID page/component sinh ra file |
| `exportedAt` | Thời điểm |

Khi xuất lại: hash trên disk khác `hash` trong manifest nghĩa là file đã bị sửa tay → báo xung đột E010 (FR-36, AC-11).

#### Ràng buộc triển khai

1. **BẮT BUỘC** mọi ghi file đi qua `FileSystemPort.writeAtomic`.
2. **BẮT BUỘC** kiểm tra đường dẫn đích nằm trong Workspace hoặc Target Project (SEC-03, chi tiết SPEC-05).
3. **KHÔNG ĐƯỢC** ghi vào thư mục backend trong mọi trường hợp (SEC-02).
4. File tạm nằm cùng thư mục với file đích, bị xóa nếu ghi thất bại.

#### Truy vết

FR-02, FR-36, NFR-09, SEC-02, SEC-03, E010, E011.

---

### ADR-BE-19 — Kiểm tra code xuất ra

**Trạng thái:** Accepted — chờ VG-08

#### Quyết định

| Tầng | Công nghệ | Chạy ở | Chặn ghi file? |
|---|---|---|---|
| T1 — Cú pháp | `oxc-parser` trên từng file sinh ra | Luồng chính | **Có** |
| T2 — Kiểu | TypeScript 6.x API: tạo Program từ `tsconfig` của Target Project, thay file sinh ra bằng bản trong bộ nhớ | Worker | **Có** (mặc định), người dùng có thể chuyển thành cảnh báo |
| T3 — Build | Chạy `vite build` của chính Target Project trong child process (`node:child_process`) | Process riêng | Không. Chạy sau khi ghi, khi người dùng bật |

#### Ràng buộc triển khai

1. T2 **BẮT BUỘC** kiểm tra **trước khi ghi**, bằng file trong bộ nhớ, không ghi file tạm vào project.
2. T3 **BẮT BUỘC** chỉ chạy khi người dùng bật, vì nó thực thi cấu hình và plugin của Target Project.
3. T3 **BẮT BUỘC** có timeout (mặc định 120 s) và hủy được.
4. Lỗi **BẮT BUỘC** trả kèm file, dòng, cột, thông điệp (FR-37).

#### Truy vết

FR-37, NFR-10, E009.

---

## 10. ADR — HỆ THỐNG

### ADR-BE-20 — Theo dõi file: chokidar

**Trạng thái:** Accepted

#### Quyết định

**`chokidar`** theo dõi:

| Thư mục | Mục đích |
|---|---|
| `.reactcraft/` | Phát hiện thay đổi từ bên ngoài (ví dụ `git pull`) để báo người dùng tải lại |
| Target Project | Cập nhật quy ước, phát hiện file đã xuất bị sửa |
| Thư mục backend | Đánh dấu Data Source cần quét lại |

#### Ràng buộc triển khai

1. **BẮT BUỘC** debounce sự kiện theo file (mặc định 100 ms).
2. **BẮT BUỘC** bỏ qua sự kiện do chính ReactCraft ghi (nhận diện bằng hash vừa ghi).
3. Áp dụng cùng danh sách loại trừ của ADR-BE-15.

#### Truy vết

FR-36, SRS 4.2 (UC-07).

---

### ADR-BE-21 — Xử lý đồng thời: p-queue + piscina

**Trạng thái:** Accepted

#### Quyết định

| Vấn đề | Công nghệ | Quy tắc |
|---|---|---|
| Ghi workspace, export | **`p-queue`**, `concurrency: 1` mỗi hàng đợi | Một hàng đợi cho workspace, một cho export. Không có hai thao tác ghi chồng nhau |
| Quét backend, type check | **`piscina`** | Chạy trong worker thread |
| Áp dụng operation, sinh code một trang | Luồng chính | Nhẹ, không đáng chuyển sang worker |

Cấu hình pool mặc định: `minThreads` 1, `maxThreads` = `max(1, min(4, số CPU − 1))`, `idleTimeout` 30 000 ms.

#### Ràng buộc triển khai

1. Dữ liệu vào/ra worker **BẮT BUỘC** sao chép được (structured clone).
2. Lỗi trong worker **KHÔNG ĐƯỢC** làm dừng server.

#### Truy vết

NFR-04, NFR-05, NFR-08, NFR-09.

---

### ADR-BE-22 — AI SDK: Vercel AI SDK

**Trạng thái:** Accepted — chờ VG-06

#### Quyết định

- **Vercel AI SDK** (`ai`) làm lớp bên dưới AI Provider Gateway (FR-27).
- Provider: OpenAI, Anthropic, DeepSeek qua provider chính thức của SDK. Ollama qua provider tương thích, chọn cụ thể ở VG-06.
- AI trả về **danh sách Design Operation** theo schema Zod (FR-25), dùng chế độ structured output của SDK.
- Kết quả AI đi qua đúng bộ `validate` của `@reactcraft/model` trước khi xem trước (FR-26).

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| SDK chính thức từng provider | Phải tự viết lớp chung |
| LangChain.js | Nặng, nhiều lớp không cần |

#### Ràng buộc triển khai

1. AI **KHÔNG ĐƯỢC** có công cụ (tool) đọc/ghi file hay chạy lệnh (FR-30, SEC-04). Ngữ cảnh do AI Context Builder chuẩn bị sẵn.
2. **BẮT BUỘC** timeout và hủy được mọi request (FR-28).
3. Output không hợp lệ: thử lại tối đa 1 lần kèm thông điệp lỗi, sau đó báo E007.
4. Lỗi provider **KHÔNG ĐƯỢC** ảnh hưởng thiết kế và xuất code (NFR-08).
5. Phần văn bản AI trả cho người dùng (tóm tắt, giải thích) **BẮT BUỘC** theo ngôn ngữ giao diện đang dùng (`vi` hoặc `en`), truyền trong request (SRS 11.5).

#### Truy vết

FR-22 đến FR-30, NFR-08, SEC-04, SEC-06.

---

### ADR-BE-23 — Logging: pino

**Trạng thái:** Accepted

#### Quyết định

- **`pino`** (logger tích hợp của Fastify), log dạng JSON.
- Môi trường phát triển hiển thị đẹp bằng `pino-pretty` (dev dependency).
- Log ghi ra terminal và file xoay vòng trong thư mục log của người dùng (ADR-BE-24).

#### Ràng buộc triển khai

1. **KHÔNG ĐƯỢC** log nội dung file, API key, token phiên, nội dung prompt đầy đủ. Dùng cơ chế `redact` của pino.
2. Mỗi export và mỗi request AI **BẮT BUỘC** log ID, thời gian từng bước, kết quả.
3. **KHÔNG ĐƯỢC** dùng `console.log` (ESLint chặn).

#### Truy vết

NFR-08, SEC-05, SEC-07.

---

### ADR-BE-24 — Cấu hình người dùng và API key

**Trạng thái:** Accepted

#### Quyết định

- Thư mục cấu hình theo hệ điều hành lấy bằng **`env-paths`** (ví dụ `%APPDATA%\reactcraft` trên Windows).
- `config.json` trong thư mục đó lưu: provider AI, model, API key, ngôn ngữ giao diện (`vi`/`en`), tùy chọn chung.
- Biến môi trường (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`…) được ưu tiên hơn file.

#### Ràng buộc triển khai

1. API key **KHÔNG ĐƯỢC** lưu trong workspace (SEC-07).
2. API key **KHÔNG ĐƯỢC** gửi xuống trình duyệt. UI chỉ biết "đã cấu hình / chưa".
3. Trên macOS/Linux, file cấu hình **BẮT BUỘC** có quyền `0600`.

#### Điều kiện xem xét lại

Cần lưu key trong keychain của hệ điều hành.

#### Truy vết

FR-27, SEC-06, SEC-07.

---

### ADR-BE-25 — Build và đóng gói

**Trạng thái:** Accepted

#### Quyết định

| Package | Công cụ build | Đầu ra |
|---|---|---|
| `model`, `server`, `cli` | **tsdown** | ESM + `.d.ts` |
| `studio` | **Vite** | File tĩnh, server phục vụ qua `@fastify/static` |
| Package phát hành `reactcraft` | Gom 4 package | Có `bin: { "reactcraft": ... }` |

Package manager: **pnpm**.

#### Ràng buộc triển khai

1. Package phát hành **KHÔNG ĐƯỢC** có script `postinstall`.
2. **BẮT BUỘC** commit `pnpm-lock.yaml`.
3. Tên `reactcraft` là tạm thời, **BẮT BUỘC** kiểm tra trùng trên npm trước khi phát hành.

#### Truy vết

SRS 6.5, C-01.

---

### ADR-BE-26 — Kiểm thử

**Trạng thái:** Accepted

#### Quyết định

| Loại | Công nghệ | Áp dụng cho |
|---|---|---|
| Unit | **Vitest** | `model` (operation, migration), lowering, ánh xạ Tailwind |
| Property-based | **`fast-check`** + Vitest | Tính chất `apply`/`invert` của operation (ADR-BE-09) |
| Golden file | Vitest snapshot file | Codegen: Design Model mẫu → code mong đợi, so từng byte |
| Integration | Vitest + thư mục tạm có file thật | Workspace, export transaction, rollback, quét backend mẫu |
| E2E | **Playwright** | Luồng UC-01 đến UC-07 qua Studio UI |
| Visual | Playwright `toHaveScreenshot` | So khớp Canvas và trang xuất ra (NFR-11, AC-09) |
| Benchmark | `vitest bench` | Ngân sách hiệu năng mục 11 |

#### Ràng buộc triển khai

1. CI **BẮT BUỘC** chạy trên Windows và Linux.
2. Mỗi AC của SRS **BẮT BUỘC** có ít nhất một test E2E (bản đồ ở SPEC-06).
3. **KHÔNG ĐƯỢC** gọi AI provider thật trong CI. Dùng phản hồi ghi sẵn. Riêng VG-06 chạy thủ công với provider thật.

#### Truy vết

AC-01 đến AC-16, NFR-10, NFR-11.

---

### ADR-BE-27 — Chất lượng code

**Trạng thái:** Accepted

#### Quyết định

**ESLint** (flat config) + **typescript-eslint** (bật luật dựa trên kiểu) + **Prettier**.

Luật bắt buộc tối thiểu:

| Luật | Mục đích |
|---|---|
| `no-restricted-imports` | Thực thi mục 3.2 |
| `@typescript-eslint/no-explicit-any` | Thực thi ADR-BE-02 |
| `@typescript-eslint/no-floating-promises` | Không bỏ quên Promise khi ghi file |
| `no-console` | Thực thi ADR-BE-23 |

#### Truy vết

ADR-BE-02, ADR-BE-23.

---

## 11. NGÂN SÁCH HIỆU NĂNG

### 11.1. Môi trường tham chiếu

| Thành phần | Cấu hình |
|---|---|
| Hệ điều hành | Windows 11 |
| CPU | 8 nhân logic |
| RAM | 16 GB |
| Ổ đĩa | SSD NVMe |
| Node.js | 24 LTS |
| Trình duyệt | Chrome bản ổn định |
| Workspace mẫu lớn | 50 trang, trang lớn nhất 500 node |
| Backend mẫu lớn | 2.000 file |

---

### 11.2. Ngân sách phía backend

| Mã | Chỉ số | Mục tiêu P95 | NFR |
|---|---|---|---|
| PB-01 | Validate + apply một operation, trang 500 node | ≤ 5 ms | NFR-02 |
| PB-02 | Nhận, validate, apply một batch operation trên server | ≤ 20 ms | NFR-02 |
| PB-03 | Lưu một file trang (serialize + ghi nguyên tử) | ≤ 50 ms | NFR-06 |
| PB-04 | Mở workspace mẫu lớn: đọc, validate, migration | ≤ 1,5 s | NFR-03 |
| PB-05 | Quét backend mẫu lớn, không tính AI | ≤ 10 s | NFR-04 |
| PB-06 | Sinh code một trang: lowering + emit | ≤ 200 ms | NFR-05 |
| PB-07 | Format một trang bằng Prettier | ≤ 500 ms | NFR-05 |
| PB-08 | Sinh code toàn workspace mẫu lớn (không type check) | ≤ 10 s | NFR-05 |
| PB-09 | Type check T2 cho code xuất ra, Target Project ≤ 300 file | ≤ 15 s | — |
| PB-10 | Khởi động CLI đến khi Studio UI sẵn sàng | ≤ 2 s | — |
| PB-11 | Bộ nhớ server (không tính worker) | ≤ 400 MB | — |
| PB-12 | Bộ nhớ TS worker | ≤ 1 GB | — |

Ngân sách phía Studio UI (canvas 60 fps, phản hồi Inspector) thuộc SPEC-01.2.

---

## 12. CÁC BÀI KIỂM CHỨNG BẮT BUỘC

Các bài kiểm chứng sau **BẮT BUỘC** đạt **trước khi** viết code phụ thuộc vào ADR tương ứng. Kết quả và phiên bản thư viện ghi vào mục 13.3.

### VG-01 — Ghi file trên Windows

**Kiểm chứng cho:** ADR-BE-18

**Quy trình:**

1. Mở file đích trong VS Code.
2. Ghi 100 lần liên tiếp, mỗi lần nội dung khác.
3. Lặp lại khi bật Windows Defender real-time protection.
4. Chạy một export transaction 20 file, cố ý làm lỗi ở file thứ 15.

**Tiêu chí đạt:**

- 100/100 lần ghi thành công, không file rỗng hay ghi dở, không còn file tạm;
- transaction lỗi: 14 file đầu được khôi phục đúng nội dung cũ từng byte, file mới tạo bị xóa.

---

### VG-02 — Prettier với cấu hình Target Project

**Kiểm chứng cho:** ADR-BE-16

**Quy trình:** sinh một trang 300 node vào hai Target Project mẫu: một có `.prettierrc` riêng và `prettier-plugin-tailwindcss`, một không có cấu hình.

**Tiêu chí đạt:**

- kết quả giống hệt khi chạy `prettier` CLI trong chính project đó;
- PB-07 đạt;
- project không có cấu hình dùng cấu hình mặc định của ReactCraft.

---

### VG-03 — Code xuất ra biên dịch được

**Kiểm chứng cho:** ADR-BE-05, ADR-BE-16, ADR-BE-19

**Quy trình:** Design Document mẫu chứa **mọi loại node** ở SRS 8.2, có responsive, token, User Component, Binding. Xuất vào hai Target Project mẫu (Vite 8 + React 19 + Tailwind v4, Vite 7 + React 18 + Tailwind v3).

**Tiêu chí đạt:** trên cả hai project, `tsc --noEmit` và `vite build` không lỗi, không cảnh báo của TypeScript.

---

### VG-04 — Đọc OpenAPI

**Kiểm chứng cho:** ADR-BE-14

**Quy trình:** bộ file mẫu gồm Swagger 2.0, OpenAPI 3.0, OpenAPI 3.1, có `$ref` lồng, `$ref` vòng, `allOf`/`oneOf`, định dạng JSON và YAML.

**Tiêu chí đạt:** trích đúng 100% endpoint và entity của bộ mẫu. Không treo với `$ref` vòng. Không có request mạng nào được tạo.

---

### VG-05 — tree-sitter với Django

**Kiểm chứng cho:** ADR-BE-13

**Quy trình:** backend Django mẫu có `models.py` (`Product`, `Category`, quan hệ ForeignKey), DRF `ViewSet`, `urls.py` với router.

**Tiêu chí đạt:**

- trích đúng entity, field, kiểu, quan hệ, endpoint CRUD;
- nhân bản backend lên 2.000 file: PB-05 đạt;
- chạy được trên Windows không cần cài Python hay trình biên dịch.

---

### VG-06 — AI trả về operation hợp lệ

**Kiểm chứng cho:** ADR-BE-22

**Quy trình:** bộ 50 yêu cầu mẫu (sửa node, thêm node, dựng trang) gửi tới từng provider.

**Tiêu chí đạt (tính sau tối đa 1 lần thử lại):**

| Provider | Tỷ lệ operation hợp lệ |
|---|---|
| OpenAI, Anthropic | ≥ 95% |
| DeepSeek | ≥ 90% |
| Ollama (model chốt tại VG) | ≥ 80% |

Kết quả quyết định model Ollama khuyến nghị và provider package cho Ollama.

---

### VG-07 — Server local

**Kiểm chứng cho:** ADR-BE-03, ADR-BE-06

**Tiêu chí đạt:**

- server chỉ nhận kết nối từ `127.0.0.1`;
- request thiếu token hoặc sai Origin bị từ chối (cả REST và WebSocket);
- 1.000 batch operation/giây qua REST, P95 PB-02 đạt;
- PB-10 đạt.

---

### VG-08 — Type check code xuất ra

**Kiểm chứng cho:** ADR-BE-19

**Quy trình:** Target Project mẫu 300 file, sinh 20 file mới, type check bằng file trong bộ nhớ.

**Tiêu chí đạt:** PB-09 và PB-12 đạt. Không có file nào được ghi vào project trong lúc kiểm tra. Lỗi kiểu cố ý được báo đúng file và dòng.

---

## 13. CHÍNH SÁCH PHỤ THUỘC

### 13.1. Danh sách phụ thuộc runtime được phép

| Package | Vai trò | ADR | Giấy phép |
|---|---|---|---|
| `fastify` | HTTP server | ADR-BE-06 | MIT |
| `@fastify/websocket` | WebSocket | ADR-BE-06 | MIT |
| `@fastify/static` | Phục vụ Studio UI | ADR-BE-06 | MIT |
| `zod` | Schema | ADR-BE-08 | MIT |
| `nanoid` | Định danh | ADR-BE-10 | MIT |
| `oxc-parser` | Parse JS/TS | ADR-BE-12 | MIT |
| `estree-walker` | Duyệt AST | ADR-BE-12 | MIT |
| `web-tree-sitter` + grammar `.wasm` | Parse đa ngôn ngữ | ADR-BE-13 | MIT |
| `@apidevtools/swagger-parser` | OpenAPI | ADR-BE-14 | MIT |
| `yaml` | Đọc YAML | ADR-BE-14 | ISC |
| `tinyglobby` | Liệt kê file | ADR-BE-15 | MIT |
| `ignore` | Áp `.gitignore` | ADR-BE-15 | MIT |
| `prettier` | Format code xuất ra | ADR-BE-16 | MIT |
| `tailwindcss` (v4) | Biên dịch `styles.css` khi xuất HTML/CSS | SPEC-04.2 R-HT-02 | MIT |
| `diff` | Tính diff | ADR-BE-17 | BSD-3-Clause |
| `write-file-atomic` | Ghi file nguyên tử | ADR-BE-18 | ISC |
| `cross-spawn` | Chạy tiến trình con an toàn trên Windows | SPEC-05 S-51 | MIT |
| `culori` | Đổi màu `oklch`/`rgb`/`hsl` sang hex khi nhập token | SPEC-04.5 R-TI-01 | MIT |
| `typescript` (6.x) | Type check code xuất ra | ADR-BE-19 | Apache-2.0 |
| `chokidar` | Theo dõi file | ADR-BE-20 | MIT |
| `p-queue` | Hàng đợi ghi | ADR-BE-21 | MIT |
| `piscina` | Worker pool | ADR-BE-21 | MIT |
| `ai`, `@ai-sdk/*` | AI Gateway | ADR-BE-22 | Apache-2.0 |
| `pino` | Logging | ADR-BE-23 | MIT |
| `env-paths` | Thư mục cấu hình | ADR-BE-24 | MIT |
| `open` | Mở trình duyệt | ADR-BE-03 | MIT |

**Dự phòng (chỉ thêm khi VG tương ứng thất bại):** `@babel/parser`.

**Dev dependencies:** `tsdown`, `vite`, `vitest`, `fast-check`, `@playwright/test`, `eslint`, `typescript-eslint`, `pino-pretty`, `@types/node`, cùng danh sách bổ sung ở SPEC-02 mục 15.

**Không còn dùng so với bản nháp 0.1:** `magic-string` (không còn sửa code tại chỗ).

---

### 13.2. Quy tắc

1. **KHÔNG ĐƯỢC** thêm runtime dependency ngoài danh sách 13.1 khi chưa cập nhật phần này.
2. Giấy phép chấp nhận: MIT, ISC, BSD-2/3-Clause, Apache-2.0. Giấy phép khác cần duyệt riêng.
3. Package có binary native **BẮT BUỘC** có bản dựng sẵn cho win32-x64, darwin-arm64, darwin-x64, linux-x64.
4. Nâng major của bất kỳ phụ thuộc nào **BẮT BUỘC** chạy lại các VG liên quan.
5. **BẮT BUỘC** chạy `pnpm audit` trong CI. Lỗ hổng mức high trở lên chặn phát hành.

---

### 13.3. Bảng ghi phiên bản đã ghim

Điền khi khởi tạo repo và chạy VG.

| Package | Phiên bản ghim | Ngày | VG đã chạy |
|---|---|---|---|
| node | 24 LTS (`.node-version`). Chạy sản phẩm: ≥ 22.12 (ADR-BE-01). Phát triển: ≥ 22.13 (yêu cầu của ESLint 10) | 2026-10-11 | — |
| typescript | 6.0.3 (bản 6.x mới nhất; TypeScript 7 đã ra nhưng chưa dùng theo ADR-BE-02) | 2026-10-11 | — |
| fastify | | | |
| zod | | | |
| oxc-parser | | | |
| web-tree-sitter | | | |
| prettier | | | |
| ai | | | |

**Công cụ phát triển ghim khi khởi tạo repo (SPEC-07 WP-0.01):**

| Package | Phiên bản ghim | Ngày | Ghi chú |
|---|---|---|---|
| pnpm | 10.34.6 | 2026-10-11 | Bản mới nhất của dòng 10. Đã có pnpm 11, 12; nâng major qua CR (SPEC-07 mục 13) |
| eslint | 10.12.0 | 2026-10-11 | |
| @eslint/js | 10.0.1 | 2026-10-11 | Luật khuyến nghị của ESLint |
| typescript-eslint | 8.71.1 | 2026-10-11 | Hỗ trợ TypeScript < 6.1 |
| eslint-plugin-simple-import-sort | 14.0.0 | 2026-10-11 | QC-43 |
| prettier | 3.9.10 | 2026-10-11 | |
| lefthook | 2.2.1 | 2026-10-11 | |
| @commitlint/cli, @commitlint/config-conventional | 21.2.3 | 2026-10-11 | |
| @changesets/cli | 3.0.3 | 2026-10-11 | |
| @types/node | 22.20.5 | 2026-10-11 | Theo phiên bản Node tối thiểu (22) để không dùng nhầm API chỉ có ở Node 24 |

---

## 14. TRUY VẾT VỀ SRS v4.0

| Yêu cầu SRS | ADR / VG / PB liên quan |
|---|---|
| FR-01 Workspace | ADR-BE-03, ADR-BE-11 |
| FR-02 Lưu tự động | ADR-BE-11, ADR-BE-18, PB-03 |
| FR-03 Liên kết Target Project | ADR-BE-05, ADR-BE-12 |
| FR-04 Liên kết Backend | ADR-BE-13, ADR-BE-15 |
| FR-07, FR-09, FR-14 Kéo thả, Inspector, Undo | ADR-BE-09, PB-01, PB-02 |
| FR-17, FR-18 Backend Scan, Data Source | ADR-BE-12, ADR-BE-13, ADR-BE-14, ADR-BE-15, VG-04, VG-05 |
| FR-21 Loại trừ secrets | ADR-BE-15 |
| FR-22 đến FR-30 AI | ADR-BE-09, ADR-BE-22, VG-06 |
| FR-31 đến FR-34 Sinh code | ADR-BE-16, VG-02, VG-03 |
| FR-35 Diff | ADR-BE-17 |
| FR-36 Ghi an toàn | ADR-BE-18, VG-01 |
| FR-37 Kiểm tra code | ADR-BE-19, VG-08 |
| FR-38 Quy ước Target Project | ADR-BE-12, ADR-BE-16 |
| NFR-02 đến NFR-05 | Mục 11 |
| NFR-06, NFR-07 | ADR-BE-11 |
| NFR-08 | ADR-BE-21, ADR-BE-22 |
| NFR-09 | ADR-BE-18 |
| NFR-10 đến NFR-13 | ADR-BE-16, ADR-BE-19, VG-03 |
| SEC-01 | ADR-BE-03, ADR-BE-06, VG-07 |
| SEC-02, SEC-03 | ADR-BE-15, ADR-BE-18 |
| SEC-04 | ADR-BE-22 |
| SEC-05 | ADR-BE-15, ADR-BE-23 |
| SEC-06, SEC-07 | ADR-BE-24 |
| SEC-08 | ADR-BE-05, SPEC-05 S-54 |

---

## 15. CÂU HỎI MỞ

| # | Câu hỏi | Ảnh hưởng | Giải quyết tại |
|---|---|---|---|
| Q-01 | Tên package chính thức trên npm | ADR-BE-25 | Trước khi phát hành |
| Q-02 | Có giữ lịch sử Undo sau khi đóng Studio không? | ADR-BE-09, ADR-BE-11 | **Đã giải quyết:** không giữ (SPEC-03 V-55) |
| Q-03 | Có hỗ trợ monorepo ở Target Project (nhiều app) không? | ADR-BE-05 | **Đã giải quyết:** có (SPEC-04.2 R-TP-04) |
| Q-04 | Model Ollama khuyến nghị | ADR-BE-22 | VG-06 |

---

# SPEC-01.2 — STUDIO UI TECHNOLOGY STACK

**Thuộc:** SPEC-01 — Kiến trúc kỹ thuật & Tech stack  
**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0  
**Phạm vi:** Công nghệ, thư viện và quy tắc sử dụng cho ReactCraft Studio UI (`packages/studio`)

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

### 1.1. Mục đích

Phần này chốt toàn bộ công nghệ cho **Studio UI**: ứng dụng web chạy trên trình duyệt, nơi người dùng kéo thả, chọn phần tử, chỉnh thuộc tính, gắn dữ liệu, làm việc với AI và xuất code.

Nguyên tắc giống SPEC-01.1:

> Thư viện không có trong phần này thì không được dùng cho Studio UI. Muốn thêm phải cập nhật phần này trước.

---

### 1.2. Phạm vi

**Trong phạm vi:** framework, build, Canvas, kéo thả, state, bộ component giao diện, code editor, đa ngôn ngữ, giao tiếp với backend, kiểm thử, chất lượng code, ngân sách hiệu năng phía UI, bài kiểm chứng, chính sách phụ thuộc.

**Ngoài phạm vi:**

| Nội dung | Tài liệu |
|---|---|
| Backend, `@reactcraft/model` | SPEC-01.1 |
| Quy tắc đặt tên, Git, review | SPEC-02 |
| Schema API, sự kiện, Design Model chi tiết | SPEC-03 |
| Thuật toán vị trí thả, render node, xử lý từng panel | SPEC-04 |
| Thiết kế giao diện chi tiết (màu, bố cục từng màn hình) | SPEC-04 |
| Bảo mật token phiên phía UI | SPEC-05 |

---

## 2. BỐI CẢNH VÀ RÀNG BUỘC

| Mã | Ràng buộc | Nguồn |
|---|---|---|
| C-11 | Studio là ứng dụng web riêng, được Local Backend phục vụ trên cùng origin `127.0.0.1` | SPEC-01.1 ADR-BE-03 |
| C-12 | Canvas phải hiển thị giống code xuất ra (WYSIWYG), kể cả responsive theo breakpoint | FR-05, FR-10, NFR-11 |
| C-13 | CSS của Studio và CSS của bản thiết kế không được ảnh hưởng nhau | FR-05 |
| C-14 | Mọi thay đổi bản thiết kế đi qua Design Operation của `@reactcraft/model` | SRS 6.2, ADR-BE-09 |
| C-15 | Kéo thả chỉ thả được vào container flex/grid | SRS 6.3, FR-07 |
| C-16 | Kéo thả và chọn mượt 60 fps với trang ≤ 500 node. Thay đổi thuộc tính hiện trên Canvas ≤ 100 ms | NFR-01, NFR-02 |
| C-17 | Giao diện Studio hỗ trợ **tiếng Việt và tiếng Anh** ngay từ phiên bản đầu | SRS Q-05 (đã chốt) |
| C-18 | Chạy offline: không tải font, script, CSS từ CDN lúc chạy | SRS 6.1 |
| C-19 | Trình duyệt Chrome, Edge, Firefox bản ổn định | SRS 11.4 |

---

## 3. KIẾN TRÚC STUDIO UI

### 3.1. Bố cục màn hình chính

```text
┌──────────────────────────── Studio (React app) ─────────────────────────────┐
│ Toolbar: trang · khung nhìn · zoom · Undo/Redo · ngôn ngữ · Xuất code      │
├────────────┬─────────────────────────────────────────────┬─────────────────┤
│ Library    │  ┌────────────── Canvas ─────────────────┐   │ Inspector       │
│            │  │ iframe: bản thiết kế render bằng      │   │                 │
│ Layer Tree │  │ Tailwind thật, rộng 375/768/1280 px   │   │ Data Sources    │
│            │  └───────────────────────────────────────┘   │                 │
│            │  Overlay (thuộc Studio): hover, khung     │   │ AI Panel        │
│            │  chọn, chỉ báo vị trí thả                  │   │                 │
└────────────┴─────────────────────────────────────────────┴─────────────────┘
```

---

### 3.2. Luồng dữ liệu

```text
Thao tác người dùng (Inspector / kéo thả / AI đã duyệt)
   ↓
Design Operation  ──►  @reactcraft/model: validate → apply
   ↓
Editor Store (Zustand): document mới + Undo stack
   ├──►  Canvas Renderer ──► createPortal ──► iframe ──► Tailwind runtime sinh CSS
   ├──►  Layer Tree, Inspector, Overlay (đọc theo selector)
   └──►  Sync (batch operation, debounce) ──► REST /api/v1 ──► Local Backend

Local Backend ──► WebSocket events ──► TanStack Query invalidate / Editor Store
```

---

### 3.3. Cấu trúc mã nguồn

```text
packages/studio/
├── index.html
├── src/
│   ├── main.tsx
│   ├── app/              # khởi tạo: router, query client, i18n, theme
│   ├── routes/           # màn hình: editor, data-sources, export, settings
│   ├── features/
│   │   ├── canvas/       # iframe host, renderer, overlay, zoom, viewport
│   │   ├── dnd/          # kéo thả, thuật toán vị trí thả
│   │   ├── library/      # thư viện component
│   │   ├── layers/       # Layer Tree
│   │   ├── inspector/    # các control thuộc tính
│   │   ├── data-sources/
│   │   ├── ai/
│   │   ├── export/       # preview, diff, kết quả kiểm tra
│   │   └── settings/
│   ├── stores/           # Zustand: editor store, ui store
│   ├── api/              # REST client, WebSocket client, query hooks
│   ├── i18n/
│   │   └── locales/
│   │       ├── vi/       # *.json theo namespace
│   │       └── en/
│   ├── ui/               # component shadcn/ui đã copy vào repo
│   └── lib/              # tiện ích dùng chung
└── canvas-frame/         # tài nguyên của iframe: HTML khung, Tailwind runtime
```

Thư mục con theo từng module và quyền sở hữu thư mục: SPEC-07 mục 3.5.

---

### 3.4. Quy tắc phân lớp

**BẮT BUỘC:**

1. Component trong `features/*` **KHÔNG ĐƯỢC** sửa Design Model trực tiếp. Chỉ gửi Design Operation qua Editor Store.
2. `features/*` **KHÔNG ĐƯỢC** import lẫn nhau. Giao tiếp qua `stores/` hoặc props.
3. Canvas Renderer là hàm render thuần từ node sang JSX. Class Tailwind **BẮT BUỘC** lấy từ `@reactcraft/model/styling` (ADR-FE-06), **KHÔNG ĐƯỢC** tự ánh xạ.
4. Gọi backend chỉ qua `src/api/`. **KHÔNG ĐƯỢC** gọi `fetch` trực tiếp trong component.
5. Chuỗi hiển thị cho người dùng **BẮT BUỘC** qua i18n (ADR-FE-16).
6. Các quy tắc trên được kiểm tra bằng ESLint (ADR-FE-19).

---

## 4. BẢNG TỔNG HỢP CÔNG NGHỆ

| Lớp | Công nghệ | ADR | Trạng thái |
|---|---|---|---|
| Framework | React 19 | ADR-FE-01 | Accepted |
| Build | Vite 8 + `@vitejs/plugin-react` v6 + React Compiler | ADR-FE-02 | Accepted — chờ VG-13 |
| Ngôn ngữ | TypeScript 6.x (theo ADR-BE-02) | ADR-FE-03 | Accepted |
| Canvas | iframe + `createPortal` | ADR-FE-04 | Accepted |
| Style trong Canvas | `@tailwindcss/browser` (v4) đóng gói offline | ADR-FE-05 | Accepted — chờ VG-09, VG-10 |
| Ánh xạ class | `@reactcraft/model/styling`, dùng chung với codegen | ADR-FE-06 | Accepted |
| Overlay chọn, hover | Lớp phủ trong Studio, tính tọa độ từ iframe | ADR-FE-07 | Accepted |
| Khung nhìn, zoom | Độ rộng iframe thật + `transform: scale` | ADR-FE-08 | Accepted |
| Kéo thả | `@dnd-kit/core` + `@dnd-kit/sortable` + thuật toán thả tự viết | ADR-FE-09 | Accepted — chờ VG-11 |
| State thiết kế | Zustand | ADR-FE-10 | Accepted |
| State server | TanStack Query | ADR-FE-11 | Accepted |
| Điều hướng | TanStack Router | ADR-FE-12 | Accepted |
| Component giao diện | shadcn/ui (Radix + Tailwind v4) | ADR-FE-13 | Accepted |
| Thư viện hỗ trợ | panels, virtual, colorful, lucide, cmdk, sonner, tinykeys | ADR-FE-14 | Accepted |
| Code editor, diff | CodeMirror 6 + `@codemirror/merge` | ADR-FE-15 | Accepted |
| Đa ngôn ngữ | i18next + react-i18next (vi, en) | ADR-FE-16 | Accepted — chờ VG-12 |
| Giao tiếp | REST client + WebSocket client tự viết, Zod dùng chung | ADR-FE-17 | Accepted |
| Kiểm thử | Vitest + Testing Library + happy-dom, Playwright | ADR-FE-18 | Accepted |
| Chất lượng code | ESLint + react-hooks + i18next + jsx-a11y | ADR-FE-19 | Accepted |
| Soạn rich text | TipTap (ProseMirror) | ADR-FE-20 | Accepted — chờ VG-14 |

---

## 5. ADR — NỀN TẢNG

### ADR-FE-01 — Framework: React 19

**Trạng thái:** Accepted

#### Bối cảnh

Studio là ứng dụng riêng (C-11), không còn ràng buộc chạy ký sinh trong trang người khác. Studio có nhiều màn hình phức tạp: Canvas, cây, Inspector, diff code.

#### Quyết định

**React 19** cho toàn bộ Studio UI.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Preact | Ưu điểm nhỏ gọn chỉ cần khi chạy trong trang người khác, không còn áp dụng |
| Svelte, Solid, Vue | Hệ sinh thái editor (kéo thả, cây, code editor) nhỏ hơn. Khác công nghệ với code xuất ra |

#### Hệ quả

- (+) Hệ sinh thái lớn nhất. AI viết React tốt nhất.
- (+) Cùng công nghệ với code React xuất ra, nên Canvas Renderer gần với code sinh ra.

#### Truy vết

FR-05 đến FR-16.

---

### ADR-FE-02 — Build: Vite 8 + React Compiler

**Trạng thái:** Accepted — chờ VG-13

#### Quyết định

- Build bằng **Vite 8** + **`@vitejs/plugin-react` v6**.
- Bật **React Compiler** qua `reactCompilerPreset` của plugin-react v6 để tự memo hóa component.
- Khi phát triển: Vite dev server proxy `/api` sang Local Backend. Khi phát hành: file tĩnh do backend phục vụ (ADR-BE-25).

#### Ràng buộc triển khai

1. **KHÔNG ĐƯỢC** viết `useMemo`, `useCallback`, `memo` thủ công, trừ khi có đo đạc chứng minh cần, kèm comment lý do.
2. Component không tương thích React Compiler **BẮT BUỘC** tắt riêng bằng chỉ thị `"use no memo"` kèm lý do.
3. Bundle khởi đầu ≤ 600 KB gzip (PB-17). CodeMirror và màn hình Export **BẮT BUỘC** lazy-load.

#### Truy vết

NFR-01, NFR-02.

---

### ADR-FE-03 — Ngôn ngữ: TypeScript

**Trạng thái:** Accepted

#### Quyết định

Theo ADR-BE-02 (TypeScript 6.x, `strict`), với `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"jsx": "react-jsx"`, `"lib": ["ES2023", "DOM", "DOM.Iterable"]`.

#### Truy vết

ADR-BE-02.

---

## 6. ADR — CANVAS

### ADR-FE-04 — Canvas: iframe + createPortal

**Trạng thái:** Accepted

#### Bối cảnh

Canvas cần ba thứ cùng lúc: cô lập CSS (C-13), breakpoint chạy đúng như màn hình thật (C-12), và cập nhật tức thì khi state đổi (C-16).

#### Quyết định

- Canvas là một **iframe cùng origin** (`/canvas-frame.html`), không có React riêng bên trong.
- Studio render bản thiết kế **vào `document.body` của iframe** bằng `createPortal`. Một cây React, một store, không dùng `postMessage`.
- Độ rộng iframe đặt đúng độ rộng khung nhìn (ADR-FE-08), nên media query `sm:`, `md:`, `lg:` trong iframe hoạt động như thật.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Render trực tiếp trong document của Studio | CSS của Studio và thiết kế lẫn nhau. Breakpoint theo cửa sổ Studio, không theo khung nhìn |
| Shadow DOM | Cô lập được CSS nhưng không giả lập được độ rộng màn hình cho media query |
| Iframe có React riêng, giao tiếp `postMessage` | Phải tuần tự hóa state mỗi lần đổi, chậm và phức tạp |
| `<canvas>` / WebGL | Phải tự viết engine layout, không khớp HTML/CSS xuất ra |

#### Ràng buộc triển khai

1. Iframe **BẮT BUỘC** cùng origin với Studio. **KHÔNG ĐƯỢC** nạp nội dung từ origin khác.
2. Trong iframe **KHÔNG ĐƯỢC** chạy script của người dùng. Chỉ có Tailwind runtime và DOM do Studio render.
3. Sự kiện chuột trong iframe ở chế độ thiết kế **BẮT BUỘC** bị chặn tại pha capture (link không điều hướng, button không submit form). Thao tác chọn đi qua Overlay (ADR-FE-07).
4. Mỗi node được render kèm thuộc tính `data-rc-node="<id>"` để Overlay tìm phần tử. Thuộc tính này **chỉ có trong Canvas**, không có trong code xuất ra.

#### Truy vết

FR-05, FR-10, NFR-11, C-12, C-13.

---

### ADR-FE-05 — Style trong Canvas: Tailwind runtime

**Trạng thái:** Accepted — chờ VG-09, VG-10

#### Quyết định

- Trong iframe dùng **`@tailwindcss/browser`** (Tailwind v4 chạy trong trình duyệt). File được **đóng gói cùng Studio**, không tải từ CDN (C-18).
- Design Token được chuyển thành khối `@theme` trong thẻ `<style type="text/tailwindcss">` của iframe. Đổi token thì cập nhật khối này.

```html
<!-- canvas-frame.html (rút gọn) -->
<script src="./tailwind-browser.js"></script>
<style type="text/tailwindcss">
  @theme {
    --color-primary: #2563eb;
    --radius-lg: 0.75rem;
  }
</style>
```

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Server biên dịch CSS bằng package `tailwindcss` rồi đẩy xuống | Thêm một vòng request mỗi lần thêm class mới, chậm hơn khi kéo thả |
| Style inline sinh từ thuộc tính | Canvas và code xuất ra dùng hai cách style khác nhau, dễ lệch |
| Biên dịch trước toàn bộ class có thể có | Không bao phủ giá trị tùy ý (`p-[13px]`) |

#### Hệ quả

- (+) Canvas dùng đúng Tailwind và đúng class của code xuất ra.
- (−) Tailwind ghi rõ `@tailwindcss/browser` chỉ dành cho môi trường phát triển. Canvas đúng là môi trường đó, không phải production.
- (−) Target Project dùng Tailwind v3 thì Canvas vẫn render bằng v4. Mức lệch được đo ở VG-09.

#### Ràng buộc triển khai

1. Phiên bản `@tailwindcss/browser` **BẮT BUỘC** ghim chính xác, nâng cấp phải chạy lại VG-09, VG-10.
2. **KHÔNG ĐƯỢC** dùng `@tailwindcss/browser` ở bất kỳ đâu ngoài iframe Canvas.

#### Truy vết

FR-05, FR-11, NFR-11, C-12, C-18.

---

### ADR-FE-06 — Ánh xạ thuộc tính sang class: dùng chung với codegen

**Trạng thái:** Accepted

#### Bối cảnh

Nếu Canvas và bộ sinh code tự ánh xạ thuộc tính sang class Tailwind theo hai cách riêng, hai bên sẽ lệch nhau theo thời gian (C-12).

#### Quyết định

- Bảng ánh xạ "thuộc tính thiết kế → class Tailwind" nằm ở **`@reactcraft/model/styling`** (cập nhật SPEC-01.1 mục 3.3).
- Canvas Renderer (Studio) và Lowering (ADR-BE-16) **cùng gọi** một hàm:

```ts
// @reactcraft/model/styling — phác thảo, chữ ký chính thức ở SPEC-03
export function toTailwindClasses(
  node: DesignNode,
  tokens: DesignTokens,
  target: { tailwind: 'v3' | 'v4'; responsiveMode: ResponsiveMode },
): string[];
```

- Canvas luôn gọi với `target.tailwind = 'v4'`. Codegen gọi theo phiên bản của Target Project.

#### Ràng buộc triển khai

1. Hàm ánh xạ **BẮT BUỘC** là hàm thuần, xác định.
2. **BẮT BUỘC** có golden test cho từng thuộc tính ở SRS 8.3, cả v3 và v4.

#### Truy vết

FR-09, FR-10, FR-31, NFR-11, ADR-BE-16.

---

### ADR-FE-07 — Overlay: hover, khung chọn, chỉ báo thả

**Trạng thái:** Accepted

#### Quyết định

- Overlay là một lớp trong **document của Studio**, nằm chồng lên iframe, `pointer-events: none` khi không kéo.
- Vị trí khung lấy từ `getBoundingClientRect()` của phần tử trong iframe, cộng vị trí iframe, nhân hệ số zoom.
- Bám theo thay đổi bằng `ResizeObserver` và `MutationObserver` trên `body` của iframe, cập nhật theo `requestAnimationFrame`.
- Chọn phần tử: con trỏ trên iframe → `elementFromPoint` trong iframe → phần tử gần nhất có `data-rc-node`.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Vẽ khung chọn bên trong iframe | Khung chọn chịu ảnh hưởng CSS của thiết kế, có thể bị cắt bởi `overflow: hidden` |
| Viền CSS (`outline`) trên phần tử | Làm thay đổi giao diện đang thiết kế |

#### Ràng buộc triển khai

1. Mỗi khung hình (frame) cập nhật Overlay **BẮT BUỘC** ≤ 16 ms (PB-13).
2. **KHÔNG ĐƯỢC** đọc layout (`getBoundingClientRect`) xen kẽ với ghi DOM trong cùng frame.

#### Truy vết

FR-08, NFR-01.

---

### ADR-FE-08 — Khung nhìn và zoom

**Trạng thái:** Accepted

#### Quyết định

- Danh sách khung thiết kế và **khung chuẩn** lấy từ `WorkspaceMeta` (SPEC-03 mục 2.2a). Mặc định của workspace mới (`desktop-first`):

| Khung | Kích thước | Vai trò |
|---|---|---|
| Desktop | 1440 × 900 | **Khung chuẩn** |
| Tablet | 768 × 1024 | |
| Mobile | 375 × 812 | |

- Người dùng thêm khung tùy chỉnh (ví dụ 1920 × 1200) và chọn khung chuẩn khi tạo workspace hoặc trong Settings.
- Iframe có **độ rộng và chiều cao thật** của khung. Nội dung dài hơn chiều cao khung thì cuộn **bên trong** iframe, giống frame có bật cuộn trong Figma. Đơn vị `vh`, `h-screen` tính theo chiều cao khung.
- Inspector luôn hiển thị khóa responsive đang được sửa, tính theo SPEC-03 mục 2.2a.
- Zoom (10% đến 400%) bằng `transform: scale()` trên khung chứa iframe, không đổi kích thước iframe. Mặc định "vừa màn hình".
- **Xem song song nhiều khung** (Accepted, thi công ở Phase 5): nút "Xem song song" hiện tối đa 3 khung cạnh nhau, mỗi khung một iframe cùng render trang hiện tại. Sửa ở khung nào cũng cập nhật mọi khung. Phạm vi sửa (khóa responsive) theo khung đang được chọn. Mỗi iframe dùng chung Editor Store, chỉ khác độ rộng.

#### Truy vết

FR-05, FR-10.

---

## 7. ADR — KÉO THẢ

### ADR-FE-09 — Kéo thả: dnd-kit + thuật toán thả tự viết

**Trạng thái:** Accepted — chờ VG-11

#### Bối cảnh

Kéo từ Library (document Studio) vào Canvas (document iframe) là kéo xuyên iframe, rất dễ lỗi. Vị trí thả phải theo layout thật và quy tắc chỉ thả vào container (C-15).

#### Quyết định

- **`@dnd-kit/core`** quản lý phiên kéo (cảm biến chuột, bàn phím, `DragOverlay`).
- **`@dnd-kit/sortable`** cho Layer Tree.
- Khi đang kéo, Overlay bật `pointer-events: auto` và **che toàn bộ iframe**. Mọi sự kiện nằm trong một document.
- Vị trí thả do **thuật toán tự viết** trong `features/dnd/` tính (chi tiết ở SPEC-04):

```text
Tọa độ con trỏ (đã quy đổi zoom)
   ↓
elementsFromPoint trong iframe → node gần nhất
   ↓
Tìm container hợp lệ (flex/grid) chứa vị trí đó
   ↓
Theo hướng layout của container: trước / sau / vào trong
   ↓
Chỉ báo vị trí thả trên Overlay
   ↓
Thả → Design Operation insert / move
```

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Pragmatic DnD (Atlassian) | Rất nhanh với danh sách nghìn mục, nhưng cây lồng nhau phải tự làm nhiều hơn |
| Puck (editor có sẵn) | Puck tự giữ data model, lịch sử Undo, state. Xung đột với Design Model dạng operation (ADR-BE-09) |
| `@dnd-kit/react` (thế hệ mới) | Còn mới. Xem xét lại khi ổn định |
| HTML5 Drag and Drop thuần | Khó tùy biến hình ảnh khi kéo, hành vi khác nhau giữa trình duyệt |

#### Ràng buộc triển khai

1. **KHÔNG ĐƯỢC** áp dụng Design Operation trong lúc kéo. Chỉ áp dụng một lần khi thả.
2. Tính vị trí thả **BẮT BUỘC** ≤ 8 ms mỗi lần di chuyển chuột (PB-15).
3. Kéo thả **BẮT BUỘC** làm được bằng bàn phím (cảm biến bàn phím của dnd-kit).

#### Điều kiện xem xét lại

`@dnd-kit/react` ổn định và hỗ trợ tốt cây lồng nhau.

#### Truy vết

FR-07, NFR-01, C-15, C-16.

---

## 8. ADR — STATE

### ADR-FE-10 — State thiết kế: Zustand

**Trạng thái:** Accepted

#### Quyết định

- **Zustand** giữ Editor Store gồm: document đang sửa, `revision`, lựa chọn, Undo/Redo stack, trạng thái đồng bộ.
- Node lưu dạng **phẳng** (`Record<NodeId, Node>` + danh sách con theo ID) để mỗi node đăng ký đúng phần dữ liệu của mình. Chuyển đổi giữa dạng cây (lưu file) và dạng phẳng do `@reactcraft/model` cung cấp.
- Mọi thay đổi qua một hàm duy nhất của store:

```ts
// stores/editor-store.ts — phác thảo
dispatch(ops: DesignOperation[], meta: { source: 'user' | 'ai'; label: string }): Result;
```

`dispatch` gọi `validate` → `apply` của `@reactcraft/model`, ghi Undo, đưa operation vào hàng đợi đồng bộ.

- Đồng bộ với server: gom operation, gửi theo debounce 300 ms, kèm `baseRevision` (ADR-BE-09). Bị từ chối thì hoàn tác batch và báo lỗi.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Redux Toolkit | Dài dòng, middleware không cần thiết |
| Jotai | Atom theo node phân tán, khó áp một cửa `dispatch` duy nhất |
| MobX, Valtio | Đột biến ngầm, xung đột với nguyên tắc document bất biến của ADR-BE-09 |
| React Context + useReducer | Re-render cả cây khi đổi một node |

#### Ràng buộc triển khai

1. Component **BẮT BUỘC** đọc store qua selector hẹp (theo ID node), **KHÔNG ĐƯỢC** đăng ký cả document.
2. Undo/Redo **BẮT BUỘC** nhóm theo `dispatch` (một đề xuất AI là một bước Undo).

#### Truy vết

FR-07, FR-09, FR-14, FR-26, NFR-02, C-14.

---

### ADR-FE-11 — State server: TanStack Query

**Trạng thái:** Accepted

#### Quyết định

**TanStack Query** cho dữ liệu lấy từ backend: thông tin workspace, Target Project, Data Source Catalog, kết quả quét, preview export, cấu hình.

Sự kiện WebSocket làm mới (invalidate) đúng query liên quan.

#### Ràng buộc triển khai

1. Design Document đang sửa **KHÔNG** nằm trong TanStack Query. Nó thuộc Editor Store (ADR-FE-10).

#### Truy vết

FR-17 đến FR-20, FR-35.

---

### ADR-FE-12 — Điều hướng: TanStack Router

**Trạng thái:** Accepted

#### Quyết định

**TanStack Router**, định nghĩa route bằng code, tham số URL có kiểu.

| Route | Màn hình |
|---|---|
| `/` | Editor (trang, khung nhìn, node đang chọn nằm trong search params) |
| `/data-sources` | Data Source Catalog |
| `/export` | Xuất code, diff, kết quả kiểm tra |
| `/settings` | AI provider, ngôn ngữ, giao diện |

#### Truy vết

FR-12, FR-18, FR-35.

---

## 9. ADR — GIAO DIỆN STUDIO

### ADR-FE-13 — Bộ component: shadcn/ui

**Trạng thái:** Accepted

#### Quyết định

- **shadcn/ui** trên nền **Radix** và **Tailwind v4** (build-time qua `@tailwindcss/vite`) cho giao diện của Studio.
- Component được copy vào `src/ui/`, thuộc quyền sửa của dự án.
- Hỗ trợ giao diện sáng và tối, mặc định theo cài đặt hệ thống.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| MUI, Ant Design | Nặng, khó tùy biến, style riêng khó thống nhất với Tailwind |
| React Aria Components | Khả năng tiếp cận rất tốt nhưng AI ít quen hơn, phải tự style nhiều hơn |
| Tự viết từ đầu | Tốn công cho dialog, menu, popover, select có khả năng tiếp cận đúng chuẩn |

#### Ràng buộc triển khai

1. Tailwind của Studio **KHÔNG ĐƯỢC** ảnh hưởng iframe Canvas (được bảo đảm bởi iframe, ADR-FE-04).

#### Truy vết

FR-05 đến FR-16.

---

### ADR-FE-14 — Thư viện hỗ trợ giao diện

**Trạng thái:** Accepted

#### Quyết định

| Nhu cầu | Thư viện |
|---|---|
| Panel co giãn (Library, Canvas, Inspector) | `react-resizable-panels` |
| Danh sách dài (Layer Tree, Data Source) | `@tanstack/react-virtual` |
| Chọn màu | `react-colorful` |
| Icon | `lucide-react` |
| Command palette | `cmdk` |
| Thông báo | `sonner` |
| Phím tắt | `tinykeys` |
| Ghép class | `clsx`, `tailwind-merge`, `class-variance-authority` (đi kèm shadcn) |

#### Ràng buộc triển khai

1. Phím tắt **BẮT BUỘC** khai báo tập trung trong một file, có tên hiển thị qua i18n, không trùng phím tắt của trình duyệt.

#### Truy vết

FR-06, FR-08, FR-09.

---

### ADR-FE-15 — Code editor và diff: CodeMirror 6

**Trạng thái:** Accepted

#### Quyết định

- **CodeMirror 6** để xem code xuất ra, với `@codemirror/lang-javascript`, `@codemirror/lang-html`, `@codemirror/lang-css`.
- **`@codemirror/merge`** để hiển thị diff (FR-35).
- Lazy-load khi mở màn hình Export.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Monaco Editor | Nặng (vài MB), cần web worker riêng, quá mức cần thiết cho xem và diff |
| Shiki | Chỉ tô màu, không có chế độ diff tương tác |

#### Truy vết

FR-35, FR-37.

---

## 10. ADR — ĐA NGÔN NGỮ

### ADR-FE-16 — i18n: i18next + react-i18next

**Trạng thái:** Accepted — chờ VG-12

#### Bối cảnh

Studio hỗ trợ tiếng Việt và tiếng Anh ngay từ đầu (C-17).

#### Quyết định

- **i18next** + **react-i18next**.
- Ngôn ngữ hỗ trợ: `vi`, `en`. Ngôn ngữ dự phòng: `en`.
- File dịch JSON theo namespace trong `src/i18n/locales/{vi,en}/`, đóng gói cùng Studio (không tải qua mạng).
- Khóa dịch có kiểu: khai báo `CustomTypeOptions` từ file `en` để TypeScript báo lỗi khi dùng khóa không tồn tại.
- Chọn ngôn ngữ lần đầu: `navigator.language` bắt đầu bằng `vi` thì dùng `vi`, còn lại dùng `en`. Người dùng đổi trong Settings, lựa chọn lưu vào cấu hình người dùng ở backend (ADR-BE-24).
- Đổi ngôn ngữ **không cần tải lại trang**.

Phạm vi bản địa hóa:

| Nội dung | Bản địa hóa? |
|---|---|
| Nhãn, menu, nút, thông báo, tooltip của Studio | **Có** |
| Thông báo lỗi | **Có**: server trả mã lỗi và tham số, Studio dịch (cập nhật ADR-BE-07) |
| Tên component trong Library | **Có** |
| Phản hồi của AI (tóm tắt, giải thích) | **Có**: AI được yêu cầu trả lời theo ngôn ngữ đang dùng (cập nhật ADR-BE-22) |
| Nội dung bản thiết kế của người dùng | Không (nội dung của người dùng) |
| Code xuất ra | Không |
| Ngày, số | Định dạng bằng `Intl` theo ngôn ngữ đang dùng |

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Lingui | Biên dịch trước, nhỏ, nhưng cần macro và bước build riêng. AI ít quen hơn |
| Paraglide JS | Có kiểu tốt, nhỏ, nhưng hệ sinh thái nhỏ hơn |
| FormatJS (react-intl) | Mạnh về ICU nhưng dài dòng hơn khi dùng |
| Tự viết từ điển | Thiếu số nhiều, nội suy, namespace, lazy-load |

#### Ràng buộc triển khai

1. **KHÔNG ĐƯỢC** viết chuỗi hiển thị cố định trong JSX. ESLint `eslint-plugin-i18next` (luật `no-literal-string`) chặn.
2. Mọi khóa **BẮT BUỘC** có ở cả `vi` và `en`. CI chạy kiểm tra khớp khóa (VG-12).
3. Giao diện **BẮT BUỘC** chịu được chuỗi dài hơn 40% so với tiếng Anh mà không vỡ bố cục (chữ tiếng Việt thường dài hơn).
4. Server **KHÔNG ĐƯỢC** trả câu thông báo đã dịch. Chỉ trả mã lỗi và tham số.

#### Truy vết

C-17, SRS Q-05, SRS 11.5.

---

## 11. ADR — GIAO TIẾP VÀ CHẤT LƯỢNG

### ADR-FE-17 — Giao tiếp với Local Backend

**Trạng thái:** Accepted

#### Quyết định

- **REST client** tự viết trong `src/api/http.ts`: bọc `fetch`, gắn token phiên, parse response bằng schema Zod dùng chung, chuyển lỗi thành kiểu `ApiError` có mã E0xx.
- **WebSocket client** tự viết trong `src/api/events.ts`: tự kết nối lại (backoff 0,5 s đến 10 s), phân phối sự kiện theo `type`, validate bằng Zod.
- Query hook của TanStack Query đặt trong `src/api/queries/`.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| axios, ky | Không cần thêm, `fetch` đủ dùng |
| `partysocket`, `reconnecting-websocket` | Logic kết nối lại đơn giản, tự viết tránh thêm phụ thuộc |
| Client sinh tự động từ OpenAPI | Schema Zod dùng chung đã đảm bảo kiểu ở hai đầu |

#### Ràng buộc triển khai

1. Response không khớp schema **BẮT BUỘC** coi là lỗi, không được dùng dữ liệu chưa kiểm tra.
2. Token phiên **KHÔNG ĐƯỢC** lưu trong `localStorage` (chi tiết SPEC-05).

#### Truy vết

ADR-BE-07, SEC-01.

---

### ADR-FE-18 — Kiểm thử

**Trạng thái:** Accepted

#### Quyết định

| Loại | Công nghệ | Áp dụng cho |
|---|---|---|
| Unit, component | **Vitest** + **@testing-library/react** + **happy-dom** | Store, control Inspector, thuật toán vị trí thả (với layout giả lập) |
| E2E | **Playwright** | Kéo thả, chọn, Inspector, AI xem trước và duyệt, Export |
| Visual | Playwright `toHaveScreenshot` | Canvas so với trang xuất ra (VG-09), giao diện vi/en |

#### Ràng buộc triển khai

1. Thuật toán vị trí thả **BẮT BUỘC** test E2E trên trình duyệt thật (layout thật), không chỉ trên happy-dom.
2. Mỗi màn hình **BẮT BUỘC** có ảnh chụp chuẩn cho cả `vi` và `en`.

#### Truy vết

AC-02, AC-03, AC-06, AC-09.

---

### ADR-FE-19 — Chất lượng code

**Trạng thái:** Accepted

#### Quyết định

ESLint dùng chung cấu hình gốc (ADR-BE-27), bổ sung:

| Plugin, luật | Mục đích |
|---|---|
| `eslint-plugin-react-hooks` | Đúng quy tắc hook, tương thích React Compiler |
| `eslint-plugin-i18next` (`no-literal-string`) | Thực thi ADR-FE-16 |
| `eslint-plugin-jsx-a11y` | Khả năng tiếp cận cơ bản |
| `no-restricted-imports` | Thực thi mục 3.4 (features không import lẫn nhau, không `fetch` ngoài `src/api/`) |

#### Truy vết

ADR-BE-27, ADR-FE-16.

---

### ADR-FE-20 — Soạn rich text: TipTap

**Trạng thái:** Accepted — chờ VG-14

#### Bối cảnh

`Text` và `Heading` có định dạng trong đoạn (SPEC-03 `TextRun`): đậm, nghiêng, gạch chân, gạch ngang, code, liên kết, màu. Tự viết trình soạn trên `contenteditable` rất dễ lỗi (vị trí con trỏ, dán, gộp định dạng).

#### Quyết định

- **TipTap** (`@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit`) chạy trên ProseMirror.
- Cấu hình chỉ bật: đoạn văn, xuống dòng cứng, `bold`, `italic`, `underline`, `strike`, `code`, `link`, `textStyle` + `color`. Tắt mọi node khối khác (heading, list, blockquote…), vì cấu trúc khối do Design Model quản lý.
- Trình soạn được gắn lên **phần tử trong iframe** (`editor.mount` trên element của iframe) khi double-click, và gỡ khi kết thúc. Không dùng TipTap ở nơi khác.
- Hai hàm thuần trong `features/canvas/rich-text/`: `runsToDoc(runs)` và `docToRuns(doc)` chuyển đổi hai chiều.

#### Phương án đã xem xét

| Phương án | Lý do không chọn |
|---|---|
| Lexical | Tốt, nhưng cần thêm phần tự viết để chạy trong iframe khác document |
| Slate | API thay đổi nhiều qua các phiên bản, hay lỗi với IME tiếng Việt |
| Tự viết trên `contenteditable` | Lỗi con trỏ, dán, bộ gõ tiếng Việt (Telex/VNI) |

#### Ràng buộc triển khai

1. **BẮT BUỘC** gõ tiếng Việt bằng bộ gõ (Telex, VNI qua Unikey/EVKey, bộ gõ macOS) không mất ký tự, không nhân đôi ký tự (VG-14).
2. Lazy-load TipTap lần đầu double-click, không nằm trong bundle khởi đầu (PB-17).

#### Truy vết

FR-16, SPEC-03 V-34, V-35.

---

## 12. NGÂN SÁCH HIỆU NĂNG PHÍA UI

Môi trường tham chiếu: theo SPEC-01.1 mục 11.1.

| Mã | Chỉ số | Mục tiêu | NFR |
|---|---|---|---|
| PB-13 | Cập nhật Overlay (hover, khung chọn) mỗi frame | ≤ 16 ms | NFR-01 |
| PB-14 | Đổi thuộc tính ở Inspector đến khi Canvas hiển thị xong | ≤ 100 ms (P95) | NFR-02 |
| PB-15 | Tính vị trí thả mỗi lần di chuyển chuột, trang 500 node | ≤ 8 ms | NFR-01 |
| PB-16 | Mở một trang 500 node đến khi Canvas render xong | ≤ 1 s | NFR-03 |
| PB-17 | Bundle khởi đầu của Studio | ≤ 600 KB gzip | — |
| PB-18 | Bộ nhớ tab Studio với workspace 50 trang | ≤ 500 MB | — |
| PB-19 | Đổi ngôn ngữ | ≤ 200 ms, không tải lại | — |
| PB-20 | Tính gợi ý tách layout dùng chung, workspace mẫu lớn (SPEC-04.5 mục 6a) | ≤ 1 s (P95), trong Web Worker | — |

Phân bổ PB-14:

| Bước | Ngân sách |
|---|---|
| `validate` + `apply` operation (PB-01) | 5 ms |
| Zustand thông báo + React render node bị đổi | 30 ms |
| Tailwind runtime sinh CSS cho class mới | 30 ms |
| Trình duyệt tính layout và vẽ | 30 ms |
| Dự phòng | 5 ms |

---

## 13. CÁC BÀI KIỂM CHỨNG BẮT BUỘC

Kết quả ghi vào mục 14.3.

### VG-09 — Canvas khớp code xuất ra

**Kiểm chứng cho:** ADR-FE-04, ADR-FE-05, ADR-FE-06. Định nghĩa ngưỡng cho NFR-11.

**Quy trình:** Design Document mẫu của VG-03 (SPEC-01.1). Chụp Canvas và chụp trang xuất ra (chạy bằng `vite build` + `vite preview`) ở 375, 768, 1280 px. Font giống nhau, tắt animation.

**Tiêu chí đạt:**

| Target Project | Tỷ lệ pixel khác tối đa |
|---|---|
| Tailwind v4 | ≤ 1% |
| Tailwind v3 | ≤ 3%, kèm danh sách khác biệt đã biết |

---

### VG-10 — Tailwind runtime trong iframe

**Kiểm chứng cho:** ADR-FE-05

**Tiêu chí đạt:**

- trang 500 node, thêm class mới: CSS sẵn sàng ≤ 30 ms;
- giá trị tùy ý (`p-[13px]`, `bg-[#123456]`) hoạt động;
- đổi `@theme` cập nhật toàn bộ Canvas;
- **không có request mạng** nào phát sinh (chạy với mạng bị ngắt).

---

### VG-11 — Kéo thả trong iframe

**Kiểm chứng cho:** ADR-FE-07, ADR-FE-09

**Quy trình:** kịch bản tự động trên trang có flex và grid lồng 6 cấp, ở zoom 50%, 100%, 200%, khung nhìn 375 và 1280 px.

**Tiêu chí đạt:**

- 100% kịch bản thả đúng vị trí mong đợi;
- vị trí không hợp lệ bị từ chối;
- PB-13, PB-15 đạt;
- kéo thả bằng bàn phím hoàn thành được kịch bản cơ bản.

---

### VG-12 — Đầy đủ bản dịch

**Kiểm chứng cho:** ADR-FE-16. Chạy trong CI ở mọi lần build.

**Tiêu chí đạt:**

- 100% khóa có ở cả `vi` và `en`, không khóa thừa;
- ESLint `no-literal-string` không có lỗi;
- ảnh chụp mọi màn hình ở `vi` không bị tràn chữ hay vỡ bố cục.

---

### VG-13 — React Compiler

**Kiểm chứng cho:** ADR-FE-02

**Tiêu chí đạt:** build và toàn bộ E2E đạt khi bật React Compiler. PB-14 không kém hơn so với khi tắt. Component phải tắt Compiler được liệt kê kèm lý do.

---

### VG-14 — Rich text trong iframe

**Kiểm chứng cho:** ADR-FE-20

**Tiêu chí đạt:**

- gắn và gỡ trình soạn trên phần tử trong iframe, ở zoom 50%, 100%, 200%;
- gõ tiếng Việt bằng Telex và VNI (Windows: Unikey, EVKey; macOS: bộ gõ mặc định) 200 ký tự có dấu: không mất, không lặp ký tự;
- dán nội dung từ Word và trang web: chỉ giữ định dạng cho phép;
- `docToRuns(runsToDoc(x))` bằng `x` với 1.000 mẫu ngẫu nhiên.

---

## 14. CHÍNH SÁCH PHỤ THUỘC

### 14.1. Danh sách phụ thuộc runtime được phép

| Package | Vai trò | ADR | Giấy phép |
|---|---|---|---|
| `react`, `react-dom` | Framework | ADR-FE-01 | MIT |
| `@reactcraft/model` | Schema, operation, styling (nội bộ) | ADR-FE-06 | — |
| `@tailwindcss/browser` | Tailwind runtime trong Canvas | ADR-FE-05 | MIT |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Kéo thả | ADR-FE-09 | MIT |
| `zustand` | Editor Store | ADR-FE-10 | MIT |
| `@tanstack/react-query` | State server | ADR-FE-11 | MIT |
| `@tanstack/react-router` | Điều hướng | ADR-FE-12 | MIT |
| `@tanstack/react-virtual` | Danh sách dài | ADR-FE-14 | MIT |
| `radix-ui` | Nền của shadcn/ui | ADR-FE-13 | MIT |
| `class-variance-authority` | Biến thể component | ADR-FE-14 | Apache-2.0 |
| `clsx`, `tailwind-merge` | Ghép class | ADR-FE-14 | MIT |
| `lucide-react` | Icon | ADR-FE-14 | ISC |
| `react-resizable-panels` | Panel co giãn | ADR-FE-14 | MIT |
| `react-colorful` | Chọn màu | ADR-FE-14 | MIT |
| `html-to-image` | Chụp Canvas gửi AI (tùy chọn) | SPEC-04.3 mục 2.2 | MIT |
| `cmdk` | Command palette | ADR-FE-14 | MIT |
| `sonner` | Thông báo | ADR-FE-14 | MIT |
| `tinykeys` | Phím tắt | ADR-FE-14 | MIT |
| `@codemirror/*`, `codemirror` | Code editor, diff | ADR-FE-15 | MIT |
| `i18next`, `react-i18next` | Đa ngôn ngữ | ADR-FE-16 | MIT |
| `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit` | Soạn rich text | ADR-FE-20 | MIT |
| `zod` | Validate response | ADR-FE-17 | MIT |

**Dev dependencies:** `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `vitest`, `@testing-library/react`, `happy-dom`, `@playwright/test`, `eslint-plugin-react-hooks`, `eslint-plugin-i18next`, `eslint-plugin-jsx-a11y`, cùng danh sách bổ sung ở SPEC-02 mục 15.

---

### 14.2. Quy tắc

Áp dụng toàn bộ quy tắc ở SPEC-01.1 mục 13.2, bổ sung:

1. Font dùng trong Studio **BẮT BUỘC** đóng gói cùng ứng dụng (C-18), có đủ ký tự tiếng Việt.
2. Thư viện mới phải dùng được **không cần mạng** khi chạy.

---

### 14.3. Bảng ghi phiên bản đã ghim

| Package | Phiên bản ghim | Ngày | VG đã chạy |
|---|---|---|---|
| react | | | |
| @tailwindcss/browser | | | |
| @dnd-kit/core | | | |
| zustand | | | |
| @tanstack/react-query | | | |
| @tanstack/react-router | | | |
| i18next | | | |
| codemirror | | | |

---

## 15. TRUY VẾT VỀ SRS v4.0

| Yêu cầu SRS | ADR / VG / PB liên quan |
|---|---|
| FR-05 Canvas | ADR-FE-04, ADR-FE-05, ADR-FE-08, VG-10 |
| FR-06 Component Library | ADR-FE-14 |
| FR-07 Kéo thả | ADR-FE-09, ADR-FE-10, VG-11, PB-15 |
| FR-08 Chọn và điều hướng | ADR-FE-07, ADR-FE-14, PB-13 |
| FR-09 Inspector | ADR-FE-06, ADR-FE-10, PB-14 |
| FR-10 Responsive | ADR-FE-04, ADR-FE-06, ADR-FE-08 |
| FR-11 Design Token | ADR-FE-05 |
| FR-12 Pages | ADR-FE-12 |
| FR-14 Undo/Redo | ADR-FE-10 |
| FR-18 đến FR-20 Data Sources | ADR-FE-11, ADR-FE-12 |
| FR-26 Xem trước và duyệt AI | ADR-FE-10 |
| FR-29 Minh bạch dữ liệu AI | ADR-FE-16 (hiển thị), SPEC-04 |
| FR-35 Diff | ADR-FE-15 |
| NFR-01, NFR-02 | ADR-FE-02, ADR-FE-07, ADR-FE-09, ADR-FE-10, mục 12 |
| NFR-11 Khớp giao diện | ADR-FE-05, ADR-FE-06, VG-09 |
| SRS 11.5 Đa ngôn ngữ | ADR-FE-16, VG-12 |

---

## 16. CÂU HỎI MỞ

| # | Câu hỏi | Giả định hiện tại | Giải quyết tại |
|---|---|---|---|
| Q-05 | Bộ phím tắt theo kiểu nào (giống Figma hay riêng)? | **Đã giải quyết:** gần giống Figma (SPEC-04.1 mục 15) | SPEC-04.1 |
| Q-06 | Thời điểm chuyển sang `@dnd-kit/react` | Khi bản đó ổn định | Xem xét lại ADR-FE-09 |

---

# SPEC-02 — QUY CHUẨN CODE & REPO

**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0, SPEC-01.1, SPEC-01.2  
**Phạm vi:** Cấu trúc repo, quy tắc đặt tên, quy chuẩn viết code, kiểm thử, định dạng, Git, review, CI

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

### 1.1. Mục đích

Phần này quy định **cách viết và tổ chức code** để toàn bộ mã nguồn trông như do một người viết, dù người viết là developer hay AI coding assistant.

Mỗi quy tắc có mã `QC-xx` để dẫn chiếu khi review: "vi phạm QC-14".

---

### 1.2. Phạm vi

**Trong phạm vi:** cấu trúc repo, đặt tên, ngôn ngữ trong code, TypeScript, React, server, xử lý lỗi, kiểm thử, định dạng, Git, Pull Request, review, CI, Definition of Done mức thay đổi code.

**Ngoài phạm vi:**

| Nội dung | Tài liệu |
|---|---|
| Lựa chọn công nghệ | SPEC-01.1, SPEC-01.2 |
| Schema, API, mã lỗi chi tiết | SPEC-03 |
| Định dạng code **xuất ra** cho người dùng | SPEC-01.1 ADR-BE-16 (theo cấu hình Target Project) |
| Definition of Done mức phase, cổng nghiệm thu | SPEC-07 |

---

## 2. CẤU TRÚC REPO

### 2.1. Cây thư mục gốc

```text
reactcraft/
├── .github/
│   ├── workflows/            # ci.yml, nightly.yml, release.yml
│   └── pull_request_template.md
├── .changeset/               # ghi chú thay đổi cho release
├── docs/
│   ├── srs.md                # SRS hiện hành
│   ├── spec.md               # Spec - ReactCraft Local (bản chính khi đã có repo)
│   └── construction/         # báo cáo thi công, tách khỏi spec (SPEC-07 mục 12.5)
│       ├── progress.md       # bảng tiến độ tổng (SPEC-07 mục 19.4)
│       ├── wp/               # báo cáo từng gói công việc (SPEC-07 mục 19.5)
│       ├── vg/               # báo cáo Verification Gate (SPEC-07 mục 19.1)
│       └── phases/           # báo cáo cổng nghiệm thu từng phase (SPEC-07 mục 19.2)
├── packages/
│   ├── model/
│   ├── server/
│   ├── studio/
│   └── cli/
├── templates/                # template Target Project mới
├── fixtures/
│   ├── target-projects/      # project React mẫu để xuất code
│   ├── backends/             # backend mẫu: express/, django/, openapi/
│   └── designs/              # Design Document mẫu
├── e2e/                      # test Playwright
├── scripts/                  # script phát triển: check-i18n, bench, release
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .node-version
├── .prettierrc.json
├── eslint.config.js
├── lefthook.yml
├── package.json              # script gốc, không có dependency runtime
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── LICENSE
├── SECURITY.md               # cách báo lỗ hổng (SPEC-05 mục 17.2)
└── README.md
```

---

### 2.2. Cấu trúc bên trong một package

```text
packages/<name>/
├── src/
│   ├── index.ts              # điểm export công khai duy nhất của package
│   └── ...                   # theo SPEC-01.1 mục 3.3, SPEC-01.2 mục 3.3
├── package.json
├── tsconfig.json             # extends ../../tsconfig.base.json
└── README.md                 # mục đích, cách chạy, cách test
```

| Mã | Quy tắc |
|---|---|
| QC-01 | Test unit đặt **cạnh file nguồn**: `editor-store.ts` → `editor-store.test.ts` |
| QC-02 | Test E2E đặt trong `e2e/` ở gốc repo, không nằm trong package |
| QC-03 | Package khác chỉ được import từ `index.ts` của package (qua tên `@reactcraft/<name>`). **KHÔNG ĐƯỢC** import đường dẫn sâu như `@reactcraft/model/src/...` |
| QC-04 | Ngoại lệ QC-03: `@reactcraft/model/styling` được khai báo là entry riêng trong `exports` của package |
| QC-05 | Bên trong một package dùng import tương đối. **KHÔNG** dùng file barrel (`index.ts` gom export) bên trong thư mục con |
| QC-06 | Fixture **KHÔNG ĐƯỢC** sửa trực tiếp khi test. Test sao chép fixture vào thư mục tạm rồi mới thao tác |

---

### 2.3. Script gốc

`package.json` ở gốc **BẮT BUỘC** có các script sau, chạy được trên cả Windows và macOS/Linux:

| Script | Việc làm |
|---|---|
| `pnpm dev` | Chạy server (watch) và Studio (Vite dev server, proxy `/api`) |
| `pnpm build` | Build toàn bộ package |
| `pnpm lint` | ESLint toàn repo |
| `pnpm typecheck` | `tsc --noEmit` cho mọi package |
| `pnpm test` | Vitest toàn repo |
| `pnpm test:e2e` | Playwright |
| `pnpm check:i18n` | Kiểm tra khớp khóa `vi`/`en` (VG-12) |
| `pnpm bench` | Benchmark ngân sách hiệu năng |
| `pnpm format` | Prettier toàn repo |
| `pnpm trace` | Báo cáo truy vết mã spec → test (QC-94, SPEC-07 mục 11.4) |

| Mã | Quy tắc |
|---|---|
| QC-07 | Script **KHÔNG ĐƯỢC** dùng lệnh chỉ có trên một hệ điều hành (`rm -rf`, `cp`, biến môi trường kiểu `FOO=1 cmd`). Dùng script Node trong `scripts/` khi cần |

---

## 3. NGÔN NGỮ TRONG MÃ NGUỒN

| Mã | Nội dung | Ngôn ngữ |
|---|---|---|
| QC-08 | Tên biến, hàm, kiểu, file, thư mục | **Tiếng Anh** |
| QC-09 | Comment trong code, TSDoc | **Tiếng Anh** |
| QC-10 | Commit message, tên branch, tiêu đề và mô tả PR | **Tiếng Anh** |
| QC-11 | Chuỗi hiển thị cho người dùng | Qua i18n (`vi`, `en`), **KHÔNG** viết trong code (ADR-FE-16) |
| QC-12 | Log và thông điệp lỗi nội bộ (dành cho developer) | **Tiếng Anh** |
| QC-13 | Tài liệu SRS, Spec trong `docs/` | Tiếng Việt (giữ thuật ngữ kỹ thuật tiếng Anh) |

---

## 4. QUY TẮC ĐẶT TÊN

### 4.1. File và thư mục

| Mã | Đối tượng | Quy tắc | Ví dụ |
|---|---|---|---|
| QC-14 | Mọi file mã nguồn, kể cả component React | `kebab-case` | `layer-tree.tsx`, `editor-store.ts`, `parse-js.ts` |
| QC-15 | Thư mục | `kebab-case` | `backend-context/`, `data-sources/` |
| QC-16 | File test | `<tên>.test.ts(x)`, `<tên>.bench.ts`, E2E: `<luồng>.e2e.ts` | `apply-operation.test.ts`, `drag-drop.e2e.ts` |
| QC-17 | File schema Zod | `<tên>.schema.ts` | `design-node.schema.ts` |
| QC-18 | File dịch | `locales/<lang>/<namespace>.json`, namespace `kebab-case` | `locales/vi/inspector.json` |

---

### 4.2. Định danh trong code

| Mã | Đối tượng | Quy tắc | Ví dụ |
|---|---|---|---|
| QC-19 | Biến, hàm, thuộc tính | `camelCase` | `selectedNodeId`, `applyOperation()` |
| QC-20 | Component React, kiểu, interface, class | `PascalCase` | `LayerTree`, `DesignNode`, `ExportPlan` |
| QC-21 | Interface **KHÔNG** có tiền tố `I` | | `FileSystemPort`, không phải `IFileSystemPort` |
| QC-22 | Props của component | `<TênComponent>Props` | `LayerTreeProps` |
| QC-23 | Hook | `use<Tên>` | `useSelectedNode` |
| QC-24 | Schema Zod và kiểu suy ra | `<Tên>Schema` và `type <Tên> = z.infer<typeof <Tên>Schema>` | `DesignNodeSchema`, `DesignNode` |
| QC-25 | Hằng số thật sự bất biến ở cấp module | `UPPER_SNAKE_CASE` | `MAX_UNDO_STEPS` |
| QC-26 | Biến boolean | Tiền tố `is`, `has`, `can`, `should` | `isDragging`, `hasConflict` |
| QC-27 | Hàm xử lý sự kiện trong component | `handle<Sự kiện>`. Prop nhận callback: `on<Sự kiện>` | `handleDrop`, `onSelect` |
| QC-28 | Port, adapter | `<Tên>Port`, `<Công nghệ><Tên>Adapter` | `FileWatcherPort`, `ChokidarFileWatcherAdapter` |

---

### 4.3. Định danh ngoài code

| Mã | Đối tượng | Quy tắc | Ví dụ |
|---|---|---|---|
| QC-29 | Đường dẫn REST | `/api/v1/<danh-từ-số-nhiều>`, `kebab-case` | `/api/v1/data-sources`, `/api/v1/exports/{id}/apply` |
| QC-30 | Trường JSON (API, file workspace) | `camelCase` | `baseRevision`, `schemaVersion` |
| QC-31 | Loại sự kiện WebSocket | `<miền>.<hành động>`, chữ thường | `scan.progress`, `export.completed` |
| QC-32 | Tên Design Operation | `camelCase`, động từ | `insert`, `setProps`, `page.rename` |
| QC-33 | Khóa i18n | `<namespace>:<nhóm>.<khóa>`, `camelCase` | `inspector:spacing.padding` |
| QC-34 | Mã lỗi | `E` + 3 chữ số, theo SPEC-03 | `E010` |
| QC-35 | Biến môi trường | `REACTCRAFT_<TÊN>` (trừ key chuẩn của provider như `OPENAI_API_KEY`) | `REACTCRAFT_LOG_LEVEL` |

---

## 5. QUY CHUẨN TYPESCRIPT

| Mã | Quy tắc |
|---|---|
| QC-36 | Tuân thủ ADR-BE-02: `strict`, không `any`, không `@ts-ignore` |
| QC-37 | **Chỉ dùng named export.** **KHÔNG** dùng `export default`, trừ file cấu hình công cụ bắt buộc (`vite.config.ts`, `eslint.config.js`, `playwright.config.ts`) |
| QC-38 | **KHÔNG** dùng `enum` của TypeScript. Dùng union chuỗi hoặc object `as const` |
| QC-39 | Dùng `type` cho dữ liệu và union. Dùng `interface` cho hợp đồng có hiện thực (port) |
| QC-40 | Dùng `undefined` cho "không có giá trị". **KHÔNG** dùng `null` trong code TypeScript, trừ khi API bên ngoài bắt buộc. Trong JSON, trường không có giá trị thì bỏ hẳn |
| QC-41 | Dữ liệu của Design Model khai báo `readonly`. **KHÔNG ĐƯỢC** sửa tham số đầu vào của hàm |
| QC-42 | Dùng `async`/`await`. **KHÔNG** viết chuỗi `.then()` |
| QC-43 | Import kiểu bằng `import type`. Thứ tự import do `eslint-plugin-simple-import-sort` sắp xếp tự động |
| QC-44 | Hàm **NÊN** ≤ 50 dòng, file **NÊN** ≤ 400 dòng. Vượt thì tách (ESLint cảnh báo) |
| QC-45 | Export công khai của `@reactcraft/model` và mọi port **BẮT BUỘC** có TSDoc mô tả ý nghĩa, tham số, lỗi có thể trả về |
| QC-46 | Comment giải thích **tại sao**, không giải thích **làm gì**. `TODO` **BẮT BUỘC** kèm số issue: `// TODO(#42): ...` |
| QC-47 | **KHÔNG** để code bị comment out. Xóa đi, Git đã lưu lịch sử |

---

## 6. XỬ LÝ LỖI

### 6.1. Hai loại lỗi

| Loại | Ví dụ | Cách xử lý |
|---|---|---|
| **Lỗi nghiệp vụ** (có thể đoán trước) | Operation không hợp lệ, xung đột export, file workspace hỏng, AI trả sai schema | Trả về `Result` |
| **Lỗi lập trình** (bug) | Vi phạm bất biến, trạng thái không thể xảy ra | Ném exception |

---

### 6.2. Kiểu Result

```ts
// @reactcraft/model — phác thảo, chữ ký chính thức ở SPEC-03
export type Result<T, E extends AppError = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type AppError = {
  readonly code: ErrorCode;                  // 'E005', 'E010', ...
  readonly params?: Readonly<Record<string, string | number>>;
  readonly cause?: unknown;                  // không gửi xuống client
};
```

| Mã | Quy tắc |
|---|---|
| QC-48 | Hàm core có thể thất bại vì lý do nghiệp vụ **BẮT BUỘC** trả `Result`, **KHÔNG** ném exception |
| QC-49 | **KHÔNG ĐƯỢC** nuốt lỗi: `catch` rỗng hoặc chỉ `console.log` là vi phạm |
| QC-50 | Lớp adapter (route HTTP) chuyển `Result` lỗi thành response có mã E0xx. Exception không bắt được trả E013 (Internal Error) và ghi log đầy đủ |
| QC-51 | `cause` và stack trace **KHÔNG ĐƯỢC** gửi xuống Studio UI |
| QC-52 | Core **KHÔNG ĐƯỢC** gọi `process.exit()`. Chỉ `packages/cli` được phép |

---

## 7. QUY CHUẨN REACT (STUDIO)

| Mã | Quy tắc |
|---|---|
| QC-53 | Chỉ dùng function component |
| QC-54 | Một file một component được export. Component con riêng tư nhỏ (< 30 dòng) được để chung file |
| QC-55 | Component chỉ lo hiển thị và gọi hành động. Logic xử lý đặt trong hook, store, hoặc `@reactcraft/model` |
| QC-56 | Class CSS ghép bằng hàm `cn()` (`clsx` + `tailwind-merge`). **KHÔNG** dùng `style` inline, trừ tọa độ tính động (Overlay, kéo thả, zoom) |
| QC-57 | Mọi chuỗi hiển thị qua `t()` của i18next (QC-11) |
| QC-58 | Phần tử tương tác **BẮT BUỘC** dùng được bằng bàn phím và có nhãn truy cập (`aria-label` qua i18n nếu không có chữ) |
| QC-59 | Đọc Editor Store qua selector hẹp (ADR-FE-10). **KHÔNG** đăng ký cả document |
| QC-60 | **KHÔNG** viết `useMemo`, `useCallback`, `memo` khi chưa có đo đạc chứng minh cần (ADR-FE-02) |

---

## 8. QUY CHUẨN SERVER

| Mã | Quy tắc |
|---|---|
| QC-61 | Route Fastify chỉ làm ba việc: parse request bằng Zod, gọi service của core, chuyển kết quả thành response (ADR-BE-06) |
| QC-62 | Service trong core nhận port qua tham số của hàm tạo (factory). **KHÔNG** dùng DI container, **KHÔNG** dùng biến toàn cục để giữ port |

```ts
// Ví dụ đúng QC-62
export function createExportService(deps: {
  fs: FileSystemPort;
  logger: LoggerPort;
  events: EventBusPort;
}) {
  return {
    async plan(input: ExportInput): Promise<Result<ExportPlan>> { /* ... */ },
    async apply(planId: string): Promise<Result<ExportReport>> { /* ... */ },
  };
}
```

| Mã | Quy tắc |
|---|---|
| QC-63 | Mọi thao tác file đi qua `FileSystemPort`. **KHÔNG** import `node:fs` trong `core/` |
| QC-64 | Mọi tác vụ dài nhận `AbortSignal` và kiểm tra nó giữa các bước (ADR-BE-01) |
| QC-65 | Ghi log qua `LoggerPort` với trường có cấu trúc (`logger.info({ exportId, files }, 'export applied')`), không ghép chuỗi |

---

## 9. QUY CHUẨN KIỂM THỬ

| Mã | Quy tắc |
|---|---|
| QC-66 | Tên test mô tả hành vi bằng tiếng Anh: `it('rejects insert into a non-container node')` |
| QC-67 | Cấu trúc Arrange, Act, Assert, ngăn cách bằng dòng trống |
| QC-68 | **KHÔNG** dùng snapshot tự động, trừ golden file của codegen (ADR-BE-26) |
| QC-69 | Test **KHÔNG ĐƯỢC** phụ thuộc thứ tự chạy, mạng, giờ hệ thống. Thời gian dùng đồng hồ giả của Vitest |
| QC-70 | Sửa bug **BẮT BUỘC** kèm test tái hiện bug đó |
| QC-93 | Test hiện thực một quy tắc có mã thì tên test kết thúc bằng mã trong ngoặc vuông: `it('rejects insert into a non-container node [V-10]')`. Nhiều mã cách nhau bởi dấu phẩy: `[R-DD-03, V-11]`. Tên vẫn mô tả hành vi bằng tiếng Anh (QC-66) |
| QC-94 | `pnpm trace` đọc mã R-xx, V-xx, S-xx, AC-xx từ `docs/spec.md` và từ tên test (Vitest, Playwright), báo: mã trong phạm vi phase chưa có test, mã trong test không tồn tại trong spec (lỗi CI). Phạm vi theo `scripts/trace-scope.json` (SPEC-07 mục 11.4) |

Ngưỡng độ phủ dòng lệnh tối thiểu (CI chặn nếu thấp hơn):

| Phạm vi | Ngưỡng |
|---|---|
| `packages/model` | 90% |
| `packages/server/src/core` | 80% |
| `packages/studio/src/stores`, `features/dnd` | 80% |
| Toàn repo | 70% |

---

## 10. ĐỊNH DẠNG VÀ CẤU HÌNH EDITOR

### 10.1. Prettier (cho code của ReactCraft)

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

`prettier-plugin-tailwindcss` chỉ áp dụng cho `packages/studio`: cấu hình trong file Prettier riêng của `packages/studio` (thêm cùng Studio ở SPEC-07 WP-0.03, khi đã có Tailwind). File gốc ở trên không khai báo plugin.

`docs/srs.md`, `docs/spec.md`, `fixtures/`, `templates/` nằm trong `.prettierignore`: tài liệu spec định dạng tay (Prettier sẽ căn lại mọi bảng), fixture và template giữ định dạng của project gốc.

---

### 10.2. EditorConfig và Git attributes

```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

```text
# .gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.wasm binary
*.woff2 binary
```

| Mã | Quy tắc |
|---|---|
| QC-71 | Mọi file văn bản trong repo dùng **LF** và **UTF-8 không BOM**. `.gitattributes` bảo đảm điều này trên Windows |
| QC-72 | **KHÔNG** commit file định dạng sai. Hook `pre-commit` chạy Prettier trên file đã stage |

---

## 11. GIT

> Khi thi công ở **chế độ local** (SPEC-07 mục 12.6), các quy tắc về GitHub, Pull Request, bảo vệ nhánh và CI ở mục 11 đến 13 áp dụng theo bảng thay thế ở SPEC-07 mục 12.6.1. Quy tắc commit message (mục 11.2) và Git hooks (mục 11.3) vẫn áp dụng.

### 11.1. Mô hình nhánh

- **Trunk-based**: nhánh chính `main` luôn build được và qua toàn bộ CI.
- Mỗi thay đổi làm trên nhánh ngắn hạn, merge vào `main` qua Pull Request.

| Mã | Quy tắc |
|---|---|
| QC-73 | `main` được bảo vệ: **KHÔNG** push trực tiếp, **KHÔNG** force push |
| QC-74 | Tên nhánh: `<loại>/<mô-tả-ngắn>`, `kebab-case`. Có issue thì thêm số: `feat/42-layer-tree-dnd` |
| QC-75 | Nhánh **NÊN** sống không quá 3 ngày |

Loại nhánh: `feat`, `fix`, `refactor`, `test`, `docs`, `spec`, `chore`, `perf`, `build`, `ci`, `spike` (chỉ để chạy VG, không bao giờ merge vào `main`, SPEC-07 CW-21).

---

### 11.2. Commit message: Conventional Commits

```text
<type>(<scope>): <summary>

<body: why, not what>

Refs: <mã spec hoặc SRS>
```

| Thành phần | Quy tắc | Giá trị |
|---|---|---|
| `type` | Bắt buộc | Như loại nhánh ở 11.1 |
| `scope` | Bắt buộc | `model`, `server`, `studio`, `cli`, `e2e`, `fixtures`, `repo`, `docs` |
| `summary` | Bắt buộc, tiếng Anh, thể mệnh lệnh, chữ thường, không dấu chấm cuối, ≤ 72 ký tự | `add invert for move operation` |
| `Refs` | Bắt buộc khi thay đổi hiện thực một yêu cầu | `Refs: ADR-BE-09, FR-14` |

Ví dụ:

```text
feat(model): add invert for move operation

Undo of a cross-container move must restore the original index,
not append to the end of the source container.

Refs: ADR-BE-09, FR-14
```

| Mã | Quy tắc |
|---|---|
| QC-76 | Commit message được kiểm tra bằng `commitlint` (cấu hình `@commitlint/config-conventional` + danh sách scope ở trên) qua hook `commit-msg` |
| QC-77 | Thay đổi phá vỡ tương thích (schema Design Model, API, cấu hình) **BẮT BUỘC** có `!` sau scope và mục `BREAKING CHANGE:` trong body |
| QC-78 | **KHÔNG ĐƯỢC** commit secrets, API key, file `.env`, dữ liệu cá nhân |

---

### 11.3. Git hooks: lefthook

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    format:
      glob: "*.{ts,tsx,js,json,md,css}"
      run: pnpm prettier --write {staged_files}
      stage_fixed: true
    lint:
      glob: "*.{ts,tsx}"
      run: pnpm eslint {staged_files}
commit-msg:
  commands:
    commitlint:
      run: pnpm commitlint --edit {1}
```

---

### 11.4. Phiên bản và phát hành

| Mã | Quy tắc |
|---|---|
| QC-79 | Phiên bản theo **SemVer**. Giai đoạn phát triển dùng `0.x.y` |
| QC-80 | Mỗi PR có thay đổi ảnh hưởng người dùng **BẮT BUỘC** kèm một file changeset (`pnpm changeset`) |
| QC-81 | Phát hành tạo tag `v<phiên bản>` và cập nhật `CHANGELOG.md` tự động từ changeset |

---

## 12. PULL REQUEST VÀ REVIEW

### 12.1. Mẫu Pull Request

```markdown
## What
<thay đổi gì, 1–3 câu>

## Why
<lý do, liên kết issue>

## Spec references
<mã ADR / FR / AC / QC liên quan>

## How to verify
<các bước kiểm tra thủ công nếu có>

## Screenshots
<bắt buộc khi đổi giao diện: cả vi và en>

## Checklist
- [ ] Tests added or updated
- [ ] i18n keys added for vi and en
- [ ] No new runtime dependency (or spec updated)
- [ ] Changeset added (if user-facing)
- [ ] AI-assisted: yes / no
```

---

### 12.2. Quy tắc PR

| Mã | Quy tắc |
|---|---|
| QC-82 | PR **NÊN** ≤ 400 dòng thay đổi (không tính file sinh tự động, lockfile, golden file). Lớn hơn thì tách |
| QC-83 | Một PR giải quyết **một** việc |
| QC-84 | Merge bằng **squash merge**. Tiêu đề PR theo định dạng commit (11.2) vì trở thành commit trên `main` |
| QC-85 | PR chỉ được merge khi mọi CI bắt buộc (mục 13) đạt |
| QC-86 | Thêm runtime dependency **BẮT BUỘC** cập nhật SPEC-01.1 mục 13.1 hoặc SPEC-01.2 mục 14.1 trong cùng PR hoặc PR trước đó |

---

### 12.3. Danh sách kiểm tra khi review

Người review (hoặc tác giả tự review khi làm một mình) kiểm tra theo thứ tự:

| # | Hạng mục | Câu hỏi |
|---|---|---|
| 1 | Đúng spec | Thay đổi có đúng FR / ADR được dẫn chiếu? Có vi phạm quy tắc **BẮT BUỘC** nào? |
| 2 | Ranh giới kiến trúc | Có import sai lớp (SPEC-01.1 mục 3.2, SPEC-01.2 mục 3.4)? |
| 3 | Design Model | Thay đổi Design Model có đi qua Design Operation? Có `invert` và test tính chất? |
| 4 | Lỗi | Lỗi nghiệp vụ trả `Result`? Có lỗi bị nuốt? |
| 5 | Bảo mật | Có ghi file ngoài phạm vi cho phép? Có đọc secrets? Có log dữ liệu nhạy cảm? |
| 6 | Kiểm thử | Có test cho hành vi mới và cho bug đã sửa? |
| 7 | i18n | Có chuỗi viết cứng? Đủ khóa `vi` và `en`? |
| 8 | Hiệu năng | Có ảnh hưởng ngân sách PB-xx? Có đo khi cần? |
| 9 | Đặt tên, định dạng | Theo mục 3, 4, 5? |

---

### 12.4. Code do AI hỗ trợ viết

| Mã | Quy tắc |
|---|---|
| QC-87 | Được phép dùng AI coding assistant. Người tạo PR **chịu trách nhiệm hoàn toàn** về code, như code tự viết |
| QC-88 | Code do AI viết qua đúng quy trình review và CI như mọi code khác |
| QC-89 | Khi giao việc cho AI, **NÊN** đưa kèm phần spec liên quan (ADR, FR, QC) làm ngữ cảnh |
| QC-90 | **KHÔNG ĐƯỢC** đưa secrets, API key, dữ liệu thật của người dùng vào prompt |

---

## 13. CI: GITHUB ACTIONS

### 13.1. Workflow

| Workflow | Kích hoạt | Nội dung |
|---|---|---|
| `ci.yml` | Mỗi PR và mỗi push vào `main` | Các job bắt buộc ở 13.2 |
| `nightly.yml` | Hằng đêm | Benchmark (`pnpm bench`), so với ngân sách PB-xx, báo cáo xu hướng |
| `release.yml` | Merge PR phát hành của changesets | Build, phát hành npm, tạo tag |

---

### 13.2. Job bắt buộc trong `ci.yml`

| Job | Môi trường | Lệnh |
|---|---|---|
| install | Windows, Ubuntu · Node 22, 24 | `pnpm install --frozen-lockfile` |
| lint | Ubuntu · Node 24 | `pnpm lint` |
| typecheck | Ubuntu · Node 24 | `pnpm typecheck` |
| test | Windows, Ubuntu · Node 22, 24 | `pnpm test --coverage` (kiểm tra ngưỡng mục 9) |
| i18n | Ubuntu · Node 24 | `pnpm check:i18n` |
| build | Windows, Ubuntu · Node 24 | `pnpm build` |
| e2e | Windows, Ubuntu · Node 24 | `pnpm test:e2e` (Chromium, Firefox) |
| export-compat | Ubuntu · Node 24 | Xuất Design Document mẫu vào hai Target Project mẫu, chạy `tsc` và `vite build` (VG-03) |
| audit | Ubuntu · Node 24 | `pnpm audit --audit-level=high` |

| Mã | Quy tắc |
|---|---|
| QC-91 | CI **KHÔNG ĐƯỢC** gọi AI provider thật (ADR-BE-26) |
| QC-92 | Job thất bại không được bỏ qua bằng cách tắt test. Test không ổn định (flaky) phải được sửa hoặc đánh dấu kèm issue trong vòng 1 ngày |

---

## 14. DEFINITION OF DONE CHO MỘT THAY ĐỔI CODE

Một thay đổi (một PR) được coi là xong khi **tất cả** điều sau đúng:

1. Đúng yêu cầu và quy tắc của spec được dẫn chiếu.
2. Qua toàn bộ job CI bắt buộc trên Windows và Ubuntu.
3. Có test cho hành vi mới. Độ phủ không giảm dưới ngưỡng.
4. Không có chuỗi hiển thị viết cứng. Đủ khóa `vi` và `en`.
5. Thay đổi giao diện có ảnh chụp `vi` và `en` trong PR.
6. Không thêm dependency ngoài danh sách đã duyệt.
7. Có changeset nếu ảnh hưởng người dùng.
8. Đã review theo danh sách 12.3.
9. Tài liệu (`README` của package, TSDoc) được cập nhật nếu thay đổi API công khai.

Definition of Done mức phase và cổng nghiệm thu thuộc SPEC-07.

---

## 15. PHỤ THUỘC PHÁT TRIỂN BỔ SUNG

Các dev dependency sau được thêm vào danh sách ở SPEC-01.1 mục 13.1 và SPEC-01.2 mục 14.1:

| Package | Vai trò | Mã | Giấy phép |
|---|---|---|---|
| `lefthook` | Git hooks | QC-72, QC-76 | MIT |
| `@commitlint/cli`, `@commitlint/config-conventional` | Kiểm tra commit message | QC-76 | MIT |
| `@changesets/cli` | Phiên bản, changelog | QC-80, QC-81 | MIT |
| `eslint-plugin-simple-import-sort` | Sắp xếp import | QC-43 | MIT |
| `prettier-plugin-tailwindcss` | Sắp xếp class Tailwind trong Studio | 10.1 | MIT |
| `@vitest/coverage-v8` | Đo độ phủ | Mục 9 | MIT |
| `@eslint/js` | Bộ luật khuyến nghị của ESLint dùng trong `eslint.config.js` | ADR-BE-27 | MIT |

---

## 16. CÂU HỎI MỞ

| # | Câu hỏi | Giả định hiện tại |
|---|---|---|
| Q-07 | Repo đặt trên GitHub (public hay private)? | GitHub. Quyền truy cập quyết định khi tạo repo |
| Q-08 | Khi có repo, file Spec chính nằm ở đâu? | **Đã giải quyết (2026-10-11):** bản chính là `docs/spec.md` trong repo `reactcraft`. Bản trong thư mục `PRJ/SPEC` ngừng cập nhật |
| Q-17 | Giấy phép của ReactCraft | **Đã quyết định:** MIT (file `LICENSE` trong repo) |

---

# SPEC-03 — INTERFACE: DESIGN MODEL, OPERATION, API, SỰ KIỆN, MÃ LỖI

**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0 (mục 7, 8, 9, 13), SPEC-01.1, SPEC-01.2, SPEC-02  
**Phạm vi:** Hợp đồng dữ liệu giữa mọi thành phần: Design Model, file workspace, Design Operation, API REST, sự kiện WebSocket, mã lỗi

---

## 1. MỤC ĐÍCH VÀ QUY ƯỚC

### 1.1. Mục đích

Phần này là **hợp đồng chung** của hệ thống. Studio UI, Local Backend, AI và bộ sinh code đều đọc và ghi đúng các cấu trúc ở đây.

- **Phần A** (mục 2 đến 8): Design Model, file workspace, Design Operation.
- **Phần B** (mục 9 đến 12): API REST, job, sự kiện WebSocket.
- **Mục 13**: danh mục mã lỗi.

---

### 1.2. Quy ước trình bày

| Quy ước | Ý nghĩa |
|---|---|
| Kiểu viết bằng cú pháp TypeScript | Mô tả ngữ nghĩa. Bản hiện thực chính thức là schema Zod trong `@reactcraft/model` (ADR-BE-08), tên theo QC-24 |
| `?` sau tên trường | Trường không bắt buộc. Không có giá trị thì **bỏ hẳn trường** (QC-40) |
| `V-xx` | Quy tắc kiểm tra tính hợp lệ của Design Operation |
| Mọi schema | `strict`: trường lạ là lỗi (ADR-BE-08) |

---

## PHẦN A — DESIGN MODEL (MỤC 2 ĐẾN 8)

## 2. KIỂU CƠ SỞ

### 2.1. Định danh

Theo ADR-BE-10.

| Kiểu | Mẫu (regex) | Ví dụ |
|---|---|---|
| `NodeId` | `^n_[A-Za-z0-9_-]{10}$` | `n_V1StGXR8_Z` |
| `PageId` | `^p_[A-Za-z0-9_-]{10}$` | `p_4f90d13a2b` |
| `ComponentId` | `^c_[A-Za-z0-9_-]{10}$` | `c_9kLm2xQw7e` |
| `DataSourceId` | `^ds_[a-z0-9_]{1,40}$` | `ds_products` |
| `EndpointId` | `^ep_[A-Za-z0-9_-]{10}$` | `ep_Qw3rTy8uIo` |
| `BackendId` | `^b_[A-Za-z0-9_-]{10}$` | `b_Zx81LmPq0a` |
| `JobId` | `^j_[A-Za-z0-9_-]{12}$` | `j_8fK2pQx9Lm1a` |

---

### 2.2. Breakpoint và trạng thái

```ts
type ResponsiveKey = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type Breakpoint = 'base' | ResponsiveKey;
type ResponsiveMode = 'desktop-first' | 'mobile-first';
type InteractionState = 'hover' | 'focus' | 'disabled';
```

| Khóa | Mốc | Ý nghĩa khi `desktop-first` | Ý nghĩa khi `mobile-first` |
|---|---|---|---|
| `base` | — | Giá trị ở **khung chuẩn**, áp dụng mọi độ rộng nếu không bị ghi đè | Giá trị ở **khung chuẩn**, áp dụng mọi độ rộng nếu không bị ghi đè |
| `2xl` | 1536 px | Ghi đè khi màn hình **hẹp hơn** 1536 px (`max-2xl:`) | Ghi đè khi màn hình **rộng từ** 1536 px (`2xl:`) |
| `xl` | 1280 px | Hẹp hơn 1280 px (`max-xl:`) | Rộng từ 1280 px (`xl:`) |
| `lg` | 1024 px | Hẹp hơn 1024 px (`max-lg:`) | Rộng từ 1024 px (`lg:`) |
| `md` | 768 px | Hẹp hơn 768 px (`max-md:`) | Rộng từ 768 px (`md:`) |
| `sm` | 640 px | Hẹp hơn 640 px (`max-sm:`) | Rộng từ 640 px (`sm:`) |

Mốc khớp breakpoint mặc định của Tailwind. Thứ tự ưu tiên:

- `desktop-first`: khóa có mốc **nhỏ hơn** thắng (`sm` ghi đè `md` khi cả hai cùng áp dụng).
- `mobile-first`: khóa có mốc **lớn hơn** thắng (`xl` ghi đè `lg`).

**Mặc định của workspace mới là `desktop-first`** với khung chuẩn Desktop 1440 × 900.

---

### 2.2a. Khung thiết kế (frame) và ánh xạ sang khóa responsive

```ts
type Frame = {
  readonly id: string;                         // ^[a-z0-9-]{1,32}$
  readonly label: string;                      // 1..32 ký tự
  readonly width: number;                      // 320..3840
  readonly height: number;                     // 320..2160
};
```

Khóa responsive mà một thao tác sửa ở khung có độ rộng `w` ghi vào:

| Chế độ | Quy tắc |
|---|---|
| `desktop-first` | `band(w)` = khóa **nhỏ nhất** có mốc **lớn hơn** `w`, hoặc `base` nếu `w ≥ 1536` |
| `mobile-first` | `band(w)` = khóa **lớn nhất** có mốc **nhỏ hơn hoặc bằng** `w`, hoặc `base` nếu `w < 640` |

Sửa ở khung có `band(w) = band(khung chuẩn)` thì ghi vào `base`. Sửa ở khung khác thì ghi vào khóa `band(w)`.

Ví dụ `desktop-first`, khung chuẩn 1440 (band `2xl`):

| Khung | `band` | Sửa ghi vào |
|---|---|---|
| Desktop 1440 | `2xl` | `base` |
| Laptop 1280 | `2xl` | `base` |
| Tablet 768 | `lg` | `lg` (`max-lg:`) |
| Mobile 375 | `sm` | `sm` (`max-sm:`) |

| Mã | Quy tắc |
|---|---|
| V-07 | `desktop-first`: khung khác **KHÔNG** được rộng hơn khung chuẩn. `mobile-first`: khung khác **KHÔNG** được hẹp hơn khung chuẩn |
| V-08 | Đổi `responsiveMode` chỉ được phép khi **không** node nào có `responsive`. Ngược lại từ chối với E005 |
| V-09 | Danh sách khung có 1..8 khung, đúng một khung chuẩn, `id` không trùng |

---

### 2.3. Giá trị thiết kế

```ts
// Tham chiếu Design Token
type TokenGroup =
  | 'color' | 'spacing' | 'radius' | 'shadow'
  | 'fontSize' | 'fontWeight' | 'lineHeight' | 'fontFamily';
type TokenRef = `token:${TokenGroup}.${string}`;    // tên token: ^[a-z0-9]+(-[a-z0-9]+)*$

// Độ dài tuyệt đối
type Px = { readonly px: number };                 // 0 ≤ px ≤ 10000, tối đa 2 chữ số thập phân

type Spacing = TokenRef | Px;
type Color = TokenRef | `#${string}`;              // #RRGGBB hoặc #RRGGBBAA, chữ thường

type SizeValue =
  | 'hug'                                          // co theo nội dung (w-fit)
  | 'fill'                                         // giãn đầy container (w-full / flex-1)
  | { readonly fixed: Px }
  | { readonly percent: number };                  // 1..100

type LimitValue = Px | 'none';
```

| Mã | Quy tắc |
|---|---|
| V-01 | `TokenRef` phải trỏ tới token tồn tại trong nhóm tương ứng. Nhóm phải khớp loại thuộc tính (ví dụ `padding` chỉ nhận `token:spacing.*`) |
| V-02 | Màu dạng hex **BẮT BUỘC** viết thường, đủ 6 hoặc 8 ký tự |

---

## 3. DESIGN DOCUMENT VÀ FILE WORKSPACE

### 3.1. Tổng quan

```ts
type DesignDocument = {
  readonly workspace: WorkspaceMeta;
  readonly tokens: DesignTokens;
  readonly pages: Readonly<Record<PageId, Page>>;
  readonly components: Readonly<Record<ComponentId, UserComponent>>;
  readonly dataSources: DataSourceCatalog;
};
```

Ánh xạ sang file (ADR-BE-11):

| Thành phần | File |
|---|---|
| `workspace` | `.reactcraft/workspace.json` |
| `tokens` | `.reactcraft/tokens.json` |
| `pages[id]` | `.reactcraft/pages/<id>.json` |
| `components[id]` | `.reactcraft/components/<id>.json` |
| `dataSources` | `.reactcraft/data-sources.json` |
| Ảnh người dùng thêm vào | `.reactcraft/assets/<tên file>` |

Mỗi file JSON có trường `schemaVersion` (số nguyên, bắt đầu từ `1`).

---

### 3.2. WorkspaceMeta

```ts
type WorkspaceMeta = {
  readonly schemaVersion: number;
  readonly id: string;                         // nanoid 10 ký tự
  readonly name: string;                       // 1..64 ký tự
  readonly createdAt: string;                  // ISO 8601 UTC
  readonly updatedAt: string;
  readonly revision: number;                   // ≥ 0, tăng mỗi batch được chấp nhận
  readonly pageOrder: readonly PageId[];
  readonly targetProject?: { readonly path: string };   // xem 3.3
  readonly backends: readonly BackendLink[];
  readonly responsiveMode: ResponsiveMode;     // mặc định 'desktop-first'
  readonly frames: readonly Frame[];           // xem 2.2a
  readonly primaryFrameId: string;             // id của khung chuẩn
  readonly contentLocale: string;              // ngôn ngữ nội dung thiết kế, BCP 47, ví dụ 'vi-VN', 'en-US'
  readonly darkMode: 'none' | 'media' | 'class';   // xem 3.4a
};

type BackendLink = {
  readonly id: BackendId;
  readonly path: string;                       // xem 3.3
  readonly label: string;                      // 1..64 ký tự
};
```

---

### 3.3. Quy tắc lưu đường dẫn

| Mã | Quy tắc |
|---|---|
| V-03 | Đường dẫn nằm **trong** thư mục cha của workspace được lưu dạng **tương đối**, dùng dấu `/`. Ví dụ `../my-shop-backend` |
| V-04 | Đường dẫn ngoài phạm vi đó được lưu dạng tuyệt đối. Studio hiển thị cảnh báo "workspace không di chuyển được sang máy khác" |
| V-05 | Khi đọc, đường dẫn không tồn tại **KHÔNG** làm hỏng việc mở workspace. Liên kết đó được đánh dấu "mất kết nối" và người dùng chọn lại |

---

### 3.4. DesignTokens

```ts
type TokenEntry<V> = {
  readonly value: V;
  readonly label?: string;                     // tên hiển thị, ví dụ "Primary"
};

type DesignTokens = {
  readonly schemaVersion: number;
  readonly color:      Readonly<Record<string, TokenEntry<`#${string}`> & { readonly dark?: `#${string}` }>>;
  readonly spacing:    Readonly<Record<string, TokenEntry<Px>>>;
  readonly radius:     Readonly<Record<string, TokenEntry<Px>>>;
  readonly shadow:     Readonly<Record<string, TokenEntry<string>>>;   // giá trị box-shadow CSS
  readonly fontSize:   Readonly<Record<string, TokenEntry<{ size: Px; lineHeight?: number }>>>;
  readonly fontWeight: Readonly<Record<string, TokenEntry<number>>>;   // 100..900, bước 100
  readonly lineHeight: Readonly<Record<string, TokenEntry<number>>>;   // hệ số, ví dụ 1.5
  readonly fontFamily: Readonly<Record<string, TokenEntry<readonly string[]>>>;
};
```

Workspace mới được tạo với bộ token mặc định khớp thang mặc định của Tailwind v4 (chi tiết bộ giá trị ở SPEC-04.1).

---

### 3.4a. Chế độ tối (dark mode)

| `darkMode` | Ý nghĩa | Khi xuất code |
|---|---|---|
| `none` | Thiết kế chỉ có giao diện sáng | Không sinh gì thêm |
| `media` | Tự đổi theo cài đặt hệ điều hành của người xem | Biến màu được ghi đè trong `@media (prefers-color-scheme: dark)` |
| `class` | Đổi khi phần tử gốc có class `dark` (nút bật/tắt do developer làm) | Biến màu được ghi đè trong `.dark` |

| Mã | Quy tắc |
|---|---|
| V-32 | Chế độ tối hoạt động qua **token màu**: mỗi token màu có thể có giá trị `dark`. Màu hex viết thẳng trong node không đổi theo chế độ tối |
| V-33 | `darkMode` khác `none` thì mọi token màu dùng làm `background` hoặc `textColor` ở đâu đó **NÊN** có giá trị `dark`. Thiếu: cảnh báo trong Studio, không chặn |

---

### 3.5. Page

```ts
type Page = {
  readonly schemaVersion: number;
  readonly id: PageId;
  readonly name: string;                       // 1..64 ký tự
  readonly route: string;                      // xem V-06
  readonly title?: string;                     // <title> khi xuất, 1..70 ký tự
  readonly description?: string;               // <meta name="description">, 1..300 ký tự
  readonly root: DesignNode;                   // luôn là node type 'Stack', xem V-20
};
```

| Mã | Quy tắc |
|---|---|
| V-06 | `route` khớp `^/([a-z0-9-]+(/[a-z0-9-]+)*)?$` hoặc có tham số dạng `:id` (ví dụ `/products/:id`). Không trùng giữa các trang |

---

### 3.6. UserComponent

```ts
type UserComponent = {
  readonly schemaVersion: number;
  readonly id: ComponentId;
  readonly name: string;                       // PascalCase: ^[A-Z][A-Za-z0-9]{0,63}$, không trùng
  readonly props: readonly ComponentPropDef[];
  readonly recordEntity?: DataSourceId;        // component hiển thị một bản ghi của entity này (SPEC-04.5 mục 2.3)
  readonly root: DesignNode;                   // có thể chứa node 'Slot', node có 'propRef'
};

type ComponentPropDef = {
  readonly name: string;                       // camelCase: ^[a-z][A-Za-z0-9]{0,63}$
  readonly kind: 'text' | 'image' | 'link';
  readonly defaultValue: string;
};
```

- Thuộc tính `props` cho phép mỗi nơi dùng component truyền nội dung khác nhau (tiêu đề, ảnh, liên kết).
- Node `Slot` (mục 4.3) đánh dấu chỗ trống để nơi dùng đặt nội dung riêng, ví dụ slot `actions` chứa nút "Thêm vào giỏ" hoặc "Sửa" (FR-13, FR-33).

---

### 3.7. DataSourceCatalog

```ts
type Provenance = {
  readonly origin: 'openapi' | 'code' | 'ai' | 'manual';
  readonly confidence: 'high' | 'medium' | 'low';
  readonly file?: string;                      // tương đối trong thư mục backend
  readonly line?: number;
  readonly backendId?: BackendId;
};

type FieldType =
  | 'string' | 'text' | 'integer' | 'number' | 'decimal' | 'boolean'
  | 'date' | 'datetime' | 'email' | 'url' | 'image' | 'enum' | 'id' | 'relation' | 'json';

type EntityField = {
  readonly name: string;                       // tên gốc trong backend
  readonly type: FieldType;
  readonly required: boolean;
  readonly readOnly: boolean;                  // ví dụ id, createdAt
  readonly enumValues?: readonly string[];     // khi type = 'enum'
  readonly relation?: { readonly entity: DataSourceId; readonly many: boolean };
  readonly label?: string;
  readonly stale?: boolean;                    // không còn thấy ở lần quét gần nhất nhưng đang được dùng (SPEC-04.4 R-DC-04)
  readonly provenance: Provenance;
};

type Entity = {
  readonly id: DataSourceId;                   // ví dụ ds_products
  readonly name: string;                       // tên gốc, ví dụ Product
  readonly fields: readonly EntityField[];
  readonly stale?: boolean;
  readonly provenance: Provenance;
};

type Endpoint = {
  readonly id: EndpointId;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;                       // ví dụ /api/products/{id}
  readonly purpose: 'list' | 'detail' | 'create' | 'update' | 'delete' | 'other';
  readonly entity?: DataSourceId;
  readonly params: readonly {
    name: string; in: 'path' | 'query'; type: FieldType; required: boolean;
    role?: 'search' | 'sort' | 'page' | 'pageSize' | 'offset' | 'limit' | 'cursor';
  }[];
  readonly pagination?: { readonly style: 'page' | 'offset' | 'cursor' };
  readonly responseEnvelope?: 'none' | 'results' | 'data' | 'items' | 'content';
  readonly stale?: boolean;
  readonly provenance: Provenance;
};

type DataSourceCatalog = {
  readonly schemaVersion: number;
  readonly baseUrl?: string;                   // URL gốc API khi xuất code, người dùng nhập
  readonly auth: { readonly kind: 'none' | 'bearer' | 'header' | 'cookie'; readonly headerName?: string };  // mặc định none
  readonly entities: readonly Entity[];
  readonly endpoints: readonly Endpoint[];
};
```

Catalog được sửa qua API (mục 10.6), **không** qua Design Operation, và không nằm trong Undo của thiết kế.

---

## 4. DESIGN NODE

### 4.1. Cấu trúc chung

```ts
type DesignNode = {
  readonly id: NodeId;
  readonly type: NodeType;
  readonly name?: string;                      // tên hiển thị trong Layer Tree, 1..64 ký tự
  readonly style?: StyleProps;                 // giá trị ở breakpoint 'base'
  readonly responsive?: Partial<Record<Exclude<Breakpoint, 'base'>, StyleProps>>;
  readonly states?: Partial<Record<InteractionState, StateStyleProps>>;
  readonly content?: ContentProps;             // theo loại node, mục 4.4
  readonly bindings?: Readonly<Record<string, Binding>>;   // mục 6
  readonly hidden?: boolean;                   // ẩn trên Canvas, vẫn xuất code
  readonly locked?: boolean;                   // không cho chọn, kéo trên Canvas
  readonly children?: readonly DesignNode[];   // chỉ node container
  readonly slots?: Readonly<Record<string, readonly DesignNode[]>>; // chỉ ComponentInstance
  readonly interactions?: readonly Interaction[];   // mục 6a
  readonly runtime?: { readonly initiallyHidden?: boolean };   // ẩn khi trang tải, hiện qua tương tác (6a)
  readonly propRef?: { readonly prop: string; readonly target: 'text' | 'src' | 'href' | 'alt' };   // chỉ trong định nghĩa component (SPEC-04.5 mục 3.1)
};
```

---

### 4.2. Danh mục loại node

| Nhóm | `type` | Container? | Ghi chú |
|---|---|---|---|
| Layout | `Stack` | Có | Flex, hướng hàng hoặc cột |
| Layout | `Grid` | Có | CSS Grid |
| Layout | `Section` | Có | Khối nội dung lớn của trang, xuất thẻ `<section>` |
| Layout | `Container` | Có | Giới hạn chiều rộng, căn giữa |
| Nội dung | `Text` | Không | Đoạn văn bản, xuất `<p>` hoặc `<span>` |
| Nội dung | `Heading` | Không | Cấp 1..6 |
| Nội dung | `Image` | Không | |
| Nội dung | `Icon` | Không | Tên icon theo bộ Lucide |
| Nội dung | `Link` | Không | |
| Nội dung | `Divider` | Không | |
| Form | `Form` | Có | |
| Form | `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch` | Không | |
| Form | `Button` | Không | |
| Dữ liệu | `Table` | Không | Cột khai báo trong `content` |
| Dữ liệu | `List` | Có | Đúng **một** con: mẫu cho mỗi phần tử, lặp theo dữ liệu |
| Dữ liệu | `DetailView` | Có | Hiển thị một bản ghi |
| Tổng hợp | `Card`, `Navbar`, `Sidebar`, `Footer` | Có | |
| Tổng hợp | `Modal` | Có | |
| Tổng hợp | `Tabs` | Có | Mỗi tab là một `Stack` con |
| Tái sử dụng | `ComponentInstance` | Không (dùng `slots`) | Một lần dùng User Component |
| Tái sử dụng | `Slot` | Không | Chỉ xuất hiện bên trong định nghĩa User Component |

---

### 4.3. Quy tắc chứa (containment)

| Mã | Quy tắc |
|---|---|
| V-10 | Chỉ node container (bảng 4.2) được có `children` |
| V-11 | `Section` chỉ là con trực tiếp của root trang hoặc của `Container` |
| V-12 | `Modal` chỉ là con trực tiếp của root trang |
| V-13 | `Form` không nằm trong `Form` khác |
| V-14 | `List` có đúng một con |
| V-15 | `Tabs` chỉ chứa `Stack`, số con bằng số mục trong `content.items` |
| V-16 | `Slot` chỉ xuất hiện trong `UserComponent.root`, tên slot không trùng trong một component |
| V-17 | `ComponentInstance` không được dùng chính component chứa nó, trực tiếp hay gián tiếp (không đệ quy) |
| V-18 | `slots` của `ComponentInstance` chỉ có khóa trùng tên `Slot` trong component |
| V-56 | `propValues` của instance chỉ có khóa là tên prop của component. Prop thiếu dùng `defaultValue` |
| V-57 | `propRef` chỉ có trong `UserComponent.root`, tham chiếu prop tồn tại, `target` khớp loại node (`text`: Text/Heading/Button/Link, `src`, `alt`: Image, `href`: Link), node đó không có binding cho cùng trường |
| V-19 | Độ sâu cây tối đa **32**. Số node tối đa mỗi trang **2.000** |
| V-20 | Root của trang là `Stack` hướng cột. **KHÔNG** xóa, di chuyển, bọc (wrap) được |

---

### 4.4. ContentProps theo loại node

```ts
type ContentProps =
  | { kind: 'text';      text: string; runs?: readonly TextRun[]; as?: 'p' | 'span' }            // Text
  | { kind: 'heading';   text: string; runs?: readonly TextRun[]; level: 1 | 2 | 3 | 4 | 5 | 6 }  // Heading
  | { kind: 'image';     src: string; alt: string; fit?: 'cover' | 'contain' }
  | { kind: 'icon';      name: string; size: Px }                     // tên Lucide, kebab-case
  | { kind: 'link';      text: string; href: string; newTab?: boolean }
  | { kind: 'button';    text: string; variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
                         buttonType?: 'button' | 'submit'; iconLeft?: string; iconRight?: string }
  | { kind: 'input';     label: string; placeholder?: string;
                         inputType: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'tel' | 'url';
                         fieldName: string; required?: boolean; validation?: FieldValidation }
  | { kind: 'textarea';  label: string; placeholder?: string; fieldName: string; rows?: number; required?: boolean;
                         validation?: FieldValidation }
  | { kind: 'select';    label: string; fieldName: string; options: readonly { value: string; label: string }[]; required?: boolean;
                         optionsFrom?: { endpoint: EndpointId; valueField: string; labelField: string } }   // lựa chọn từ dữ liệu
  | { kind: 'choice';    label: string; fieldName: string; options?: readonly { value: string; label: string }[] } // Checkbox, Radio, Switch
  | { kind: 'table';     columns: readonly TableColumn[]; emptyText: string;
                         rowActions?: readonly TableRowAction[]; rowClick?: readonly InteractionAction[];
                         dataOptions?: DataOptions; loadingText?: string; errorText?: string }
  | { kind: 'list';      emptyText: string; dataOptions?: DataOptions; loadingText?: string; errorText?: string }
  | { kind: 'detail';    loadingText?: string; errorText?: string; notFoundText?: string }   // DetailView
  | { kind: 'section';   as?: 'section' | 'header' | 'main' | 'aside' | 'article' }
  | { kind: 'container'; maxWidth: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' }
  | { kind: 'modal';     title: string; openByDefault?: boolean }
  | { kind: 'tabs';      items: readonly { id: string; label: string }[] }
  | { kind: 'instance';  componentId: ComponentId; propValues: Readonly<Record<string, string>> }
  | { kind: 'slot';      name: string }        // ^[a-z][A-Za-z0-9]{0,31}$
  | { kind: 'none' };                          // Stack, Grid, Form, Card, Navbar, Sidebar, Footer, Divider

// Tùy chọn dữ liệu của Table, List (SPEC-04.4 mục 8.4)
type DataOptions = {
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
  readonly pageSize?: number;                  // 5..100
  readonly sortableColumns?: readonly string[];   // id cột (Table)
};

type TableColumn = {
  readonly id: string;
  readonly header: string;
  readonly field?: string;                     // tên field của entity
  readonly format?: ValueFormat;
};

// Nút thao tác ở cuối mỗi dòng của bảng
type TableRowAction = {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;                      // tên icon Lucide
  readonly tone: 'default' | 'danger';
  readonly actions: readonly InteractionAction[];   // mục 6a, chạy trong ngữ cảnh bản ghi của dòng
};

// Đoạn chữ có định dạng (rich text)
type TextRun = {
  readonly text: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strike?: boolean;
  readonly code?: boolean;
  readonly link?: { readonly href: string; readonly newTab?: boolean };
  readonly color?: Color;
};

// Ràng buộc nhập liệu của ô nhập
type FieldValidation = {
  readonly minLength?: number;                 // 0..10000
  readonly maxLength?: number;                 // 1..10000
  readonly min?: number;                       // inputType 'number'
  readonly max?: number;                       // inputType 'number'
  readonly minDate?: string;                   // YYYY-MM-DD, inputType 'date'
  readonly maxDate?: string;
  readonly format?: 'email' | 'phone' | 'url' | 'digits';
  readonly message?: string;                   // thông báo lỗi tùy chỉnh (ngôn ngữ nội dung)
};
```

| Mã | Quy tắc |
|---|---|
| V-21 | `content.kind` **BẮT BUỘC** khớp `type` theo bảng: Text→`text`, Heading→`heading`, Image→`image`, Icon→`icon`, Link→`link`, Button→`button`, Input→`input`, Textarea→`textarea`, Select→`select`, Checkbox/Radio/Switch→`choice`, Table→`table`, List→`list`, Section→`section`, Container→`container`, Modal→`modal`, Tabs→`tabs`, DetailView→`detail`, ComponentInstance→`instance`, Slot→`slot`, loại còn lại→`none` |
| V-22 | `text`, `label`, `header` dài tối đa 10.000 ký tự. Không chứa HTML (được escape khi xuất) |
| V-34 | Có `runs` thì `text` **BẮT BUỘC** bằng chuỗi nối của mọi `runs[].text` (dùng cho tìm kiếm, AI, xuất HTML thuần). `runs` không có hai phần tử liền kề cùng định dạng (phải gộp) |
| V-35 | `TextRun.link.href` theo cùng quy tắc với `Link.href`. Node có binding `text` thì không có `runs` |
| V-36 | `FieldValidation`: `minLength ≤ maxLength`, `min ≤ max`, `minDate ≤ maxDate`. `min`/`max` chỉ với `inputType: 'number'`. `minDate`/`maxDate` chỉ với `inputType: 'date'` |
| V-23 | `fieldName` khớp `^[a-zA-Z_][a-zA-Z0-9_]*$`, không trùng trong cùng một `Form` |
| V-24 | `Image.src` là URL `https://`, `http://` hoặc tham chiếu ảnh workspace dạng `asset:<tên file>` tồn tại trong `.reactcraft/assets/` |
| V-99 | URL do người dùng hoặc AI nhập: `Link.href`, `TextRun.link.href` chỉ nhận `https:`, `http:`, `mailto:`, `tel:`, đường dẫn bắt đầu bằng `/` hoặc `#`. Ảnh (`Image.src`, ảnh nền) theo V-24. `openUrl` theo V-97. Mọi scheme khác (`javascript:`, `data:`, `vbscript:`, `file:`) bị từ chối (SPEC-05 S-15) |
| V-25 | `Icon.name` phải có trong danh sách icon Lucide đóng gói cùng phiên bản ReactCraft |

---

### 4.5. StyleProps

```ts
type StyleProps = {
  // Layout (chỉ container)
  readonly direction?: 'row' | 'column';
  readonly gap?: Spacing;
  readonly align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  readonly justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  readonly wrap?: boolean;
  readonly columns?: number;                   // Grid: 1..12
  readonly rows?: number;                      // Grid: 1..12
  readonly autoFit?: { readonly minColumnWidth: Px };   // Grid: số cột tự co giãn theo độ rộng

  // Vị trí trong container cha
  readonly grow?: boolean;                     // cha là flex
  readonly alignSelf?: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  readonly colSpan?: number | 'full';          // cha là Grid: 1..12
  readonly rowSpan?: number;

  // Kích thước
  readonly width?: SizeValue;
  readonly height?: SizeValue;
  readonly minWidth?: LimitValue;
  readonly maxWidth?: LimitValue;
  readonly minHeight?: LimitValue;
  readonly maxHeight?: LimitValue;
  readonly aspectRatio?: '1/1' | '4/3' | '3/2' | '16/9' | '21/9';

  // Khoảng cách
  readonly padding?: Sides<Spacing>;
  readonly margin?: Sides<Spacing>;

  // Typography
  readonly fontFamily?: TokenRef;
  readonly fontSize?: TokenRef | Px;
  readonly fontWeight?: TokenRef | number;
  readonly lineHeight?: TokenRef | number;
  readonly textAlign?: 'left' | 'center' | 'right' | 'justify';
  readonly textColor?: Color;
  readonly textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  readonly truncate?: boolean;

  // Màu, viền, hiệu ứng
  readonly background?: Color;
  readonly borderWidth?: Sides<0 | 1 | 2 | 4 | 8>;
  readonly borderColor?: Color;
  readonly borderStyle?: 'solid' | 'dashed' | 'dotted';
  readonly radius?: TokenRef | Px;
  readonly shadow?: TokenRef | 'none';
  readonly opacity?: number;                   // 0..100, bước 5

  // Hiển thị
  readonly display?: 'visible' | 'hidden';     // dùng để ẩn/hiện theo breakpoint

  // Vị trí đặc biệt, tràn, lớp
  readonly position?: 'static' | 'sticky';     // sticky: dính khi cuộn (thanh điều hướng, sidebar)
  readonly stickyTop?: Spacing;                // khoảng cách mép trên khi sticky
  readonly zIndex?: 0 | 10 | 20 | 30 | 40 | 50;
  readonly overflowX?: 'visible' | 'hidden' | 'auto';
  readonly overflowY?: 'visible' | 'hidden' | 'auto';

  // Nền nâng cao
  readonly backgroundImage?: BackgroundImage;

  // Chuyển động
  readonly transition?: {
    readonly property: 'colors' | 'opacity' | 'shadow' | 'all';
    readonly durationMs: 75 | 100 | 150 | 200 | 300 | 500 | 700 | 1000;
  };
};

type BackgroundImage =
  | { readonly kind: 'linear-gradient';
      readonly angle: number;                  // 0..359 độ
      readonly stops: readonly { readonly color: Color; readonly at: number }[] }   // 2..5 điểm, at 0..100
  | { readonly kind: 'image';
      readonly src: string;                    // như Image.src (V-24)
      readonly size: 'cover' | 'contain' | 'auto';
      readonly position: 'center' | 'top' | 'bottom' | 'left' | 'right';
      readonly repeat: boolean };

type Sides<V> = {
  readonly top?: V;
  readonly right?: V;
  readonly bottom?: V;
  readonly left?: V;
};

// Thuộc tính cho phép trong trạng thái hover / focus / disabled
type StateStyleProps = Pick<StyleProps,
  'background' | 'textColor' | 'borderColor' | 'shadow' | 'opacity'>;
```

| Mã | Quy tắc |
|---|---|
| V-26 | Thuộc tính layout (`direction` đến `autoFit`) chỉ hợp lệ trên node container. `columns`, `rows`, `autoFit` chỉ trên `Grid`. `autoFit` và `columns` không đặt cùng lúc trong cùng một breakpoint |
| V-27 | `grow`, `alignSelf` chỉ hợp lệ khi cha có layout flex. `colSpan`, `rowSpan` chỉ khi cha là `Grid` |
| V-28 | `states` chỉ đặt ở breakpoint `base` (không kết hợp trạng thái với breakpoint) |
| V-29 | `responsive` chỉ chứa thuộc tính khác giá trị đã có ở breakpoint nhỏ hơn. Giá trị trùng bị loại khi chuẩn hóa |
| V-37 | `stickyTop` chỉ có khi `position = 'sticky'`. `position` không có giá trị `absolute`/`fixed` (layout có cấu trúc, NFR-13). `Modal` tự xử lý lớp phủ, không dùng thuộc tính này |
| V-38 | `backgroundImage` gradient có 2..5 điểm màu, `at` tăng dần. Ảnh nền dùng nguồn hợp lệ như V-24 |

Giá trị mặc định của container khi không khai báo:

| Loại | `direction` | `gap` | `align` |
|---|---|---|---|
| `Stack` | `column` | không có | `stretch` |
| `Section`, `Card`, `Form`, `DetailView`, `Sidebar`, `Modal` | `column` | không có | `stretch` |
| `Navbar`, `Footer` | `row` | không có | `center` |
| `Container` | `column` | không có | `stretch` |

---

### 4.6. Ví dụ đầy đủ

```json
{
  "id": "n_Card000001",
  "type": "Card",
  "name": "Product card",
  "style": {
    "gap": "token:spacing.3",
    "padding": { "top": "token:spacing.4", "right": "token:spacing.4",
                 "bottom": "token:spacing.4", "left": "token:spacing.4" },
    "radius": "token:radius.lg",
    "background": "token:color.surface",
    "shadow": "token:shadow.sm"
  },
  "responsive": {
    "md": { "padding": { "top": "token:spacing.6", "right": "token:spacing.6",
                         "bottom": "token:spacing.6", "left": "token:spacing.6" } }
  },
  "states": { "hover": { "shadow": "token:shadow.md" } },
  "content": { "kind": "none" },
  "children": [
    { "id": "n_Name000001", "type": "Heading",
      "content": { "kind": "heading", "text": "Tên sản phẩm", "level": 3 },
      "bindings": { "text": { "source": "ds_products", "field": "name" } } },
    { "id": "n_Price00001", "type": "Text",
      "content": { "kind": "text", "text": "0 ₫" },
      "bindings": { "text": { "source": "ds_products", "field": "price", "format": "currency" } } }
  ]
}
```

---

## 5. DẠNG PHẲNG KHI CHẠY

File lưu cây lồng nhau. Studio và server làm việc trên **dạng phẳng** (ADR-FE-10).

```ts
type NodeRecord = Omit<DesignNode, 'children' | 'slots'> & {
  readonly parentId?: NodeId;                  // root không có
  readonly slotName?: string;                  // khi nằm trong slots của một instance
  readonly childIds: readonly NodeId[];
  readonly slotChildIds?: Readonly<Record<string, readonly NodeId[]>>;
};

type NormalizedTree = {
  readonly rootId: NodeId;
  readonly nodes: Readonly<Record<NodeId, NodeRecord>>;
};
```

`@reactcraft/model` cung cấp `normalize(root): NormalizedTree` và `denormalize(tree): DesignNode`.

**Bất biến:** `denormalize(normalize(x))` bằng `x` với mọi cây hợp lệ (kiểm tra bằng property-based test).

---

## 6. BINDING

```ts
type ValueFormat =
  | 'text' | 'number' | 'currency' | 'percent'
  | 'date' | 'datetime' | 'boolean' | 'image';

type Binding = {
  readonly source: DataSourceId;
  readonly field?: string;                     // đường dẫn field, ví dụ "name" hoặc "category.name"
  readonly endpoint?: EndpointId;
  readonly format?: ValueFormat;
};
```

Khóa binding hợp lệ theo loại node:

| Node | Khóa | Yêu cầu |
|---|---|---|
| `Text`, `Heading` | `text` | `field` |
| `Image` | `src`, `alt` | `field` (kiểu `image` hoặc `url` cho `src`) |
| `Link` | `href`, `text` | `field` |
| `Table` | `rows` | `endpoint` có `purpose: 'list'` |
| `List` | `items` | `endpoint` có `purpose: 'list'` |
| `DetailView` | `record` | `endpoint` có `purpose: 'detail'` |
| `Form` | `submit` | `endpoint` có `purpose: 'create'` hoặc `'update'` |
| `Select` | `options` | Tương đương `content.optionsFrom`: `endpoint` có `purpose: 'list'` (SPEC-04.4 mục 8.2) |
| `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch` | `value` | `field` của entity gắn với `Form` cha |

| Mã | Quy tắc |
|---|---|
| V-30 | `source`, `endpoint` phải tồn tại trong Data Source Catalog. `field` phải tồn tại trong entity |
| V-31 | Binding `field` của node trong `List`, `Table` hoặc `DetailView` được hiểu theo bản ghi của cha gần nhất có binding dữ liệu. Trong định nghĩa User Component có `recordEntity`, binding `field` hiểu theo entity đó. Ngoài các trường hợp trên thì binding `field` không hợp lệ |

**Dữ liệu mẫu (FR-20):** `@reactcraft/model/mock` cung cấp `generateMockRecords(entity, count, seed, locale)` sinh dữ liệu mẫu xác định theo kiểu field và ngôn ngữ nội dung. Canvas dùng hàm này, không gọi server.

---

## 6a. TƯƠNG TÁC (INTERACTIONS)

### 6a.1. Mô hình

Tương tác là quy tắc **"khi [sự kiện] trên [node] → chạy [danh sách hành động]"**, chọn từ một **tập hành động đóng**. Không có biến, điều kiện, vòng lặp hay code tùy ý.

```ts
type InteractionTrigger =
  | 'click'                                    // bấm vào node
  | 'submitSuccess'                            // Form gửi thành công
  | 'submitError';                             // Form gửi thất bại

type Interaction = {
  readonly id: string;                         // ^i_[A-Za-z0-9_-]{8}$
  readonly trigger: InteractionTrigger;
  readonly actions: readonly InteractionAction[];   // 1..5, chạy lần lượt
};

type ParamSource =
  | { readonly kind: 'field'; readonly field: string }      // lấy từ bản ghi trong ngữ cảnh
  | { readonly kind: 'static'; readonly value: string };

type InteractionAction =
  | { readonly type: 'navigate'; readonly pageId: PageId;
      readonly params?: Readonly<Record<string, ParamSource>> }      // tham số route, ví dụ { id: field 'id' }
  | { readonly type: 'openUrl'; readonly url: string; readonly newTab: boolean }
  | { readonly type: 'openModal'; readonly modalId: NodeId }
  | { readonly type: 'closeModal'; readonly modalId?: NodeId }       // không có = Modal chứa node
  | { readonly type: 'show' | 'hide' | 'toggle'; readonly targetId: NodeId }
  | { readonly type: 'scrollTo'; readonly targetId: NodeId }
  | { readonly type: 'switchTab'; readonly tabsId: NodeId; readonly tabId: string }
  | { readonly type: 'showToast'; readonly message: string; readonly tone: 'success' | 'error' | 'info' }
  | { readonly type: 'refreshData'; readonly targetId: NodeId }      // Table, List, DetailView có binding
  | { readonly type: 'deleteRecord'; readonly endpoint: EndpointId;
      readonly confirm: { readonly title: string; readonly message: string } };
```

- `show`, `hide`, `toggle` thay đổi **trạng thái hiển thị khi chạy** của node đích, độc lập với `hidden` (ẩn trên Canvas) và `display` (ẩn theo breakpoint).
- Node có `runtime.initiallyHidden = true` bị ẩn khi trang tải, chỉ hiện khi có hành động `show` hoặc `toggle`. Ví dụ: menu điện thoại mở bằng nút ☰.
- Trạng thái hiển thị khi chạy **thắng** quy tắc `display` theo breakpoint (sinh bằng class `!important`, SPEC-04.1 mục 5).

---

### 6a.2. Sự kiện hợp lệ theo loại node

| Sự kiện | Node |
|---|---|
| `click` | `Button`, `Link`, `Icon`, `Image`, `Card`, `Stack`, `Grid`, `Heading`, `Text`, `ComponentInstance` (đặt trên instance, không đặt bên trong component) |
| `submitSuccess`, `submitError` | `Form` |
| Bấm dòng bảng | Dùng `Table.content.rowClick` |
| Nút ở dòng bảng | Dùng `Table.content.rowActions` |

---

### 6a.3. Ngữ cảnh bản ghi

Hành động có `ParamSource.kind = 'field'` hoặc `deleteRecord` cần **ngữ cảnh bản ghi**:

| Vị trí | Bản ghi trong ngữ cảnh |
|---|---|
| `Table.rowClick`, `Table.rowActions` | Bản ghi của dòng |
| Node bên trong mẫu của `List` | Bản ghi của phần tử |
| Node bên trong `DetailView` | Bản ghi đang hiển thị |
| `Form` có binding `submit` với endpoint `update` | Bản ghi đang sửa |

---

### 6a.4. Quy tắc

| Mã | Quy tắc |
|---|---|
| V-90 | `trigger` phải hợp lệ với loại node (6a.2) |
| V-91 | Tương tác **chỉ** có trên node thuộc cây của một **trang**, kể cả node trong `slots` của instance. **KHÔNG** có trong định nghĩa User Component (giữ component chỉ có layout, FR-13, FR-33) |
| V-92 | `modalId` trỏ tới `Modal`, `tabsId` trỏ tới `Tabs` có `tabId` tồn tại, `targetId` của `refreshData` trỏ tới node có binding dữ liệu. Mọi node đích nằm **cùng trang** |
| V-93 | `navigate`: trang đích tồn tại, mọi tham số `:x` trong route đích có trong `params` |
| V-94 | `ParamSource` kiểu `field` và `deleteRecord` chỉ hợp lệ khi có ngữ cảnh bản ghi (6a.3). `field` tồn tại trong entity của ngữ cảnh. `deleteRecord.endpoint` có `purpose: 'delete'` |
| V-95 | `Link` dùng `href` **hoặc** tương tác `click`, không cả hai |
| V-96 | Tối đa 10 tương tác mỗi node, 5 hành động mỗi tương tác. `closeModal` không có `modalId` chỉ hợp lệ khi node nằm trong một `Modal` |
| V-97 | `openUrl.url` bắt đầu bằng `https://`, `http://`, `mailto:` hoặc `tel:` |
| V-98 | `remove` một node đang là đích của tương tác khác bị từ chối (E005, `params.referencedBy`). Studio đề xuất "Xóa và gỡ các tương tác liên quan" trong cùng một batch |

---

## 7. DESIGN OPERATION

### 7.1. Phạm vi tác động

```ts
type TreeTarget =
  | { readonly kind: 'page'; readonly pageId: PageId }
  | { readonly kind: 'component'; readonly componentId: ComponentId };

type StyleScope = {
  readonly breakpoint: Breakpoint;             // mặc định 'base'
  readonly state?: InteractionState;           // chỉ khi breakpoint = 'base' (V-28)
};
```

---

### 7.2. Danh mục operation

| `op` | Tham số | Đảo ngược (`invert`) |
|---|---|---|
| `insert` | `target`, `parentId`, `index`, `node` (cây con), `slotName?` | `remove` node vừa thêm |
| `remove` | `target`, `nodeId` | `insert` lại cây con đầy đủ tại vị trí cũ |
| `move` | `target`, `nodeId`, `newParentId`, `index`, `slotName?` | `move` về cha và vị trí cũ |
| `setStyle` | `target`, `nodeId`, `scope`, `set`, `unset?` | `setStyle` với giá trị cũ |
| `setContent` | `target`, `nodeId`, `set` (một phần `ContentProps`, giữ nguyên `kind`) | `setContent` với giá trị cũ |
| `setBinding` | `target`, `nodeId`, `key`, `binding?` (không có = gỡ) | `setBinding` với binding cũ |
| `setNodeMeta` | `target`, `nodeId`, `name?`, `hidden?`, `locked?` | `setNodeMeta` với giá trị cũ |
| `wrap` | `target`, `nodeIds` (các node anh em liền kề), `wrapper` (node container, chưa có con) | `unwrap` |
| `unwrap` | `target`, `wrapperId` | `wrap` lại với cùng ID và thuộc tính |
| `page.create` | `page`, `index` | `page.delete` |
| `page.delete` | `pageId` | `page.create` với nội dung đầy đủ |
| `page.update` | `pageId`, `name?`, `route?`, `title?` | `page.update` với giá trị cũ |
| `page.reorder` | `pageId`, `index` | `page.reorder` về vị trí cũ |
| `token.set` | `group`, `name`, `entry` | `token.set` giá trị cũ, hoặc `token.delete` nếu trước đó chưa có |
| `token.delete` | `group`, `name` | `token.set` giá trị cũ |
| `token.rename` | `group`, `from`, `to` (cập nhật mọi tham chiếu) | `token.rename` ngược lại |
| `token.replace` | `group`, `from`, `with` (token khác cùng nhóm hoặc giá trị cứng). Khi `validate`, engine ghi danh sách node và giá trị cũ vào operation | Khôi phục giá trị cũ của từng node đã ghi |
| `component.create` | `component` | `component.delete` |
| `component.delete` | `componentId` | `component.create` với nội dung đầy đủ |
| `component.update` | `componentId`, `name?`, `props?` | `component.update` với giá trị cũ |
| `workspace.update` | `name?`, `responsiveMode?`, `frames?`, `primaryFrameId?`, `contentLocale?`, `darkMode?` | `workspace.update` với giá trị cũ |
| `setInteractions` | `target`, `nodeId`, `interactions` (thay toàn bộ danh sách) | `setInteractions` với danh sách cũ |
| `setRuntime` | `target`, `nodeId`, `initiallyHidden?` | `setRuntime` với giá trị cũ |

Mọi operation có trường phân biệt `op`. Ví dụ:

```json
{
  "op": "setStyle",
  "target": { "kind": "page", "pageId": "p_4f90d13a2b" },
  "nodeId": "n_Card000001",
  "scope": { "breakpoint": "md" },
  "set": { "gap": "token:spacing.4" },
  "unset": ["shadow"]
}
```

---

### 7.3. Quy tắc kiểm tra operation

Mỗi operation phải qua `validate(doc, op)` trước `apply`. Ngoài V-01 đến V-38 và V-90 đến V-98, áp dụng:

| Mã | Quy tắc |
|---|---|
| V-40 | `target`, `nodeId`, `parentId`, `wrapperId` phải tồn tại |
| V-41 | `index` nằm trong `[0, số con]` của cha (tính **sau** khi bỏ node đang di chuyển ra khỏi cha cũ, nếu cùng cha) |
| V-42 | `move` không được đưa node vào chính nó hoặc con cháu của nó |
| V-43 | Mọi `NodeId` trong cây được `insert` phải là ID mới, không trùng trong toàn document |
| V-44 | `wrap`: các `nodeIds` cùng cha, liền kề, đúng thứ tự. Kết quả sau khi bọc vẫn thỏa quy tắc chứa (mục 4.3) |
| V-45 | `setStyle`: mọi khóa trong `set` và `unset` hợp lệ với loại node và `scope` (V-26 đến V-28) |
| V-46 | `setContent` không đổi `kind` |
| V-47 | `token.delete` bị từ chối nếu còn node tham chiếu token đó. Lỗi trả số lượng và danh sách node (tối đa 20) |
| V-48 | `component.delete` bị từ chối nếu còn `ComponentInstance` dùng component đó |
| V-49 | `page.delete` bị từ chối nếu đó là trang cuối cùng |
| V-39 | `workspace.update` phải thỏa V-07, V-08, V-09 |

---

### 7.4. Hàm của engine

```ts
// @reactcraft/model/operations — chữ ký chính thức
export function validateOperation(doc: DesignDocument, op: DesignOperation): Result<void>;
export function applyOperation(doc: DesignDocument, op: DesignOperation): DesignDocument;
export function invertOperation(doc: DesignDocument, op: DesignOperation): DesignOperation;

// Áp dụng nhiều operation như một khối: hoặc tất cả, hoặc không gì cả
export function applyBatch(doc: DesignDocument, ops: readonly DesignOperation[]):
  Result<{ doc: DesignDocument; inverse: readonly DesignOperation[] }>;

// Thay ID tạm (do AI đề xuất) bằng ID do hệ thống sinh, cập nhật mọi tham chiếu trong batch
export function assignIds(ops: readonly DesignOperation[]): {
  ops: readonly DesignOperation[];
  idMap: Readonly<Record<string, NodeId>>;
};
```

| Mã | Quy tắc |
|---|---|
| V-50 | `applyBatch` dừng ở operation lỗi đầu tiên và trả lỗi E005 kèm `index` của operation đó. Document không đổi |
| V-51 | `inverse` trả về theo **thứ tự ngược** để Undo áp dụng đúng |

---

### 7.5. Batch và đồng bộ với server

```ts
type OperationBatch = {
  readonly baseRevision: number;
  readonly ops: readonly DesignOperation[];    // 1..500 operation
  readonly meta: {
    readonly source: 'user' | 'ai';
    readonly label: string;                    // mô tả ngắn cho Undo, ví dụ "Change padding"
    readonly aiProposalId?: string;            // khi source = 'ai'
  };
};
```

| Mã | Quy tắc |
|---|---|
| V-52 | `baseRevision` khác `revision` hiện tại của server: từ chối với **E017**, Studio tải lại document |
| V-53 | Batch được chấp nhận làm `revision` tăng đúng 1 |
| V-54 | Undo/Redo phía Studio gửi lên server như một batch mới (không có API Undo riêng) |
| V-55 | Lịch sử Undo/Redo chỉ tồn tại trong phiên Studio đang mở, tối đa 200 bước. Đóng Studio hoặc tải lại document thì lịch sử bị xóa (giải quyết Q-02 của SPEC-01.1) |

---

## 8. KIỂU KẾT QUẢ VÀ LỖI

Theo SPEC-02 mục 6.

```ts
type ErrorCode =
  | 'E001' | 'E002' | 'E003' | 'E004' | 'E005' | 'E006' | 'E007' | 'E008'
  | 'E009' | 'E010' | 'E011' | 'E012' | 'E013' | 'E014' | 'E015' | 'E016'
  | 'E017' | 'E018' | 'E019' | 'E020' | 'E021' | 'E022';

type AppError = {
  readonly code: ErrorCode;
  readonly params?: Readonly<Record<string, string | number | boolean>>;
  readonly details?: readonly ErrorDetail[];   // nhiều lỗi con, ví dụ lỗi type check
  readonly cause?: unknown;                    // chỉ trong server, KHÔNG gửi xuống client
};

type ErrorDetail = {
  readonly path?: string;                      // đường dẫn trường hoặc file
  readonly line?: number;
  readonly column?: number;
  readonly rule?: string;                      // ví dụ 'V-14'
  readonly message: string;                    // tiếng Anh, dành cho developer
};

type Result<T, E extends AppError = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

Danh mục mã lỗi ở mục 13.

---

## PHẦN B — API VÀ SỰ KIỆN (MỤC 9 ĐẾN 13)

## 9. QUY ƯỚC CHUNG CỦA API

### 9.1. Cơ bản

| Mục | Quy định |
|---|---|
| Địa chỉ gốc | `http://127.0.0.1:<port>/api/v1` |
| Định dạng | JSON, UTF-8 |
| Xác thực REST | Header `Authorization: Bearer <sessionToken>` (cơ chế cấp token ở SPEC-05) |
| Xác thực WebSocket | Subprotocol `reactcraft.v1` và `reactcraft.token.<sessionToken>` (chi tiết SPEC-05) |
| Mã định danh request | Server gán `requestId` cho mỗi request, trả trong header `X-Request-Id` và trong lỗi |
| Giới hạn body | 10 MB (ADR-BE-06) |
| Đặt tên | Theo QC-29, QC-30, QC-31 |

---

### 9.2. Dạng phản hồi

Thành công:

```json
{ "data": { "...": "..." } }
```

Lỗi:

```json
{
  "error": {
    "code": "E010",
    "params": { "file": "src/pages/products-page.tsx" },
    "details": [],
    "requestId": "req_8fK2pQx9Lm"
  }
}
```

---

### 9.3. Tác vụ dài (job)

Quét backend, yêu cầu AI, lập kế hoạch xuất, thực hiện xuất, build thử là **job**:

```text
POST …           → 202 Accepted  { "data": { "jobId": "j_…" } }
WebSocket        → job.progress  (0..n lần)
WebSocket        → job.completed | job.failed | job.cancelled
GET /jobs/{id}   → trạng thái và kết quả (dùng khi mất kết nối WebSocket)
POST /jobs/{id}/cancel
```

```ts
type JobKind = 'scan' | 'ai.proposal' | 'export.plan' | 'export.apply' | 'export.build' | 'project.install';

type JobStatus = {
  readonly id: JobId;
  readonly kind: JobKind;
  readonly state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly progress?: { readonly done: number; readonly total: number; readonly stepKey?: string };
  readonly result?: unknown;                   // kiểu theo kind, xem mục 10
  readonly error?: AppError;
  readonly startedAt: string;
  readonly finishedAt?: string;
};
```

| Mã | Quy tắc |
|---|---|
| V-60 | `stepKey` là khóa i18n (ví dụ `jobs:scan.parsingFiles`), không phải câu đã dịch (ADR-BE-07) |
| V-61 | Server giữ trạng thái job đã xong trong 10 phút để client lấy lại |
| V-62 | Mỗi loại job chỉ chạy tối đa **một** cùng lúc trên một workspace. Gửi thêm khi đang chạy trả E018 |

---

## 10. DANH MỤC ENDPOINT

### 10.1. Phiên và hệ thống

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| GET | `/session` | Phiên bản ReactCraft, trạng thái workspace, khả năng hỗ trợ | 200 `SessionInfo` | E014 |
| GET | `/fs/directories?path=…` | Liệt kê **thư mục con** để chọn thư mục trên Studio (không trả tên file, không đọc nội dung). Giới hạn ở SPEC-05 | 200 `{ path, parent?, entries: { name, path }[] }` | E011, E012, E015 |

```ts
type SessionInfo = {
  readonly version: string;
  readonly workspace:
    | { readonly state: 'none'; readonly directory: string }       // thư mục chưa có .reactcraft
    | { readonly state: 'open'; readonly id: string; readonly name: string; readonly revision: number;
        readonly trusted: boolean }                                 // SPEC-05 mục 13
    | { readonly state: 'error'; readonly error: AppError };
  readonly platform: 'win32' | 'darwin' | 'linux';
  readonly features: readonly FeatureId[];     // cờ tính năng đang bật (SPEC-07 mục 3.4)
};
```

---

### 10.2. Cấu hình người dùng

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| GET | `/settings` | Đọc cấu hình (không bao giờ trả API key) | 200 `Settings` | |
| PATCH | `/settings` | Sửa ngôn ngữ, provider, model | 200 `Settings` | E016 |
| PUT | `/settings/ai-keys/{provider}` | Lưu API key (chỉ ghi) | 204 | E016 |
| DELETE | `/settings/ai-keys/{provider}` | Xóa API key | 204 | E015 |

```ts
type AIProviderName = 'openai' | 'anthropic' | 'deepseek' | 'ollama';

type Settings = {
  readonly language: 'vi' | 'en';
  readonly ai: {
    readonly provider?: AIProviderName;
    readonly model?: string;
    readonly ollamaBaseUrl: string;            // mặc định http://127.0.0.1:11434
    readonly keys: Readonly<Record<AIProviderName, 'configured' | 'missing' | 'fromEnv'>>;
  };
  readonly export: { readonly typecheck: boolean; readonly buildCheck: boolean };
};
```

---

### 10.3. Workspace và Design Document

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| POST | `/workspace` | Tạo workspace mới trong thư mục hiện tại `{ name }` | 201 `WorkspaceMeta` | E011, E016, E018 |
| GET | `/workspace/document` | Toàn bộ Design Document và `revision` | 200 `{ document: DesignDocument }` | E003, E004 |
| POST | `/workspace/operations` | Gửi `OperationBatch` | 200 `{ revision, idMap }` | E005, E016, E017 |
| POST | `/workspace/reload` | Đọc lại từ disk sau khi có thay đổi bên ngoài | 200 `{ document }` | E003, E004 |
| GET | `/workspace/backups` | Danh sách bản sao lưu | 200 `{ backups: { id, file, createdAt }[] }` | |
| POST | `/workspace/backups/{id}/restore` | Khôi phục một file từ bản sao lưu | 200 `{ document }` | E015, E003 |
| POST | `/workspace/trust` | Đánh dấu workspace là tin cậy (SPEC-05 mục 13) `{ trusted: boolean }` | 200 `SessionInfo` | E016 |
| POST | `/workspace/assets` | Tải ảnh lên (`multipart/form-data`, tối đa 5 MB, png/jpg/webp/svg/gif) | 201 `{ ref: "asset:<tên>" }` | E016, E011 |
| GET | `/workspace/assets/{name}` | Lấy ảnh để hiển thị trên Canvas | 200 (ảnh) | E015 |

---

### 10.4. Target Project

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| GET | `/target-project` | Thông tin đã phát hiện | 200 `TargetProjectInfo` | E021 |
| PUT | `/target-project` | Liên kết `{ path }`, phát hiện ngay | 200 `TargetProjectInfo` | E001, E011, E012 |
| DELETE | `/target-project` | Gỡ liên kết | 204 | |
| POST | `/target-project/create` | Tạo project mới từ template `{ path, name }` | 201 `TargetProjectInfo` | E011, E012, E016 |
| GET | `/target-project/tokens` | Đọc token từ cấu hình Tailwind của project, không ghi gì (SPEC-04.5 mục 8) | 200 `{ tokens, warnings }` | E001, E021 |
| POST | `/target-project/install` | Cài dependency (cần người dùng xác nhận trong UI, SEC-08) | 202 job `project.install` | E021 |

```ts
type TargetProjectInfo = {
  readonly path: string;
  readonly status: 'supported' | 'unsupported' | 'missing';
  readonly reasons?: readonly string[];        // mã lý do khi unsupported, ví dụ 'noVite'
  readonly react?: string;                     // phiên bản
  readonly vite?: string;
  readonly typescript?: string;
  readonly tailwind?: { readonly version: string; readonly major: 3 | 4 };
  readonly language: 'ts' | 'js';             // TypeScript hay JavaScript (SPEC-04.2 mục 2.3)
  readonly workspaceRoot?: string;             // thư mục gốc monorepo nếu project nằm trong monorepo
  readonly packageManager?: 'pnpm' | 'npm' | 'yarn' | 'bun';
  readonly conventions: ProjectConventions;
};

type ProjectConventions = {
  readonly srcDir: string;                     // ví dụ 'src'
  readonly pagesDir: string;                   // ví dụ 'src/pages'
  readonly componentsDir: string;              // ví dụ 'src/components'
  readonly featuresDir?: string;
  readonly fileNaming: 'kebab-case' | 'PascalCase' | 'camelCase';
  readonly pathAlias?: { readonly alias: string; readonly target: string };   // ví dụ '@' → 'src'
  readonly hasPrettier: boolean;
  readonly hasEslint: boolean;
  readonly router?: 'react-router' | 'tanstack-router' | 'none';
};
```

Thuật toán phát hiện quy ước ở SPEC-04.2.

---

### 10.5. Backend và quét

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| GET | `/backends` | Danh sách backend đã liên kết | 200 `{ backends: BackendLink[] }` | |
| POST | `/backends` | Liên kết `{ path, label }` | 201 `BackendLink` | E011, E012 |
| DELETE | `/backends/{id}` | Gỡ liên kết | 204 | E015 |
| POST | `/backends/{id}/scan` | Quét `{ allowAi: boolean }` | 202 job `scan` | E006, E015, E018 |

Kết quả job `scan`:

```ts
type ScanResult = {
  readonly backendId: BackendId;
  readonly frameworks: readonly string[];      // ví dụ ['django', 'drf']
  readonly openapiFiles: readonly string[];
  readonly entities: readonly Entity[];
  readonly endpoints: readonly Endpoint[];
  readonly skippedFiles: number;               // bị bỏ qua do secrets, kích thước, lỗi
  readonly auth?: DataSourceCatalog['auth'];   // gợi ý xác thực (SPEC-04.4 mục 2.3)
  readonly warnings: readonly ErrorDetail[];
};
```

Kết quả quét là **đề xuất**. Người dùng duyệt rồi mới ghi vào catalog (10.6).

---

### 10.6. Data Source Catalog

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| GET | `/data-sources` | Catalog hiện tại | 200 `DataSourceCatalog` | |
| POST | `/data-sources/merge` | Ghi kết quả quét đã duyệt `{ scanJobId, accept: { entities: DataSourceId[]; endpoints: EndpointId[] } }` | 200 `DataSourceCatalog` | E015, E016 |
| PUT | `/data-sources/entities/{id}` | Sửa hoặc tạo entity thủ công | 200 `Entity` | E016 |
| DELETE | `/data-sources/entities/{id}` | Xóa entity (từ chối nếu còn binding dùng nó) | 204 | E005, E015 |
| PUT | `/data-sources/endpoints/{id}` | Sửa hoặc tạo endpoint thủ công | 200 `Endpoint` | E016 |
| DELETE | `/data-sources/endpoints/{id}` | Xóa endpoint (từ chối nếu còn binding dùng nó) | 204 | E005, E015 |
| PATCH | `/data-sources` | Sửa `baseUrl`, `auth` | 200 `DataSourceCatalog` | E016 |
| GET | `/data-proxy?endpointId=…&params=…` | Lấy dữ liệu thật qua proxy chỉ đọc cho chế độ Xem thử (SPEC-04.4 mục 10) | 200 `{ items } \| { item }` | E015, E016, E020, E021, E022 |

---

### 10.7. AI

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| GET | `/ai/status` | Provider đã cấu hình, Ollama có chạy không, model có sẵn | 200 `AIStatus` | |
| POST | `/ai/context-preview` | Xem trước dữ liệu sẽ gửi cho AI (FR-29) | 200 `AIContextPreview` | E016, E021 |
| POST | `/ai/proposals` | Gửi yêu cầu AI | 202 job `ai.proposal` | E008, E018, E021 |
| GET | `/ai/proposals/{id}` | Lấy đề xuất | 200 `AIProposal` | E015 |
| POST | `/ai/proposals/{id}/reject` | Ghi nhận người dùng từ chối | 204 | E015 |

Chấp nhận đề xuất: Studio gửi các operation của đề xuất qua `POST /workspace/operations` với `meta.source = 'ai'` và `meta.aiProposalId`. Không có endpoint `accept` riêng.

```ts
type AIRequest = {
  readonly mode: 'editSelection' | 'generatePage' | 'optimizeResponsive' | 'refine';
  readonly prompt: string;                     // 1..4000 ký tự
  readonly target: TreeTarget;
  readonly selection?: readonly NodeId[];      // bắt buộc khi mode = 'editSelection'
  readonly baseRevision: number;
  readonly language: 'vi' | 'en';              // ngôn ngữ phần tóm tắt AI trả về
  readonly maxContextLevel?: 0 | 1 | 2 | 3;    // FR-24
  readonly previousProposalId?: string;        // bắt buộc khi mode = 'refine'
  readonly quickAction?: string;               // SPEC-04.3 mục 7.1
  readonly includeScreenshot?: boolean;
  readonly screenshot?: string;                // PNG base64, ≤ 2 MB
  readonly responsiveIssues?: readonly ResponsiveIssue[];   // SPEC-04.3 mục 6
};

type AIContextPreview = {
  readonly provider: AIProviderName;
  readonly model: string;
  readonly contextLevel: 0 | 1 | 2 | 3;
  readonly items: readonly { kind: 'node' | 'page' | 'component' | 'tokens' | 'dataSource'; id: string; label: string }[];
  readonly approxTokens: number;
  readonly external: boolean;                  // true nếu gửi ra ngoài máy (không phải Ollama)
  readonly includesScreenshot: boolean;
};

type AIProposal = {
  readonly id: string;
  readonly request: AIRequest;
  readonly summary: string;                    // theo ngôn ngữ đã yêu cầu
  readonly ops: readonly DesignOperation[];    // đã qua assignIds và validate
  readonly changes: readonly ChangeSummary[];  // SPEC-04.3 mục 7.2
  readonly warnings: readonly { readonly code: string; readonly nodeId?: NodeId }[];
  readonly outOfScope?: readonly NodeId[];
  readonly notes?: readonly string[];
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number };
  readonly promptVersion: string;
  readonly contextLevel: 0 | 1 | 2 | 3;
  readonly createdAt: string;
  readonly status: 'ready' | 'accepted' | 'rejected' | 'stale';   // stale: revision đã đổi
};
```

| Mã | Quy tắc |
|---|---|
| V-63 | Đề xuất chỉ được trả về khi toàn bộ `ops` qua `validate` trên document ở `baseRevision`. Không qua sau 1 lần thử lại: job thất bại với E007 |
| V-64 | Khi `revision` của workspace thay đổi sau `baseRevision`, đề xuất chuyển `stale`. Studio cho người dùng tạo lại |

---

### 10.8. Xuất code

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| POST | `/exports` | Lập kế hoạch xuất `ExportRequest` | 202 job `export.plan` | E021, E018 |
| GET | `/exports/{planId}` | Kế hoạch: danh sách file, trạng thái, kết quả kiểm tra | 200 `ExportPlan` | E015 |
| GET | `/exports/{planId}/files/{fileId}` | Nội dung cũ, mới và diff của một file | 200 `ExportFileDiff` | E015 |
| POST | `/exports/{planId}/apply` | Thực hiện với quyết định từng file | 202 job `export.apply` | E010, E011, E012, E017 |
| POST | `/exports/{planId}/build` | Chạy `vite build` thử sau khi ghi | 202 job `export.build` | E021 |

```ts
type ExportRequest = {
  readonly format: 'react' | 'html';
  readonly pageIds?: readonly PageId[];        // không có = toàn bộ
  readonly baseRevision: number;
  readonly htmlOutDir?: string;                // bắt buộc khi format = 'html'
};

type ExportFileStatus =
  | 'create'          // file chưa có
  | 'update'          // file có, do ReactCraft xuất lần trước, chưa bị sửa tay
  | 'unchanged'       // nội dung mới giống hệt
  | 'conflict'        // file có nhưng đã bị sửa tay, hoặc không do ReactCraft tạo
  | 'orphaned';       // đã xuất trước đây nhưng không còn được sinh (trang/component đã xóa)

type ExportPlan = {
  readonly id: string;
  readonly request: ExportRequest;
  readonly files: readonly {
    readonly id: string;
    readonly path: string;                     // tương đối trong Target Project hoặc htmlOutDir
    readonly status: ExportFileStatus;
    readonly source: { readonly kind: 'page' | 'component' | 'data' | 'asset' | 'support'; readonly id?: string };
  }[];
  readonly diagnostics: readonly ErrorDetail[];          // kết quả T1, T2 (ADR-BE-19)
  readonly blocking: boolean;                  // true nếu có lỗi chặn ghi
  readonly newDependencies: readonly string[]; // gói cần thêm, phải được đồng ý (FR-34, SEC-08)
  readonly manualSteps: readonly ManualStep[]; // SPEC-04.2 mục 10.4
  readonly existingProjectErrors: number;      // lỗi TypeScript có sẵn trong project, không chặn
  readonly createdAt: string;
  readonly expiresAt: string;                  // 30 phút sau khi tạo
};

type ExportApplyRequest = {
  readonly decisions: readonly {
    readonly fileId: string;
    readonly action: 'write' | 'skip' | 'overwrite' | 'writeAsNew' | 'delete';
  }[];
  readonly acceptNewDependencies: boolean;
};

type ExportFileDiff = {
  readonly path: string;
  readonly before?: string;
  readonly after: string;
  readonly hunks: readonly { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: readonly string[] }[];
};
```

| Mã | Quy tắc |
|---|---|
| V-65 | File `conflict` chỉ được ghi khi quyết định là `overwrite` hoặc `writeAsNew`. Quyết định `write` cho file `conflict` bị từ chối với E010. `delete` chỉ hợp lệ với file `orphaned` có hash trùng manifest |
| V-66 | `apply` trên kế hoạch đã hết hạn hoặc khi `revision` đã đổi: E017, Studio lập kế hoạch lại |
| V-67 | `apply` khi `blocking = true`: E009 |
| V-68 | `writeAsNew` ghi sang tên mới cùng thư mục, thêm hậu tố `.reactcraft-new` trước phần mở rộng |

---

### 10.9. Job

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| GET | `/jobs/{id}` | Trạng thái job | 200 `JobStatus` | E015 |
| POST | `/jobs/{id}/cancel` | Hủy job | 202 | E015 |

---

## 11. SỰ KIỆN WEBSOCKET

### 11.1. Kết nối

| Mục | Quy định |
|---|---|
| Địa chỉ | `ws://127.0.0.1:<port>/api/v1/events` |
| Chiều | Chỉ server gửi xuống. Client chỉ gửi `ping` |
| Nhịp | Server gửi `ping` mỗi 20 s. Không nhận `pong` trong 10 s thì đóng kết nối |
| Kết nối lại | Theo ADR-FE-17. Sau khi nối lại, Studio gọi `GET /session` để đồng bộ |

---

### 11.2. Dạng sự kiện

```ts
type ServerEvent<T extends string, P> = {
  readonly v: 1;
  readonly type: T;
  readonly at: string;                         // ISO 8601
  readonly correlationId?: string;             // jobId hoặc requestId liên quan
  readonly payload: P;
};
```

---

### 11.3. Danh mục sự kiện

| `type` | Payload | Khi nào |
|---|---|---|
| `job.progress` | `{ jobId, kind, done, total, stepKey? }` | Job tiến triển |
| `job.completed` | `{ jobId, kind, result }` | Job xong |
| `job.failed` | `{ jobId, kind, error: AppError }` | Job lỗi |
| `job.cancelled` | `{ jobId, kind }` | Job bị hủy |
| `ai.proposal.delta` | `{ jobId, textDelta }` | Phần tóm tắt AI đang được sinh (hiển thị dần) |
| `workspace.saved` | `{ revision, files: string[] }` | Đã ghi xuống disk |
| `workspace.externalChange` | `{ files: string[] }` | File trong `.reactcraft/` bị sửa từ bên ngoài |
| `targetProject.changed` | `{ files: string[]; exportedFilesModified: string[] }` | File trong Target Project thay đổi |
| `backend.changed` | `{ backendId, files: string[] }` | File backend thay đổi, catalog có thể cũ |
| `settings.changed` | `Settings` | Cấu hình thay đổi |
| `server.shuttingDown` | `{}` | Server sắp tắt |

| Mã | Quy tắc |
|---|---|
| V-70 | Sự kiện `*.changed` gộp theo cửa sổ 500 ms, danh sách `files` tối đa 100 phần tử (thêm trường `truncated: true` nếu vượt) |
| V-71 | Payload sự kiện **KHÔNG ĐƯỢC** chứa nội dung file |

---

## 12. GIỚI HẠN

| Giới hạn | Giá trị | Mã lỗi khi vượt |
|---|---|---|
| Body request | 10 MB | E016 |
| Operation mỗi batch | 500 | E016 |
| Node mỗi trang | 2.000 | E005 (V-19) |
| Độ sâu cây | 32 | E005 (V-19) |
| Trang mỗi workspace | 200 | E005 |
| User Component mỗi workspace | 500 | E005 |
| Prompt AI | 4.000 ký tự | E016 |
| Ảnh tải lên | 5 MB | E016 |
| Job cùng loại chạy đồng thời | 1 | E018 |

---

## 13. DANH MỤC MÃ LỖI

E001 đến E012 theo SRS mục 13. E013 đến E021 bổ sung cho nhu cầu của API.

| Mã | Tên | HTTP | Thử lại được? | `params` chính | Khi nào |
|---|---|---|---|---|---|
| E001 | Unsupported Target Project | 422 | Không | `reasons` | Project đích không phải React + Vite hoặc phiên bản không hỗ trợ |
| E002 | Backend Initialization Failed | 500 | Có | `step` | Server khởi động lỗi (cổng, quyền, khóa workspace) |
| E003 | Workspace Load Failed | 500 | Có | `file` | Không đọc được file workspace |
| E004 | Design Model Schema Error | 422 | Không | `file`, `schemaVersion` | File workspace sai schema hoặc phiên bản không nâng cấp được |
| E005 | Invalid Design Operation | 422 | Không | `index`, `op`, `rule` | Operation vi phạm quy tắc V-xx |
| E006 | Backend Scan Failed | 500 | Có | `backendId`, `step` | Quét backend lỗi toàn bộ |
| E007 | AI Schema Error | 502 | Có | `provider`, `attempts` | AI trả kết quả không hợp lệ sau khi thử lại |
| E008 | AI Provider Error | 502 | Có | `provider`, `status` | Provider lỗi, hết hạn mức, không kết nối được |
| E009 | Export Validation Failed | 422 | Không | `errors` | Code sinh ra lỗi cú pháp hoặc kiểu (`details` chứa file, dòng) |
| E010 | Export Conflict | 409 | Không | `file` | File đích đã bị sửa tay, quyết định không hợp lệ |
| E011 | Permission Error | 403 | Có | `path`, `operation` | Hệ điều hành từ chối đọc/ghi (kể cả sau retry, ADR-BE-18) |
| E012 | Path Security Violation | 403 | Không | `path` | Đường dẫn ra ngoài phạm vi cho phép |
| E013 | Internal Error | 500 | Có | | Lỗi không lường trước (bug). Ghi log đầy đủ ở server |
| E014 | Unauthorized | 401 | Không | | Thiếu hoặc sai token phiên, Origin không hợp lệ |
| E015 | Not Found | 404 | Không | `resource`, `id` | Tài nguyên không tồn tại |
| E016 | Invalid Request | 400 | Không | | Request không khớp schema hoặc vượt giới hạn (`details` chỉ rõ trường) |
| E017 | Revision Mismatch | 409 | Có | `expected`, `actual` | `baseRevision` cũ (V-52, V-66) |
| E018 | Busy | 409 | Có | `resource` | Workspace bị khóa bởi phiên khác, hoặc job cùng loại đang chạy |
| E019 | Cancelled | 499 | Có | `jobId` | Job bị người dùng hủy |
| E020 | Timeout | 504 | Có | `operation`, `timeoutMs` | Quá thời gian (AI, build thử) |
| E021 | Not Configured | 409 | Không | `missing` | Thiếu cấu hình cần thiết: chưa liên kết Target Project, chưa chọn AI provider, chưa có API key |
| E022 | Upstream API Error | 502 | Có | `status` | API thật của backend lỗi hoặc không kết nối được khi dùng proxy Xem thử |

| Mã | Quy tắc |
|---|---|
| V-80 | Mỗi mã lỗi **BẮT BUỘC** có khóa i18n `errors:<mã>.title` và `errors:<mã>.message` ở cả `vi` và `en`. Thông điệp dùng `params` để nội suy |
| V-81 | Mã lỗi đã công bố **KHÔNG** đổi ý nghĩa. Lỗi mới dùng mã mới |

---

## 14. TRUY VẾT

| Yêu cầu | Mục trong SPEC-03 |
|---|---|
| SRS 7, 8 (thuật ngữ, Design Model) | 2, 3, 4, 5 |
| FR-01, FR-02 Workspace | 3.2, 10.3 |
| FR-03 Target Project | 10.4 |
| FR-04, FR-17, FR-18 Backend, quét, catalog | 3.7, 10.5, 10.6 |
| FR-07 đến FR-16 Chỉnh sửa | 4, 7 |
| FR-13 User Component | 3.6, 4.3 (V-16 đến V-18) |
| FR-19, FR-20 Binding, dữ liệu mẫu | 6 |
| FR-22 đến FR-29 AI | 7.4 (`assignIds`), 10.7 |
| FR-31 đến FR-37 Xuất code | 10.8 |
| FR-39 Tương tác | 6a |
| SRS 13 Error Model | 13 |
| ADR-BE-07 Giao thức | 9, 11 |
| ADR-BE-09 Operation | 7 |
| ADR-FE-10 Editor Store | 5, 7.5 |

---

## 15. CÂU HỎI MỞ

| # | Câu hỏi | Giả định hiện tại |
|---|---|---|
| Q-09 | Có cần rich text (đậm, nghiêng, link trong đoạn văn) trong `Text`? | **Đã giải quyết:** có, qua `TextRun` (mục 4.4) |
| Q-10 | Có hỗ trợ gradient nền, ảnh nền? | **Đã giải quyết:** có, qua `backgroundImage` (mục 4.5). Video nền: không hỗ trợ (quyết định) |
| Q-11 | Có cho đặt breakpoint tùy chỉnh khác thang Tailwind? | **Quyết định:** không. Dùng 5 mốc chuẩn ở 2.2 để code xuất ra theo chuẩn Tailwind. Khung thiết kế (2.2a) tùy chỉnh được |

---

# SPEC-04.1 — WORKSPACE & STUDIO CORE

**Thuộc:** SPEC-04 — Đặc tả module  
**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0 (FR-01, FR-02, FR-05 đến FR-16, NFR-01 đến NFR-07, AC-01 đến AC-03), SPEC-01.1, SPEC-01.2, SPEC-03  
**Phạm vi:** Các module cần cho **Phase 1 — Studio Core**: vòng đời workspace, lưu trữ, bộ token mặc định, bảng ánh xạ style, Canvas, Overlay, kéo thả, Library, Inspector, Layer Tree, Undo/Redo, clipboard, phím tắt, quản lý trang

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

### 1.1. Danh sách module

| Mã module | Tên | Nơi chạy | Mục |
|---|---|---|---|
| M-WS | Workspace Lifecycle | Server | 2 |
| M-DS | Design Store (lưu, sao lưu, thay đổi bên ngoài) | Server | 3 |
| M-TK | Bộ token mặc định | Model | 4 |
| M-SM | Styling Map (thuộc tính → class Tailwind) | Model | 5 |
| M-SH | Studio Shell và màn hình | Studio | 6 |
| M-CV | Canvas Renderer | Studio | 7 |
| M-OV | Overlay và chọn phần tử | Studio | 8 |
| M-DD | Kéo thả | Studio | 9 |
| M-LB | Component Library | Studio + Model | 10 |
| M-IN | Inspector | Studio | 11 |
| M-LT | Layer Tree | Studio | 12 |
| M-HS | Undo/Redo và đồng bộ | Studio | 13 |
| M-CB | Clipboard | Studio + Model | 14 |
| M-KB | Phím tắt | Studio | 15 |
| M-PG | Quản lý trang | Studio | 16 |

Mỗi module có: trách nhiệm, đầu vào/đầu ra, thuật toán hoặc quy tắc xử lý, trường hợp lỗi, tiêu chí kiểm thử.

---

### 1.2. Ngoài phạm vi

| Nội dung | Tài liệu |
|---|---|
| Xuất code (lowering, emitter, ghi file) | SPEC-04.2 |
| AI | SPEC-04.3 |
| Quét backend, Data Source, gắn dữ liệu | SPEC-04.4 |
| User Component (tạo, sửa, instance), quản lý Design Token | SPEC-04.5 |

---

## 2. M-WS — VÒNG ĐỜI WORKSPACE

### 2.1. Trạng thái

```text
         CLI khởi động (thư mục D)
                  │
                  ▼
      ┌──── D/.reactcraft tồn tại? ────┐
      │ không                          │ có
      ▼                                ▼
   [none]                       Lấy khóa phiên
  Studio hiện                  ┌── thất bại ──► thoát CLI, báo E018
  màn hình Welcome             │
      │ POST /workspace        ▼
      └──────────────►     Đọc + validate + migration
                               │
                    ┌── lỗi ───┴── ổn ──┐
                    ▼                   ▼
                 [error]              [open]
              Studio hiện          Studio hiện Editor
              màn hình lỗi
```

---

### 2.2. Khóa phiên

File `.reactcraft/lock`:

```json
{ "pid": 12345, "hostname": "MY-PC", "startedAt": "2026-10-09T08:00:00.000Z", "port": 5420 }
```

| Bước | Xử lý |
|---|---|
| 1 | Tạo file `lock` ở chế độ "chỉ tạo nếu chưa có" (`wx`) |
| 2 | Đã tồn tại: đọc nội dung. Cùng `hostname` và process `pid` không còn chạy thì coi là khóa cũ, xóa và thử lại bước 1 **một lần** |
| 3 | Process còn chạy, hoặc khác `hostname`: dừng với E018, in ra `port` của phiên đang chạy để người dùng mở |
| 4 | Server tắt (ADR-BE-03): xóa file `lock` sau khi ghi xong mọi thay đổi |

---

### 2.3. Đọc workspace

| Bước | Xử lý | Lỗi |
|---|---|---|
| 1 | Đọc `workspace.json`, validate | E003 (không đọc được), E004 (sai schema) |
| 2 | `schemaVersion` cũ hơn phiên bản hiện tại: sao lưu toàn bộ `.reactcraft/` vào `backups/migration-<thời điểm>/`, chạy chuỗi migration, ghi lại | E004 nếu migration lỗi |
| 3 | `schemaVersion` mới hơn phiên bản ReactCraft đang chạy: dừng, yêu cầu cập nhật ReactCraft | E004 với `params.schemaVersion` |
| 4 | Đọc `tokens.json`, `data-sources.json`, mọi file trong `pages/` theo `pageOrder`, mọi file trong `components/` | E003, E004 |
| 5 | Kiểm tra toàn vẹn chéo: mọi `TokenRef`, `Binding`, `ComponentInstance` trỏ tới thứ tồn tại; file trang không có trong `pageOrder` được thêm vào cuối kèm cảnh báo | Lỗi tham chiếu: E004 |
| 6 | Thành công: trạng thái `open`, `revision` lấy từ `workspace.json` | |

| Mã | Quy tắc |
|---|---|
| R-WS-01 | Một file lỗi thì cả workspace ở trạng thái `error`. **KHÔNG** mở một phần (tránh ghi đè làm mất dữ liệu) |
| R-WS-02 | Màn hình lỗi liệt kê từng file lỗi, mã lỗi, và nút "Khôi phục bản sao lưu gần nhất" cho file đó |

---

### 2.4. Tạo workspace mới

`POST /workspace` với:

```ts
type CreateWorkspaceRequest = {
  readonly name: string;
  readonly responsiveMode: ResponsiveMode;     // mặc định 'desktop-first'
  readonly primaryFrame: 'desktop-1440' | 'desktop-1920' | 'laptop-1280' | 'mobile-375' | Frame;
  readonly contentLocale: string;              // mặc định theo ngôn ngữ giao diện: vi → 'vi-VN', en → 'en-US'
  readonly darkMode: 'none' | 'media' | 'class';   // mặc định 'none'
};
```

Nội dung khởi tạo:

| Thành phần | Giá trị |
|---|---|
| Trang | Một trang `Home`, route `/`, root là `Stack` hướng cột, `width: fill`, `minHeight: { px: <chiều cao khung chuẩn> }` |
| Token | Bộ mặc định mục 4 |
| Khung (`desktop-first`) | Khung chuẩn đã chọn, Tablet 768 × 1024, Mobile 375 × 812 |
| Khung (`mobile-first`) | Mobile 375 × 812 (chuẩn), Tablet 768 × 1024, Desktop 1440 × 900 |
| Data Source Catalog | Rỗng |
| Ngôn ngữ nội dung | Theo `contentLocale` đã chọn. Màn hình Welcome giải thích: đây là ngôn ngữ của **trang web đang thiết kế**, khác với ngôn ngữ giao diện Studio |
| `.reactcraft/.gitignore` | `backups/`, `cache/`, `lock` |

---

## 3. M-DS — DESIGN STORE

### 3.1. Nhận batch

```text
POST /workspace/operations (OperationBatch)
   ↓
Zod validate request                      → E016
   ↓
baseRevision === revision ?               → E017
   ↓
applyBatch(doc, ops)                      → E005 (kèm index, rule)
   ↓
doc = kết quả, revision += 1
   ↓
Đánh dấu file bị ảnh hưởng là "dirty"
   ↓
Trả 200 { revision, idMap }
```

File bị ảnh hưởng theo operation:

| Operation | File dirty |
|---|---|
| Node operation với `target.kind = 'page'` | `pages/<pageId>.json` |
| Node operation với `target.kind = 'component'` | `components/<componentId>.json` |
| `page.create`, `page.delete`, `page.reorder` | file trang tương ứng + `workspace.json` |
| `page.update` | file trang |
| `token.*` | `tokens.json` |
| `component.*` | file component |
| `workspace.update` | `workspace.json` |
| Mọi batch | `workspace.json` (vì `revision`, `updatedAt` đổi) |

---

### 3.2. Ghi xuống disk

| Mã | Quy tắc |
|---|---|
| R-DS-01 | Ghi theo debounce **500 ms** kể từ batch cuối, nhưng không chậm quá **2 s** kể từ batch đầu tiên chưa ghi (NFR-06) |
| R-DS-02 | Mọi lần ghi đi qua hàng đợi workspace (`p-queue`, concurrency 1, ADR-BE-21) |
| R-DS-03 | Trước khi ghi đè một file: sao chép bản hiện tại sang `backups/<tên file>.<YYYYMMDD-HHmmss-SSS>.json`. Giữ **20** bản mới nhất mỗi file, xóa bản cũ hơn |
| R-DS-04 | Trang bị xóa: chuyển file vào `backups/` thay vì xóa hẳn |
| R-DS-05 | Ghi xong phát sự kiện `workspace.saved` với danh sách file |
| R-DS-06 | Server nhận `SIGINT`/`SIGTERM`: ghi ngay mọi file dirty rồi mới tắt |

---

### 3.3. Định dạng JSON chuẩn

| Mã | Quy tắc |
|---|---|
| R-DS-07 | Trường của object theo **thứ tự khai báo trong schema Zod** |
| R-DS-08 | Khóa của `Record` (token, `propValues`, `slots`, `bindings`, `responsive`, `states`) sắp xếp theo thứ tự chữ cái. Riêng `responsive` theo thứ tự `sm, md, lg, xl, 2xl` |
| R-DS-09 | Thụt lề 2 dấu cách, xuống dòng LF, có dòng trống cuối file, UTF-8 không BOM |
| R-DS-10 | Hàm `serializeCanonical(value)` trong `@reactcraft/model` thực hiện R-DS-07 đến R-DS-09. Ghi hai lần cùng một document cho ra file giống hệt từng byte |

---

### 3.4. Thay đổi từ bên ngoài

```text
chokidar: file trong .reactcraft/ thay đổi
   ↓
Hash nội dung == hash ReactCraft vừa ghi?  → bỏ qua
   ↓
Phát workspace.externalChange { files }
   ↓
Studio hiện thanh thông báo:
  "Workspace đã bị thay đổi bên ngoài ReactCraft (ví dụ git pull)."
  [Tải lại]
```

| Mã | Quy tắc |
|---|---|
| R-DS-11 | Khi đã có thay đổi bên ngoài, server **từ chối** batch mới với E017 cho đến khi Studio gọi `POST /workspace/reload` |
| R-DS-12 | Tải lại: các batch chưa gửi ở Studio bị bỏ, lịch sử Undo bị xóa. Thông báo nói rõ điều này trước khi người dùng bấm |

---

## 4. M-TK — BỘ TOKEN MẶC ĐỊNH

Workspace mới có bộ token sau, khớp thang mặc định của Tailwind v4 để code xuất ra quen thuộc với developer.

### 4.1. Màu

| Tên | Giá trị | Dùng cho |
|---|---|---|
| `background` | `#ffffff` | Nền trang |
| `surface` | `#f8fafc` | Nền card, khối |
| `foreground` | `#0f172a` | Chữ chính |
| `muted` | `#64748b` | Chữ phụ |
| `border` | `#e2e8f0` | Viền |
| `primary` | `#2563eb` | Màu chủ đạo |
| `primary-foreground` | `#ffffff` | Chữ trên nền primary |
| `secondary` | `#f1f5f9` | Nút phụ |
| `secondary-foreground` | `#0f172a` | |
| `danger` | `#dc2626` | Xóa, lỗi |
| `success` | `#16a34a` | Thành công |
| `warning` | `#d97706` | Cảnh báo |

---

### 4.2. Khoảng cách

Tên = hệ số của 4 px.

| Tên | `0` | `1` | `2` | `3` | `4` | `5` | `6` | `8` | `10` | `12` | `16` | `20` | `24` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| px | 0 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 | 96 |

---

### 4.3. Bo góc, bóng

| Bo góc | `none` | `sm` | `md` | `lg` | `xl` | `2xl` | `full` |
|---|---|---|---|---|---|---|---|
| px | 0 | 4 | 6 | 8 | 12 | 16 | 9999 |

| Bóng | Giá trị |
|---|---|
| `sm` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` |
| `md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` |
| `lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |

---

### 4.4. Chữ

| Cỡ chữ | `xs` | `sm` | `base` | `lg` | `xl` | `2xl` | `3xl` | `4xl` | `5xl` | `6xl` |
|---|---|---|---|---|---|---|---|---|---|---|
| px | 12 | 14 | 16 | 18 | 20 | 24 | 30 | 36 | 48 | 60 |
| Line height | 1.333 | 1.429 | 1.5 | 1.556 | 1.4 | 1.333 | 1.2 | 1.111 | 1 | 1 |

| Độ đậm | `normal` 400 | `medium` 500 | `semibold` 600 | `bold` 700 |
|---|---|---|---|---|

| Line height | `tight` 1.25 | `snug` 1.375 | `normal` 1.5 | `relaxed` 1.625 |
|---|---|---|---|---|

| Font | Giá trị |
|---|---|
| `sans` | `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"` |
| `mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |

---

## 5. M-SM — STYLING MAP

### 5.1. Vai trò

Hàm `toTailwindClasses(node, ctx)` trong `@reactcraft/model/styling` (ADR-FE-06) sinh danh sách class Tailwind cho một node. **Canvas và bộ sinh code dùng chung hàm này.** Mục này định nghĩa ánh xạ cho Tailwind v4. Khác biệt của v3 ở SPEC-04.2.

```ts
type StylingContext = {
  readonly tailwind: 'v3' | 'v4';
  readonly responsiveMode: ResponsiveMode;
  readonly parentLayout: 'flex-row' | 'flex-column' | 'grid' | 'none';   // layout của node cha
  readonly tokens: DesignTokens;
};
```

---

### 5.2. Chuyển giá trị

| Giá trị | Hậu tố class | Ví dụ |
|---|---|---|
| `token:<nhóm>.<tên>` | `<tên>` | `token:spacing.4` → `4` |
| `{ px: N }` | `[Npx]` | `{ px: 13 }` → `[13px]` |
| `{ percent: N }` | `[N%]` | `[50%]` |
| Màu hex | `[#rrggbb]` | `[#1e40af]` |
| Số không đơn vị (line height, font weight) | `[N]` | `[1.6]` |

Giá trị `{ px }` **luôn** sinh dạng `[Npx]`, kể cả khi trùng thang chuẩn, để kết quả xác định.

---

### 5.3. Bảng ánh xạ

| Thuộc tính | Giá trị | Class |
|---|---|---|
| Container flex | `Stack`, `Section`, `Card`, `Form`, `Navbar`, `Sidebar`, `Footer`, `DetailView`, `Modal`, `Container` | `flex` + `flex-row` hoặc `flex-col` theo `direction` |
| Container grid | `Grid` | `grid` |
| `columns` | N | `grid-cols-N` |
| `autoFit` | `{ minColumnWidth: { px: W } }` | `grid-cols-[repeat(auto-fit,minmax(Wpx,1fr))]` |
| `rows` | N | `grid-rows-N` |
| `gap` | v | `gap-<v>` |
| `align` | start, center, end, stretch, baseline | `items-start`, `items-center`, `items-end`, `items-stretch`, `items-baseline` |
| `justify` | start, center, end, between, around, evenly | `justify-start` … `justify-evenly` |
| `wrap` | true | `flex-wrap` |
| `grow` | true | `flex-1` |
| `alignSelf` | auto, start, center, end, stretch | `self-auto`, `self-start`, `self-center`, `self-end`, `self-stretch` |
| `colSpan` | N, full | `col-span-N`, `col-span-full` |
| `rowSpan` | N | `row-span-N` |
| `width` | `hug` | `w-fit` |
| `width` | `fill`, cha `flex-row` | `flex-1 min-w-0` |
| `width` | `fill`, trường hợp khác | `w-full` |
| `width` | fixed, percent | `w-[Npx]`, `w-[N%]` |
| `height` | `hug` | `h-fit` |
| `height` | `fill`, cha `flex-column` | `flex-1 min-h-0` |
| `height` | `fill`, trường hợp khác | `h-full` |
| `height` | fixed, percent | `h-[Npx]`, `h-[N%]` |
| `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | Px, `none` | `min-w-[Npx]`, `max-w-none` … |
| `aspectRatio` | 1/1, 16/9, khác | `aspect-square`, `aspect-video`, `aspect-[4/3]` |
| `padding` | 4 cạnh bằng nhau | `p-<v>` |
| `padding` | trên = dưới, trái = phải | `py-<v> px-<v>` |
| `padding` | còn lại | `pt-<v> pr-<v> pb-<v> pl-<v>` (chỉ cạnh có giá trị) |
| `margin` | như `padding` | `m-`, `my-`, `mx-`, `mt-` … |
| `fontFamily` | token | `font-<tên>` |
| `fontSize` | token, Px | `text-<tên>`, `text-[Npx]` |
| `fontWeight` | token, số | `font-<tên>`, `font-[N]` |
| `lineHeight` | token, số | `leading-<tên>`, `leading-[N]` |
| `textAlign` | left, center, right, justify | `text-left` … `text-justify` |
| `textColor` | token, hex | `text-<tên>`, `text-[#hex]` |
| `textTransform` | uppercase, lowercase, capitalize, none | `uppercase`, `lowercase`, `capitalize`, `normal-case` |
| `truncate` | true | `truncate` |
| `background` | token, hex | `bg-<tên>`, `bg-[#hex]` |
| `borderWidth` | 4 cạnh bằng nhau = 1 | `border` |
| `borderWidth` | 4 cạnh bằng nhau = N | `border-N` |
| `borderWidth` | khác nhau | `border-t-N border-r-N …` (chỉ cạnh có giá trị) |
| `borderColor` | token, hex | `border-<tên>`, `border-[#hex]` |
| `borderStyle` | dashed, dotted | `border-dashed`, `border-dotted` (solid là mặc định, không sinh class) |
| `radius` | token, Px | `rounded-<tên>`, `rounded-[Npx]` |
| `shadow` | token, none | `shadow-<tên>`, `shadow-none` |
| `opacity` | N | `opacity-N` |
| `display` | hidden | `hidden` |
| `display` | visible (sau khi bị ẩn ở mức rộng hơn hoặc hẹp hơn) | `flex`, `grid` hoặc `block` theo loại node |
| `position` | sticky | `sticky` |
| `stickyTop` | v | `top-<v>` |
| `zIndex` | N | `z-N` |
| `overflowX`, `overflowY` | hidden, auto | `overflow-x-hidden`, `overflow-x-auto`, `overflow-y-hidden`, `overflow-y-auto` |
| `backgroundImage` | linear-gradient | `bg-[linear-gradient(<góc>deg,<màu>_<at>%,…)]`. Màu token viết `var(--color-<tên>)` |
| `backgroundImage` | image, URL ngoài | `bg-[url(<url>)]` + `bg-cover`/`bg-contain`/`bg-auto` + `bg-center`/`bg-top`… + `bg-no-repeat` khi `repeat = false` |
| `backgroundImage` | image, `asset:` | Class kích thước, vị trí, lặp như trên. Đường dẫn ảnh đi qua thuộc tính `style` (ngoại lệ cho phép ở ADR-BE-16, vì ảnh được import trong code xuất ra) |
| `transition` | `{ property, durationMs }` | `transition-colors` / `transition-opacity` / `transition-shadow` / `transition-all` + `duration-<ms>` |
| Ẩn khi chạy (`runtime`, tương tác `hide`) | đang ẩn | v4: `hidden!`. v3: `!hidden` (thắng mọi `display` theo breakpoint) |

---

### 5.4. Tiền tố responsive và trạng thái

| Ngữ cảnh | Tiền tố |
|---|---|
| `responsive.<key>`, `desktop-first` | `max-<key>:` (ví dụ `max-md:p-2`) |
| `responsive.<key>`, `mobile-first` | `<key>:` (ví dụ `md:p-2`) |
| `states.hover` | `hover:` |
| `states.focus` | `focus-visible:` |
| `states.disabled` | `disabled:` |

---

### 5.5. Thứ tự class

Sinh theo thứ tự cố định để kết quả xác định (R-SM-01):

```text
1. layout container   2. vị trí trong cha   3. kích thước   4. khoảng cách
5. typography         6. màu nền            7. viền          8. hiệu ứng      9. display
→ base, sau đó từng khóa responsive theo thứ tự ưu tiên tăng dần, sau đó trạng thái
```

| Mã | Quy tắc |
|---|---|
| R-SM-01 | Cùng đầu vào cho cùng danh sách class, cùng thứ tự |
| R-SM-02 | Không sinh class trùng nhau. Giá trị `responsive` trùng giá trị đang áp dụng thì bỏ qua (V-29) |
| R-SM-03 | Mỗi dòng của bảng 5.3 có ít nhất một golden test cho v4 |

---

### 5.6. Token sang biến theme

Canvas (và code xuất ra với Tailwind v4) khai báo token trong khối `@theme`:

| Nhóm token | Biến theme | Class sinh ra |
|---|---|---|
| `color.<n>` | `--color-<n>` | `bg-<n>`, `text-<n>`, `border-<n>` |
| `spacing.<n>` | `--spacing-<n>` | `p-<n>`, `gap-<n>`, `m-<n>` |
| `radius.<n>` | `--radius-<n>` | `rounded-<n>` |
| `shadow.<n>` | `--shadow-<n>` | `shadow-<n>` |
| `fontSize.<n>` | `--text-<n>`, `--text-<n>--line-height` | `text-<n>` |
| `fontWeight.<n>` | `--font-weight-<n>` | `font-<n>` |
| `lineHeight.<n>` | `--leading-<n>` | `leading-<n>` |
| `fontFamily.<n>` | `--font-<n>` | `font-<n>` |

| Mã | Quy tắc |
|---|---|
| R-SM-04 | Tên token trùng tên mặc định của Tailwind (ví dụ `spacing.4`) **ghi đè** giá trị mặc định đó. VG-10 kiểm tra Tailwind runtime áp dụng đúng |
| R-SM-05 | Tên token `fontWeight` và `fontFamily` **KHÔNG** được trùng nhau, vì cùng sinh class `font-<n>` |

**Chế độ tối:** token màu có giá trị `dark` sinh thêm phần ghi đè biến:

| Nơi | Cách ghi đè |
|---|---|
| Canvas | Luôn dùng `.dark { --color-<n>: <dark>; }`. Nút ☀/☾ trên toolbar thêm/bỏ class `dark` ở `<html>` của iframe |
| Xuất code, `darkMode = 'media'` | `@media (prefers-color-scheme: dark) { :root { --color-<n>: <dark>; } }` |
| Xuất code, `darkMode = 'class'` | `.dark { --color-<n>: <dark>; }` và biến thể `dark` theo class (SPEC-04.2 mục 8) |

---

## 6. M-SH — STUDIO SHELL VÀ MÀN HÌNH

### 6.1. Màn hình theo trạng thái workspace

| Trạng thái (`GET /session`) | Màn hình |
|---|---|
| `none` | **Welcome**: tên workspace, chọn chế độ (desktop-first / mobile-first, có giải thích ngắn), chọn khung chuẩn, nút "Tạo workspace" |
| `error` | **Workspace Error**: danh sách file lỗi, mã lỗi, nút khôi phục từng file, nút "Thử lại" |
| `open`, `trusted = true` | **Editor** (6.2) |
| `open`, `trusted = false` | **Editor ở chế độ hạn chế** (SPEC-05 mục 13): lần đầu hiện hộp thoại tin cậy liệt kê các thư mục được liên kết; sau đó thanh cảnh báo cố định "Workspace chưa được tin cậy — một số chức năng bị khóa" + nút [Tin cậy] |
| Mất kết nối server | Lớp phủ "Mất kết nối tới ReactCraft. Đang thử kết nối lại…". Thao tác sửa bị khóa |

---

### 6.2. Bố cục Editor

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Trang ▾] [Khung: Desktop 1440 ▾] [Zoom 75% ▾]   [↶][↷]   [vi|en] [Xuất code]│
├───────────────┬─────────────────────────────────────────────┬───────────────┤
│ [Library|Lớp] │                                             │ [Thuộc tính]  │
│               │                 Canvas                      │ [Dữ liệu]     │
│               │                                             │ [AI]          │
│  260 px       │              (phần còn lại)                 │  300 px       │
├───────────────┴─────────────────────────────────────────────┴───────────────┤
│ Thanh trạng thái: Đã lưu · revision 42 · node đang chọn: Card › Heading      │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Mã | Quy tắc |
|---|---|
| R-SH-01 | Panel trái và phải co giãn được, tối thiểu 200 px, tối đa 480 px. Ẩn/hiện được. Kích thước lưu trong `localStorage` (thông tin không nhạy cảm) |
| R-SH-02 | Màn hình nhỏ hơn 1024 px: hiện thông báo "Studio cần màn hình rộng tối thiểu 1024 px" |
| R-SH-03 | Thanh trạng thái hiển thị trạng thái lưu: "Đang lưu…", "Đã lưu", "Lỗi lưu" (bấm để xem chi tiết) |

---

## 7. M-CV — CANVAS RENDERER

### 7.1. Nguyên tắc

- Render cây node của trang (hoặc component đang sửa) vào iframe bằng `createPortal` (ADR-FE-04).
- Mỗi node render thành phần tử HTML theo bảng 7.2, class lấy từ `toTailwindClasses` (mục 5), thêm thuộc tính `data-rc-node="<id>"`.
- Component render một node là component React nhận `nodeId`, đọc store bằng selector theo ID (ADR-FE-10).

---

### 7.2. Ánh xạ node sang HTML trên Canvas

| Node | Phần tử | Ghi chú |
|---|---|---|
| `Stack`, `Card` | `div` | |
| `Grid` | `div` | |
| `Section` | `section` hoặc theo `content.as` | |
| `Container` | `div` | Thêm `mx-auto w-full` và giới hạn rộng theo `maxWidth`: sm `max-w-[640px]`, md `max-w-[768px]`, lg `max-w-[1024px]`, xl `max-w-[1280px]`, 2xl `max-w-[1536px]`, full `max-w-full` |
| `Navbar` | `nav` | |
| `Sidebar` | `aside` | |
| `Footer` | `footer` | |
| `Form` | `form` | `onSubmit` bị chặn |
| `Text` | `p` hoặc `span` | |
| `Heading` | `h1`…`h6` | |
| `Image` | `img` | `asset:` được đổi thành `/api/v1/workspace/assets/<tên>` |
| `Icon` | `svg` | Lấy từ bộ icon Lucide đóng gói |
| `Link` | `a` | Điều hướng bị chặn |
| `Divider` | `hr` | |
| `Button` | `button` | `type` theo `buttonType` |
| `Input`, `Textarea`, `Select` | `div` > `label` + điều khiển | |
| `Checkbox`, `Radio` | `label` > `input` + chữ | |
| `Switch` | `button role="switch"` | |
| `Table` | `table` > `thead` + `tbody` | 5 dòng dữ liệu mẫu (khi chưa gắn dữ liệu: 3 dòng trống có khung) |
| `List` | `div` | Lặp node con 3 lần (xem 7.4) |
| `DetailView` | `div` | Một bản ghi mẫu |
| `Modal` | `div` lớp phủ + hộp | Xem 7.5 |
| `Tabs` | `div` > danh sách tab + nội dung tab đang mở | Tab đang mở là trạng thái riêng của Studio, mặc định tab đầu |
| `ComponentInstance` | Render `root` của component với `propValues` và nội dung `slots` | Xem 7.6 |
| `Slot` (khi sửa component) | `div` khung nét đứt, ghi tên slot | Chỉ có trên Canvas |

---

### 7.3. Hiển thị phụ trợ (chỉ có trên Canvas)

| Mã | Quy tắc |
|---|---|
| R-CV-01 | Container rỗng hiển thị khung nét đứt cao 48 px với chữ "Kéo phần tử vào đây" để thả được. Khung này **không** xuất code |
| R-CV-02 | Node `hidden: true` không render trên Canvas, vẫn hiện trong Layer Tree với biểu tượng ẩn |
| R-CV-03 | Node có binding hiển thị giá trị mẫu (`generateMockRecords`, seed = ID node, SPEC-03 mục 6). Dữ liệu mẫu và định dạng số, tiền, ngày theo **`contentLocale`** của workspace (ví dụ `vi-VN`: tên tiếng Việt, `1.250.000 ₫`, `09/10/2026`) |
| R-CV-04 | Ảnh không tải được hiển thị ô xám có biểu tượng ảnh, kích thước theo thuộc tính |

---

### 7.4. List

- Node con duy nhất là **mẫu** cho mỗi phần tử.
- Canvas render mẫu **3 lần**. Bản đầu có `data-rc-node="<id>"`. Bản 2 và 3 có thêm `data-rc-repeat="1"`, `"2"` và hiển thị mờ 60%.
- Click vào bản lặp thì chọn node mẫu tương ứng.

---

### 7.5. Modal

- Modal không có `openByDefault` thì **ẩn** trên Canvas, trừ khi đang được chọn trong Layer Tree.
- Khi hiện: lớp phủ nền tối phủ khung, hộp modal ở giữa. Bấm nút đóng trên Canvas không xóa node, chỉ ẩn.

---

### 7.6. ComponentInstance

- Render nội dung component, thay `propValues` vào chỗ tương ứng, đặt node trong `slots` vào vị trí `Slot`.
- Node bên trong component **không chọn được** từ instance. Click chọn cả instance.
- Node trong `slots` chọn và sửa được như node bình thường.
- Double-click instance: mở chế độ **sửa component** (Canvas render `UserComponent.root`, toolbar hiện "Đang sửa component <tên>" và nút quay lại).

---

### 7.7. Chế độ Xem thử (Preview)

Canvas có hai chế độ:

| Chế độ | Click trên Canvas | Overlay |
|---|---|---|
| **Thiết kế** (mặc định) | Chọn phần tử (mục 8) | Bật |
| **Xem thử** (nút ▶ trên toolbar, phím `Alt+P`) | **Chạy tương tác** (SPEC-03 mục 6a) | Tắt |

`InteractionRuntime` (trong `features/canvas/runtime/`) giữ **trạng thái khi chạy** riêng cho Canvas, không ghi vào Design Model:

| Trạng thái | Nội dung |
|---|---|
| Modal đang mở | Tập `modalId` |
| Hiển thị khi chạy | Map `nodeId → visible`, khởi tạo từ `runtime.initiallyHidden` |
| Tab đang mở | Map `tabsId → tabId` |
| Trang đang xem | `pageId` + tham số route, có lịch sử để nút "Quay lại" |
| Toast | Danh sách thông báo đang hiện (tự ẩn sau 4 s) |
| Dữ liệu mẫu | Bản sao dữ liệu mẫu theo node, để `deleteRecord` và `refreshData` có hiệu ứng |

Cách chạy từng hành động trong Xem thử:

| Hành động | Hiệu ứng trên Canvas |
|---|---|
| `navigate` | Chuyển Canvas sang trang đích. Tham số từ bản ghi mẫu hiện trên thanh địa chỉ giả của khung |
| `openUrl` | Hỏi xác nhận rồi mở tab mới của trình duyệt (không mở trong Canvas) |
| `openModal`, `closeModal` | Mở/đóng Modal |
| `show`, `hide`, `toggle` | Đổi trạng thái hiển thị khi chạy |
| `scrollTo` | Cuộn mượt trong iframe tới node |
| `switchTab` | Đổi tab |
| `showToast` | Hiện toast ở góc trên phải của khung |
| `refreshData` | Sinh lại dữ liệu mẫu với seed mới |
| `deleteRecord` | Hiện hộp xác nhận, đồng ý thì xóa bản ghi khỏi dữ liệu mẫu |
| `Form` submit | Kiểm tra ràng buộc nhập liệu. Hợp lệ: chạy `submitSuccess`. Có nút "Giả lập lỗi" trong Inspector để thử `submitError` |

| Mã | Quy tắc |
|---|---|
| R-CV-08 | Thoát Xem thử (nút ■, `Esc`): trạng thái khi chạy bị xóa, Canvas về trang đang thiết kế |
| R-CV-09 | Xem thử **không** gọi API thật, không mở URL trong iframe |
| R-CV-10 | Ở chế độ Thiết kế, node `runtime.initiallyHidden` **vẫn hiển thị** (mờ 50%, có nhãn "Ẩn khi tải trang") để sửa được |

---

### 7.8. Hiệu năng

| Mã | Quy tắc |
|---|---|
| R-CV-05 | Đổi thuộc tính một node chỉ re-render node đó (selector theo ID). Kiểm tra bằng React Profiler trong test hiệu năng |
| R-CV-06 | Mở trang 500 node: render xong ≤ 1 s (PB-16) |
| R-CV-07 | Khối `@theme` chỉ cập nhật khi token đổi, không cập nhật theo từng thao tác node |

---

## 8. M-OV — OVERLAY VÀ CHỌN PHẦN TỬ

### 8.1. Thành phần Overlay

| Thành phần | Hiển thị |
|---|---|
| Hover | Viền 1 px màu nhấn quanh node dưới con trỏ |
| Selection | Viền 2 px màu nhấn, nhãn tên node (hoặc tên loại) ở góc trên trái, kích thước `rộng × cao` ở dưới |
| Multi-selection | Viền từng node + khung bao chung |
| Padding/gap hint | Khi đang chỉnh padding hoặc gap ở Inspector: tô vùng padding/gap của node đang chọn |
| Drop indicator | Xem mục 9 |
| Text editing | Khung sửa chữ trực tiếp (8.4) |

---

### 8.2. Quy tắc chọn

| Thao tác | Kết quả |
|---|---|
| Click | Chọn node gần nhất có `data-rc-node` dưới con trỏ (bỏ qua node `locked`) |
| Click vào bản lặp của `List` | Chọn node mẫu |
| Click vào bên trong `ComponentInstance` (ngoài slot) | Chọn instance |
| Shift + Click | Thêm hoặc bỏ node khỏi lựa chọn |
| Click vào vùng trống ngoài trang | Bỏ chọn |
| Ctrl/Cmd + Click | Chọn node **sâu nhất** dưới con trỏ, bỏ qua quy tắc "chọn cha trước" (8.3) |

---

### 8.3. Chọn cha trước

Khi chưa chọn gì, click vào phần tử lồng sâu sẽ chọn **node cấp cao nhất chưa được chọn** trong chuỗi tổ tiên dưới root, giống Figma. Click lần nữa vào cùng vị trí thì đi sâu một cấp.

| Mã | Quy tắc |
|---|---|
| R-OV-01 | Thứ tự đi sâu: root bị bỏ qua → con cấp 1 → … → node sâu nhất |
| R-OV-02 | Nếu node đang chọn là tổ tiên của phần tử được click, chọn con trực tiếp của node đang chọn theo hướng đó |

---

### 8.4. Sửa chữ trực tiếp

| Bước | Xử lý |
|---|---|
| 1 | Double-click `Button`, `Link`: phần tử chuyển sang `contenteditable="plaintext-only"` (chữ thuần) |
| 2 | Double-click `Text`, `Heading`: mở **trình soạn rich text** (ADR-FE-20) gắn trên phần tử trong iframe, kèm thanh công cụ nổi: **Đậm**, *Nghiêng*, Gạch chân, Gạch ngang, `Code`, Liên kết, Màu chữ (chọn token) |
| 3 | Enter (không Shift) hoặc click ra ngoài: kết thúc. Kết quả chuyển thành `text` + `runs` (gộp đoạn liền kề cùng định dạng, V-34), dispatch `setContent` |
| 4 | Shift+Enter: xuống dòng trong cùng đoạn |
| 5 | Esc: hủy, khôi phục nội dung cũ |
| 6 | Dán từ nơi khác: chỉ giữ chữ và các định dạng ở bước 2, bỏ mọi style khác |
| 7 | Node có binding `text`: không cho sửa trực tiếp, hiện gợi ý "Nội dung lấy từ dữ liệu" |

---

## 9. M-DD — KÉO THẢ

### 9.1. Nguồn kéo

| Nguồn | Kết quả khi thả |
|---|---|
| Mục trong Library | `insert` cây node tạo từ preset (mục 10) |
| Node trên Canvas (kéo bằng nhãn của khung chọn) | `move` |
| Node trong Layer Tree | `move` |

---

### 9.2. Thuật toán vị trí thả

Đầu vào: tọa độ con trỏ `(clientX, clientY)`, node đang kéo (hoặc loại node mới).

```text
1. Quy đổi tọa độ vào iframe:
   x = (clientX − frameRect.left) / zoom ;  y = (clientY − frameRect.top) / zoom

2. els = iframeDocument.elementsFromPoint(x, y)
   N  = phần tử đầu tiên có data-rc-node, KHÔNG thuộc cây con của node đang kéo,
        KHÔNG locked. Không có → không có vị trí thả.

3. Chọn container đích C và node tham chiếu R:
   - N là container VÀ (N rỗng HOẶC con trỏ cách mọi cạnh của N > 12 px)
       → C = N, R = không có
   - Ngược lại
       → C = cha(N), R = N

4. Tính chỉ số chèn trong C (bỏ qua node đang kéo):
   - C flex-row (không wrap): so x với điểm giữa theo chiều ngang của từng con
   - C flex-column: so y với điểm giữa theo chiều dọc
   - C grid hoặc flex-wrap: nhóm con theo hàng (cùng khoảng y), tìm hàng chứa y,
     rồi so x trong hàng đó
   - Có R: chỉ số = vị trí của R, +1 nếu con trỏ ở nửa sau của R

5. Kiểm tra canInsert(doc, C, loại node, chỉ số) theo V-10 đến V-20, V-42.
   Không hợp lệ → thử lại bước 3 với C = cha(C), tối đa đến root.
   Vẫn không hợp lệ → không có vị trí thả.

6. Kết quả: { parentId: C, index, indicator }
```

`canInsert` là hàm thuần trong `@reactcraft/model`, dùng chung với `validateOperation`.

---

### 9.3. Chỉ báo vị trí thả

| Trường hợp | Chỉ báo |
|---|---|
| Chèn giữa các con của flex-row | Vạch dọc 2 px giữa hai con |
| Chèn giữa các con của flex-column | Vạch ngang 2 px giữa hai con |
| Chèn vào grid | Vạch dọc tại ô đích |
| Thả vào container rỗng hoặc vào trong | Viền 2 px nét đứt quanh container, nền mờ |
| Không có vị trí hợp lệ | Con trỏ `not-allowed`, không có chỉ báo |

Nhãn nhỏ cạnh chỉ báo ghi tên container đích (ví dụ "Vào Card").

---

### 9.4. Quy tắc

| Mã | Quy tắc |
|---|---|
| R-DD-01 | Cache vị trí các con của container đang trỏ tới. Chỉ đo lại khi đổi container, cuộn, hoặc đổi zoom. Mỗi lần di chuyển chuột ≤ 8 ms (PB-15) |
| R-DD-02 | Con trỏ cách mép trên/dưới khung < 40 px: tự cuộn iframe, tốc độ tỷ lệ với khoảng cách |
| R-DD-03 | Esc trong lúc kéo: hủy, không có operation |
| R-DD-04 | Thả đúng vị trí cũ: không tạo operation |
| R-DD-05 | Kéo nhiều node đã chọn: chỉ khi chúng cùng cha. Thả tạo một batch `move` giữ nguyên thứ tự |
| R-DD-06 | Bàn phím (ADR-FE-09): chọn node, `Space` để nhấc, phím mũi tên đi qua danh sách vị trí hợp lệ (theo thứ tự cây), `Space` để thả, `Esc` để hủy |

---

## 10. M-LB — COMPONENT LIBRARY

### 10.1. Preset

Mỗi mục trong Library là một **preset**: hàm thuần tạo cây node với giá trị mặc định hợp lý.

```ts
// @reactcraft/model/presets
type Preset = {
  readonly id: string;                         // ví dụ 'layout.stack-row'
  readonly category: 'layout' | 'content' | 'form' | 'data' | 'composite';
  readonly labelKey: string;                   // khóa i18n, ví dụ 'library:presets.stackRow'
  readonly icon: string;                       // tên icon Lucide
  readonly create: (ctx: { tokens: DesignTokens }) => DesignNodeInput;  // cây chưa có ID
};
```

---

### 10.2. Danh sách preset Phase 1

| Nhóm | Preset | Cây node và giá trị mặc định chính |
|---|---|---|
| Layout | Hàng (Stack row) | `Stack` row, gap 4, align center |
| Layout | Cột (Stack column) | `Stack` column, gap 4 |
| Layout | Lưới 3 cột | `Grid` columns 3, gap 6 |
| Layout | Lưới tự co giãn | `Grid` autoFit 240 px, gap 6 |
| Layout | Section | `Section` column, padding y 16 x 6, width fill |
| Layout | Container | `Container` maxWidth xl, padding x 6 |
| Nội dung | Tiêu đề | `Heading` level 2, fontSize 3xl, fontWeight bold, text "Tiêu đề" / "Heading" |
| Nội dung | Đoạn văn | `Text`, fontSize base, textColor muted |
| Nội dung | Ảnh | `Image` width fill, aspectRatio 16/9, radius lg |
| Nội dung | Icon | `Icon` `star`, 24 px |
| Nội dung | Liên kết | `Link`, textColor primary |
| Nội dung | Đường kẻ | `Divider`, borderColor border |
| Form | Form | `Form` column, gap 4 + một `Input` + một `Button` submit |
| Form | Ô nhập | `Input` text, label "Tên trường" / "Field label" |
| Form | Vùng văn bản | `Textarea` rows 4 |
| Form | Chọn | `Select` 2 lựa chọn mẫu |
| Form | Checkbox, Radio, Switch | Một lựa chọn mẫu |
| Form | Nút | `Button` primary, padding y 2 x 4, radius md, text "Nút" / "Button" |
| Dữ liệu | Bảng | `Table` 3 cột mẫu, chưa gắn dữ liệu |
| Dữ liệu | Danh sách | `List` chứa một `Card` mẫu |
| Dữ liệu | Chi tiết | `DetailView` chứa 3 cặp nhãn – giá trị |
| Tổng hợp | Card | `Card` padding 6, radius lg, background surface, shadow sm, gap 3 + `Heading` level 3 + `Text` |
| Tổng hợp | Thanh điều hướng | `Navbar` row, justify between, padding y 4 x 6 + logo `Text` + `Stack` row 3 `Link` |
| Tổng hợp | Sidebar | `Sidebar` column, width fixed 240, padding 4 + 4 `Link` |
| Tổng hợp | Chân trang | `Footer` row, justify between, padding y 8 x 6 + 2 `Text` |
| Tổng hợp | Modal | `Modal` + `Heading` + `Text` + `Stack` row 2 `Button` |
| Tổng hợp | Tabs | `Tabs` 2 mục + 2 `Stack` |
| Tổng hợp | Thanh điều hướng responsive | `Navbar` gồm: logo, `Stack` liên kết (ẩn ở dải < 768 px), nút ☰ (`Button` + `Icon menu`, chỉ hiện ở dải < 768 px) có tương tác `click → toggle` menu điện thoại; menu điện thoại là `Stack` cột, `runtime.initiallyHidden`, chỉ hiện ở dải < 768 px |
| Tổng hợp | Hero | `Section` padding y 24, căn giữa + `Heading` level 1 cỡ 5xl + `Text` cỡ lg màu muted + `Stack` row 2 `Button` (primary, outline) |
| Nội dung | Huy hiệu (Badge) | `Text` as span, cỡ xs, đậm medium, padding trên/dưới `{ px: 2 }`, trái/phải `{ px: 8 }`, radius full, nền secondary |
| Nội dung | Ảnh đại diện (Avatar) | `Image` 40 × 40, radius full, aspectRatio 1/1 |
| Form | Form tạo mới có Modal | `Button` "Thêm mới" (`click → openModal`) + `Modal` chứa `Form` (`submitSuccess → closeModal, showToast success`) |

| Mã | Quy tắc |
|---|---|
| R-LB-01 | Chữ mẫu trong preset lấy theo **`contentLocale`** của workspace (`vi-*` dùng tiếng Việt, còn lại tiếng Anh). Sau đó là nội dung thiết kế, không tự dịch (NFR-17) |
| R-LB-02 | Preset chỉ dùng token có trong bộ mặc định. Token đã bị xóa: dùng giá trị `{ px }` tương đương và ghi cảnh báo |
| R-LB-03 | Library có ô tìm kiếm theo tên (cả `vi` và `en`) |

---

## 11. M-IN — INSPECTOR

### 11.1. Phạm vi đang sửa

Đầu Inspector luôn hiển thị **phạm vi** của thao tác sửa:

```text
Đang sửa: [Desktop 1440 · Gốc]  [Trạng thái: Bình thường ▾]
          hoặc
Đang sửa: [Mobile 375 · Ghi đè < 640 px]
```

- Khóa responsive tính theo SPEC-03 mục 2.2a từ khung đang xem.
- Trạng thái (`hover`, `focus`, `disabled`) chỉ chọn được ở phạm vi gốc (V-28).

---

### 11.2. Các nhóm điều khiển

| Nhóm | Hiện khi | Điều khiển |
|---|---|---|
| Bố cục | Node container | Hướng (hàng/cột), gap, align, justify, wrap. Grid: số cột hoặc auto-fit + độ rộng tối thiểu ô, số hàng |
| Vị trí trong cha | Luôn | Grow, align self (cha flex). Col span, row span (cha Grid) |
| Kích thước | Luôn | Rộng, cao: Hug / Fill / Cố định / %. Min, max. Tỷ lệ khung |
| Khoảng cách | Luôn | Hộp padding và margin 4 cạnh, có khóa "đồng bộ 4 cạnh" và "đồng bộ trục" |
| Chữ | Node có chữ | Font, cỡ, độ đậm, line height, căn lề, màu, chuyển hoa/thường, cắt dòng |
| Nền | Luôn | Màu nền |
| Viền | Luôn | Độ dày (4 cạnh), màu, kiểu, bo góc |
| Hiệu ứng | Luôn | Bóng, độ mờ |
| Hiển thị | Ở phạm vi ghi đè | Ẩn/hiện ở dải màn hình này |
| Nội dung | Theo `content.kind` | Ví dụ: chữ, cấp tiêu đề, ảnh (tải lên / URL / alt), href, biến thể nút, nhãn ô nhập, cột bảng |
| Dữ liệu | Node có khóa binding | Phase 4 (SPEC-04.4). Phase 1 hiện "Chưa có nguồn dữ liệu" |
| Vị trí đặc biệt | Luôn | Dính khi cuộn (sticky) + khoảng cách trên, lớp (z-index) |
| Tràn | Luôn | Tràn ngang, tràn dọc: hiện / ẩn / cuộn |
| Nền nâng cao | Luôn | Gradient tuyến tính (góc, 2..5 điểm màu) hoặc ảnh nền (tải lên / URL, kích thước, vị trí, lặp) |
| Chuyển động | Luôn | Loại chuyển động và thời gian, dùng cho trạng thái hover/focus |
| Ràng buộc nhập liệu | `Input`, `Textarea` | Bắt buộc, độ dài tối thiểu/tối đa, giá trị tối thiểu/tối đa, ngày, định dạng (email, điện thoại, URL, chữ số), thông báo lỗi |
| Tương tác | Node cho phép (SPEC-03 mục 6a.2), không nằm trong định nghĩa component | Danh sách tương tác. Thêm: chọn sự kiện → thêm hành động (chọn từ menu, chọn đích bằng cách bấm node trên Canvas hoặc trong Layer Tree). Kéo để sắp xếp hành động |
| Khi chạy | Luôn | "Ẩn khi tải trang" (`runtime.initiallyHidden`). Danh sách các tương tác đang điều khiển node này |
| Lớp | Luôn | Tên lớp, ẩn, khóa |

---

### 11.3. Nhập giá trị

| Mã | Quy tắc |
|---|---|
| R-IN-01 | Mỗi điều khiển giá trị có hai chế độ: **chọn token** (danh sách token của nhóm, hiện cả giá trị px) và **giá trị tùy chỉnh** (ô số, đơn vị px). Mặc định ưu tiên token |
| R-IN-02 | Giá trị bị ghi đè ở phạm vi hiện tại có **chấm màu** cạnh nhãn. Bấm chấm để xem giá trị gốc và nút "Xóa ghi đè" (dispatch `setStyle` với `unset`) |
| R-IN-03 | Giá trị được kế thừa từ phạm vi khác hiển thị chữ mờ, kèm chú thích "từ Desktop" |
| R-IN-04 | Kéo chuột trên nhãn số (scrub) hoặc giữ phím mũi tên: preview liên tục, nhưng **gộp** thành một mục Undo (mục 13.3) |
| R-IN-05 | Giá trị không hợp lệ (ngoài khoảng, sai định dạng): viền đỏ, không dispatch, tooltip nêu khoảng hợp lệ |
| R-IN-06 | Chọn nhiều node: chỉ hiện nhóm điều khiển chung. Giá trị khác nhau hiện "Nhiều giá trị". Sửa sẽ áp dụng cho tất cả trong một batch |
| R-IN-07 | Từ lúc thay đổi điều khiển đến lúc Canvas hiển thị ≤ 100 ms (PB-14) |

---

## 12. M-LT — LAYER TREE

| Mã | Quy tắc |
|---|---|
| R-LT-01 | Hiển thị cây node của trang đang mở, ảo hóa bằng `@tanstack/react-virtual` |
| R-LT-02 | Mỗi dòng: biểu tượng loại node, tên (hoặc tên loại dịch theo ngôn ngữ), nút ẩn/hiện, nút khóa, biểu tượng binding nếu có |
| R-LT-03 | Lựa chọn đồng bộ hai chiều với Canvas. Chọn trên Canvas thì cây tự mở và cuộn tới node |
| R-LT-04 | Double-click tên hoặc F2: đổi tên (`setNodeMeta`) |
| R-LT-05 | Kéo thả trong cây dùng `@dnd-kit/sortable`, kiểm tra hợp lệ bằng cùng `canInsert` (mục 9.2) |
| R-LT-06 | Menu chuột phải: Nhân bản, Xóa, Bọc trong Hàng/Cột/Lưới, Bỏ bọc, Sao chép, Dán vào trong, Đổi tên |
| R-LT-08 | Xóa node đang là đích của tương tác (V-98): hộp thoại liệt kê các tương tác bị ảnh hưởng, nút "Xóa và gỡ tương tác" tạo một batch gồm `setInteractions` cho các node liên quan và `remove` |
| R-LT-09 | Node có tương tác hiện biểu tượng ⚡ trong Layer Tree. Node đích của tương tác hiện biểu tượng ◎ |
| R-LT-07 | `ComponentInstance` hiện như một dòng, có thể mở để thấy slot. Không hiện node nội bộ của component |

---

## 13. M-HS — UNDO/REDO VÀ ĐỒNG BỘ

### 13.1. Mục lịch sử

```ts
type HistoryEntry = {
  readonly id: string;
  readonly label: string;                      // ví dụ 'Change padding'
  readonly source: 'user' | 'ai';
  readonly forward: readonly DesignOperation[];
  readonly inverse: readonly DesignOperation[];   // theo thứ tự ngược (V-51)
  readonly at: number;                         // thời điểm, ms
  readonly coalesceKey?: string;               // xem 13.3
};
```

Ngăn xếp Undo tối đa **200** mục (V-55).

---

### 13.2. Luồng dispatch

```text
dispatch(ops, meta)
  ├─ applyBatch(doc, ops)  ── lỗi ──► toast lỗi theo mã, không đổi gì
  ├─ cập nhật document trong store
  ├─ đẩy HistoryEntry (hoặc gộp, 13.3), xóa ngăn Redo
  └─ đưa ops vào hàng đợi đồng bộ

Hàng đợi đồng bộ (debounce 300 ms)
  ├─ gom ops thành OperationBatch { baseRevision: revision đã biết }
  ├─ POST /workspace/operations
  ├─ 200 → revision = kết quả
  ├─ E017 → tải lại document, xóa lịch sử, toast "Workspace đã thay đổi, đã tải lại"
  └─ E005 → áp inverse của batch lên store, xóa các mục lịch sử tương ứng, toast lỗi
```

| Mã | Quy tắc |
|---|---|
| R-HS-01 | Chỉ một request đồng bộ được gửi tại một thời điểm. Ops mới trong lúc chờ được gom vào batch kế tiếp |
| R-HS-02 | Undo = dispatch `inverse` với `meta.label` = "Undo: <label>", nhưng **không** đẩy vào ngăn Undo mà chuyển mục sang ngăn Redo |
| R-HS-03 | Có thay đổi chưa đồng bộ và người dùng đóng tab: hỏi xác nhận (`beforeunload`) |

---

### 13.3. Gộp mục lịch sử

Hai thao tác liên tiếp được gộp thành một mục Undo khi **tất cả** điều sau đúng:

1. cùng `coalesceKey` = `setStyle:<nodeId>:<breakpoint>:<state>:<tên thuộc tính>` hoặc `setContent:<nodeId>:<trường>`;
2. cách nhau ≤ 500 ms;
3. nguồn là `user`.

Khi gộp: `forward` = ops mới nhất, `inverse` giữ của mục đầu tiên.

---

## 14. M-CB — CLIPBOARD

| Mã | Quy tắc |
|---|---|
| R-CB-01 | Sao chép ghi vào clipboard hệ thống hai định dạng: `application/x-reactcraft-nodes+json` (cây node + token đang dùng) và `text/plain` (chữ của các node) |
| R-CB-02 | Dán: tạo ID mới cho toàn bộ cây (`assignIds`). Vị trí: vào trong node đang chọn nếu là container và hợp lệ, ngược lại ngay sau node đang chọn |
| R-CB-03 | Dán từ workspace khác: token không tồn tại được đổi thành giá trị `{ px }` hoặc màu hex tương ứng (lấy từ dữ liệu token đi kèm). Binding không tồn tại bị gỡ. Hiện thông báo tóm tắt |
| R-CB-04 | Cắt = sao chép + `remove` trong một mục Undo |
| R-CB-05 | Nhân bản (Ctrl/Cmd + D) = sao chép + dán ngay sau node, không đụng clipboard hệ thống |

---

## 15. M-KB — PHÍM TẮT

Giải quyết Q-05 của SPEC-01.2: dùng bộ phím gần giống Figma cho các thao tác phổ biến. `Mod` là Ctrl trên Windows/Linux, Cmd trên macOS.

| Phím | Hành động |
|---|---|
| `Mod+Z` | Undo |
| `Mod+Shift+Z`, `Mod+Y` | Redo |
| `Mod+C`, `Mod+X`, `Mod+V` | Sao chép, cắt, dán |
| `Mod+D` | Nhân bản |
| `Delete`, `Backspace` | Xóa node đang chọn |
| `Mod+G` | Bọc trong Stack (hướng theo cha) |
| `Mod+Shift+G` | Bỏ bọc |
| `Esc` | Chọn node cha / hủy thao tác đang làm |
| `Enter` | Chọn con đầu tiên |
| `Tab`, `Shift+Tab` | Chọn node anh em kế tiếp / trước đó |
| `Mod+↑`, `Mod+↓` | Đổi thứ tự trong cha (lên/xuống) |
| `F2` | Đổi tên lớp |
| `Mod+K` | Command palette |
| `Mod+=`, `Mod+-` | Phóng to, thu nhỏ |
| `Shift+0` | Zoom 100% |
| `Shift+1` | Vừa màn hình |
| `1`…`8` | Chuyển sang khung thứ N |
| `Mod+/` | Bảng phím tắt |
| `Alt+P` | Bật/tắt chế độ Xem thử |
| `Alt+D` | Bật/tắt xem chế độ tối trên Canvas (khi `darkMode` khác `none`) |

| Mã | Quy tắc |
|---|---|
| R-KB-01 | Phím tắt không hoạt động khi con trỏ đang ở ô nhập, trừ `Mod+Z`/`Mod+Shift+Z` (để undo trong ô nhập dùng hành vi mặc định của trình duyệt) |
| R-KB-02 | Khai báo tập trung trong `features/shortcuts/` (ADR-FE-14), tên hiển thị qua i18n, ký hiệu phím theo hệ điều hành (⌘ trên macOS) |

---

## 16. M-PG — QUẢN LÝ TRANG

| Mã | Quy tắc |
|---|---|
| R-PG-01 | Chọn trang ở toolbar (danh sách theo `pageOrder`). Hộp "Quản lý trang": tạo, đổi tên, đổi route, sắp xếp (kéo thả), xóa |
| R-PG-02 | Tạo trang: route tự sinh từ tên (bỏ dấu tiếng Việt, chữ thường, khoảng trắng thành `-`). Ví dụ "Quản lý sản phẩm" → `/quan-ly-san-pham`. Người dùng sửa được |
| R-PG-03 | Route trùng hoặc sai mẫu (V-06): báo lỗi ngay trong ô nhập |
| R-PG-04 | Xóa trang cần xác nhận. Trang cuối cùng không xóa được (V-49) |

---

## 17. TIÊU CHÍ KIỂM THỬ

### 17.1. Unit và property test

| Module | Kiểm thử bắt buộc |
|---|---|
| M-DS | Gom file dirty đúng theo operation. `serializeCanonical` ghi hai lần giống từng byte. Xoay vòng 20 bản sao lưu |
| M-SM | Golden test cho mọi dòng bảng 5.3, cả `desktop-first` và `mobile-first`, cả trạng thái |
| M-DD | `canInsert` cho mọi cặp (loại cha, loại con) trong bảng chứa. Tính chỉ số chèn với layout giả lập cho flex-row, flex-column, grid, wrap |
| M-HS | Gộp lịch sử đúng điều kiện 13.3. Undo/Redo 50 bước ngẫu nhiên trả về đúng document ban đầu (property test) |
| M-CB | Dán sinh ID mới, không trùng. Dán khác workspace đổi token đúng giá trị |
| M-PG | Sinh route từ tên tiếng Việt |
| M-CV (Xem thử) | Mỗi loại hành động ở 7.7 thay đổi đúng trạng thái khi chạy. Thoát Xem thử xóa trạng thái |
| Rich text | Chuyển đổi qua lại giữa nội dung trình soạn và `text` + `runs` không mất định dạng, gộp đoạn đúng V-34 |

---

### 17.2. E2E (Playwright)

| Kịch bản | AC |
|---|---|
| Khởi động trong thư mục trống → Welcome → tạo workspace → Editor có trang Home | AC-01 |
| Đóng server, mở lại: thiết kế còn nguyên | AC-01 |
| Kéo Section, Card, Button vào trang. Đổi thứ tự. Thả `Modal` vào trong `Card` bị từ chối | AC-02 |
| Đổi padding Card ở khung chuẩn, đổi lại ở khung Mobile. Khung Desktop/Tablet giữ gốc, Mobile dùng ghi đè. Grid auto-fit: 4 cột ở Desktop, 1 cột ở Mobile | AC-03 |
| Sửa file trang bằng tay khi Studio đang mở → thông báo thay đổi bên ngoài → Tải lại | R-DS-11, R-DS-12 |
| Hai lần chạy CLI cùng workspace: lần hai báo E018 kèm cổng của phiên đang chạy | R-WS (2.2) |
| Preset "Thanh điều hướng responsive": khung Mobile, chế độ Xem thử, bấm ☰ hiện menu, bấm lần nữa ẩn | AC-14 |
| Preset "Form tạo mới có Modal": Xem thử, bấm "Thêm mới" mở Modal, gửi form hợp lệ đóng Modal và hiện toast | AC-14 |
| Bảng có `rowClick → navigate` tới trang chi tiết: Xem thử chuyển trang, thanh địa chỉ giả có `id` | AC-14 |
| Toàn bộ kịch bản trên chạy với giao diện `vi` và `en` | NFR-14 |

---

## 18. TRUY VẾT

| Yêu cầu SRS | Module |
|---|---|
| FR-01 Workspace | M-WS |
| FR-02 Lưu tự động | M-DS |
| FR-05 Canvas, khung | M-CV, ADR-FE-08 |
| FR-06 Library | M-LB |
| FR-07 Kéo thả | M-DD |
| FR-08 Chọn | M-OV, M-LT |
| FR-09 Inspector | M-IN |
| FR-10 Responsive | M-SM, M-IN (11.1) |
| FR-11 Token | M-TK, M-SM (5.6) |
| FR-12 Pages | M-PG |
| FR-14 Undo/Redo | M-HS |
| FR-15 Thao tác cơ bản | M-CB, M-KB |
| FR-16 Sửa chữ trực tiếp, rich text | M-OV (8.4), ADR-FE-20 |
| FR-39 Tương tác | M-IN (11.2), M-LT (R-LT-08, R-LT-09), M-LB |
| FR-40 Xem thử | M-CV (7.7) |
| NFR-01, NFR-02 | R-DD-01, R-IN-07, R-CV-05 |
| NFR-06, NFR-07 | R-DS-01, R-DS-03 |

---

## 19. CÂU HỎI MỞ

| # | Câu hỏi | Giả định hiện tại |
|---|---|---|
| Q-12 | Ảnh nền, video nền? | **Đã giải quyết:** ảnh nền và gradient có (SPEC-03 mục 4.5). Video nền không hỗ trợ (quyết định) |
| Q-13 | Thiết kế có chế độ tối? | **Đã giải quyết:** có, qua token màu có giá trị `dark` và cài đặt `darkMode` (SPEC-03 mục 3.4a). Canvas có nút xem sáng/tối |

---

# SPEC-04.2 — XUẤT CODE

**Thuộc:** SPEC-04 — Đặc tả module  
**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0 (FR-03, FR-31 đến FR-38, NFR-05, NFR-09 đến NFR-13, AC-08 đến AC-12), SPEC-01.1 (ADR-BE-16 đến ADR-BE-19), SPEC-03 (mục 10.4, 10.8), SPEC-04.1 (mục 5)  
**Phạm vi:** Các module của **Phase 2 — Export**

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

### 1.1. Danh sách module

| Mã | Tên | Nơi chạy | Mục |
|---|---|---|---|
| M-TP | Target Project Analyzer | Server | 2 |
| M-PT | Template project mới | Server | 3 |
| M-CG | Code Generator (lowering, IR, emitter, format) | Server | 4 đến 8 |
| M-HT | Xuất HTML/CSS | Server | 9 |
| M-EX | Export Manager (kế hoạch, diff, transaction, manifest) | Server | 10 |
| M-VL | Kiểm tra code xuất ra | Server (worker, child process) | 11 |
| M-XU | Màn hình Export | Studio | 12 |

---

### 1.2. Ngoài phạm vi

| Nội dung | Tài liệu |
|---|---|
| Sinh lớp dữ liệu (kiểu entity, API client, hook) từ Binding | SPEC-04.4 |
| Bảng ánh xạ thuộc tính sang class Tailwind (v4) | SPEC-04.1 mục 5 |

---

### 1.3. Nguyên tắc chung

| Mã | Quy tắc |
|---|---|
| R-CG-01 | Sinh code **xác định**: cùng Design Document, cùng Target Project cho ra cùng nội dung từng byte (ADR-BE-16) |
| R-CG-02 | Code xuất ra **KHÔNG** import gì từ `reactcraft` và không cần ReactCraft để chạy (NFR-12) |
| R-CG-03 | Code xuất ra đọc được như developer tự viết: tên có nghĩa, không lồng `div` thừa, không thuộc tính `data-rc-*` |
| R-CG-04 | **KHÔNG** thêm dependency vào Target Project nếu người dùng chưa đồng ý (FR-34, SEC-08) |
| R-CG-05 | **KHÔNG** sửa file của người dùng mà ReactCraft chưa từng tạo, trừ các "chỉnh sửa hỗ trợ" liệt kê ở mục 8.4 và luôn qua diff để duyệt |

---

## 2. M-TP — TARGET PROJECT ANALYZER

### 2.1. Đầu vào và đầu ra

- **Đầu vào:** đường dẫn thư mục project.
- **Đầu ra:** `TargetProjectInfo` (SPEC-03 mục 10.4).
- Chạy khi liên kết project, khi `package.json`, `tsconfig*.json`, `vite.config.*`, file CSS chính thay đổi (qua watcher), và trước mỗi lần lập kế hoạch xuất.

---

### 2.2. Phát hiện phiên bản và công cụ

| Bước | Nguồn | Kết quả |
|---|---|---|
| 1 | `package.json` (`dependencies` + `devDependencies`) | Phiên bản khai báo của `react`, `vite`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `react-router`, `react-router-dom`, `@tanstack/react-router`, `lucide-react`, `prettier` |
| 2 | `node_modules/<pkg>/package.json` nếu có | Phiên bản **đã cài** thực tế (ưu tiên hơn bước 1) |
| 3 | Lockfile: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`/`bun.lockb` | `packageManager` |
| 4 | Tailwind v4: `@tailwindcss/vite` có trong dependency **hoặc** file CSS có `@import "tailwindcss"` | `tailwind.major = 4` |
| 5 | Tailwind v3: có `tailwind.config.{js,cjs,mjs,ts}` và `tailwindcss` 3.x | `tailwind.major = 3` |
| 6 | File CSS chính: file CSS được import trong `src/main.tsx` (parse bằng oxc), ưu tiên file chứa chỉ thị Tailwind | Đường dẫn CSS chính (dùng ở mục 8.4) |

---

### 2.3. Điều kiện hỗ trợ

| Điều kiện | Mã lý do khi không đạt |
|---|---|
| Có `react` 18.x hoặc 19.x | `noReact`, `reactVersion` |
| Có `vite` 7.x hoặc 8.x | `noVite`, `viteVersion` |
| Có `tsconfig.json` (TypeScript) **hoặc** không có (JavaScript, đọc `jsconfig.json` nếu có) | Không còn lý do loại. Kết quả ghi vào `language: 'ts' \| 'js'` |
| Tailwind 3.4+ hoặc 4.x | `noTailwind`, `tailwindVersion` |
| Có `src/main.tsx` hoặc `src/main.ts` | `noEntry` |

Không đạt điều kiện nào: `status = 'unsupported'`, `reasons` liệt kê đủ. Studio hiển thị từng lý do và gợi ý xử lý (ví dụ "Cài Tailwind theo hướng dẫn chính thức" kèm liên kết).

---

### 2.4. Phát hiện quy ước

| Trường (`ProjectConventions`) | Thuật toán |
|---|---|
| `srcDir` | `src` nếu tồn tại, ngược lại `.` |
| `pagesDir` | Thư mục đầu tiên tồn tại trong: `src/pages`, `src/routes`, `src/views`, `src/screens`. Không có: `src/pages` (sẽ tạo) |
| `componentsDir` | `src/components` nếu tồn tại, ngược lại `src/components` (sẽ tạo) |
| `featuresDir` | `src/features` nếu tồn tại |
| `fileNaming` | Xét mọi file `.tsx` trong `src/` (bỏ `main.tsx`, `App.tsx`, `vite-env.d.ts`). Đếm theo kiểu: `PascalCase` (`ProductCard.tsx`), `kebab-case` (`product-card.tsx`), `camelCase` (`productCard.tsx`). Lấy kiểu chiếm ≥ 60%. Không đủ dữ liệu hoặc không kiểu nào ≥ 60%: `PascalCase` |
| `pathAlias` | `compilerOptions.paths` trong `tsconfig.json`, `tsconfig.app.json` hoặc `jsconfig.json` có dạng `"<alias>/*": ["./src/*"]` (hoặc `["src/*"]`) |
| `hasPrettier` | Có `.prettierrc*`, `prettier.config.*`, hoặc khóa `prettier` trong `package.json` |
| `hasEslint` | Có `eslint.config.*` hoặc `.eslintrc*` |
| `router` | `react-router` hoặc `react-router-dom` → `react-router`. `@tanstack/react-router` → `tanstack-router`. Không có → `none` |

| Mã | Quy tắc |
|---|---|
| R-TP-01 | Phân tích **chỉ đọc**. Không chạy script, không import file cấu hình bằng `import()` (tránh thực thi code của project). Đọc file cấu hình dạng văn bản và parse bằng oxc |
| R-TP-02 | Không phân tích được một trường thì dùng giá trị mặc định ở bảng trên và ghi cảnh báo vào kết quả, không báo lỗi toàn bộ |
| R-TP-03 | Thời gian phân tích ≤ 2 s với project 300 file |
| R-TP-04 | **Monorepo:** project đích có thể là một thư mục con của monorepo. Tìm `node_modules/<pkg>` và lockfile bằng cách đi ngược lên các thư mục cha tới khi gặp `pnpm-workspace.yaml`, trường `workspaces` trong `package.json`, hoặc gốc ổ đĩa. Thư mục chứa các file đó ghi vào `workspaceRoot`. Lệnh cài đặt và build (mục 11.3) chạy với cờ lọc của package manager (ví dụ `pnpm --filter <tên>`) |

---

## 3. M-PT — TEMPLATE PROJECT MỚI

`POST /target-project/create` tạo project từ `templates/react-vite-tailwind/` (đóng gói trong ReactCraft, ADR-BE-05).

### 3.1. Nội dung template

```text
<project>/
├── index.html
├── package.json            # react 19, react-dom, react-router 7, vite 8,
│                           # @vitejs/plugin-react, tailwindcss 4, @tailwindcss/vite, typescript
├── tsconfig.json           # paths: "@/*" → "./src/*"
├── vite.config.ts          # react(), tailwindcss(), alias @
├── .prettierrc.json
└── src/
    ├── main.tsx            # createBrowserRouter(reactcraftRoutes) + RouterProvider
    ├── index.css           # @import "tailwindcss"; @import "./reactcraft/theme.css";
    ├── components/
    ├── pages/
    └── reactcraft/
        ├── routes.tsx      # sinh bởi ReactCraft (ban đầu: một route trống)
        └── theme.css       # sinh bởi ReactCraft
```

| Mã | Quy tắc |
|---|---|
| R-PT-01 | Thư mục đích phải rỗng hoặc chưa tồn tại. Ngược lại E016 với `params.reason = 'notEmpty'` |
| R-PT-02 | Tạo xong **chưa** cài dependency. Studio đề xuất bước cài (`POST /target-project/install`), hiển thị lệnh sẽ chạy và cần người dùng bấm xác nhận (SEC-08) |
| R-PT-03 | Phiên bản trong `package.json` của template được ghim theo phiên bản đã qua VG-03 |

---

## 4. M-CG — PIPELINE SINH CODE

```text
Design Document (revision R) + TargetProjectInfo + ExportRequest
   │
   ▼ (1) Lập danh sách đơn vị xuất: trang, User Component, theme, routes, assets, icon
   │
   ▼ (2) Lowering: mỗi đơn vị → Code IR (mục 5)
   │
   ▼ (3) Emit: Code IR → chuỗi mã nguồn (mục 6)
   │
   ▼ (4) Format: Prettier theo cấu hình project (mục 7)
   │
   ▼ (5) Kiểm tra T1, T2 (mục 11)
   │
   ▼ ExportPlan (SPEC-03 mục 10.8)
```

| Mã | Quy tắc |
|---|---|
| R-CG-06 | Bước 1 đến 5 chạy trên bản chụp (snapshot) của document ở `revision` R. Thay đổi thiết kế trong lúc lập kế hoạch không ảnh hưởng kết quả |
| R-CG-07 | Lỗi ở một đơn vị không dừng các đơn vị khác. Lỗi được ghi vào `diagnostics`, kế hoạch đặt `blocking = true` |

---

## 5. CODE IR

```ts
// packages/server/src/core/codegen/ir.ts — phác thảo
type CodeFileIR = {
  readonly path: string;                       // tương đối trong Target Project, dấu '/'
  readonly kind: 'page' | 'component' | 'routes' | 'theme' | 'icon' | 'asset' | 'data';
  readonly sourceId?: string;                  // PageId, ComponentId
  readonly header: string;                     // comment đầu file (mục 6.4)
  readonly imports: readonly ImportIR[];
  readonly declarations: readonly DeclarationIR[];
};

type ImportIR = {
  readonly from: string;                       // ví dụ 'react', '@/components/product-card'
  readonly default?: string;
  readonly named?: readonly string[];
  readonly typeOnly?: boolean;
};

type DeclarationIR =
  | { readonly kind: 'component'; readonly component: ComponentIR }
  | { readonly kind: 'type'; readonly name: string; readonly body: string }
  | { readonly kind: 'const'; readonly name: string; readonly exported: boolean; readonly value: string };

type ComponentIR = {
  readonly name: string;                       // PascalCase
  readonly exported: boolean;
  readonly props: readonly { name: string; type: string; optional: boolean }[];
  readonly state: readonly { name: string; setter: string; initial: string; type: string }[];
  readonly handlers: readonly { name: string; body: string }[];
  readonly root: JsxIR;
};

type JsxIR =
  | { readonly kind: 'element'; readonly tag: string; readonly attrs: readonly JsxAttrIR[];
      readonly className: readonly string[]; readonly children: readonly JsxIR[] }
  | { readonly kind: 'text'; readonly value: string }            // được escape khi emit
  | { readonly kind: 'expression'; readonly code: string }       // ví dụ {product.name}
  | { readonly kind: 'fragment'; readonly children: readonly JsxIR[] };

type JsxAttrIR = { readonly name: string; readonly value: string | { readonly expression: string } };
```

| Mã | Quy tắc |
|---|---|
| R-CG-08 | `className` trong IR là danh sách class lấy từ `toTailwindClasses` (SPEC-04.1 mục 5) với `ctx.tailwind` = phiên bản của Target Project. Emitter nối bằng dấu cách |
| R-CG-09 | IR không chứa chuỗi mã nguồn tùy ý ngoài `expression`, `handlers.body`, `const.value`, `type.body`. Các chuỗi này chỉ do code của ReactCraft tạo, không bao giờ lấy trực tiếp từ nội dung người dùng nhập |

---

## 6. LOWERING VÀ EMIT CHO REACT

### 6.1. Vị trí file và đặt tên

| Đơn vị | Đường dẫn | Tên component |
|---|---|---|
| Trang | `<pagesDir>/<tên file>` (`.tsx`, hoặc `.jsx` khi `language = 'js'`) | `<Tên>Page` |
| User Component | `<componentsDir>/<tên file>` | `UserComponent.name` |
| Routes | `src/reactcraft/routes.tsx` | — |
| Theme (Tailwind v4) | `src/reactcraft/theme.css` | — |
| Theme (Tailwind v3) | `src/reactcraft/tailwind-preset.cjs` | — |
| Icon | `<componentsDir>/icons/<tên file>` | `<TênIcon>Icon` |
| Ảnh | `src/assets/reactcraft/<tên file gốc>` | — |

**Đặt tên trang:**

| Bước | Ví dụ |
|---|---|
| 1. Lấy `Page.name`, bỏ dấu tiếng Việt (đ → d), bỏ ký tự không phải chữ/số | "Quản lý sản phẩm" → "Quan ly san pham" |
| 2. Chuyển sang PascalCase | `QuanLySanPham` |
| 3. Bắt đầu bằng số thì thêm tiền tố `Page` | "404" → `Page404` |
| 4. Thêm hậu tố `Page` | `QuanLySanPhamPage` |
| 5. Trùng tên: thêm số `2`, `3`… theo thứ tự `pageOrder` | `HomePage2` |

**Tên file** theo `fileNaming` của project:

| `fileNaming` | Trang | Component |
|---|---|---|
| `PascalCase` | `QuanLySanPhamPage.tsx` | `ProductCard.tsx` |
| `kebab-case` | `quan-ly-san-pham-page.tsx` | `product-card.tsx` |
| `camelCase` | `quanLySanPhamPage.tsx` | `productCard.tsx` |

| Mã | Quy tắc |
|---|---|
| R-CG-10 | Import giữa các file sinh ra dùng `pathAlias` nếu có (`@/components/product-card`), ngược lại dùng đường dẫn tương đối |
| R-CG-11 | Tên file sinh ra không trùng file đã có trong project mà ReactCraft không tạo. Trùng: kế hoạch đánh dấu `conflict` (mục 10.2) |

---

### 6.2. Node sang JSX

Giống Canvas (SPEC-04.1 mục 7.2), **trừ** các phần chỉ có trên Canvas.

| Node | JSX | Ghi chú khi xuất |
|---|---|---|
| `Stack`, `Card`, `Grid` | `<div>` | |
| `Section` | `<section>` hoặc `content.as` | |
| `Container` | `<div>` | `mx-auto w-full max-w-[…]` như Canvas |
| `Navbar`, `Sidebar`, `Footer` | `<nav>`, `<aside>`, `<footer>` | |
| `Text` | `<p>` hoặc `<span>` | Xuống dòng trong chữ → `<br />`. `runs` → `<strong>`, `<em>`, `<u>`, `<s>`, `<code>`, `<a>`/`<Link>`, màu chữ → `<span className="text-…">`, lồng theo thứ tự cố định: link › strong › em › u › s › code › span màu |
| `Heading` | `<h1>`…`<h6>` | |
| `Image` | `<img>` | `asset:` → `import <tên>Img from '@/assets/reactcraft/<file>'`. Luôn có `alt` |
| `Icon` | `<TênIcon>Icon />` | Xem 6.5 |
| `Link` | `<Link to>` nếu `router = 'react-router'` và `href` bắt đầu bằng `/`. Ngược lại `<a href>` | `newTab` → `target="_blank" rel="noreferrer"` |
| `Divider` | `<hr>` | |
| `Button` | `<button type="…">` | |
| `Form` | `<form onSubmit={handle<Tên>Submit}>` | Handler mặc định gọi `event.preventDefault()`. Lớp dữ liệu ở SPEC-04.4 |
| `Input`, `Textarea`, `Select` | `<label>` bọc nhãn + điều khiển, có `htmlFor`/`id` | `name` = `fieldName`, `required` nếu có. `validation` → thuộc tính HTML gốc: `minLength`, `maxLength`, `min`, `max`, `type="email"`/`"url"`/`"tel"`, `pattern` (chữ số: `[0-9]*`), thông báo lỗi qua `title` và `setCustomValidity` trong handler `onInvalid`. Không dùng thư viện form |
| `Checkbox`, `Radio` | `<label><input type="…" /> …</label>` | |
| `Switch` | `<button role="switch" aria-checked={…}>` + state | State `useState` trong component chứa |
| `Table` | `<div className="overflow-x-auto">` bọc `<table>` + `<thead>` + `<tbody>` | Bọc cuộn ngang để bảng không vỡ trên điện thoại. Chưa gắn dữ liệu: `<tbody>` có một dòng `emptyText`. `rowActions` → cột cuối chứa các `<button>`. `rowClick` → `onClick` trên `<tr>` + `tabIndex={0}` + `onKeyDown` (Enter) + `cursor-pointer` |
| `List` | `<ul>` + `<li>` mẫu | Chưa gắn dữ liệu: một `<li>` từ node mẫu |
| `DetailView` | `<dl>` hoặc `<div>` | |
| `Modal` | `<dialog>` | Mở/đóng theo state `is<Tên>Open` (mục 6.7), mặc định `openByDefault`. Dùng `showModal()`/`close()` qua `ref` để có lớp phủ và khóa focus chuẩn của trình duyệt |
| `Tabs` | `<div role="tablist">` + các `<button role="tab">` + panel | State `active<Tên>Tab` |
| `ComponentInstance` | `<TênComponent prop="…" slot={…} />` | Xem 6.3 |

| Mã | Quy tắc |
|---|---|
| R-CG-12 | Chữ do người dùng nhập luôn được escape theo ngữ cảnh JSX (`{`, `}`, `<`, `>`, `&`). Chữ có ký tự đặc biệt sinh dạng `{"…"}` |
| R-CG-13 | Node `hidden: true` vẫn được xuất (SRS FR-05 định nghĩa `hidden` chỉ ẩn trên Canvas) |
| R-CG-14 | `Container` rỗng không sinh khung "Kéo phần tử vào đây" (SPEC-04.1 R-CV-01) |
| R-CG-15 | Không sinh `div` bọc thừa: mỗi node sinh đúng một phần tử gốc (trừ form control có `label` bọc và `Table` có khung cuộn ngang) |
| R-CG-16 | State và handler (Modal, Tabs, Switch, Form) đặt trong component **trang** hoặc component chứa gần nhất, là UI logic thuần (FR-33) |

---

### 6.3. User Component và slot

```tsx
// src/components/product-card.tsx (ví dụ xuất ra)
// Generated by ReactCraft from component "ProductCard" (c_9kLm2xQw7e).
// Manual edits will be detected on the next export.
import type { ReactNode } from 'react';

type ProductCardProps = {
  title: string;
  imageSrc: string;
  actions?: ReactNode;
};

export function ProductCard({ title, imageSrc, actions }: ProductCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-sm hover:shadow-md">
      <img className="aspect-video w-full rounded-md" src={imageSrc} alt={title} />
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="flex flex-row gap-2">{actions}</div>
    </div>
  );
}
```

```tsx
// Nơi dùng trong trang bán hàng
<ProductCard
  title="Áo thun basic"
  imageSrc={aoThunImg}
  actions={<button type="button" className="…">Thêm vào giỏ</button>}
/>
```

| Mã | Quy tắc |
|---|---|
| R-CG-17 | `ComponentPropDef` → prop kiểu `string`. `Slot` → prop kiểu `ReactNode`, không bắt buộc. Node có `propRef` dùng biến prop thay cho giá trị cố định: `text` → nội dung của phần tử, `src`, `href`, `alt` → thuộc tính cùng tên |
| R-CG-18 | Slot tên `children` → dùng `children` của React (nội dung đặt giữa thẻ mở và thẻ đóng) |
| R-CG-19 | Component dùng chung **KHÔNG** chứa state nghiệp vụ, không gọi API (FR-33). Chỉ có UI logic khai báo trong chính nó (ví dụ Tabs) |
| R-CG-20 | User Component không được dùng ở trang nào vẫn được xuất (để developer dùng sau) |

---

### 6.4. Comment đầu file

Mọi file mã nguồn sinh ra bắt đầu bằng:

```text
// Generated by ReactCraft from <page|component> "<tên>" (<id>).
// Manual edits will be detected on the next export.
```

File CSS dùng `/* … */`. Comment bằng tiếng Anh (QC-09), giống nhau với mọi ngôn ngữ giao diện để kết quả xác định.

---

### 6.5. Icon

| Điều kiện | Cách xuất |
|---|---|
| Project đã có `lucide-react` | `import { Star } from 'lucide-react'` → `<Star size={24} />` |
| Chưa có | Sinh component SVG nội tuyến trong `<componentsDir>/icons/`, nội dung lấy từ bộ icon Lucide đóng gói (giấy phép ISC, giữ comment ghi nguồn) |

Không tự thêm `lucide-react` vào project (R-CG-04).

---

### 6.6. Routes

`src/reactcraft/routes.tsx` với `router = 'react-router'`:

```tsx
// Generated by ReactCraft. Manual edits will be detected on the next export.
import type { RouteObject } from 'react-router';
import { HomePage } from '@/pages/home-page';
import { ProductsPage } from '@/pages/products-page';

export const reactcraftRoutes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/products', element: <ProductsPage /> },
];
```

| `router` | Hành vi |
|---|---|
| `react-router` | Sinh `routes.tsx` như trên. Lần xuất đầu: thêm **bước thủ công** (mục 10.4) hướng dẫn nối `reactcraftRoutes` vào router của project, kèm đoạn code để sao chép |
| `none` | Kế hoạch đề xuất thêm `react-router` vào `newDependencies`. Người dùng đồng ý: sinh `routes.tsx` + `src/reactcraft/router.tsx` (`createBrowserRouter`, `RouterProvider`) và bước thủ công hướng dẫn render trong `main.tsx`. Không đồng ý: chỉ xuất các trang |
| `tanstack-router` | Chỉ xuất các trang, kèm bước thủ công hướng dẫn tự khai báo route (Q-15) |
| Project tạo từ template (mục 3) | `main.tsx` đã nối sẵn, không có bước thủ công |

---

### 6.7. Tương tác

Mỗi trang gom toàn bộ tương tác của các node thuộc trang (SPEC-03 mục 6a) và sinh **state + handler** trong component trang (UI logic, FR-33).

| Thành phần | Sinh ra |
|---|---|
| Modal được mở/đóng | `const [is<Tên>Open, setIs<Tên>Open] = useState(<openByDefault>)` |
| Node được `show`/`hide`/`toggle` | `const [is<Tên>Visible, setIs<Tên>Visible] = useState(<!initiallyHidden>)`. Node nhận thêm class ẩn khi chạy (SPEC-04.1 mục 5.3) khi giá trị là `false` |
| Tabs được `switchTab` | `const [active<Tên>Tab, setActive<Tên>Tab] = useState('<tab đầu>')` |
| Node đích của `scrollTo` | Thuộc tính `id` = slug của tên node (trùng: thêm số) |
| `showToast` | Một lần cho cả project: `src/reactcraft/toast.tsx` gồm `ToastProvider` + `useToast()` (React thuần, không phụ thuộc thư viện). Trang dùng `useToast()` |
| Handler | `function handle<TênNode><Sự kiện>(…)` chạy lần lượt các hành động |

Hành động sang code:

| Hành động | `router = 'react-router'` | Không có router |
|---|---|---|
| `navigate` | `navigate('/products/' + record.id)` với `const navigate = useNavigate()` | `window.location.assign(…)` |
| `openUrl` | `window.open(url, '_blank', 'noopener')` hoặc `window.location.assign(url)` | Giống |
| `openModal`, `closeModal` | `setIs<Tên>Open(true / false)` | Giống |
| `show`, `hide`, `toggle` | `setIs<Tên>Visible(true / false / (v) => !v)` | Giống |
| `scrollTo` | `document.getElementById('<id>')?.scrollIntoView({ behavior: 'smooth' })` | Giống |
| `switchTab` | `setActive<Tên>Tab('<tabId>')` | Giống |
| `showToast` | `toast.show({ message, tone })` | Giống |
| `refreshData`, `deleteRecord`, `submitSuccess/Error` | Sinh qua lớp dữ liệu (SPEC-04.4) | Giống |

Ví dụ trang có nút mở Modal và menu điện thoại:

```tsx
export function ProductsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMobileMenuVisible, setIsMobileMenuVisible] = useState(false);

  function handleMenuButtonClick() {
    setIsMobileMenuVisible((v) => !v);
  }

  function handleAddButtonClick() {
    setIsCreateModalOpen(true);
  }

  return (
    <div className="flex flex-col">
      <nav className="sticky top-0 z-10 flex flex-row items-center justify-between px-6 py-4">
        {/* … */}
        <button type="button" className="hidden max-md:flex" onClick={handleMenuButtonClick}>…</button>
      </nav>
      <div className={cn('flex flex-col gap-2 hidden max-md:flex', !isMobileMenuVisible && 'hidden!')}>…</div>
      {/* … */}
    </div>
  );
}
```

| Mã | Quy tắc |
|---|---|
| R-CG-29 | Tên state, handler, `id` lấy từ **tên lớp** của node (`DesignNode.name`), chuyển sang PascalCase không dấu. Node chưa có tên: dùng loại node + số thứ tự (`Modal1`, `Stack3`). Trùng: thêm số |
| R-CG-30 | Ghép class có điều kiện bằng một hàm `cn` nhỏ sinh trong `src/reactcraft/cn.ts` (nối chuỗi, bỏ giá trị rỗng). Không thêm `clsx` vào project |
| R-CG-31 | Không sinh state cho node không bị tương tác nào điều khiển |

---

### 6.8. Metadata của trang

| Phiên bản React của project | `title`, `description` |
|---|---|
| 19.x | Render `<title>` và `<meta name="description">` ngay trong component trang (React 19 tự đưa lên `<head>`) |
| 18.x | `useEffect` đặt `document.title` và cập nhật thẻ `meta[name="description"]` |

---

### 6.9. Project JavaScript

Khi `language = 'js'`:

| Mã | Quy tắc |
|---|---|
| R-CG-32 | Đuôi file `.jsx`/`.js`. Bỏ mọi khai báo kiểu, `import type`, tham số kiểu |
| R-CG-33 | Props của User Component có chú thích JSDoc `@param` để trình soạn thảo gợi ý được |
| R-CG-34 | Kiểm tra T2 (kiểu) không áp dụng. T1 và T3 vẫn chạy |

---

## 7. FORMAT

| Mã | Quy tắc |
|---|---|
| R-CG-21 | Format mọi file `.tsx`, `.ts`, `.css`, `.html` bằng Prettier (ADR-BE-16) |
| R-CG-22 | `hasPrettier = true`: dùng `prettier.resolveConfig()` theo đường dẫn file đích, nạp plugin từ `node_modules` của project. Plugin không nạp được: bỏ plugin đó, ghi cảnh báo |
| R-CG-23 | `hasPrettier = false`: cấu hình mặc định `{ singleQuote: true, semi: true, trailingComma: 'all', printWidth: 100 }` |
| R-CG-24 | Kiểu xuống dòng: file đã có giữ nguyên kiểu của file đó. File mới theo `endOfLine` của Prettier (mặc định `lf`) |

---

## 8. THEME VÀ CHỈNH SỬA HỖ TRỢ

### 8.1. Tailwind v4

`src/reactcraft/theme.css`:

```css
/* Generated by ReactCraft. Manual edits will be detected on the next export. */
@theme {
  --color-primary: #2563eb;
  --color-surface: #f8fafc;
  --spacing-4: 16px;
  --radius-lg: 8px;
  --text-base: 16px;
  --text-base--line-height: 1.5;
  /* … mọi token theo SPEC-04.1 mục 5.6 … */
}

/* darkMode = 'media' */
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #0f172a;
    --color-foreground: #f8fafc;
  }
}

/* darkMode = 'class' (thay cho khối @media ở trên) */
@custom-variant dark (&:where(.dark, .dark *));
.dark {
  --color-surface: #0f172a;
  --color-foreground: #f8fafc;
}
```

---

### 8.2. Tailwind v3

Màu đi qua **biến CSS** để hỗ trợ chế độ tối giống v4. Sinh hai file:

`src/reactcraft/theme.css`:

```css
/* Generated by ReactCraft. Manual edits will be detected on the next export. */
:root {
  --color-primary: #2563eb;
  --color-surface: #f8fafc;
}
/* darkMode = 'media': @media (prefers-color-scheme: dark) { :root { … } } */
/* darkMode = 'class': .dark { … } */
```

`src/reactcraft/tailwind-preset.cjs`:

```js
// Generated by ReactCraft. Manual edits will be detected on the next export.
module.exports = {
  darkMode: 'class',            // chỉ khi darkMode = 'class'
  theme: {
    extend: {
      colors: { primary: 'var(--color-primary)', surface: 'var(--color-surface)' },
      spacing: { 4: '16px' },
      borderRadius: { lg: '8px' },
      fontSize: { base: ['16px', { lineHeight: '1.5' }] },
      boxShadow: { sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
      fontWeight: { semibold: '600' },
      lineHeight: { normal: '1.5' },
      fontFamily: { sans: ['ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
};
```

---

### 8.3. Khác biệt v3 so với bảng ánh xạ v4

| Nội dung | v4 (SPEC-04.1 mục 5) | v3 |
|---|---|---|
| Khai báo token | `@theme` trong CSS | Preset JS ở 8.2 |
| Class tiện ích, giá trị tùy ý `[…]` | Như bảng | Giống hệt |
| Biến thể `max-*` | Có sẵn | Cần v3.2+ (yêu cầu tối thiểu v3.4, ADR-BE-05) |
| `focus-visible:`, `disabled:` | Có sẵn | Có sẵn |
| Content scanning | Tự động | Đường dẫn file sinh ra phải nằm trong `content` của `tailwind.config`. Mặc định `./src/**/*.{ts,tsx}` đã bao phủ. Không bao phủ: thêm bước thủ công |

| Mã | Quy tắc |
|---|---|
| R-CG-25 | `toTailwindClasses` với `tailwind = 'v3'` **BẮT BUỘC** có golden test riêng cho mọi dòng của bảng ánh xạ |

---

### 8.4. Chỉnh sửa hỗ trợ vào file của người dùng

Chỉ các chỉnh sửa sau được phép trên file ReactCraft không tạo ra (R-CG-05). Mỗi chỉnh sửa là một mục trong kế hoạch, có diff, người dùng duyệt được:

| Chỉnh sửa | File | Nội dung |
|---|---|---|
| Nối theme (v4) | File CSS chính (mục 2.2 bước 6) | Thêm một dòng `@import "./reactcraft/theme.css";` ngay sau `@import "tailwindcss";` |
| Nối preset (v3) | `tailwind.config.*` | Thêm `require('./src/reactcraft/tailwind-preset.cjs')` vào mảng `presets` |
| Nối theme (v3) | File CSS chính | Thêm `@import "./reactcraft/theme.css";` trước các chỉ thị `@tailwind` |
| Bọc `ToastProvider` | `src/main.tsx` | Chỉ khi có `showToast` và project không tạo từ template: **bước thủ công** kèm đoạn code (không tự sửa `main.tsx`) |

| Mã | Quy tắc |
|---|---|
| R-CG-26 | Chỉnh sửa hỗ trợ là **chèn**, không xóa hay đổi nội dung có sẵn. Vị trí chèn tính bằng parse (oxc cho JS/TS, phân tích dòng cho CSS) |
| R-CG-27 | Không xác định được vị trí an toàn (cấu hình phức tạp, export động): không sửa, chuyển thành **bước thủ công** có đoạn code để sao chép |
| R-CG-28 | Đã có dòng tương đương: không chèn lại |

---

## 9. M-HT — XUẤT HTML/CSS

### 9.1. Cấu trúc đầu ra

```text
<htmlOutDir>/
├── index.html              # trang có route '/'
├── products.html           # route '/products'
├── products-detail.html    # route '/products/:id' (tham số bị bỏ)
├── styles.css
├── reactcraft-ui.js        # chỉ khi có Tabs, Modal hoặc Switch
└── assets/
```

---

### 9.2. Quy tắc

| Mã | Quy tắc |
|---|---|
| R-HT-01 | Tên file từ route: bỏ `/` đầu, thay `/` bằng `-`, bỏ tham số `:x`. Route `/` → `index.html`. Trùng: thêm số |
| R-HT-02 | HTML dùng cùng class Tailwind (bảng v4). `styles.css` được **biên dịch** bằng package `tailwindcss` v4 trên server: chỉ chứa class thực sự dùng + biến theme. Không cần Tailwind khi mở file |
| R-HT-03 | Liên kết nội bộ (`href` bắt đầu bằng `/`) đổi thành đường dẫn tương đối tới file HTML tương ứng |
| R-HT-04 | Tabs, Modal, Switch và các tương tác `openModal`, `closeModal`, `show`, `hide`, `toggle`, `scrollTo`, `switchTab`, `showToast`, `openUrl` hoạt động nhờ `reactcraft-ui.js` (JavaScript thuần, ≤ 5 KB, không phụ thuộc thư viện). Tương tác được khai báo bằng thuộc tính `data-rc-on="click"`, `data-rc-actions='[…]'` (JSON). `navigate` sinh thành liên kết tới file HTML tương ứng. Hành động dữ liệu không áp dụng cho HTML tĩnh (cảnh báo trong kế hoạch) |
| R-HT-05 | Node có binding dữ liệu: xuất ở trạng thái rỗng (bảng có tiêu đề + dòng `emptyText`, danh sách có một phần tử mẫu). Kế hoạch ghi cảnh báo "HTML tĩnh không gắn dữ liệu" |
| R-HT-06 | Mỗi file HTML có `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>` theo `Page.title` hoặc `Page.name`, `<meta name="description">` theo `Page.description`, `<html lang>` theo `contentLocale` của workspace |
| R-HT-08 | `darkMode = 'class'`: `reactcraft-ui.js` có hàm `toggleDarkMode()` và lưu lựa chọn của người xem trong `localStorage` của trang đó |
| R-HT-07 | `htmlOutDir` phải nằm trong Workspace hoặc Target Project (SEC-03). Mặc định `<workspace>/export-html/` |

Bổ sung `tailwindcss` (v4, MIT) vào danh sách phụ thuộc runtime của server (SPEC-01.1 mục 13.1) cho R-HT-02.

---

## 10. M-EX — EXPORT MANAGER

### 10.1. Lập kế hoạch

```text
POST /exports (ExportRequest)
   ↓ kiểm tra: đã liên kết Target Project (E021), project 'supported' (E001),
   │            baseRevision == revision (E017), không có job export khác (E018)
   ↓ job export.plan
   ↓ M-TP phân tích lại project
   ↓ M-CG sinh toàn bộ file (mục 4)
   ↓ Xác định trạng thái từng file (10.2)
   ↓ M-VL kiểm tra T1, T2 (mục 11)
   ↓ ExportPlan, lưu trong bộ nhớ server 30 phút
```

---

### 10.2. Trạng thái file

Với mỗi file sinh ra tại đường dẫn `P`, nội dung `C`, mục manifest `m = manifest[P]`:

| Điều kiện | Trạng thái | Quyết định mặc định |
|---|---|---|
| `P` chưa tồn tại | `create` | `write` |
| `P` tồn tại, `hash(disk) = hash(C)` | `unchanged` | `skip` |
| `P` tồn tại, có `m`, `hash(disk) = m.hash` | `update` | `write` |
| `P` tồn tại, có `m`, `hash(disk) ≠ m.hash` (đã bị sửa tay) | `conflict` | `skip` |
| `P` tồn tại, không có `m` (không do ReactCraft tạo) | `conflict` | `skip` |

File có trong manifest nhưng **không còn được sinh** (trang hoặc component đã bị xóa):

| Điều kiện | Trạng thái | Quyết định mặc định |
|---|---|---|
| File còn, `hash(disk) = m.hash` | `orphaned` | `skip` (giữ lại), cho chọn `delete` |
| File còn, đã bị sửa tay | `orphaned` | `skip`, **không** cho `delete` |
| File không còn | Xóa khỏi manifest khi `apply` | — |

Chỉnh sửa hỗ trợ (mục 8.4) có trạng thái `update` (đã có nội dung, chỉ chèn thêm), quyết định mặc định `write`.

---

### 10.3. Thực hiện (apply)

```text
POST /exports/{planId}/apply (ExportApplyRequest)
   ↓ kiểm tra: kế hoạch còn hạn, revision chưa đổi (E017), blocking = false (E009),
   │            quyết định hợp lệ với trạng thái (V-65, E010),
   │            newDependencies cần đồng ý → acceptNewDependencies = true
   ↓ job export.apply, qua hàng đợi export (ADR-BE-21)
   ↓ Kiểm tra lại hash trên disk của mọi file sẽ ghi (có thể đã đổi từ lúc lập kế hoạch).
   │   Khác với lúc lập kế hoạch → hủy, E010
   ↓ Transaction (ADR-BE-18): snapshot → ghi lần lượt → lỗi thì rollback toàn bộ
   ↓ Thêm dependency mới vào package.json (nếu đồng ý) — chỉ sửa package.json,
   │   KHÔNG chạy cài đặt; Studio đề xuất bước cài như R-PT-02
   ↓ Cập nhật export-manifest.json
   ↓ job.completed { written, skipped, deleted, manualSteps }
```

| Mã | Quy tắc |
|---|---|
| R-EX-01 | Thứ tự ghi: asset → icon → theme → component → trang → routes → chỉnh sửa hỗ trợ → `package.json`. Lỗi giữa chừng rollback toàn bộ (NFR-09) |
| R-EX-02 | `writeAsNew` ghi `<tên>.reactcraft-new.<đuôi>` (V-68). File này **không** vào manifest |
| R-EX-03 | Sau `apply` thành công, Studio đề xuất chạy kiểm tra build (mục 11.3) nếu cài đặt `export.buildCheck` bật |

---

### 10.4. Bước thủ công

Thêm vào `ExportPlan` (cập nhật SPEC-03 mục 10.8):

```ts
type ManualStep = {
  readonly key: string;                        // khóa i18n, ví dụ 'export:manual.connectRoutes'
  readonly params: Readonly<Record<string, string>>;
  readonly snippet?: string;                   // đoạn code để sao chép
  readonly file?: string;                      // file người dùng cần sửa
};
```

Ví dụ: nối `reactcraftRoutes` vào router, render `ReactcraftRouter` trong `main.tsx`, thêm đường dẫn vào `content` của Tailwind v3.

---

### 10.5. Export manifest

```ts
type ExportManifest = {
  readonly schemaVersion: number;
  readonly targetProjectPath: string;          // để phát hiện project đã đổi
  readonly files: Readonly<Record<string, {    // khóa: đường dẫn tương đối, '/'
    readonly hash: string;                     // SHA-256 nội dung đã ghi
    readonly source: { readonly kind: string; readonly id?: string };
    readonly exportedAt: string;
    readonly revision: number;
  }>>;
};
```

| Mã | Quy tắc |
|---|---|
| R-EX-04 | Liên kết sang Target Project khác: manifest cũ được lưu sang `backups/` và bắt đầu manifest mới |
| R-EX-05 | Hash tính trên nội dung đã chuẩn hóa xuống dòng (LF) để file bị Git đổi CRLF/LF không bị coi là sửa tay |

---

## 11. M-VL — KIỂM TRA CODE XUẤT RA

### 11.1. T1 — Cú pháp

- Parse từng file `.ts`/`.tsx` bằng `oxc-parser`, file `.css` bằng kiểm tra cân bằng ngoặc và Tailwind compile (v4) ở chế độ không ghi.
- Lỗi: `diagnostics` có `path`, `line`, `column`, `rule: 'T1'`. Kế hoạch `blocking = true`.

---

### 11.2. T2 — Kiểu TypeScript

| Bước | Xử lý |
|---|---|
| 1 | Trong worker: đọc `tsconfig.json` (và `references` như `tsconfig.app.json`) của Target Project bằng TypeScript API |
| 2 | Tạo `LanguageServiceHost` có **lớp phủ trong bộ nhớ**: file sinh ra thay cho file trên disk, chưa ghi gì |
| 3 | Lấy diagnostics của **file sinh ra** và file import chúng |
| 4 | Lỗi trong file sinh ra: `blocking` theo cài đặt (mặc định chặn, ADR-BE-19) |
| 5 | Lỗi có sẵn trong file khác của project (không liên quan): chỉ đếm và báo "Project có N lỗi TypeScript có sẵn", không chặn |

| Mã | Quy tắc |
|---|---|
| R-VL-01 | T2 bị bỏ qua khi `node_modules` chưa có (`@types/react` không tìm thấy). Kế hoạch ghi cảnh báo "Chưa cài dependency, bỏ qua kiểm tra kiểu" |
| R-VL-02 | Thời gian T2 ≤ 15 s với project 300 file (PB-09). Quá 60 s: hủy T2, cảnh báo, không chặn |
| R-VL-03 | Project JavaScript: bỏ qua T2 (R-CG-34) |

---

### 11.3. T3 — Build thử

| Bước | Xử lý |
|---|---|
| 1 | Chỉ chạy khi người dùng bấm "Kiểm tra build" (ADR-BE-19), job `export.build` |
| 2 | Lệnh theo package manager: `pnpm exec vite build`, `npx vite build`, `yarn vite build`, `bunx vite build`, thư mục chạy là Target Project, thêm `--outDir` trỏ vào thư mục tạm của hệ điều hành để không đè `dist/` |
| 3 | Timeout 120 s, hủy được (E019, E020) |
| 4 | Kết quả: thành công / thất bại, 200 dòng log cuối, lỗi được trích file và dòng nếu nhận dạng được |

---

## 12. M-XU — MÀN HÌNH EXPORT (STUDIO)

```text
┌─ Xuất code ─────────────────────────────────────────────────────────────────┐
│ Định dạng: (•) React  ( ) HTML/CSS      Phạm vi: [Tất cả trang ▾]  [Lập kế hoạch] │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Danh sách file                │ Diff (CodeMirror merge)                      │
│ ● src/pages/home-page.tsx  Mới │                                             │
│ ● src/components/product-card │                                             │
│   .tsx               Cập nhật │                                             │
│ ▲ src/pages/products-page.tsx │                                             │
│   Xung đột [Bỏ qua ▾]         │                                             │
│ ○ src/reactcraft/routes.tsx   │                                             │
│   Không đổi                   │                                             │
├───────────────────────────────┴─────────────────────────────────────────────┤
│ Kiểm tra: ✓ Cú pháp  ✓ Kiểu (2 lỗi có sẵn trong project)                    │
│ Dependency mới: react-router  [ ] Đồng ý thêm                                │
│ Bước thủ công (1): Nối routes vào router  [Xem]                              │
│                                           [Hủy]  [Xuất 3 file]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Mã | Quy tắc |
|---|---|
| R-XU-01 | File `conflict` hiện nổi bật, chọn được: Bỏ qua, Ghi đè, Ghi thành file mới. Ghi đè cần xác nhận thêm |
| R-XU-02 | Nút "Xuất" bị khóa khi `blocking = true`, hiện danh sách lỗi có thể bấm để mở đúng file và dòng trong diff |
| R-XU-03 | Sau khi xuất: hiện tóm tắt (đã ghi, bỏ qua, xóa), bước thủ công kèm nút sao chép, nút "Kiểm tra build" |
| R-XU-04 | Kế hoạch hết hạn hoặc thiết kế đã đổi (E017): thông báo và nút "Lập lại kế hoạch" |

---

## 13. CẬP NHẬT SPEC-03

| Chỗ | Thay đổi |
|---|---|
| `ExportFileStatus` | Thêm `'orphaned'` |
| `ExportApplyRequest.decisions[].action` | Thêm `'delete'` (chỉ cho `orphaned` chưa bị sửa tay) |
| `ExportPlan` | Thêm `manualSteps: readonly ManualStep[]` và `existingProjectErrors: number` |
| V-65 | Bổ sung: `delete` chỉ hợp lệ với file `orphaned` có hash trùng manifest |

---

## 14. TIÊU CHÍ KIỂM THỬ

### 14.1. Unit, golden

| Module | Kiểm thử bắt buộc |
|---|---|
| M-TP | Bộ fixture project: v3/v4, có/không alias, ba kiểu đặt tên file, có/không router, thiếu TypeScript. Kết quả `TargetProjectInfo` đúng |
| M-CG | Golden file: Design Document mẫu của VG-03 → toàn bộ file React, so từng byte, cho mỗi tổ hợp (v3/v4 × desktop-first/mobile-first × kebab/Pascal) |
| M-CG | Đặt tên trang từ tên tiếng Việt, trùng tên, tên bắt đầu bằng số |
| M-CG | Escape chữ có `{`, `}`, `<`, `&`, emoji, tiếng Việt |
| M-HT | Golden file HTML + `styles.css` chỉ chứa class được dùng |
| M-CG (tương tác) | Golden file cho trang có đủ mọi loại hành động ở 6.7, có và không có router |
| M-CG (rich text) | `runs` nhiều định dạng lồng nhau sinh đúng thứ tự thẻ |
| M-CG (JS) | Golden file cho project JavaScript: không còn cú pháp TypeScript, `vite build` thành công |
| M-CG (dark mode) | `theme.css` đúng cho `media` và `class`, cả v3 và v4 |
| M-EX | Bảng trạng thái 10.2 đủ mọi nhánh. Rollback khi lỗi ở file thứ N. Hash bỏ qua khác biệt CRLF/LF |

---

### 14.2. E2E

| Kịch bản | AC |
|---|---|
| Tạo project từ template, cài dependency, xuất workspace mẫu, chạy `vite build` và mở trang | AC-08 |
| So ảnh Canvas và trang xuất ra ở 3 khung (VG-09) | AC-09 |
| Xuất HTML/CSS, mở `index.html` trực tiếp từ ổ đĩa | AC-10 |
| Sửa tay một file đã xuất, xuất lại: trạng thái `conflict`, mặc định bỏ qua | AC-11 |
| `ProductCard` có slot `actions` dùng ở 2 trang với nút khác nhau: component chỉ có layout, nút nằm ở trang | AC-12 |
| Trang có menu điện thoại, Modal tạo mới, bảng `rowClick` sang trang chi tiết: xuất, build, chạy bằng Playwright ở khung 375 và 1440, mọi tương tác hoạt động như chế độ Xem thử | AC-14 |
| Xóa một trang, xuất lại: file trang cũ ở trạng thái `orphaned` | 10.2 |

---

## 15. TRUY VẾT

| Yêu cầu | Mục |
|---|---|
| FR-03 Liên kết Target Project | 2, 3 |
| FR-31 Xuất React | 4 đến 8 |
| FR-32 Xuất HTML/CSS | 9 |
| FR-33 Tách component | 6.3, R-CG-16, R-CG-19 |
| FR-35 Xem trước và diff | 10.1, 12 |
| FR-36 Ghi an toàn | 10.2, 10.3, 10.5 |
| FR-37 Kiểm tra code | 11 |
| FR-38 Quy ước Target Project | 2.4, 6.1, 6.9, 7, R-TP-04 |
| FR-39 Tương tác | 6.7, R-HT-04 |
| NFR-05 Hiệu năng sinh code | R-CG-06, PB-06 đến PB-08 |
| NFR-09 Không ghi dở | R-EX-01 |
| NFR-10 đến NFR-13 Chất lượng code | R-CG-01 đến R-CG-03, 11 |
| SEC-03, SEC-08 | R-HT-07, R-CG-04, R-PT-02 |

---

## 16. CÂU HỎI MỞ

| # | Câu hỏi | Giả định hiện tại |
|---|---|---|
| Q-14 | Mở Modal bằng cách nào? | **Đã giải quyết:** tương tác (SPEC-03 mục 6a, mục 6.7 ở đây) |
| Q-15 | Có tự sinh route cho TanStack Router? | **Quyết định:** không tự sinh, vì TanStack Router dùng cây route riêng của từng project. Kế hoạch xuất có bước thủ công kèm đoạn code `createRoute` cho từng trang |
| Q-16 | Có hỗ trợ project JavaScript (không TypeScript)? | **Đã giải quyết:** có (mục 6.9) |

---

# SPEC-04.3 — AI

**Thuộc:** SPEC-04 — Đặc tả module  
**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0 (FR-22 đến FR-30, FR-39, NFR-08, NFR-16, SEC-04 đến SEC-07, AC-06, AC-07), SPEC-01.1 (ADR-BE-22, ADR-BE-24), SPEC-03 (mục 6a, 7, 10.7), SPEC-04.1  
**Phạm vi:** Các module của **Phase 3 — AI**. Ngữ cảnh backend (mức 3) dùng Data Source Catalog của SPEC-04.4

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

### 1.1. Nguyên tắc

```text
AI chỉ đề xuất Design Operation.
Backend kiểm tra mọi đề xuất bằng đúng engine của thao tác tay.
Người dùng xem trước trên Canvas rồi mới chấp nhận.
AI không có công cụ, không đọc file, không chạy lệnh.
```

---

### 1.2. Danh sách module

| Mã | Tên | Nơi chạy | Mục |
|---|---|---|---|
| M-AG | AI Provider Gateway | Server | 2 |
| M-AC | AI Context Builder | Server | 3 |
| M-AP | Prompt và hợp đồng đầu ra | Server | 4 |
| M-AV | Kiểm tra và sửa đề xuất | Server | 5 |
| M-AR | Kiểm tra responsive (Responsive Audit) | Studio | 6 |
| M-AU | AI Panel và xem trước đề xuất | Studio | 7 |

---

### 1.3. Chế độ yêu cầu

| `mode` | Mục đích | Đầu ra cho phép |
|---|---|---|
| `editSelection` | Sửa các node đang chọn (FR-22) | Operation trong phạm vi vùng chọn (mục 5.3) |
| `generatePage` | Dựng trang mới (FR-23) | `page.create` (1..3 trang) + operation trên trang mới |
| `optimizeResponsive` | Tối ưu cho khung nhỏ hơn (hoặc lớn hơn khi mobile-first) | Chỉ `setStyle` ở khóa responsive khác `base`, và `setRuntime`/`setInteractions` cho menu điện thoại |
| `refine` | Sửa tiếp một đề xuất chưa chấp nhận | Như chế độ của đề xuất gốc |

---

## 2. M-AG — AI PROVIDER GATEWAY

### 2.1. Provider

| Provider | Kết nối | Liệt kê model | Ghi chú |
|---|---|---|---|
| OpenAI | API chính thức qua AI SDK | Endpoint liệt kê model của provider | Cần API key |
| Anthropic | API chính thức qua AI SDK | Endpoint liệt kê model của provider | Cần API key |
| DeepSeek | API chính thức qua AI SDK | Danh sách cấu hình sẵn, người dùng nhập thêm được | Cần API key |
| Ollama | `ollamaBaseUrl` (mặc định `http://127.0.0.1:11434`) | `GET /api/tags` | Chạy trên máy, không cần mạng |

| Mã | Quy tắc |
|---|---|
| R-AG-01 | Studio **không** cài đặt sẵn tên model cụ thể trong code. Danh sách model lấy từ provider lúc chạy. Người dùng chọn và lưu trong Settings (ADR-BE-24) |
| R-AG-02 | Model **NÊN** hỗ trợ structured output. Model không hỗ trợ: dùng chế độ JSON + mô tả schema trong prompt + kiểm tra như mục 5 |
| R-AG-03 | Timeout mặc định 120 s mỗi lần gọi, hủy được qua `POST /jobs/{id}/cancel` (E019, E020) |
| R-AG-04 | Lỗi provider ánh xạ sang E008 với `params.status` (ví dụ `401`, `429`, `5xx`) và `params.retryAfter` khi có. Key sai: E008 `status=401`, Studio gợi ý mở Settings |
| R-AG-05 | Ollama: trước mỗi job kiểm tra `GET /api/version`. Không kết nối được: E008 `status=unreachable`, gợi ý "Khởi động Ollama". Model chưa tải: E021 `missing=model` |
| R-AG-06 | Ghi nhận `usage` (token vào, token ra) từ provider và trả trong đề xuất. **Không** tính tiền (giá thay đổi theo thời gian) |
| R-AG-07 | Lỗi provider **KHÔNG** ảnh hưởng thiết kế và xuất code (NFR-08) |

---

### 2.2. Gửi ảnh chụp Canvas (tùy chọn)

- Tùy chọn **"Gửi ảnh chụp Canvas"** trong AI Panel, **mặc định tắt**.
- Bật và model hỗ trợ ảnh: Studio chụp khung đang xem (hoặc vùng node đang chọn) thành PNG bằng `html-to-image`, tối đa 1.600 px cạnh dài, gửi kèm request.
- Ảnh được liệt kê trong xem trước dữ liệu gửi đi (FR-29).
- Model không hỗ trợ ảnh: tùy chọn bị khóa, có chú thích.

---

## 3. M-AC — AI CONTEXT BUILDER

### 3.1. Mức ngữ cảnh

| Mức | Nội dung | Ngân sách token tối đa (ước tính) |
|---|---|---|
| 0 — Node | Các node đang chọn (cây con đầy đủ), chuỗi tổ tiên dạng tóm tắt (loại, tên, layout), node anh em liền kề dạng tóm tắt | 4.000 |
| 1 — Page | Mức 0 + toàn bộ cây của trang hiện tại + token + cài đặt workspace liên quan (khung, `responsiveMode`, `contentLocale`, `darkMode`) | 16.000 |
| 2 — Workspace | Mức 1 + danh sách trang (tên, route) + toàn bộ User Component (tên, props, slot, cây) | 32.000 |
| 3 — Backend | Mức 2 + Data Source Catalog (entity, field, endpoint) **liên quan** | 48.000 |

Ngân sách tính theo ước lượng 1 token ≈ 4 ký tự JSON. Phần thông tin cố định (system prompt, danh mục loại node, quy tắc) không tính vào ngân sách trên.

---

### 3.2. Chọn mức tự động

```text
mức = 0
nếu mode = 'generatePage'                          → mức = 2
nếu mode = 'optimizeResponsive'                    → mức = max(mức, 1)
nếu yêu cầu nhắc tới trang khác, route, "trang này", "page"   → mức = max(mức, 1)
nếu yêu cầu nhắc tới tên User Component có trong workspace → mức = max(mức, 2)
nếu yêu cầu nhắc tới tên entity, field, endpoint trong catalog
   (so khớp không dấu, không phân biệt hoa thường, số ít/số nhiều)
   hoặc vùng chọn có Binding                       → mức = 3
mức = min(mức, maxContextLevel của request nếu có)
```

| Mã | Quy tắc |
|---|---|
| R-AC-01 | Luôn dùng mức **thấp nhất** đủ dùng (FR-24). Người dùng giới hạn mức tối đa trong AI Panel |
| R-AC-02 | Mức 3 chỉ gửi entity và endpoint **liên quan**: được nhắc tới trong yêu cầu, đang được Binding trong vùng chọn hoặc trang, hoặc có quan hệ trực tiếp (`relation`) với chúng. Tối đa 10 entity |
| R-AC-03 | Vượt ngân sách: bỏ dần theo thứ tự (1) node anh em tóm tắt, (2) cây User Component không được dùng trong trang, (3) trang khác, (4) field ít liên quan. Vẫn vượt: trả E016 `params.reason = 'contextTooLarge'`, gợi ý chọn vùng nhỏ hơn |
| R-AC-04 | Ngữ cảnh **KHÔNG BAO GIỜ** chứa: nội dung file trong thư mục backend, nội dung `.env` và secrets, API key, đường dẫn tuyệt đối trên máy, thông tin cấu hình người dùng |

---

### 3.3. Định dạng ngữ cảnh gửi cho AI

Ngữ cảnh là một tài liệu JSON có các khối, mỗi khối được đánh dấu rõ là **dữ liệu**:

```json
{
  "workspace": {
    "contentLocale": "vi-VN",
    "responsiveMode": "desktop-first",
    "frames": [{ "id": "desktop", "width": 1440, "primary": true }, { "id": "mobile", "width": 375 }],
    "darkMode": "none"
  },
  "tokens": { "color": { "primary": "#2563eb" }, "spacing": { "4": 16 } },
  "selection": ["n_Card000001"],
  "ancestors": [{ "id": "n_Grid000001", "type": "Grid", "layout": "grid-3" }],
  "tree": { "id": "n_Card000001", "type": "Card", "style": { "...": "..." }, "children": [] },
  "pages": [{ "id": "p_4f90d13a2b", "name": "Sản phẩm", "route": "/products" }],
  "components": [],
  "dataSources": { "entities": [], "endpoints": [] },
  "responsiveIssues": []
}
```

| Mã | Quy tắc |
|---|---|
| R-AC-05 | Cây node dùng **đúng schema `DesignNode`** của SPEC-03 (bỏ `locked`, `hidden`, bỏ thuộc tính có giá trị mặc định). AI đọc và viết cùng một ngôn ngữ, không phải học hai định dạng |
| R-AC-06 | Token gửi dạng rút gọn `{ tên: giá trị }`. Token màu có `dark` gửi dạng `{ "value": "#…", "dark": "#…" }` |
| R-AC-07 | `responsiveIssues` chỉ có ở chế độ `optimizeResponsive` (mục 6) |
| R-AC-08 | Kết quả của Context Builder là hàm thuần của (document, request, issues), có golden test |

---

### 3.4. Xem trước dữ liệu gửi đi (FR-29)

`POST /ai/context-preview` trả `AIContextPreview` (SPEC-03 mục 10.7), bổ sung `includesScreenshot`. AI Panel hiển thị trước khi gửi:

```text
Gửi tới: Anthropic · <model> · bên ngoài máy
Mức ngữ cảnh: 1 — Trang "Sản phẩm"
Gồm: 34 node, 18 token, ảnh chụp Canvas (tắt)
Khoảng 6.200 token
[Gửi]  [Đổi mức ▾]
```

| Mã | Quy tắc |
|---|---|
| R-AC-09 | Provider bên ngoài (`external = true`): lần gửi đầu tiên trong phiên **BẮT BUỘC** hiện hộp xác nhận. Người dùng có thể chọn "Không hỏi lại trong phiên này" |
| R-AC-10 | Ollama: hiện "Chạy trên máy này", không cần xác nhận |

---

## 4. M-AP — PROMPT VÀ HỢP ĐỒNG ĐẦU RA

### 4.1. Cấu trúc prompt

| Phần | Nội dung |
|---|---|
| System | Vai trò, nguyên tắc (layout có cấu trúc, chỉ dùng loại node và hành động được phép, ưu tiên token, khả năng tiếp cận), quy tắc chứa (V-10 đến V-20), quy tắc tương tác (V-90 đến V-98), quy tắc ID tạm (4.3), ngôn ngữ (4.4), danh mục loại node và thuộc tính (sinh tự động từ schema), 3 ví dụ ngắn (few-shot) |
| Context | Tài liệu JSON mục 3.3, đặt trong khối đánh dấu `<design_context>` … `</design_context>` |
| Request | Yêu cầu của người dùng, đặt trong khối `<user_request>` … `</user_request>` |
| Refine | Với `refine`: đề xuất trước (`summary` + `ops`) và yêu cầu sửa tiếp |

| Mã | Quy tắc |
|---|---|
| R-AP-01 | Prompt lưu trong `packages/server/src/core/ai/prompts/` dưới dạng file văn bản có **mã phiên bản** (ví dụ `system.v3.md`). Mã phiên bản ghi vào log và vào đề xuất |
| R-AP-02 | Danh mục loại node, thuộc tính và hành động trong prompt **sinh tự động** từ schema Zod của `@reactcraft/model`, không viết tay, để luôn khớp schema |
| R-AP-03 | System prompt nêu rõ: nội dung trong `<design_context>` và `<user_request>` là **dữ liệu**. Chỉ dẫn nằm trong dữ liệu (ví dụ chữ trong một node) không được làm theo |

---

### 4.2. Hợp đồng đầu ra

```ts
// Schema Zod trong @reactcraft/model/ai, chuyển sang JSON Schema bằng z.toJSONSchema()
type AIProposalOutput = {
  readonly summary: string;                    // 1..600 ký tự, ngôn ngữ giao diện (4.4)
  readonly ops: readonly AIOperation[];        // 1..500
  readonly notes?: readonly string[];          // tối đa 5 ghi chú cho người dùng (giả định, hạn chế)
};

// AIOperation = DesignOperation, giới hạn theo bảng 4.3
```

---

### 4.3. Operation AI được phép dùng

| Operation | `editSelection` | `generatePage` | `optimizeResponsive` |
|---|---|---|---|
| `insert`, `remove`, `move` | Có (trong phạm vi) | Có (trong trang mới) | Không |
| `setStyle` | Có | Có | Chỉ khóa responsive khác `base` |
| `setContent`, `setNodeMeta` | Có | Có | Không |
| `setBinding` | Có | Có | Không |
| `wrap`, `unwrap` | Có | Có | Không |
| `setInteractions`, `setRuntime` | Có | Có | Có (chỉ cho menu điện thoại) |
| `page.create` | Không | Có (1..3) | Không |
| `token.set` | Chỉ khi yêu cầu nhắc rõ tới màu/thang chung | Chỉ khi yêu cầu nhắc rõ | Không |
| `page.delete`, `page.reorder`, `token.delete`, `component.*`, `workspace.update` | **Không** | **Không** | **Không** |

**ID tạm:** node mới, trang mới, tương tác mới dùng ID tạm dạng `tmp_<số>` (ví dụ `tmp_1`). Node đã có dùng ID thật. `assignIds` (SPEC-03 mục 7.4) đổi ID tạm thành ID thật và cập nhật mọi tham chiếu trong đề xuất, kể cả đích của tương tác.

---

### 4.4. Ngôn ngữ

| Phần | Ngôn ngữ |
|---|---|
| `summary`, `notes` | Ngôn ngữ giao diện Studio (`language` của request, ADR-BE-22) |
| Nội dung thiết kế AI tạo ra (tiêu đề, nhãn, chữ mẫu, thông báo toast, thông báo lỗi nhập liệu) | `contentLocale` của workspace |

Ví dụ: giao diện Studio tiếng Anh, workspace `vi-VN`: tóm tắt bằng tiếng Anh, chữ trên trang bằng tiếng Việt.

---

### 4.5. Gọi provider

| Bước | Xử lý |
|---|---|
| 1 | Gọi qua AI SDK ở chế độ structured output với schema `AIProposalOutput`, **streaming** |
| 2 | Trong lúc stream: phần `summary` đã nhận được gửi xuống Studio bằng sự kiện `ai.proposal.delta` |
| 3 | Nhận đủ: chuyển sang kiểm tra (mục 5) |

---

## 5. M-AV — KIỂM TRA VÀ SỬA ĐỀ XUẤT

### 5.1. Quy trình

```text
Đầu ra AI
   ↓ (1) Zod parse AIProposalOutput             ── lỗi ─┐
   ↓ (2) Kiểm tra operation được phép (4.3)     ── lỗi ─┤
   ↓ (3) assignIds                                       │
   ↓ (4) applyBatch trên bản chụp document ở baseRevision ── lỗi ─┤
   ↓ (5) Kiểm tra phạm vi (5.3)                          │
   ↓ (6) Kiểm tra chất lượng (5.4) → cảnh báo            │
   ↓                                                     ▼
Đề xuất 'ready'                         Thử lại 1 lần: gửi lại prompt kèm danh sách lỗi
                                        (mã quy tắc V-xx, chỉ số operation, thông điệp)
                                                         │
                                        Vẫn lỗi → job thất bại E007
```

| Mã | Quy tắc |
|---|---|
| R-AV-01 | Thông báo lỗi gửi lại cho AI ở bước thử lại ngắn gọn, tối đa 20 lỗi, mỗi lỗi một dòng: `op[<index>] <rule>: <message>` |
| R-AV-02 | Đề xuất đạt bước (4) với **toàn bộ** operation. Không bỏ bớt operation lỗi rồi giữ phần còn lại (tránh đề xuất nửa vời) |

---

### 5.2. Kiểm tra dữ liệu bịa (AC-07)

Đã bao gồm trong bước (4) qua V-30 (binding phải trỏ tới entity, field, endpoint có thật) và V-93, V-94 (tham số route, ngữ cảnh bản ghi). Đề xuất có field không tồn tại **không bao giờ** tới được người dùng.

---

### 5.3. Phạm vi của `editSelection`

Phạm vi = các node được chọn và toàn bộ con cháu của chúng.

| Thao tác | Trong phạm vi khi |
|---|---|
| `insert`, `move` | Cha đích nằm trong phạm vi, **hoặc** cha đích là cha của một node được chọn (thêm/di chuyển ngay cạnh vùng chọn) |
| `remove`, `setStyle`, `setContent`, `setBinding`, `setNodeMeta`, `setInteractions`, `setRuntime` | Node nằm trong phạm vi |
| `wrap` | Các node được bọc nằm trong phạm vi hoặc chính là các node được chọn |
| Tương tác trỏ tới đích ngoài phạm vi (ví dụ mở một Modal có sẵn trong trang) | Cho phép (chỉ đọc đích) |

| Mã | Quy tắc |
|---|---|
| R-AV-03 | Đề xuất có operation ngoài phạm vi: **không** bị loại, nhưng đánh dấu `outOfScope` kèm danh sách node bị ảnh hưởng. Studio hiển thị cảnh báo nổi bật và yêu cầu xác nhận thêm khi chấp nhận |

---

### 5.4. Kiểm tra chất lượng (cảnh báo, không chặn)

| Mã cảnh báo | Điều kiện |
|---|---|
| `AIQ-01` | Tỷ lệ giá trị cứng (`{ px }`, màu hex) trên tổng giá trị style > 30% khi có token phù hợp |
| `AIQ-02` | `Image` thiếu `alt` có nghĩa (rỗng hoặc trùng tên file) |
| `AIQ-03` | `Button`, `Link` không có chữ và không có nhãn truy cập |
| `AIQ-04` | Độ tương phản chữ/nền (tính từ token) dưới WCAG AA (4,5:1 chữ thường, 3:1 chữ ≥ 24 px hoặc đậm ≥ 18,66 px) |
| `AIQ-05` | Cỡ chữ < 12 px |
| `AIQ-06` | Nội dung không theo `contentLocale` (phát hiện ngôn ngữ đơn giản theo ký tự đặc trưng) |

Cảnh báo nằm trong `AIProposal.warnings`, hiển thị ở AI Panel.

---

## 6. M-AR — KIỂM TRA RESPONSIVE (RESPONSIVE AUDIT)

### 6.1. Mục đích

AI không nhìn thấy layout đã render. Studio **đo layout thật** ở các khung khác khung chuẩn rồi gửi danh sách vấn đề cho AI ở chế độ `optimizeResponsive`. Người dùng cũng xem danh sách này mà không cần AI.

---

### 6.2. Cách đo

- Studio render trang trong **iframe ẩn** (ngoài màn hình) ở độ rộng từng khung không phải khung chuẩn, dùng cùng renderer của Canvas.
- Đo bằng `getBoundingClientRect`, `scrollWidth`, `getComputedStyle` sau khi Tailwind runtime áp dụng xong.

| Mã vấn đề | Điều kiện | Gợi ý cho AI |
|---|---|---|
| `RA-01` | Phần tử rộng hơn khung (gây cuộn ngang trang) | Giảm độ rộng cố định, cho phép wrap, đổi hướng hàng thành cột |
| `RA-02` | Ô của Grid hẹp hơn 160 px | Giảm số cột hoặc dùng auto-fit |
| `RA-03` | Tiêu đề > 40 px trên khung < 640 px | Giảm cỡ chữ ở khóa responsive |
| `RA-04` | Vùng bấm (Button, Link, Icon có click) nhỏ hơn 44 × 44 px trên khung < 768 px | Tăng padding |
| `RA-05` | Chữ bị cắt (`scrollWidth > clientWidth` khi không có `truncate`) | Cho xuống dòng, giảm cỡ chữ |
| `RA-06` | Padding/margin ngang > 15% độ rộng khung | Giảm khoảng cách |
| `RA-07` | `Navbar` có > 4 liên kết theo hàng trên khung < 768 px và không có menu điện thoại | Thêm nút ☰ và menu ẩn khi tải trang (mẫu preset "Thanh điều hướng responsive") |

```ts
type ResponsiveIssue = {
  readonly code: 'RA-01' | 'RA-02' | 'RA-03' | 'RA-04' | 'RA-05' | 'RA-06' | 'RA-07';
  readonly frameId: string;
  readonly nodeId: NodeId;
  readonly measured: Readonly<Record<string, number>>;   // ví dụ { width: 420, frameWidth: 375 }
};
```

| Mã | Quy tắc |
|---|---|
| R-AR-01 | Audit chạy khi người dùng bấm "Kiểm tra responsive" hoặc trước khi gửi `optimizeResponsive`. Kết quả hiển thị trong AI Panel, bấm vào để chọn node trên Canvas |
| R-AR-02 | Audit một trang 500 node trên 2 khung ≤ 2 s |
| R-AR-03 | Sau khi chấp nhận đề xuất `optimizeResponsive`, Studio chạy lại audit và báo số vấn đề còn lại |

---

## 7. M-AU — AI PANEL VÀ XEM TRƯỚC ĐỀ XUẤT

### 7.1. Bố cục AI Panel

```text
┌─ AI ───────────────────────────────────────┐
│ Provider: Anthropic · <model>  [⚙]          │
│ Phạm vi: Card "Sản phẩm" (3 node)          │
│ Tác vụ nhanh:                              │
│ [Hiện đại hơn] [Tối ưu điện thoại]         │
│ [Thêm hover] [Nội dung mẫu] [Kiểm tra a11y]│
├────────────────────────────────────────────┤
│ Luồng hội thoại (phiên hiện tại)           │
│  Bạn: Thêm nút "Mua ngay" dưới giá         │
│  AI: Thêm Button primary vào Card…  ✓ Đã áp dụng │
├────────────────────────────────────────────┤
│ [Nhập yêu cầu…                       ] [▶] │
│ ☐ Gửi ảnh chụp Canvas  Mức tối đa: [Tự động ▾] │
└────────────────────────────────────────────┘
```

| Tác vụ nhanh | Chế độ | Prompt dựng sẵn (theo ngôn ngữ giao diện) |
|---|---|---|
| Hiện đại hơn | `editSelection` | Làm vùng chọn hiện đại hơn, giữ nội dung, dùng token có sẵn |
| Tối ưu điện thoại | `optimizeResponsive` | Sửa các vấn đề responsive đã đo |
| Thêm hover | `editSelection` | Thêm trạng thái hover và transition cho phần tử tương tác |
| Nội dung mẫu | `editSelection` | Thay chữ giữ chỗ bằng nội dung mẫu hợp ngữ cảnh, theo `contentLocale` |
| Kiểm tra a11y | `editSelection` | Sửa vấn đề khả năng tiếp cận: alt, nhãn, độ tương phản, cỡ chữ |

| Mã | Quy tắc |
|---|---|
| R-AU-01 | Luồng hội thoại tồn tại trong **phiên Studio**, không lưu xuống disk (giống lịch sử Undo, V-55). Có nút "Xóa hội thoại" |
| R-AU-02 | Không có vùng chọn: chế độ mặc định `generatePage`. Có vùng chọn: `editSelection` |
| R-AU-03 | Trong lúc chờ: hiện phần `summary` đang stream, nút "Hủy" |

---

### 7.2. Xem trước trên Canvas

Khi đề xuất `ready`:

| Thành phần | Hiển thị |
|---|---|
| Canvas | Chuyển sang **chế độ xem trước đề xuất**: render document sau khi áp dụng đề xuất (bản sao trong bộ nhớ, không vào Editor Store). Node mới viền xanh lá, node bị đổi viền xanh dương, node bị xóa hiện mờ có gạch chéo tại vị trí cũ |
| Nút "Trước / Sau" | Chuyển nhanh giữa document hiện tại và document đề xuất |
| Danh sách thay đổi | Mỗi dòng là một thay đổi dễ đọc, sinh từ operation: "Thêm Button 'Mua ngay' vào Card", "Đổi padding Card (Mobile): 16 → 12 px", "Thêm tương tác: bấm ☰ → bật tắt Menu điện thoại". Bấm dòng để chọn node |
| Cảnh báo | `warnings` (5.4), `outOfScope` (5.3), `notes` của AI |
| Thao tác | **Chấp nhận**, **Từ chối**, **Yêu cầu sửa tiếp** (ô nhập, tạo request `refine`) |

```ts
// Bổ sung vào AIProposal (SPEC-03 mục 10.7)
type ChangeSummary = {
  readonly kind: 'add' | 'remove' | 'move' | 'style' | 'content' | 'binding' | 'interaction' | 'page' | 'token' | 'meta';
  readonly nodeId?: NodeId;
  readonly messageKey: string;                 // khóa i18n, ví dụ 'ai:change.addNode'
  readonly params: Readonly<Record<string, string>>;
};
```

| Mã | Quy tắc |
|---|---|
| R-AU-04 | **Chấp nhận** = `dispatch(ops, { source: 'ai', label: summary rút gọn 60 ký tự, aiProposalId })`. Một bước Undo (ADR-FE-10) |
| R-AU-05 | **Không** hỗ trợ chấp nhận một phần: các operation phụ thuộc nhau (ID tạm, tương tác trỏ tới node mới). Muốn bớt thì dùng "Yêu cầu sửa tiếp" hoặc chấp nhận rồi sửa tay / Undo |
| R-AU-06 | Đề xuất `stale` (thiết kế đã đổi, V-64): khóa nút Chấp nhận, hiện nút "Tạo lại với thiết kế hiện tại" |
| R-AU-07 | Trong chế độ xem trước đề xuất, mọi thao tác sửa trên Canvas bị khóa cho tới khi người dùng chấp nhận, từ chối hoặc thoát |
| R-AU-08 | `generatePage` tạo nhiều trang: thanh chọn trang trong chế độ xem trước để xem từng trang mới |

---

## 8. BẢO MẬT VÀ QUYỀN RIÊNG TƯ

| Mã | Quy tắc |
|---|---|
| R-AS-01 | AI không có tool/function calling. Request gửi provider **không** khai báo tool nào (SEC-04, ADR-BE-22) |
| R-AS-02 | API key chỉ nằm ở server (ADR-BE-24), không xuống trình duyệt, không vào log |
| R-AS-03 | Log chỉ ghi: ID job, provider, model, mã phiên bản prompt, mức ngữ cảnh, số token, thời gian, kết quả kiểm tra. **Không** ghi nội dung prompt, ngữ cảnh, đầu ra |
| R-AS-04 | Prompt injection từ nội dung thiết kế hoặc tên trong catalog: được giảm thiểu bằng R-AP-03 và vô hiệu hóa về mặt hậu quả vì (1) AI không có công cụ, (2) mọi đầu ra qua kiểm tra schema và engine, (3) người dùng xem trước và duyệt |
| R-AS-05 | Ảnh chụp Canvas chỉ gửi khi người dùng bật cho từng request (2.2) |

---

## 9. CẬP NHẬT SPEC-03 MỤC 10.7

| Kiểu | Thay đổi |
|---|---|
| `AIRequest.mode` | `'editSelection' \| 'generatePage' \| 'optimizeResponsive' \| 'refine'` |
| `AIRequest` | Thêm `previousProposalId?` (bắt buộc khi `refine`), `includeScreenshot?: boolean`, `screenshot?: string` (PNG base64, ≤ 2 MB), `responsiveIssues?: readonly ResponsiveIssue[]`, `quickAction?: string` |
| `AIContextPreview` | Thêm `includesScreenshot: boolean` |
| `AIProposal` | Thêm `changes: readonly ChangeSummary[]`, `warnings: readonly { code: string; nodeId?: NodeId }[]`, `outOfScope?: readonly NodeId[]`, `notes?: readonly string[]`, `usage?: { inputTokens: number; outputTokens: number }`, `promptVersion: string`, `contextLevel: 0 \| 1 \| 2 \| 3` |
| Giới hạn | Body tối đa 10 MB đủ cho ảnh 2 MB (mục 12 của SPEC-03 giữ nguyên) |

---

## 10. TIÊU CHÍ KIỂM THỬ

### 10.1. Unit, golden

| Module | Kiểm thử bắt buộc |
|---|---|
| M-AC | Golden file ngữ cảnh cho mỗi mức, mỗi chế độ. Chọn mức tự động với bộ 40 yêu cầu mẫu tiếng Việt và tiếng Anh. Cắt bớt đúng thứ tự khi vượt ngân sách. Không bao giờ chứa secrets (kiểm tra bằng chuỗi đánh dấu giả trong fixture) |
| M-AP | Danh mục node trong prompt khớp schema (so với `z.toJSONSchema()`) |
| M-AV | Bộ 30 đầu ra AI lỗi cố ý: sai schema, operation không được phép, ID không tồn tại, vi phạm quy tắc chứa, field bịa, tương tác trỏ sai, ngoài phạm vi. Mỗi trường hợp ra đúng kết quả (thử lại, E007, hoặc `outOfScope`) |
| M-AR | Trang mẫu có đủ 7 loại vấn đề RA-01 đến RA-07, đo đúng ở khung 375 |
| Change summary | Mỗi loại operation sinh đúng dòng thay đổi ở cả `vi` và `en` |

CI dùng phản hồi AI ghi sẵn, không gọi provider thật (ADR-BE-26).

---

### 10.2. Đánh giá với provider thật (VG-06)

Bộ 50 yêu cầu, chia:

| Nhóm | Số lượng | Ví dụ |
|---|---|---|
| `editSelection` style | 15 | "Làm card này nổi bật hơn" |
| `editSelection` cấu trúc | 10 | "Thêm nút Mua ngay dưới giá", "Đổi danh sách thành lưới 3 cột" |
| `generatePage` không dữ liệu | 8 | "Trang giới thiệu công ty có hero, 3 tính năng, chân trang" |
| `generatePage` có dữ liệu | 7 | "Trang quản lý sản phẩm: bảng, tìm kiếm, nút thêm mở form" |
| `optimizeResponsive` | 5 | Trang có 5 vấn đề RA đã biết |
| Tương tác | 5 | "Nút Thêm mới mở form trong modal, gửi xong thì đóng và báo thành công" |

Chỉ số ghi lại cho mỗi provider/model: tỷ lệ hợp lệ (ngưỡng ở VG-06), tỷ lệ cần thử lại, tỷ lệ `outOfScope`, số cảnh báo AIQ trung bình, thời gian trung bình, token trung bình. Kết quả quyết định model khuyến nghị cho từng provider, ghi vào SPEC-01.1 mục 13.3.

---

### 10.3. E2E

| Kịch bản | AC |
|---|---|
| Chọn Card, yêu cầu "thêm nút Mua ngay dưới giá" (phản hồi ghi sẵn): xem trước có viền xanh lá ở nút mới, chấp nhận, Undo một bước khôi phục | AC-06 |
| Yêu cầu "tạo trang quản lý sản phẩm" với catalog có `Product`: trang mới có Table gắn `/api/products`, form đủ field, nút Thêm mở Modal; không có field ngoài catalog | AC-07 |
| Tối ưu điện thoại: audit báo 5 vấn đề, chấp nhận đề xuất, audit lại còn 0 | R-AR-03 |
| Đổi thiết kế khi đề xuất đang chờ: đề xuất chuyển `stale`, nút Chấp nhận bị khóa | R-AU-06 |
| Lần gửi đầu tới provider bên ngoài hiện hộp xác nhận, Ollama thì không | R-AC-09, R-AC-10 |

---

## 11. TRUY VẾT

| Yêu cầu | Mục |
|---|---|
| FR-22 AI trên phần tử | 1.3, 5.3, 7 |
| FR-23 AI dựng trang | 1.3, 4.3 |
| FR-24 Mức ngữ cảnh | 3.1, 3.2 |
| FR-25 Output có cấu trúc | 4.2, 4.3 |
| FR-26 Xem trước và duyệt | 7.2 |
| FR-27, FR-28 Provider, Ollama | 2 |
| FR-29 Minh bạch dữ liệu | 3.4, 2.2 |
| FR-30 Ranh giới bảo mật | 8 |
| FR-39 Tương tác | 4.3 (`setInteractions`, `setRuntime`) |
| NFR-08 Lỗi AI không ảnh hưởng | R-AG-07 |
| NFR-16 Ngôn ngữ phản hồi AI | 4.4 |
| AC-06, AC-07 | 10.3 |

---

## 12. CÂU HỎI MỞ

Không có. Các điểm cần số liệu thực tế (model khuyến nghị cho từng provider) được quyết định bằng VG-06.

---

# SPEC-04.4 — QUÉT BACKEND, DATA SOURCE & GẮN DỮ LIỆU

**Thuộc:** SPEC-04 — Đặc tả module  
**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0 (FR-04, FR-17 đến FR-21, FR-34, FR-39, NFR-04, SEC-02, SEC-05, AC-04, AC-05, AC-07, AC-13), SPEC-01.1 (ADR-BE-12 đến ADR-BE-15), SPEC-03 (mục 3.7, 6, 6a, 10.5, 10.6), SPEC-04.2, SPEC-04.3  
**Phạm vi:** Các module của **Phase 4 — Backend Context**

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

### 1.1. Danh sách module

| Mã | Tên | Nơi chạy | Mục |
|---|---|---|---|
| M-BS | Backend Scanner (điều phối quét) | Server (worker) | 2 |
| M-XO | Bộ trích xuất OpenAPI | Server (worker) | 3 |
| M-XJ | Bộ trích xuất Express, NestJS, Prisma, Mongoose, TypeORM, Sequelize | Server (worker) | 4 |
| M-XP | Bộ trích xuất Django, Django REST Framework | Server (worker) | 5 |
| M-XA | Trích xuất bằng AI (tùy chọn) | Server | 6 |
| M-DC | Data Source Catalog: gộp, duyệt, sửa | Server + Studio | 7 |
| M-DB | Gắn dữ liệu trên Studio | Studio | 8 |
| M-MK | Dữ liệu mẫu | Model | 9 |
| M-LP | Dữ liệu thật trong Xem thử (proxy chỉ đọc) | Server + Studio | 10 |
| M-DL | Sinh lớp dữ liệu khi xuất code | Server | 11 |

---

### 1.2. Nguyên tắc

| Mã | Quy tắc |
|---|---|
| R-BS-01 | Thư mục backend **chỉ đọc** trong mọi trường hợp (SEC-02). Không chạy code, không cài package, không import file của backend |
| R-BS-02 | File secrets (ADR-BE-15) **không bao giờ** được đọc nội dung, kể cả để phát hiện framework |
| R-BS-03 | Kết quả quét là **đề xuất**. Chỉ vào Data Source Catalog khi người dùng duyệt (mục 7) |
| R-BS-04 | Mọi entity, field, endpoint có nguồn gốc (file, dòng) và mức tin cậy (FR-17) |

---

## 2. M-BS — BACKEND SCANNER

### 2.1. Quy trình một lần quét

```text
POST /backends/{id}/scan { allowAi }
   ↓ job 'scan' (V-62: một job quét mỗi workspace)
(1) Liệt kê file: tinyglobby + .gitignore + danh sách loại trừ (ADR-BE-15)
(2) Phát hiện framework và nguồn (2.2)
(3) Chạy các bộ trích xuất phù hợp, song song trong worker:
      OpenAPI (mục 3) → mã nguồn (mục 4, 5)
(4) Nếu allowAi và còn phần chưa nhận diện: trích xuất bằng AI (mục 6)
(5) Gộp kết quả, loại trùng, gán mức tin cậy (7.1)
(6) Phát hiện xác thực API (2.3)
   ↓ job.completed { result: ScanResult }
```

Tiến độ gửi qua `job.progress` với `stepKey`: `scan.listing`, `scan.detecting`, `scan.openapi`, `scan.code`, `scan.ai`, `scan.merging`.

---

### 2.2. Phát hiện framework

| Framework | Dấu hiệu (đọc dạng văn bản) |
|---|---|
| OpenAPI | File tên `openapi.*`, `swagger.*`, `*.openapi.*`, `api-docs.*` (json/yaml/yml), hoặc file JSON/YAML có khóa gốc `openapi` / `swagger` |
| Express | `package.json` có `express` |
| NestJS | `package.json` có `@nestjs/core` |
| Prisma | Có `prisma/schema.prisma` hoặc `schema.prisma` |
| Mongoose | `package.json` có `mongoose` |
| TypeORM | `package.json` có `typeorm` hoặc `@nestjs/typeorm` |
| Sequelize | `package.json` có `sequelize` |
| Django | `manage.py` + `requirements*.txt` / `pyproject.toml` / `Pipfile` có `django` |
| Django REST Framework | Như trên, có `djangorestframework` |
| Spring Boot | `pom.xml` / `build.gradle*` có `spring-boot` |
| Laravel | `composer.json` có `laravel/framework` |
| FastAPI, Flask, Rails, ASP.NET… | Theo file khai báo phụ thuộc tương ứng |

Framework phát hiện được nhưng không có bộ trích xuất (Spring Boot, Laravel, FastAPI…): kết quả ghi `frameworks` và cảnh báo "Không có bộ trích xuất riêng. Hãy dùng file OpenAPI, bật trích xuất bằng AI, hoặc nhập thủ công".

---

### 2.3. Phát hiện xác thực API

| Nguồn | Kết quả `auth.kind` |
|---|---|
| OpenAPI `securitySchemes` loại `http` `bearer` hoặc `apiKey` ở header | `bearer` (hoặc `header` với `headerName`) |
| OpenAPI `securitySchemes` loại `apiKey` ở cookie | `cookie` |
| DRF `DEFAULT_AUTHENTICATION_CLASSES` có `TokenAuthentication`, `JWTAuthentication` | `bearer` |
| DRF có `SessionAuthentication` | `cookie` |
| Express/NestJS dùng `passport-jwt`, `@nestjs/jwt`, `jsonwebtoken` | `bearer` |
| Không thấy dấu hiệu | `none` |

Kết quả là gợi ý, người dùng sửa được trong catalog.

---

### 2.4. Cache và quét lại

| Mã | Quy tắc |
|---|---|
| R-BS-05 | Kết quả trích xuất của **từng file** được cache theo SHA-256 nội dung trong `.reactcraft/cache/scan/<backendId>.json`. Lần quét sau chỉ phân tích lại file đã đổi |
| R-BS-06 | Sự kiện `backend.changed` (ADR-BE-20) đánh dấu catalog "có thể đã cũ". Studio hiện nút "Quét lại", không tự quét |
| R-BS-07 | Quét backend mẫu lớn 2.000 file ≤ 10 s, không tính AI (NFR-04, PB-05). Quét lại khi 1 file đổi ≤ 1 s |
| R-BS-08 | Lỗi ở một file không dừng job: ghi vào `warnings`, tăng `skippedFiles` |

---

## 3. M-XO — BỘ TRÍCH XUẤT OPENAPI

### 3.1. Entity

| Bước | Xử lý |
|---|---|
| 1 | Đọc, giải `$ref` nội bộ (ADR-BE-14), quy đổi Swagger 2.0 sang dạng 3.x |
| 2 | Mỗi schema trong `components.schemas` (hoặc `definitions`) kiểu `object` có `properties` là ứng viên entity |
| 3 | Loại ứng viên là vỏ bọc: tên kết thúc bằng `Error`, `Response`, `Paginated…`, `…List`, hoặc chỉ gồm `count/next/previous/results`, `data/meta`, `items/total` |
| 4 | Gộp biến thể: `ProductCreate`, `ProductUpdate`, `ProductRequest`, `ProductInput` gộp vào `Product`. Field chỉ có ở bản đọc → `readOnly`. Field có `readOnly: true` → `readOnly` |
| 5 | `required` lấy từ danh sách `required` của biến thể tạo mới nếu có, ngược lại của schema chính |

---

### 3.2. Ánh xạ kiểu

| OpenAPI `type` / `format` | `FieldType` |
|---|---|
| `string` | `string` |
| `string` + `format: email` | `email` |
| `string` + `format: uri` / `url` | `url` |
| `string` + `format: date` | `date` |
| `string` + `format: date-time` | `datetime` |
| `string` + `format: uuid` | `id` khi tên là `id`, ngược lại `string` |
| `string` + `maxLength > 255` hoặc không có `maxLength` và tên gợi ý văn bản dài (`description`, `content`, `body`, `note`) | `text` |
| `string` + `enum` | `enum` |
| `string` + tên chứa `image`, `avatar`, `photo`, `thumbnail` | `image` |
| `integer` | `integer`, hoặc `id` khi tên là `id` |
| `number` | `number`. `format: decimal` hoặc tên chứa `price`, `amount`, `total` → `decimal` |
| `boolean` | `boolean` |
| `$ref` tới entity khác | `relation` (`many: false`) |
| `array` of `$ref` tới entity | `relation` (`many: true`) |
| `object` không phải entity | `json` |

---

### 3.3. Endpoint

| Điều kiện (method + path) | `purpose` |
|---|---|
| `GET` path không kết thúc bằng tham số, phản hồi là mảng entity hoặc vỏ bọc chứa mảng (`results`, `data`, `items`, `content`) | `list` |
| `GET` path kết thúc bằng tham số (`/{id}`) | `detail` |
| `POST` path không kết thúc bằng tham số | `create` |
| `PUT` / `PATCH` path kết thúc bằng tham số | `update` |
| `DELETE` path kết thúc bằng tham số | `delete` |
| Còn lại | `other` |

| Mã | Quy tắc |
|---|---|
| R-XO-01 | `entity` của endpoint lấy từ schema phản hồi (list, detail) hoặc schema body (create, update). Không xác định được: so khớp đoạn path cuối (số nhiều/số ít) với tên entity, mức tin cậy giảm còn `medium` |
| R-XO-02 | Phân trang: tham số query `page`/`page_size`/`per_page` → `page`; `limit`/`offset` → `offset`; `cursor`/`after` → `cursor`. Vỏ bọc phản hồi được ghi lại để lớp dữ liệu biết cách lấy mảng (11.3) |
| R-XO-03 | Tham số query tên `search`, `q`, `query`, `keyword` được đánh dấu là tham số tìm kiếm. `ordering`, `sort`, `order_by` là tham số sắp xếp |
| R-XO-04 | Toàn bộ kết quả OpenAPI có mức tin cậy `high` |

---

## 4. M-XJ — BỘ TRÍCH XUẤT JS/TS

Dùng `oxc-parser` + `estree-walker` (ADR-BE-12). Mọi bộ trích xuất là hàm thuần nhận (đường dẫn, nội dung) và trả kết quả một phần; liên kết giữa các file làm ở bước gộp.

### 4.1. Express

| Bước | Xử lý |
|---|---|
| 1 | Tìm biến được gán từ `express()` (app) và `express.Router()` / `Router()` (router) |
| 2 | Lời gọi `<app|router>.<get|post|put|patch|delete>('<path>', …)` và `<router>.route('<path>').get(…).post(…)` → route cục bộ |
| 3 | `<app|router>.use('<prefix>', <router>)`: router được import từ file khác (`import`/`require` đường dẫn tương đối) → nối tiền tố |
| 4 | Ghép đường dẫn đầy đủ bằng cách đi theo đồ thị `use` từ app gốc. Tham số Express `:id` đổi thành `{id}` |
| 5 | Xác định `purpose` theo bảng 3.3 |
| 6 | Liên kết entity: handler gọi model đã biết (`Product.find`, `prisma.product.findMany`, `productRepository.find`…) → entity đó; ngược lại so khớp tên path |

Đường dẫn là biểu thức động (biến, template string có biến): bỏ qua route đó, ghi cảnh báo. Mức tin cậy: `medium`.

---

### 4.2. NestJS

| Thành phần | Xử lý |
|---|---|
| `@Controller('products')` | Tiền tố của lớp |
| `@Get(':id')`, `@Post()`, `@Put(':id')`, `@Patch(':id')`, `@Delete(':id')` | Route của phương thức |
| `app.setGlobalPrefix('api')` trong `main.ts` | Tiền tố toàn cục |
| `@Body() dto: CreateProductDto` | DTO tạo/sửa. Field từ thuộc tính lớp DTO và decorator `class-validator` (`@IsString`, `@IsEmail`, `@IsInt`, `@IsOptional`, `@MaxLength`…) |
| `@Query()` DTO | Tham số query |

Mức tin cậy: `high` khi route và DTO đều tĩnh, ngược lại `medium`.

---

### 4.3. Model dữ liệu

| Nguồn | Cách đọc | Entity, field |
|---|---|---|
| Prisma `schema.prisma` | Bộ phân tích cú pháp riêng cho khối `model X { … }`, `enum X { … }` (ngữ pháp nhỏ, có test đầy đủ) | Mỗi `model` là entity. `@id` → `id` + `readOnly`. `@default(now())`, `@updatedAt` → `readOnly`. `?` → không bắt buộc. Kiểu `String`, `Int`, `Float`, `Decimal`, `Boolean`, `DateTime`, `Json`, enum, quan hệ |
| Mongoose | `new Schema({ … })`, `mongoose.model('Product', schema)`, NestJS `@Schema()` + `@Prop()` | `required: true`, `enum`, `type: String/Number/Date/Boolean`, `ref: 'Category'` → `relation` |
| TypeORM | Lớp có `@Entity()`, thuộc tính có `@Column`, `@PrimaryGeneratedColumn`, `@CreateDateColumn`, `@ManyToOne`, `@OneToMany` | Kiểu từ chú thích TypeScript và tham số decorator |
| Sequelize | `sequelize.define('Product', { … })`, `Model.init({ … })` | `DataTypes.STRING/INTEGER/DECIMAL/BOOLEAN/DATE/TEXT/ENUM`, `allowNull: false` |

Mức tin cậy: `high` (Prisma, TypeORM, NestJS Mongoose), `medium` (Mongoose, Sequelize khai báo động).

---

## 5. M-XP — BỘ TRÍCH XUẤT DJANGO / DRF

Dùng `web-tree-sitter` với grammar Python (ADR-BE-13). Truy vấn `.scm` đặt trong `extractors/django/`.

### 5.1. Model

| Django field | `FieldType` |
|---|---|
| `CharField`, `SlugField` | `string` |
| `TextField` | `text` |
| `EmailField` | `email` |
| `URLField` | `url` |
| `IntegerField`, `PositiveIntegerField`, `SmallIntegerField`, `BigIntegerField` | `integer` |
| `FloatField` | `number` |
| `DecimalField` | `decimal` |
| `BooleanField` | `boolean` |
| `DateField` | `date` |
| `DateTimeField` | `datetime` |
| `ImageField`, `FileField` | `image` (`FileField` → `url`) |
| `UUIDField` | `id` khi `primary_key=True`, ngược lại `string` |
| `JSONField` | `json` |
| Có `choices=` | `enum`, giá trị lấy từ hằng số hoặc lớp `TextChoices`/`IntegerChoices` trong cùng file |
| `ForeignKey`, `OneToOneField` | `relation` (`many: false`) |
| `ManyToManyField` | `relation` (`many: true`) |

| Mã | Quy tắc |
|---|---|
| R-XP-01 | `required = true` khi **không** có `blank=True`, `null=True`, `default=` |
| R-XP-02 | `auto_now`, `auto_now_add`, `editable=False`, khóa chính → `readOnly` |
| R-XP-03 | Model `abstract = True` không là entity, nhưng field của nó được kế thừa vào lớp con |
| R-XP-04 | Khóa chính `id` tự động thêm nếu model không khai báo khóa chính |

---

### 5.2. Serializer, view, URL

| Thành phần | Xử lý |
|---|---|
| `ModelSerializer` với `Meta.model`, `Meta.fields`, `Meta.read_only_fields`, `Meta.exclude` | Thu hẹp field theo `fields`/`exclude`, bổ sung `readOnly` |
| `ModelViewSet` | Đủ 5 endpoint: list, create, detail, update (PUT, PATCH), delete |
| `ReadOnlyModelViewSet` | list, detail |
| `ListCreateAPIView`, `RetrieveUpdateDestroyAPIView` và các lớp generics khác | Endpoint theo tên lớp |
| `@api_view(['GET', 'POST'])` | Endpoint theo danh sách method, `purpose` theo bảng 3.3 |
| `router.register(r'products', ProductViewSet)` | Đường dẫn `products/` và `products/{id}/` |
| `path('api/', include(router.urls))`, `path('api/', include('shop.urls'))` | Nối tiền tố, đi theo `include` sang `urls.py` của app khác |
| `REST_FRAMEWORK.DEFAULT_PAGINATION_CLASS` trong `settings.py` | `PageNumberPagination` → `page`, vỏ bọc `results`. `LimitOffsetPagination` → `offset`. `CursorPagination` → `cursor` |
| `filter_backends` có `SearchFilter`, `OrderingFilter` | Tham số `search`, `ordering` |

Mức tin cậy: `high` cho `ModelViewSet` + router + `ModelSerializer`, `medium` cho trường hợp khác.

---

## 6. M-XA — TRÍCH XUẤT BẰNG AI (TÙY CHỌN)

| Mã | Quy tắc |
|---|---|
| R-XA-01 | Chỉ chạy khi request có `allowAi = true` **và** người dùng đã xác nhận danh sách file sẽ gửi (FR-29). Hộp xác nhận hiện: provider, số file, tổng kích thước, danh sách đường dẫn |
| R-XA-02 | Chọn file ứng viên theo tên và vị trí: `routes`, `controllers`, `models`, `entities`, `schemas`, `serializers`, `views`, `urls`, `api`. Mỗi file ≤ 64 KB, tổng ≤ 400 KB. File secrets không bao giờ nằm trong danh sách (R-BS-02) |
| R-XA-03 | AI trả kết quả theo schema Zod `{ entities: Entity[], endpoints: Endpoint[] }` (bỏ `provenance`, server tự gán `origin: 'ai'`, `confidence: 'low'`, `file` theo file gửi) |
| R-XA-04 | Kết quả AI được kiểm tra schema, loại trùng với kết quả có độ tin cậy cao hơn (7.1). Không bao giờ ghi đè kết quả từ OpenAPI hay mã nguồn |
| R-XA-05 | Ollama được ưu tiên gợi ý cho bước này vì mã nguồn không rời khỏi máy |

---

## 7. M-DC — DATA SOURCE CATALOG

### 7.1. Gộp kết quả

| Bước | Xử lý |
|---|---|
| 1 | Chuẩn hóa tên entity: bỏ hậu tố `Model`, `Entity`, `Schema`, `Dto`; so khớp không phân biệt hoa thường, số ít/số nhiều (`Product` = `products`) |
| 2 | Cùng entity từ nhiều nguồn: gộp field theo tên. Mỗi thuộc tính của field lấy từ nguồn có ưu tiên cao nhất: `openapi` > `code` > `ai`. Nguồn gốc ghi theo từng field |
| 3 | Endpoint trùng (cùng method + path chuẩn hóa): giữ bản có ưu tiên cao nhất |
| 4 | `DataSourceId` = `ds_` + tên entity dạng `snake_case` số nhiều (`ds_products`). Trùng: thêm số |
| 5 | `label` của field: chuyển tên sang chữ thường có khoảng trắng (`created_at` → "Created at"). Người dùng sửa được, nhãn dùng cho tiêu đề cột và nhãn ô nhập |

---

### 7.2. Duyệt kết quả quét (Studio)

```text
┌─ Kết quả quét: my-shop-backend ─────────────────────────────────────────────┐
│ Framework: Django, DRF · 214 file · 3 bỏ qua · xác thực: bearer              │
├──────────────────────────────┬──────────────────────────────────────────────┤
│ ☑ Product   (cao)   mới      │ Field          Kiểu      Bắt buộc  Nguồn       │
│ ☑ Category  (cao)   mới      │ id             id        —         models.py:12│
│ ☐ Order     (TB)    mới      │ name           string    ✓         models.py:13│
│ ☑ Customer  (cao)   thay đổi │ price          decimal   ✓         models.py:14│
│                              │ category       → Category ✓        models.py:15│
│ Endpoint (12)                │                                              │
│ ☑ GET  /api/products/   list │                                              │
│ ☑ POST /api/products/ create │                                              │
├──────────────────────────────┴──────────────────────────────────────────────┤
│ Thay đổi so với catalog hiện tại: +2 entity, Customer: +1 field, −1 field    │
│                                              [Bỏ qua]  [Thêm vào catalog]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Mã | Quy tắc |
|---|---|
| R-DC-01 | Mặc định tích chọn mục có tin cậy `high` và `medium`, bỏ chọn `low` |
| R-DC-02 | Hiển thị khác biệt với catalog hiện tại: entity/field/endpoint mới, đổi, bị mất |
| R-DC-03 | Bấm nguồn gốc (file:dòng) hiện đoạn mã liên quan (chỉ đọc, tối đa 20 dòng quanh dòng đó, không bao giờ cho file secrets) |

---

### 7.3. Khi field hoặc endpoint đang được dùng bị mất

| Mã | Quy tắc |
|---|---|
| R-DC-04 | Gộp kết quả quét **không xóa** field, entity, endpoint đang được Binding hoặc tương tác dùng. Chúng được giữ lại với `stale: true` để Design Model vẫn hợp lệ (V-30) |
| R-DC-05 | Studio liệt kê mọi mục `stale` đang được dùng ("Binding có thể hỏng") kèm vị trí, và cho chọn: gắn lại sang field khác, gỡ binding, hoặc giữ nguyên |
| R-DC-06 | Mục `stale` không được dùng nữa thì bị xóa ở lần gộp kế tiếp |
| R-DC-07 | Xóa thủ công entity/endpoint đang được dùng: từ chối E005, liệt kê nơi dùng (SPEC-03 mục 10.6) |

---

### 7.4. Sửa và nhập thủ công

- Sửa nhãn, kiểu, bắt buộc, chỉ đọc, giá trị enum, quan hệ của field.
- Tạo entity và endpoint thủ công (nguồn `manual`, tin cậy `high`).
- Cấu hình chung: `baseUrl` (ví dụ `http://localhost:8000`), `auth`.

---

## 8. M-DB — GẮN DỮ LIỆU TRÊN STUDIO

### 8.1. Panel Dữ liệu

Tab "Dữ liệu" ở panel phải (SPEC-04.1 mục 6.2):

- Danh sách entity, mở ra thấy field và endpoint.
- Biểu tượng tin cậy, `stale`.
- **Kéo một entity vào Canvas** mở menu chọn mẫu:

| Mẫu | Cây node sinh ra |
|---|---|
| Bảng danh sách | `Table` gắn endpoint `list`, cột là các field hiển thị được (không `json`, không `relation many`), tối đa 6 cột, có tìm kiếm nếu endpoint có tham số tìm kiếm, phân trang nếu endpoint có phân trang |
| Lưới thẻ | `List` gắn endpoint `list`, mẫu là `Card` chứa ảnh (nếu có field `image`), tiêu đề (field tên/tiêu đề), 2 field phụ |
| Chi tiết | `DetailView` gắn endpoint `detail`, cặp nhãn – giá trị cho mọi field |
| Form tạo mới | `Form` gắn endpoint `create`, ô nhập cho mọi field không `readOnly` (8.3), nút gửi, tương tác `submitSuccess → showToast success` |
| Form sửa | Như trên với endpoint `update`, trang cần tham số route `:id` |
| Trang CRUD đầy đủ | Bảng danh sách + nút "Thêm mới" mở Modal chứa Form tạo mới + cột thao tác (Sửa mở Modal Form sửa, Xóa với `deleteRecord` có xác nhận) + `submitSuccess → closeModal, refreshData, showToast` |

---

### 8.2. Gắn dữ liệu cho node có sẵn (Inspector, nhóm "Dữ liệu")

| Node | Điều khiển |
|---|---|
| `Table` | Chọn endpoint `list`. Trình sửa cột: thêm/bớt/sắp xếp cột, chọn field, nhãn, định dạng. Tùy chọn dữ liệu (8.4). Nút thao tác dòng, bấm dòng (tương tác) |
| `List` | Chọn endpoint `list`. Tùy chọn dữ liệu (8.4) |
| `DetailView` | Chọn endpoint `detail`. Nguồn `id`: tham số route của trang |
| `Text`, `Heading`, `Image`, `Link` trong ngữ cảnh bản ghi (V-31) | Chọn field (lọc theo kiểu phù hợp), định dạng |
| `Form` | Chọn endpoint `create` / `update`. Nút "Sinh ô nhập theo field" |
| Ô nhập trong `Form` có binding | Chọn field. Kiểu ô nhập gợi ý theo kiểu field (8.3) |
| `Select` | Lựa chọn tĩnh **hoặc** từ dữ liệu: endpoint `list` + field giá trị + field nhãn |

| Mã | Quy tắc |
|---|---|
| R-DB-01 | Chỉ liệt kê field có kiểu tương thích với khóa binding (ví dụ `Image.src` chỉ nhận `image`, `url`) |
| R-DB-02 | Node có binding hiện biểu tượng 🔗 trên Overlay và trong Layer Tree |
| R-DB-03 | Mục `stale` hiện cảnh báo ngay tại điều khiển |

---

### 8.3. Kiểu field sang ô nhập

| `FieldType` | Node | `inputType` / ghi chú |
|---|---|---|
| `string` | `Input` | `text`, `maxLength` nếu biết |
| `text` | `Textarea` | |
| `email` | `Input` | `email` |
| `url` | `Input` | `url` |
| `integer` | `Input` | `number`, bước 1 |
| `number`, `decimal` | `Input` | `number` |
| `boolean` | `Switch` | |
| `date` | `Input` | `date` |
| `datetime` | `Input` | `datetime-local` |
| `enum` | `Select` | Lựa chọn tĩnh từ `enumValues` |
| `relation` (`many: false`) | `Select` | Lựa chọn từ dữ liệu của entity liên quan |
| `image` | `Input` | `url` (tải ảnh lên nằm ngoài phạm vi: phụ thuộc backend) |
| `id`, `json`, `relation many` | Không sinh ô nhập | |

`required` của field sang `required` của ô nhập. Nhãn ô nhập lấy từ `label` của field.

---

### 8.4. Tùy chọn dữ liệu của Table và List

```ts
// Bổ sung vào content của Table, List (SPEC-03 mục 4.4)
type DataOptions = {
  readonly searchable?: boolean;               // hiện ô tìm kiếm phía trên
  readonly searchPlaceholder?: string;
  readonly pageSize?: number;                  // 5..100, khi endpoint có phân trang hoặc phân trang phía client
  readonly sortableColumns?: readonly string[];   // id cột (Table)
};
```

| Mã | Quy tắc |
|---|---|
| R-DB-04 | Endpoint có tham số tìm kiếm/sắp xếp/phân trang (R-XO-02, R-XO-03): tìm kiếm, sắp xếp, phân trang **phía server**. Không có: thực hiện **phía client** trên dữ liệu đã tải, kèm cảnh báo trong Inspector "Tìm kiếm phía trình duyệt, chỉ trên trang dữ liệu hiện tại" |
| R-DB-05 | Ô tìm kiếm và điều khiển phân trang là phần tử do Table/List tự sinh (không phải node riêng), style theo token |

---

### 8.5. Trạng thái dữ liệu

Mọi node dữ liệu (`Table`, `List`, `DetailView`) có 4 trạng thái. Nhóm "Dữ liệu" của Inspector có bộ chọn **trạng thái xem trên Canvas**:

| Trạng thái | Canvas hiển thị | Nội dung tùy chỉnh |
|---|---|---|
| Có dữ liệu | Dữ liệu mẫu (mục 9) | |
| Đang tải | Khung xương (skeleton) theo hình dạng cột/thẻ | `loadingText` |
| Rỗng | `emptyText` | `emptyText` |
| Lỗi | Thông báo lỗi + nút "Thử lại" | `errorText` |
| Không tìm thấy (chỉ `DetailView`) | Thông báo | `notFoundText` |

Code xuất ra có đủ các trạng thái này (11.4).

---

## 9. M-MK — DỮ LIỆU MẪU

`generateMockRecords(entity, count, seed, locale)` trong `@reactcraft/model/mock` (SPEC-03 mục 6).

| `FieldType` | Sinh giá trị |
|---|---|
| `id` | 1, 2, 3… (hoặc UUID xác định theo seed nếu kiểu gốc là uuid) |
| `string` | Theo tên field: `name`/`title` → tên sản phẩm/người theo `locale`; `phone` → số điện thoại theo `locale`; `address` → địa chỉ; `code`/`sku` → mã chữ số; còn lại → cụm từ ngắn |
| `text` | 1–2 câu theo `locale` |
| `email` | `<tên không dấu>@example.com` |
| `url` | `https://example.com/<slug>` |
| `integer`, `number` | Trong khoảng hợp lý theo tên (`stock` 0..500, `quantity` 1..20, `age` 18..70) |
| `decimal` | Theo tên: `price` 10.000..5.000.000 khi `locale` là `vi-VN`, 5..500 khi khác |
| `boolean` | Tỷ lệ 70% `true` |
| `date`, `datetime` | Trong 365 ngày gần mốc cố định 2026-01-01 (không dùng ngày hiện tại, để xác định) |
| `enum` | Lần lượt theo `enumValues` |
| `image` | Ảnh SVG giữ chỗ dạng data URI (gradient theo seed), không tải từ mạng |
| `relation` | Bản ghi mẫu của entity liên quan (lấy trường tên) |

| Mã | Quy tắc |
|---|---|
| R-MK-01 | Cùng (entity, count, seed, locale) cho cùng kết quả. Bộ dữ liệu tên, từ ngữ đóng gói trong model, không phụ thuộc thư viện bên ngoài |
| R-MK-02 | Số bản ghi mặc định: Table 5, List 3 (khớp SPEC-04.1 mục 7.2, 7.4), có thể đổi 1..20 trong Inspector (chỉ ảnh hưởng Canvas) |

---

## 10. M-LP — DỮ LIỆU THẬT TRONG XEM THỬ

Ở chế độ Xem thử (SPEC-04.1 mục 7.7), người dùng có thể bật **"Dùng API thật (chỉ đọc)"** khi catalog có `baseUrl`.

```text
Canvas (Xem thử) ─► GET /api/v1/data-proxy?endpointId=…&params=…
                    Server ─► GET <baseUrl><path>  (chỉ endpoint list/detail)
                    ◄── JSON, đã cắt tối đa 100 bản ghi
```

| Mã | Quy tắc |
|---|---|
| R-LP-01 | Proxy **chỉ** gọi tới host của `baseUrl` trong catalog. Đường dẫn ghép từ endpoint đã biết, không nhận URL tùy ý (chống SSRF) |
| R-LP-02 | **Chỉ** method `GET` của endpoint `list`, `detail`. Tạo, sửa, xóa trong Xem thử luôn **giả lập** trên dữ liệu đã tải |
| R-LP-03 | Xác thực: người dùng nhập token thử nghiệm trong hộp thoại của Xem thử, token chỉ giữ trong bộ nhớ server cho phiên đó, không ghi xuống disk, không vào log |
| R-LP-04 | Timeout 10 s. Phản hồi tối đa 5 MB. Lỗi upstream trả E022 với `params.status` |
| R-LP-05 | Phản hồi được bóc vỏ bọc theo R-XO-02 trước khi trả về Canvas |
| R-LP-06 | Tắt "Dùng API thật": Canvas quay về dữ liệu mẫu |

---

## 11. M-DL — SINH LỚP DỮ LIỆU KHI XUẤT CODE

### 11.1. File sinh ra

| File | Nội dung |
|---|---|
| `src/reactcraft/api/client.ts` | `apiFetch()`: ghép `API_BASE_URL`, JSON, gắn xác thực, `AbortSignal`, ném `ApiError` khi `!response.ok` |
| `src/reactcraft/api/auth.ts` | Chỉ khi `auth.kind ≠ 'none'`: hàm `getAuthToken()` có sẵn cách đọc từ `localStorage` khóa `auth_token`, kèm comment hướng dẫn developer thay bằng cơ chế đăng nhập thật |
| `src/reactcraft/api/types.ts` | Kiểu entity (`Product`), kiểu tạo/sửa (`ProductInput`, bỏ field `readOnly`), kiểu trang dữ liệu (`Page<T>`) |
| `src/reactcraft/api/<entity>.ts` | Hàm theo endpoint có trong catalog **và được dùng** trong thiết kế: `listProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct` |
| `src/reactcraft/hooks/use-<entity>-list.ts`, `use-<entity>.ts` | Hook lấy dữ liệu (11.2) |
| `src/reactcraft/confirm.tsx` | Chỉ khi có `deleteRecord`: `ConfirmProvider` + `useConfirm()` dùng `<dialog>` |
| `.env.example` | `VITE_API_BASE_URL=<baseUrl>` |

Tên file theo `fileNaming` của project (SPEC-04.2 mục 6.1). Project JavaScript: đuôi `.js`/`.jsx`, không có `types.ts`.

`API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '<baseUrl của catalog>'`.

---

### 11.2. Hook lấy dữ liệu

| Điều kiện | Cách sinh |
|---|---|
| Project đã có `@tanstack/react-query` | Hook dùng `useQuery` / `useMutation`, `queryKey` theo entity + tham số |
| Không có | Hook tự viết bằng `useState` + `useEffect` + `AbortController`, trả `{ data, isLoading, error, refetch }`. **Không** thêm thư viện (R-CG-04) |

Ví dụ hook tự viết:

```ts
// Generated by ReactCraft. Manual edits will be detected on the next export.
export function useProductList(params: ProductListParams) {
  const [state, setState] = useState<ListState<Product>>({ data: undefined, isLoading: true, error: undefined });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, isLoading: true, error: undefined }));
    listProducts(params, controller.signal)
      .then((data) => setState({ data, isLoading: false, error: undefined }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ data: undefined, isLoading: false, error });
      });
    return () => controller.abort();
  }, [params.page, params.search, params.ordering, version]);

  return { ...state, refetch: () => setVersion((v) => v + 1) };
}
```

---

### 11.3. Bóc vỏ phản hồi và phân trang

| Kiểu phân trang / vỏ bọc | Hàm `list…` trả về |
|---|---|
| Không phân trang, mảng thuần | `{ items: T[] }` |
| `page` (DRF: `count`, `next`, `previous`, `results`) | `{ items, total: count, page, hasNext }` |
| `offset` | `{ items, total, offset, limit }` |
| `cursor` | `{ items, nextCursor }` |
| Vỏ bọc `data`/`items`/`content` | Lấy mảng từ khóa tương ứng đã ghi khi quét |

---

### 11.4. Sử dụng trong trang

| Node | Code trong component trang |
|---|---|
| `Table`, `List` | Gọi hook danh sách với state `page`, `search`, `ordering`. Render 4 trạng thái (8.5). Ô tìm kiếm có debounce 300 ms |
| `DetailView` | `const { id } = useParams()` (react-router) hoặc đọc từ URL; gọi hook chi tiết; xử lý trạng thái "không tìm thấy" khi lỗi 404 |
| Field binding | `{formatCurrency(record.price)}`, `{formatDate(record.createdAt)}`: hàm định dạng sinh trong `src/reactcraft/format.ts` dùng `Intl` với `contentLocale` |
| `Form` tạo/sửa | `onSubmit`: đọc `FormData`, chuyển kiểu theo `FieldType` (số, boolean, ngày), gọi `create…`/`update…`. Form sửa tải bản ghi trước và điền giá trị mặc định. Thành công: chạy tương tác `submitSuccess`. Lỗi: chạy `submitError`, hiển thị lỗi theo field nếu backend trả lỗi dạng `{ field: [messages] }` (DRF) hoặc `{ errors: [{ path, message }] }` |
| `Select` từ dữ liệu | Gọi hook danh sách của entity liên quan, `pageSize` 100 |
| `refreshData` | Gọi `refetch()` của hook gắn với node đích |
| `deleteRecord` | `if (await confirm({ title, message })) { await delete…(record.id); refetch(); }`. Lỗi: toast lỗi |

| Mã | Quy tắc |
|---|---|
| R-DL-01 | Lớp dữ liệu chỉ chứa **logic dữ liệu**. Component dùng chung (User Component) **không** gọi hook dữ liệu; trang gọi hook rồi truyền dữ liệu xuống qua props (FR-33) |
| R-DL-02 | User Component có node gắn field trong ngữ cảnh bản ghi nhận prop `item` có kiểu entity (`item: Product`). Instance trong mẫu của `List` truyền `item={record}` |
| R-DL-03 | `baseUrl` khác origin với dev server: kế hoạch xuất thêm **bước thủ công** gợi ý cấu hình `server.proxy` trong `vite.config` (kèm đoạn code) hoặc bật CORS ở backend |
| R-DL-04 | Mọi hàm API nhận `AbortSignal`. Không có `console.log` trong code sinh ra |
| R-DL-05 | Golden test cho mỗi tổ hợp: có/không react-query × TypeScript/JavaScript × kiểu phân trang × `auth` |

---

## 12. CẬP NHẬT SPEC-03

| Chỗ | Thay đổi |
|---|---|
| `EntityField`, `Endpoint` | Thêm `stale?: boolean` (R-DC-04). `Endpoint.params[]` thêm `role?: 'search' \| 'sort' \| 'page' \| 'pageSize' \| 'offset' \| 'limit' \| 'cursor'`. `Endpoint` thêm `responseEnvelope?: 'none' \| 'results' \| 'data' \| 'items' \| 'content'` |
| `DataSourceCatalog` | Thêm `auth: { kind: 'none' \| 'bearer' \| 'header' \| 'cookie'; headerName?: string }` (mặc định `none`) |
| `ScanResult` | Thêm `auth` gợi ý |
| `Input.inputType` | Thêm `'datetime-local'` |
| `ContentProps` | `Table`, `List` thêm `dataOptions?: DataOptions`, `loadingText?`, `errorText?`. `DetailView` đổi từ `kind: 'none'` sang `kind: 'detail'` với `loadingText?`, `errorText?`, `notFoundText?`. `Select` thêm `optionsFrom?: { endpoint: EndpointId; valueField: string; labelField: string }` |
| Bảng khóa binding | `Select` thêm khóa `options` |
| API | Thêm `GET /data-proxy?endpointId=&params=` (mục 10). `PATCH /data-sources` sửa được cả `baseUrl` và `auth` |
| Mã lỗi | Thêm E022 Upstream API Error (502, thử lại được, `params.status`) |

---

## 13. TIÊU CHÍ KIỂM THỬ

### 13.1. Fixture backend

| Fixture | Nội dung |
|---|---|
| `openapi/` | Swagger 2.0, OpenAPI 3.0, 3.1 (JSON, YAML), có `$ref` vòng, vỏ bọc phân trang, `securitySchemes` |
| `express-prisma/` | Express + Router lồng 2 cấp + Prisma (Product, Category, quan hệ, enum) |
| `express-mongoose/` | Express + Mongoose |
| `nestjs-typeorm/` | NestJS + TypeORM + DTO `class-validator`, global prefix |
| `django-drf/` | Django + DRF: `ModelViewSet`, router, `include` qua 2 app, `PageNumberPagination`, `SearchFilter`, `TokenAuthentication` |
| `django-functions/` | `@api_view`, generics |
| `spring-boot/` | Chỉ để kiểm tra cảnh báo "không có bộ trích xuất" |
| Mọi fixture | Có file `.env` chứa chuỗi đánh dấu giả `RC_SECRET_MARKER_*` |

---

### 13.2. Kiểm thử

| Loại | Nội dung | AC |
|---|---|---|
| Unit/golden | Mỗi bộ trích xuất trên fixture tương ứng cho đúng entity, field, kiểu, quan hệ, endpoint, phân trang, xác thực | AC-04 |
| Unit | Gộp nhiều nguồn đúng ưu tiên. Giữ `stale` khi đang được dùng | R-DC-04 |
| Bảo mật | Chuỗi `RC_SECRET_MARKER_*` không xuất hiện trong: kết quả quét, catalog, cache, ngữ cảnh AI, log, phản hồi API, đoạn mã R-DC-03 | AC-13 |
| Bảo mật | Proxy từ chối host khác `baseUrl`, method khác `GET`, endpoint không có trong catalog | R-LP-01, R-LP-02 |
| E2E | Kéo entity `Product` vào Canvas, chọn "Bảng danh sách": 4 cột đúng kiểu, dữ liệu mẫu theo `vi-VN` | AC-05 |
| E2E | Trang CRUD đầy đủ: Xem thử thêm/sửa/xóa trên dữ liệu mẫu. Xuất code, chạy với backend fixture Django thật trong CI: danh sách, tạo, sửa, xóa hoạt động | AC-08, AC-14 |
| E2E | Xem thử với "Dùng API thật" gọi backend fixture qua proxy | R-LP |
| Hiệu năng | Quét fixture nhân bản 2.000 file ≤ 10 s, quét lại sau khi đổi 1 file ≤ 1 s | NFR-04 |

---

## 14. TRUY VẾT

| Yêu cầu | Mục |
|---|---|
| FR-04 Liên kết backend | 1.2, 2 |
| FR-17 Backend Scan | 2 đến 6 |
| FR-18 Data Source Catalog | 7 |
| FR-19 Data Binding | 8 |
| FR-20 Dữ liệu mẫu | 9, 10 |
| FR-21 Loại trừ secrets | R-BS-02, R-XA-02, 13.2 |
| FR-34 Sinh lớp dữ liệu | 11 |
| FR-39 Tương tác dữ liệu | 11.4 (`refreshData`, `deleteRecord`, `submitSuccess/Error`) |
| NFR-04 | R-BS-07 |
| SEC-02, SEC-05 | R-BS-01, R-BS-02, R-LP |
| AC-04, AC-05, AC-07, AC-13 | 13 |

---

## 15. CÂU HỎI MỞ

Không có. Framework backend chưa có bộ trích xuất riêng (Spring Boot, Laravel, FastAPI…) được hỗ trợ qua OpenAPI, AI hoặc nhập thủ công. Thêm bộ trích xuất mới là mở rộng theo cùng khuôn ở mục 4, 5.

---

# SPEC-04.5 — USER COMPONENT & DESIGN TOKEN

**Thuộc:** SPEC-04 — Đặc tả module  
**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0 (FR-11, FR-13, FR-33, FR-39, FR-41, AC-12, AC-16), SPEC-03 (mục 3.4, 3.6, 4.3, 6a, 7), SPEC-04.1, SPEC-04.2 (mục 6.3, 8), SPEC-04.4 (R-DL-02)  
**Phạm vi:** Tạo, sửa, dùng, tách, xóa User Component; quản lý Design Token, nhập token từ Target Project; gợi ý tách layout dùng chung

---

## 1. DANH SÁCH MODULE

| Mã | Tên | Nơi chạy | Mục |
|---|---|---|---|
| M-UC | Vòng đời User Component | Studio + Model | 2 đến 6 |
| M-TM | Quản lý Design Token | Studio + Model | 7 |
| M-TI | Nhập token từ Target Project | Server | 8 |
| M-LS | Gợi ý tách layout dùng chung | Model + Studio (Web Worker) | 6a |

---

## 2. M-UC — TẠO COMPONENT TỪ VÙNG CHỌN

### 2.1. Điều kiện

| Mã | Quy tắc |
|---|---|
| R-UC-01 | Vùng chọn là **một** node, hoặc nhiều node anh em liền kề (khi đó tự bọc bằng `Stack` theo hướng của cha trước khi tạo) |
| R-UC-02 | Vùng chọn nằm trong cây của một **trang** (không tạo component lồng từ bên trong định nghĩa component khác) |
| R-UC-03 | Vùng chọn không phải root của trang, không chứa `Modal`, `Section` ở cấp ngoài cùng (vì V-11, V-12 không cho đặt chúng trong component dùng ở vị trí tùy ý) |

---

### 2.2. Trình hướng dẫn "Tạo component"

Người dùng bấm "Tạo component" (menu chuột phải, phím `Mod+Alt+K`). Studio phân tích vùng chọn và hiện hộp thoại:

```text
┌─ Tạo component ─────────────────────────────────────────────────────┐
│ Tên: [ProductCard        ]  (PascalCase, không trùng)                │
│                                                                     │
│ Thuộc tính (props) đề xuất:                                         │
│  ☑ title      text    "Áo thun basic"      (Heading "Tên")          │
│  ☑ imageSrc   image   asset:ao-thun.png    (Image "Ảnh")            │
│  ☐ price      text    "199.000 ₫"          (Text "Giá")             │
│                                                                     │
│ Slot đề xuất:                                                       │
│  ☑ actions    Stack "Nút thao tác" — có tương tác, phải là slot     │
│                                                                     │
│ Dữ liệu: các node gắn field của "Product" → component nhận `item`   │
│                                                                     │
│ Thay thế vùng chọn bằng instance của component mới  ☑               │
│                                         [Hủy]  [Tạo component]      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.3. Thuật toán phân tích

| Bước | Xử lý |
|---|---|
| 1 | **Đề xuất props:** mỗi `Text`, `Heading` không có binding → prop `text`. Mỗi `Image` không có binding → prop `image` (`src`) và prop `text` cho `alt` (tên `<tên>Alt`), chọn và bỏ chọn cùng nhau. Mỗi `Link` không có binding → prop `link` (`href`). Tên prop từ tên lớp (camelCase, không dấu), trùng thì thêm số. Mặc định **chọn** Heading, Image; **không chọn** Text, Link |
| 2 | **Slot bắt buộc:** node trong vùng chọn có `interactions`, hoặc là **đích** của tương tác ở nơi khác trong trang, **không thể** nằm trong định nghĩa component (V-91, V-92). Với mỗi node như vậy: đề xuất container gần nhất chỉ chứa nó (hoặc chính nó) làm slot. Người dùng không bỏ chọn được, chỉ đổi tên |
| 3 | **Slot tùy chọn:** container trong vùng chọn có từ 1 con trở lên và tên lớp gợi ý vùng nội dung (`actions`, `footer`, `content`, `body`, `extra`) → đề xuất slot, mặc định không chọn |
| 4 | **Dữ liệu:** node có binding `field` trong ngữ cảnh bản ghi (V-31) → component có `recordEntity` = entity của ngữ cảnh, binding được giữ trong định nghĩa |
| 5 | **Chặn:** vùng chọn chứa `ComponentInstance` của chính component đang tạo (không thể xảy ra khi tạo mới) hoặc node đích của tương tác không thể tách thành slot (ví dụ `Tabs` bị `switchTab` từ ngoài) → báo lý do, không cho tạo |

---

### 2.4. Batch sinh ra

Bấm "Tạo component" tạo **một batch** (một bước Undo):

```text
1. component.create {
     id: c_…, name, props (từ bước 1 đã chọn),
     recordEntity (bước 4, nếu có),
     root: bản sao vùng chọn với ID mới;
           node được chọn làm prop: nội dung giữ làm giá trị mặc định;
           node được chọn làm slot: thay bằng node Slot { name }
   }
2. (nếu "Thay thế vùng chọn" được chọn)
   remove  vùng chọn gốc
   insert  ComponentInstance tại đúng vị trí cũ {
     content.propValues = giá trị hiện tại của các prop,
     slots = { <tên slot>: [node gốc tương ứng, GIỮ NGUYÊN ID] }
   }
```

| Mã | Quy tắc |
|---|---|
| R-UC-04 | Node đưa vào `slots` **giữ nguyên ID**, nên mọi tương tác trỏ tới chúng vẫn hợp lệ |
| R-UC-05 | Batch phải qua `applyBatch` (SPEC-03 mục 7.4). Lỗi: không áp dụng gì, báo quy tắc vi phạm |

---

## 3. M-UC — CHẾ ĐỘ SỬA COMPONENT

| Mã | Quy tắc |
|---|---|
| R-UC-06 | Mở bằng: double-click instance, menu "Sửa component", hoặc chọn trong Library → "Component của tôi". Canvas render `UserComponent.root` với giá trị mặc định của props, thanh trên hiện "Đang sửa component **ProductCard** · dùng ở 6 nơi · [← Quay lại trang]" |
| R-UC-07 | Mọi operation dùng `target = { kind: 'component', componentId }`. Thay đổi hiện ngay ở mọi instance khi quay lại trang |
| R-UC-08 | Trong chế độ này: mục Tương tác của Inspector bị ẩn (V-91). Thêm `Slot` từ Library (mục riêng "Slot" chỉ hiện ở chế độ này) |
| R-UC-09 | Bảng "Props" trong Inspector (khi chọn root): thêm, đổi tên, đổi giá trị mặc định, xóa prop; gắn prop vào node (chọn node `Text`/`Heading`/`Image`/`Link` → "Lấy nội dung từ prop …") |
| R-UC-10 | Khung xem: dùng các khung của workspace. Thêm tùy chọn "Độ rộng vùng chứa" (ví dụ 320 px) để xem component như khi nằm trong lưới |

---

### 3.1. Gắn prop vào node

```ts
// Bổ sung vào DesignNode trong định nghĩa component (SPEC-03 mục 3.6)
readonly propRef?: {
  readonly prop: string;                       // tên prop
  readonly target: 'text' | 'src' | 'href' | 'alt';   // trường nội dung nhận giá trị
};
```

| Mã | Quy tắc |
|---|---|
| R-UC-11 | `propRef` chỉ có trong `UserComponent.root`. `target` khớp loại node: `text` cho Text/Heading/Button/Link, `src` và `alt` cho Image, `href` cho Link. `src` nhận prop kiểu `image`, `href` nhận prop kiểu `link`, `text` và `alt` nhận prop kiểu `text` |
| R-UC-12 | Node có `propRef` không có binding cho cùng trường |
| R-UC-13 | Trên Canvas của trang: instance hiển thị `propValues[prop]`, thiếu thì dùng `defaultValue` |

---

### 3.2. Đổi props, slot khi đã có instance

| Thay đổi | Xử lý với instance (cùng batch) |
|---|---|
| Thêm prop | Không đổi. Instance dùng `defaultValue` |
| Đổi tên prop | `setContent` mọi instance: đổi khóa trong `propValues` |
| Xóa prop | `setContent` mọi instance: bỏ khóa. Node có `propRef` tới prop đó: gỡ `propRef`, giữ nội dung hiện tại |
| Thêm slot | Không đổi. Slot rỗng ở mọi instance |
| Đổi tên slot | Đổi khóa trong `slots` của mọi instance (operation `move` các node sang khóa mới) |
| Xóa slot | Hộp thoại: nội dung slot ở các instance được **chuyển ra ngay sau instance** hoặc **xóa** (người dùng chọn). Xóa không được nếu nội dung đó là đích tương tác (V-98) |

---

## 4. M-UC — DÙNG COMPONENT

| Mã | Quy tắc |
|---|---|
| R-UC-14 | Library có nhóm "Component của tôi": tên, ảnh thu nhỏ, số lần dùng. Kéo vào Canvas → `insert` `ComponentInstance` với `propValues` rỗng |
| R-UC-15 | Ảnh thu nhỏ chụp bằng `html-to-image` khi component thay đổi (debounce 2 s), lưu trong `.reactcraft/cache/thumbnails/`, không nằm trong Design Document |
| R-UC-16 | Inspector của instance: nhóm "Component" gồm tên component (bấm để sửa), các ô nhập prop theo kiểu (`text`, `image` có tải ảnh, `link`), danh sách slot (bấm để chọn slot trên Canvas) |
| R-UC-17 | Instance có thể đặt style vị trí trong cha (`grow`, `alignSelf`, `colSpan`, `width`, `margin`, `display` theo breakpoint). Style khác thuộc về định nghĩa component |
| R-UC-18 | Instance của component có `recordEntity` chỉ đặt được trong ngữ cảnh bản ghi cùng entity (mẫu của `List`, `DetailView`). Ngoài ngữ cảnh: Canvas dùng bản ghi mẫu, cảnh báo "Cần đặt trong danh sách hoặc chi tiết của Product" |

---

## 5. M-UC — TÁCH, NHÂN BẢN, XÓA

| Thao tác | Batch |
|---|---|
| **Tách khỏi component** (instance → node thường) | `remove` instance + `insert` bản sao `root` của component (ID mới) với `propValues` đã thay vào, node trong `slots` được đặt vào vị trí `Slot` (**giữ ID**), `propRef` bị bỏ |
| **Nhân bản component** | `component.create` bản sao với tên `<Tên>Copy`, ID mới |
| **Xóa component** | Không còn instance: `component.delete`. Còn instance (V-48): hộp thoại "Tách tất cả N instance rồi xóa" tạo batch gồm mọi thao tác tách + `component.delete` |
| **Đổi tên component** | `component.update { name }`. Code xuất ra đổi tên file và mọi import ở lần xuất kế tiếp (file cũ thành `orphaned`, SPEC-04.2 mục 10.2) |

---

## 6. QUYẾT ĐỊNH THIẾT KẾ CHO COMPONENT

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Biến thể (variants) kiểu Figma | **Không** có biến thể trong một component. Dùng prop, slot, hoặc component riêng | Biến thể cần style có điều kiện, làm phức tạp Design Model và code xuất ra. `Button` đã có `variant` sẵn |
| Component lồng component | **Có**: định nghĩa component chứa instance của component khác, không đệ quy (V-17) | Cần cho card chứa avatar, badge… |
| Tương tác trong component | **Không** (V-91). Tương tác đặt ở instance hoặc nội dung slot | Giữ component chỉ có layout, logic ở trang (FR-33) |
| Component có dữ liệu | Có, qua `recordEntity` và prop `item` khi xuất (SPEC-04.4 R-DL-02). Component **không** tự gọi API | FR-33 |

---

## 6a. M-LS — GỢI Ý TÁCH LAYOUT DÙNG CHUNG

### 6a.1. Mục đích

Tìm các cụm node có **cùng cấu trúc layout** lặp lại ở nhiều nơi trong workspace (ví dụ card sản phẩm ở trang bán hàng và trang quản lý) và đề xuất tách thành User Component (FR-41). Phần khác nhau giữa các nơi (chữ, ảnh, liên kết) thành props. Phần có tương tác thành slot. Logic vẫn ở trang (FR-33).

---

### 6a.2. Quyết định thiết kế

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Cách phát hiện | **Thuật toán so khớp cấu trúc**, không dùng AI | Chính xác, lặp lại được, chạy offline, không tốn token, không gửi thiết kế ra ngoài. AI không thấy được toàn workspace trong ngân sách ngữ cảnh (SPEC-04.3 mục 3.1) |
| Đặt tên | Theo quy tắc từ tên lớp (6a.6), người dùng sửa trong trình hướng dẫn | Như M-UC (mục 2.3) |
| Áp dụng | Luôn qua trình hướng dẫn của M-UC, người dùng duyệt | Người dùng luôn là người quyết định thay đổi thiết kế, cùng nguyên tắc với đề xuất của AI (SRS mục 6.6) |
| Nơi chạy | Thuật toán là hàm thuần trong `@reactcraft/model/analysis`, chạy trong **Web Worker** của Studio | Không chặn luồng giao diện; không cần endpoint mới |

---

### 6a.3. Kích hoạt

| Mã | Quy tắc |
|---|---|
| R-LS-01 | Mở bằng nút "Gợi ý component" trong nhóm "Component của tôi" của Library, hoặc lệnh "Gợi ý component" trong bảng lệnh |
| R-LS-02 | Khi bảng gợi ý đang mở: tính lại sau mỗi lần `workspace.saved` (debounce 2 s). Khi đóng: không chạy |
| R-LS-03 | Tính trên **revision** hiện tại. Kết quả mang `revision`. Revision đổi trong lúc tính: bỏ kết quả, tính lại |

---

### 6a.4. Chữ ký cấu trúc

Mỗi node trong cây **trang** (không tính định nghĩa User Component) có hai giá trị băm, tính từ lá lên gốc:

```text
shapeHash(n) = hash( n.type,
                     khóa cấu trúc của content (bảng 6a.4.1),
                     có interactions? (true/false),
                     runtime.initiallyHidden,
                     [shapeHash(c) cho từng con c theo thứ tự],
                     slots của ComponentInstance theo tên )

fullHash(n)  = hash( shapeHash(n),
                     style chuẩn hóa của n (mọi scope),
                       trừ khóa vị trí của gốc cụm (R-UC-17),
                     binding của n (key, entity, field — không gồm giá trị mẫu),
                     [fullHash(c) cho từng con c] )
```

#### 6a.4.1. Thành phần tham gia và không tham gia

| Thành phần | `shapeHash` | `fullHash` | Ghi chú |
|---|---|---|---|
| `type`, thứ tự con, số con | Có | Có | |
| Trường nội dung **làm được prop**: chữ của `Text`, `Heading`, `Button`, `Link` (`text`, `runs`), `Image.src`, `Image.alt`, `Link.href` | Không | Không | Phần khác nhau → prop (6a.8) |
| Mọi trường nội dung khác (ví dụ `Heading.level`, `Text.as`, `Button.variant`, `Icon.name`, `Image.fit`, nhãn và `fieldName` của ô nhập, `options`, cột bảng, mục `Tabs`, `Container.maxWidth`) | Có | Có | Không truyền qua prop được nên phải giống nhau |
| `name`, `id`, `hidden`, `locked` | Không | Không | Metadata, không ảnh hưởng hiển thị |
| `interactions` (nội dung) | Không | Không | Chỉ việc **có** hay không có tham gia `shapeHash`. Node có tương tác thành slot (6a.6) |
| Style | Không | Có | Đã chuẩn hóa (SPEC-03 mục 5), giá trị token so theo tên token |
| Khóa vị trí của **gốc** cụm (`grow`, `alignSelf`, `colSpan`, `width`, `margin`, `display` theo breakpoint) | Không | Không | Giữ ở instance (R-UC-17) |
| Binding | Không | Có | Hai cụm khác entity không gộp được (R-LS-07) |
| `ComponentInstance` | `componentId`, tên các khóa `propValues` | Như `shapeHash` | Không đi vào bên trong định nghĩa |

| Mã | Quy tắc |
|---|---|
| R-LS-04 | Hàm băm: FNV-1a 64 bit trên chuỗi JSON chuẩn hóa (`serializeCanonical`, SPEC-04.1 mục 3.3) của bộ thành phần, không cần thư viện. Hai cụm chỉ được coi là trùng khi so sánh lại cấu trúc đầy đủ sau khi trùng băm (tránh va chạm) |

---

### 6a.5. Ứng viên

**Nhóm ứng viên** là tập các cụm (cây con) có cùng `shapeHash`, thỏa mọi điều kiện:

| Mã | Điều kiện |
|---|---|
| R-LS-05 | Có từ **2** cụm trở lên, trên một hoặc nhiều trang |
| R-LS-06 | Mỗi cụm có **≥ 3 node** và chứa ít nhất một node nội dung (`Text`, `Heading`, `Image`, `Button`, `Link`, `Icon`) |
| R-LS-07 | Mọi cụm có cùng ngữ cảnh dữ liệu: cùng không có binding, hoặc cùng nằm trong ngữ cảnh bản ghi của **cùng** entity (V-31) |
| R-LS-08 | Gốc cụm thỏa R-UC-01 đến R-UC-03 (không phải root của trang, không phải `Modal`, `Section`), không nằm trong `Slot` của instance khác, bản thân không phải `ComponentInstance` |
| R-LS-09 | Các cụm trong nhóm không lồng nhau. Hai cụm lồng nhau: giữ cụm ngoài |
| R-LS-10 | Không có node nào trong cụm là đích tương tác không tách được thành slot (bước 5 của R-UC, mục 2.3) |
| R-LS-11 | **Tính cực đại:** nhóm A bị loại nếu mọi cụm của A nằm trong một cụm của nhóm B có **cùng số cụm** (giữ cụm lớn hơn) |
| R-LS-12 | Nhóm có cụm đã bị người dùng "Bỏ qua" (6a.7) với cùng `fullHash`: không hiển thị |

**Loại khớp** của nhóm:

| Loại | Điều kiện | Hiển thị |
|---|---|---|
| `exact` | Mọi cụm cùng `fullHash` | "Giống hệt" |
| `similar` | Cùng `shapeHash`, khác `fullHash`, tổng số khác biệt style giữa mỗi cụm và cụm tham chiếu ≤ **5** cặp (node, thuộc tính, scope) | "Gần giống — khác N thuộc tính" |

Nhóm khác nhiều hơn 5 thuộc tính style: không phải ứng viên.

---

### 6a.6. Xếp hạng và trình bày

```text
điểm = (số cụm − 1) × số node của một cụm
xếp theo: điểm giảm dần → exact trước similar → tên trang, vị trí trong cây
hiển thị tối đa 20 nhóm
```

Bảng gợi ý:

```text
┌─ Gợi ý component ──────────────────────────────────────────────┐
│ ▣ [ảnh]  Card "Sản phẩm"         Giống hệt                     │
│          Lặp lại 6 lần ở 2 trang · 7 node                      │
│          [Xem vị trí]  [Tạo component]  [Bỏ qua]               │
│ ▣ [ảnh]  Stack "Thông tin liên hệ"  Gần giống — khác 2 thuộc tính│
│          Lặp lại 3 lần ở 3 trang · 4 node                      │
│          [Xem vị trí]  [Tạo component]  [Bỏ qua]               │
└────────────────────────────────────────────────────────────────┘
```

| Mã | Quy tắc |
|---|---|
| R-LS-13 | Tên hiển thị của nhóm: tên lớp của cụm đầu tiên (theo thứ tự trang, rồi thứ tự trong cây) |
| R-LS-14 | "Xem vị trí": chọn mọi cụm trên trang hiện tại, Layer Tree mở tới chúng; danh sách bên dưới liệt kê cụm ở trang khác, bấm để chuyển trang và chọn |
| R-LS-15 | Ảnh thu nhỏ: chụp cụm đầu tiên bằng `html-to-image` như R-UC-15 |

---

### 6a.7. Bỏ qua

| Mã | Quy tắc |
|---|---|
| R-LS-16 | "Bỏ qua" lưu `fullHash` của các cụm vào `.reactcraft/cache/layout-suggest-dismissed.json` (không thuộc Design Document, không ảnh hưởng xuất code). Nút "Hiện cả gợi ý đã bỏ qua" ở cuối bảng |

---

### 6a.8. Tạo component từ gợi ý

"Tạo component" mở trình hướng dẫn của M-UC (mục 2.2) với các điểm khác:

| Mục | Xử lý |
|---|---|
| Cụm tham chiếu | Mặc định cụm đầu tiên. Nhóm `similar`: người dùng chọn cụm tham chiếu; hộp thoại liệt kê mọi khác biệt, ví dụ "Trang Quản lý, Card 3: padding 6 → 4", kèm cảnh báo "Các vị trí khác sẽ dùng style của cụm tham chiếu" |
| Props | Bước 1 của mục 2.3 áp dụng trên cụm tham chiếu. Thêm: trường nội dung có giá trị **khác nhau** giữa các cụm → prop, **bắt buộc chọn** (bỏ chọn sẽ mất nội dung). Giá trị giống nhau ở mọi cụm → mặc định không chọn |
| Slots | Bước 2 của mục 2.3: node có tương tác ở **bất kỳ** cụm nào thành slot bắt buộc |
| Dữ liệu | Bước 4 của mục 2.3 |
| Thay thế | "Thay thế tất cả N vị trí" mặc định bật, có danh sách từng vị trí để bỏ chọn. Phải giữ ít nhất 1 vị trí |

Batch sinh ra (một bước Undo):

```text
1. component.create { root: bản sao cụm tham chiếu, như mục 2.4 bước 1 }
2. với mỗi cụm được chọn thay thế:
     remove cụm
     insert ComponentInstance tại đúng vị trí cũ {
       content.propValues = giá trị của cụm đó cho từng prop,
       slots = { <tên slot>: [node tương ứng của cụm đó, GIỮ NGUYÊN ID] },
       style = khóa vị trí của gốc cụm (R-UC-17)
     }
```

| Mã | Quy tắc |
|---|---|
| R-LS-17 | Batch qua `applyBatch` với `baseRevision` = revision của kết quả gợi ý. E017: báo "Thiết kế đã thay đổi", tính lại gợi ý, không áp dụng gì |
| R-LS-18 | Nhóm `exact`: sau khi áp dụng, cây hiển thị của mỗi vị trí (instance được mở rộng) **tương đương** cây gốc, bỏ qua ID mới (kiểm bằng property test). Nhóm `similar`: tương đương trừ các khác biệt style đã liệt kê |
| R-LS-19 | Node đưa vào slot giữ nguyên ID (R-UC-04), nên tương tác trỏ tới chúng vẫn hợp lệ |

---

### 6a.9. Hiệu năng và lỗi

| Mã | Quy tắc |
|---|---|
| R-LS-20 | PB-20: workspace mẫu lớn (50 trang, 500 node mỗi trang): tính gợi ý ≤ 1 s (P95) trong Web Worker. Luồng giao diện không bị chặn quá 16 ms |
| R-LS-21 | Worker lỗi: toast lỗi E013, bảng gợi ý hiện "Không tính được gợi ý", không thay đổi gì trong thiết kế |
| R-LS-22 | Workspace có trên 50.000 node: chỉ tính trên trang hiện tại và các trang dùng chung User Component với nó, ghi rõ trong bảng |

---

## 7. M-TM — QUẢN LÝ DESIGN TOKEN

### 7.1. Panel Token

Mở từ toolbar (biểu tượng 🎨) hoặc Command palette. Một hộp thoại lớn có tab theo nhóm token:

| Tab | Hiển thị mỗi token | Sửa |
|---|---|---|
| Màu | Ô màu sáng + ô màu tối (khi `darkMode ≠ none`), tên, hex, số lần dùng | Bộ chọn màu (`react-colorful`), ô hex, chọn màu tối |
| Khoảng cách | Thanh minh họa độ dài, tên, px | Ô số |
| Bo góc | Ô vuông minh họa, tên, px | Ô số |
| Bóng | Thẻ minh họa, tên, giá trị CSS | 4 ô: lệch x, lệch y, độ nhòe, độ lan + màu + độ mờ (sinh chuỗi CSS) |
| Chữ | Dòng mẫu "Aa Bb Cc — Tiếng Việt", tên, cỡ/line height | Ô số |
| Độ đậm, line height, font | Mẫu, tên, giá trị | Ô số / danh sách font |

| Mã | Quy tắc |
|---|---|
| R-TM-01 | Thêm token: tên theo mẫu (SPEC-03 mục 2.3), không trùng trong nhóm, không trùng giữa `fontWeight` và `fontFamily` (R-SM-05) |
| R-TM-02 | Sửa giá trị: `token.set`, Canvas cập nhật ngay qua khối `@theme` (R-CV-07) |
| R-TM-03 | Đổi tên: `token.rename` (cập nhật mọi tham chiếu trong một operation) |
| R-TM-04 | Xóa: token còn được dùng (V-47) → hộp thoại "Thay bằng token khác" chọn token thay thế cùng nhóm → `token.replace` rồi `token.delete` trong một batch. Hoặc "Chuyển thành giá trị cứng" → `token.replace` với giá trị `{ px }`/hex |
| R-TM-05 | "Số lần dùng" bấm được: liệt kê node dùng token, bấm để chọn trên Canvas |

---

### 7.2. Kiểm tra độ tương phản

Tab Màu có mục "Cặp màu chữ / nền" tự phát hiện từ thiết kế (node có cả `textColor` và `background` là token, hoặc nền kế thừa từ cha gần nhất):

| Mức | Điều kiện | Hiển thị |
|---|---|---|
| Đạt AAA | ≥ 7:1 | ✓ xanh |
| Đạt AA | ≥ 4,5:1 (chữ thường) hoặc ≥ 3:1 (chữ lớn) | ✓ |
| Không đạt | Thấp hơn | ⚠ kèm danh sách node |

Kiểm tra cả màu sáng và màu tối. Dùng cùng hàm tính với cảnh báo `AIQ-04` (SPEC-04.3).

---

### 7.3. Kiểu chữ mẫu (Text styles)

Inspector nhóm Chữ có danh sách **kiểu chữ mẫu** để áp nhanh nhiều thuộc tính cùng lúc:

| Kiểu | fontSize | fontWeight | lineHeight |
|---|---|---|---|
| Display | `token:fontSize.5xl` | `token:fontWeight.bold` | `token:lineHeight.tight` |
| H1 | `4xl` | `bold` | `tight` |
| H2 | `3xl` | `semibold` | `snug` |
| H3 | `2xl` | `semibold` | `snug` |
| Body | `base` | `normal` | `normal` |
| Small | `sm` | `normal` | `normal` |
| Caption | `xs` | `medium` | `normal` |

| Mã | Quy tắc |
|---|---|
| R-TM-06 | Áp kiểu chữ = **một** `setStyle` đặt 3 thuộc tính. Không tạo liên kết lâu dài: sửa kiểu chữ mẫu sau đó không đổi node đã áp (quyết định: tránh thêm khái niệm "style kế thừa" vào Design Model) |
| R-TM-07 | Token tham chiếu trong kiểu chữ mẫu đã bị xóa: kiểu đó hiển thị mờ, không áp được |

---

## 8. M-TI — NHẬP TOKEN TỪ TARGET PROJECT

### 8.1. Nguồn

| Tailwind | Nguồn đọc (dạng văn bản, R-TP-01) |
|---|---|
| v4 | Khối `@theme { … }` trong file CSS chính và các file CSS nó `@import` (đường dẫn tương đối, tối đa 3 cấp) |
| v3 | `tailwind.config.*`: phân tích bằng oxc, chỉ lấy **object literal tĩnh** trong `theme` và `theme.extend` (`colors`, `spacing`, `borderRadius`, `boxShadow`, `fontSize`, `fontWeight`, `lineHeight`, `fontFamily`). Giá trị là biểu thức (hàm, biến, `require`) bị bỏ qua kèm cảnh báo |

---

### 8.2. Ánh xạ

| Nguồn | Nhóm token |
|---|---|
| `--color-*`, `colors` | `color` (màu lồng `{ blue: { 500: … } }` thành tên `blue-500`) |
| `--spacing-*`, `spacing` | `spacing` |
| `--radius-*`, `borderRadius` | `radius` |
| `--shadow-*`, `boxShadow` | `shadow` |
| `--text-*` (+ `--line-height`), `fontSize` | `fontSize` |
| `--font-weight-*`, `fontWeight` | `fontWeight` |
| `--leading-*`, `lineHeight` | `lineHeight` |
| `--font-*`, `fontFamily` | `fontFamily` |

| Mã | Quy tắc |
|---|---|
| R-TI-01 | Màu dạng `oklch()`, `rgb()`, `hsl()`, tên màu CSS được đổi sang hex (`#rrggbb` hoặc `#rrggbbaa`) bằng `culori`. Màu không đổi được (biến CSS, `currentColor`): bỏ qua, cảnh báo |
| R-TI-02 | Độ dài `rem` đổi sang px theo 1 rem = 16 px. `em`, `%`, `calc()`: bỏ qua, cảnh báo |
| R-TI-03 | Màu tối: v4 khối `@media (prefers-color-scheme: dark)` hoặc `.dark { --color-*: … }` ngay sau; v3 không đọc màu tối (cảnh báo) |
| R-TI-04 | Tên token không hợp lệ được chuẩn hóa (chữ thường, `-`). Trùng sau khi chuẩn hóa: thêm số |

---

### 8.3. Quy trình

```text
Panel Token → [Nhập từ project]
   ↓ server phân tích (≤ 2 s), trả danh sách token đề xuất + cảnh báo
   ↓ Studio hiện bảng: token mới / trùng tên khác giá trị / giống hệt
   │   Trùng tên khác giá trị: chọn "Giữ của workspace" hoặc "Dùng của project"
   ↓ [Nhập N token] → một batch token.set
```

API (bổ sung SPEC-03 mục 10.4):

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| GET | `/target-project/tokens` | Đọc token từ project, không ghi gì | 200 `{ tokens: DesignTokens (một phần), warnings: ErrorDetail[] }` | E021, E001 |

---

## 9. CẬP NHẬT SPEC-03

| Chỗ | Thay đổi |
|---|---|
| `UserComponent` | Thêm `recordEntity?: DataSourceId` |
| `DesignNode` | Thêm `propRef?` (chỉ trong định nghĩa component, mục 3.1), `target` gồm `text`, `src`, `href`, `alt` |
| Operation | Thêm `token.rename { group, from, to }` (đảo: rename ngược) và `token.replace { group, from, with: TokenRef \| giá trị }` (đảo: danh sách node và giá trị cũ được ghi trong operation khi `validate`, để `invert` khôi phục chính xác) |
| Quy tắc | V-56: `propValues` của instance chỉ có khóa là tên prop của component. V-57: `propRef` hợp lệ theo R-UC-11, R-UC-12. V-31 mở rộng: trong định nghĩa component có `recordEntity`, binding `field` hiểu theo entity đó |
| API | `GET /target-project/tokens` |

---

## 10. TIÊU CHÍ KIỂM THỬ

| Loại | Nội dung |
|---|---|
| Unit | Phân tích vùng chọn: đề xuất props, slot bắt buộc khi có tương tác hoặc là đích tương tác, `recordEntity` |
| Property | Tạo component rồi tách instance trả về cây tương đương ban đầu (bỏ qua ID mới, giữ ID nội dung slot) |
| Unit | Đổi tên/xóa prop, slot cập nhật đúng mọi instance |
| Unit | `token.rename`, `token.replace` và `invert` khôi phục chính xác |
| Unit | Nhập token v4 (`@theme`, `oklch`, `rem`, màu tối) và v3 (config tĩnh, bỏ qua biểu thức) |
| E2E | AC-12: tạo `ProductCard` từ card có nút "Thêm vào giỏ" (có tương tác) → nút tự thành slot `actions`; dùng ở trang quản lý với nút Sửa, Xóa; xuất code đúng |
| E2E | Đổi màu token `primary` → mọi node dùng nó đổi màu trên Canvas và trong code xuất ra |
| Unit | M-LS: `shapeHash` bỏ qua trường làm được prop, metadata, khóa vị trí của gốc; `fullHash` phân biệt style và binding; điều kiện R-LS-05 đến R-LS-12, tính cực đại, xếp hạng |
| Property | M-LS: nhóm `exact` sau khi áp dụng, mỗi vị trí mở rộng instance tương đương cây gốc (R-LS-18) với tài liệu sinh ngẫu nhiên có cụm lặp |
| Bench | PB-20 với workspace mẫu lớn |
| E2E | AC-16: 3 card sản phẩm giống nhau ở 2 trang, khác chữ và ảnh, một card có nút có tương tác → gợi ý `exact`, tạo component (chữ, ảnh thành prop, nút thành slot), giao diện không đổi ở khung 375 và 1440, Undo một bước khôi phục |

---

## 11. TRUY VẾT

| Yêu cầu | Mục |
|---|---|
| FR-11 Design Token, nhập từ Tailwind config | 7, 8 |
| FR-13 User Component | 2 đến 6 |
| FR-33 Component chỉ có layout | 2.3 bước 2, 6 |
| FR-39 Tương tác | R-UC-04, R-UC-08 |
| FR-41 Gợi ý tách layout dùng chung | 6a |
| AC-12 | 10 |
| AC-16 | 6a, 10 |

---

# SPEC-05 — BẢO MẬT

**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0 (SEC-01 đến SEC-10, FR-21, FR-27 đến FR-30, AC-13), SPEC-01.1, SPEC-01.2, SPEC-03, SPEC-04.x  
**Phạm vi:** Mô hình mối đe dọa và toàn bộ biện pháp bảo mật của ReactCraft Local: mạng, xác thực phiên, trình duyệt, file system, secrets, AI, tiến trình con, proxy dữ liệu, code xuất ra, workspace không tin cậy, chuỗi cung ứng, kiểm thử bảo mật

---

## 1. MỤC ĐÍCH VÀ NGUYÊN TẮC

### 1.1. Mục đích

ReactCraft chạy trên máy người dùng, đọc mã nguồn, ghi file và mở một cổng mạng local. Phần này xác định **ai có thể tấn công, tấn công vào đâu**, và **biện pháp bắt buộc** cho từng điểm.

Mỗi biện pháp có mã `S-xx`.

---

### 1.2. Nguyên tắc

| Nguyên tắc | Ý nghĩa |
|---|---|
| Mặc định đóng | Mọi thứ bị từ chối trừ khi được cho phép rõ ràng (mạng, đường dẫn, method, tiến trình) |
| Quyền tối thiểu | Backend chỉ đọc. Ghi chỉ trong Workspace và Target Project, chỉ qua đường đã định |
| Không tin dữ liệu vào | Mọi dữ liệu từ trình duyệt, file workspace, mã nguồn backend, đầu ra AI, API thật đều được kiểm tra |
| Người dùng quyết định | Hành động có rủi ro (gửi mã nguồn cho AI, cài dependency, ghi đè file, chạy build) cần xác nhận |
| Không gửi gì ra ngoài nếu người dùng không yêu cầu | Không telemetry, không tự kiểm tra cập nhật |

---

## 2. TÀI SẢN CẦN BẢO VỆ

| Mã | Tài sản | Mức độ |
|---|---|---|
| A-01 | Mã nguồn backend của người dùng (có thể có secrets) | Cao |
| A-02 | Mã nguồn Target Project | Cao |
| A-03 | Workspace (bản thiết kế) | Trung bình |
| A-04 | API key của AI provider | Cao |
| A-05 | Token phiên của Local Backend | Cao |
| A-06 | File system của máy người dùng nói chung | Rất cao |
| A-07 | Dữ liệu thật của backend khi dùng proxy Xem thử, token thử nghiệm | Cao |
| A-08 | Máy người xem trang được xuất ra (người dùng cuối của sản phẩm) | Trung bình |

---

## 3. TÁC NHÂN ĐE DỌA

| Mã | Tác nhân | Khả năng |
|---|---|---|
| T-01 | **Trang web độc hại** người dùng mở trong cùng trình duyệt | Gửi request tới `127.0.0.1:<port>` (CSRF), mở WebSocket chéo trang, DNS rebinding, nhúng Studio trong iframe (clickjacking) |
| T-02 | **Nội dung không tin cậy trong project**: repo clone về có `.reactcraft/` hoặc mã backend do người khác viết | Đường dẫn độc trong cấu hình, file JSON quá lớn/lồng sâu, ảnh SVG có script, chữ chứa chỉ dẫn nhắm vào AI (prompt injection), file làm treo parser |
| T-03 | **Đầu ra AI** sai hoặc bị dẫn dắt | Operation phá thiết kế, liên kết `javascript:`, dữ liệu bịa |
| T-04 | **Tiến trình khác trên cùng máy** | Gọi cổng local, đọc file cấu hình |
| T-05 | **Kẻ tấn công mạng** giữa máy và AI provider | Nghe lén, sửa phản hồi |
| T-06 | **Chuỗi cung ứng**: package npm độc hại hoặc bị chiếm quyền | Chạy code khi cài hoặc khi chạy ReactCraft |
| T-07 | **Backend API thật** trả dữ liệu độc qua proxy | Phản hồi lớn, nội dung chèn mã vào Canvas |

---

## 4. MÔ HÌNH MỐI ĐE DỌA

| Mối đe dọa | Tác nhân | Tài sản | Biện pháp |
|---|---|---|---|
| Trang web độc gọi API ghi file, đọc mã nguồn | T-01 | A-01, A-02, A-06 | S-01 đến S-07 |
| DNS rebinding biến trang web thành "cùng origin" | T-01 | A-01, A-06 | S-04 |
| WebSocket chéo trang đọc sự kiện | T-01 | A-01 | S-03, S-05 |
| Clickjacking Studio | T-01 | A-02 | S-12 |
| XSS trong Studio từ nội dung thiết kế, tên trong catalog, đầu ra AI | T-02, T-03, T-07 | A-04, A-05, A-06 | S-10 đến S-16 |
| Path traversal, symlink thoát khỏi thư mục cho phép | T-02, T-03 | A-06 | S-20 đến S-28 |
| Lộ secrets qua quét, AI, log, đoạn mã hiển thị | T-02 | A-01, A-04 | S-30 đến S-36 |
| Prompt injection dẫn AI đề xuất thay đổi độc | T-02 | A-02, A-03 | S-40 đến S-46 |
| Chạy lệnh tùy ý qua tiến trình con | T-02, T-03 | A-06 | S-50 đến S-55 |
| SSRF qua proxy dữ liệu | T-01, T-02 | A-06, A-07 | S-60 đến S-66 |
| Code xuất ra có lỗ hổng (XSS, open redirect) | T-02, T-03 | A-08 | S-70 đến S-76 |
| Workspace clone về trỏ tới thư mục hệ thống | T-02 | A-06 | S-80 đến S-84 |
| Package độc trong chuỗi cung ứng | T-06 | A-06 | S-90 đến S-96 |
| Nghe lén request AI | T-05 | A-01, A-04 | S-47 |
| Từ chối dịch vụ (file lớn, JSON lồng sâu, regex) | T-02, T-07 | Tính sẵn sàng | S-17, S-29, S-64 |

---

## 5. MẠNG VÀ XÁC THỰC PHIÊN

### 5.1. Lắng nghe

| Mã | Biện pháp |
|---|---|
| S-01 | Server **chỉ** lắng nghe `127.0.0.1` (ADR-BE-03). Mỗi kết nối kiểm tra thêm `remoteAddress` là `127.0.0.1` hoặc `::ffff:127.0.0.1`, ngược lại đóng ngay |
| S-02 | Cổng mặc định chọn ngẫu nhiên trong khoảng 49152–65535 (tránh trùng cổng phổ biến), hoặc theo `--port` |

---

### 5.2. Token phiên

| Mã | Biện pháp |
|---|---|
| S-03 | Mỗi lần server khởi động sinh **token phiên** 32 byte từ `crypto.randomBytes`, mã hóa base64url. Không lưu xuống disk. Tắt server là token hết hiệu lực |
| S-05 | CLI mở trình duyệt tới `http://127.0.0.1:<port>/#t=<token>`. Token nằm ở **phần fragment** nên không bị gửi lên server trong request, không vào log, không vào header Referer. CLI cũng in đường dẫn này ra terminal để người dùng mở thủ công |
| S-06 | Studio đọc token từ fragment, **xóa fragment khỏi thanh địa chỉ ngay** (`history.replaceState`), lưu token trong `sessionStorage` (mất khi đóng tab, không chia sẻ giữa các tab). **Không** dùng `localStorage`, không dùng cookie |
| S-07 | Mọi request REST gửi `Authorization: Bearer <token>`. WebSocket gửi token qua subprotocol `reactcraft.token.<token>` cùng `reactcraft.v1`, server trả lại đúng `reactcraft.v1`. So sánh token bằng `crypto.timingSafeEqual`. Sai hoặc thiếu: 401 E014 (REST), đóng kết nối mã 4401 (WebSocket) |
| S-08 | Ngoại lệ không cần token: file tĩnh của Studio (`/`, `/assets/*`, `/canvas-frame.html`) vì không chứa dữ liệu người dùng. Mọi đường dẫn `/api/*` đều cần token |
| S-09 | Ảnh trong workspace (`/api/v1/workspace/assets/*`) được Studio tải bằng `fetch` có header xác thực rồi hiển thị qua `blob:` URL. **Không** đưa token vào query string |

---

### 5.3. Kiểm tra Host và Origin

| Mã | Biện pháp |
|---|---|
| S-04 | Header `Host` **BẮT BUỘC** là `127.0.0.1:<port>` hoặc `localhost:<port>`. Khác: 421 E014. Chặn DNS rebinding: tên miền của kẻ tấn công trỏ về 127.0.0.1 vẫn mang `Host` của tên miền đó |
| S-04a | Request `/api/*` có header `Origin` thì `Origin` **BẮT BUỘC** là `http://127.0.0.1:<port>` hoặc `http://localhost:<port>`. WebSocket **BẮT BUỘC** có `Origin` hợp lệ |
| S-04b | Không gửi header CORS (`Access-Control-Allow-*`). Trình duyệt chặn mọi đọc chéo origin |
| S-04c | Request thay đổi dữ liệu (`POST`, `PUT`, `PATCH`, `DELETE`) **BẮT BUỘC** có `Content-Type: application/json` (hoặc `multipart/form-data` cho tải ảnh, kèm token), để form HTML của trang khác không gửi được dạng "simple request" |

---

## 6. BẢO MẬT TRÌNH DUYỆT (STUDIO)

### 6.1. Header phản hồi

| Mã | Header | Giá trị |
|---|---|---|
| S-10 | `Content-Security-Policy` (Studio) | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https: http:; font-src 'self'; connect-src 'self' ws://127.0.0.1:<port> ws://localhost:<port>; frame-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` |
| S-11 | Header chung | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| S-12 | Chống clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` cho mọi trang trừ `/canvas-frame.html` (chỉ `frame-ancestors 'self'`) |

`style-src 'unsafe-inline'` cần cho Tailwind runtime trong Canvas và style động của Overlay. Script inline **không** được phép.

---

### 6.2. Chống XSS

| Mã | Biện pháp |
|---|---|
| S-13 | **KHÔNG** dùng `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write` ở bất kỳ đâu trong Studio. ESLint `react/no-danger` + luật cấm thuộc tính DOM tương ứng |
| S-14 | Nội dung người dùng (chữ, tên lớp, tên trang, tên entity/field, đầu ra AI) chỉ hiển thị qua React (tự escape). i18next không render HTML từ tham số |
| S-15 | URL do người dùng hoặc AI cung cấp (`Link.href`, `TextRun.link`, `openUrl`, `Image.src`, ảnh nền) chỉ chấp nhận scheme cho phép (V-99, SPEC-03). Canvas chặn điều hướng (ADR-FE-04) |
| S-16 | CodeMirror hiển thị code ở chế độ chỉ đọc, như văn bản |
| S-17 | Dán từ clipboard (`application/x-reactcraft-nodes+json`) giới hạn 5 MB, qua Zod trước khi dùng |

---

## 7. FILE SYSTEM

### 7.1. Phạm vi được phép

| Vùng | Đọc | Ghi | Ghi qua |
|---|---|---|---|
| `<workspace>/.reactcraft/` | Có | Có | Design Store, cache, assets |
| Target Project | Có (phân tích) | Có | **Chỉ** Export Manager (file sinh ra, chỉnh sửa hỗ trợ, `package.json` khi đồng ý) |
| `htmlOutDir` | Có | Có | Xuất HTML |
| Thư mục backend | Có (quét) | **Không bao giờ** | — |
| Thư mục cấu hình người dùng (`env-paths`) | Có | Có | Cấu hình, log |
| Mọi nơi khác | Chỉ liệt kê tên thư mục qua `/fs/directories` (S-27) | **Không** | — |

---

### 7.2. Chuẩn hóa và kiểm tra đường dẫn

Hàm duy nhất `resolveSafePath(root, relativeOrAbsolute, mode)` trong `core/shared/paths.ts`. Mọi truy cập file của core đi qua nó (qua `FileSystemPort`).

| Mã | Biện pháp |
|---|---|
| S-20 | Từ chối đường dẫn chứa ký tự `\0`, ký tự điều khiển, hoặc dài hơn 1.024 ký tự |
| S-21 | Windows: từ chối đường dẫn UNC (`\\server\share`), đường dẫn thiết bị (`\\?\`, `\\.\`), đường dẫn tương đối theo ổ (`C:foo`), luồng dữ liệu thay thế (`file.txt:stream`), tên dành riêng (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, có hoặc không đuôi) |
| S-22 | Chuẩn hóa bằng `path.resolve`, rồi lấy **đường dẫn thật** (`fs.realpath`) của phần đã tồn tại dài nhất. Kết quả **BẮT BUỘC** nằm trong `realpath(root)` |
| S-23 | So sánh tiền tố đường dẫn không phân biệt hoa thường trên Windows và macOS, có dấu phân cách cuối (tránh `/work/app` khớp `/work/application`) |
| S-24 | Trước khi ghi: `lstat` file đích. Là symlink hoặc junction → từ chối E012. Thư mục cha phải qua S-22 |
| S-25 | Liệt kê file (tinyglobby) không đi theo symlink (`followSymbolicLinks: false`) |
| S-26 | Vi phạm trả E012, ghi log mức `warn` kèm đường dẫn đã chuẩn hóa (không kèm nội dung) |
| S-27 | `/fs/directories` chỉ trả **tên thư mục**, không trả tên file, không đọc nội dung, ẩn thư mục hệ thống và thư mục ẩn trừ khi người dùng bật "Hiện thư mục ẩn" |
| S-28 | Liên kết Target Project hoặc backend **KHÔNG ĐƯỢC** là: gốc ổ đĩa, thư mục home của người dùng, thư mục hệ thống (`C:\Windows`, `C:\Program Files*`, `/`, `/etc`, `/usr`, `/bin`, `/System`, `/Library`, `/Applications`), thư mục cấu hình của ReactCraft. Vi phạm: E012 |
| S-29 | Giới hạn: file workspace JSON ≤ 20 MB, độ sâu lồng JSON ≤ 64 (kiểm tra trước khi đưa cho Zod), ảnh tải lên ≤ 5 MB, file nguồn đọc khi quét ≤ 1 MB (ADR-BE-15) |

---

### 7.3. Ảnh trong workspace

| Mã | Biện pháp |
|---|---|
| S-29a | Chỉ nhận ảnh có định dạng thật (kiểm tra chữ ký file) khớp đuôi: PNG, JPEG, WebP, GIF, SVG |
| S-29b | Phản hồi `/workspace/assets/*` có `Content-Type` theo định dạng đã kiểm tra, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` |
| S-29c | SVG chỉ được hiển thị qua `<img>` (script trong SVG không chạy). **KHÔNG** nhúng nội dung SVG trực tiếp vào DOM, kể cả khi xuất code |

---

## 8. SECRETS

### 8.1. File secrets

| Mã | Biện pháp |
|---|---|
| S-30 | Danh sách mẫu file secrets (mở rộng ADR-BE-15): `.env`, `.env.*` (trừ `.env.example`, `.env.sample`, `.env.template`), `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `id_rsa*`, `id_ed25519*`, `*.ppk`, `credentials*`, `secrets*`, `*.secret`, `.npmrc`, `.pypirc`, `.netrc`, `service-account*.json`, `*-credentials.json`, `kubeconfig*`, `.aws/`, `.ssh/`, `.gnupg/` |
| S-31 | File khớp mẫu **không được mở**, kể cả để đọc vài byte |

---

### 8.2. Lọc giá trị nhạy cảm trong file bình thường

File cấu hình bình thường vẫn có thể chứa secrets (ví dụ `SECRET_KEY` trong `settings.py` của Django).

| Mã | Biện pháp |
|---|---|
| S-32 | **Bộ lọc che giá trị** `redactSecrets(text)` áp dụng cho **mọi** nội dung mã nguồn trước khi rời khỏi bộ trích xuất: gửi AI (SPEC-04.4 mục 6), hiển thị đoạn mã (R-DC-03), ghi log, ghi cache |
| S-33 | Bộ lọc thay giá trị bằng `«redacted»` khi gặp: (1) gán giá trị chuỗi cho tên khớp `(?i)(secret|password|passwd|pwd|token|api[_-]?key|private[_-]?key|credential|auth|dsn|connection[_-]?string)`; (2) mẫu khóa đã biết: `AKIA[0-9A-Z]{16}`, `-----BEGIN [A-Z ]*PRIVATE KEY-----`, `sk-[A-Za-z0-9_-]{20,}`, `ghp_[A-Za-z0-9]{36}`, `xox[baprs]-[A-Za-z0-9-]+`, chuỗi kết nối có `://<user>:<pass>@` |
| S-34 | Dữ liệu trích xuất (entity, field, endpoint) chỉ gồm tên, kiểu, đường dẫn, **không bao giờ** gồm giá trị gán của biến cấu hình |

---

### 8.3. API key và token

| Mã | Biện pháp |
|---|---|
| S-35 | API key lưu trong `config.json` ở thư mục cấu hình người dùng (ADR-BE-24): macOS/Linux quyền `0600`; Windows nằm trong `%APPDATA%` thuộc hồ sơ người dùng (mặc định chỉ người dùng đó và quản trị viên đọc được). Biến môi trường được ưu tiên |
| S-36 | API key, token phiên, token thử nghiệm của proxy **không bao giờ**: gửi xuống trình duyệt, ghi log, ghi vào workspace, vào thông báo lỗi, vào ngữ cảnh AI. `pino` `redact` các đường dẫn `*.apiKey`, `*.token`, `req.headers.authorization`, `req.headers["sec-websocket-protocol"]` |

---

## 9. AI

| Mã | Biện pháp |
|---|---|
| S-40 | AI không có tool/function calling (ADR-BE-22, R-AS-01) |
| S-41 | Ngữ cảnh AI không chứa nội dung file backend, secrets, đường dẫn tuyệt đối (R-AC-04). Riêng trích xuất bằng AI (SPEC-04.4 mục 6) gửi nội dung file đã qua S-32 và cần xác nhận danh sách file |
| S-42 | Gửi tới provider bên ngoài lần đầu trong phiên cần xác nhận (R-AC-09). Ảnh chụp Canvas chỉ gửi khi bật cho từng request |
| S-43 | Dữ liệu trong prompt được đặt trong khối đánh dấu và system prompt nêu rõ đó là dữ liệu (R-AP-03) |
| S-44 | Đầu ra AI qua: Zod → danh sách operation được phép → `applyBatch` → kiểm tra phạm vi → người dùng xem trước và duyệt (SPEC-04.3 mục 5, 7) |
| S-45 | AI **không bao giờ** viết code xuất ra. Code chỉ do Code Generator sinh từ Design Model đã kiểm tra |
| S-46 | `ollamaBaseUrl` mặc định `http://127.0.0.1:11434`. Đổi sang máy khác: cảnh báo "Thiết kế và ngữ cảnh sẽ gửi tới <host>" và đánh dấu provider là "bên ngoài" (S-42) |
| S-47 | Gọi provider bên ngoài **BẮT BUỘC** qua HTTPS, kiểm tra chứng chỉ mặc định của Node. **KHÔNG** có tùy chọn tắt kiểm tra TLS |

---

## 10. TIẾN TRÌNH CON

| Mã | Biện pháp |
|---|---|
| S-50 | Chỉ ba loại tiến trình con được phép: (1) cài dependency của Target Project, (2) `vite build` thử, (3) mở trình duyệt (`open`). Không có cơ chế chạy lệnh tùy ý |
| S-51 | Lệnh dựng bằng **mảng tham số** cố định, không ghép chuỗi, **không** dùng shell. Trên Windows dùng `cross-spawn` để chạy `pnpm.cmd`/`npm.cmd` an toàn |
| S-52 | Thư mục chạy cố định là Target Project (hoặc `workspaceRoot` với cờ lọc, R-TP-04) |
| S-53 | Biến môi trường truyền cho tiến trình con **loại bỏ**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, mọi biến `REACTCRAFT_*`, và token phiên |
| S-54 | Cài dependency: Studio hiển thị **chính xác** lệnh sẽ chạy và danh sách package, người dùng bấm xác nhận mỗi lần (SEC-08). Build thử: người dùng bấm mỗi lần hoặc bật trong Settings với cảnh báo "build chạy cấu hình và plugin của project" |
| S-55 | Timeout: cài đặt 10 phút, build 120 s. Hủy được. Kết quả chỉ giữ 200 dòng log cuối, đã qua S-32 |

---

## 11. PROXY DỮ LIỆU (XEM THỬ)

| Mã | Biện pháp |
|---|---|
| S-60 | Đích **chỉ** là `baseUrl` trong catalog (scheme `http`/`https`, host, port cố định). Đường dẫn ghép từ `Endpoint.path` đã biết, tham số path được `encodeURIComponent`. Không nhận URL tùy ý từ Studio |
| S-61 | Chỉ `GET`, chỉ endpoint `list`, `detail` (R-LP-02) |
| S-62 | Không theo chuyển hướng (`redirect: 'manual'`). Phản hồi 3xx trả E022 |
| S-63 | Không chuyển tiếp header của Studio. Chỉ gửi `Accept: application/json` và header xác thực từ token thử nghiệm (R-LP-03) |
| S-64 | Phản hồi ≤ 5 MB, timeout 10 s, phải là JSON hợp lệ. Dữ liệu hiển thị trên Canvas qua React (S-14) |
| S-65 | `baseUrl` trỏ tới địa chỉ nội bộ (localhost, mạng LAN) được phép vì đó là mục đích (backend đang phát triển). Studio hiển thị rõ đích đến khi bật "Dùng API thật" |
| S-66 | Proxy tắt mặc định, bật riêng cho từng phiên Xem thử |

---

## 12. CODE XUẤT RA

| Mã | Biện pháp |
|---|---|
| S-70 | Chữ người dùng được escape theo ngữ cảnh JSX và HTML (R-CG-12). Thuộc tính HTML luôn trong dấu nháy kép, escape `"`, `&`, `<`, `>` |
| S-71 | **KHÔNG BAO GIỜ** sinh `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` |
| S-72 | URL trong code xuất ra đã qua V-99. Liên kết mở tab mới có `rel="noreferrer"` (bao gồm `noopener`) |
| S-73 | `data-rc-actions` trong HTML là JSON escape cho ngữ cảnh thuộc tính. `reactcraft-ui.js` đọc bằng `JSON.parse`, chỉ chạy hành động trong tập cho phép, chỉ dùng `textContent` |
| S-74 | Lớp dữ liệu sinh ra: tham số path `encodeURIComponent`, tham số query qua `URLSearchParams`, không ghép chuỗi URL thô |
| S-75 | `auth.ts` sinh ra có comment cảnh báo rủi ro lưu token trong `localStorage` và gợi ý dùng cookie `HttpOnly` nếu backend hỗ trợ |
| S-76 | Không thêm dependency khi chưa có đồng ý (R-CG-04). Không chỉnh sửa file của người dùng ngoài danh sách cho phép (SPEC-04.2 mục 8.4) |

---

## 13. WORKSPACE KHÔNG TIN CẬY (WORKSPACE TRUST)

Workspace có thể đến từ repo clone về. ReactCraft áp dụng cơ chế tin cậy tương tự VS Code.

| Mã | Biện pháp |
|---|---|
| S-80 | Lần đầu mở một workspace (theo `WorkspaceMeta.id` + đường dẫn), Studio hiện hộp thoại **"Bạn có tin tưởng workspace này?"** liệt kê: Target Project, các backend được liên kết (đường dẫn thật), và cảnh báo nếu nằm ngoài thư mục workspace |
| S-81 | Chưa tin cậy (**chế độ hạn chế**): xem và sửa thiết kế được; **không** quét backend, **không** xuất code, **không** chạy build, **không** gọi AI với mức ngữ cảnh 3, **không** dùng proxy dữ liệu |
| S-82 | Danh sách workspace đã tin cậy lưu trong cấu hình người dùng (không lưu trong workspace, để workspace không tự đánh dấu tin cậy cho mình) |
| S-83 | Liên kết trong workspace vi phạm S-28 bị bỏ qua dù đã tin cậy |
| S-84 | Thay đổi liên kết (Target Project, backend) qua file bị sửa từ bên ngoài (`workspace.externalChange`) đưa workspace về chế độ hạn chế cho tới khi người dùng xác nhận lại |

---

## 14. TÀI NGUYÊN VÀ TỪ CHỐI DỊCH VỤ

| Mã | Biện pháp |
|---|---|
| S-85 | Worker phân tích mã nguồn chạy với `resourceLimits.maxOldGenerationSizeMb = 512` và timeout **5 s mỗi file**. Quá hạn: bỏ file, cảnh báo |
| S-86 | Regex dùng cho mã nguồn không tin cậy (S-33, phát hiện framework) được kiểm tra không có backtracking thảm họa (test với chuỗi dài 1 MB, ≤ 100 ms) |
| S-87 | Giới hạn của SPEC-03 mục 12 áp dụng nghiêm ngặt. Body vượt giới hạn bị cắt kết nối trước khi parse |

---

## 15. LOG VÀ QUYỀN RIÊNG TƯ

| Mã | Biện pháp |
|---|---|
| S-88 | Log nằm trong thư mục log của người dùng (`env-paths`), xoay vòng 10 MB × 5 file |
| S-89 | Log **không** chứa: nội dung file, nội dung thiết kế, prompt, ngữ cảnh AI, đầu ra AI, secrets, token, dữ liệu từ proxy (ADR-BE-23, R-AS-03) |
| S-89a | **Không telemetry**, không thống kê sử dụng, không tự kiểm tra cập nhật. Kết nối mạng duy nhất là do người dùng chủ động: AI provider, proxy dữ liệu, cài dependency |

---

## 16. CHUỖI CUNG ỨNG

| Mã | Biện pháp |
|---|---|
| S-90 | `pnpm-lock.yaml` được commit. CI cài bằng `--frozen-lockfile` |
| S-91 | `pnpm audit --audit-level=high` chặn phát hành (SPEC-01.1 mục 13.2) |
| S-92 | Cập nhật dependency tự động hàng tuần (Renovate hoặc Dependabot), mỗi lần qua toàn bộ CI và VG liên quan |
| S-93 | pnpm cấu hình `onlyBuiltDependencies` (chỉ các package cần build native đã duyệt, ví dụ `oxc-parser`) để chặn script cài đặt của package khác |
| S-94 | Phát hành npm từ GitHub Actions với **provenance** (`npm publish --provenance`). Tài khoản npm bật 2FA |
| S-95 | Mỗi bản phát hành có SBOM định dạng CycloneDX và báo cáo giấy phép (chỉ giấy phép ở SPEC-01.1 mục 13.2) |
| S-96 | Package phát hành không có `postinstall` (ADR-BE-25) |

---

## 17. KIỂM THỬ BẢO MẬT

### 17.1. Bắt buộc trong CI

| Nhóm | Ca kiểm thử | Biện pháp |
|---|---|---|
| Xác thực | Không token, token sai, token đúng; WebSocket không subprotocol, subprotocol sai | S-03, S-07 |
| Host/Origin | `Host: evil.example`, `Origin: https://evil.example`, thiếu Origin ở WebSocket, `Content-Type: text/plain` cho `POST` | S-04 |
| Header | CSP, `X-Frame-Options`, `nosniff` có trên mọi phản hồi tương ứng | S-10 đến S-12 |
| Đường dẫn | Ma trận: `../`, `..\\`, đường dẫn tuyệt đối khác gốc, UNC, `\\?\`, `C:foo`, `NUL`, `con.txt`, ký tự `\0`, symlink thoát gốc, junction (Windows), khác hoa thường | S-20 đến S-28 |
| Secrets | Chuỗi `RC_SECRET_MARKER_*` trong `.env`, `settings.py`, `config.ts` của fixture không xuất hiện ở: kết quả quét, catalog, cache, ngữ cảnh AI (mọi mức), log, phản hồi API, đoạn mã hiển thị, log build | S-30 đến S-36 |
| AI | Đầu ra độc: `javascript:` trong `href`, operation không được phép, đích ngoài phạm vi, JSON 10 MB, lồng 1.000 cấp | S-44, S-15 |
| Tiến trình con | Biến môi trường bị loại bỏ (S-53), không có shell (tên package chứa `;`, `&&`, `|` không gây chạy lệnh) | S-51, S-53 |
| Proxy | Host khác, method khác `GET`, chuyển hướng 302, phản hồi 6 MB, không phải JSON | S-60 đến S-64 |
| Code xuất ra | Chữ chứa `</script>`, `{`, `"><img onerror=…>`, URL `javascript:` → code xuất ra an toàn, không có `dangerouslySetInnerHTML` | S-70 đến S-74 |
| Workspace trust | Workspace mới ở chế độ hạn chế, các chức năng S-81 bị khóa | S-80, S-81 |
| Fuzz | `fast-check` sinh request ngẫu nhiên cho mọi schema Zod: không có lỗi 500 | S-87 |

---

### 17.2. Mỗi lần phát hành

- Rà danh sách biện pháp S-xx với thay đổi trong phiên bản.
- Chạy công cụ phân tích tĩnh bảo mật (ESLint security rules, `pnpm audit`).
- Cập nhật `SECURITY.md` trong repo: cách báo lỗ hổng (email riêng, không mở issue công khai), thời gian phản hồi mục tiêu 7 ngày.

---

## 18. TRUY VẾT

| Yêu cầu SRS | Biện pháp |
|---|---|
| SEC-01 Local, token, Origin | S-01 đến S-09 |
| SEC-02 Backend chỉ đọc | Mục 7.1, S-24 |
| SEC-03 Chỉ ghi trong phạm vi | S-20 đến S-28 |
| SEC-04 AI không có quyền file/shell | S-40, S-45 |
| SEC-05 Loại trừ secrets | S-30 đến S-34 |
| SEC-06 Provider rõ ràng | S-42, S-46 |
| SEC-07 API key | S-35, S-36 |
| SEC-08 Đồng ý khi cài dependency | S-54, S-76 |
| SEC-09 Workspace không tin cậy | S-80 đến S-84 |
| SEC-10 Không telemetry | S-89a |
| FR-21 Loại trừ secrets khi quét | S-30 đến S-34 |
| FR-29 Minh bạch dữ liệu AI | S-41, S-42 |
| AC-13 | 17.1 nhóm Secrets |

---

## 19. CẬP NHẬT CÁC PHẦN KHÁC

| Phần | Thay đổi |
|---|---|
| SRS mục 12 | Thêm SEC-09 (workspace không tin cậy), SEC-10 (không telemetry, không tự kết nối mạng) |
| SPEC-01.1 mục 13.1 | Thêm `cross-spawn` (S-51) |
| SPEC-03 | Thêm V-99: scheme URL cho phép. API: `POST /workspace/trust` |
| SPEC-03 mục 10.1 | `SessionInfo.workspace` thêm `trusted: boolean` |

---

# SPEC-07 — QUY TRÌNH THI CÔNG

**Phiên bản phần:** 0.1  
**Trạng thái:** Draft — chờ duyệt  
**Truy vết:** SRS v4.0 (mục 11, 14, 16), SPEC-01.1 (mục 11 đến 13), SPEC-01.2 (mục 12 đến 14), SPEC-02 (mục 9, 11 đến 14), SPEC-03, SPEC-04.1 đến SPEC-04.5, SPEC-05 (mục 17)  
**Phạm vi:** Thứ tự thi công, gói công việc, lịch kiểm chứng (VG), Definition of Ready, Definition of Done mức gói và mức phase, cổng nghiệm thu, kiểm soát thay đổi spec, xử lý VG không đạt, rủi ro, phát hành

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

### 1.1. Mục đích

Các phần trước trả lời **xây cái gì** và **xây bằng gì**. Phần này trả lời **xây theo thứ tự nào, khi nào được bắt đầu một hạng mục, khi nào hạng mục được coi là xong, và ai được phép nghiệm thu**.

Giống công trường: không đổ bê tông khi chưa nghiệm thu cốt thép. Mỗi phase có **cổng nghiệm thu** với tiêu chí đo được. Chưa qua cổng thì không bắt đầu phase sau.

---

### 1.2. Phạm vi

**Trong phạm vi:** phase và gói công việc, thứ tự phụ thuộc, lịch VG, cờ tính năng, khởi tạo repo, Definition of Ready, Definition of Done (gói, phase), cổng nghiệm thu, quy trình làm một gói công việc (kể cả khi dùng AI coding assistant), duyệt và thay đổi spec, xử lý VG không đạt, mức nghiêm trọng của lỗi, rủi ro, phát hành, cách viết SPEC-06 trong thi công.

**Ngoài phạm vi:**

| Nội dung | Tài liệu |
|---|---|
| Definition of Done của một thay đổi code (một PR) | SPEC-02 mục 14 |
| Quy chuẩn Git, PR, review, CI | SPEC-02 mục 11 đến 13 |
| Chiến lược kiểm thử chi tiết, fixture, benchmark, bản đồ AC → test | SPEC-06 (viết dần trong thi công, mục 18) |
| Tiêu chí kiểm thử tối thiểu của từng module | Mục "Tiêu chí kiểm thử" trong SPEC-04.1 đến SPEC-04.5, SPEC-05 mục 17 |

---

### 1.3. Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Phase** | Một giai đoạn thi công có mục tiêu sản phẩm rõ ràng, kết thúc bằng một cổng nghiệm thu. Phase 1 đến 5 theo SRS mục 16. Phase 0 là nền móng |
| **Gói công việc (WP)** | Một khối việc có đầu ra kiểm chứng được, gồm một hoặc nhiều PR. Mã `WP-<phase>.<số>` |
| **Cổng nghiệm thu (Gate)** | Danh sách tiêu chí phải đạt để đóng một phase. Cổng của phase *n* ký hiệu `G<n>` |
| **Spike** | Code thử nghiệm để chạy VG trước khi viết code thật. Không bao giờ merge vào `main` |
| **VG giai đoạn A / B** | A: kiểm chứng bằng spike **trước** khi viết code phụ thuộc. B: chạy lại trên hệ thống thật tại cổng nghiệm thu |
| **Task packet** | Gói ngữ cảnh giao cho người làm hoặc AI coding assistant để thực hiện một PR (mục 12.2) |
| **Cờ tính năng** | Công tắc ẩn chức năng của phase chưa qua cổng khỏi người dùng (mục 3.4) |
| **Báo cáo VG / báo cáo phase** | File markdown ghi kết quả đo, lưu trong repo (mục 19) |

---

## 2. NGUYÊN TẮC THI CÔNG

| Mã | Nguyên tắc |
|---|---|
| CW-01 | **Spec trước, code sau.** Điều gì chưa có trong spec thì bổ sung spec (mục 13) rồi mới code. Code khác spec là lỗi, kể cả khi code "tốt hơn" |
| CW-02 | **Đúng thứ tự phase.** Không bắt đầu WP của phase *n + 1* khi cổng `G<n>` chưa đạt. Ngoại lệ duy nhất: spike VG giai đoạn A và fixture của phase sau được làm sớm |
| CW-03 | **Design Model hoàn chỉnh từ Phase 1.** `@reactcraft/model` hiện thực **toàn bộ** SPEC-03 phần A (mọi loại node, mọi trường, mọi operation, mọi quy tắc V-xx) ngay trong Phase 1, kể cả phần chỉ có giao diện ở phase sau. Schema phiên bản 1 được **đóng băng** tại `G1`. Phase sau không được đổi schema theo kiểu phá vỡ tương thích; nếu bắt buộc phải đổi thì qua quy trình thay đổi spec (mục 13) kèm migration (ADR-BE-11) |
| CW-04 | **Hiển thị đầy đủ, tạo theo phase.** Canvas, Layer Tree, Inspector (chỉ đọc) hiển thị đúng **mọi** loại node và thuộc tính có trong schema ngay từ Phase 1. Chỉ chức năng **tạo, sửa** mới đến theo phase. Nhờ vậy file workspace tạo ở phase sau vẫn mở đúng ở mọi bản dựng trước đó cùng schema |
| CW-05 | **`main` luôn phát hành được.** Chức năng dở dang nằm sau cờ tính năng (mục 3.4). Không có nhánh sống lâu (QC-75) |
| CW-06 | **Mọi PR truy vết được.** Mỗi PR dẫn chiếu ít nhất một mã spec trong `Refs:` (SPEC-02 mục 11.2) và thuộc đúng một WP |
| CW-07 | **Đo, không đoán.** Hiệu năng đo bằng `pnpm bench` theo PB-xx, độ khớp giao diện đo bằng VG-09, độ hợp lệ của AI đo bằng VG-06. Kết quả đo ghi vào báo cáo, không ghi "chạy nhanh", "ổn" |
| CW-08 | **Bảo mật từ ngày đầu.** Biện pháp S-xx của phần nào được làm cùng WP của phần đó, không dồn về cuối (mục 20.4) |
| CW-09 | **Hai ngôn ngữ từ ngày đầu.** Mọi màn hình có đủ `vi` và `en` ngay khi xuất hiện (NFR-14, VG-12) |
| CW-10 | **Windows là công dân hạng nhất.** Mọi WP chạy được và qua CI trên Windows. Lỗi chỉ xảy ra trên Windows có mức nghiêm trọng như lỗi trên mọi nền tảng |
| CW-11 | **Không phụ thuộc ngoài danh sách.** Chỉ dùng thư viện trong SPEC-01.1 mục 13.1, SPEC-01.2 mục 14.1, SPEC-02 mục 15 (QC-86) |
| CW-12 | **Không làm trước phần chưa được duyệt.** Một phase chỉ bắt đầu khi mọi phần spec thuộc phạm vi của nó ở trạng thái "Đã duyệt" (mục 13.1) |

---

## 3. TỔNG QUAN PHASE

### 3.1. Bảng phase

| Phase | Tên | Mục tiêu sản phẩm | Phần spec chính | Cổng | Phiên bản phát hành |
|---|---|---|---|---|---|
| 0 | Nền móng | Repo, CI, khung 4 package, nền bảo mật, i18n, hạ tầng kiểm thử; các VG nền tảng đạt | SPEC-01.1, SPEC-01.2, SPEC-02, SPEC-05 mục 5, 6 | `G0` | Không phát hành |
| 1 | Studio Core | Dựng được một trang tĩnh hoàn chỉnh bằng kéo thả, ở mọi khung nhìn | SPEC-03, SPEC-04.1 | `G1` | `0.1.0` |
| 2 | Xuất code và tương tác | Trang thiết kế trong Studio chạy được trong project thật, có tương tác | SPEC-04.2, SPEC-04.1 (mục 7.7, 8.4, 11.2) | `G2` | `0.2.0` |
| 3 | AI | AI sửa phần tử, dựng trang, tối ưu responsive; mọi đề xuất qua kiểm tra và xem trước | SPEC-04.3 | `G3` | `0.3.0` |
| 4 | Ngữ cảnh backend | Đọc backend, gắn dữ liệu, sinh lớp dữ liệu; AI dùng ngữ cảnh backend | SPEC-04.4 | `G4` | `0.4.0` |
| 5 | Nâng cao và phát hành | User Component, Design Token đầy đủ, xem song song nhiều khung, gợi ý tách layout dùng chung; sẵn sàng 1.0 | SPEC-04.5 | `G5` (cổng phát hành) | `1.0.0` |

---

### 3.2. Sơ đồ phụ thuộc

```text
Phase 0  Nền móng
   │   repo, CI, khung package, bảo mật mạng, i18n, test infra
   │   VG-01 VG-07 VG-09A VG-10 VG-11 VG-12 VG-13 VG-14
   ▼
Phase 1  Studio Core
   │   model đầy đủ (CW-03) → server workspace → Studio
   │   Canvas → Overlay → Kéo thả → Inspector → Layer Tree
   ▼
Phase 2  Xuất code + tương tác
   │   VG-02 VG-03A VG-08 → codegen → kiểm tra → Export Manager
   │   tương tác, Xem thử, rich text, chế độ tối
   ▼
Phase 3  AI
   │   VG-06A → gateway → context → prompt → kiểm tra → AI Panel
   ▼
Phase 4  Ngữ cảnh backend
   │   VG-04 VG-05 → scanner → catalog → binding → lớp dữ liệu
   ▼
Phase 5  Nâng cao → cổng phát hành 1.0
       User Component, token, nhiều khung, gợi ý layout dùng chung
```

Thứ tự Phase 3 trước Phase 4 theo SRS mục 16: AI dùng được ngay với thiết kế không dữ liệu. Ngữ cảnh mức 3 (backend) được bật ở WP-4.11.

---

### 3.3. Lịch VG

| VG | Kiểm chứng cho | Giai đoạn A (trước khi code) | Giai đoạn B (tại cổng) |
|---|---|---|---|
| VG-01 Ghi file Windows | ADR-BE-18 | WP-0.08 | `G2` (transaction export thật) |
| VG-02 Prettier | ADR-BE-16 | WP-2.00 | `G2` |
| VG-03 Code xuất ra biên dịch | ADR-BE-05, 16, 19 | WP-2.00: code mẫu viết tay theo SPEC-04.2 biên dịch được trong hai project mẫu | `G2` (không có Binding), `G4` (đầy đủ). Sau đó chạy ở mọi PR qua job `export-compat` |
| VG-04 OpenAPI | ADR-BE-14 | WP-4.00 | `G4` |
| VG-05 tree-sitter Django | ADR-BE-13 | WP-4.00 | `G4` |
| VG-06 AI hợp lệ | ADR-BE-22 | WP-3.00: script dùng AI SDK, structured output với schema operation thật, bộ 50 yêu cầu | `G3` (toàn bộ pipeline M-AC → M-AV), chạy lại ở `G4` với nhóm "có dữ liệu" |
| VG-07 Server local | ADR-BE-03, 06 | WP-0.08 | `G1` |
| VG-08 Type check | ADR-BE-19 | WP-2.00 | `G2` |
| VG-09 Canvas khớp code | ADR-FE-04, 05, 06 | WP-0.09: cùng danh sách class, render bằng Tailwind runtime trong iframe so với CSS biên dịch bằng `tailwindcss` v4 | `G2` (trang xuất thật), `G4`, `G5` |
| VG-10 Tailwind runtime | ADR-FE-05 | WP-0.09 | `G1` |
| VG-11 Kéo thả trong iframe | ADR-FE-07, 09 | WP-0.09 | `G1` |
| VG-12 Đầy đủ bản dịch | ADR-FE-16 | WP-0.05 (bật trong CI) | Mọi cổng |
| VG-13 React Compiler | ADR-FE-02 | WP-0.09 | `G1` và mọi cổng sau |
| VG-14 Rich text trong iframe | ADR-FE-20 | WP-0.09 | `G2` |

| Mã | Quy tắc |
|---|---|
| CW-13 | ADR có trạng thái "Accepted — chờ VG" chỉ được dùng trong code của `main` khi VG giai đoạn A **Đạt** và báo cáo đã merge |
| CW-14 | Nâng major của một phụ thuộc chạy lại mọi VG liên quan (SPEC-01.1 mục 13.2 quy tắc 4). Kết quả ghi báo cáo VG mới, không sửa báo cáo cũ |
| CW-15 | Khi VG Đạt, trạng thái ADR tương ứng đổi thành **Accepted** và ghi phiên bản thư viện vào SPEC-01.1 mục 13.3 hoặc SPEC-01.2 mục 14.3 |

---

### 3.4. Cờ tính năng

Chức năng thuộc phase chưa qua cổng được ẩn bằng cờ tính năng.

```ts
// packages/model/src/features.ts — dùng chung server và Studio
export const FEATURES = {
  export:        { phase: 2 },   // liên kết Target Project, màn hình Export
  interactions:  { phase: 2 },   // mục Tương tác của Inspector, Xem thử, preset có tương tác
  richText:      { phase: 2 },   // thanh định dạng chữ
  darkMode:      { phase: 2 },   // cài đặt darkMode, nút xem sáng/tối
  ai:            { phase: 3 },
  backend:       { phase: 4 },   // Data Sources, gắn dữ liệu, proxy Xem thử
  components:    { phase: 5 },   // tạo, sửa User Component
  tokens:        { phase: 5 },   // panel token, nhập token
  multiFrame:    { phase: 5 },   // xem song song nhiều khung
  layoutSuggest: { phase: 5 },   // gợi ý tách layout dùng chung
} as const;
export type FeatureId = keyof typeof FEATURES;
```

| Mã | Quy tắc |
|---|---|
| CW-16 | Hằng `RELEASED_PHASE` trong `features.ts` ghi phase cao nhất đã qua cổng. Cờ có `phase ≤ RELEASED_PHASE` luôn bật |
| CW-17 | Cờ của phase sau chỉ bật khi chạy với biến môi trường `REACTCRAFT_FEATURES` (danh sách mã cách nhau bởi dấu phẩy, hoặc `all`). Biến này dành cho phát triển, không ghi trong tài liệu người dùng |
| CW-18 | Server **không đăng ký** route của chức năng bị tắt (trả E015). Studio ẩn mọi lối vào (menu, phím tắt, lệnh). Danh sách cờ đang bật gửi xuống Studio qua `SessionInfo.features` |
| CW-19 | Cờ tắt **không** ảnh hưởng hiển thị (CW-04): node có tương tác vẫn hiển thị trên Canvas, Inspector hiện mục Tương tác ở dạng chỉ đọc kèm nhãn "Có ở phiên bản sau" |
| CW-20 | Tại cổng `G<n>`: tăng `RELEASED_PHASE`, xóa mọi điều kiện `if (feature…)` của cờ phase *n* khỏi code trong cùng PR đóng cổng. Không để cờ chết |

---

### 3.5. Phân chia module và quyền sở hữu thư mục

Đơn vị thi công và kiểm soát là **module**. Mỗi module sở hữu một tập thư mục. Mọi thay đổi code được giao theo **bộ thay đổi** (mã `CS-<phase>.<số WP>-<n>`, ví dụ `CS-1.08-2`), mỗi bộ thuộc đúng một module, để chủ sản phẩm xem xét và commit từng phần.

#### 3.5.1. Module nền

Ngoài các module nghiệp vụ M-xx của SPEC-04, có sáu module nền:

| Mã | Tên | Thư mục sở hữu | Spec | WP |
|---|---|---|---|---|
| M-RP | Repo và công cụ | File cấu hình ở gốc repo, `scripts/` (trừ script của M-QA, M-ST), `.github/`, `.changeset/` | SPEC-02, mục 4.3 | WP-0.01, 0.02 |
| M-QA | Hạ tầng kiểm thử | `vitest.workspace.ts`, `playwright.config.ts`, `fixtures/`, `e2e/support/`, `scripts/vg/`, `scripts/bench*`, `scripts/trace*`, `scripts/gen-large-workspace.ts` | ADR-BE-26, ADR-FE-18, SPEC-06 | WP-0.06, 0.07, 2.12, 3.07, 4.00 (fixture) |
| M-MC | Model core | `packages/model/` gồm `package.json`, `tsconfig.json`, `README.md`, `src/index.ts`, `src/schema/`, `src/operations/`, `src/migrations/`, `src/features.ts` | SPEC-03 phần A, mục 3.4 | WP-1.01, 1.02, 1.03 |
| M-SV | Server nền | `packages/server/` gồm `package.json`, `tsconfig.json`, `README.md`, `src/index.ts`, `src/core/ports/`, `src/core/shared/`, `src/adapters/http/` (trừ `routes/<module>.ts`), `src/adapters/fs/`, `src/adapters/watcher/`, `src/adapters/process/`, `src/workers/` | ADR-BE-03, 06, 07, 20, 21, 23, 24; SPEC-03 mục 9, 11 đến 13; SPEC-05 mục 5, 6, 14, 15 | WP-0.03, 0.04, 1.05 (log, cấu hình) |
| M-CL | CLI | `packages/cli/` | ADR-BE-03, 25 | WP-0.03, 1.11 |
| M-ST | Studio nền | `packages/studio/` gồm `package.json`, `tsconfig.json`, `README.md`, `index.html`, `vite.config.ts`, file Prettier riêng, `src/main.tsx`, `src/app/`, `src/api/`, `src/i18n/` (khung và namespace `common`, `errors`), `src/ui/`, `src/lib/`, `src/stores/ui/`; `scripts/check-i18n*` | ADR-FE-01, 02, 11 đến 17 | WP-0.03, 0.05, 1.06 (khung) |

#### 3.5.2. Thư mục của module nghiệp vụ

| Module | Thư mục sở hữu |
|---|---|
| M-WS | `packages/server/src/core/workspace/` |
| M-DS | `packages/server/src/core/design-store/` |
| M-TK | `packages/model/src/tokens/` |
| M-SM | `packages/model/src/styling/` |
| M-SH | `packages/studio/src/routes/`, `src/features/shell/`, `src/features/settings/` |
| M-CV | `packages/studio/src/features/canvas/` (trừ `overlay/`), `packages/studio/canvas-frame/` |
| M-OV | `packages/studio/src/features/canvas/overlay/` |
| M-DD | `packages/studio/src/features/dnd/` |
| M-LB | `packages/model/src/presets/`, `packages/studio/src/features/library/` |
| M-IN | `packages/studio/src/features/inspector/` |
| M-LT | `packages/studio/src/features/layers/` |
| M-HS | `packages/studio/src/stores/editor/` |
| M-CB | `packages/model/src/clipboard/`, `packages/studio/src/features/clipboard/` |
| M-KB | `packages/studio/src/features/shortcuts/` |
| M-PG | `packages/studio/src/features/pages/` |
| M-TP | `packages/server/src/core/target-project/` (trừ `template/`, `token-import/`) |
| M-PT | `templates/`, `packages/server/src/core/target-project/template/` |
| M-CG | `packages/server/src/core/codegen/` (trừ `html/`, `data-layer/`) |
| M-HT | `packages/server/src/core/codegen/html/` |
| M-EX | `packages/server/src/core/export/` |
| M-VL | `packages/server/src/core/validation/` |
| M-XU | `packages/studio/src/features/export/` |
| M-AG | `packages/server/src/core/ai/gateway/`, `packages/server/src/adapters/ai/` |
| M-AC | `packages/server/src/core/ai/context/` |
| M-AP | `packages/server/src/core/ai/prompts/`, `packages/model/src/ai/` |
| M-AV | `packages/server/src/core/ai/validate/` |
| M-AR | `packages/studio/src/features/responsive-audit/` |
| M-AU | `packages/studio/src/features/ai/` |
| M-BS | `packages/server/src/core/backend-context/scanner/` |
| M-XO | `packages/server/src/core/backend-context/openapi/` |
| M-XJ | `packages/server/src/core/backend-context/js/` |
| M-XP | `packages/server/src/core/backend-context/python/` |
| M-XA | `packages/server/src/core/backend-context/ai-extract/` |
| M-DC | `packages/server/src/core/backend-context/catalog/`, `packages/studio/src/features/data-sources/` |
| M-DB | `packages/studio/src/features/data-binding/` |
| M-MK | `packages/model/src/mock/` |
| M-LP | `packages/server/src/core/data-proxy/`, `packages/studio/src/features/live-data/` |
| M-DL | `packages/server/src/core/codegen/data-layer/` |
| M-UC | `packages/model/src/components/`, `packages/studio/src/features/components/` |
| M-TM | `packages/studio/src/features/tokens/` |
| M-TI | `packages/server/src/core/target-project/token-import/` |
| M-LS | `packages/model/src/analysis/`, `packages/studio/src/features/layout-suggest/` |

Xem song song nhiều khung (WP-5.05, ADR-FE-08) thuộc M-CV. Operation `token.rename`, `token.replace` thuộc M-MC; M-TM chỉ có giao diện.

Mỗi module còn sở hữu: route HTTP của nó (`packages/server/src/adapters/http/routes/<module>.ts`), file dịch của nó (`packages/studio/src/i18n/locales/{vi,en}/<namespace>.json`), test đặt cạnh file nguồn (QC-01) và test E2E nó thêm (`e2e/<luồng>.e2e.ts`).

#### 3.5.3. Quy tắc

| Mã | Quy tắc |
|---|---|
| CW-39 | Một bộ thay đổi thuộc **đúng một** module và chỉ tạo, sửa, đổi tên file trong thư mục sở hữu của module đó. Ngoại lệ duy nhất là bộ khởi tạo repo của WP-0.01 (mục 4.3) |
| CW-40 | File dùng chung được phép sửa kèm, mỗi lần phải liệt kê trong báo cáo bộ thay đổi: dòng export trong `src/index.ts` của package, mục dependency trong `package.json` của package (chỉ thư viện đã duyệt, CW-11), dòng đăng ký route trong `routes/index.ts`, dòng khai báo namespace trong khung i18n. File gốc repo chỉ M-RP được sửa |
| CW-41 | Trong một module, bộ thay đổi mới chỉ bắt đầu khi bộ trước đã được commit. Các module khác nhau có thể có bộ thay đổi chờ commit cùng lúc |
| CW-42 | Thay đổi spec và báo cáo thi công đi thành bộ thay đổi riêng, không lẫn với code (scope `docs`) |

---

## 4. PHASE 0 — NỀN MÓNG

### 4.1. Mục tiêu

Mọi thứ cần có trước dòng code nghiệp vụ đầu tiên: repo đúng quy chuẩn, CI trên Windows và Ubuntu, khung bốn package chạy được, nền bảo mật mạng, i18n, hạ tầng kiểm thử, các VG nền tảng của Studio và server.

---

### 4.2. Gói công việc

| Mã | Nội dung | Spec | Phụ thuộc | Đầu ra kiểm chứng được |
|---|---|---|---|---|
| WP-0.01 | Khởi tạo repo theo mục 4.3 | SPEC-02 mục 2, 10, 11, 12; Q-07, Q-17 | — | Repo có cấu hình chuẩn, `main` được bảo vệ, hook chạy |
| WP-0.02 | CI: `ci.yml` (install, lint, typecheck, test, build trên Windows, Ubuntu, Node 22, 24), `nightly.yml` khung, `audit` | SPEC-02 mục 13 | 0.01 | PR mẫu chạy đủ job, tất cả xanh |
| WP-0.03 | Khung 4 package: `model`, `server` (Fastify, `/api/v1/session`), `studio` (Vite, màn hình trống có tiêu đề), `cli` (`parseArgs`, chọn cổng, mở trình duyệt với `#t=`). `pnpm dev`, `pnpm build`, đóng gói `reactcraft` bằng tsdown | ADR-BE-03, 04, 06, 25; ADR-FE-01, 02; SPEC-01.2 mục 3.3 | 0.01 | `node packages/cli/dist/index.js` mở Studio hiển thị "ReactCraft" và phiên bản |
| WP-0.04 | Nền bảo mật mạng: token phiên, Host/Origin, CSP, header, giới hạn body | SPEC-05 mục 5, 6, 14 | 0.03 | Nhóm "Xác thực", "Host/Origin", "Header" của SPEC-05 mục 17.1 đạt trong CI |
| WP-0.05 | Hạ tầng i18n: i18next, namespace, `pnpm check:i18n`, ESLint `no-literal-string`, nút đổi ngôn ngữ | ADR-FE-16; VG-12 | 0.03 | Job `i18n` trong CI. Đổi `vi`/`en` không tải lại trang |
| WP-0.06 | Hạ tầng kiểm thử: Vitest workspace, ngưỡng độ phủ (SPEC-02 mục 9), Playwright (Chromium, Firefox, Windows, Ubuntu), hàm sao chép fixture (QC-06), `pnpm bench` bằng `vitest bench`, `pnpm trace` (mục 11.4). Viết SPEC-06.0 | ADR-BE-26, ADR-FE-18; mục 18 | 0.02 | Job `test`, `e2e` có ít nhất một test thật; `pnpm bench` xuất JSON kết quả; SPEC-06.0 Đã duyệt |
| WP-0.07 | Fixture ban đầu: `fixtures/target-projects/vite8-react19-tw4`, `vite7-react18-tw3`; `fixtures/designs/all-nodes.json` (mọi loại node, mọi nhóm thuộc tính); script `scripts/gen-large-workspace.ts` sinh workspace 50 trang × 500 node theo môi trường tham chiếu SPEC-01.1 mục 11.1 | SPEC-01.1 mục 11.1, VG-03, VG-09 | 0.01 | Hai project mẫu `vite build` được; script sinh workspace xác định (cùng seed cùng kết quả) |
| WP-0.08 | Spike server: VG-01, VG-07 | SPEC-01.1 mục 12 | 0.03 | Báo cáo `docs/construction/vg/vg-01.md`, `vg-07.md` kết luận Đạt |
| WP-0.09 | Spike Studio: VG-10, VG-11, VG-13, VG-14, VG-09 giai đoạn A | SPEC-01.2 mục 13 | 0.03, 0.07 | Báo cáo VG tương ứng kết luận Đạt |
| WP-0.10 | Chuyển tài liệu vào repo: `docs/srs.md`, `docs/spec.md` (Q-08), `docs/construction/vg/`, `docs/construction/phases/`, `README.md`, `SECURITY.md` (SPEC-05 mục 17.2), `LICENSE` | Q-08, Q-17 | 0.01 | Bản trong repo là bản chính. Lịch sử thay đổi ghi lần chuyển |

---

### 4.3. Các bước khởi tạo repo (WP-0.01)

Thực hiện đúng thứ tự. Mỗi bước là một commit trên nhánh `chore/bootstrap` (ngoại lệ duy nhất của QC-83: PR khởi tạo gồm nhiều việc).

| Bước | Việc làm | Kiểm tra |
|---|---|---|
| 1 | Tạo repo GitHub (quyền truy cập theo Q-07), nhánh `main` | — |
| 2 | `.node-version` (`24`), `package.json` gốc (`"private": true`, `"type": "module"`, `"packageManager": "pnpm@<bản ghim>"`, `"engines": { "node": ">=22.12" }`) | `corepack enable && pnpm -v` khớp bản ghim |
| 3 | `pnpm-workspace.yaml` (`packages/*`), thư mục theo SPEC-02 mục 2.1 | `pnpm -r ls` liệt kê 4 package |
| 4 | `.editorconfig`, `.gitattributes` (LF), `.gitignore`, `.prettierrc.json` theo SPEC-02 mục 10 | `git ls-files --eol` không có CRLF |
| 5 | `tsconfig.base.json` (strict, ESM, `verbatimModuleSyntax`), `tsconfig.json` từng package | `pnpm typecheck` chạy |
| 6 | `eslint.config.js` theo ADR-BE-27, ADR-FE-19 (kể cả quy tắc phân lớp SPEC-01.2 mục 3.4) | `pnpm lint` chạy |
| 7 | `lefthook.yml`, `commitlint` với danh sách scope SPEC-02 mục 11.2 | Commit sai định dạng bị chặn |
| 8 | `@changesets/cli` init, `.github/pull_request_template.md` (SPEC-02 mục 12) | `pnpm changeset` chạy |
| 9 | Script gốc theo SPEC-02 mục 2.3 (kể cả script còn trống in "not implemented" và trả mã 0 chỉ được tồn tại tới hết Phase 0) | Mọi script chạy trên Windows và Ubuntu |
| 10 | Bảo vệ `main`: bắt buộc PR, bắt buộc CI, cấm force push (QC-73) | Push trực tiếp bị từ chối |
| 11 | Ghi phiên bản ghim vào SPEC-01.1 mục 13.3, SPEC-01.2 mục 14.3 | Bảng không còn ô trống cho package đã cài |

---

### 4.4. Cách chạy một VG

| Bước | Việc làm |
|---|---|
| 1 | Tạo nhánh `spike/vg-<số>` từ `main`. Code spike nằm trong `spikes/vg-<số>/` của nhánh đó |
| 2 | Viết quy trình đo đúng như mô tả VG (SPEC-01.1 mục 12, SPEC-01.2 mục 13). Không nới tiêu chí |
| 3 | Chạy trên môi trường tham chiếu (SPEC-01.1 mục 11.1). VG liên quan file, tiến trình, IME chạy thêm trên macOS |
| 4 | Viết báo cáo theo mẫu mục 19.1 vào `docs/construction/vg/vg-<số>.md`, mở PR loại `docs` chỉ chứa báo cáo |
| 5 | Kết luận **Đạt**: cập nhật trạng thái ADR (CW-15). Kết luận **Không đạt**: theo mục 14 |
| 6 | Phần code spike có giá trị dùng lại (ví dụ harness đo VG-06, VG-09) được **viết lại** theo quy chuẩn trong `scripts/vg/` qua PR bình thường. Không cherry-pick code spike |

| Mã | Quy tắc |
|---|---|
| CW-21 | Nhánh `spike/*` **KHÔNG BAO GIỜ** merge vào `main` |
| CW-22 | Báo cáo VG ghi phiên bản chính xác của mọi thư viện liên quan, hệ điều hành, phần cứng, số lần chạy, dữ liệu thô (hoặc đường dẫn tới artifact CI) |

---

### 4.5. Cổng `G0`

Tiêu chí chung GC-01 đến GC-12 (mục 11.3) và:

| Mã | Tiêu chí |
|---|---|
| G0-01 | WP-0.01 đến WP-0.10 Xong |
| G0-02 | VG-01, VG-07, VG-09 (A), VG-10, VG-11, VG-12, VG-13, VG-14 Đạt, báo cáo đã merge |
| G0-03 | CI xanh trên Windows và Ubuntu, Node 22 và 24, ở 5 lần chạy liên tiếp trên `main` (không có test chập chờn) |
| G0-04 | `pnpm dev` và CLI đã build chạy được trên Windows 11, macOS, Ubuntu |
| G0-05 | Các phần SPEC-00, SPEC-01.1, SPEC-01.2, SPEC-02, SPEC-03, SPEC-04.1, SPEC-05, SPEC-07 Đã duyệt. SPEC-06.0 Đã duyệt |
| G0-06 | Q-07, Q-17 đã quyết định |

---

### 4.6. Kịch bản nghiệm thu `G0`

1. Clone repo trên máy Windows sạch có Node 24, chạy `corepack enable`, `pnpm install`, `pnpm dev`.
2. Trình duyệt mở Studio, hiển thị "ReactCraft" và phiên bản. Đổi sang English, chữ đổi ngay.
3. Copy URL bỏ phần `#t=…`, mở tab mới: Studio báo phiên không hợp lệ (E014).
4. `curl -H "Host: evil.example" -H "Authorization: Bearer <token đúng>" http://127.0.0.1:<port>/api/v1/session` bị từ chối (E014).
5. Mở `docs/construction/vg/`: đủ 8 báo cáo, mỗi báo cáo kết luận Đạt kèm số đo.

---

## 5. PHASE 1 — STUDIO CORE

### 5.1. Mục tiêu

SRS mục 16: dựng được một trang tĩnh hoàn chỉnh bằng kéo thả. Theo CW-03, CW-04: model đầy đủ, hiển thị đầy đủ.

---

### 5.2. Gói công việc

| Mã | Nội dung | Spec | Phụ thuộc | Đầu ra kiểm chứng được |
|---|---|---|---|---|
| WP-1.01 | Model: schema Zod **đầy đủ** mọi kiểu ở SPEC-03 mục 2 đến 6a, 8; mã định danh; quy tắc hợp lệ của tài liệu (mọi V-xx về tài liệu, gồm V-56, V-57, V-90 đến V-99) | SPEC-03 phần A; ADR-BE-08, 10 | G0 | `fixtures/designs/all-nodes.json` hợp lệ; mỗi quy tắc V-xx có test vi phạm và test hợp lệ |
| WP-1.02 | Model: **mọi** operation (`validate`, `apply`, `invert`), `applyBatch`, `assignIds`, dạng phẳng (mục 5) | SPEC-03 mục 5, 7; ADR-BE-09 | 1.01 | Property test: `apply(invert(op))` trả đúng tài liệu ban đầu cho mọi loại operation; PB-01 |
| WP-1.03 | Model: khung migration (`schemaVersion` 1), `serializeCanonical` | ADR-BE-11; SPEC-04.1 mục 3 | 1.01 | Ghi hai lần giống từng byte; migration rỗng 1 → 1 chạy qua pipeline |
| WP-1.04 | Model: M-TK, M-SM (đủ bảng 5.3, cả `desktop-first` và `mobile-first`, trạng thái, `dark`, ảnh nền, transition) | SPEC-04.1 mục 4, 5; ADR-FE-06 | 1.01 | Golden test mọi dòng bảng 5.3 |
| WP-1.05 | Server: M-WS, M-DS, endpoint và sự kiện workspace, khóa E018, sao lưu, thay đổi bên ngoài, `/workspace/trust`, log pino có lọc secrets, cấu hình người dùng (env-paths) | SPEC-04.1 mục 2, 3; SPEC-03 mục 9 đến 11; SPEC-05 mục 7, 13, 15 | 1.02, 1.03 | PB-02, PB-03, PB-04; nhóm "Đường dẫn" của SPEC-05 mục 17.1 đạt |
| WP-1.06 | Studio: M-SH (Welcome, Editor, Settings, trạng thái tin cậy), router, REST/WS client, Editor Store, M-HS (Undo/Redo, đồng bộ, E017) | SPEC-04.1 mục 6, 13; ADR-FE-10 đến 12, 17 | 1.05 | Đóng server, mở lại: thiết kế còn nguyên |
| WP-1.07 | Studio: M-CV (iframe, portal, Tailwind runtime, khung, zoom, **mọi** 25 loại node kể cả `ComponentInstance`, `Slot`, node dữ liệu với dữ liệu mẫu), M-OV (hover, chọn, sửa chữ trực tiếp không định dạng) | SPEC-04.1 mục 7, 8; ADR-FE-04 đến 08, 20 | 1.04, 1.06 | `all-nodes.json` hiển thị đúng; PB-13, PB-16 |
| WP-1.08 | Studio: M-DD, M-LB (preset mục 10.2 trừ preset có tương tác), M-LT | SPEC-04.1 mục 9, 10, 12; ADR-FE-09 | 1.07 | AC-02; PB-15; kéo thả bằng bàn phím |
| WP-1.09 | Studio: M-IN (trừ mục 11.2 Tương tác và nhóm Dữ liệu: chỉ đọc theo CW-19), phạm vi responsive và trạng thái | SPEC-04.1 mục 11 | 1.07 | AC-03; PB-14 |
| WP-1.10 | Studio: M-CB, M-KB, M-PG | SPEC-04.1 mục 14 đến 16 | 1.08 | Phím tắt mục 15 hoạt động trên Windows và macOS |
| WP-1.11 | CLI hoàn chỉnh: mọi tham số ADR-BE-03, xử lý E018 kèm cổng phiên cũ, tắt an toàn (Ctrl+C lưu nốt), `npm pack` + `npx` từ tarball | ADR-BE-03, 25 | 1.05 | `npx ./reactcraft-<ver>.tgz` chạy trong thư mục trống trên 3 hệ điều hành; PB-10 |

---

### 5.3. Cổng `G1`

| Mã | Tiêu chí |
|---|---|
| G1-01 | AC-01, AC-02, AC-03 tự động hóa (E2E SPEC-04.1 mục 17.2), đạt trên Windows và Ubuntu, giao diện `vi` và `en` |
| G1-02 | Mọi test bắt buộc ở SPEC-04.1 mục 17.1 có và đạt |
| G1-03 | PB-01 đến PB-04, PB-10, PB-11, PB-13 đến PB-19 đạt ở 3 lần chạy `nightly` liên tiếp |
| G1-04 | VG-07, VG-10, VG-11, VG-13 (B) Đạt trên hệ thống thật |
| G1-05 | Schema phiên bản 1 đóng băng (CW-03): file `packages/model/schema-v1.json` sinh từ `z.toJSONSchema()` được commit; CI so sánh, đổi schema làm CI đỏ |
| G1-06 | NFR-06: tắt tiến trình server đột ngột (kill) 20 lần trong lúc thao tác, mất tối đa 2 s thao tác gần nhất; NFR-07: file trang hỏng khôi phục được từ bản sao lưu |
| G1-07 | SPEC-05 mục 17.1 nhóm "Đường dẫn", "Workspace trust", "Fuzz" (cho mọi endpoint đã có) đạt |
| G1-08 | Q-01 (tên package npm) đã quyết định |
| G1-09 | SPEC-04.2 Đã duyệt; SPEC-06.2 bản nháp có (DoR của Phase 2) |

---

### 5.4. Kịch bản nghiệm thu `G1`

1. `npx reactcraft@next` trong thư mục trống trên Windows. Welcome → tạo workspace "Shop" (`vi-VN`, desktop-first).
2. Kéo preset Thanh điều hướng, Hero, Lưới tự co giãn chứa 4 Card, Chân trang.
3. Ở khung 1440: lưới 4 cột. Chuyển khung 375: 1 cột. Đổi padding Card ở khung 375, quay lại 1440 thấy giá trị gốc.
4. Undo 10 lần, Redo 10 lần: đúng từng bước.
5. Thêm trang "Giới thiệu": route `/gioi-thieu`.
6. Đóng tab, Ctrl+C, chạy lại: mọi thứ còn nguyên.
7. Đổi giao diện sang English: không còn chữ tiếng Việt nào của Studio; nội dung thiết kế giữ nguyên tiếng Việt (NFR-17).

---

## 6. PHASE 2 — XUẤT CODE VÀ TƯƠNG TÁC

### 6.1. Mục tiêu

SRS mục 16: trang thiết kế trong Studio chạy được trong project thật. Kèm tương tác, Xem thử, rich text, chế độ tối, ràng buộc nhập liệu, project JavaScript và monorepo.

---

### 6.2. Gói công việc

| Mã | Nội dung | Spec | Phụ thuộc | Đầu ra kiểm chứng được |
|---|---|---|---|---|
| WP-2.00 | Spike VG-02, VG-03 (A), VG-08 | SPEC-01.1 mục 12 | G1 | Báo cáo Đạt |
| WP-2.01 | M-TP, M-PT (`templates/`), endpoint `/target-project/*` | SPEC-04.2 mục 2, 3 | 2.00 | Phát hiện đúng 2 project mẫu và 4 project không hỗ trợ (E001 kèm `reasons`) |
| WP-2.02 | M-CG: IR, lowering, emitter React (mục 5, 6.1 đến 6.6, 6.8), sinh User Component (mục 6.3) từ tài liệu có sẵn component, format (mục 7) | SPEC-04.2 mục 4 đến 7; ADR-BE-16 | 2.01 | Golden file; R-CG-01 (xác định); PB-06, PB-07 |
| WP-2.03 | M-CG: theme v3/v4, chế độ tối, chỉnh sửa hỗ trợ | SPEC-04.2 mục 8 | 2.02 | `theme.css`, `tailwind.config` đúng cho cả hai bản Tailwind |
| WP-2.04 | M-HT | SPEC-04.2 mục 9 | 2.02 | AC-10 |
| WP-2.05 | M-VL: T1, T2 (worker), T3 (tiến trình con) | SPEC-04.2 mục 11; SPEC-05 mục 10 | 2.02 | PB-09, PB-12; nhóm "Tiến trình con" SPEC-05 mục 17.1 |
| WP-2.06 | M-EX: kế hoạch, diff, transaction, manifest, xung đột, `orphaned`, bước thủ công | SPEC-04.2 mục 10; ADR-BE-17, 18 | 2.05 | AC-11; VG-01 (B) trên transaction thật |
| WP-2.07 | M-XU: màn hình Export, diff CodeMirror, chọn xử lý xung đột | SPEC-04.2 mục 12; ADR-FE-15 | 2.06 | E2E xuất, duyệt từng file, hủy |
| WP-2.08 | Tương tác: Inspector mục 11.2, R-LT-08, R-LT-09, preset có tương tác, Xem thử (mục 7.7), sinh code tương tác (SPEC-04.2 mục 6.7, R-HT-04) | SPEC-03 mục 6a; SPEC-04.1 mục 7.7, 11.2 | 2.02 | AC-14 |
| WP-2.09 | Rich text (thanh định dạng, SPEC-04.1 mục 8.4), chế độ tối (cài đặt, nút xem sáng/tối), ràng buộc nhập liệu (Inspector + codegen) | SPEC-04.1 mục 8.4; SPEC-03 mục 3.4a | 2.03 | AC-15; VG-14 (B) |
| WP-2.10 | Project JavaScript (SPEC-04.2 mục 6.9), monorepo (R-TP-04) | SPEC-04.2 | 2.02 | Thêm 2 fixture: `vite8-react19-js`, `monorepo-pnpm`; xuất và build đạt |
| WP-2.11 | Bảo mật code xuất ra | SPEC-05 mục 12 | 2.02 | Nhóm "Code xuất ra" SPEC-05 mục 17.1 |
| WP-2.12 | Job CI `export-compat` (VG-03 liên tục), harness VG-09 trong `scripts/vg/` | SPEC-02 mục 13.2 | 2.06 | Job chạy ở mọi PR |

---

### 6.3. Cổng `G2`

| Mã | Tiêu chí |
|---|---|
| G2-01 | AC-08 phần giao diện (xuất, `tsc --noEmit`, `vite build` không lỗi, trang chạy được; phần "gọi đúng API" ở `G4`), AC-09, AC-10, AC-11, AC-14, AC-15 tự động hóa và đạt |
| G2-02 | VG-01 (B), VG-02, VG-03 (B, tài liệu mẫu không có Binding), VG-08, VG-09 (B), VG-14 (B) Đạt |
| G2-03 | PB-06 đến PB-09, PB-12 đạt |
| G2-04 | NFR-09: 50 lần làm lỗi ngẫu nhiên giữa transaction (fault injection qua `FileSystemPort`), Target Project luôn ở trạng thái trước hoặc sau trọn vẹn |
| G2-05 | NFR-12, NFR-13: quét code xuất ra của `all-nodes.json` không có import `reactcraft`, không có `absolute` ngoài node overlay |
| G2-06 | SPEC-05 mục 17.1 nhóm "Code xuất ra", "Tiến trình con" đạt |
| G2-07 | SPEC-04.3 Đã duyệt; SPEC-06.3 bản nháp có |

---

### 6.4. Kịch bản nghiệm thu `G2`

1. Mở workspace "Shop" của `G1`. Tạo Target Project mới từ template.
2. Thêm nút "Thêm mới" mở Modal chứa form có ràng buộc bắt buộc; gửi thành công đóng Modal, hiện toast. Kiểm tra trong Xem thử ở 375 và 1440.
3. Đoạn văn có chữ đậm, liên kết, gõ bằng Telex. Bật chế độ tối theo hệ điều hành.
4. Xuất: xem diff, duyệt, ghi. Chạy `pnpm dev` của Target Project: giao diện khớp Canvas, tương tác chạy, đổi chế độ tối của hệ điều hành thì trang đổi màu.
5. Sửa tay một file đã xuất, xuất lại: hệ thống báo xung đột, không ghi đè.
6. Xuất HTML/CSS, mở `index.html` bằng trình duyệt: đúng bố cục.

---

## 7. PHASE 3 — AI

### 7.1. Mục tiêu

AI sửa phần tử đang chọn, dựng trang, tối ưu responsive. Mọi đề xuất qua đúng engine kiểm tra của thao tác tay, xem trước rồi mới áp dụng.

---

### 7.2. Gói công việc

| Mã | Nội dung | Spec | Phụ thuộc | Đầu ra kiểm chứng được |
|---|---|---|---|---|
| WP-3.00 | Spike VG-06 (A) với cả 4 provider; chọn model Ollama khuyến nghị | SPEC-01.1 VG-06; SPEC-04.3 mục 10.2 | G2 | Báo cáo Đạt, Q-04 có câu trả lời |
| WP-3.01 | M-AG, lưu API key ngoài workspace, kiểm tra Ollama | SPEC-04.3 mục 2; SPEC-05 mục 8, 9; ADR-BE-22, 24 | 3.00 | Key không bao giờ xuống trình duyệt (test) |
| WP-3.02 | M-AC mức 0 đến 2, xem trước ngữ cảnh, xác nhận lần đầu gửi ra ngoài | SPEC-04.3 mục 3 | 3.01 | Golden ngữ cảnh; bộ 40 yêu cầu chọn mức đúng |
| WP-3.03 | M-AP: prompt có phiên bản, danh mục node sinh từ schema, hợp đồng đầu ra | SPEC-04.3 mục 4 | 3.02 | Danh mục trong prompt khớp `z.toJSONSchema()` |
| WP-3.04 | M-AV: kiểm tra, sửa, thử lại, `outOfScope` | SPEC-04.3 mục 5 | 3.03 | Bộ 30 đầu ra lỗi cố ý ra đúng kết quả |
| WP-3.05 | M-AU: AI Panel, xem trước trên Canvas, chấp nhận, từ chối, sửa tiếp, `stale` | SPEC-04.3 mục 7 | 3.04 | AC-06 |
| WP-3.06 | M-AR, chế độ `optimizeResponsive` | SPEC-04.3 mục 6 | 3.05 | Trang mẫu 7 vấn đề RA đo đúng |
| WP-3.07 | Bộ phản hồi AI ghi sẵn cho CI (ADR-BE-26), harness VG-06 trong `scripts/vg/` | ADR-BE-26; QC-91 | 3.04 | CI không gọi provider thật |

---

### 7.3. Cổng `G3`

| Mã | Tiêu chí |
|---|---|
| G3-01 | AC-06 tự động hóa (phản hồi ghi sẵn) và đạt. AC-07 phần không dữ liệu: "Trang giới thiệu công ty có hero, 3 tính năng, chân trang" tạo trang hợp lệ |
| G3-02 | VG-06 (B) Đạt trên toàn pipeline với các nhóm không cần dữ liệu |
| G3-03 | NFR-08: provider trả lỗi, treo, hết hạn mức: thiết kế và xuất code vẫn hoạt động (E2E với provider giả) |
| G3-04 | NFR-16: tóm tắt AI theo ngôn ngữ giao diện, nội dung theo `contentLocale` |
| G3-05 | SPEC-05 mục 17.1 nhóm "AI" đạt; ngữ cảnh mọi mức không chứa chuỗi `RC_SECRET_MARKER_*` |
| G3-06 | Kiểm tra thủ công với provider thật: 10 yêu cầu ngẫu nhiên ngoài bộ VG-06 với mỗi provider, ghi kết quả vào báo cáo phase |
| G3-07 | SPEC-04.4 Đã duyệt; SPEC-06.4 bản nháp có |

---

### 7.4. Kịch bản nghiệm thu `G3`

1. Cấu hình OpenAI (hoặc Anthropic) và Ollama.
2. Chọn Card, yêu cầu "thêm nút Mua ngay dưới giá": xem ngữ cảnh sẽ gửi, gửi, xem trước, chấp nhận, Undo một bước.
3. "Tạo trang giới thiệu công ty": trang mới hợp lệ, chữ theo `contentLocale`.
4. Tối ưu điện thoại: audit báo vấn đề, chấp nhận, audit lại không còn vấn đề.
5. Tắt mạng: AI báo lỗi E008, mọi chức năng khác vẫn dùng được.

---

## 8. PHASE 4 — NGỮ CẢNH BACKEND

### 8.1. Mục tiêu

AI và người dùng dựng trang có dữ liệu thật của backend. Backend chỉ đọc trong mọi trường hợp.

---

### 8.2. Gói công việc

| Mã | Nội dung | Spec | Phụ thuộc | Đầu ra kiểm chứng được |
|---|---|---|---|---|
| WP-4.00 | Fixture backend: `express/`, `nestjs-prisma/`, `django/`, `openapi/` (bộ VG-04), `secrets/` (chuỗi `RC_SECRET_MARKER_*`); spike VG-04, VG-05 | SPEC-01.1 VG-04, VG-05; SPEC-05 mục 17.1 | G3 | Báo cáo Đạt |
| WP-4.01 | M-BS, lọc secrets, job và endpoint quét | SPEC-04.4 mục 2; SPEC-05 mục 8 | 4.00 | PB-05; nhóm "Secrets" SPEC-05 mục 17.1 |
| WP-4.02 | M-XO | SPEC-04.4 mục 3 | 4.01 | Bộ VG-04 trích đúng 100% |
| WP-4.03 | M-XJ | SPEC-04.4 mục 4 | 4.01 | AC-04 với Express |
| WP-4.04 | M-XP | SPEC-04.4 mục 5 | 4.01 | AC-04 với Django |
| WP-4.05 | M-XA | SPEC-04.4 mục 6 | 4.01, G3 | Trích xuất từ backend không hỗ trợ (fixture Fastify) qua phản hồi ghi sẵn |
| WP-4.06 | M-DC: catalog, duyệt, sửa, `stale` | SPEC-04.4 mục 7 | 4.02 | Quét lại sau khi đổi backend đánh dấu đúng `stale` |
| WP-4.07 | M-DB, M-MK | SPEC-04.4 mục 8, 9 | 4.06 | AC-05 |
| WP-4.08 | Hành động dữ liệu của tương tác (`refreshData`, `deleteRecord`, sau khi gửi form), 4 trạng thái dữ liệu trong Xem thử | SPEC-03 mục 6a; SPEC-04.4 mục 8 | 4.07 | Kịch bản xóa bản ghi trong Xem thử với dữ liệu mẫu |
| WP-4.09 | M-LP: proxy chỉ đọc | SPEC-04.4 mục 10; SPEC-05 mục 11 | 4.07 | Nhóm "Proxy" SPEC-05 mục 17.1 |
| WP-4.10 | M-DL: kiểu entity, client, auth, hook (có và không có react-query) | SPEC-04.4 mục 11 | 4.07 | AC-08 đầy đủ: trang xuất ra gọi đúng API của fixture Express đang chạy |
| WP-4.11 | M-AC mức 3, AI dựng trang có dữ liệu | SPEC-04.3 mục 3 | 4.06 | AC-07 |

---

### 8.3. Cổng `G4`

| Mã | Tiêu chí |
|---|---|
| G4-01 | AC-04, AC-05, AC-07, AC-08 (đầy đủ), AC-13 tự động hóa và đạt |
| G4-02 | VG-03 (B, tài liệu mẫu đầy đủ có Binding), VG-04, VG-05, VG-06 (B, nhóm "có dữ liệu"), VG-09 (B, trang có dữ liệu mẫu) Đạt |
| G4-03 | PB-05 đạt |
| G4-04 | R-BS-01: test xác nhận không có lần ghi, không tạo file, không chạy tiến trình nào trong thư mục backend suốt bộ E2E (theo dõi bằng watcher) |
| G4-05 | SPEC-05 mục 17.1 nhóm "Secrets", "Proxy" đạt |
| G4-06 | SPEC-04.5 Đã duyệt; SPEC-06.5 bản nháp có |

---

### 8.4. Kịch bản nghiệm thu `G4`

1. Liên kết backend Express mẫu. Quét: `Product(id, name, price, stock)` và `/api/products` CRUD, có nguồn gốc file và dòng. `.env` không bị đọc.
2. Kéo Table, gắn `/api/products`: 4 cột, dữ liệu mẫu đúng kiểu, tiếng Việt.
3. Xem thử bật dữ liệu thật (backend đang chạy): bảng hiện dữ liệu thật, không có request ghi nào được gửi.
4. AI: "tạo trang quản lý sản phẩm": bảng, tìm kiếm, nút thêm mở form đủ field, không có field bịa.
5. Xuất code: trang chạy, gọi đúng API, thêm sản phẩm thành công.
6. Lặp lại bước 1, 2 với backend Django.

---

## 9. PHASE 5 — NÂNG CAO VÀ PHÁT HÀNH 1.0

### 9.1. Mục tiêu

Thiết kế nhiều trang nhất quán và tái sử dụng được. Sản phẩm sẵn sàng phát hành 1.0.

---

### 9.2. Gói công việc

| Mã | Nội dung | Spec | Phụ thuộc | Đầu ra kiểm chứng được |
|---|---|---|---|---|
| WP-5.01 | M-UC: tạo từ vùng chọn, chế độ sửa, `propRef`, dùng component | SPEC-04.5 mục 2 đến 4 | G4 | AC-12 |
| WP-5.02 | M-UC: đổi props/slot với instance, tách, nhân bản, xóa | SPEC-04.5 mục 3.2, 5 | 5.01 | Property test tạo rồi tách trả về cây tương đương |
| WP-5.03 | M-TM: panel token, đổi tên, thay thế, tương phản, kiểu chữ mẫu | SPEC-04.5 mục 7 | G4 | E2E đổi `primary` đổi mọi nơi, cả code xuất ra |
| WP-5.04 | M-TI: nhập token từ Tailwind v3/v4 | SPEC-04.5 mục 8 | 5.03 | Nhập đúng từ 2 project mẫu |
| WP-5.05 | Xem song song nhiều khung | ADR-FE-08 | G4 | Sửa ở một khung, 3 khung cập nhật; PB-14 giữ nguyên |
| WP-5.06 | M-LS: gợi ý tách layout dùng chung | SPEC-04.5 mục 6a | 5.01 | AC-16; PB-20 |
| WP-5.07 | Hoàn thiện phát hành: tài liệu người dùng `vi`, `en` (README, hướng dẫn bắt đầu, cấu hình AI, giới hạn đã biết), kiểm tra giấy phép phụ thuộc, kiểm tra trên máy sạch (mục 17.3) | Mục 17 | 5.01 đến 5.06 | Danh sách kiểm tra mục 17.3 đạt |

---

### 9.3. Cổng `G5` (cổng phát hành 1.0)

| Mã | Tiêu chí |
|---|---|
| G5-01 | **Toàn bộ** AC-01 đến AC-16 tự động hóa và đạt trên Windows và Ubuntu, `vi` và `en` |
| G5-02 | **Toàn bộ** VG-01 đến VG-14 Đạt với phiên bản phụ thuộc sẽ phát hành |
| G5-03 | **Toàn bộ** PB-01 đến PB-20 đạt ở 3 lần chạy `nightly` liên tiếp |
| G5-04 | **Toàn bộ** NFR-01 đến NFR-17 có bằng chứng (test hoặc báo cáo đo) |
| G5-05 | SPEC-05 mục 17.1 đạt toàn bộ; mục 17.2 đã thực hiện |
| G5-06 | Không còn câu hỏi mở nào ngoài loại hành chính đã có ngày quyết định |
| G5-07 | Không còn cờ tính năng nào (CW-20): `RELEASED_PHASE = 5` |
| G5-08 | Danh sách kiểm tra phát hành mục 17.3 đạt |

---

### 9.4. Kịch bản nghiệm thu `G5`

1. Trên máy sạch (Windows, macOS, Ubuntu): `npx reactcraft` trong thư mục trống.
2. Dựng workspace "Shop" 3 trang: trang chủ, trang bán hàng, trang quản lý.
3. Card sản phẩm lặp lại ở 2 trang: bảng "Gợi ý component" đề xuất tách, chấp nhận, giao diện không đổi; Undo một bước khôi phục.
4. `ProductCard` có slot `actions`: trang bán hàng đặt nút "Thêm vào giỏ", trang quản lý đặt nút Sửa, Xóa.
5. Nhập token từ Target Project, đổi màu `primary`, xem song song 3 khung.
6. Xuất, build, chạy: toàn bộ tương tác, dữ liệu, chế độ tối hoạt động.

---

## 10. DEFINITION OF READY

### 10.1. Cho một gói công việc

Một WP chỉ chuyển sang "Đang làm" khi **mọi** điều sau đúng:

| Mã | Điều kiện |
|---|---|
| DR-01 | Mọi phần spec mà WP dẫn chiếu ở trạng thái **Đã duyệt** |
| DR-02 | Mọi VG mà WP phụ thuộc đã Đạt giai đoạn A (CW-13) |
| DR-03 | Mọi WP phụ thuộc (cột "Phụ thuộc") đã Xong |
| DR-04 | Đầu vào, đầu ra, quy tắc xử lý, mã lỗi của WP đều có mã trong spec (R-xx, V-xx, E0xx, S-xx). Không có hành vi "tự hiểu" |
| DR-05 | Fixture cần dùng đã có trong `fixtures/` |
| DR-06 | Tiêu chí kiểm thử đã biết: mục "Tiêu chí kiểm thử" của SPEC-04.x và phần SPEC-06 của phase (mục 18) |
| DR-07 | Không có câu hỏi mở (Q-xx) ảnh hưởng trực tiếp tới WP |
| DR-08 | WP được chia thành các PR, mỗi PR đạt QC-82, QC-83, nhánh không sống quá QC-75 |
| DR-09 | Namespace i18n cho chuỗi mới đã xác định |

---

### 10.2. Cho một phase

Phase *n* bắt đầu khi:

1. Cổng `G<n − 1>` đạt và báo cáo phase *n − 1* đã merge.
2. Mọi phần spec thuộc phạm vi phase *n* (bảng 3.1) Đã duyệt.
3. SPEC-06.*n* có bản nháp (mục 18).
4. Sổ rủi ro (mục 16) đã rà lại cho phase *n*.

---

## 11. DEFINITION OF DONE

### 11.1. Ba cấp

| Cấp | Định nghĩa | Ai xác nhận |
|---|---|---|
| Thay đổi (một PR) | SPEC-02 mục 14 | Người review PR |
| Gói công việc | Mục 11.2 | Người làm, kiểm bằng danh sách |
| Phase | Tiêu chí chung (mục 11.3) và tiêu chí riêng `G<n>-xx` | Chủ sản phẩm duyệt báo cáo phase |

---

### 11.2. Gói công việc Xong khi

| Mã | Điều kiện |
|---|---|
| DW-01 | Mọi PR của WP đã merge, đạt Definition of Done của SPEC-02 mục 14 |
| DW-02 | Cột "Đầu ra kiểm chứng được" của WP được chứng minh bằng test tự động hoặc báo cáo đo |
| DW-03 | Mọi quy tắc R-xx của module trong WP và mọi V-xx, S-xx WP hiện thực có ít nhất một test gắn mã (mục 11.4). `pnpm trace` báo 100% cho phạm vi WP |
| DW-04 | Ngân sách PB-xx liên quan đo bằng `pnpm bench`, đạt |
| DW-05 | Không còn lỗi SEV-1, SEV-2 (mục 15) thuộc WP |
| DW-06 | Mọi sai khác so với spec phát hiện trong lúc làm đã được đưa vào spec (mục 13.4) |
| DW-07 | Chức năng chưa qua cổng nằm sau cờ tính năng đúng (CW-17 đến CW-19) |
| DW-08 | Trạng thái WP cập nhật trên bảng theo dõi (mục 12.4) |

---

### 11.3. Tiêu chí chung của mọi cổng

| Mã | Tiêu chí |
|---|---|
| GC-01 | Mọi WP của phase Xong |
| GC-02 | CI xanh ở 5 lần chạy liên tiếp trên `main`, không có test bị bỏ qua (QC-92) |
| GC-03 | Độ phủ đạt ngưỡng SPEC-02 mục 9 |
| GC-04 | `pnpm trace`: 100% quy tắc R-xx, V-xx, S-xx thuộc phạm vi các phase đã làm có test gắn mã |
| GC-05 | Không còn lỗi SEV-1, SEV-2 đang mở. Lỗi SEV-3 có kế hoạch xử lý trong phase kế tiếp |
| GC-06 | VG-12 đạt; ảnh chụp mọi màn hình mới ở `vi` không tràn chữ |
| GC-07 | E2E toàn bộ các phase trước vẫn đạt (hồi quy) |
| GC-08 | `pnpm audit`: không có lỗ hổng high trở lên |
| GC-09 | Kịch bản nghiệm thu của phase chạy tay trên Windows và macOS, quay màn hình lưu kèm báo cáo |
| GC-10 | Báo cáo phase (mục 19.2) đã merge vào `docs/construction/phases/phase-<n>.md` |
| GC-11 | Spec và SRS đã cập nhật theo mọi thay đổi trong phase; Lịch sử thay đổi có dòng tương ứng |
| GC-12 | Phát hành phiên bản của phase (bảng 3.1) theo mục 17, trừ `G0` |

---

### 11.4. Truy vết quy tắc tới test

Test gắn mã quy tắc theo QC-93, `pnpm trace` lập báo cáo theo QC-94 (SPEC-02 mục 9).

**Phạm vi theo phase** lưu trong `scripts/trace-scope.json`, lập từ mục 20.3 và 20.4:

| Loại mã | Phase |
|---|---|
| `V-xx` | Phase 1 (model đầy đủ, CW-03) |
| `R-<module>-nn` | Phase của WP chứa module (mục 20.3). Quy tắc của một module chia nhiều phase (ví dụ M-IN mục 11.2) ghi ngoại lệ theo từng mã |
| `S-xx` | Phase của WP chứa nhóm biện pháp (mục 20.4) |
| `AC-xx` | Cổng đạt lần đầu (mục 20.1) |

`pnpm trace` chỉ đòi test cho mã có phase ≤ phase đang làm. Thêm, bớt mã trong spec **BẮT BUỘC** cập nhật `trace-scope.json` trong cùng PR.

---

## 12. QUY TRÌNH LÀM MỘT GÓI CÔNG VIỆC

### 12.1. Các bước

| Bước | Việc làm | Đầu ra |
|---|---|---|
| 1 | Chọn WP có trạng thái "Sẵn sàng" theo thứ tự phụ thuộc | — |
| 2 | Kiểm DR-01 đến DR-09 | WP chuyển "Đang làm" |
| 3 | Chia WP thành các PR. Mỗi PR một task packet (12.2) | Danh sách PR trong issue WP |
| 4 | Với mỗi PR: tạo nhánh (QC-74), viết test trước cho quy tắc có mã, hiện thực, chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm trace` cục bộ | Nhánh có commit đúng QC-76 |
| 5 | Mở PR theo mẫu SPEC-02 mục 12, mục "Spec references" liệt kê mã | PR |
| 6 | Review theo SPEC-02 mục 12.3. Phát hiện spec thiếu hoặc sai: dừng PR, xử lý theo mục 13.4 | PR được duyệt |
| 7 | Squash merge (QC-84) | Commit trên `main` |
| 8 | Khi PR cuối merge: kiểm DW-01 đến DW-08 | WP chuyển "Xong" |

---

### 12.2. Task packet

Mỗi PR có một task packet, đặt trong mô tả issue con hoặc đầu PR. Khi giao cho AI coding assistant, task packet là **toàn bộ** chỉ dẫn (QC-89).

```markdown
## Task: <tiêu đề, trùng tiêu đề PR dự kiến>
WP: WP-1.08 · Module: M-DD · Branch: feat/<số issue>-<mô-tả>

### Spec (trích nguyên văn, không tóm tắt)
- SPEC-04.1 mục 9.2, R-DD-01 đến R-DD-06
- SPEC-03 V-10 đến V-20 (quy tắc chứa)
- ADR-FE-09

### Phạm vi
Làm: <liệt kê>
Không làm: <liệt kê, kèm WP sẽ làm>

### File được phép tạo, sửa
- packages/studio/src/features/dnd/drop-target.ts (mới)
- packages/studio/src/features/dnd/drop-target.test.ts (mới)

### Giao diện bắt buộc (chữ ký hàm, kiểu)
<trích từ SPEC-03 hoặc định nghĩa ở đây nếu là chi tiết nội bộ>

### Test bắt buộc (tên test kết thúc bằng mã, QC-93)
- it('computes insert index for flex-row by pointer midpoint [R-DD-02]')
- ...

### Tiêu chí xong
- [ ] Test trên đạt, độ phủ thư mục ≥ ngưỡng
- [ ] PB-15 đo bằng pnpm bench
- [ ] Không thêm dependency
- [ ] Chuỗi hiển thị có khóa vi + en
```

---

### 12.3. Quy tắc khi dùng AI coding assistant

Bổ sung cho QC-87 đến QC-90.

| Mã | Quy tắc |
|---|---|
| CW-23 | AI chỉ được sửa file trong danh sách "File được phép" của task packet. Sửa file khác: hủy kết quả, cập nhật task packet nếu thực sự cần |
| CW-24 | AI **KHÔNG ĐƯỢC** tự thêm dependency, tự đổi cấu hình lint, TypeScript, CI, hoặc tắt quy tắc ESLint bằng comment |
| CW-25 | AI **KHÔNG ĐƯỢC** sửa test có sẵn để test đạt. Test sai thì sửa trong PR riêng có lý do |
| CW-26 | Kiểu, tên hàm, mã lỗi, khóa i18n do AI đặt phải khớp spec. Tên không có trong spec mà là API công khai của package: bổ sung spec trước (CW-01) |
| CW-27 | Người tạo PR đọc toàn bộ diff trước khi mở PR và chạy lại toàn bộ lệnh kiểm tra cục bộ. "AI nói đã chạy" không được tính |

---

### 12.4. Theo dõi tiến độ

| Thành phần | Cách làm |
|---|---|
| Milestone | Mỗi phase một milestone GitHub: `Phase 0` đến `Phase 5` |
| Issue WP | Mỗi WP một issue theo mẫu mục 19.3, nhãn `wp`, `phase:<n>` |
| Issue con | Mỗi PR dự kiến một issue con (task packet), liên kết issue WP |
| Trạng thái WP | `Chưa sẵn sàng` → `Sẵn sàng` (đạt DoR) → `Đang làm` → `Đang nghiệm thu` (PR cuối đã merge, đang kiểm DW) → `Xong` |
| Lỗi | Issue nhãn `bug`, `sev:<1..4>`, `phase:<n>` |
| Bảng tổng | GitHub Projects: cột theo trạng thái WP, nhóm theo milestone |

Khi repo chưa có trên GitHub, bảng tiến độ trong `docs/construction/progress.md` (mục 12.5) là nơi theo dõi duy nhất. Khi đã có GitHub, issue và Projects dùng để điều phối hằng ngày, còn `progress.md` là bản báo cáo chính thức nằm trong repo.

---

### 12.5. Báo cáo thi công

Báo cáo thi công **tách riêng** khỏi Spec, mỗi loại một file, tất cả nằm trong `docs/construction/`:

| File | Nội dung | Mẫu | Cập nhật khi |
|---|---|---|---|
| `progress.md` | Bảng tiến độ tổng: trạng thái mọi phase, mọi WP, việc chờ chủ sản phẩm, vướng mắc, bước tiếp theo | 19.4 | Mỗi lần một WP đổi trạng thái, mỗi buổi làm việc |
| `modules.md` | Trạng thái từng module, bộ thay đổi chờ commit và đã commit | 19.6 | Mỗi lần một bộ thay đổi được giao hoặc được commit |
| `wp/wp-<phase>.<số>.md` | Báo cáo một gói công việc: việc đã làm, các bộ thay đổi, kiểm chứng, sai khác so với spec, việc còn lại | 19.5 | Từ khi WP chuyển "Đang làm" tới khi "Xong" |
| `vg/vg-<số>.md` | Báo cáo một Verification Gate | 19.1 | Mỗi lần chạy VG (mục 4.4) |
| `phases/phase-<n>.md` | Báo cáo cổng nghiệm thu | 19.2 | Khi đóng cổng (GC-10) |

| Mã | Quy tắc |
|---|---|
| CW-35 | Tiến độ, kết quả kiểm chứng, sự cố, việc chờ xử lý của thi công **chỉ** ghi trong `docs/construction/`. **KHÔNG** ghi vào Spec hay Lịch sử thay đổi của Spec |
| CW-36 | Thi công phát hiện spec cần đổi: sửa Spec theo mục 13 (Lịch sử thay đổi ghi nội dung đặc tả đã đổi). Báo cáo WP chỉ dẫn chiếu mã và phiên bản Spec, không chép nội dung Spec |
| CW-37 | Mỗi WP chuyển sang "Đang làm" thì tạo ngay file báo cáo WP. File không bị xóa khi WP Xong, để làm hồ sơ nghiệm thu |
| CW-38 | Báo cáo ghi sự thật đã kiểm chứng: lệnh đã chạy, kết quả, checksum, đường dẫn. Việc chưa chạy được ghi rõ là chưa chạy và lý do |

---

### 12.6. Chế độ thi công local

Áp dụng khi repo chỉ nằm trên máy chủ sản phẩm, chưa đưa lên GitHub. Chủ sản phẩm tự commit. Đây là chế độ hiện hành cho tới khi chủ sản phẩm quyết định đưa repo lên GitHub.

#### 12.6.1. Thay thế so với quy trình trên GitHub

| Quy trình trên GitHub | Ở chế độ local |
|---|---|
| Tạo repo GitHub, bảo vệ `main` (mục 4.3 bước 1, 10; QC-73) | Hoãn. Repo Git chỉ trên máy, nhánh `main` |
| Nhánh ngắn hạn, Pull Request, squash merge (QC-74, QC-82 đến QC-85) | Bộ thay đổi (mục 3.5). Chủ sản phẩm xem xét theo danh sách SPEC-02 mục 12.3 rồi tự commit. Có dùng nhánh hay không do chủ sản phẩm quyết định |
| CI (`ci.yml`, SPEC-02 mục 13) | Lệnh `pnpm verify` chạy trên máy chủ sản phẩm, gồm các kiểm tra của CI chạy được ở máy local. File `.github/` vẫn nằm trong repo để dùng khi lên GitHub |
| Issue, milestone, GitHub Projects (mục 12.4) | `docs/construction/progress.md` và `docs/construction/modules.md` |
| Tiêu chí cổng về CI (GC-02, G0-03), chạy trên Windows **và** Ubuntu, Node 22 **và** 24 | Đánh giá bằng `pnpm verify` trên máy chủ sản phẩm. Phần đa nền tảng ghi "Hoãn tới khi bật CI" và **BẮT BUỘC** đạt khi bật CI, trước lần phát hành đầu tiên |
| Phát hành npm (mục 17) | Hoãn |

#### 12.6.2. Quy tắc

| Mã | Quy tắc |
|---|---|
| CW-43 | Claude **KHÔNG** commit, **KHÔNG** tạo nhánh, **KHÔNG** sửa nội dung thư mục `.git`. Khi cần xem trạng thái Git, chỉ dùng lệnh đọc kèm `--no-optional-locks` (ví dụ `git --no-optional-locks status`) để không để lại file khóa |
| CW-44 | Mỗi bộ thay đổi có báo cáo trong file WP tương ứng (mẫu mục 19.5): mã bộ, module, danh sách file tạo, sửa, đổi tên; file dùng chung đã sửa (CW-40); lệnh kiểm chứng đã chạy và kết quả; commit message gợi ý; trạng thái `Chờ commit` hoặc `Đã commit <hash>` |
| CW-45 | Commit message gợi ý theo SPEC-02 mục 11.2: scope theo package, `Refs:` ghi mã WP, mã module và mã spec. **KHÔNG** thêm dòng ghi công cho công cụ AI (`Co-Authored-By` và tương tự). Người commit là chủ sản phẩm |
| CW-46 | Khi chủ sản phẩm báo đã commit (hoặc Claude thấy commit qua lệnh đọc ở CW-43), báo cáo cập nhật trạng thái bộ thay đổi thành `Đã commit <hash>` |
| CW-47 | Khi chuyển sang GitHub: bật lại WP-0.02 (CI) và bảo vệ nhánh, chạy CI cho toàn bộ tiêu chí đã đánh dấu "Hoãn tới khi bật CI", ghi kết quả vào báo cáo phase |

---

## 13. KIỂM SOÁT THAY ĐỔI SPEC

### 13.1. Trạng thái một phần spec

| Trạng thái | Ý nghĩa | Thay đổi được bằng cách |
|---|---|---|
| **Draft — chờ duyệt** | Đang soạn. Mã định danh có thể đánh lại (Phần 0 mục 0.4) | Sửa trực tiếp, ghi Lịch sử thay đổi |
| **Đã duyệt v1.x** | Chủ sản phẩm đã duyệt. Mã định danh đóng băng. Là căn cứ thi công và nghiệm thu | Chỉ qua yêu cầu thay đổi (13.3) |
| **Thay thế** | Toàn bộ phần được thay bằng phần khác | — |

Duyệt một phần: chủ sản phẩm đọc toàn bộ phần, các câu hỏi mở của phần đã có câu trả lời hoặc giả định được chấp nhận, đổi trạng thái thành "Đã duyệt v1.0", ghi ngày vào Lịch sử thay đổi.

---

### 13.2. Phân loại thay đổi

| Loại | Ví dụ | Yêu cầu |
|---|---|---|
| **Làm rõ** | Sửa lỗi chính tả, thêm ví dụ, ghi rõ điều đã ngầm định, không đổi hành vi | PR loại `spec`, ghi Lịch sử thay đổi. Tăng phiên bản phần ở chữ số sau (v1.0 → v1.0.1) |
| **Thay đổi hành vi** | Thêm hoặc đổi quy tắc R-xx, V-xx, trường dữ liệu, endpoint, mã lỗi | Yêu cầu thay đổi (13.3). Phiên bản phần v1.0 → v1.1 |
| **Đổi ADR** | Đổi thư viện, đổi kiến trúc | Như trên, ADR cũ Superseded, ADR mới (Phần 0 mục 0.6 quy tắc 5). VG liên quan chạy lại |
| **Đổi yêu cầu** | Thêm, bỏ, đổi FR, NFR, AC | Như trên, kèm cập nhật SRS |

---

### 13.3. Yêu cầu thay đổi (CR)

Mỗi yêu cầu thay đổi có mã `CR-<số 3 chữ số>`, là một issue nhãn `spec-change` gồm:

| Mục | Nội dung |
|---|---|
| Lý do | Vấn đề phát hiện, bằng chứng (test, báo cáo VG, đo đạc) |
| Thay đổi đề xuất | Đoạn spec cũ và đoạn spec mới |
| Ảnh hưởng | Danh sách mã bị ảnh hưởng (FR, ADR, R-xx, V-xx, E0xx, PB, AC), WP đã xong cần làm lại, schema có đổi không (CW-03), file workspace cũ có cần migration không |
| Phương án đã xem xét | Ít nhất một phương án khác và lý do không chọn |
| Quyết định | Chủ sản phẩm duyệt hoặc từ chối, ghi ngày |

| Mã | Quy tắc |
|---|---|
| CW-28 | PR thay đổi spec (loại `spec`) merge **trước** PR code hiện thực thay đổi đó |
| CW-29 | CR làm đổi schema sau `G1` **BẮT BUỘC** kèm migration và test nâng cấp từ mọi phiên bản schema đã phát hành |
| CW-30 | CR không được làm một cổng đã đạt trở thành không đạt mà không mở lại WP tương ứng |

---

### 13.4. Phát hiện spec thiếu hoặc sai trong lúc code

1. Dừng phần việc bị ảnh hưởng. Không đoán, không "tạm làm thế này".
2. Ghi vấn đề vào issue WP, gắn nhãn `spec-gap`.
3. Thuộc loại **Làm rõ**: sửa spec qua PR `spec`, merge, làm tiếp.
4. Thuộc loại khác: mở CR (13.3). Phần việc không bị ảnh hưởng của WP được làm tiếp.

---

## 14. XỬ LÝ VG KHÔNG ĐẠT

### 14.1. Quy trình

| Bước | Việc làm |
|---|---|
| 1 | Báo cáo VG ghi kết quả Không đạt, số đo, nguyên nhân phân tích được |
| 2 | **Vòng chỉnh 1:** tìm cách đạt trong phạm vi ADR hiện tại (cấu hình, cách dùng thư viện, tối ưu). Chạy lại VG |
| 3 | **Vòng chỉnh 2:** như bước 2 với hướng khác. Chạy lại VG |
| 4 | Vẫn không đạt: dùng phương án dự phòng ở 14.2 qua CR (13.3), loại "Đổi ADR". Chạy VG với phương án mới |
| 5 | Phương án dự phòng cũng không đạt: CR loại "Đổi yêu cầu" (nới tiêu chí hoặc thu hẹp phạm vi), cập nhật SRS |

| Mã | Quy tắc |
|---|---|
| CW-31 | **KHÔNG ĐƯỢC** nới tiêu chí VG để "đạt". Nới tiêu chí chỉ qua bước 5 |
| CW-32 | Code phụ thuộc ADR đang có VG Không đạt **KHÔNG ĐƯỢC** merge vào `main` |

---

### 14.2. Phương án dự phòng

| VG | Phương án dự phòng | Ảnh hưởng |
|---|---|---|
| VG-01 | Tự viết ghi nguyên tử: ghi file tạm cùng thư mục, `fsync`, `rename` với retry lũy tiến khi `EPERM`/`EBUSY` (tối đa 10 lần, tổng ≤ 2 s) | ADR-BE-18; bỏ `write-file-atomic` |
| VG-02 | Chạy Prettier của chính Target Project (trong `node_modules` của nó) qua tiến trình con | ADR-BE-16; PB-07 nới theo đo đạc |
| VG-03 | Sửa quy tắc sinh code gây lỗi. Nếu do giới hạn của Vite 7/React 18/Tailwind v3: thu hẹp ma trận tương thích | ADR-BE-05; SRS mục 11.4 |
| VG-04 | Thay bằng `@readme/openapi-parser` (cùng API, nhánh được bảo trì của swagger-parser) | ADR-BE-14 |
| VG-05 | Django đọc qua schema OpenAPI do DRF sinh (`drf-spectacular`, `/api/schema/`) nếu có trong repo, phần còn lại qua M-XA. Thông báo rõ mức hỗ trợ thấp hơn | ADR-BE-13; SPEC-04.4 mục 5 |
| VG-06 | Provider dưới ngưỡng được gắn nhãn "Thử nghiệm" trong Settings kèm cảnh báo. Ollama: chọn model khác. Tất cả provider dưới ngưỡng: rà prompt (M-AP), hợp đồng đầu ra, chiến lược sửa (M-AV) | ADR-BE-22; SPEC-04.3 |
| VG-07 | Chuyển sang `node:http` + `ws` | ADR-BE-06 |
| VG-08 | Type check bằng `tsc` của Target Project qua tiến trình con, với thư mục tạm **ngoài** project chứa file sinh ra và `tsconfig` kế thừa | ADR-BE-19; PB-09 nới theo đo đạc |
| VG-09, VG-10 | Canvas dùng CSS do server biên dịch bằng `tailwindcss` v4 (đã có trong danh sách phụ thuộc) và đẩy xuống iframe qua WebSocket khi tập class đổi | ADR-FE-05; PB-14 phân bổ lại |
| VG-11 | Bỏ `@dnd-kit`, tự viết lớp sự kiện con trỏ (Pointer Events + `setPointerCapture`) trên Overlay; thuật toán thả giữ nguyên | ADR-FE-09 |
| VG-12 | Không có dự phòng: lỗi bản dịch phải sửa | — |
| VG-13 | Tắt React Compiler toàn cục, dùng `memo`/`useMemo` thủ công ở các điểm nóng đã đo | ADR-FE-02 |
| VG-14 | Tự viết trình soạn trên `contenteditable` chỉ cho 3 định dạng (đậm, nghiêng, liên kết) với xử lý `compositionstart`/`compositionend` | ADR-FE-20 |

---

## 15. LỖI VÀ MỨC NGHIÊM TRỌNG

| Mức | Định nghĩa | Ví dụ | Xử lý |
|---|---|---|---|
| **SEV-1** | Mất dữ liệu, hỏng file của người dùng, lỗ hổng bảo mật, ghi ra ngoài phạm vi, ghi vào thư mục backend | Transaction ghi dở; secrets lọt vào AI context | Dừng mọi WP khác cho tới khi sửa. Thêm test tái hiện (QC-70). Phát hành bản vá nếu đã phát hành |
| **SEV-2** | Chức năng chính không dùng được, không có cách vòng | Không xuất được; kéo thả sai vị trí; code xuất ra không build | Chặn cổng. Sửa trước khi đóng WP |
| **SEV-3** | Chức năng sai nhưng có cách vòng, hoặc vượt ngân sách hiệu năng ≤ 20% | Phím tắt không chạy trên Firefox | Không chặn cổng nếu có kế hoạch sửa trong phase kế tiếp (GC-05) |
| **SEV-4** | Hiển thị, chữ, trải nghiệm nhỏ | Căn lề lệch 2 px trong Inspector | Sửa khi tiện |

Lỗi chỉ xảy ra trên Windows giữ nguyên mức (CW-10). Vượt ngân sách PB-xx trên 20% là SEV-2.

---

## 16. QUẢN LÝ RỦI RO

### 16.1. Sổ rủi ro

| Mã | Rủi ro | Khả năng | Ảnh hưởng | Dấu hiệu | Biện pháp | Theo dõi tại |
|---|---|---|---|---|---|---|
| RK-01 | Canvas không khớp code xuất ra (Tailwind runtime khác bản biên dịch) | Trung bình | Cao | VG-09 A sai khác > 1% | VG-09 làm ở Phase 0; dự phòng 14.2 | WP-0.09, `G2` |
| RK-02 | Kéo thả trong iframe sai vị trí ở zoom khác 100% hoặc lưới lồng sâu | Trung bình | Cao | VG-11 thất bại một phần | Thuật toán thả tự viết, test với layout giả lập (SPEC-04.1 mục 17.1) | WP-0.09, WP-1.08 |
| RK-03 | AI trả operation không hợp lệ quá nhiều, nhất là Ollama | Cao | Trung bình | VG-06 A dưới ngưỡng | Structured output, sửa tự động, thử lại 1 lần, danh mục sinh từ schema | WP-3.00 |
| RK-04 | Khóa file trên Windows (Defender, VS Code) làm ghi lỗi | Trung bình | Cao | VG-01 có lần ghi lỗi | Retry ADR-BE-18, transaction, sao lưu | WP-0.08, `G2` |
| RK-05 | Thư viện mới (Vite 8, TypeScript 6, React Compiler, Zod 4) có lỗi hoặc đổi API | Trung bình | Trung bình | Lỗi build sau khi nâng phiên bản | Ghim phiên bản (13.3), chạy lại VG khi nâng major (CW-14) | Mọi phase |
| RK-06 | Trích xuất backend sai với code thực tế đa dạng | Cao | Trung bình | Fixture thật cho kết quả thiếu | Kết quả là đề xuất cần duyệt (R-BS-03), có nguồn gốc và mức tin cậy, sửa tay trong catalog | Phase 4 |
| RK-07 | Lệch spec: code đi một đường, spec một nẻo | Trung bình | Cao | `pnpm trace` báo mã trong test không có trong spec | CW-01, QC-94, GC-11, review theo mã | Mọi phase |
| RK-08 | Phạm vi phình ra trong lúc làm | Trung bình | Cao | PR có thay đổi không có mã spec | CW-06; mọi thứ mới qua CR | Mọi phase |
| RK-09 | Hiệu năng giảm với workspace lớn | Trung bình | Trung bình | `nightly` báo xu hướng tăng | Workspace mẫu lớn từ Phase 0 (WP-0.07), bench hằng đêm | Từ Phase 1 |
| RK-10 | Gõ tiếng Việt (IME) lỗi trong trình soạn trong iframe | Trung bình | Cao (người dùng Việt) | VG-14 mất hoặc lặp ký tự | VG-14 ở Phase 0; dự phòng 14.2 | WP-0.09 |
| RK-11 | Lỗ hổng bảo mật do server local bị trang web khác gọi tới | Thấp | Rất cao | Test 17.1 nhóm Host/Origin thất bại | Nền bảo mật ở Phase 0 (WP-0.04), fuzz | Mọi phase |
| RK-12 | API của AI provider đổi | Trung bình | Thấp | Lỗi E008 tăng | AI SDK làm lớp trung gian; phản hồi ghi sẵn trong CI | Phase 3 trở đi |
| RK-13 | Code do AI coding assistant viết không theo spec | Cao | Trung bình | Review phát hiện tên, kiểu, hành vi không có trong spec | Task packet (12.2), CW-23 đến CW-27 | Mọi phase |
| RK-14 | Schema phải đổi sau khi đóng băng | Thấp | Cao | CR đụng SPEC-03 phần A | CW-03 làm model đầy đủ từ Phase 1; migration bắt buộc (CW-29) | Từ `G1` |

---

### 16.2. Quy tắc

| Mã | Quy tắc |
|---|---|
| CW-33 | Sổ rủi ro rà lại ở đầu mỗi phase (mục 10.2) và trong báo cáo phase |
| CW-34 | Rủi ro xảy ra thành sự cố: ghi vào báo cáo phase (nguyên nhân, xử lý, bài học) và cập nhật biện pháp |

---

## 17. PHÁT HÀNH

### 17.1. Phiên bản

| Thời điểm | Phiên bản | npm dist-tag | Ghi chú |
|---|---|---|---|
| Cổng `G1` đến `G4` | `0.<n>.0` | `next` | Bản xem trước. Schema workspace tương thích từ `0.1.0` trở đi (CW-03) |
| Bản vá giữa các cổng | `0.<n>.<vá>` | `next` | Chỉ sửa lỗi SEV-1, SEV-2 |
| Cổng `G5` | `1.0.0` | `latest` | Bản chính thức |

Changesets (QC-80, QC-81) sinh `CHANGELOG.md`. Không dùng chế độ pre-release của changesets; phiên bản đặt theo bảng trên.

---

### 17.2. Quy trình phát hành

1. PR "Version Packages" do changesets tạo được review và merge.
2. `release.yml` build, chạy lại toàn bộ CI, phát hành npm với provenance (SPEC-05 mục 16), tạo tag `v<phiên bản>`.
3. Cài thử `npx <tên package>@<phiên bản>` trên 3 hệ điều hành (17.3 mục 1 đến 3).
4. Ghi phiên bản vào báo cáo phase.

---

### 17.3. Danh sách kiểm tra phát hành

| # | Kiểm tra |
|---|---|
| 1 | `npx` trong thư mục trống trên Windows 11 sạch (chỉ có Node 22.12, không có Python, không có công cụ build) |
| 2 | `npx` trên macOS (Apple Silicon) và Ubuntu 24.04 sạch |
| 3 | Mở workspace tạo bởi mọi phiên bản `0.x` trước đó: mở đúng (migration nếu có) |
| 4 | Kích thước package npm ghi vào báo cáo; không chứa file test, fixture, source map của Studio |
| 5 | Giấy phép mọi phụ thuộc runtime thuộc danh sách chấp nhận (SPEC-01.1 mục 13.2); file `THIRD_PARTY_NOTICES` sinh tự động |
| 6 | Không có request mạng nào khi khởi động và dùng Studio không có AI, không có proxy (SEC-10), kiểm bằng chặn mạng |
| 7 | `SECURITY.md`, README `vi` và `en` cập nhật |

---

## 18. SPEC-06 TRONG GIAI ĐOẠN THI CÔNG

SPEC-06 (Chất lượng và kiểm thử) **không** viết trước toàn bộ. Lý do: chi tiết kiểm thử phụ thuộc vào điều học được khi hiện thực và khi chạy VG, viết trước sẽ thiếu chính xác.

### 18.1. Cách viết

| Phần | Viết khi | Duyệt trước | Nội dung |
|---|---|---|---|
| SPEC-06.0 | WP-0.06 | `G0` | Hạ tầng kiểm thử: cấu hình Vitest, Playwright, quy ước fixture, golden file, phản hồi AI ghi sẵn, `pnpm bench` (định dạng kết quả, cách so ngân sách), `pnpm trace`, môi trường CI |
| SPEC-06.1 đến SPEC-06.5 | Đầu phase tương ứng (DoR phase, mục 10.2) | Cổng của phase đó | Mục 18.2 cho phase đó |

---

### 18.2. Nội dung bắt buộc của SPEC-06.*n*

| Mục | Nội dung |
|---|---|
| Bản đồ AC → test | Mỗi AC của phase: file test, tên test, môi trường, dữ liệu |
| Fixture | Danh sách fixture mới, cấu trúc, cách sinh, ai được sửa |
| Benchmark | Kịch bản đo cho từng PB của phase: dữ liệu, số lần chạy, cách tính P95 |
| Dữ liệu kiểm thử đặc biệt | Ví dụ bộ 50 yêu cầu VG-06, bộ 30 đầu ra AI lỗi, ma trận đường dẫn SPEC-05 |
| Kiểm thử thủ công | Kịch bản nghiệm thu của phase, thiết bị, trình duyệt |
| Kiểm thử bổ sung | Ca kiểm thử phát hiện thêm khi hiện thực, ngoài mức tối thiểu của SPEC-04.x |

Mục "Tiêu chí kiểm thử" trong SPEC-04.x và SPEC-05 mục 17 là **mức tối thiểu**. SPEC-06 chỉ được bổ sung, không được bớt.

---

## 19. MẪU TÀI LIỆU

### 19.1. Báo cáo VG (`docs/construction/vg/vg-<số>.md`)

```markdown
# VG-<số> — <tên>

- Kiểm chứng cho: ADR-…
- Giai đoạn: A | B · Lần chạy: <số> · Ngày: YYYY-MM-DD
- Kết luận: **Đạt** | **Không đạt**

## Môi trường
Hệ điều hành, CPU, RAM, Node, trình duyệt, phiên bản mọi thư viện liên quan.

## Quy trình
Như spec / sai khác so với spec (nếu có, kèm lý do).

## Kết quả
| Tiêu chí | Ngưỡng | Đo được | Đạt? |
|---|---|---|---|

## Dữ liệu thô
Đường dẫn artifact CI hoặc file đính kèm.

## Phân tích, việc tiếp theo
```

---

### 19.2. Báo cáo phase (`docs/construction/phases/phase-<n>.md`)

```markdown
# Phase <n> — <tên> · Cổng G<n>

- Ngày đóng cổng: YYYY-MM-DD · Phiên bản phát hành: 0.<n>.0
- Kết luận: **Đạt** | **Không đạt**

## Gói công việc
| WP | Trạng thái | PR |

## Tiêu chí cổng
| Mã (GC-xx, G<n>-xx) | Bằng chứng (link test, CI, báo cáo) | Đạt? |

## Ngân sách hiệu năng
| PB | Ngân sách | P95 đo được (3 đêm) |

## VG
| VG | Giai đoạn | Kết luận | Báo cáo |

## Lỗi còn mở
| Issue | SEV | Kế hoạch |

## Thay đổi spec trong phase
| CR / PR spec | Tóm tắt |

## Rủi ro: rà lại, sự cố, bài học

## Video kịch bản nghiệm thu
```

---

### 19.3. Issue gói công việc

```markdown
## WP-<phase>.<số> — <tên>
Phase: <n> · Milestone: Phase <n>

### Spec
<mã các mục spec>

### Phụ thuộc
WP: … · VG: …

### Đầu ra kiểm chứng được
<chép từ bảng WP>

### Definition of Ready
- [ ] DR-01 … DR-09

### Kế hoạch PR
- [ ] #<issue con> <tiêu đề>

### Definition of Done
- [ ] DW-01 … DW-08
```

---

### 19.4. Bảng tiến độ (`docs/construction/progress.md`)

```markdown
# Tiến độ thi công

Cập nhật: YYYY-MM-DD · Spec: phiên bản <x.y> · Phase hiện tại: <n>

## Tổng quan phase
| Phase | Trạng thái | WP xong / tổng | Cổng |

## Phase <n>: gói công việc
| WP | Tên | Trạng thái | Báo cáo | Ghi chú |

## Điều kiện bắt đầu phase (mục 10.2)
| Điều kiện | Trạng thái |

## Việc chờ chủ sản phẩm
| # | Việc | Chặn WP nào |

## Vướng mắc và rủi ro đang mở
| # | Vấn đề | Ảnh hưởng | Hướng xử lý |

## Bước tiếp theo
1. …
```

---

### 19.5. Báo cáo gói công việc (`docs/construction/wp/wp-<phase>.<số>.md`)

```markdown
# WP-<phase>.<số> — <tên>

- Trạng thái: Đang làm | Đang nghiệm thu | Xong
- Bắt đầu: YYYY-MM-DD · Xong: YYYY-MM-DD
- Spec dẫn chiếu: <mã mục> (Spec phiên bản <x.y>)

## Đầu ra kiểm chứng được (từ bảng WP)

## Việc đã làm
| Ngày | Việc | Kết quả |

## Kiểm chứng
| Kiểm tra | Lệnh hoặc cách làm | Kết quả |

## Sai khác so với spec
| Nội dung | Xử lý (làm rõ / CR-nnn / phiên bản Spec đã sửa) |

## Bộ thay đổi (mục 3.5, 12.6)
| Mã | Module | File tạo / sửa / đổi tên | File dùng chung (CW-40) | Kiểm chứng | Commit message gợi ý | Trạng thái |

## Definition of Done (mục 11.2)
- [ ] DW-01 … DW-08

## Việc còn lại
```

---

### 19.6. Bảng module (`docs/construction/modules.md`)

```markdown
# Module

Cập nhật: YYYY-MM-DD · Spec: phiên bản <x.y>

| Module | Tên | Phase | Trạng thái | Bộ thay đổi chờ commit | Bộ thay đổi đã commit |
```

Trạng thái module: `Chưa bắt đầu`, `Đang làm`, `Xong` (mọi WP chứa module đã Xong).

---

## 20. TRUY VẾT

### 20.1. Tiêu chí chấp nhận → cổng

| AC | Cổng đạt lần đầu | Ghi chú |
|---|---|---|
| AC-01, AC-02, AC-03 | `G1` | |
| AC-08 | `G2` (giao diện), `G4` (gọi API) | |
| AC-09, AC-10, AC-11, AC-14, AC-15 | `G2` | |
| AC-06 | `G3` | |
| AC-07 | `G3` (không dữ liệu), `G4` (đầy đủ) | |
| AC-04, AC-05, AC-13 | `G4` | AC-13 phần quét backend ở `G4`; phần AI context và log được kiểm từ `G3` |
| AC-12, AC-16 | `G5` | |
| AC-01 đến AC-16 | `G5` | Hồi quy toàn bộ |

---

### 20.2. NFR và PB → cổng

| Cổng | NFR | PB |
|---|---|---|
| `G1` | NFR-01, 02, 03, 06, 07, 14, 15, 17 | PB-01 đến 04, PB-10, 11, PB-13 đến 19 |
| `G2` | NFR-05, 09 đến 13 | PB-06 đến 09, PB-12 |
| `G3` | NFR-08, 16 | — |
| `G4` | NFR-04 | PB-05 |
| `G5` | Toàn bộ | Toàn bộ, gồm PB-20 |

---

### 20.3. Module → gói công việc

| Module | WP |
|---|---|
| M-RP | WP-0.01, 0.02 |
| M-QA | WP-0.06, 0.07, 2.12, 3.07; fixture backend ở WP-4.00 |
| M-MC (SPEC-03 phần A) | WP-1.01, 1.02, 1.03 |
| M-SV | WP-0.03, 0.04; log, cấu hình người dùng ở WP-1.05 |
| M-CL | WP-0.03, 1.11 |
| M-ST | WP-0.03, 0.05; khung Studio ở WP-1.06 |
| M-TK, M-SM | WP-1.04 |
| M-WS, M-DS | WP-1.05 |
| M-SH, M-HS | WP-1.06 |
| M-CV, M-OV | WP-1.07; tương tác, Xem thử, rich text ở WP-2.08, 2.09 |
| M-DD, M-LB, M-LT | WP-1.08; preset có tương tác và R-LT-08, R-LT-09 ở WP-2.08 |
| M-IN | WP-1.09; mục 11.2 ở WP-2.08; nhóm Dữ liệu ở WP-4.07 |
| M-CB, M-KB, M-PG | WP-1.10 |
| M-TP, M-PT | WP-2.01 |
| M-CG | WP-2.02, 2.03, 2.08, 2.10 |
| M-HT | WP-2.04 |
| M-VL | WP-2.05 |
| M-EX | WP-2.06 |
| M-XU | WP-2.07 |
| M-AG, M-AC, M-AP, M-AV, M-AU, M-AR | WP-3.01 đến 3.06; M-AC mức 3 ở WP-4.11 |
| M-BS, M-XO, M-XJ, M-XP, M-XA | WP-4.01 đến 4.05 |
| M-DC, M-DB, M-MK, M-LP, M-DL | WP-4.06 đến 4.10 |
| M-UC | WP-5.01, 5.02 |
| M-TM, M-TI | WP-5.03, 5.04 |
| M-LS | WP-5.06 |

---

### 20.4. Biện pháp bảo mật → gói công việc

| Nhóm (SPEC-05) | WP |
|---|---|
| Mục 5, 6, 14 (mạng, phiên, trình duyệt, tài nguyên) | WP-0.04 |
| Mục 7 (file system), 13 (workspace trust), 15 (log) | WP-1.05, WP-1.06 |
| Mục 10 (tiến trình con), 12 (code xuất ra) | WP-2.05, WP-2.11 |
| Mục 8 (secrets: API key), 9 (AI) | WP-3.01 đến 3.04 |
| Mục 8 (secrets: quét backend), 11 (proxy) | WP-4.01, WP-4.09 |
| Mục 16 (chuỗi cung ứng) | WP-0.02, mục 17 |

---

### 20.5. Yêu cầu SRS → phần này

| Yêu cầu | Mục |
|---|---|
| SRS mục 16 (Phase 1 đến 5) | 3, 5 đến 9 |
| SRS mục 14 (AC-01 đến AC-16) | 20.1 |
| SRS mục 11 (NFR) | 20.2 |
| SRS mục 18 (tiêu chí thành công) | 9.3 |

---

## 21. CẬP NHẬT CÁC PHẦN KHÁC

| Phần | Thay đổi |
|---|---|
| Phần 0 mục 0.2 | SPEC-06 viết dần trong thi công (mục 18), SPEC-07 Draft v0.1 |
| Phần 0 mục 0.4 | Thêm tiền tố `CW-xx`, `WP-n.nn`, `GC-xx`, `G<n>-xx`, `DR-xx`, `DW-xx`, `RK-xx`, `SEV-n`, `CR-nnn` |
| Phần 0 mục 0.6 | Thêm quy tắc 6: phần đã duyệt chỉ sửa qua mục 13 |
| SPEC-01.1 mục 3.3 | `model/src/` thêm `features.ts` (mục 3.4) và `analysis/` (SPEC-04.5 mục 6a) |
| SPEC-01.2 mục 12 | Thêm PB-20 (SPEC-04.5 mục 6a) |
| SPEC-02 mục 2.1 | `docs/` thêm `vg/`, `phases/`; gốc repo thêm `SECURITY.md`, `LICENSE` |
| SPEC-02 mục 2.3 | Thêm script `pnpm trace` |
| SPEC-02 mục 9 | Thêm QC-93 (gắn mã quy tắc vào tên test), QC-94 (`pnpm trace`) |
| SPEC-02 mục 11.1 | Thêm loại nhánh `spike` (CW-21) |
| SPEC-02 mục 16 | Thêm Q-17 (giấy phép của ReactCraft) |
| SPEC-03 mục 10.1 | `SessionInfo` thêm `features: readonly FeatureId[]` (CW-18) |
| SPEC-04.5 | Thêm M-LS (mục 6a). `propRef` thêm đích `alt` cho ảnh |
| SPEC-04.2 mục 6.3 | R-CG-17 thêm cách sinh code cho `propRef` |
| SPEC-01.1 ADR-BE-26 | Truy vết AC-01 đến AC-16 |
| SRS | Thêm FR-41 (gợi ý tách layout dùng chung), AC-16; làm rõ phạm vi Phase 5 |

---

# LỊCH SỬ THAY ĐỔI

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 0.1 | 2026-10-07 | SPEC-01.1 Backend Technology Stack, bản nháp đầu tiên: 19 ADR backend, 6 Verification Gate, ngân sách hiệu năng, chính sách phụ thuộc |
| 0.2 | 2026-10-07 | Gộp toàn bộ spec vào một file duy nhất. Thêm Phần 0 (hướng dẫn sử dụng, quy ước chung). Chuyển mục Quy ước của SPEC-01.1 lên Phần 0 và đánh lại số mục của SPEC-01.1 |
| 0.3 | 2026-10-07 | Đổi tài liệu gốc sang SRS v4.0 (Design Studio + xuất code + AI). Đánh dấu SPEC-01.1 cần sửa theo SRS v4.0. Đổi SPEC-01.2 từ UI overlay sang Studio UI |
| 0.4 | 2026-10-07 | Viết lại SPEC-01.1 (v0.2) theo SRS v4.0: backend là server local độc lập (Fastify), monorepo với `@reactcraft/model` dùng chung, Design Model dạng operation, phân tích backend đa ngôn ngữ (oxc, tree-sitter, OpenAPI), sinh code bằng IR + Prettier, export transaction + manifest. 27 ADR, 8 Verification Gate. Bỏ `magic-string` và mô hình Vite plugin của bản nháp 0.1. Cho phép đánh lại mã định danh trong bản nháp chưa duyệt |
| 0.5 | 2026-10-07 | Thêm SPEC-01.2 Studio UI Technology Stack (v0.1): 19 ADR-FE, VG-09 đến VG-13, ngân sách PB-13 đến PB-19. Hỗ trợ tiếng Việt và tiếng Anh ngay từ đầu. Cập nhật SPEC-01.1 (v0.3): thêm `model/styling` dùng chung, server không trả thông báo đã dịch, AI trả lời theo ngôn ngữ giao diện, lưu ngôn ngữ trong cấu hình người dùng |
| 0.6 | 2026-10-09 | Thêm SPEC-02 Quy chuẩn code & repo (v0.1): cấu trúc repo, 92 quy tắc QC-01 đến QC-92 (đặt tên, ngôn ngữ trong code, TypeScript, xử lý lỗi bằng Result, React, server, kiểm thử, định dạng, Git, PR, review, code do AI hỗ trợ, CI), Definition of Done mức thay đổi code. Thêm tiền tố `QC-xx` vào bảng mã định danh |
| 0.7 | 2026-10-09 | Thêm SPEC-03 Interface (v0.1): kiểu cơ sở, file workspace, Design Node (25 loại, StyleProps, ContentProps, Binding), dạng phẳng, 18 Design Operation, quy tắc hợp lệ V-01 đến V-81, API REST (9 nhóm endpoint), job, sự kiện WebSocket, giới hạn, mã lỗi E001 đến E021. Sửa liên quan: QC-50 dùng E013; ADR-BE-09 dùng E017 cho revision cũ; thêm `assets/` vào workspace và `mock/` vào model; khung nhìn Desktop kích hoạt `xl`; giải quyết Q-02 của SPEC-01.1 |
| 0.8 | 2026-10-09 | Thêm cơ chế **khung chuẩn**: chế độ desktop-first (mặc định, khung 1440 × 900) hoặc mobile-first, khung thiết kế tùy chỉnh, ánh xạ khung sang khóa responsive, breakpoint `2xl`, Grid auto-fit, operation `workspace.update` (SPEC-03 2.2, 2.2a, 3.2, 4.5, 7.2; SPEC-01.2 ADR-FE-06, ADR-FE-08; SPEC-01.1 ADR-BE-05: Tailwind v3.4+). Thêm SPEC-04.1 Workspace & Studio Core (v0.1): 15 module M-xx cho Phase 1, bộ token mặc định, Styling Map đầy đủ, thuật toán kéo thả, Inspector, Undo/Redo, clipboard, phím tắt, quản lý trang. Giải quyết Q-05 của SPEC-01.2 |
| 0.9 | 2026-10-09 | Thêm SPEC-04.2 Xuất code (v0.1): phân tích Target Project và quy ước, template project mới, pipeline sinh code (Code IR, lowering, emit, format), đặt tên và vị trí file, User Component với slot, icon, routes, theme v3/v4, chỉnh sửa hỗ trợ có kiểm soát, xuất HTML/CSS, Export Manager (trạng thái file, transaction, manifest, bước thủ công), kiểm tra T1/T2/T3, màn hình Export. Cập nhật SPEC-03 (trạng thái `orphaned`, quyết định `delete`, `manualSteps`) và SPEC-01.1 (thêm `tailwindcss` vào phụ thuộc runtime) |
| 0.10 | 2026-10-09 | **Hoàn thiện thiết kế (không để dành phase sau):** tương tác (SPEC-03 mục 6a, operation `setInteractions`, `setRuntime`, V-90 đến V-98) với chế độ Xem thử (SPEC-04.1 mục 7.7) và sinh code (SPEC-04.2 mục 6.7, R-HT-04); rich text `TextRun` + trình soạn TipTap (ADR-FE-20, VG-14); chế độ tối qua token màu (`darkMode`); gradient và ảnh nền; sticky, z-index, tràn; transition; ràng buộc nhập liệu; mô tả trang (SEO); ngôn ngữ nội dung `contentLocale` tách khỏi ngôn ngữ giao diện; nút thao tác và bấm dòng của bảng; bảng cuộn ngang trên điện thoại; project JavaScript và monorepo; xem song song nhiều khung chuyển sang Accepted; 5 preset mới (thanh điều hướng responsive, Hero, Badge, Avatar, form tạo mới có Modal). Giải quyết hoặc quyết định Q-03, Q-09 đến Q-16 |
| 0.11 | 2026-10-09 | Thêm SPEC-04.3 AI (v0.1): 4 chế độ (sửa vùng chọn, dựng trang, tối ưu responsive, sửa tiếp), Provider Gateway, Context Builder 4 mức có chọn mức tự động và ngân sách token, hợp đồng đầu ra và operation được phép theo chế độ, ID tạm, ngôn ngữ tóm tắt và nội dung, kiểm tra 6 bước có thử lại, phạm vi vùng chọn, cảnh báo chất lượng AIQ-01 đến AIQ-06, Responsive Audit RA-01 đến RA-07, AI Panel, tác vụ nhanh, xem trước đề xuất trên Canvas, bảo mật. Cập nhật SPEC-03 (`AIRequest`, `AIProposal`, `AIContextPreview`) và SPEC-01.2 (thêm `html-to-image`) |
| 0.12 | 2026-10-09 | Thêm SPEC-04.4 Quét backend, Data Source & gắn dữ liệu (v0.1): điều phối quét có cache theo file, phát hiện framework và xác thực, bộ trích xuất OpenAPI, Express, NestJS, Prisma, Mongoose, TypeORM, Sequelize, Django/DRF, trích xuất bằng AI có xác nhận, gộp và duyệt catalog, giữ mục `stale` để thiết kế không hỏng, kéo entity vào Canvas thành bảng/lưới/chi tiết/form/trang CRUD, ánh xạ kiểu field sang ô nhập, tìm kiếm/sắp xếp/phân trang, 4 trạng thái dữ liệu, dữ liệu mẫu theo ngôn ngữ nội dung, proxy dữ liệu thật chỉ đọc cho Xem thử, sinh lớp dữ liệu (client, auth, kiểu, hàm API, hook có/không react-query, form, xóa có xác nhận). Cập nhật SPEC-03 (`stale`, `auth`, `responseEnvelope`, vai trò tham số, `datetime-local`, `optionsFrom`, `dataOptions`, `DetailView` kind `detail`, endpoint `/data-proxy`, E022). Thêm mục SPEC-04.5 vào kế hoạch |
| 0.13 | 2026-10-09 | Thêm SPEC-04.5 User Component & Design Token (v0.1): trình hướng dẫn tạo component (đề xuất props, slot bắt buộc khi có tương tác, `recordEntity`), chế độ sửa component, `propRef`, đổi props/slot với instance, tách/nhân bản/xóa, quyết định không có biến thể; panel token, đổi tên/thay thế token, kiểm tra tương phản, kiểu chữ mẫu, nhập token từ Tailwind v3/v4. Thêm SPEC-05 Bảo mật (v0.1): tài sản, tác nhân, mô hình mối đe dọa, biện pháp S-01 đến S-96 (token phiên qua fragment, Host/Origin chống DNS rebinding, CSP, chống XSS, chuẩn hóa đường dẫn kể cả Windows, ảnh workspace, lọc secrets trong file bình thường, AI, tiến trình con, proxy chống SSRF, code xuất ra, workspace trust, giới hạn tài nguyên, log, không telemetry, chuỗi cung ứng), danh sách kiểm thử bảo mật. Cập nhật SPEC-03 (`recordEntity`, `propRef`, `token.rename`, `token.replace`, V-56, V-57, V-99, `/target-project/tokens`, `/workspace/trust`, `trusted`), SPEC-01.1 (thêm `cross-spawn`, `culori`) |
| 0.14 | 2026-10-09 | Thêm SPEC-07 Quy trình thi công (v0.1): 34 nguyên tắc CW-xx (spec trước code, model hoàn chỉnh từ Phase 1, hiển thị đầy đủ tạo theo phase, cờ tính năng), Phase 0 đến 5 với 61 gói công việc WP, lịch VG hai giai đoạn A/B, các bước khởi tạo repo, cổng nghiệm thu G0 đến G5 (tiêu chí chung GC-xx và riêng G<n>-xx), kịch bản nghiệm thu từng phase, Definition of Ready/Done, task packet cho AI coding assistant, kiểm soát thay đổi spec (CR), phương án dự phòng cho từng VG, mức nghiêm trọng lỗi SEV-1 đến SEV-4, sổ rủi ro RK-01 đến RK-14, phát hành 0.x → 1.0, cách viết SPEC-06 trong thi công, mẫu báo cáo. SPEC-06 chuyển sang viết dần trong thi công. Bổ sung phần còn thiếu: M-LS gợi ý tách layout dùng chung (SPEC-04.5 mục 6a, PB-20), `propRef` đích `alt`, R-CG-17 sinh code cho `propRef`. Cập nhật Phần 0 (tiền tố mã mới, quy tắc 6), SPEC-01.1 (cây `model/src`, truy vết ADR-BE-26), SPEC-02 (`docs/vg`, `docs/phases`, `pnpm trace`, QC-93, QC-94, nhánh `spike`, Q-17), SPEC-03 (`SessionInfo.features`, `propRef.target`, V-57). SRS: thêm FR-41, AC-16, làm rõ phạm vi Phase 5 |
| 0.15 | 2026-10-11 | SPEC-01.1 mục 13.3: ghi phiên bản đã ghim của Node, TypeScript (6.0.3) và công cụ phát triển (pnpm 10.34.6, ESLint 10.12.0, typescript-eslint 8.71.1, Prettier 3.9.10, lefthook 2.2.1, commitlint 21.2.3, changesets 3.0.3, `@types/node` 22). SPEC-02: `prettier-plugin-tailwindcss` cấu hình riêng cho Studio (thêm cùng Studio), `.prettierignore` cho tài liệu spec, fixture, template; thêm dev dependency `@eslint/js`. Giải quyết Q-08 (bản chính của Spec là `docs/spec.md` trong repo), quyết định Q-17 (giấy phép MIT) |
| 0.16 | 2026-10-11 | Tách báo cáo thi công khỏi Spec: Phần 0 thêm quy tắc 7; SPEC-07 thêm mục 12.5 (CW-35 đến CW-38) và mẫu 19.4 (bảng tiến độ), 19.5 (báo cáo gói công việc); mọi báo cáo thi công (tiến độ, WP, VG, phase) đặt trong `docs/construction/`; SPEC-02 mục 2.1 cập nhật cây `docs/` |
| 0.17 | 2026-10-11 | SPEC-07: thêm mục 3.5 (module là đơn vị thi công; 6 module nền M-RP, M-QA, M-MC, M-SV, M-CL, M-ST; thư mục sở hữu của mọi module; bộ thay đổi `CS-n.nn-k`; CW-39 đến CW-42), mục 12.6 (chế độ thi công local: chưa dùng GitHub, chủ sản phẩm tự commit, `pnpm verify` thay CI, tiêu chí đa nền tảng hoãn tới khi bật CI; CW-43 đến CW-47), mẫu 19.6 (bảng module), mục bộ thay đổi trong mẫu 19.5; bảng 20.3 thêm module nền. Phần 0: thêm mã `CS-n.nn-k`. SPEC-02 mục 11: ghi chú chế độ local. SPEC-01.1, SPEC-01.2 mục 3.3: dẫn tới SPEC-07 mục 3.5 |
